const request = require('supertest');
const app = require('../backend/index');

(async ()=>{
  const server = app.listen(0);
  try{
    // login existing user
    const login = await request(server).post('/api/auth/login').send({ username: 'runtest', password: 'Password123' });
    console.log('login status', login.statusCode, 'body', login.body);
    const token = login.body.token;

    const list = await request(server).get('/api/payment-vouchers');
    const ids = list.body.slice(-2).map(p=>p.payment_voucher_id);
    console.log('using ids', ids);

    const drResp = await request(server).post('/api/disbursement-reports').set('Authorization', `Bearer ${token}`).send({ status: 'Draft', disbursement_date: '2025-09-19', purpose: 'debug', amount_to_pay: 0, paid_through: 'Bank', prepared_by: 1, approved: 0, voucher_ids: ids });
    console.log('DR status', drResp.statusCode);
    console.log('DR body', drResp.body);
  } catch(e){
    console.error('error', e);
  } finally{ server.close(); }
})();
