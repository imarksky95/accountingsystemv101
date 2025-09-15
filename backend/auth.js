const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const router = express.Router();

// Get db config from app
function getDbConfig(req) {
  return req.app.get('dbConfig');
}

// Register
router.post('/register', async (req, res) => {
  const { username, password, role_id } = req.body;
  try {
    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = 'INSERT INTO users (username, password, role_id) VALUES (?, ?, ?)';
    const connection = await mysql.createConnection(getDbConfig(req));
    await connection.execute(sql, [username, hashedPassword, role_id]);
    await connection.end();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Missing fields' });
  try {
    const connection = await mysql.createConnection(getDbConfig(req));
    const [rows] = await connection.execute('SELECT * FROM users WHERE username = ?', [username]);
    await connection.end();
    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ user_id: user.user_id, role_id: user.role_id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    // Return both token and user info (excluding password)
    res.json({
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        role_id: user.role_id
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
    const connection = await mysql.createConnection(getDbConfig(req));
    const [rows] = await connection.execute('SELECT user_id, username, role_id FROM users WHERE user_id = ?', [req.user.user_id]);
    await connection.end();
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
