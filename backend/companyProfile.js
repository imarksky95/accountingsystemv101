const express = require('express');
const router = express.Router();

const mysql = require('mysql2/promise');

// GET company profile
router.get('/company-profile', async (req, res) => {
  try {
    const dbPool = req.app.get('dbPool');
    const [rows] = await dbPool.execute('SELECT * FROM company_profile WHERE id=1');
    if (rows.length > 0) {
      const row = rows[0];
      // If logo is stored as binary, convert to data URL for frontend consumption
      try {
        if (row.logo && Buffer.isBuffer(row.logo)) {
          // default to png if mime unknown
          row.logo = `data:image/png;base64,${row.logo.toString('base64')}`;
        }
      } catch (e) {
        // ignore conversion errors and return raw value
      }
      res.json(row);
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
    const dbPool = req.app.get('dbPool');
    // Prepare logo parameter: if incoming value is a data URL, strip the prefix and convert to Buffer
    let logoParam = null;
    if (logo) {
      try {
        if (typeof logo === 'string' && logo.indexOf('base64,') !== -1) {
          const parts = logo.split('base64,');
          const b64 = parts[1];
          logoParam = Buffer.from(b64, 'base64');
        } else if (typeof logo === 'string') {
          // if plain base64 without prefix
          try { logoParam = Buffer.from(logo, 'base64'); } catch (e) { logoParam = Buffer.from(logo); }
        } else if (Buffer.isBuffer(logo)) {
          logoParam = logo;
        }
      } catch (e) {
        // fallback to storing raw value
        logoParam = logo;
      }
    }

    await dbPool.execute(
      `INSERT INTO company_profile (id, logo, name, address, tin, type)
       VALUES (1, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE logo=VALUES(logo), name=VALUES(name), address=VALUES(address), tin=VALUES(tin), type=VALUES(type)`,
      [logoParam, name, address, tin, type]
    );
    res.json({ message: 'Profile saved', profile: { logo, name, address, tin, type } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
