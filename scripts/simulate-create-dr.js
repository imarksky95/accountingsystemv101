const axios = require('axios');
const api = axios.create({ baseURL: 'http://localhost:5000/api' });

async function run() {
  try {
    // Ensure we have a known user to login with by registering a temporary user
    const tempUser = { username: 'simuser', password: 'Password123!' };
    try {
      await api.post('/auth/register', { username: tempUser.username, password: tempUser.password, role_id: 1 });
      console.log('Registered temp user', tempUser.username);
    } catch (e) {
      // ignore if already exists
    }

    // Login with the temp user
    let token = null;
    try {
      const res = await api.post('/auth/login', { username: tempUser.username, password: tempUser.password });
      token = res.data.token;
      console.log('Logged in as', tempUser.username);
    } catch (e) {
      console.error('Login failed for temp user:', e.response?.data || e.message);
      process.exit(1);
    }
    api.defaults.headers.common['Authorization'] = 'Bearer ' + token;

    const pvs = (await api.get('/payment-vouchers')).data;
    console.log('Found', pvs.length, 'PVs');
    if (pvs.length === 0) {
      console.error('No payment vouchers found. Create some first.');
      process.exit(1);
    }
    const ids = pvs.slice(0,2).map(p=>p.payment_voucher_id);
    console.log('Using PV ids', ids);

    const amount_to_pay = pvs.slice(0,2).reduce((s,p)=>s + (Number(p.amount_to_pay)||0), 0);

    const resp = await api.post('/disbursement-reports', {
      status: 'Draft',
      disbursement_date: new Date().toISOString().slice(0,10),
      purpose: 'Simulated DR',
      amount_to_pay,
      paid_through: 'Bank',
      voucher_ids: ids
    });

    console.log('Create DR response:', resp.data);
  } catch (e) {
    console.error('Error:', e.response?.data || e.message);
    process.exit(1);
  }
}

run();
