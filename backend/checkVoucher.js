const express = require('express');
const router = express.Router();

function getDbPool(req) {
  return req.app.get('dbPool');
}

// Get all check vouchers (enriched similar to payment vouchers)
router.get('/', async (req, res) => {
  const db = getDbPool(req);
  try {
    const [rows] = await db.execute('SELECT * FROM check_vouchers ORDER BY check_voucher_id DESC');
    const out = [];
    for (const cv of rows) {
      let payment_lines = [];
      let check_lines = [];
      let journal_lines = [];
      try {
        const [pls] = await db.execute('SELECT * FROM check_voucher_payment_lines WHERE check_voucher_id=? ORDER BY id', [cv.check_voucher_id]);
        payment_lines = pls;
      } catch (e) { console.warn('Failed to load payment_lines for CV', cv.check_voucher_id, e && e.message ? e.message : e); }
      try {
        const [cls] = await db.execute('SELECT * FROM check_voucher_check_lines WHERE check_voucher_id=? ORDER BY id', [cv.check_voucher_id]);
        check_lines = cls;
      } catch (e) { console.warn('Failed to load check_lines for CV', cv.check_voucher_id, e && e.message ? e.message : e); }
      try {
        const [jls] = await db.execute('SELECT * FROM check_voucher_journal_lines WHERE check_voucher_id=? ORDER BY id', [cv.check_voucher_id]);
        journal_lines = jls;
      } catch (e) { console.warn('Failed to load journal_lines for CV', cv.check_voucher_id, e && e.message ? e.message : e); }

      // Resolve account_name for journal lines when possible
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
      } catch (e) { console.warn('Failed to resolve COA names for journal lines for CV', cv.check_voucher_id, e && e.message ? e.message : e); }

      // derive payee_name from first payment line when possible
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
      } catch (e) { console.warn('Failed to resolve payee display name for CV', cv.check_voucher_id, e && e.message ? e.message : e); }

      // compute total amount
      let amount_total = 0;
      try { if (payment_lines && payment_lines.length > 0) amount_total = payment_lines.reduce((s, l) => s + (Number(l.amount) || 0), 0); } catch (e) { amount_total = 0; }

      // Resolve signatory names: prepared/reviewed/approved similar to paymentVoucher
      try {
        const preparedId = cv.prepared_by || cv.prepared_by_manual || null;
        let reviewedId = cv.reviewer_id || cv.reviewer_manual || cv.reviewed_by || cv.reviewed_by_manual || null;
        let approvedId = cv.approver_id || cv.approver_manual || cv.approved_by || cv.approved_by_manual || null;
        // fallback to prepared_by user's workflow
        try {
          if ((!reviewedId || reviewedId === '') && preparedId && !isNaN(Number(preparedId))) {
            const [urows] = await db.execute('SELECT reviewer_id, reviewer_manual, approver_id, approver_manual FROM users WHERE user_id = ? LIMIT 1', [Number(preparedId)]);
            if (Array.isArray(urows) && urows.length) {
              const uu = urows[0];
              if (!reviewedId && (uu.reviewer_id || uu.reviewer_manual)) reviewedId = uu.reviewer_id || uu.reviewer_manual || reviewedId;
              if (!approvedId && (uu.approver_id || uu.approver_manual)) approvedId = uu.approver_id || uu.approver_manual || approvedId;
            }
          }
        } catch (e) {}
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
            if (Array.isArray(users)) for (const u of users) signatoryMap[u.user_id] = u.full_name || String(u.user_id);
          } catch (e) { console.warn('Failed to resolve signatory names for CV list', cv.check_voucher_id, e && e.message ? e.message : e); }
        }
        const prepared_by_name = (!preparedId || isNaN(Number(preparedId))) ? (preparedId || '') : (signatoryMap[Number(preparedId)] || String(preparedId));
        const reviewed_by_name = (!reviewedId || isNaN(Number(reviewedId))) ? (reviewedId || '') : (signatoryMap[Number(reviewedId)] || String(reviewedId));
        const approved_by_name = (!approvedId || isNaN(Number(approvedId))) ? (approvedId || '') : (signatoryMap[Number(approvedId)] || String(approvedId));

        out.push(Object.assign({}, cv, { payment_lines, check_lines, journal_lines, payee_name, amount_total, prepared_by_name, reviewed_by_name, approved_by_name }));
      } catch (e) {
        out.push(Object.assign({}, cv, { payment_lines, check_lines, journal_lines, payee_name, amount_total }));
      }
    }
    res.json(out);
  } catch (err) {
    console.error('GET /api/check-vouchers failed', err && err.stack ? err.stack : err);
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
});

