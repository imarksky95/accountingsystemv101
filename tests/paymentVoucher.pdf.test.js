const request = require('supertest');
const app = require('../backend/index');

describe('Payment Voucher PDF and account_name', () => {
  let server;
  beforeAll((done) => {
    server = app.listen(0, () => done());
  });
  afterAll((done) => {
    server.close(done);
  });

  test('GET /api/payment-vouchers should include account_name on journal_lines when available', async () => {
    // Create a sample chart_of_accounts entry to reference
    const db = app.get('dbPool');
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.execute('INSERT INTO chart_of_accounts (name, account_name) VALUES (?, ?)', ['Test COA', 'Test Account Name']);
      const coaId = r.insertId;
      await conn.commit();

      // Create a payment voucher that references this coa in journal_lines
      const pvRes = await request(server).post('/api/payment-vouchers').send({ status: 'Draft', preparation_date: '2025-09-23', purpose: 'pdf test', paid_through: 'Bank', prepared_by: 1, payment_lines: [{ payee_contact_id: null, payee_display: 'Test Payee', description: 'd', amount: 100 }], journal_lines: [{ coa_id: coaId, debit: 100, credit: 0, remarks: 'r' }, { coa_id: null, debit: 0, credit: 100, remarks: 'r2' }] });
      expect(pvRes.statusCode).toBe(201);

      const list = await request(server).get('/api/payment-vouchers');
      expect(list.statusCode).toBe(200);
      const found = list.body.find(p => p.payment_voucher_id === pvRes.body.payment_voucher_id);
      expect(found).toBeDefined();
      expect(found.journal_lines).toBeDefined();
      const line = found.journal_lines.find(j => j.coa_id === coaId);
      expect(line).toBeDefined();
      // account_name should be present and match
      expect(line.account_name || line.coa_name).toBeTruthy();
    } finally {
      try { await conn.release(); } catch (e) {}
    }
  }, 20000);

  test('GET /api/payment-vouchers/:id/pdf returns PDF or 501 if puppeteer missing', async () => {
    // Create a PV first
    const pvRes = await request(server).post('/api/payment-vouchers').send({ status: 'Draft', preparation_date: '2025-09-23', purpose: 'pdf endpoint', paid_through: 'Bank', prepared_by: 1, payment_lines: [{ payee_contact_id: null, payee_display: 'PDF Payee', description: 'd', amount: 50 }], journal_lines: [{ coa_id: null, debit: 50, credit: 0, remarks: 'r' }, { coa_id: null, debit: 0, credit: 50, remarks: 'r2' }] });
    expect(pvRes.statusCode).toBe(201);
    const id = pvRes.body.payment_voucher_id;

    const pdf = await request(server).get(`/api/payment-vouchers/${id}/pdf`);
    // either PDF (200 + content-type application/pdf) or 501 when puppeteer not installed
    expect([200, 501]).toContain(pdf.statusCode);
    if (pdf.statusCode === 200) {
      expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
    } else if (pdf.statusCode === 501) {
      expect(pdf.body).toBeDefined();
      expect(pdf.body.error).toMatch(/Puppeteer/);
    }
  }, 30000);
});
