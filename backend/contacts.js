const express = require('express');
const router = express.Router();

// GET /api/contacts
router.get('/', async (req, res, next) => {
  try {
    const dbPool = req.app.get('dbPool');
    const [rows] = await dbPool.execute('SELECT * FROM contacts ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/contacts
router.post('/', async (req, res, next) => {
  try {
    const dbPool = req.app.get('dbPool');
    const { contact_control, display_name, contact_type, contact_info } = req.body;
    const [result] = await dbPool.execute(
      `INSERT INTO contacts (contact_control, display_name, contact_type, contact_info)
       VALUES (?, ?, ?, ?)`,
      [contact_control || null, display_name || null, contact_type || null, contact_info || null]
    );
    const [rows] = await dbPool.execute('SELECT * FROM contacts WHERE contact_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/contacts/:id
router.put('/:id', async (req, res, next) => {
  try {
    const dbPool = req.app.get('dbPool');
    const id = req.params.id;
    const { contact_control, display_name, contact_type, contact_info } = req.body;
    await dbPool.execute(
      `UPDATE contacts SET contact_control = ?, display_name = ?, contact_type = ?, contact_info = ? WHERE contact_id = ?`,
      [contact_control || null, display_name || null, contact_type || null, contact_info || null, id]
    );
    const [rows] = await dbPool.execute('SELECT * FROM contacts WHERE contact_id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const dbPool = req.app.get('dbPool');
    const id = req.params.id;
    await dbPool.execute('DELETE FROM contacts WHERE contact_id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
