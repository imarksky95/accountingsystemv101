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

  out.push(Object.assign({}, pv, { payment_lines, journal_lines, payee_name, coa_name, amount_to_pay }));
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
  const { status, preparation_date, purpose, paid_through, prepared_by, payment_lines, journal_lines } = req.body;
    let lastErr = null;
    // Retry loop to handle rare duplicate control collisions
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await conn.beginTransaction();
        const [countRows] = await conn.execute('SELECT COUNT(*) as count FROM payment_vouchers');
        const control = 'PV-' + (countRows[0].count + 1);
  const params = [control, status, preparation_date, purpose, paid_through, prepared_by].map(v => v === undefined ? null : v);
  const [r] = await conn.execute('INSERT INTO payment_vouchers (payment_voucher_control, status, preparation_date, purpose, paid_through, prepared_by) VALUES (?, ?, ?, ?, ?, ?)', params);
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
  const { status, preparation_date, purpose, paid_through, prepared_by, payment_lines, journal_lines } = req.body;
  await conn.execute('UPDATE payment_vouchers SET status=?, preparation_date=?, purpose=?, paid_through=?, prepared_by=? WHERE payment_voucher_id=?', [status, preparation_date, purpose, paid_through, prepared_by, id]);
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
    const [cpRows] = await db.execute('SELECT * FROM company_profile WHERE id = 1 LIMIT 1');
    const company = cpRows && cpRows.length ? cpRows[0] : { name: '', logo: '', address: '' };

    // Build HTML template
    const html = `<!doctype html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Payment Voucher ${pv.payment_voucher_control}</title>
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
          <div class="company">${escapeHtml(company.name || '')}</div>
          <div class="address">${escapeHtml(company.address || '')}</div>
        </div>
        <div>
          ${company.logo ? `<img src="${company.logo}" style="height:70px;"/>` : ''}
        </div>
      </div>
      <hr />
      <div class="section">
        <div><strong>PV Ctrl:</strong> ${escapeHtml(pv.payment_voucher_control || '')}</div>
        <div><strong>Prepared:</strong> ${escapeHtml(pv.preparation_date || '')}</div>
        <div><strong>Purpose:</strong> ${escapeHtml(pv.purpose || '')}</div>
        <div class="right"><strong>Amount:</strong> PHP ${Number(pv.amount_to_pay||0).toFixed(2)}</div>
      </div>
      <div class="section">
        <div style="font-weight:700;">Payment Details</div>
        <table>
          <thead><tr><th>Payee</th><th>Description</th><th class="right">Amount</th></tr></thead>
          <tbody>
            ${payment_lines.map(l => `<tr><td>${escapeHtml(l.payee_display||l.payee_name||l.payee_contact_id||'')}</td><td>${escapeHtml(l.description||'')}</td><td class="right">${Number(l.amount||0).toFixed(2)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="section">
        <div style="font-weight:700;">Journal Entries</div>
        <table>
          <thead><tr><th>COA</th><th class="right">Debit</th><th class="right">Credit</th></tr></thead>
          <tbody>
            ${journal_lines.map(j => `<tr><td>${escapeHtml(j.account_name||j.coa_name||'')}</td><td class="right">${Number(j.debit||0).toFixed(2)}</td><td class="right">${Number(j.credit||0).toFixed(2)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="signature">
        <div class="sig-box">Prepared By<br/><br/>__________________</div>
        <div class="sig-box">Reviewed By<br/><br/>__________________</div>
        <div class="sig-box">Approved By<br/><br/>__________________</div>
      </div>
    </body>
    </html>`;

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
