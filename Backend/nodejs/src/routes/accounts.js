const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { encrypt } = require('../utils/encryption');
const {
  validatePositiveInt,
  validateUuid,
  sanitizeAccountPayload,
} = require('../middleware/validation');

module.exports = (pgPool, redis) => {
  let hasCurrentBalanceColumnPromise;
  let hasNicknameColumnPromise;

  const invalidateDashboardCache = async (userId) => {
    if (!redis || !userId) {
      return;
    }

    try {
      await redis.del(`dashboard:${userId}`);
    } catch (error) {
      console.warn('Failed to invalidate dashboard cache:', error.message);
    }
  };

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

  // Get all accounts for a user
  router.get('/', authenticate, async (req, res) => {
    try {
      const includeCurrentBalance = await hasCurrentBalanceColumn();
      const includeNickname = await hasNicknameColumn();
      const currentBalanceSelect = includeCurrentBalance
        ? 'current_balance,'
        : '0::float as current_balance,';
      const nicknameSelect = includeNickname
        ? 'nickname,'
        : 'NULL::text as nickname,';

      const result = await pgPool.query(
        `SELECT id, login, ${nicknameSelect} server, broker_name, investor_mode, ${currentBalanceSelect} last_sync_at, created_at 
         FROM "MT5Account" 
         WHERE user_id = $1 
         ORDER BY created_at DESC`,
        [req.userId]
      );
      res.json(result.rows);
    } catch (e) {
      console.error('Error fetching accounts:', e);
      res.status(500).json({ error: 'Failed to fetch accounts' });
    }
  });

  // Add new MT5 account
  router.post('/', authenticate, async (req, res) => {
    const payload = sanitizeAccountPayload(req.body);
    const { login, password, server, broker_name, investor_mode, nickname } = payload;
    
    if (!validatePositiveInt(login) || !password || !server) {
      return res.status(400).json({ error: 'Login, password, and server are required' });
    }

    try {
      const encryptedPassword = encrypt(password);
      const includeNickname = await hasNicknameColumn();

      const insertQuery = includeNickname
        ? `INSERT INTO "MT5Account" 
           (user_id, login, password, server, broker_name, investor_mode, nickname) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           RETURNING id, login, nickname, server, broker_name, investor_mode, created_at`
        : `INSERT INTO "MT5Account" 
           (user_id, login, password, server, broker_name, investor_mode) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           RETURNING id, login, NULL::text as nickname, server, broker_name, investor_mode, created_at`;
      const insertParams = includeNickname
        ? [req.userId, login, encryptedPassword, server, broker_name || null, investor_mode !== false, nickname || null]
        : [req.userId, login, encryptedPassword, server, broker_name || null, investor_mode !== false];
      
      const result = await pgPool.query(
        insertQuery,
        insertParams
      );

      await invalidateDashboardCache(req.userId);
      
      res.status(201).json(result.rows[0]);
    } catch (e) {
      if (e.code === '23505') {
        return res.status(400).json({ error: 'Account with this login and server already exists' });
      }
      console.error('Error adding account:', e);
      res.status(500).json({ error: 'Failed to add account' });
    }
  });

  // Delete an account
  router.delete('/:id', authenticate, async (req, res) => {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';

    if (!validateUuid(id)) {
      return res.status(400).json({ error: 'Invalid account id format' });
    }
    
    try {
      const deleteResult = await pgPool.query(
        'DELETE FROM "MT5Account" WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, req.userId]
      );

      if (deleteResult.rowCount === 0) {
        await invalidateDashboardCache(req.userId);
        return res.json({ success: true, message: 'Account already removed' });
      }

      await invalidateDashboardCache(req.userId);
      res.json({ success: true, message: 'Account deleted' });
    } catch (e) {
      console.error('Error deleting account:', e);
      res.status(500).json({ error: 'Failed to delete account' });
    }
  });

  return router;
};