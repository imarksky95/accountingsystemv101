const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  console.log('Received POST /register', req.method, req.body);
  const { username, password, role_id, full_name, email, mobile } = req.body;
  if (!username || !password || !role_id) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = 'INSERT INTO users (username, password_hash, role_id, full_name, email, mobile) VALUES (?, ?, ?, ?, ?, ?)';
    const dbPool = req.app.get('dbPool');

    const [result] = await dbPool.execute(sql, [username, hashedPassword, role_id, full_name || null, email || null, mobile || null]);
    const insertId = result && result.insertId ? result.insertId : null;
    if (!insertId) return res.status(500).json({ message: 'Failed to create user' });

    // Return created user summary
    const [rows] = await dbPool.execute('SELECT user_id, username, role_id, full_name, email, mobile, created_at FROM users WHERE user_id = ?', [insertId]);
    const user = rows && rows[0] ? rows[0] : null;
    res.status(201).json({ message: 'User registered successfully', user });
  } catch (err) {
    console.error('DB error during registration:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  console.log('Received POST /login', req.method, req.body);
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Missing fields' });

  try {
    const dbPool = req.app.get('dbPool');
    const t0 = Date.now();
    const [rows] = await dbPool.execute('SELECT * FROM users WHERE username = ?', [username]);
    const tDb = Date.now();
    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    const tBcrypt = Date.now();
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { user_id: user.user_id, role_id: user.role_id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    const tJwt = Date.now();
    const timing = { db: tDb - t0, bcrypt: tBcrypt - tDb, jwt: tJwt - tBcrypt, total: tJwt - t0, at: new Date().toISOString() };
    console.log('Login timing (ms):', timing);
    try {
      const fs = require('fs');
      fs.writeFileSync('/tmp/last-login.json', JSON.stringify(timing));
    } catch (e) {
      console.error('Failed to write last-login timing file', e);
    }

    res.json({
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        role_id: user.role_id,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Middleware for protected routes
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const dbPool = req.app.get('dbPool');
    const [rows] = await dbPool.execute(
      'SELECT user_id, username, role_id FROM users WHERE user_id = ?',
      [req.user.user_id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Fetch user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

