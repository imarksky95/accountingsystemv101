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
    coa_id,
    payment_lines,
    check_lines,
    journal_lines
  } = req.body;
  const dbPool = getDbPool(req);
  let conn;
  try {
    // Basic server-side validation to avoid inconsistent data
    if (!purpose) return res.status(400).json({ error: 'Purpose is required' });
    if (!Array.isArray(payment_lines) || payment_lines.length === 0) return res.status(400).json({ error: 'At least one payment line is required' });
    if (!Array.isArray(journal_lines) || journal_lines.length < 2) return res.status(400).json({ error: 'At least two journal lines are required' });
    const totalDebit = (journal_lines || []).reduce((s, j) => s + (Number(j.debit) || 0), 0);
    const totalCredit = (journal_lines || []).reduce((s, j) => s + (Number(j.credit) || 0), 0);
    if (totalDebit !== totalCredit) return res.status(400).json({ error: 'Total debit and credit must be equal' });

    conn = await dbPool.getConnection();
    await conn.beginTransaction();

    // Auto-generate control number (use table-level count)
    const [countRows] = await conn.execute('SELECT COUNT(*) as count FROM check_vouchers');
    const check_voucher_control = `CV-${countRows[0].count + 1}`;

    const params = [check_voucher_control, cvoucher_date || null, purpose || null, check_payee || null, check_no || null, check_amount || null, cvoucher_status || null, multiple_checks ? 1 : 0, check_fr || null, check_to || null, coa_id || null];
    const [result] = await conn.execute(
      'INSERT INTO check_vouchers (check_voucher_control, cvoucher_date, purpose, check_payee, check_no, check_amount, cvoucher_status, multiple_checks, check_fr, check_to, coa_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      params
    );
    const insertId = result.insertId;

    // Insert payment lines if provided
    if (Array.isArray(payment_lines) && payment_lines.length) {
      const values = payment_lines.map(pl => [insertId, pl.payee_contact_id || null, pl.payee_display || null, pl.description || null, pl.amount || 0, pl.check_number || null]);
      await conn.query(
        'INSERT INTO check_voucher_payment_lines (check_voucher_id, payee_contact_id, payee_display, description, amount, check_number) VALUES ?',
        [values]
      );
    }

    // Insert check lines if provided
    if (Array.isArray(check_lines) && check_lines.length) {
      const values = check_lines.map(cl => [insertId, cl.check_number || null, cl.check_date || null, cl.check_amount || 0, cl.check_subpayee || null]);
      await conn.query(
        'INSERT INTO check_voucher_check_lines (check_voucher_id, check_number, check_date, check_amount, check_subpayee) VALUES ?',
        [values]
      );
    }

    // Insert journal lines if provided
    if (Array.isArray(journal_lines) && journal_lines.length) {
      const values = journal_lines.map(jl => [insertId, jl.coa_id || null, jl.debit || 0, jl.credit || 0, jl.remarks || null]);
      await conn.query(
        'INSERT INTO check_voucher_journal_lines (check_voucher_id, coa_id, debit, credit, remarks) VALUES ?',
        [values]
      );
    }

    await conn.commit();

    // Fetch created CV + lines
    const [cvRows] = await dbPool.execute('SELECT * FROM check_vouchers WHERE check_voucher_id = ?', [insertId]);
    const cv = cvRows[0];
    const [plRows] = await dbPool.execute('SELECT * FROM check_voucher_payment_lines WHERE check_voucher_id = ?', [insertId]);
    const [clRows] = await dbPool.execute('SELECT * FROM check_voucher_check_lines WHERE check_voucher_id = ?', [insertId]);
    const [jlRows] = await dbPool.execute('SELECT * FROM check_voucher_journal_lines WHERE check_voucher_id = ?', [insertId]);

    res.status(201).json({ check_voucher: cv, payment_lines: plRows, check_lines: clRows, journal_lines: jlRows });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
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
  const { payment_lines, check_lines, journal_lines } = req.body || {};
  const dbPool = getDbPool(req);
  let conn;
  try {
    // Server-side validation
    if (!purpose) return res.status(400).json({ error: 'Purpose is required' });
    if (!Array.isArray(payment_lines) || payment_lines.length === 0) return res.status(400).json({ error: 'At least one payment line is required' });
    if (!Array.isArray(journal_lines) || journal_lines.length < 2) return res.status(400).json({ error: 'At least two journal lines are required' });
    const totalDebit = (journal_lines || []).reduce((s, j) => s + (Number(j.debit) || 0), 0);
    const totalCredit = (journal_lines || []).reduce((s, j) => s + (Number(j.credit) || 0), 0);
    if (totalDebit !== totalCredit) return res.status(400).json({ error: 'Total debit and credit must be equal' });

    conn = await dbPool.getConnection();
    await conn.beginTransaction();

    await conn.execute(
      'UPDATE check_vouchers SET cvoucher_date=?, purpose=?, check_payee=?, check_no=?, check_amount=?, cvoucher_status=?, multiple_checks=?, check_fr=?, check_to=?, coa_id=?, updated_at = CURRENT_TIMESTAMP WHERE check_voucher_id=?',
      [cvoucher_date || null, purpose || null, check_payee || null, check_no || null, check_amount || null, cvoucher_status || null, multiple_checks ? 1 : 0, check_fr || null, check_to || null, coa_id || null, id]
    );

    // Replace lines by deleting existing ones and inserting new
    await conn.execute('DELETE FROM check_voucher_payment_lines WHERE check_voucher_id = ?', [id]);
    if (Array.isArray(payment_lines) && payment_lines.length) {
      const values = payment_lines.map(pl => [id, pl.payee_contact_id || null, pl.payee_display || null, pl.description || null, pl.amount || 0, pl.check_number || null]);
      await conn.query('INSERT INTO check_voucher_payment_lines (check_voucher_id, payee_contact_id, payee_display, description, amount, check_number) VALUES ?', [values]);
    }

    await conn.execute('DELETE FROM check_voucher_check_lines WHERE check_voucher_id = ?', [id]);
    if (Array.isArray(check_lines) && check_lines.length) {
      const values = check_lines.map(cl => [id, cl.check_number || null, cl.check_date || null, cl.check_amount || 0, cl.check_subpayee || null]);
      await conn.query('INSERT INTO check_voucher_check_lines (check_voucher_id, check_number, check_date, check_amount, check_subpayee) VALUES ?', [values]);
    }

    await conn.execute('DELETE FROM check_voucher_journal_lines WHERE check_voucher_id = ?', [id]);
    if (Array.isArray(journal_lines) && journal_lines.length) {
      const values = journal_lines.map(jl => [id, jl.coa_id || null, jl.debit || 0, jl.credit || 0, jl.remarks || null]);
      await conn.query('INSERT INTO check_voucher_journal_lines (check_voucher_id, coa_id, debit, credit, remarks) VALUES ?', [values]);
    }

    await conn.commit();

    // Fetch updated CV + lines
    const [cvRows] = await dbPool.execute('SELECT * FROM check_vouchers WHERE check_voucher_id = ?', [id]);
    const cv = cvRows[0];
    const [plRows] = await dbPool.execute('SELECT * FROM check_voucher_payment_lines WHERE check_voucher_id = ?', [id]);
    const [clRows] = await dbPool.execute('SELECT * FROM check_voucher_check_lines WHERE check_voucher_id = ?', [id]);
    const [jlRows] = await dbPool.execute('SELECT * FROM check_voucher_journal_lines WHERE check_voucher_id = ?', [id]);

    res.json({ check_voucher: cv, payment_lines: plRows, check_lines: clRows, journal_lines: jlRows });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
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
