const express = require('express');
const router = express.Router();

function getDbPool(req) {
  return req.app.get('dbPool');
}

// Get all payment vouchers
router.get('/', async (req, res) => {
  try {
    const dbPool = getDbPool(req);
    const [rows] = await dbPool.execute('SELECT * FROM payment_vouchers');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a payment voucher
router.post('/', async (req, res) => {
  const {
    status,
    preparation_date,
    purpose,
    paid_through,
    prepared_by,
    payee,
    description,
    amount_to_pay,
    coa_id
  } = req.body;
  try {
    const dbPool = getDbPool(req);
    // Auto-generate control number (simple example)
    const [result] = await dbPool.execute('SELECT COUNT(*) as count FROM payment_vouchers');
    const payment_voucher_control = `PV-${result[0].count + 1}`;
    const params = [payment_voucher_control, status, preparation_date, purpose, paid_through, prepared_by, payee, description, amount_to_pay, coa_id].map(v => v === undefined ? null : v);
    await dbPool.execute(
      'INSERT INTO payment_vouchers (payment_voucher_control, status, preparation_date, purpose, paid_through, prepared_by, payee, description, amount_to_pay, coa_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      params
    );
    res.status(201).json({ message: 'Payment voucher created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a payment voucher
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    status,
    preparation_date,
    purpose,
    paid_through,
    prepared_by,
    payee,
    description,
    amount_to_pay,
    coa_id
  } = req.body;
  try {
    const dbPool = getDbPool(req);
    await dbPool.execute(
      'UPDATE payment_vouchers SET status=?, preparation_date=?, purpose=?, paid_through=?, prepared_by=?, payee=?, description=?, amount_to_pay=?, coa_id=? WHERE payment_voucher_id=?',
      [status, preparation_date, purpose, paid_through, prepared_by, payee, description, amount_to_pay, coa_id, id]
    );
    res.json({ message: 'Payment voucher updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a payment voucher
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const dbPool = getDbPool(req);
    await dbPool.execute('DELETE FROM payment_vouchers WHERE payment_voucher_id=?', [id]);
    res.json({ message: 'Payment voucher deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
