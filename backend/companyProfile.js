const express = require('express');
const router = express.Router();

const mysql = require('mysql2/promise');

// Cache for resolved column names to support migrations/compatibility
let _cachedProfileCols = null;

async function resolveProfileCols(dbPool) {
  if (_cachedProfileCols) return _cachedProfileCols;
  try {
    const dbName = process.env.DB_NAME;
    const [rows] = await dbPool.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'company_profile' AND COLUMN_NAME IN ('company_name','NAME','company_type','TYPE')`,
      [dbName]
    );
    const colNames = rows.map(r => (r.COLUMN_NAME || r.column_name || '').toString());
    const nameCol = colNames.includes('company_name') ? 'company_name' : (colNames.includes('NAME') ? 'NAME' : 'NAME');
    const typeCol = colNames.includes('company_type') ? 'company_type' : (colNames.includes('TYPE') ? 'TYPE' : 'TYPE');
    _cachedProfileCols = { nameCol, typeCol };
    return _cachedProfileCols;
  } catch (err) {
    console.error('resolveProfileCols detection error:', err && err.stack ? err.stack : err);
    // As a safer fallback, prefer the modern column names but accept legacy ones.
    // Try to probe the table quickly to see which column set works.
    try {
      // First try modern names
      const [r1] = await dbPool.execute("SELECT company_name, company_type FROM company_profile LIMIT 1");
      if (Array.isArray(r1)) {
        _cachedProfileCols = { nameCol: 'company_name', typeCol: 'company_type' };
        return _cachedProfileCols;
      }
    } catch (e1) {
      // ignore and try legacy
    }
    try {
      const [r2] = await dbPool.execute("SELECT NAME, TYPE FROM company_profile LIMIT 1");
      if (Array.isArray(r2)) {
        _cachedProfileCols = { nameCol: 'NAME', typeCol: 'TYPE' };
        return _cachedProfileCols;
      }
    } catch (e2) {
      // final fallback
    }
    // Final fallback: prefer modern names but accept that queries may fail later
    _cachedProfileCols = { nameCol: 'company_name', typeCol: 'company_type' };
    return _cachedProfileCols;
  }
}

// GET company profile
router.get('/company-profile', async (req, res) => {
  try {
    const dbPool = req.app.get('dbPool');
    const cols = await resolveProfileCols(dbPool);
    let selectSql = `SELECT id, logo, ${cols.nameCol} as db_name, address, tin, ${cols.typeCol} as db_type, logo_mime, logo_size_bytes FROM company_profile WHERE id=1`;
    let rows;
    try {
      const result = await dbPool.execute(selectSql);
      rows = result[0];
    } catch (qerr) {
      console.warn('company-profile initial select failed, trying alternate columns', qerr && qerr.message ? qerr.message : qerr);
      // try the alternate set
      const altCols = (cols.nameCol === 'company_name') ? { nameCol: 'NAME', typeCol: 'TYPE' } : { nameCol: 'company_name', typeCol: 'company_type' };
      selectSql = `SELECT id, logo, ${altCols.nameCol} as db_name, address, tin, ${altCols.typeCol} as db_type, logo_mime, logo_size_bytes FROM company_profile WHERE id=1`;
      const result2 = await dbPool.execute(selectSql);
      rows = result2[0];
      // update cache so future calls use working names
      _cachedProfileCols = { nameCol: altCols.nameCol, typeCol: altCols.typeCol };
    }
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
        company_name: row.db_name || '',
        address: row.address || '',
        tin: row.tin || '',
        company_type: row.db_type || '',
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
  const cols = await resolveProfileCols(dbPool);
  const nameCol = cols.nameCol;
  const typeCol = cols.typeCol;
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
    const runInsert = async (useCols) => {
      const nCol = useCols.nameCol;
      const tCol = useCols.typeCol;
      if (logoParam !== null) {
        const sql = `INSERT INTO company_profile (id, logo, logo_mime, logo_size_bytes, ${nCol}, address, tin, ${tCol})\n           VALUES (1, ?, ?, ?, ?, ?, ?, ?)\n           ON DUPLICATE KEY UPDATE logo=VALUES(logo), logo_mime=VALUES(logo_mime), logo_size_bytes=VALUES(logo_size_bytes), ${nCol}=VALUES(${nCol}), address=VALUES(address), tin=VALUES(tin), ${tCol}=VALUES(${tCol})`;
        await dbPool.execute(sql, [logoParam, logoMime, logoSize, company_name || null, address || null, tin || null, company_type || null]);
      } else {
        const sql = `INSERT INTO company_profile (id, ${nCol}, address, tin, ${tCol})\n           VALUES (1, ?, ?, ?, ?)\n           ON DUPLICATE KEY UPDATE ${nCol}=VALUES(${nCol}), address=VALUES(address), tin=VALUES(tin), ${tCol}=VALUES(${tCol})`;
        await dbPool.execute(sql, [company_name || null, address || null, tin || null, company_type || null]);
      }
    };

    try {
      await runInsert({ nameCol, typeCol });
    } catch (insErr) {
      console.warn('company-profile insert with resolved cols failed, retrying with alternate cols', insErr && insErr.message ? insErr.message : insErr);
      const alt = (nameCol === 'company_name') ? { nameCol: 'NAME', typeCol: 'TYPE' } : { nameCol: 'company_name', typeCol: 'company_type' };
      await runInsert(alt);
      _cachedProfileCols = { nameCol: alt.nameCol, typeCol: alt.typeCol };
    }
    res.json({ message: 'Profile saved', profile: { logo, logo_mime: logoMime, logo_size_bytes: logoSize, company_name, address, tin, company_type } });
  } catch (err) {
    console.error('company-profile save error:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

module.exports = router;
