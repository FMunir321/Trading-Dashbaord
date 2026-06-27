const router = require('express').Router();
const { authenticate } = require('../middleware/auth');

module.exports = (pgPool, redis) => {
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

      // Fetch all account summaries for this user
      const query = `
        SELECT 
          a.id as account_id,
          a.login,
          a.broker_name,
          a.investor_mode,
          COALESCE(s.total_profit, 0) as total_profit,
          COALESCE(s.total_trades, 0) as total_trades,
          COALESCE(s.winning_trades, 0) as winning_trades,
          COALESCE(s.losing_trades, 0) as losing_trades,
          COALESCE(s.win_rate, 0) as win_rate,
          s.daily_pnl,
          s.monthly_pnl,
          s.last_updated
        FROM "MT5Account" a
        LEFT JOIN "AccountSummary" s ON a.id = s.account_id
        WHERE a.user_id = $1
        ORDER BY a.created_at DESC
      `;
      
      const result = await pgPool.query(query, [userId]);
      
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
         ORDER BY time DESC 
         LIMIT $2 OFFSET $3`,
        [accountId, parseInt(limit), parseInt(offset)]
      );
      
      // Get total count
      const countResult = await pgPool.query(
        'SELECT COUNT(*) FROM "Trade" WHERE account_id = $1',
        [accountId]
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
         GROUP BY date
         ORDER BY date ASC`,
        [accountIds, startDate, endDate]
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