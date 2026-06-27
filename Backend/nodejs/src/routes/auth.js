const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res, pgPool) => {
  const { email, password } = req.body;
  
  // Validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pgPool.query(
      'INSERT INTO "User" (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, hashed]
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
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await pgPool.query('SELECT * FROM "User" WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const match = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user.rows[0].id, email: user.rows[0].email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
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