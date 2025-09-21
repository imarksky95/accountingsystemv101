const express = require('express');
const router = express.Router();

function getDbPool(req) { return req.app.get('dbPool'); }

// Use a defensive list: fetch raw payment_vouchers then attach related display names
// separately. This avoids runtime SQL errors on deployments with differing schemas.

// GET: list payment vouchers with payment_lines and journal_lines attached per PV
router.get('/', async (req, res) => {
  const db = getDbPool(req);
  try {
    const [rows] = await db.execute('SELECT * FROM payment_vouchers ORDER BY payment_voucher_id DESC');
    const out = [];
    for (const pv of rows) {
      // Attach payment and journal lines (best-effort)
      let payment_lines = [];
      let journal_lines = [];
      try {
        const [pls] = await db.execute('SELECT * FROM payment_voucher_payment_lines WHERE payment_voucher_id=? ORDER BY id', [pv.payment_voucher_id]);
        payment_lines = pls;
      } catch (e) {
        console.warn('Failed to load payment_lines for PV', pv.payment_voucher_id, e && e.message ? e.message : e);
      }
      try {
        const [jls] = await db.execute('SELECT * FROM payment_voucher_journal_lines WHERE payment_voucher_id=? ORDER BY id', [pv.payment_voucher_id]);
        journal_lines = jls;
      } catch (e) {
        console.warn('Failed to load journal_lines for PV', pv.payment_voucher_id, e && e.message ? e.message : e);
      }

      // Best-effort fetch of related display names (contact and COA)
      let payee_name = pv.payee;
      try {
        // If payee looks like a numeric id, attempt to find contact
        const maybeId = Number(pv.payee);
        if (!Number.isNaN(maybeId)) {
          const [crows] = await db.execute('SELECT display_name FROM contacts WHERE contact_id = ? LIMIT 1', [maybeId]);
          if (Array.isArray(crows) && crows.length > 0) payee_name = crows[0].display_name || payee_name;
        } else {
          // try matching by display_name
          const [crows] = await db.execute('SELECT display_name FROM contacts WHERE display_name = ? LIMIT 1', [pv.payee]);
          if (Array.isArray(crows) && crows.length > 0) payee_name = crows[0].display_name || payee_name;
        }
      } catch (e) {
        console.warn('Failed to resolve payee display name for PV', pv.payment_voucher_id, e && e.message ? e.message : e);
      }

      let coa_name = null;
      try {
        if (pv.coa_id) {
          // Use COALESCE(account_name, name) in the SELECT to be tolerant of schema differences
          const [cro] = await db.execute('SELECT COALESCE(account_name, name) AS account_name FROM chart_of_accounts WHERE coa_id = ? LIMIT 1', [pv.coa_id]);
          if (Array.isArray(cro) && cro.length > 0) coa_name = cro[0].account_name || null;
        }
      } catch (e) {
        console.warn('Failed to resolve COA name for PV', pv.payment_voucher_id, e && e.message ? e.message : e);
      }

      out.push(Object.assign({}, pv, { payment_lines, journal_lines, payee_name, coa_name }));
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
    const { status, preparation_date, purpose, paid_through, prepared_by, payee, description, amount_to_pay, coa_id, payment_lines, journal_lines } = req.body;
    let lastErr = null;
    // Retry loop to handle rare duplicate control collisions
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await conn.beginTransaction();
        const [countRows] = await conn.execute('SELECT COUNT(*) as count FROM payment_vouchers');
        const control = 'PV-' + (countRows[0].count + 1);
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
        // Return created id and the control the server used
        res.status(201).json({ payment_voucher_id: id, payment_voucher_control: control });
        conn.release();
        return;
      } catch (err) {
        await conn.rollback();
        lastErr = err;
        // If duplicate entry on control, try again (race condition)
        if (err && err.code === 'ER_DUP_ENTRY') {
          console.warn('Duplicate control detected, retrying insert (attempt)', attempt + 1);
          continue;
        }
        console.error('POST /api/payment-vouchers failed during insert', err && err.stack ? err.stack : err);
        // non-retryable error
        res.status(500).json({ error: String(err && err.message ? err.message : err) });
        conn.release();
        return;
      }
    }
    // If we exit loop without returning, return last error
    console.error('POST /api/payment-vouchers failed after retries', lastErr && lastErr.stack ? lastErr.stack : lastErr);
    res.status(500).json({ error: String(lastErr && lastErr.message ? lastErr.message : lastErr) });
  } finally {
    try { conn.release(); } catch (e) { /* ignore */ }
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
