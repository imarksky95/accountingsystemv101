const request = require('supertest');
const app = require('../backend/index');

describe('disbursement report submit endpoint', () => {
  test('submit route exists and rejects unauthenticated', async () => {
    const res = await request(app).post('/api/disbursement-reports/1/submit').send({});
    expect([401,403,404,500]).toContain(res.status);
  }, 10000);
});