// Get single check voucher enriched for preview
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  const db = getDbPool(req);
  try {
    const [[cv]] = await db.execute('SELECT * FROM check_vouchers WHERE check_voucher_id = ? LIMIT 1', [id]);
    if (!cv) return res.status(404).json({ error: 'Not found' });

    const [payment_lines] = await db.execute('SELECT * FROM check_voucher_payment_lines WHERE check_voucher_id = ? ORDER BY id', [id]).catch(() => ([[]]));
    const [check_lines] = await db.execute('SELECT * FROM check_voucher_check_lines WHERE check_voucher_id = ? ORDER BY id', [id]).catch(() => ([[]]));
    let [journal_lines] = await db.execute('SELECT * FROM check_voucher_journal_lines WHERE check_voucher_id = ? ORDER BY id', [id]).catch(() => ([[]]));

    // Resolve COA names
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
    } catch (e) { console.warn('Failed to resolve COA for CV', id, e && e.message ? e.message : e); }

    // payee_name
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
    } catch (e) { console.warn('Failed to resolve payee for CV', id, e && e.message ? e.message : e); }

    let amount_total = 0; try { if (payment_lines && payment_lines.length > 0) amount_total = payment_lines.reduce((s, l) => s + (Number(l.amount) || 0), 0); } catch (e) { amount_total = 0; }

    // Resolve signatory names
    const preparedId = cv.prepared_by || cv.prepared_by_manual || null;
    let reviewedId = cv.reviewer_id || cv.reviewer_manual || cv.reviewed_by || cv.reviewed_by_manual || null;
    let approvedId = cv.approver_id || cv.approver_manual || cv.approved_by || cv.approved_by_manual || null;
    try {
      if ((!reviewedId || reviewedId === '') && preparedId && !isNaN(Number(preparedId))) {
        const [urows] = await db.execute('SELECT reviewer_id, reviewer_manual, approver_id, approver_manual FROM users WHERE user_id = ? LIMIT 1', [Number(preparedId)]);
        if (Array.isArray(urows) && urows.length) {
          const uu = urows[0];
          if (!reviewedId && (uu.reviewer_id || uu.reviewer_manual)) reviewedId = uu.reviewer_id || uu.reviewer_manual || reviewedId;
          if (!approvedId && (uu.approver_id || uu.approver_manual)) approvedId = uu.approver_id || uu.approver_manual || approvedId;
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
    } catch (e) { console.warn('Failed to resolve signatory names for CV', id, e && e.message ? e.message : e); }
    const prepared_by_name = (!preparedId || isNaN(Number(preparedId))) ? (preparedId || '') : (signatoryMap[Number(preparedId)] || String(preparedId));
    const reviewed_by_name = (!reviewedId || isNaN(Number(reviewedId))) ? (reviewedId || '') : (signatoryMap[Number(reviewedId)] || String(reviewedId));
    const approved_by_name = (!approvedId || isNaN(Number(approvedId))) ? (approvedId || '') : (signatoryMap[Number(approvedId)] || String(approvedId));

    // Attach company profile for preview (best-effort)
    let company = {};
    try {
      const [rows2] = await db.execute('SELECT * FROM company_profile LIMIT 1');
      if (Array.isArray(rows2) && rows2.length) company = rows2[0];
    } catch (e) { /* ignore */ }

    res.json(Object.assign({}, cv, { payment_lines, check_lines, journal_lines, payee_name, amount_total, prepared_by_name, reviewed_by_name, approved_by_name, company }));
  } catch (err) {
    console.error('GET /api/check-vouchers/:id failed', err && err.stack ? err.stack : err);
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
});

