const request = require('supertest');
const app = require('../backend/index');

describe('Auth /me and login include workflow fields', () => {
  let server;
  beforeAll((done) => {
    server = app.listen(0, () => done());
  });
  afterAll((done) => {
    server.close(done);
  });

  test('login response and /api/auth/me contain reviewer/approver fields', async () => {
    const username = `testme_${Date.now()}`;
    const password = 'TestPass123!';

    // register
    const reg = await request(server).post('/api/auth/register').send({ username, password, role_id: 1 });
    expect([200,201]).toContain(reg.statusCode);

    // login
    const login = await request(server).post('/api/auth/login').send({ username, password });
    expect(login.statusCode).toBe(200);
    expect(login.body).toHaveProperty('token');
    expect(login.body).toHaveProperty('user');
    const user = login.body.user;
    // workflow fields must exist (may be null)
    expect(user).toHaveProperty('reviewer_id');
    expect(user).toHaveProperty('approver_id');
    expect(user).toHaveProperty('reviewer_manual');
    expect(user).toHaveProperty('approver_manual');

    const token = login.body.token;
    const me = await request(server).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.statusCode).toBe(200);
    expect(me.body).toHaveProperty('reviewer_id');
    expect(me.body).toHaveProperty('approver_id');
    expect(me.body).toHaveProperty('reviewer_manual');
    expect(me.body).toHaveProperty('approver_manual');
  }, 20000);
});
