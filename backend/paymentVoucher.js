const express = require('express');
const router = express.Router();

function getDbPool(req) {
  return req.app.get('dbPool');
}

// Get all payment vouchers
router.get('/', async (req, res) => {
  try {
    const dbPool = getDbPool(req);
    // Join contacts, users and COA to return friendly display fields
    const [rows] = await dbPool.execute(`
      SELECT p.*,
        c.contact_id AS payee_id,
        c.display_name AS payee_name,
        COALESCE(c.display_name, p.payee) AS payee,
        u.user_id AS prepared_by_id,
        u.username AS prepared_by_username,
        coa.coa_id AS coa_id,
        coa.account_name AS coa_name
      FROM payment_vouchers p
      LEFT JOIN contacts c ON (p.payee = CAST(c.contact_id AS CHAR) OR p.payee = c.display_name)
      LEFT JOIN users u ON p.prepared_by = u.user_id
      LEFT JOIN chart_of_accounts coa ON p.coa_id = coa.coa_id
      ORDER BY p.payment_voucher_id DESC
    `);
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
        // store payee as string; when frontend sends contact_id we stringify it so existing schema is compatible
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
      // store payee as string (contact id as string) for backwards compatibility
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
