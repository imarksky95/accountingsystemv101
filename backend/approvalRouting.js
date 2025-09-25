/**
 * approvalRouting.js
 *
 * Reusable approval routing template for documents (payment vouchers, check vouchers, reports, forms).
 * Exported functions:
 * - isApprovalRequired(dbPool, documentType): Promise<boolean>
 * - routeDocument(dbPool, documentType, documentId, actorUserId): Promise<routingResult>
 * - applyRoutingToDocument(dbPool, documentType, documentId, routingData): Promise<void>
 *
 * The idea: each document module can call routeDocument(...) to compute required reviewers/approvers
 * based on the user's workflow settings and the global "Document Approval Route Settings" (stored in settings table).
 * This module is intentionally conservative: it does not assume schema changes and will fall back to graceful no-op.
 */

async function tableExists(pool, tableName) {
  try {
    const [rows] = await pool.execute("SHOW TABLES LIKE ?", [tableName]);
    return Array.isArray(rows) && rows.length > 0;
  } catch (e) { return false; }
}

async function getSetting(pool, key) {
  try {
    if (!await tableExists(pool, 'settings')) return null;
    const [rows] = await pool.execute('SELECT `value` FROM settings WHERE `key` = ? LIMIT 1', [key]);
    if (!rows || rows.length === 0) return null;
    try { return JSON.parse(rows[0].value); } catch (e) { return rows[0].value; }
  } catch (e) { return null; }
}

/**
 * Check whether a given documentType requires approval routing
 * Document types might be: 'payment_voucher', 'check_voucher', 'disbursement_report', etc.
 */
async function isApprovalRequired(pool, documentType) {
  try {
    const docSettings = await getSetting(pool, 'document_approval_route_settings');
    if (!docSettings) return false;
    // Expect docSettings to be an object like { payment_voucher: true, check_voucher: true, ... }
    if (typeof docSettings === 'object') return Boolean(docSettings[documentType]);
    return false;
  } catch (e) { return false; }
}

/**
 * routeDocument: compute routing for a document
 * - documentType: string
 * - documentId: number
 * - actorUserId: the user who initiated the submission
 *
 * Returns an object: { requiresApproval: bool, reviewer: {id, manual}, approver: {id, manual}, notes }
 * Uses the actor's workflow settings as fallback when the document doesn't already carry assigned reviewer/approver.
 */
async function routeDocument(pool, documentType, documentId, actorUserId) {
  const result = { requiresApproval: false, reviewer: null, approver: null, notes: [] };
  try {
    const required = await isApprovalRequired(pool, documentType);
    result.requiresApproval = Boolean(required);
    if (!result.requiresApproval) return result;

    // Attempt to read the document row to see if reviewer/approver already set
    // conservative: try plural table names mapping
    const mapping = {
      payment_voucher: { table: 'payment_vouchers', idCol: 'payment_voucher_id' },
      check_voucher: { table: 'check_vouchers', idCol: 'check_voucher_id' },
      disbursement_report: { table: 'disbursement_reports', idCol: 'disbursement_report_id' }
    };
    const meta = mapping[documentType] || { table: documentType + 's', idCol: documentType + '_id' };
    let docRow = null;
    try {
      if (await tableExists(pool, meta.table)) {
        const q = `SELECT * FROM ${meta.table} WHERE ${meta.idCol} = ? LIMIT 1`;
        const [rows] = await pool.execute(q, [documentId]);
        if (Array.isArray(rows) && rows.length) docRow = rows[0];
      }
    } catch (e) { /* ignore */ }

    // If document has reviewer/approver columns prefixed with reviewer_*/approver_*, prefer them
    if (docRow) {
      const rId = docRow.reviewer_id || docRow.reviewer_manual || docRow.reviewed_by || docRow.reviewed_by_manual || null;
      const aId = docRow.approver_id || docRow.approver_manual || docRow.approved_by || docRow.approved_by_manual || null;
      if (rId) result.reviewer = { raw: rId };
      if (aId) result.approver = { raw: aId };
    }

    // If reviewer/approver not set on doc, use actor user's workflow settings
    if ((!result.reviewer || !result.reviewer.raw) && actorUserId) {
      try {
        const [urows] = await pool.execute('SELECT reviewer_id, reviewer_manual, approver_id, approver_manual FROM users WHERE user_id = ? LIMIT 1', [actorUserId]);
        if (Array.isArray(urows) && urows.length) {
          const uu = urows[0];
          if (uu.reviewer_id || uu.reviewer_manual) result.reviewer = { raw: uu.reviewer_id || uu.reviewer_manual };
          if (uu.approver_id || uu.approver_manual) result.approver = { raw: uu.approver_id || uu.approver_manual };
        }
      } catch (e) { /* ignore */ }
    }

    // Normalize reviewer/approver to explicit { id, manual } where possible
    const normalize = (val) => {
      if (!val) return null;
      const raw = val.raw || val;
      if (raw === null || raw === undefined || raw === '') return null;
      // If numeric => id; else manual string
      const n = Number(raw);
      if (!Number.isNaN(n)) return { id: n, manual: null };
      return { id: null, manual: String(raw) };
    };

    result.reviewer = normalize(result.reviewer);
    result.approver = normalize(result.approver);
    if (!result.reviewer) result.notes.push('No reviewer found for document; manual routing required');
    if (!result.approver) result.notes.push('No approver found for document; manual routing required');

    return result;
  } catch (e) {
    result.notes.push('Routing failed: ' + String(e && e.message ? e.message : e));
    return result;
  }
}

