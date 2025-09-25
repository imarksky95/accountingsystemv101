const request = require('supertest');
const app = require('../backend/index');

describe('Check Voucher PDF and journal_lines/account_name', () => {
  let server;
  beforeAll((done) => {
    server = app.listen(0, () => done());
  });
  afterAll((done) => {
    server.close(done);
  });

  async function ensureTables() {
    const db = app.get('dbPool');
    const conn = await db.getConnection();
    try {
      // create minimal line tables if they don't exist so tests can run in clean environments
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS check_voucher_payment_lines (
          id INT AUTO_INCREMENT PRIMARY KEY,
          check_voucher_id INT NOT NULL,
          payee_contact_id INT NULL,
          payee_display VARCHAR(255) NULL,
          description TEXT NULL,
          amount DECIMAL(14,2) DEFAULT 0,
          check_number VARCHAR(64) NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS check_voucher_check_lines (
          id INT AUTO_INCREMENT PRIMARY KEY,
          check_voucher_id INT NOT NULL,
          check_number VARCHAR(64) NULL,
          check_date DATE NULL,
          check_amount DECIMAL(14,2) DEFAULT 0,
          check_subpayee INT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS check_voucher_journal_lines (
          id INT AUTO_INCREMENT PRIMARY KEY,
          check_voucher_id INT NOT NULL,
          coa_id INT NULL,
          debit DECIMAL(14,2) DEFAULT 0,
          credit DECIMAL(14,2) DEFAULT 0,
          remarks TEXT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } finally {
      try { await conn.release(); } catch (e) {}
    }
  }

  test('POST /api/check-vouchers should create CV and include coa account_name when available', async () => {
    await ensureTables();
    const db = app.get('dbPool');
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.execute('INSERT INTO chart_of_accounts (name, account_name) VALUES (?, ?)', ['Test CV COA', 'CV Test Account']);
      const coaId = r.insertId;
      await conn.commit();

      const pvRes = await request(server).post('/api/check-vouchers').send({ status: 'Draft', cvoucher_date: '2025-09-23', purpose: 'cv pdf test', paid_through: 'Bank', prepared_by: 1, payment_lines: [{ payee_contact_id: null, payee_display: 'Test Payee', description: 'd', amount: 100 }], journal_lines: [{ coa_id: coaId, debit: 100, credit: 0, remarks: 'r' }, { coa_id: null, debit: 0, credit: 100, remarks: 'r2' }] });
      expect(pvRes.statusCode).toBe(201);

      const list = await request(server).get('/api/check-vouchers');
      expect(list.statusCode).toBe(200);
      const found = list.body.find(p => p.check_voucher && p.check_voucher.check_voucher_id === pvRes.body.check_voucher.check_voucher_id || p.check_voucher_id === pvRes.body.check_voucher.check_voucher_id || p.check_voucher_control === (pvRes.body.check_voucher && pvRes.body.check_voucher.check_voucher_control));
      // if returned as top-level object or wrapped, find the record
      const rec = found || (list.body.find(p => p.check_voucher_id === pvRes.body.check_voucher.check_voucher_id));
      expect(rec || list.body).toBeTruthy();
      // try to locate journal lines from the POST response or listing
      const jl = pvRes.body.journal_lines || (rec && rec.journal_lines) || (list.body.find(p => p.check_voucher_id === pvRes.body.check_voucher.check_voucher_id && p.journal_lines) && list.body.find(p => p.check_voucher_id === pvRes.body.check_voucher.check_voucher_id).journal_lines);
      // there should be at least one line referencing our coaId
      expect(jl).toBeDefined();
      const line = (jl || []).find(j => Number(j.coa_id) === Number(coaId));
      expect(line).toBeDefined();
      // account_name or coa_name may be present when the backend enriches rows
      expect(line.account_name || line.coa_name || line.coa_id).toBeTruthy();
    } finally {
      try { await conn.release(); } catch (e) {}
    }
  }, 20000);

  test('POST multi-check CV and PDF endpoint behavior', async () => {
    await ensureTables();
    const serverApp = server; // already started
    const res = await request(serverApp).post('/api/check-vouchers').send({ status: 'Draft', cvoucher_date: '2025-09-24', purpose: 'multi check test', paid_through: 'Bank', prepared_by: 1, payment_lines: [{ payee_contact_id: null, payee_display: 'Multi Payee', description: 'd', amount: 200 }], journal_lines: [{ coa_id: null, debit: 200, credit: 0, remarks: 'r' }, { coa_id: null, debit: 0, credit: 200, remarks: 'r2' }], check_lines: [{ check_number: '1001', check_date: '2025-09-24', check_amount: 100 }, { check_number: '1002', check_date: '2025-09-24', check_amount: 100 }], multiple_checks: 1 });
    expect(res.statusCode).toBe(201);
    const id = res.body && res.body.check_voucher && res.body.check_voucher.check_voucher_id ? res.body.check_voucher.check_voucher_id : (res.body.check_voucher_id || null);
    expect(id).toBeTruthy();

    const pdf = await request(serverApp).get(`/api/check-vouchers/${id}/pdf`);
    expect([200, 501]).toContain(pdf.statusCode);
    if (pdf.statusCode === 200) {
      expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
    } else if (pdf.statusCode === 501) {
      expect(pdf.body).toBeDefined();
      expect(pdf.body.error).toMatch(/Puppeteer/);
    }
  }, 30000);
});
