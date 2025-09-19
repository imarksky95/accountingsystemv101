const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Read backend host/port from backend/.env (we expect backend running on that host)
function parseEnv(p) {
  if (!fs.existsSync(p)) return {};
  const c = fs.readFileSync(p, 'utf8');
  return c.split(/\r?\n/).reduce((acc, line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return acc;
    const idx = t.indexOf('=');
    if (idx === -1) return acc;
    acc[t.slice(0, idx)] = t.slice(idx+1);
    return acc;
  }, {});
}

(async function main(){
  const env = parseEnv(path.resolve(__dirname, '../backend/.env'));
  const host = env.BACKEND_HOST || 'http://localhost:5000';
  console.log('Using backend host:', host);

  try {
    // Register/login test user
    try {
      await axios.post(`${host}/api/auth/register`, { username: 'testuser', password: 'TestPass123!', role_id: 1 });
      console.log('Registered test user');
    } catch (e) {
      // ignore if already exists
    }
    const login = await axios.post(`${host}/api/auth/login`, { username: 'testuser', password: 'TestPass123!' });
    const token = login.data.token;
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
    // create two PVs
    const pv1 = await axios.post(`${host}/api/payment-vouchers`, {
      status: 'Draft',
      preparation_date: '2025-09-19',
      purpose: 'Test PV1',
      paid_through: 'Bank',
      prepared_by: 1,
      payee: 'Payee 1',
      description: 'Desc 1',
      amount_to_pay: 100.50,
      coa_id: null
    });
    console.log('Created PV1:', pv1.status);

    const pv2 = await axios.post(`${host}/api/payment-vouchers`, {
      status: 'Draft',
      preparation_date: '2025-09-19',
      purpose: 'Test PV2',
      paid_through: 'Bank',
      prepared_by: 1,
      payee: 'Payee 2',
      description: 'Desc 2',
      amount_to_pay: 200.75,
      coa_id: null
    });
    console.log('Created PV2:', pv2.status);

    // Get last PV ids (list PVs)
    const list = await axios.get(`${host}/api/payment-vouchers`);
    const pvList = list.data.slice(-5);
    console.log('Recent PVs:', pvList.map(p=>({id:p.payment_voucher_id, ctrl:p.payment_voucher_control, amt:p.amount_to_pay})));

    const voucher_ids = pvList.slice(-2).map(p => p.payment_voucher_id);

    // Create DR linking those PVs
    const dr = await axios.post(`${host}/api/disbursement-reports`, {
      status: 'Draft',
      disbursement_date: '2025-09-19',
      document_ctrl_number: 'DOC-1',
      purpose: 'Daily disbursement',
      payee_client: 'Various',
      description: 'End of day disbursement',
      ub_approval_code: null,
      amount_to_pay: pvList.slice(-2).reduce((s,p)=>s+parseFloat(p.amount_to_pay),0),
      paid_through: 'Bank',
      prepared_by: 1,
      approved: 0,
      voucher_ids: voucher_ids
    }, authHeaders);
    console.log('Created DR, status:', dr.status);

    // Fetch the newly created DR (assume last one)
    const drList = await axios.get(`${host}/api/disbursement-reports`);
    const latest = drList.data.slice(-1)[0];
    console.log('Latest DR:', {id: latest.disbursement_report_id, ctrl: latest.disbursement_report_ctrl_number});

    // Get full DR by id
    const drFull = await axios.get(`${host}/api/disbursement-reports/${latest.disbursement_report_id}`);
    console.log('DR with vouchers:', drFull.data.vouchers.length, 'vouchers returned');
    console.log('Voucher ids returned:', drFull.data.vouchers.map(v=>v.payment_voucher_id));

    if (drFull.data.vouchers.length >= 2) {
      console.log('Test passed: DR contains multiple PVs');
      process.exit(0);
    } else {
      console.error('Test failed: DR has less than 2 PVs');
      process.exit(2);
    }
  } catch (e) {
    if (e.response) {
      console.error('API test error response status:', e.response.status);
      console.error('API test error response data:', e.response.data);
    } else {
      console.error('API test error:', e.message);
    }
    process.exit(1);
  }
})();