/**
 * applyRoutingToDocument: apply routing decisions to a document row when possible
 * This function updates the document row with reviewer/approver IDs or manual names if the table has columns.
 */
async function applyRoutingToDocument(pool, documentType, documentId, routingData) {
  try {
    const mapping = {
      payment_voucher: { table: 'payment_vouchers', idCol: 'payment_voucher_id' },
      check_voucher: { table: 'check_vouchers', idCol: 'check_voucher_id' },
      disbursement_report: { table: 'disbursement_reports', idCol: 'disbursement_report_id' }
    };
    const meta = mapping[documentType] || { table: documentType + 's', idCol: documentType + '_id' };
    if (!await tableExists(pool, meta.table)) return false;

    // check columns
    const [cols] = await pool.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?", [process.env.DB_NAME, meta.table]);
    const colNames = Array.isArray(cols) ? cols.map(c => c.COLUMN_NAME) : [];
    const updates = [];
    const params = [];
    if (routingData.reviewer) {
      if (colNames.includes('reviewer_id') && routingData.reviewer.id) { updates.push('reviewer_id = ?'); params.push(routingData.reviewer.id); }
      if (colNames.includes('reviewer_manual') && routingData.reviewer.manual) { updates.push('reviewer_manual = ?'); params.push(routingData.reviewer.manual); }
    }
    if (routingData.approver) {
      if (colNames.includes('approver_id') && routingData.approver.id) { updates.push('approver_id = ?'); params.push(routingData.approver.id); }
      if (colNames.includes('approver_manual') && routingData.approver.manual) { updates.push('approver_manual = ?'); params.push(routingData.approver.manual); }
    }
    if (updates.length === 0) return false;
    const sql = `UPDATE ${meta.table} SET ${updates.join(', ')} WHERE ${meta.idCol} = ?`;
    params.push(documentId);
    await pool.execute(sql, params);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { isApprovalRequired, routeDocument, applyRoutingToDocument };

/**
 * Idempotent status transition helper - only updates if current status differs and only allowed transitions applied
 */
async function transitionStatusIdempotent(pool, table, idCol, idValue, desiredStatus, allowedFrom = ['open','submitted','for_review','for_approval']) {
  try {
    const [rows] = await pool.execute(`SELECT ${idCol}, status FROM ${table} WHERE ${idCol} = ? LIMIT 1`, [idValue]);
    if (!rows || rows.length === 0) return false;
    const cur = rows[0].status || null;
    if (cur === desiredStatus) return false; // nothing to do
    if (allowedFrom && !allowedFrom.includes(cur)) return false; // not allowed transition
    await pool.execute(`UPDATE ${table} SET status = ? WHERE ${idCol} = ?`, [desiredStatus, idValue]);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Cascade approval to child documents (for disbursement reports)
 * - pool: db pool
 * - reportId: id of disbursement report
 * - options: { setApprovedAt: boolean, approverId: number|null }
 * This will find linked PVs/CVs/Scheduled Payments via linking tables and set their status to 'approved' idempotently.
 */
async function cascadeApproveDocuments(pool, reportId, options = {}) {
  try {
    // Approve linked payment vouchers
    if (await tableExists(pool, 'disbursement_report_vouchers')) {
      const [pvRows] = await pool.execute('SELECT payment_voucher_id FROM disbursement_report_vouchers WHERE disbursement_report_id = ?', [reportId]);
      for (const r of (pvRows || [])) {
        await transitionStatusIdempotent(pool, 'payment_vouchers', 'payment_voucher_id', r.payment_voucher_id, 'approved', ['open','submitted','for_review','for_approval']);
        if (options.setApprovedAt) {
          // best-effort: set approved_at and approver_id if columns present
          try {
            const [cols] = await pool.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payment_vouchers'", [process.env.DB_NAME]);
            const colNames = Array.isArray(cols) ? cols.map(c => c.COLUMN_NAME) : [];
            const updates = [];
            const params = [];
            if (colNames.includes('approved_at')) { updates.push('approved_at = NOW()'); }
            if (colNames.includes('approver_id') && options.approverId) { updates.push('approver_id = ?'); params.push(options.approverId); }
            if (updates.length) {
              params.push(r.payment_voucher_id);
              await pool.execute(`UPDATE payment_vouchers SET ${updates.join(', ')} WHERE payment_voucher_id = ?`, params);
            }
          } catch (e) { /* ignore */ }
        // Log approval action
        try {
          if (await tableExists(pool, 'approval_logs')) {
            await pool.execute('INSERT INTO approval_logs (entity_type, entity_id, action, actor_user_id, payload) VALUES (?, ?, ?, ?, ?)', ['payment_voucher', r.payment_voucher_id, 'approved_by_cascade', options.approverId || null, JSON.stringify({ reportId: reportId })]);
          }
        } catch (e) { /* ignore logging errors */ }
        }
      }
    }

    // Approve linked check vouchers
    if (await tableExists(pool, 'disbursement_report_check_vouchers')) {
      const [cvRows] = await pool.execute('SELECT check_voucher_id FROM disbursement_report_check_vouchers WHERE disbursement_report_id = ?', [reportId]);
      for (const r of (cvRows || [])) {
        await transitionStatusIdempotent(pool, 'check_vouchers', 'check_voucher_id', r.check_voucher_id, 'approved', ['open','submitted','for_review','for_approval']);
      }
    }

    // Approve linked scheduled payments
    if (await tableExists(pool, 'disbursement_report_scheduled_payments')) {
      const [spRows] = await pool.execute('SELECT scheduled_payment_id FROM disbursement_report_scheduled_payments WHERE disbursement_report_id = ?', [reportId]);
      for (const r of (spRows || [])) {
        await transitionStatusIdempotent(pool, 'scheduled_payments', 'scheduled_payment_id', r.scheduled_payment_id, 'approved', ['open','submitted']);
      }
    }

    return true;
  } catch (e) {
    return false;
  }
}

/**
 * routeReport: specialized routing for disbursement reports; returns routing + whether cascade should run now or after approval
 */
async function routeReport(pool, reportId, actorUserId) {
  // Reuse routeDocument but allow report-specific logic (e.g., require approver presence when amount exceeds threshold)
  const base = await routeDocument(pool, 'disbursement_report', reportId, actorUserId);
  // Example: load report amount and add note if amount exceeds configured threshold
  try {
    if (await tableExists(pool, 'disbursement_reports')) {
      const [rows] = await pool.execute('SELECT amount_to_pay FROM disbursement_reports WHERE disbursement_report_id = ? LIMIT 1', [reportId]);
      if (Array.isArray(rows) && rows.length) {
        const amt = Number(rows[0].amount_to_pay || 0);
        const threshold = Number((await getSetting(pool, 'approval_amount_threshold')) || 0);
        if (threshold > 0 && amt > threshold) base.notes.push(`Amount ${amt} exceeds threshold ${threshold}; require higher approver`);
      }
    }
  } catch (e) { /* ignore */ }
  return base;
}

module.exports = { isApprovalRequired, routeDocument, applyRoutingToDocument, transitionStatusIdempotent, cascadeApproveDocuments, routeReport };

