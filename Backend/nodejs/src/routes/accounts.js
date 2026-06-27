const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/encryption');

module.exports = (pgPool) => {
  // Get all accounts for a user
  router.get('/', authenticate, async (req, res) => {
    try {
      const result = await pgPool.query(
        `SELECT id, login, server, broker_name, investor_mode, last_sync_at, created_at 
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
    const { login, password, server, broker_name, investor_mode } = req.body;
    
    if (!login || !password || !server) {
      return res.status(400).json({ error: 'Login, password, and server are required' });
    }

    try {
      const encryptedPassword = encrypt(password);
      
      const result = await pgPool.query(
        `INSERT INTO "MT5Account" 
         (user_id, login, password, server, broker_name, investor_mode) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING id, login, server, broker_name, investor_mode, created_at`,
        [req.userId, login, encryptedPassword, server, broker_name || null, investor_mode !== false]
      );
      
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
    const { id } = req.params;
    
    try {
      // Verify ownership
      const check = await pgPool.query(
        'SELECT id FROM "MT5Account" WHERE id = $1 AND user_id = $2',
        [id, req.userId]
      );
      
      if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }
      
      await pgPool.query('DELETE FROM "MT5Account" WHERE id = $1', [id]);
      res.json({ success: true, message: 'Account deleted' });
    } catch (e) {
      console.error('Error deleting account:', e);
      res.status(500).json({ error: 'Failed to delete account' });
    }
  });

  return router;
};