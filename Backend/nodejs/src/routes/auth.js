const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validateEmail, validatePassword } = require('../middleware/validation');

exports.register = async (req, res, pgPool) => {
  const { email, password } = req.body;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  
  // Validation
  if (!normalizedEmail || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!validateEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  if (!validatePassword(password, 8)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pgPool.query(
      'INSERT INTO "User" (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [normalizedEmail, hashed]
    );
    res.status(201).json({ 
      success: true,
      user: result.rows[0] 
    });
  } catch (e) {
    if (e.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Registration error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.login = async (req, res, pgPool) => {
  const { email, password } = req.body;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  
  if (!normalizedEmail || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!validateEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    console.error('JWT_SECRET is missing or weak');
    return res.status(500).json({ error: 'Server authentication is not configured properly' });
  }

  try {
    const user = await pgPool.query('SELECT * FROM "User" WHERE email = $1', [normalizedEmail]);
    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const match = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user.rows[0].id, email: user.rows[0].email },
      jwtSecret,
      {
        expiresIn: '7d',
        algorithm: 'HS256',
        issuer: 'trading-dashboard',
        audience: 'trading-dashboard-client',
      }
    );
    
    res.json({ 
      success: true,
      token, 
      userId: user.rows[0].id,
      email: user.rows[0].email
    });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};