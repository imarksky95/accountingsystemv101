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

    // For each payment voucher, fetch associated payment_lines and journal_lines
    const results = [];
    for (const pv of rows) {
      const [paymentLines] = await dbPool.execute('SELECT * FROM payment_voucher_payment_lines WHERE payment_voucher_id=? ORDER BY id', [pv.payment_voucher_id]);
      const [journalLines] = await dbPool.execute('SELECT * FROM payment_voucher_journal_lines WHERE payment_voucher_id=? ORDER BY id', [pv.payment_voucher_id]);
      results.push(Object.assign({}, pv, { payment_lines: paymentLines, journal_lines: journalLines }));
    }
    res.json(results);
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
    , payment_lines, journal_lines
  } = req.body;
  try {
    const dbPool = getDbPool(req);
    const conn = await dbPool.getConnection();
    try {
      await conn.beginTransaction();
    // Auto-generate control number (simple example)
      const [result] = await conn.execute('SELECT COUNT(*) as count FROM payment_vouchers');
      const payment_voucher_control = `PV-${result[0].count + 1}`;
      const params = [payment_voucher_control, status, preparation_date, purpose, paid_through, prepared_by, payee, description, amount_to_pay, coa_id].map(v => v === undefined ? null : v);
      const [insertResult] = await conn.execute(
          'INSERT INTO payment_vouchers (payment_voucher_control, status, preparation_date, purpose, paid_through, prepared_by, payee, description, amount_to_pay, coa_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          params
      );

      const pvId = insertResult.insertId;

      // Insert payment lines if provided
      if (Array.isArray(payment_lines)) {
        for (const pl of payment_lines) {
          const payee_contact_id = pl.payee_contact_id || null;
          const payee_display = pl.payee_display || null;
          const descriptionLine = pl.description || null;
          const amount = pl.amount == null ? 0 : pl.amount;
          await conn.execute('INSERT INTO payment_voucher_payment_lines (payment_voucher_id, payee_contact_id, payee_display, description, amount) VALUES (?, ?, ?, ?, ?)', [pvId, payee_contact_id, payee_display, descriptionLine, amount]);
        }
      }

      // Insert journal lines if provided
      if (Array.isArray(journal_lines)) {
        for (const jl of journal_lines) {
          const coa = jl.coa_id || null;
          const debit = jl.debit == null ? 0 : jl.debit;
          const credit = jl.credit == null ? 0 : jl.credit;
          const remarks = jl.remarks || null;
          await conn.execute('INSERT INTO payment_voucher_journal_lines (payment_voucher_id, coa_id, debit, credit, remarks) VALUES (?, ?, ?, ?, ?)', [pvId, coa, debit, credit, remarks]);
        }
      }

      await conn.commit();
      res.status(201).json({ message: 'Payment voucher created', payment_voucher_id: pvId });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
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
    , payment_lines, journal_lines
  } = req.body;
  try {
    const dbPool = getDbPool(req);
    const conn = await dbPool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('UPDATE payment_vouchers SET status=?, preparation_date=?, purpose=?, paid_through=?, prepared_by=?, payee=?, description=?, amount_to_pay=?, coa_id=? WHERE payment_voucher_id=?', [status, preparation_date, purpose, paid_through, prepared_by, payee, description, amount_to_pay, coa_id, id]);

      // Replace payment lines: delete existing and insert new
      await conn.execute('DELETE FROM payment_voucher_payment_lines WHERE payment_voucher_id=?', [id]);
      if (Array.isArray(payment_lines)) {
        for (const pl of payment_lines) {
          const payee_contact_id = pl.payee_contact_id || null;
          const payee_display = pl.payee_display || null;
          const descriptionLine = pl.description || null;
          const amount = pl.amount == null ? 0 : pl.amount;
          await conn.execute('INSERT INTO payment_voucher_payment_lines (payment_voucher_id, payee_contact_id, payee_display, description, amount) VALUES (?, ?, ?, ?, ?)', [id, payee_contact_id, payee_display, descriptionLine, amount]);
        }
      }

      // Replace journal lines
      await conn.execute('DELETE FROM payment_voucher_journal_lines WHERE payment_voucher_id=?', [id]);
      if (Array.isArray(journal_lines)) {
        for (const jl of journal_lines) {
          const coa = jl.coa_id || null;
          const debit = jl.debit == null ? 0 : jl.debit;
          const credit = jl.credit == null ? 0 : jl.credit;
          const remarks = jl.remarks || null;
          await conn.execute('INSERT INTO payment_voucher_journal_lines (payment_voucher_id, coa_id, debit, credit, remarks) VALUES (?, ?, ?, ?, ?)', [id, coa, debit, credit, remarks]);
        }
      }

      await conn.commit();
      res.json({ message: 'Payment voucher updated' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a payment voucher
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const dbPool = getDbPool(req);
    const conn = await dbPool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM payment_voucher_payment_lines WHERE payment_voucher_id=?', [id]);
      await conn.execute('DELETE FROM payment_voucher_journal_lines WHERE payment_voucher_id=?', [id]);
      await conn.execute('DELETE FROM payment_vouchers WHERE payment_voucher_id=?', [id]);
      await conn.commit();
      res.json({ message: 'Payment voucher deleted' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
