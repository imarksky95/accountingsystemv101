const express = require('express');
const router = express.Router();

function getDbPool(req) { return req.app.get('dbPool'); }

// Minimal, clean Payment Vouchers router
router.get('/', async (req, res) => {
  try {
    const db = getDbPool(req);
    const [rows] = await db.execute('SELECT * FROM payment_vouchers ORDER BY payment_voucher_id DESC');
    res.json(rows);
  } catch (err) {
    console.error('GET /api/payment-vouchers failed', err && err.stack ? err.stack : err);
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
});

router.get('/simple', async (req, res) => {
  try {
    const db = getDbPool(req);
    const [rows] = await db.execute('SELECT * FROM payment_vouchers ORDER BY payment_voucher_id DESC');
    res.json(rows);
  } catch (err) {
    console.error('GET /api/payment-vouchers/simple failed', err && err.stack ? err.stack : err);
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
});

module.exports = router;
