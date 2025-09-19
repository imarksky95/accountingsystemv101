const express = require('express');
const router = express.Router();

function getDbPool(req) {
  return req.app.get('dbPool');
}

// Get all disbursement reports
router.get('/', async (req, res) => {
  try {
    const dbPool = getDbPool(req);
    // Return each disbursement report with its linked payment vouchers as an array
    const [reports] = await dbPool.execute('SELECT * FROM disbursement_reports');
    const out = [];
    for (const r of reports) {
      const [vouchers] = await dbPool.execute(
        'SELECT p.payment_voucher_id, p.payment_voucher_control, p.payee, p.amount_to_pay, p.preparation_date FROM disbursement_report_vouchers dv JOIN payment_vouchers p ON dv.payment_voucher_id = p.payment_voucher_id WHERE dv.disbursement_report_id = ?',
        [r.disbursement_report_id]
      );
      out.push({ ...r, vouchers });
    }
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single disbursement report with linked vouchers
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const dbPool = getDbPool(req);
    const [rows] = await dbPool.execute('SELECT * FROM disbursement_reports WHERE disbursement_report_id = ?', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const report = rows[0];
    const [vouchers] = await dbPool.execute(
      'SELECT p.payment_voucher_id, p.payment_voucher_control, p.payee, p.amount_to_pay, p.preparation_date FROM disbursement_report_vouchers dv JOIN payment_vouchers p ON dv.payment_voucher_id = p.payment_voucher_id WHERE dv.disbursement_report_id = ?',
      [id]
    );
    res.json({ ...report, vouchers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const authenticate = require('./middleware/authenticate');

// Create a disbursement report (multi-select vouchers)
router.post('/', authenticate, async (req, res) => {
  const {
    status,
    disbursement_date,
    document_ctrl_number,
    purpose,
    payee_client,
    description,
    ub_approval_code,
    amount_to_pay,
    paid_through,
    prepared_by,
    approved,
    voucher_ids // array of payment_voucher_ids
  } = req.body;
  // default prepared_by to authenticated user if available
  const authenticatedUserId = req.user && req.user.user_id;
  const final_prepared_by = prepared_by || authenticatedUserId || null;
  try {
    const dbPool = getDbPool(req);
    // Auto-generate control number
    const [result] = await dbPool.execute('SELECT COUNT(*) as count FROM disbursement_reports');
    const disbursement_report_ctrl_number = `DR-${result[0].count + 1}`;
    // Use a transaction to ensure atomic creation and linking
    const conn = await dbPool.getConnection();
    try {
      await conn.beginTransaction();
  const insertParams = [disbursement_report_ctrl_number, status, disbursement_date, document_ctrl_number, purpose, payee_client, description, ub_approval_code, amount_to_pay, paid_through, final_prepared_by, approved].map(v => v === undefined ? null : v);
      const [reportResult] = await conn.execute(
        'INSERT INTO disbursement_reports (disbursement_report_ctrl_number, status, disbursement_date, document_ctrl_number, purpose, payee_client, description, ub_approval_code, amount_to_pay, paid_through, prepared_by, approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        insertParams
      );
      const reportId = reportResult.insertId;
      if (voucher_ids && voucher_ids.length > 0) {
        const vals = voucher_ids.map(() => '(?, ?)').join(',');
        const params = [];
        for (const vid of voucher_ids) { params.push(reportId, vid); }
        await conn.execute(
          `INSERT INTO disbursement_report_vouchers (disbursement_report_id, payment_voucher_id) VALUES ${vals}`,
          params
        );
      }
      await conn.commit();

      // Return the created report with vouchers
  const [rows] = await dbPool.execute('SELECT * FROM disbursement_reports WHERE disbursement_report_id = ?', [reportId]);
      const report = rows[0];
      const [vouchers] = await dbPool.execute(
        'SELECT p.payment_voucher_id, p.payment_voucher_control, p.payee, p.amount_to_pay, p.preparation_date FROM disbursement_report_vouchers dv JOIN payment_vouchers p ON dv.payment_voucher_id = p.payment_voucher_id WHERE dv.disbursement_report_id = ?',
        [reportId]
      );
      res.status(201).json({ ...report, vouchers });
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

// Update a disbursement report
router.put('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const {
    status,
    disbursement_date,
    document_ctrl_number,
    purpose,
    payee_client,
    description,
    ub_approval_code,
    amount_to_pay,
    paid_through,
    prepared_by,
    approved
  } = req.body;
  const authenticatedUserId = req.user && req.user.user_id;
  const final_prepared_by = prepared_by || authenticatedUserId || null;
  try {
    const dbPool = getDbPool(req);
    await dbPool.execute(
      'UPDATE disbursement_reports SET status=?, disbursement_date=?, document_ctrl_number=?, purpose=?, payee_client=?, description=?, ub_approval_code=?, amount_to_pay=?, paid_through=?, prepared_by=?, approved=? WHERE disbursement_report_id=?',
      [status, disbursement_date, document_ctrl_number, purpose, payee_client, description, ub_approval_code, amount_to_pay, paid_through, final_prepared_by, approved, id]
    );
    res.json({ message: 'Disbursement report updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a disbursement report
router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const dbPool = getDbPool(req);
    await dbPool.execute('DELETE FROM disbursement_reports WHERE disbursement_report_id=?', [id]);
    res.json({ message: 'Disbursement report deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
