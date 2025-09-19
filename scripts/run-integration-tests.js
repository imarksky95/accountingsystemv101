const request = require('supertest');
const app = require('../backend/index');

(async () => {
  const server = app.listen(0);
  try {
    // PVs
    let res = await request(server).post('/api/payment-vouchers').send({ status: 'Draft', preparation_date: '2025-09-19', purpose: 't1', paid_through: 'Bank', prepared_by: 1, payee: 'A', description: 'd', amount_to_pay: 10 });
    console.log('PV1 status', res.statusCode);
    res = await request(server).post('/api/payment-vouchers').send({ status: 'Draft', preparation_date: '2025-09-19', purpose: 't2', paid_through: 'Bank', prepared_by: 1, payee: 'B', description: 'd2', amount_to_pay: 20 });
    console.log('PV2 status', res.statusCode);

    // auth
    try { await request(server).post('/api/auth/register').send({ username: 'runtest', password: 'Password123', role_id: 1 }); } catch(e){ }
    const login = await request(server).post('/api/auth/login').send({ username: 'runtest', password: 'Password123' });
    console.log('Login status', login.statusCode);
    const token = login.body.token;

    const list = await request(server).get('/api/payment-vouchers');
    const ids = list.body.slice(-2).map(p => p.payment_voucher_id);
    console.log('Using PV ids', ids);

    const dr = await request(server).post('/api/disbursement-reports').set('Authorization', `Bearer ${token}`).send({ status: 'Draft', disbursement_date: '2025-09-19', purpose: 'int', amount_to_pay: 30, paid_through: 'Bank', prepared_by: 1, approved: 0, voucher_ids: ids });
    console.log('DR create status', dr.statusCode);
    console.log('DR body vouchers count', dr.body.vouchers && dr.body.vouchers.length);

    if (dr.statusCode === 201 && dr.body.vouchers && dr.body.vouchers.length >= 2) {
      console.log('Integration test PASSED');
      process.exit(0);
    } else {
      console.error('Integration test FAILED');
      process.exit(2);
    }
  } catch (e) {
    console.error('Error running integration tests', e);
    process.exit(1);
  } finally {
    server.close();
  }
})();
