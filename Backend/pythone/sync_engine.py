import MetaTrader5 as mt5
import psycopg2
import redis
import json
import time
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
import pandas as pd
import logging
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
import hashlib
import base64

# Load environment variables
load_dotenv()

# Configuration
DB_DSN = os.getenv('DATABASE_URL')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
SYNC_INTERVAL = int(os.getenv('SYNC_INTERVAL', 10))
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', '01234567890123456789012345678901')
MT5_TERMINAL_PATH = os.getenv('MT5_TERMINAL_PATH', '').strip()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

BUY_TYPE = getattr(mt5, 'DEAL_TYPE_BUY', 0)
SELL_TYPE = getattr(mt5, 'DEAL_TYPE_SELL', 1)
ALLOWED_TRADE_TYPES = {BUY_TYPE, SELL_TYPE}
HAS_CURRENT_BALANCE_COLUMN = None
HAS_NICKNAME_COLUMN = None


def resolve_mt5_terminal_path():
    if MT5_TERMINAL_PATH:
        return MT5_TERMINAL_PATH

    common_paths = [
        r'C:\Program Files\MetaTrader 5\terminal64.exe',
        r'C:\Program Files (x86)\MetaTrader 5\terminal64.exe',
    ]

    for candidate in common_paths:
        if os.path.exists(candidate):
            return candidate

    return None


def initialize_mt5_session(login, password, server):
    
    # Sanitize server name - remove trailing numbers and spaces if needed
    if server and 'XMGlobal' in server:
        # Try without the space and number
        server = str(server).strip()
    
    terminal_path = resolve_mt5_terminal_path()
    init_kwargs = {
        'login': int(login),
        'password': password,
        'server': server,
    }

    if terminal_path:
        initialized = mt5.initialize(terminal_path, **init_kwargs)
        if initialized:
            logger.info(f"Initialized MT5 terminal at {terminal_path}")
            return True

        logger.warning(
            f"MT5 initialize with explicit path failed: {mt5.last_error()} (path={terminal_path})"
        )

    initialized = mt5.initialize(**init_kwargs)
    if initialized:
        logger.info("Initialized MT5 terminal using MetaTrader5 auto-discovery")
        return True

    logger.error(f"MT5 initialization failed: {mt5.last_error()}")
    return False


def _derive_key_and_iv(password, salt, key_length=32, iv_length=16):
    """Derive key and IV using OpenSSL EVP_BytesToKey"""
    d = b''
    prev = b''
    while len(d) < key_length + iv_length:
        prev = hashlib.md5(prev + password + salt).digest()
        d += prev
    return d[:key_length], d[key_length:key_length + iv_length]


def decrypt_password(encrypted_text):
    """Decrypt password from CryptoJS AES encrypted string"""
    try:
        encrypted_bytes = base64.b64decode(encrypted_text)
        if encrypted_bytes[:8] != b'Salted__':
            logger.error('Unexpected encrypted payload format')
            return None

        salt = encrypted_bytes[8:16]
        key, iv = _derive_key_and_iv(ENCRYPTION_KEY.encode('utf-8'), salt)
        ciphertext = encrypted_bytes[16:]

        cipher = AES.new(key, AES.MODE_CBC, iv)
        decrypted_bytes = unpad(cipher.decrypt(ciphertext), AES.block_size)
        return decrypted_bytes.decode('utf-8')
    except Exception as e:
        logger.error(f"Decryption error: {e}")
        return None


def get_account_timezone_offset(server, broker_name):
    if broker_name and str(broker_name).strip().lower() == 'dooprime':
        return timedelta(hours=5)
    if server and 'dooprime' in str(server).lower():
        return timedelta(hours=5)
    return timedelta(0)


def has_current_balance_column(conn):
    global HAS_CURRENT_BALANCE_COLUMN

    if HAS_CURRENT_BALANCE_COLUMN is not None:
        return HAS_CURRENT_BALANCE_COLUMN

    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'MT5Account'
              AND column_name = 'current_balance'
            """
        )
        HAS_CURRENT_BALANCE_COLUMN = cur.fetchone() is not None
    finally:
        cur.close()

    return HAS_CURRENT_BALANCE_COLUMN


def has_nickname_column(conn):
    global HAS_NICKNAME_COLUMN

    if HAS_NICKNAME_COLUMN is not None:
        return HAS_NICKNAME_COLUMN

    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'MT5Account'
              AND column_name = 'nickname'
            """
        )
        HAS_NICKNAME_COLUMN = cur.fetchone() is not None
    finally:
        cur.close()

    return HAS_NICKNAME_COLUMN


