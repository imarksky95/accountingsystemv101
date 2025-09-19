const express = require('express');
const router = express.Router();

// expects app.set('dbPool', pool) in index.js
function mapUndefinedToNull(obj) {
  const out = {};
  for (const k in obj) out[k] = obj[k] === undefined ? null : obj[k];
  return out;
}

router.get('/', async (req, res) => {
  const pool = req.app.get('dbPool');
  try {
    const [rows] = await pool.query('SELECT vendor_id, name, contact_info, created_at, updated_at FROM vendors ORDER BY vendor_id DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

router.post('/', async (req, res) => {
  const pool = req.app.get('dbPool');
  const { name, contact_info } = mapUndefinedToNull(req.body || {});
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const [result] = await pool.execute('INSERT INTO vendors (name, contact_info) VALUES (?, ?)', [name, contact_info]);
    const [rows] = await pool.execute('SELECT vendor_id, name, contact_info, created_at, updated_at FROM vendors WHERE vendor_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

router.put('/:id', async (req, res) => {
  const pool = req.app.get('dbPool');
  const id = req.params.id;
  const { name, contact_info } = mapUndefinedToNull(req.body || {});
  try {
    await pool.execute('UPDATE vendors SET name = ?, contact_info = ?, updated_at = CURRENT_TIMESTAMP WHERE vendor_id = ?', [name, contact_info, id]);
    const [rows] = await pool.execute('SELECT vendor_id, name, contact_info, created_at, updated_at FROM vendors WHERE vendor_id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

router.delete('/:id', async (req, res) => {
  const pool = req.app.get('dbPool');
  const id = req.params.id;
  try {
    await pool.execute('DELETE FROM vendors WHERE vendor_id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
});

module.exports = router;
