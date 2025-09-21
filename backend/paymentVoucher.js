const express = require('express');
const router = express.Router();

function getDbPool(req) { return req.app.get('dbPool'); }

// Full-featured list SQL: join contacts, users, and COA. Use COALESCE(account_name, name) for schema compatibility.
const PV_LIST_SQL = [
  'SELECT p.*',
  ' , c.contact_id AS payee_id',
  ' , c.display_name AS payee_name',
  ' , COALESCE(c.display_name, p.payee) AS payee',
  ' , u.user_id AS prepared_by_id',
  ' , u.username AS prepared_by_username',
  ' , COALESCE(coa.account_name, coa.name) AS coa_name',
  ' , coa.coa_id AS coa_id',
  ' FROM payment_vouchers p',
  ' LEFT JOIN contacts c ON (p.payee = CAST(c.contact_id AS CHAR) OR p.payee = c.display_name)',
  ' LEFT JOIN users u ON p.prepared_by = u.user_id',
  ' LEFT JOIN chart_of_accounts coa ON p.coa_id = coa.coa_id',
  ' ORDER BY p.payment_voucher_id DESC'
].join(' ');

// GET: list payment vouchers with payment_lines and journal_lines attached per PV
router.get('/', async (req, res) => {
  const db = getDbPool(req);
  try {
    const [rows] = await db.execute(PV_LIST_SQL);
    const out = [];
    for (const pv of rows) {
      try {
        const [payment_lines] = await db.execute('SELECT * FROM payment_voucher_payment_lines WHERE payment_voucher_id=? ORDER BY id', [pv.payment_voucher_id]);
        const [journal_lines] = await db.execute('SELECT * FROM payment_voucher_journal_lines WHERE payment_voucher_id=? ORDER BY id', [pv.payment_voucher_id]);
        out.push(Object.assign({}, pv, { payment_lines, journal_lines }));
      } catch (innerErr) {
        console.error('Error fetching lines for PV', pv.payment_voucher_id, innerErr && innerErr.stack ? innerErr.stack : innerErr);
        out.push(Object.assign({}, pv, { payment_lines: [], journal_lines: [] }));
      }
    }
    res.json(out);
  } catch (err) {
    console.error('GET /api/payment-vouchers failed', err && err.stack ? err.stack : err);
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
});

// Simple fallback: raw rows only
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

// Helper to coerce numeric IDs where useful
function coerceNumberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// Create
router.post('/', async (req, res) => {
  const db = getDbPool(req);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [countRows] = await conn.execute('SELECT COUNT(*) as count FROM payment_vouchers');
    const control = 'PV-' + (countRows[0].count + 1);
    const { status, preparation_date, purpose, paid_through, prepared_by, payee, description, amount_to_pay, coa_id, payment_lines, journal_lines } = req.body;
    const params = [control, status, preparation_date, purpose, paid_through, prepared_by, payee, description, amount_to_pay, coerceNumberOrNull(coa_id)].map(v => v === undefined ? null : v);
    const [r] = await conn.execute('INSERT INTO payment_vouchers (payment_voucher_control, status, preparation_date, purpose, paid_through, prepared_by, payee, description, amount_to_pay, coa_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', params);
    const id = r.insertId;
    if (Array.isArray(payment_lines)) {
      for (const pl of payment_lines) {
        await conn.execute('INSERT INTO payment_voucher_payment_lines (payment_voucher_id, payee_contact_id, payee_display, description, amount) VALUES (?, ?, ?, ?, ?)', [id, coerceNumberOrNull(pl.payee_contact_id), pl.payee_display || null, pl.description || null, pl.amount == null ? 0 : pl.amount]);
      }
    }
    if (Array.isArray(journal_lines)) {
      for (const jl of journal_lines) {
        await conn.execute('INSERT INTO payment_voucher_journal_lines (payment_voucher_id, coa_id, debit, credit, remarks) VALUES (?, ?, ?, ?, ?)', [id, coerceNumberOrNull(jl.coa_id), jl.debit == null ? 0 : jl.debit, jl.credit == null ? 0 : jl.credit, jl.remarks || null]);
      }
    }
    await conn.commit();
    res.status(201).json({ payment_voucher_id: id });
  } catch (err) {
    await conn.rollback();
    console.error('POST /api/payment-vouchers failed', err && err.stack ? err.stack : err);
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  } finally {
    conn.release();
  }
});

// Update
router.put('/:id', async (req, res) => {
  const id = req.params.id;
  const db = getDbPool(req);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { status, preparation_date, purpose, paid_through, prepared_by, payee, description, amount_to_pay, coa_id, payment_lines, journal_lines } = req.body;
    await conn.execute('UPDATE payment_vouchers SET status=?, preparation_date=?, purpose=?, paid_through=?, prepared_by=?, payee=?, description=?, amount_to_pay=?, coa_id=? WHERE payment_voucher_id=?', [status, preparation_date, purpose, paid_through, prepared_by, payee, description, amount_to_pay, coerceNumberOrNull(coa_id), id]);
    await conn.execute('DELETE FROM payment_voucher_payment_lines WHERE payment_voucher_id=?', [id]);
    if (Array.isArray(payment_lines)) {
      for (const pl of payment_lines) {
        await conn.execute('INSERT INTO payment_voucher_payment_lines (payment_voucher_id, payee_contact_id, payee_display, description, amount) VALUES (?, ?, ?, ?, ?)', [id, coerceNumberOrNull(pl.payee_contact_id), pl.payee_display || null, pl.description || null, pl.amount == null ? 0 : pl.amount]);
      }
    }
    await conn.execute('DELETE FROM payment_voucher_journal_lines WHERE payment_voucher_id=?', [id]);
    if (Array.isArray(journal_lines)) {
      for (const jl of journal_lines) {
        await conn.execute('INSERT INTO payment_voucher_journal_lines (payment_voucher_id, coa_id, debit, credit, remarks) VALUES (?, ?, ?, ?, ?)', [id, coerceNumberOrNull(jl.coa_id), jl.debit == null ? 0 : jl.debit, jl.credit == null ? 0 : jl.credit, jl.remarks || null]);
      }
    }
    await conn.commit();
    res.json({ message: 'updated' });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /api/payment-vouchers failed', err && err.stack ? err.stack : err);
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  } finally {
    conn.release();
  }
});

// Delete
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  const db = getDbPool(req);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM payment_voucher_payment_lines WHERE payment_voucher_id=?', [id]);
    await conn.execute('DELETE FROM payment_voucher_journal_lines WHERE payment_voucher_id=?', [id]);
    await conn.execute('DELETE FROM payment_vouchers WHERE payment_voucher_id=?', [id]);
    await conn.commit();
    res.json({ message: 'deleted' });
  } catch (err) {
    await conn.rollback();
    console.error('DELETE /api/payment-vouchers failed', err && err.stack ? err.stack : err);
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  } finally {
    conn.release();
  }
});

module.exports = router;
