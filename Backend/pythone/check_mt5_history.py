import MetaTrader5 as mt5
from datetime import datetime
import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

# Get your account credentials from the database
DB_DSN = os.getenv('DATABASE_URL')
conn = psycopg2.connect(DB_DSN)
cur = conn.cursor()
cur.execute('SELECT login, password, server FROM "MT5Account" LIMIT 1')
login, encrypted_pwd, server = cur.fetchone()
cur.close()
conn.close()

# You'll need to decrypt the password (copy the decrypt function from sync_engine.py)
# For this test, just paste the decryption function here:
import base64
import hashlib
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', '01234567890123456789012345678901')

def _derive_key_and_iv(password, salt):
    d = b''
    prev = b''
    while len(d) < 48:
        prev = hashlib.md5(prev + password + salt).digest()
        d += prev
    return d[:32], d[32:48]

def decrypt_password(encrypted_text):
    encrypted_bytes = base64.b64decode(encrypted_text)
    if encrypted_bytes[:8] != b'Salted__':
        return None
    salt = encrypted_bytes[8:16]
    key, iv = _derive_key_and_iv(ENCRYPTION_KEY.encode('utf-8'), salt)
    ciphertext = encrypted_bytes[16:]
    cipher = AES.new(key, AES.MODE_CBC, iv)
    decrypted = unpad(cipher.decrypt(ciphertext), AES.block_size)
    return decrypted.decode('utf-8')

password = decrypt_password(encrypted_pwd)
print(f"Decrypted password: {password[:4]}****")  # show first 4 chars for verification

# Initialize MT5
if not mt5.initialize():
    print("MT5 init failed")
    exit()

print(f"Login attempt: {login}@{server}")
if mt5.login(login, password, server):
    print("Login successful")
    # Get account info
    account_info = mt5.account_info()
    print(f"Account balance: {account_info.balance if account_info else 'N/A'}")
    
    # Try fetching deals from 2020-01-01 to now
    from_time = datetime(2020, 1, 1)
    to_time = datetime.now()
    print(f"Fetching deals from {from_time} to {to_time}")
    deals = mt5.history_deals_get(from_time, to_time)
    if deals is None:
        print("history_deals_get returned None (error)")
        print(mt5.last_error())
    elif len(deals) == 0:
        print("No deals found.")
        # Try fetching positions (open trades)
        positions = mt5.positions_get()
        print(f"Open positions: {len(positions) if positions else 0}")
        # Try fetching orders
        orders = mt5.orders_get()
        print(f"Active orders: {len(orders) if orders else 0}")
    else:
        print(f"Found {len(deals)} deals")
        for deal in deals[:5]:
            print(deal)
else:
    print("Login failed")
    print(mt5.last_error())

mt5.shutdown()