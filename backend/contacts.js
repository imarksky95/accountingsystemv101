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
    // If client provided a contact_control, honor it; otherwise insert and auto-generate control after insert
    let insertId;
    if (contact_control) {
      const [result] = await dbPool.execute(
        `INSERT INTO contacts (contact_control, display_name, contact_type, contact_info)
         VALUES (?, ?, ?, ?)`,
        [contact_control, display_name || null, contact_type || null, contact_info || null]
      );
      insertId = result.insertId;
    } else {
      const [result] = await dbPool.execute(
        `INSERT INTO contacts (contact_control, display_name, contact_type, contact_info)
         VALUES (NULL, ?, ?, ?)`,
        [display_name || null, contact_type || null, contact_info || null]
      );
      insertId = result.insertId;
      const generated = 'CT-' + String(insertId).padStart(4, '0');
      await dbPool.execute('UPDATE contacts SET contact_control = ? WHERE contact_id = ?', [generated, insertId]);
    }
    const [rows] = await dbPool.execute('SELECT * FROM contacts WHERE contact_id = ?', [insertId]);
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
    // Do not allow updating contact_control here (control number is system-generated and read-only)
    const { display_name, contact_type, contact_info } = req.body;
    await dbPool.execute(
      `UPDATE contacts SET display_name = ?, contact_type = ?, contact_info = ? WHERE contact_id = ?`,
      [display_name || null, contact_type || null, contact_info || null, id]
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
