const express = require('express');
const router = express.Router();

function getDbPool(req) { return req.app.get('dbPool'); }

// HTML builder for Payment Voucher (exported on the router for tests)
function buildPaymentVoucherHtml(pvObj, payment_lines_arr, journal_lines_arr, companyObj, prepName, revName, appName) {
  return `<!doctype html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Payment Voucher ${pvObj.payment_voucher_control}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #000; margin: 24px; }
        .header { display:flex; justify-content:space-between; align-items:center; }
        .company { font-size:18px; font-weight:700; }
        .address { font-size:12px; }
        .section { margin-top:16px; }
        table { width:100%; border-collapse:collapse; margin-top:8px; }
        th, td { padding:8px 6px; border-bottom:1px solid #ddd; }
        .right { text-align:right; }
        .signature { margin-top:36px; display:flex; justify-content:space-between; }
        .sig-box { width:30%; text-align:center; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="company">${escapeHtml(companyObj.name || '')}</div>
          <div class="address">${escapeHtml(companyObj.address || '')}</div>
        </div>
        <div>
          ${companyObj.logo ? `<img src="${companyObj.logo}" style="height:70px;"/>` : ''}
        </div>
      </div>
      <hr />
      <div class="section">
        <div><strong>PV Ctrl:</strong> ${escapeHtml(pvObj.payment_voucher_control || '')}</div>
        <div><strong>Prepared:</strong> ${escapeHtml(pvObj.preparation_date || '')}</div>
        <div><strong>Purpose:</strong> ${escapeHtml(pvObj.purpose || '')}</div>
        <div class="right"><strong>Amount:</strong> PHP ${Number(pvObj.amount_to_pay||0).toFixed(2)}</div>
      </div>
      <div class="section">
        <div style="font-weight:700;">Payment Details</div>
        <table>
          <thead><tr><th>Payee</th><th>Description</th><th class="right">Amount</th></tr></thead>
          <tbody>
            ${payment_lines_arr.map(l => `<tr><td>${escapeHtml(l.payee_display||l.payee_name||l.payee_contact_id||'')}</td><td>${escapeHtml(l.description||'')}</td><td class="right">${Number(l.amount||0).toFixed(2)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="section">
        <div style="font-weight:700;">Journal Entries</div>
        <table>
          <thead><tr><th>COA</th><th class="right">Debit</th><th class="right">Credit</th></tr></thead>
          <tbody>
            ${journal_lines_arr.map(j => `<tr><td>${escapeHtml(j.account_name||j.coa_name||'')}</td><td class="right">${Number(j.debit||0).toFixed(2)}</td><td class="right">${Number(j.credit||0).toFixed(2)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="signature">
        <div class="sig-box">Prepared By<br/><br/>__________________<div style="margin-top:8px;font-size:12px">${escapeHtml(prepName || '')}</div></div>
        <div class="sig-box">Reviewed By<br/><br/>__________________<div style="margin-top:8px;font-size:12px">${escapeHtml(revName || '')}</div></div>
        <div class="sig-box">Approved By<br/><br/>__________________<div style="margin-top:8px;font-size:12px">${escapeHtml(appName || '')}</div></div>
      </div>
    </body>
    </html>`;
}

// attach helper for tests at module load time
router.buildPaymentVoucherHtml = buildPaymentVoucherHtml;

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

      // Try to resolve account names for each journal line (attach account_name)
      try {
        const coaIds = Array.from(new Set((journal_lines || []).filter(j => j && j.coa_id).map(j => j.coa_id)));
        if (coaIds.length) {
          const placeholders = coaIds.map(() => '?').join(',');
          const [croRows] = await db.execute(`SELECT coa_id, COALESCE(account_name, name) AS account_name FROM chart_of_accounts WHERE coa_id IN (${placeholders})`, coaIds);
          const coaMap = {};
          if (Array.isArray(croRows)) {
            for (const r of croRows) coaMap[r.coa_id] = r.account_name || null;
          }
          for (const j of (journal_lines || [])) {
            if (j && j.coa_id) j.account_name = coaMap[j.coa_id] || j.coa_name || null;
            else if (j) j.account_name = j.coa_name || null;
          }
        } else {
          for (const j of (journal_lines || [])) { if (j) j.account_name = j.coa_name || null; }
        }
      } catch (e) {
        console.warn('Failed to resolve COA names for journal lines for PV', pv.payment_voucher_id, e && e.message ? e.message : e);
      }

  // Best-effort fetch of related display names (contact and COA)
  // Since payee/coa/amount may be removed from main table, compute from lines when needed
  let payee_name = null;
      try {
        // derive payee_name from first payment line if present
        if (payment_lines && payment_lines.length > 0) {
          const first = payment_lines[0];
          if (first.payee_contact_id) {
            const [crows] = await db.execute('SELECT display_name FROM contacts WHERE contact_id = ? LIMIT 1', [first.payee_contact_id]);
            if (Array.isArray(crows) && crows.length > 0) payee_name = crows[0].display_name || first.payee_display || null;
            else payee_name = first.payee_display || null;
          } else {
            payee_name = first.payee_display || null;
          }
        }
      } catch (e) {
        console.warn('Failed to resolve payee display name for PV', pv.payment_voucher_id, e && e.message ? e.message : e);
      }

      let coa_name = null;
      try {
        // If journal lines exist, try to resolve COA from the first journal line that has a coa_id
        const jlWithCoa = (journal_lines || []).find(j => j.coa_id);
        if (jlWithCoa && jlWithCoa.coa_id) {
          const [cro] = await db.execute('SELECT COALESCE(account_name, name) AS account_name FROM chart_of_accounts WHERE coa_id = ? LIMIT 1', [jlWithCoa.coa_id]);
          if (Array.isArray(cro) && cro.length > 0) coa_name = cro[0].account_name || null;
        }
      } catch (e) {
        console.warn('Failed to resolve COA name for PV', pv.payment_voucher_id, e && e.message ? e.message : e);
      }

      // Compute aggregated amount from payment lines
      let amount_to_pay = 0;
      try {
        if (payment_lines && payment_lines.length > 0) {
          amount_to_pay = payment_lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
        }
      } catch (e) {
        amount_to_pay = 0;
      }

      // Resolve prepared/reviewed/approved names similar to the PDF endpoint
      try {
        const preparedId = pv.prepared_by || pv.prepared_by_manual || null;
        let reviewedId = pv.reviewer_id || pv.reviewer_manual || pv.reviewed_by || pv.reviewed_by_manual || null;
        let approvedId = pv.approver_id || pv.approver_manual || pv.approved_by || pv.approved_by_manual || null;
        let reviewerSource = reviewedId ? 'pv' : null;
        let approverSource = approvedId ? 'pv' : null;
        // If reviewer/approver not set on PV, try to use the prepared_by user's workflow settings
        try {
          if ((!reviewedId || reviewedId === '') && preparedId && !isNaN(Number(preparedId))) {
            const [urows] = await db.execute('SELECT reviewer_id, reviewer_manual, approver_id, approver_manual FROM users WHERE user_id = ? LIMIT 1', [Number(preparedId)]);
            if (Array.isArray(urows) && urows.length) {
              const uu = urows[0];
              if (!reviewedId && (uu.reviewer_id || uu.reviewer_manual)) {
                reviewedId = uu.reviewer_id || uu.reviewer_manual || reviewedId;
                reviewerSource = reviewedId ? 'preparer_workflow' : reviewerSource;
              }
              if (!approvedId && (uu.approver_id || uu.approver_manual)) {
                approvedId = uu.approver_id || uu.approver_manual || approvedId;
                approverSource = approvedId ? 'preparer_workflow' : approverSource;
              }
            }
          }
        } catch (e) {
          // ignore resolution errors here
        }
        const signatoryIds = [];
        if (preparedId && !isNaN(Number(preparedId))) signatoryIds.push(Number(preparedId));
        if (reviewedId && !isNaN(Number(reviewedId))) signatoryIds.push(Number(reviewedId));
        if (approvedId && !isNaN(Number(approvedId))) signatoryIds.push(Number(approvedId));
        const signatoryMap = {};
        if (signatoryIds.length) {
          const ids = Array.from(new Set(signatoryIds));
          const placeholders = ids.map(() => '?').join(',');
          try {
            const [users] = await db.execute(`SELECT user_id, COALESCE(full_name, username) AS full_name FROM users WHERE user_id IN (${placeholders})`, ids);
            if (Array.isArray(users)) {
              for (const u of users) signatoryMap[u.user_id] = u.full_name || String(u.user_id);
            }
          } catch (e) {
            console.warn('Failed to resolve signatory names for PV list', pv.payment_voucher_id, e && e.message ? e.message : e);
          }
        }
  const prepared_by_name = (!preparedId || isNaN(Number(preparedId))) ? (preparedId || '') : (signatoryMap[Number(preparedId)] || String(preparedId));
  const reviewed_by_name = (!reviewedId || isNaN(Number(reviewedId))) ? (reviewedId || '') : (signatoryMap[Number(reviewedId)] || String(reviewedId));
  const approved_by_name = (!approvedId || isNaN(Number(approvedId))) ? (approvedId || '') : (signatoryMap[Number(approvedId)] || String(approvedId));

  out.push(Object.assign({}, pv, { payment_lines, journal_lines, payee_name, coa_name, amount_to_pay, prepared_by_name, reviewed_by_name, approved_by_name, reviewerSource, approverSource }));
      } catch (e) {
        // if signatory resolution fails, still return the PV with the fields we have
        out.push(Object.assign({}, pv, { payment_lines, journal_lines, payee_name, coa_name, amount_to_pay }));
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

// GET: single payment voucher enriched for display (payment_lines, journal_lines, signatory names)
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  const db = getDbPool(req);
  try {
    const [[pv]] = await db.execute('SELECT * FROM payment_vouchers WHERE payment_voucher_id = ? LIMIT 1', [id]);
    if (!pv) return res.status(404).json({ error: 'Not found' });

    const [payment_lines] = await db.execute('SELECT * FROM payment_voucher_payment_lines WHERE payment_voucher_id = ? ORDER BY id', [id]);
    let [journal_lines] = await db.execute('SELECT * FROM payment_voucher_journal_lines WHERE payment_voucher_id = ? ORDER BY id', [id]);

    // Resolve account_name for journal lines if possible
    try {
      const coaIds = Array.from(new Set((journal_lines || []).filter(j => j && j.coa_id).map(j => j.coa_id)));
      if (coaIds.length) {
        const placeholders = coaIds.map(() => '?').join(',');
        const [croRows] = await db.execute(`SELECT coa_id, COALESCE(account_name, name) AS account_name FROM chart_of_accounts WHERE coa_id IN (${placeholders})`, coaIds);
        const coaMap = {};
        if (Array.isArray(croRows)) for (const r of croRows) coaMap[r.coa_id] = r.account_name || null;
        for (const j of (journal_lines || [])) {
          if (j && j.coa_id) j.account_name = coaMap[j.coa_id] || j.coa_name || null;
          else if (j) j.account_name = j.coa_name || null;
        }
      } else {
        for (const j of (journal_lines || [])) { if (j) j.account_name = j.coa_name || null; }
      }
    } catch (e) { console.warn('Failed to resolve account names for PV journal lines', id, e && e.message ? e.message : e); }

    // payee_name and coa_name
    let payee_name = null;
    try {
      if (payment_lines && payment_lines.length > 0) {
        const first = payment_lines[0];
        if (first.payee_contact_id) {
          const [crows] = await db.execute('SELECT display_name FROM contacts WHERE contact_id = ? LIMIT 1', [first.payee_contact_id]);
          if (Array.isArray(crows) && crows.length > 0) payee_name = crows[0].display_name || first.payee_display || null;
          else payee_name = first.payee_display || null;
        } else {
          payee_name = first.payee_display || null;
        }
      }
    } catch (e) { console.warn('Failed to resolve payee display for PV', id, e && e.message ? e.message : e); }

    let coa_name = null;
    try {
      const jlWithCoa = (journal_lines || []).find(j => j.coa_id);
      if (jlWithCoa && jlWithCoa.coa_id) {
        const [cro] = await db.execute('SELECT COALESCE(account_name, name) AS account_name FROM chart_of_accounts WHERE coa_id = ? LIMIT 1', [jlWithCoa.coa_id]);
        if (Array.isArray(cro) && cro.length > 0) coa_name = cro[0].account_name || null;
      }
    } catch (e) { console.warn('Failed to resolve coa_name for PV', id, e && e.message ? e.message : e); }

    let amount_to_pay = 0;
    try {
      if (payment_lines && payment_lines.length > 0) amount_to_pay = payment_lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    } catch (e) { amount_to_pay = 0; }

    // Resolve signatory names (prepared/reviewed/approved)
    const preparedId = pv.prepared_by || pv.prepared_by_manual || null;
    let reviewedId = pv.reviewer_id || pv.reviewer_manual || pv.reviewed_by || pv.reviewed_by_manual || null;
    let approvedId = pv.approver_id || pv.approver_manual || pv.approved_by || pv.approved_by_manual || null;
    let reviewerSource = reviewedId ? 'pv' : null;
    let approverSource = approvedId ? 'pv' : null;
    // fallback to prepared_by user's workflow if PV lacks reviewer/approver
    try {
      if ((!reviewedId || reviewedId === '') && preparedId && !isNaN(Number(preparedId))) {
        const [urows] = await db.execute('SELECT reviewer_id, reviewer_manual, approver_id, approver_manual FROM users WHERE user_id = ? LIMIT 1', [Number(preparedId)]);
        if (Array.isArray(urows) && urows.length) {
          const uu = urows[0];
          if (!reviewedId && (uu.reviewer_id || uu.reviewer_manual)) { reviewedId = uu.reviewer_id || uu.reviewer_manual || reviewedId; reviewerSource = reviewedId ? 'preparer_workflow' : reviewerSource; }
          if (!approvedId && (uu.approver_id || uu.approver_manual)) { approvedId = uu.approver_id || uu.approver_manual || approvedId; approverSource = approvedId ? 'preparer_workflow' : approverSource; }
        }
      }
    } catch (e) { /* ignore */ }
    const signatoryIds = [];
    if (preparedId && !isNaN(Number(preparedId))) signatoryIds.push(Number(preparedId));
    if (reviewedId && !isNaN(Number(reviewedId))) signatoryIds.push(Number(reviewedId));
    if (approvedId && !isNaN(Number(approvedId))) signatoryIds.push(Number(approvedId));
    const signatoryMap = {};
    try {
      if (signatoryIds.length) {
        const ids = Array.from(new Set(signatoryIds));
        const placeholders = ids.map(() => '?').join(',');
        const [users] = await db.execute(`SELECT user_id, COALESCE(full_name, username) AS full_name FROM users WHERE user_id IN (${placeholders})`, ids);
        if (Array.isArray(users)) for (const u of users) signatoryMap[u.user_id] = u.full_name || String(u.user_id);
      }
    } catch (e) { console.warn('Failed to resolve signatory names for PV', id, e && e.message ? e.message : e); }
    const prepared_by_name = (!preparedId || isNaN(Number(preparedId))) ? (preparedId || '') : (signatoryMap[Number(preparedId)] || String(preparedId));
    const reviewed_by_name = (!reviewedId || isNaN(Number(reviewedId))) ? (reviewedId || '') : (signatoryMap[Number(reviewedId)] || String(reviewedId));
    const approved_by_name = (!approvedId || isNaN(Number(approvedId))) ? (approvedId || '') : (signatoryMap[Number(approvedId)] || String(approvedId));

    res.json(Object.assign({}, pv, { payment_lines, journal_lines, payee_name, coa_name, amount_to_pay, prepared_by_name, reviewed_by_name, approved_by_name, reviewerSource, approverSource }));
  } catch (err) {
    console.error('GET /api/payment-vouchers/:id failed', err && err.stack ? err.stack : err);
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
  const { status, preparation_date, purpose, paid_through, prepared_by, payment_lines, journal_lines, reviewer_id, reviewer_manual, approver_id, approver_manual } = req.body;
    let lastErr = null;
    // Retry loop to handle rare duplicate control collisions
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await conn.beginTransaction();
        const [countRows] = await conn.execute('SELECT COUNT(*) as count FROM payment_vouchers');
        const control = 'PV-' + (countRows[0].count + 1);
    // Check if the new columns exist in the database; if not, use an INSERT without those columns
    const [colRows] = await conn.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payment_vouchers'", [process.env.DB_NAME]);
    const cols = Array.isArray(colRows) ? colRows.map(r => r.COLUMN_NAME) : [];
    if (cols.includes('reviewer_id') && cols.includes('approver_id')) {
      const params = [control, status, preparation_date, purpose, paid_through, prepared_by, reviewer_id || null, reviewer_manual || null, approver_id || null, approver_manual || null].map(v => v === undefined ? null : v);
      var [r] = await conn.execute('INSERT INTO payment_vouchers (payment_voucher_control, status, preparation_date, purpose, paid_through, prepared_by, reviewer_id, reviewer_manual, approver_id, approver_manual) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', params);
    } else {
      const params = [control, status, preparation_date, purpose, paid_through, prepared_by].map(v => v === undefined ? null : v);
      var [r] = await conn.execute('INSERT INTO payment_vouchers (payment_voucher_control, status, preparation_date, purpose, paid_through, prepared_by) VALUES (?, ?, ?, ?, ?, ?)', params);
    }
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
  const { status, preparation_date, purpose, paid_through, prepared_by, payment_lines, journal_lines, reviewer_id, reviewer_manual, approver_id, approver_manual } = req.body;
    // Update using columns if they exist; otherwise update core columns only
    try {
      const [colRows2] = await conn.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payment_vouchers'", [process.env.DB_NAME]);
      const cols2 = Array.isArray(colRows2) ? colRows2.map(r => r.COLUMN_NAME) : [];
      if (cols2.includes('reviewer_id') && cols2.includes('approver_id')) {
        await conn.execute('UPDATE payment_vouchers SET status=?, preparation_date=?, purpose=?, paid_through=?, prepared_by=?, reviewer_id=?, reviewer_manual=?, approver_id=?, approver_manual=? WHERE payment_voucher_id=?', [status, preparation_date, purpose, paid_through, prepared_by, reviewer_id || null, reviewer_manual || null, approver_id || null, approver_manual || null, id]);
      } else {
        await conn.execute('UPDATE payment_vouchers SET status=?, preparation_date=?, purpose=?, paid_through=?, prepared_by=? WHERE payment_voucher_id=?', [status, preparation_date, purpose, paid_through, prepared_by, id]);
      }
    } catch (e) {
      // fallback to basic update if the information_schema check fails
      await conn.execute('UPDATE payment_vouchers SET status=?, preparation_date=?, purpose=?, paid_through=?, prepared_by=? WHERE payment_voucher_id=?', [status, preparation_date, purpose, paid_through, prepared_by, id]);
    }
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

// PDF endpoint: render a payment voucher as PDF
router.get('/:id/pdf', async (req, res) => {
  const id = req.params.id;
  const db = getDbPool(req);
  try {
    const [[pv]] = await db.execute('SELECT * FROM payment_vouchers WHERE payment_voucher_id = ? LIMIT 1', [id]);
    if (!pv) return res.status(404).json({ error: 'Not found' });
    const [payment_lines] = await db.execute('SELECT * FROM payment_voucher_payment_lines WHERE payment_voucher_id = ? ORDER BY id', [id]);
    let [journal_lines] = await db.execute('SELECT * FROM payment_voucher_journal_lines WHERE payment_voucher_id = ? ORDER BY id', [id]);
    // Resolve account_name for journal lines if possible
    try {
      const coaIds = Array.from(new Set((journal_lines || []).filter(j => j && j.coa_id).map(j => j.coa_id)));
      if (coaIds.length) {
        const placeholders = coaIds.map(() => '?').join(',');
        const [croRows] = await db.execute(`SELECT coa_id, COALESCE(account_name, name) AS account_name FROM chart_of_accounts WHERE coa_id IN (${placeholders})`, coaIds);
        const coaMap = {};
        if (Array.isArray(croRows)) for (const r of croRows) coaMap[r.coa_id] = r.account_name || null;
        for (const j of (journal_lines || [])) {
          if (j && j.coa_id) j.account_name = coaMap[j.coa_id] || j.coa_name || null;
          else if (j) j.account_name = j.coa_name || null;
        }
      } else {
        for (const j of (journal_lines || [])) { if (j) j.account_name = j.coa_name || null; }
      }
    } catch (e) { console.warn('Failed to resolve account names for PDF journal lines', e && e.message ? e.message : e); }
    // Fetch company profile with flexible column names (company_name or NAME or name)
    const [cpRows] = await db.execute("SELECT COALESCE(company_name, NAME, name) AS name, address, logo, logo_mime, logo_size_bytes FROM company_profile WHERE id = 1 LIMIT 1");
    const company = cpRows && cpRows.length ? cpRows[0] : { name: '', logo: '', address: '' };

    // Resolve prepared/reviewed/approved names if numeric IDs are present on PV
    const signatoryIds = [];
    const preparedId = pv.prepared_by || pv.prepared_by_manual || null;
    let reviewedId = pv.reviewer_id || pv.reviewer_manual || pv.reviewed_by || pv.reviewed_by_manual || null;
    let approvedId = pv.approver_id || pv.approver_manual || pv.approved_by || pv.approved_by_manual || null;
    try {
      if ((!reviewedId || reviewedId === '') && preparedId && !isNaN(Number(preparedId))) {
        const [urows] = await db.execute('SELECT reviewer_id, reviewer_manual, approver_id, approver_manual FROM users WHERE user_id = ? LIMIT 1', [Number(preparedId)]);
        if (Array.isArray(urows) && urows.length) {
          const uu = urows[0];
          reviewedId = reviewedId || uu.reviewer_id || uu.reviewer_manual || reviewedId;
          approvedId = approvedId || uu.approver_id || uu.approver_manual || approvedId;
        }
      }
    } catch (e) { /* ignore */ }
    if (preparedId && !isNaN(Number(preparedId))) signatoryIds.push(Number(preparedId));
    if (reviewedId && !isNaN(Number(reviewedId))) signatoryIds.push(Number(reviewedId));
    if (approvedId && !isNaN(Number(approvedId))) signatoryIds.push(Number(approvedId));
    const signatoryMap = {};
    try {
      if (signatoryIds.length) {
        const ids = Array.from(new Set(signatoryIds));
        const placeholders = ids.map(() => '?').join(',');
        const [users] = await db.execute(`SELECT user_id, COALESCE(full_name, username) AS full_name FROM users WHERE user_id IN (${placeholders})`, ids);
        if (Array.isArray(users)) {
          for (const u of users) signatoryMap[u.user_id] = u.full_name || String(u.user_id);
        }
      }
    } catch (e) {
      console.warn('Failed to resolve signatory names for PDF', e && e.message ? e.message : e);
    }
    const prepared_by_name = (!preparedId || isNaN(Number(preparedId))) ? (preparedId || '') : (signatoryMap[Number(preparedId)] || String(preparedId));
    const reviewed_by_name = (!reviewedId || isNaN(Number(reviewedId))) ? (reviewedId || '') : (signatoryMap[Number(reviewedId)] || String(reviewedId));
    const approved_by_name = (!approvedId || isNaN(Number(approvedId))) ? (approvedId || '') : (signatoryMap[Number(approvedId)] || String(approvedId));

    // Build HTML template
    const buildPaymentVoucherHtml = (pvObj, payment_lines_arr, journal_lines_arr, companyObj, prepName, revName, appName) => {
      return `<!doctype html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Payment Voucher ${pvObj.payment_voucher_control}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #000; margin: 24px; }
        .header { display:flex; justify-content:space-between; align-items:center; }
        .company { font-size:18px; font-weight:700; }
        .address { font-size:12px; }
        .section { margin-top:16px; }
        table { width:100%; border-collapse:collapse; margin-top:8px; }
        th, td { padding:8px 6px; border-bottom:1px solid #ddd; }
        .right { text-align:right; }
        .signature { margin-top:36px; display:flex; justify-content:space-between; }
        .sig-box { width:30%; text-align:center; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="company">${escapeHtml(companyObj.name || '')}</div>
          <div class="address">${escapeHtml(companyObj.address || '')}</div>
        </div>
        <div>
          ${companyObj.logo ? `<img src="${companyObj.logo}" style="height:70px;"/>` : ''}
        </div>
      </div>
      <hr />
      <div class="section">
        <div><strong>PV Ctrl:</strong> ${escapeHtml(pvObj.payment_voucher_control || '')}</div>
        <div><strong>Prepared:</strong> ${escapeHtml(pvObj.preparation_date || '')}</div>
        <div><strong>Purpose:</strong> ${escapeHtml(pvObj.purpose || '')}</div>
        <div class="right"><strong>Amount:</strong> PHP ${Number(pvObj.amount_to_pay||0).toFixed(2)}</div>
      </div>
      <div class="section">
        <div style="font-weight:700;">Payment Details</div>
        <table>
          <thead><tr><th>Payee</th><th>Description</th><th class="right">Amount</th></tr></thead>
          <tbody>
            ${payment_lines_arr.map(l => `<tr><td>${escapeHtml(l.payee_display||l.payee_name||l.payee_contact_id||'')}</td><td>${escapeHtml(l.description||'')}</td><td class="right">${Number(l.amount||0).toFixed(2)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="section">
        <div style="font-weight:700;">Journal Entries</div>
        <table>
          <thead><tr><th>COA</th><th class="right">Debit</th><th class="right">Credit</th></tr></thead>
          <tbody>
            ${journal_lines_arr.map(j => `<tr><td>${escapeHtml(j.account_name||j.coa_name||'')}</td><td class="right">${Number(j.debit||0).toFixed(2)}</td><td class="right">${Number(j.credit||0).toFixed(2)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="signature">
        <div class="sig-box">Prepared By<br/><br/>__________________<div style="margin-top:8px;font-size:12px">${escapeHtml(prepName || '')}</div></div>
        <div class="sig-box">Reviewed By<br/><br/>__________________<div style="margin-top:8px;font-size:12px">${escapeHtml(revName || '')}</div></div>
        <div class="sig-box">Approved By<br/><br/>__________________<div style="margin-top:8px;font-size:12px">${escapeHtml(appName || '')}</div></div>
      </div>
    </body>
    </html>`;
    };
    // attach helper for tests
    router.buildPaymentVoucherHtml = buildPaymentVoucherHtml;
    const html = buildPaymentVoucherHtml(pv, payment_lines, journal_lines, company, prepared_by_name, reviewed_by_name, approved_by_name);

    // Try to load puppeteer lazily. If it's not installed on the host, return a 501
    let puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch (e) {
      console.error('Puppeteer is not installed or failed to load:', e && e.message ? e.message : e);
      return res.status(501).json({ error: 'Puppeteer is not available on this server. Install puppeteer and redeploy to enable PDF generation.' });
    }

    // Launch puppeteer and render PDF
    const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pv.payment_voucher_control || 'payment_voucher'}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation failed', err && err.stack ? err.stack : err);
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
});

// helper to escape HTML
function escapeHtml(s) {
  if (!s && s !== 0) return '';
  return String(s).replace(/[&<>\"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]; });
}

module.exports = router;
