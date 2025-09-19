const express = require('express');
const router = express.Router();

function getDbPool(req) {
  return req.app.get('dbPool');
}

// Get all check vouchers
router.get('/', async (req, res) => {
  try {
    const dbPool = getDbPool(req);
    const [rows] = await dbPool.execute('SELECT * FROM check_vouchers');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a check voucher
router.post('/', async (req, res) => {
  const {
    cvoucher_date,
    purpose,
    check_payee,
    check_no,
    check_amount,
    cvoucher_status,
    multiple_checks,
    check_fr,
    check_to,
    coa_id
  } = req.body;
  try {
    const dbPool = getDbPool(req);
    // Auto-generate control number
    const [result] = await dbPool.execute('SELECT COUNT(*) as count FROM check_vouchers');
    const check_voucher_control = `CV-${result[0].count + 1}`;
    const params = [check_voucher_control, cvoucher_date, purpose, check_payee, check_no, check_amount, cvoucher_status, multiple_checks, check_fr, check_to, coa_id].map(v => v === undefined ? null : v);
    await dbPool.execute(
      'INSERT INTO check_vouchers (check_voucher_control, cvoucher_date, purpose, check_payee, check_no, check_amount, cvoucher_status, multiple_checks, check_fr, check_to, coa_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      params
    );
    res.status(201).json({ message: 'Check voucher created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a check voucher
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    cvoucher_date,
    purpose,
    check_payee,
    check_no,
    check_amount,
    cvoucher_status,
    multiple_checks,
    check_fr,
    check_to,
    coa_id
  } = req.body;
  try {
    const dbPool = getDbPool(req);
    await dbPool.execute(
      'UPDATE check_vouchers SET cvoucher_date=?, purpose=?, check_payee=?, check_no=?, check_amount=?, cvoucher_status=?, multiple_checks=?, check_fr=?, check_to=?, coa_id=? WHERE check_voucher_id=?',
      [cvoucher_date, purpose, check_payee, check_no, check_amount, cvoucher_status, multiple_checks, check_fr, check_to, coa_id, id]
    );
    res.json({ message: 'Check voucher updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a check voucher
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const dbPool = getDbPool(req);
    await dbPool.execute('DELETE FROM check_vouchers WHERE check_voucher_id=?', [id]);
    res.json({ message: 'Check voucher deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
