const router = require('express').Router();
const { authenticate } = require('../middleware/auth');

module.exports = (pgPool, redis) => {
  const TRADE_TYPES = [0, 1];
  let hasCurrentBalanceColumnPromise;
  let hasNicknameColumnPromise;

  const hasCurrentBalanceColumn = async () => {
    if (!hasCurrentBalanceColumnPromise) {
      hasCurrentBalanceColumnPromise = pgPool
        .query(
          `SELECT 1
           FROM information_schema.columns
           WHERE table_name = 'MT5Account'
             AND column_name = 'current_balance'`
        )
        .then((result) => result.rows.length > 0)
        .catch(() => false);
    }

    return hasCurrentBalanceColumnPromise;
  };

  const hasNicknameColumn = async () => {
    if (!hasNicknameColumnPromise) {
      hasNicknameColumnPromise = pgPool
        .query(
          `SELECT 1
           FROM information_schema.columns
           WHERE table_name = 'MT5Account'
             AND column_name = 'nickname'`
        )
        .then((result) => result.rows.length > 0)
        .catch(() => false);
    }

    return hasNicknameColumnPromise;
  };

  // Get dashboard summary
  router.get('/summary', authenticate, async (req, res) => {
    const userId = req.userId;
    const cacheKey = `dashboard:${userId}`;
    
    try {
      // Try Redis cache first
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log('📦 Cache hit for user:', userId);
          return res.json(JSON.parse(cached));
        }
      }

      const includeCurrentBalance = await hasCurrentBalanceColumn();
      const includeNickname = await hasNicknameColumn();
      const currentBalanceSelect = includeCurrentBalance
        ? 'COALESCE(a.current_balance, 0)::float as current_balance,'
        : '0::float as current_balance,';
      const nicknameSelect = includeNickname
        ? 'a.nickname as nickname,'
        : 'NULL::text as nickname,';

      // Fetch account stats using only actual trade deals (BUY/SELL)
      const query = `
        SELECT 
          a.id as account_id,
          a.login,
          ${nicknameSelect}
          a.broker_name,
          a.investor_mode,
          ${currentBalanceSelect}
          COALESCE(stats.total_profit, 0) as total_profit,
          COALESCE(stats.total_trades, 0) as total_trades,
          COALESCE(stats.winning_trades, 0) as winning_trades,
          COALESCE(stats.losing_trades, 0) as losing_trades,
          COALESCE(stats.win_rate, 0) as win_rate,
          COALESCE(stats.daily_pnl, '{}'::jsonb) as daily_pnl,
          COALESCE(stats.monthly_pnl, '{}'::jsonb) as monthly_pnl,
          stats.last_updated
        FROM "MT5Account" a
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(SUM(t.profit), 0)::float as total_profit,
            COUNT(*)::int as total_trades,
            COUNT(*) FILTER (WHERE t.profit > 0)::int as winning_trades,
            COUNT(*) FILTER (WHERE t.profit < 0)::int as losing_trades,
            COALESCE(
              ROUND(
                ((COUNT(*) FILTER (WHERE t.profit > 0))::numeric / NULLIF(COUNT(*), 0)::numeric) * 100,
                2
              ),
              0
            )::float as win_rate,
            COALESCE((
              SELECT jsonb_object_agg(day_key, day_profit)
              FROM (
                SELECT
                  TO_CHAR(t2.time::date, 'YYYY-MM-DD') as day_key,
                  ROUND(SUM(t2.profit)::numeric, 2)::float as day_profit
                FROM "Trade" t2
                WHERE t2.account_id = a.id
                  AND t2.type = ANY($2::int[])
                GROUP BY day_key
              ) day_stats
            ), '{}'::jsonb) as daily_pnl,
            COALESCE((
              SELECT jsonb_object_agg(month_key, month_profit)
              FROM (
                SELECT
                  TO_CHAR(t3.time::date, 'YYYY-MM') as month_key,
                  ROUND(SUM(t3.profit)::numeric, 2)::float as month_profit
                FROM "Trade" t3
                WHERE t3.account_id = a.id
                  AND t3.type = ANY($2::int[])
                GROUP BY month_key
              ) month_stats
            ), '{}'::jsonb) as monthly_pnl,
            MAX(t.time) as last_updated
          FROM "Trade" t
          WHERE t.account_id = a.id
            AND t.type = ANY($2::int[])
        ) stats ON true
        WHERE a.user_id = $1
        ORDER BY a.created_at DESC
      `;
      
      const result = await pgPool.query(query, [userId, TRADE_TYPES]);
      
      // Calculate aggregated metrics
      const accounts = result.rows;
      const totalProfit = accounts.reduce((sum, r) => sum + parseFloat(r.total_profit || 0), 0);
      const totalTrades = accounts.reduce((sum, r) => sum + parseInt(r.total_trades || 0), 0);
      const totalWinning = accounts.reduce((sum, r) => sum + parseInt(r.winning_trades || 0), 0);
      
      const summary = {
        totalProfit: parseFloat(totalProfit.toFixed(2)),
        totalTrades,
        winningTrades: totalWinning,
        losingTrades: totalTrades - totalWinning,
        winRate: totalTrades > 0 ? parseFloat(((totalWinning / totalTrades) * 100).toFixed(2)) : 0,
        accountCount: accounts.length,
        accounts: accounts.map(r => ({
          ...r,
          current_balance: parseFloat(r.current_balance || 0),
          total_profit: parseFloat(r.total_profit || 0),
          total_trades: parseInt(r.total_trades || 0),
          win_rate: parseFloat(r.win_rate || 0)
        }))
      };
      
      // Cache for 60 seconds
      if (redis) {
        await redis.setex(cacheKey, 60, JSON.stringify(summary));
      }
      
      res.json(summary);
    } catch (e) {
      console.error('Dashboard error:', e);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  });

  // Get recent trades for an account
  router.get('/trades/:accountId', authenticate, async (req, res) => {
    const { accountId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    try {
      // Verify ownership
      const check = await pgPool.query(
        'SELECT id FROM "MT5Account" WHERE id = $1 AND user_id = $2',
        [accountId, req.userId]
      );
      
      if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }
      
      const result = await pgPool.query(
        `SELECT id, ticket, symbol, profit, volume, price, time, type 
         FROM "Trade" 
         WHERE account_id = $1 
           AND type = ANY($4::int[])
         ORDER BY time DESC 
         LIMIT $2 OFFSET $3`,
        [accountId, parseInt(limit), parseInt(offset), TRADE_TYPES]
      );
      
      // Get total count
      const countResult = await pgPool.query(
        'SELECT COUNT(*) FROM "Trade" WHERE account_id = $1 AND type = ANY($2::int[])',
        [accountId, TRADE_TYPES]
      );
      
      res.json({
        trades: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (e) {
      console.error('Error fetching trades:', e);
      res.status(500).json({ error: 'Failed to fetch trades' });
    }
  });

  // Get calendar daily profit totals for a month
  router.get('/calendar/:accountId', authenticate, async (req, res) => {
    const { accountId } = req.params;
    const { month } = req.query;
    const targetMonth = typeof month === 'string' ? month : new Date().toISOString().slice(0, 7);

    const [year, monthNumber] = (targetMonth || '').split('-').map((value) => parseInt(value, 10));
    if (!year || Number.isNaN(monthNumber) || monthNumber < 1 || monthNumber > 12) {
      return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM.' });
    }

    try {
      const accountIds = [];

      if (accountId === 'all') {
        const accountResult = await pgPool.query(
          'SELECT id FROM "MT5Account" WHERE user_id = $1',
          [req.userId]
        );
        accountResult.rows.forEach((row) => accountIds.push(row.id));
      } else {
        const check = await pgPool.query(
          'SELECT id FROM "MT5Account" WHERE id = $1 AND user_id = $2',
          [accountId, req.userId]
        );

        if (check.rows.length === 0) {
          return res.status(404).json({ error: 'Account not found' });
        }

        accountIds.push(accountId);
      }

      const startDate = `${year}-${String(monthNumber).padStart(2, '0')}-01`;
      const nextMonth = new Date(year, monthNumber - 1, 1);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const endDate = nextMonth.toISOString().slice(0, 10);

      const result = await pgPool.query(
        `SELECT TO_CHAR(time::date, 'YYYY-MM-DD') AS date, SUM(profit)::float AS profit
         FROM "Trade"
         WHERE account_id = ANY($1)
           AND time >= $2
           AND time < $3
           AND type = ANY($4::int[])
         GROUP BY date
         ORDER BY date ASC`,
        [accountIds, startDate, endDate, TRADE_TYPES]
      );

      const dailyPnl = result.rows.reduce((memo, row) => {
        memo[row.date] = parseFloat(row.profit) || 0;
        return memo;
      }, {});

      res.json({ daily_pnl: dailyPnl, month: targetMonth });
    } catch (e) {
      console.error('Error fetching calendar totals:', e);
      res.status(500).json({ error: 'Failed to fetch calendar totals' });
    }
  });

  return router;
};