def persist_current_balance(conn, account_id, current_balance):
    if current_balance is None or not has_current_balance_column(conn):
        return False

    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE "MT5Account"
            SET current_balance = %s
            WHERE id = %s
            """,
            (current_balance, account_id),
        )
        conn.commit()
        return True
    finally:
        cur.close()


def persist_nickname(conn, account_id, nickname):
    cleaned_nickname = str(nickname).strip() if nickname is not None else ''
    if not cleaned_nickname or not has_nickname_column(conn):
        return False

    cur = conn.cursor()
    try:
        cur.execute(
            """
            UPDATE "MT5Account"
            SET nickname = %s
            WHERE id = %s
            """,
            (cleaned_nickname, account_id),
        )
        conn.commit()
        return True
    finally:
        cur.close()


def get_accounts_to_sync():
    """Fetch all active MT5 accounts from database"""
    try:
        conn = psycopg2.connect(DB_DSN)
        cur = conn.cursor()
        cur.execute("""
            SELECT id, login, password, server, broker_name, investor_mode, last_sync_at, user_id
            FROM "MT5Account"
        """)
        accounts = cur.fetchall()
        cur.close()
        conn.close()
        logger.info(f"Found {len(accounts)} accounts to sync")
        return accounts
    except Exception as e:
        logger.error(f"Error fetching accounts: {e}")
        return []

def update_account_summary(conn, account_id, inserted_trades, timezone_offset=timedelta(0)):
    """Update account_summary with new trade data"""
    try:
        cur = conn.cursor()

        winning_trades = sum(1 for trade in inserted_trades if trade['profit'] > 0)
        losing_trades = sum(1 for trade in inserted_trades if trade['profit'] < 0)
        total_profit_delta = sum(trade['profit'] for trade in inserted_trades)
        inserted_count = len(inserted_trades)

        daily_profit_by_day = {}
        monthly_profit_by_month = {}

        for trade in inserted_trades:
            local_time = trade['time'] + timezone_offset
            trade_date = local_time.strftime('%Y-%m-%d')
            trade_month = local_time.strftime('%Y-%m')
            daily_profit_by_day[trade_date] = daily_profit_by_day.get(trade_date, 0.0) + trade['profit']
            monthly_profit_by_month[trade_month] = monthly_profit_by_month.get(trade_month, 0.0) + trade['profit']

        cur.execute("""
            SELECT 1 FROM "AccountSummary" WHERE account_id = %s
        """, (account_id,))
        already_exists = cur.fetchone() is not None

        cur.execute("""
            INSERT INTO "AccountSummary" (
                account_id, total_profit, total_trades, winning_trades, losing_trades,
                daily_pnl, monthly_pnl, last_updated
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s::jsonb,
                %s::jsonb,
                NOW()
            )
            ON CONFLICT (account_id) DO UPDATE SET
                total_profit = "AccountSummary".total_profit + EXCLUDED.total_profit,
                total_trades = "AccountSummary".total_trades + EXCLUDED.total_trades,
                winning_trades = "AccountSummary".winning_trades + EXCLUDED.winning_trades,
                losing_trades = "AccountSummary".losing_trades + EXCLUDED.losing_trades,
                last_updated = NOW()
        """, (
            account_id,
            total_profit_delta,
            inserted_count,
            winning_trades,
            losing_trades,
            json.dumps(daily_profit_by_day),
            json.dumps(monthly_profit_by_month),
        ))

        if already_exists:
            for date_key, profit in daily_profit_by_day.items():
                cur.execute("""
                    UPDATE "AccountSummary"
                    SET daily_pnl = jsonb_set(
                        COALESCE(daily_pnl, '{}'::jsonb),
                        ARRAY[%s],
                        ((COALESCE(daily_pnl->>%s, '0'))::numeric + %s)::text::jsonb
                    )
                    WHERE account_id = %s
                """, (date_key, date_key, profit, account_id))

            for month_key, profit in monthly_profit_by_month.items():
                cur.execute("""
                    UPDATE "AccountSummary"
                    SET monthly_pnl = jsonb_set(
                        COALESCE(monthly_pnl, '{}'::jsonb),
                        ARRAY[%s],
                        ((COALESCE(monthly_pnl->>%s, '0'))::numeric + %s)::text::jsonb
                    )
                    WHERE account_id = %s
                """, (month_key, month_key, profit, account_id))

        cur.execute("""
            UPDATE "AccountSummary"
            SET win_rate = ROUND(
                (winning_trades::float / NULLIF(total_trades, 0) * 100)::numeric, 2
            )
            WHERE account_id = %s
        """, (account_id,))

        conn.commit()
        cur.close()
        logger.info(f"Updated summary for account {account_id}: {inserted_count} new trades")

    except Exception as e:
        logger.error(f"Error updating account summary: {e}")
        conn.rollback()

def sync_account(account):
    """Sync a single MT5 account"""
    account_id, login, encrypted_pwd, server, broker_name, investor_mode, last_sync, user_id = account
    
    logger.info(f"Syncing account {login}@{server}")
    
    password = decrypt_password(encrypted_pwd)
    if not password:
        logger.error(f"Failed to decrypt password for account {login}")
        return
    
    if not initialize_mt5_session(login, password, server):
        return

    authorized = mt5.login(login, password, server)
    if not authorized:
        logger.error(f"MT5 login failed for {login}@{server}: {mt5.last_error()}")
        mt5.shutdown()
        return

    account_info = mt5.account_info()
    current_balance = None
    account_nickname = None
    if account_info is not None and hasattr(account_info, 'balance'):
        try:
            current_balance = float(account_info.balance)
        except (TypeError, ValueError):
            current_balance = None
    if account_info is not None and hasattr(account_info, 'name'):
        account_nickname = account_info.name
    
    if last_sync:
        from_time = last_sync
    else:
        from_time = datetime(2020, 1, 1)
        logger.info(f"First sync for account {login}, fetching all history since {from_time}")
    
    deals = mt5.history_deals_get(from_time, datetime.now())
    if deals is None or len(deals) == 0:
        logger.info(f"No new deals for account {login}")
        try:
            conn = psycopg2.connect(DB_DSN)
            if persist_current_balance(conn, account_id, current_balance):
                logger.info(f"Updated current balance for account {login}: {current_balance}")
            if persist_nickname(conn, account_id, account_nickname):
                logger.info(f"Updated nickname for account {login}: {str(account_nickname).strip()}")
            conn.close()
        except Exception as e:
            logger.error(f"Failed to update account snapshot for account {login}: {e}")
        mt5.shutdown()
        return
    
    df = pd.DataFrame([deal._asdict() for deal in deals])
    df = df[['ticket', 'symbol', 'profit', 'volume', 'price', 'time', 'type']]
    df['time'] = pd.to_datetime(df['time'], unit='s')
    df = df.drop_duplicates(subset=['ticket'])
    
    logger.info(f"Found {len(df)} new deals for account {login}")
    
    try:
        conn = psycopg2.connect(DB_DSN)
        cur = conn.cursor()

        if persist_current_balance(conn, account_id, current_balance):
            logger.info(f"Updated current balance for account {login}: {current_balance}")
        if persist_nickname(conn, account_id, account_nickname):
            logger.info(f"Updated nickname for account {login}: {str(account_nickname).strip()}")
        
        inserted_trades = []
        inserted_count = 0
        total_profit_delta = 0.0
        account_timezone_offset = get_account_timezone_offset(server, broker_name)
        
        for _, row in df.iterrows():
            try:
                deal_type = int(row['type']) if pd.notna(row['type']) else None
                if deal_type not in ALLOWED_TRADE_TYPES:
                    continue

                profit = float(row['profit']) if pd.notna(row['profit']) else 0.0
                volume = float(row['volume']) if pd.notna(row['volume']) else 0.0
                price = float(row['price']) if pd.notna(row['price']) else 0.0
                
                cur.execute("""
                    INSERT INTO "Trade" (
                        account_id, ticket, symbol, profit, volume, price, time, type
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (account_id, ticket) DO NOTHING
                """, (
                    account_id,
                    int(row['ticket']),
                    str(row['symbol']),
                    profit,
                    volume,
                    price,
                    row['time'],
                    deal_type
                ))
                
                if cur.rowcount == 1:
                    inserted_count += 1
                    total_profit_delta += profit
                    inserted_time = row['time']
                    if hasattr(inserted_time, 'to_pydatetime'):
                        inserted_time = inserted_time.to_pydatetime()
                    inserted_trades.append({
                        'profit': profit,
                        'time': inserted_time
                    })
                    
            except Exception as e:
                logger.error(f"Error inserting trade {row['ticket']}: {e}")
                continue
        
        if inserted_count > 0:
            update_account_summary(conn, account_id, inserted_trades, account_timezone_offset)
            
        if len(df) > 0:
            cur.execute("""
                UPDATE "MT5Account" 
                SET last_sync_at = NOW() 
                WHERE id = %s
            """, (account_id,))
            conn.commit()
            
            try:
                r = redis.Redis.from_url(REDIS_URL)
                message = {
                    "accountId": str(account_id),
                    "userId": str(user_id),
                    "newTrades": inserted_count,
                    "totalProfitDelta": float(total_profit_delta),
                    "timestamp": datetime.now().isoformat()
                }
                r.publish('trade_updates', json.dumps(message))
                logger.info(f"Published trade update for user {user_id}")
            except Exception as e:
                logger.warning(f"Failed to publish Redis update: {e}")
        
        cur.close()
        conn.close()
        
        logger.info(f"✅ Synced {inserted_count} new trades for account {login}")
        
    except Exception as e:
        logger.error(f"Database error during sync: {e}")
    
    finally:
        mt5.shutdown()

def main():
    """Main sync loop"""
    logger.info(f"🚀 Starting MT5 Sync Engine (interval: {SYNC_INTERVAL}s)")
    logger.info(f"Database: {DB_DSN.split('@')[0].split('//')[0]}://...@.../trading")
    logger.info(f"Redis: {REDIS_URL}")
    
    while True:
        try:
            accounts = get_accounts_to_sync()
            
            for account in accounts:
                try:
                    sync_account(account)
                except Exception as e:
                    logger.error(f"Error syncing account {account[0]}: {e}")
                    continue
            
            logger.info(f"💤 Sleeping for {SYNC_INTERVAL} seconds...")
            time.sleep(SYNC_INTERVAL)
            
        except KeyboardInterrupt:
            logger.info("🛑 Sync engine stopped by user")
            break
        except Exception as e:
            logger.error(f"Unexpected error in main loop: {e}")
            time.sleep(SYNC_INTERVAL)

if __name__ == '__main__':
    main()