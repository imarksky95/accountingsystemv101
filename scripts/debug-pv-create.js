const request = require('supertest');
const app = require('../backend/index');

(async () => {
  const server = app.listen(0);
  try {
    let res = await request(server).post('/api/payment-vouchers').send({ status: 'Draft', preparation_date: '2025-09-19', purpose: 't1', paid_through: 'Bank', prepared_by: 1, payee: 'A', description: 'd', amount_to_pay: 10 });
    console.log('PV1 status', res.statusCode, 'body', res.body);
    res = await request(server).post('/api/payment-vouchers').send({ status: 'Draft', preparation_date: '2025-09-19', purpose: 't2', paid_through: 'Bank', prepared_by: 1, payee: 'B', description: 'd2', amount_to_pay: 20 });
    console.log('PV2 status', res.statusCode, 'body', res.body);
  } catch (e) { console.error(e);} finally { server.close(); }
})();
