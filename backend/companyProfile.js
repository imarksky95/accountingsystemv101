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
          const mime = row.logo_mime || 'image/png';
          row.logo = `data:${mime};base64,${row.logo.toString('base64')}`;
          row.logo_size_bytes = row.logo_size_bytes || (row.logo ? Buffer.from(row.logo.split(',')[1] || '', 'base64').length : null);
        }
      } catch (e) {
        // ignore conversion errors and return raw value
      }
      // Map DB column names to friendly JSON keys
      const out = {
        id: row.id,
        logo: row.logo || '',
        company_name: row.company_name || '',
        address: row.address || '',
        tin: row.tin || '',
        company_type: row.company_type || '',
        logo_mime: row.logo_mime || null,
        logo_size_bytes: row.logo_size_bytes || null,
      };
      res.json(out);
    } else {
      res.json({ logo: '', company_name: '', address: '', tin: '', company_type: '' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Binary logo endpoint: returns raw image bytes with correct Content-Type for caching
router.get('/company-profile/logo', async (req, res) => {
  try {
    const dbPool = req.app.get('dbPool');
    const [rows] = await dbPool.execute('SELECT logo, logo_mime, logo_size_bytes FROM company_profile WHERE id=1');
    if (!rows || rows.length === 0) return res.status(404).send('No company profile');
    const row = rows[0];
    if (!row.logo) return res.status(404).send('No logo available');
    const buffer = Buffer.isBuffer(row.logo) ? row.logo : Buffer.from(row.logo);
    const mime = row.logo_mime || 'application/octet-stream';
    // Set caching headers (client can cache for an hour)
    res.setHeader('Content-Type', mime);
    if (row.logo_size_bytes) res.setHeader('Content-Length', row.logo_size_bytes);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(buffer);
  } catch (err) {
    console.error('company-profile logo error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// POST/PUT company profile
router.post('/company-profile', async (req, res) => {
  const { logo, company_name, address, tin, company_type } = req.body;
  console.log('POST /api/company-profile received:', { company_name, address, tin, company_type, logoPresent: !!logo, logoType: typeof logo, logoLen: typeof logo === 'string' ? logo.length : (Buffer.isBuffer(logo) ? logo.length : null) });
  try {
    const dbPool = req.app.get('dbPool');
  // Prepare logo parameter: if incoming value is a data URL, strip the prefix and convert to Buffer
  let logoParam = null;
  let logoMime = null;
  let logoSize = null;
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
          logoMime = mime;
          logoSize = buffer.length;
        } else if (typeof logo === 'string') {
          // if plain base64 without prefix
          const buffer = Buffer.from(logo, 'base64');
          const maxBytes = Number(process.env.COMPANY_LOGO_MAX_BYTES || 1048576);
          if (buffer.length > maxBytes) return res.status(400).json({ error: `Logo exceeds maximum allowed size of ${maxBytes} bytes` });
          logoParam = buffer;
          logoMime = null;
          logoSize = buffer.length;
        } else if (Buffer.isBuffer(logo)) {
          const maxBytes = Number(process.env.COMPANY_LOGO_MAX_BYTES || 1048576);
          if (logo.length > maxBytes) return res.status(400).json({ error: `Logo exceeds maximum allowed size of ${maxBytes} bytes` });
          logoParam = logo;
          logoMime = null;
          logoSize = logo.length;
        }
      } catch (e) {
        // fallback to storing raw value
        logoParam = logo;
      }
    }

    // Build SQL and params depending on whether we have logo/mime/size
      if (logoParam !== null) {
      await dbPool.execute(
        `INSERT INTO company_profile (id, logo, logo_mime, logo_size_bytes, company_name, address, tin, company_type)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE logo=VALUES(logo), logo_mime=VALUES(logo_mime), logo_size_bytes=VALUES(logo_size_bytes), company_name=VALUES(company_name), address=VALUES(address), tin=VALUES(tin), company_type=VALUES(company_type)`,
        [logoParam, logoMime, logoSize, company_name || null, address || null, tin || null, company_type || null]
      );
    } else {
      await dbPool.execute(
        `INSERT INTO company_profile (id, company_name, address, tin, company_type)
         VALUES (1, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE company_name=VALUES(company_name), address=VALUES(address), tin=VALUES(tin), company_type=VALUES(company_type)`,
        [company_name || null, address || null, tin || null, company_type || null]
      );
    }
    res.json({ message: 'Profile saved', profile: { logo, logo_mime: logoMime, logo_size_bytes: logoSize, company_name, address, tin, company_type } });
  } catch (err) {
    console.error('company-profile save error:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

module.exports = router;