// PDF endpoint for check voucher (fallback 501 if PDF generation is not available)
router.get('/:id/pdf', async (req, res) => {
  const id = req.params.id;
  const db = getDbPool(req);
  try {
    const [[cv]] = await db.execute('SELECT * FROM check_vouchers WHERE check_voucher_id = ? LIMIT 1', [id]);
    if (!cv) return res.status(404).json({ error: 'Not found' });
    const [payment_lines] = await db.execute('SELECT * FROM check_voucher_payment_lines WHERE check_voucher_id = ? ORDER BY id', [id]);
    let [journal_lines] = await db.execute('SELECT * FROM check_voucher_journal_lines WHERE check_voucher_id = ? ORDER BY id', [id]);
    let [check_lines] = await db.execute('SELECT * FROM check_voucher_check_lines WHERE check_voucher_id = ? ORDER BY id', [id]);

    // Resolve COA names
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
    } catch (e) { console.warn('Failed to resolve COA for CV PDF', id, e && e.message ? e.message : e); }

    // Resolve signatory names (prepared/reviewed/approved)
    const preparedId = cv.prepared_by || cv.prepared_by_manual || null;
    let reviewedId = cv.reviewer_id || cv.reviewer_manual || cv.reviewed_by || cv.reviewed_by_manual || null;
    let approvedId = cv.approver_id || cv.approver_manual || cv.approved_by || cv.approved_by_manual || null;
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
    } catch (e) { console.warn('Failed to resolve signatory names for CV PDF', e && e.message ? e.message : e); }
    const prepared_by_name = (!preparedId || isNaN(Number(preparedId))) ? (preparedId || '') : (signatoryMap[Number(preparedId)] || String(preparedId));
    const reviewed_by_name = (!reviewedId || isNaN(Number(reviewedId))) ? (reviewedId || '') : (signatoryMap[Number(reviewedId)] || String(reviewedId));
    const approved_by_name = (!approvedId || isNaN(Number(approvedId))) ? (approvedId || '') : (signatoryMap[Number(approvedId)] || String(approvedId));

    // Fetch company profile for header
    const [cpRows] = await db.execute("SELECT COALESCE(company_name, NAME, name) AS name, address, logo, logo_mime, logo_size_bytes FROM company_profile WHERE id = 1 LIMIT 1");
    const company = cpRows && cpRows.length ? cpRows[0] : { name: '', logo: '', address: '' };

    // Build HTML template for CV (simple variant similar to PV)
    const escapeHtml = (s) => { if (!s && s !== 0) return ''; return String(s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]; }); };
    const buildCvHtml = (cvObj, payment_lines_arr, journal_lines_arr, check_lines_arr, companyObj, prepName, revName, appName) => {
      return `<!doctype html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Check Voucher ${escapeHtml(cvObj.check_voucher_control || String(cvObj.check_voucher_id || ''))}</title>
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
        <div><strong>CV Ctrl:</strong> ${escapeHtml(cvObj.check_voucher_control || String(cvObj.check_voucher_id || ''))}</div>
        <div><strong>Prepared:</strong> ${escapeHtml(cvObj.cvoucher_date || '')}</div>
        <div><strong>Purpose:</strong> ${escapeHtml(cvObj.purpose || '')}</div>
        <div class="right"><strong>Amount:</strong> PHP ${Number(cvObj.check_amount|| (payment_lines_arr && payment_lines_arr.length ? payment_lines_arr.reduce((s,l)=>s + (Number(l.amount)||0),0) : 0)).toFixed(2)}</div>
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
      <div class="section">
        <div style="font-weight:700;">Check Lines</div>
        <table>
          <thead><tr><th>Check No</th><th>Check Date</th><th>Payee</th><th class="right">Amount</th></tr></thead>
          <tbody>
            ${check_lines_arr.map(c => `<tr><td>${escapeHtml(c.check_number||'')}</td><td>${escapeHtml(c.check_date||'')}</td><td>${escapeHtml(c.check_subpayee||'')}</td><td class="right">${Number(c.check_amount||0).toFixed(2)}</td></tr>`).join('')}
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

    const html = buildCvHtml(cv, payment_lines, journal_lines, check_lines, company, prepared_by_name, reviewed_by_name, approved_by_name);

    // Try to load puppeteer lazily
    let puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch (e) {
      console.error('Puppeteer is not installed or failed to load for CV PDF:', e && e.message ? e.message : e);
      return res.status(501).json({ error: 'Puppeteer is not available on this server. Install puppeteer and redeploy to enable PDF generation.' });
    }

    const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cv.check_voucher_control || 'check_voucher'}.pdf"
`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('GET /api/check-vouchers/:id/pdf failed', err && err.stack ? err.stack : err);
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
});

