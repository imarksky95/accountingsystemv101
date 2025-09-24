const express = require('express');
const router = express.Router();

function getDbPool(req) {
  return req.app.get('dbPool');
}

// Simple health and DB check for payment vouchers
router.get('/pv-status', async (req, res) => {
  try {
    const dbPool = getDbPool(req);
    // basic connectivity test
    const [[one]] = await dbPool.execute('SELECT 1 AS ok');
    const [countRows] = await dbPool.execute('SELECT COUNT(*) AS cnt FROM payment_vouchers');
    const cnt = countRows && countRows[0] ? countRows[0].cnt : 0;
    const [sampleRows] = await dbPool.execute('SELECT payment_voucher_id, payment_voucher_control, payee, amount_to_pay, coa_id, created_at FROM payment_vouchers ORDER BY payment_voucher_id DESC LIMIT 5');
    res.json({ ok: !!one, count: cnt, sample: sampleRows });
  } catch (err) {
    console.error('Debug PV status error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// debug routes removed

// Expose last login timing info (in-memory)
let lastLoginTiming = null;
router.get('/last-login', (req, res) => {
  res.json({ lastLoginTiming });
});

module.exports = router;


module.exports = router;
