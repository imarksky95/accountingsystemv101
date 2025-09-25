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
        `SELECT p.payment_voucher_id, p.payment_voucher_control, p.amount_to_pay, p.preparation_date,
          COALESCE(c.display_name, p.payee) AS payee
         FROM disbursement_report_vouchers dv
         JOIN payment_vouchers p ON dv.payment_voucher_id = p.payment_voucher_id
         LEFT JOIN contacts c ON (p.payee = CAST(c.contact_id AS CHAR) OR p.payee = c.display_name)
         WHERE dv.disbursement_report_id = ?`,
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
          `SELECT p.payment_voucher_id, p.payment_voucher_control, p.amount_to_pay, p.preparation_date,
            COALESCE(c.display_name, p.payee) AS payee
           FROM disbursement_report_vouchers dv
           JOIN payment_vouchers p ON dv.payment_voucher_id = p.payment_voucher_id
           LEFT JOIN contacts c ON (p.payee = CAST(c.contact_id AS CHAR) OR p.payee = c.display_name)
           WHERE dv.disbursement_report_id = ?`,
          [id]
    );
    res.json({ ...report, vouchers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const authenticate = require('./middleware/authenticate');

const approvalRouting = require('./approvalRouting');

// Submit disbursement report for approval routing
router.post('/:id/submit', authenticate, async (req, res) => {
  const { id } = req.params;
  const { cascade = false, autoApprove = false } = req.body || {};
  const dbPool = getDbPool(req);
  try {
    // Ensure report exists
    const [rows] = await dbPool.execute('SELECT * FROM disbursement_reports WHERE disbursement_report_id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const actorUserId = req.user && req.user.user_id ? Number(req.user.user_id) : null;
    const routing = await approvalRouting.routeReport(dbPool, Number(id), actorUserId);

    // Apply routing to the report row if possible
    await approvalRouting.applyRoutingToDocument(dbPool, 'disbursement_report', Number(id), routing);

    // Update status to indicate submitted / for review
    const statusSet = routing.reviewer ? 'for_review' : (routing.approver ? 'for_approval' : 'submitted');
    await dbPool.execute('UPDATE disbursement_reports SET status = ? WHERE disbursement_report_id = ?', [statusSet, id]);

    // Optionally auto-approve (for testing) or when autoApprove flag used by a privileged actor
    if (autoApprove) {
      // mark report approved and cascade
      await dbPool.execute("UPDATE disbursement_reports SET status = 'approved', approved_at = NOW() WHERE disbursement_report_id = ?", [id]);
      // cascade to linked documents
      await approvalRouting.cascadeApproveDocuments(dbPool, Number(id), { setApprovedAt: true, approverId: actorUserId });
      // log approval
      try { if ((await dbPool.execute("SHOW TABLES LIKE 'approval_logs'"))[0].length) await dbPool.execute('INSERT INTO approval_logs (entity_type, entity_id, action, actor_user_id, payload) VALUES (?, ?, ?, ?, ?)', ['disbursement_report', id, 'auto_approved_and_cascaded', actorUserId || null, JSON.stringify({ routing })]); } catch (e) { }
      return res.json({ success: true, message: 'Report auto-approved and cascaded', routing });
    }

    // If caller requested immediate cascade after routing (e.g., when routing has approver present), run cascade
    if (cascade && routing.approver) {
      // if declared approver present, set approved and cascade
      await dbPool.execute("UPDATE disbursement_reports SET status = 'approved', approved_at = NOW() WHERE disbursement_report_id = ?", [id]);
      await approvalRouting.cascadeApproveDocuments(dbPool, Number(id), { setApprovedAt: true, approverId: routing.approver.id || null });
      try { if ((await dbPool.execute("SHOW TABLES LIKE 'approval_logs'"))[0].length) await dbPool.execute('INSERT INTO approval_logs (entity_type, entity_id, action, actor_user_id, payload) VALUES (?, ?, ?, ?, ?)', ['disbursement_report', id, 'approved_and_cascaded', actorUserId || null, JSON.stringify({ routing })]); } catch (e) { }
      return res.json({ success: true, message: 'Report approved and cascaded', routing });
    }

    res.json({ success: true, message: 'Report routed for approval', routing });
  } catch (err) {
    console.error('POST /api/disbursement-reports/:id/submit failed', err && err.stack ? err.stack : err);
    res.status(500).json({ error: err.message });
  }
});

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

// Mark report as paid/released (idempotent)
router.post('/:id/mark-paid', authenticate, async (req, res) => {
  const { id } = req.params;
  const dbPool = getDbPool(req);
  const actorUserId = req.user && req.user.user_id ? Number(req.user.user_id) : null;
  try {
    // Only allow transition if current status is 'approved'
    const [rows] = await dbPool.execute('SELECT status FROM disbursement_reports WHERE disbursement_report_id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const cur = rows[0].status || null;
    if (cur !== 'approved') return res.status(400).json({ error: 'Report must be approved before marking as paid' });
    await dbPool.execute("UPDATE disbursement_reports SET status = 'paid/released', paid_at = NOW() WHERE disbursement_report_id = ?", [id]);
    // log action
    try { if ((await dbPool.execute("SHOW TABLES LIKE 'approval_logs'"))[0].length) await dbPool.execute('INSERT INTO approval_logs (entity_type, entity_id, action, actor_user_id, payload) VALUES (?, ?, ?, ?, ?)', ['disbursement_report', id, 'marked_paid', actorUserId || null, JSON.stringify({})]); } catch (e) { }
    res.json({ success: true, message: 'Marked as paid/released' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