// Create a check voucher
router.post('/', async (req, res) => {
  const body = req.body || {};
  const cvoucher_date = body.cvoucher_date;
  const purpose = body.purpose;
  const check_payee = body.check_payee || body.payee || null;
  const check_no = body.check_no || null;
  const check_amount = body.check_amount || body.amount || null;
  const cvoucher_status = body.cvoucher_status || body.status || null;
  const multiple_checks = body.multiple_checks || body.multiple_checks === 1 || body.mode === 'multi' ? 1 : 0;
  const coa_id = body.coa_id || null;
  const payment_lines = body.payment_lines || [];
  const check_lines = body.check_lines || [];
  const journal_lines = body.journal_lines || [];
  // Signatories from body (id or manual). Frontend sends reviewer_id/approver_id plus legacy reviewed_by/approved_by; prefer the explicit *_id/manual pairs
  const prepared_by = body.prepared_by || null;
  const prepared_by_manual = body.prepared_by_manual || null;
  const reviewer_id = body.reviewer_id || body.reviewed_by || null;
  const reviewer_manual = body.reviewer_manual || body.reviewed_by_manual || null;
  const approver_id = body.approver_id || body.approved_by || null;
  const approver_manual = body.approver_manual || body.approved_by_manual || null;
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

  const params = [
      check_voucher_control, cvoucher_date || null, purpose || null, check_payee || null, check_no || null, check_amount || null,
      cvoucher_status || null, multiple_checks ? 1 : 0, /* check_fr removed */ null, /* check_to removed */ null, coa_id || null,
      prepared_by || null, prepared_by_manual || null, reviewer_id || null, reviewer_manual || null, approver_id || null, approver_manual || null
    ];
    const [result] = await conn.execute(
      'INSERT INTO check_vouchers (check_voucher_control, cvoucher_date, purpose, check_payee, check_no, check_amount, cvoucher_status, multiple_checks, check_fr, check_to, coa_id, prepared_by, prepared_by_manual, reviewer_id, reviewer_manual, approver_id, approver_manual) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
  const body = req.body || {};
  const cvoucher_date = body.cvoucher_date;
  const purpose = body.purpose;
  const check_payee = body.check_payee || body.payee || null;
  const check_no = body.check_no || null;
  const check_amount = body.check_amount || body.amount || null;
  const cvoucher_status = body.cvoucher_status || body.status || null;
  const multiple_checks = body.multiple_checks || body.multiple_checks === 1 || body.mode === 'multi' ? 1 : 0;
  const coa_id = body.coa_id || null;
  const payment_lines = body.payment_lines || [];
  const check_lines = body.check_lines || [];
  const journal_lines = body.journal_lines || [];
  const prepared_by = body.prepared_by || null;
  const prepared_by_manual = body.prepared_by_manual || null;
  const reviewer_id = body.reviewer_id || body.reviewed_by || null;
  const reviewer_manual = body.reviewer_manual || body.reviewed_by_manual || null;
  const approver_id = body.approver_id || body.approved_by || null;
  const approver_manual = body.approver_manual || body.approved_by_manual || null;
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
      'UPDATE check_vouchers SET cvoucher_date=?, purpose=?, check_payee=?, check_no=?, check_amount=?, cvoucher_status=?, multiple_checks=?, check_fr=NULL, check_to=NULL, coa_id=?, prepared_by=?, prepared_by_manual=?, reviewer_id=?, reviewer_manual=?, approver_id=?, approver_manual=?, updated_at = CURRENT_TIMESTAMP WHERE check_voucher_id=?',
      [cvoucher_date || null, purpose || null, check_payee || null, check_no || null, check_amount || null, cvoucher_status || null, multiple_checks ? 1 : 0, coa_id || null, prepared_by || null, prepared_by_manual || null, reviewer_id || null, reviewer_manual || null, approver_id || null, approver_manual || null, id]
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
