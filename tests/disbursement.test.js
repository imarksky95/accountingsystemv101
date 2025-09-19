const request = require('supertest');
const app = require('../backend/index');

describe('Disbursement API', () => {
  let server;
  beforeAll((done) => {
    server = app.listen(0, () => done());
  });
  afterAll((done) => {
    server.close(done);
  });

  test('create payment vouchers and disbursement report', async () => {
    // create PVs
    const pv1 = await request(server).post('/api/payment-vouchers').send({ status: 'Draft', preparation_date: '2025-09-19', purpose: 't1', paid_through: 'Bank', prepared_by: 1, payee: 'A', description: 'd', amount_to_pay: 10 });
    expect(pv1.statusCode).toBe(201);

    const pv2 = await request(server).post('/api/payment-vouchers').send({ status: 'Draft', preparation_date: '2025-09-19', purpose: 't2', paid_through: 'Bank', prepared_by: 1, payee: 'B', description: 'd2', amount_to_pay: 20 });
    expect(pv2.statusCode).toBe(201);

    // register/login
    await request(server).post('/api/auth/register').send({ username: 'testint', password: 'TestPass123!', role_id: 1 });
    const login = await request(server).post('/api/auth/login').send({ username: 'testint', password: 'TestPass123!' });
    expect(login.statusCode).toBe(200);
    const token = login.body.token;

    const list = await request(server).get('/api/payment-vouchers');
    const ids = list.body.slice(-2).map(p => p.payment_voucher_id);

    const dr = await request(server).post('/api/disbursement-reports').set('Authorization', `Bearer ${token}`).send({ status: 'Draft', disbursement_date: '2025-09-19', purpose: 'int', amount_to_pay: 30, paid_through: 'Bank', prepared_by: 1, approved: 0, voucher_ids: ids });
    expect(dr.statusCode).toBe(201);
    expect(dr.body.vouchers.length).toBeGreaterThanOrEqual(2);
  }, 20000);
});
