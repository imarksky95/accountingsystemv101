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
  console.log('POST /api/company-profile received:', { name, address, tin, type, logoPresent: !!logo, logoType: typeof logo, logoLen: typeof logo === 'string' ? logo.length : (Buffer.isBuffer(logo) ? logo.length : null) });
  try {
    const dbPool = req.app.get('dbPool');
    // Prepare logo parameter: if incoming value is a data URL, strip the prefix and convert to Buffer
    let logoParam = null;
    if (logo) {
      try {
        if (typeof logo === 'string' && logo.indexOf('base64,') !== -1) {
          const header = logo.slice(0, logo.indexOf('base64,'));
          const parts = logo.split('base64,');
          const b64 = parts[1];
          // Validate mime type in data URL header
          const mimeMatch = header.match(/data:([^;]+);/);
          const mime = mimeMatch ? mimeMatch[1].toLowerCase() : '';
          const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
          if (!allowed.includes(mime)) {
            return res.status(400).json({ error: 'Unsupported logo mime type. Allowed: png, jpeg, webp' });
          }
          // Validate size: read as base64 and check byte length
          const buffer = Buffer.from(b64, 'base64');
          const maxBytes = Number(process.env.COMPANY_LOGO_MAX_BYTES || 1048576); // default 1MB
          if (buffer.length > maxBytes) {
            return res.status(400).json({ error: `Logo exceeds maximum allowed size of ${maxBytes} bytes` });
          }
          logoParam = buffer;
        } else if (typeof logo === 'string') {
          // if plain base64 without prefix
          const buffer = Buffer.from(logo, 'base64');
          const maxBytes = Number(process.env.COMPANY_LOGO_MAX_BYTES || 1048576);
          if (buffer.length > maxBytes) return res.status(400).json({ error: `Logo exceeds maximum allowed size of ${maxBytes} bytes` });
          logoParam = buffer;
        } else if (Buffer.isBuffer(logo)) {
          const maxBytes = Number(process.env.COMPANY_LOGO_MAX_BYTES || 1048576);
          if (logo.length > maxBytes) return res.status(400).json({ error: `Logo exceeds maximum allowed size of ${maxBytes} bytes` });
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
    console.error('company-profile save error:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

module.exports = router;
