const express = require('express');
const router = express.Router();

function getDbPool(req) {
  return req.app.get('dbPool');
}

// Get all scheduled payments
router.get('/', async (req, res) => {
  try {
    const dbPool = getDbPool(req);
    const [rows] = await dbPool.execute('SELECT * FROM scheduled_payments');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a scheduled payment
router.post('/', async (req, res) => {
  const {
    status,
    due_date,
    document_ctrl_number,
    purpose,
    payee_client,
    description,
    ub_approval_code,
    amount_to_pay,
    paid_through,
    mop
  } = req.body;
  try {
    const dbPool = getDbPool(req);
    // Auto-generate control number and let AUTO_INCREMENT handle ID
    const [result] = await dbPool.execute('SELECT COUNT(*) as count FROM scheduled_payments');
    const scheduled_payment_ctrl = `SP-${result[0].count + 1}`;
    const params = [scheduled_payment_ctrl, status, due_date, document_ctrl_number, purpose, payee_client, description, ub_approval_code, amount_to_pay, paid_through, mop].map(v => v === undefined ? null : v);
    await dbPool.execute(
      'INSERT INTO scheduled_payments (scheduled_payment_ctrl, status, due_date, document_ctrl_number, purpose, payee_client, description, ub_approval_code, amount_to_pay, paid_through, mop) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      params
    );
    res.status(201).json({ message: 'Scheduled payment created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a scheduled payment
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    status,
    due_date,
    document_ctrl_number,
    purpose,
    payee_client,
    description,
    ub_approval_code,
    amount_to_pay,
    paid_through,
    mop
  } = req.body;
  try {
    const dbPool = getDbPool(req);
    await dbPool.execute(
      'UPDATE scheduled_payments SET status=?, due_date=?, document_ctrl_number=?, purpose=?, payee_client=?, description=?, ub_approval_code=?, amount_to_pay=?, paid_through=?, mop=? WHERE scheduled_payment_id=?',
      [status, due_date, document_ctrl_number, purpose, payee_client, description, ub_approval_code, amount_to_pay, paid_through, mop, id]
    );
    res.json({ message: 'Scheduled payment updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a scheduled payment
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const dbPool = getDbPool(req);
    await dbPool.execute('DELETE FROM scheduled_payments WHERE scheduled_payment_id=?', [id]);
    res.json({ message: 'Scheduled payment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
