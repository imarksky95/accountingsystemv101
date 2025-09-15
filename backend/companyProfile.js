const express = require('express');
const router = express.Router();

const mysql = require('mysql2/promise');
const dbConfig = require('./index').dbConfig || require('./index').default?.dbConfig;

// GET company profile
router.get('/company-profile', async (req, res) => {
  try {
    const connection = await mysql.createConnection(req.app.get('dbConfig'));
    const [rows] = await connection.execute('SELECT * FROM company_profile WHERE id=1');
    await connection.end();
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.json({ logo: '', name: '', address: '', tin: '', type: '' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST/PUT company profile
router.post('/company-profile', async (req, res) => {
  const { logo, name, address, tin, type } = req.body;
  try {
    const connection = await mysql.createConnection(req.app.get('dbConfig'));
    await connection.execute(
      `INSERT INTO company_profile (id, logo, name, address, tin, type)
       VALUES (1, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE logo=VALUES(logo), name=VALUES(name), address=VALUES(address), tin=VALUES(tin), type=VALUES(type)`,
      [logo, name, address, tin, type]
    );
    await connection.end();
    res.json({ message: 'Profile saved', profile: { logo, name, address, tin, type } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
