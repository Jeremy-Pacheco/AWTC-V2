// Sign-up / login (local provider), dashboard session, CSRF and API separation
const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const request = require('supertest');
const { api, app, db, resetDatabase, closeDatabase } = require('./helpers');

const PASSWORD = 'cañón:con:dos-puntos-42';
const basic = (email, password) => `Basic ${Buffer.from(`${email}:${password}`, 'utf8').toString('base64')}`;

beforeAll(resetDatabase);
afterAll(closeDatabase);

describe('Sign-up and login (local provider)', () => {
  it('registers a volunteer and returns a token', async () => {
    const res = await api().post('/api/users/signup').send({ name: 'Lucía Peña', email: 'lucia@test.example.com', password: PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.access_token).toEqual(expect.any(String));
    expect(res.body.user.role).toBe('volunteer');
    const stored = await db.User.scope('withPassword').findOne({ where: { email: 'lucia@test.example.com' } });
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, cost 12
  });

  it('cannot choose its own role at sign-up', async () => {
    const res = await api().post('/api/users/signup')
      .send({ name: 'Mallory', email: 'mallory@test.example.com', password: 'river-lantern-42', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('volunteer');
  });

  it('logs in with Basic auth: UTF-8 and ":" inside the password work (BUG-03)', async () => {
    const res = await api().post('/api/users/login').set('Authorization', basic('lucia@test.example.com', PASSWORD));
    expect(res.status).toBe(200);
    expect(res.body.access_token).toEqual(expect.any(String));
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const wrong = await api().post('/api/users/login').set('Authorization', basic('lucia@test.example.com', 'nope-nope-1'));
    const unknown = await api().post('/api/users/login').set('Authorization', basic('ghost@test.example.com', 'nope-nope-1'));
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('enforces the password policy', async () => {
    const common = await api().post('/api/users/signup').send({ name: 'Weak', email: 'weak@test.example.com', password: 'password123' });
    const personal = await api().post('/api/users/signup').send({ name: 'Rosalind', email: 'rosalind@test.example.com', password: 'rosalind-2026' });
    expect(common.status).toBe(400);
    expect(personal.status).toBe(400);
  });
});

describe('Admin dashboard session (EJS)', () => {
  let agent;

  // Logged out: the login form carries the token; logged in, /login redirects,
  // so the token comes from the logout form in the dashboard header
  async function csrfToken(path = '/login') {
    const page = await agent.get(path);
    const match = /name="_csrf" value="([0-9a-f]{64})"/.exec(page.text);
    expect(match).not.toBeNull();
    return match[1];
  }

  beforeAll(async () => {
    await api().post('/api/users/signup').send({ name: 'Boss', email: 'boss@test.example.com', password: 'river-lantern-42' });
    await db.User.update({ role: 'admin' }, { where: { email: 'boss@test.example.com' } });
    agent = request.agent(app);
  });

  it('rejects a login form without the CSRF token', async () => {
    await csrfToken(); // receive the cookie, but do not send the token
    const res = await agent.post('/login').type('form').send({ email: 'boss@test.example.com', password: 'river-lantern-42' });
    expect(res.status).toBe(403);
  });

  it('logs in with the CSRF token and opens the dashboard', async () => {
    const token = await csrfToken();
    const res = await agent.post('/login').type('form').send({ email: 'boss@test.example.com', password: 'river-lantern-42', _csrf: token });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
    const dashboard = await agent.get('/overview');
    expect(dashboard.status).toBe(200);
    expect(dashboard.text).toContain('boss@test.example.com');
  });

  it('does not accept the dashboard session cookie on the API (SEC-13)', async () => {
    const res = await agent.get('/api/users');
    expect(res.status).toBe(401);
  });

  it('only logs out with POST + CSRF', async () => {
    expect((await agent.get('/logout')).status).toBe(404);
    const token = await csrfToken('/overview'); // logout form in the dashboard header
    const res = await agent.post('/logout').type('form').send({ _csrf: token });
    expect(res.status).toBe(302);
    const after = await agent.get('/overview');
    expect(after.status).toBe(302);
    expect(after.headers.location).toBe('/login');
  });

  it('keeps non-admins out of the dashboard', async () => {
    const volunteer = request.agent(app);
    await api().post('/api/users/signup').send({ name: 'Vera', email: 'vera@test.example.com', password: 'river-lantern-42' });
    const page = await volunteer.get('/login');
    const token = /name="_csrf" value="([0-9a-f]{64})"/.exec(page.text)[1];
    await volunteer.post('/login').type('form').send({ email: 'vera@test.example.com', password: 'river-lantern-42', _csrf: token });
    expect((await volunteer.get('/overview')).status).toBe(403);
  });
});
