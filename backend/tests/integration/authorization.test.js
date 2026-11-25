// Role-based access to the API against a real database (audit task 3.5)
const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const { api, db, seed, closeDatabase } = require('./helpers');

let ctx;
beforeAll(async () => { ctx = await seed(); });
afterAll(closeDatabase);

/** Expected status per caller; `anonymous` sends no token. */
async function expectAccess(method, url, expected, body) {
  for (const [who, status] of Object.entries(expected)) {
    let req = api()[method](url);
    if (who !== 'anonymous') req = req.set(ctx.auth[who]);
    if (body) req = req.send(typeof body === 'function' ? body() : body);
    const res = await req;
    expect({ who, method, url, status: res.status }).toEqual({ who, method, url, status });
  }
}

describe('Users', () => {
  it('only admins and coordinators can list users', async () => {
    await expectAccess('get', '/api/users', { anonymous: 401, volunteer: 403, coordinatorA: 200, admin: 200 });
  });

  it('never exposes password hashes', async () => {
    const res = await api().get('/api/users').set(ctx.auth.admin);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it('only admins can change roles', async () => {
    const url = `/api/users/${ctx.users.volunteer2.id}/role`;
    await expectAccess('put', url, { anonymous: 401, volunteer: 403, coordinatorA: 403 }, { role: 'admin' });
    await expectAccess('put', url, { admin: 200 }, { role: 'coordinator' });
    expect((await db.User.findByPk(ctx.users.volunteer2.id)).role).toBe('coordinator');
  });

  it('rejects invalid roles and ids', async () => {
    await expectAccess('put', `/api/users/${ctx.users.volunteer.id}/role`, { admin: 400 }, { role: 'superadmin' });
    await expectAccess('put', '/api/users/abc/role', { admin: 400 }, { role: 'admin' });
  });

  it('only admins can create coordinators or delete users', async () => {
    const coordinator = { name: 'New Coordinator', email: 'new-coord@test.example.com', password: 'river-lantern-42' };
    await expectAccess('post', '/api/users/coordinator', { anonymous: 401, volunteer: 403, coordinatorA: 403 }, coordinator);
    await expectAccess('delete', `/api/users/${ctx.users.volunteer2.id}`, { anonymous: 401, volunteer: 403, coordinatorA: 403 });
  });

  it('lets any authenticated user read only their own profile', async () => {
    await expectAccess('get', '/api/users/dashboard', { anonymous: 401, volunteer: 200 });
    const res = await api().get('/api/users/dashboard').set(ctx.auth.volunteer);
    expect(res.body.user.email).toBe(ctx.users.volunteer.email);
  });

  it("only admins and coordinators can see another user's projects", async () => {
    // (volunteer2 is promoted earlier in this file, so the caller is `volunteer`)
    await expectAccess('get', `/api/users/${ctx.users.volunteer2.id}/projects`, { anonymous: 401, volunteer: 403, coordinatorA: 200 });
  });
});

describe('Categories', () => {
  it('can be read by anyone but only managed by staff', async () => {
    await expectAccess('get', '/api/categories', { anonymous: 200 });
    await expectAccess('post', '/api/categories', { anonymous: 401, volunteer: 403 }, { name: 'Health' });
    await expectAccess('put', `/api/categories/${ctx.category.id}`, { anonymous: 401, volunteer: 403 }, { name: 'Renamed' });
    await expectAccess('delete', `/api/categories/${ctx.category.id}`, { anonymous: 401, volunteer: 403 });
  });
});

describe('Contacts', () => {
  it('anyone can write, only admins can read or manage', async () => {
    await expectAccess('post', '/api/contacts', { anonymous: 201 }, { name: 'Ana', email: 'ana@test.example.com', message: 'Hello' });
    await expectAccess('get', '/api/contacts', { anonymous: 401, volunteer: 403, coordinatorA: 403, admin: 200 });
  });
});

describe('Messages', () => {
  it('only admins and coordinators can use messaging', async () => {
    await expectAccess('get', '/api/messages/conversations', { anonymous: 401, volunteer: 403, coordinatorA: 200, admin: 200 });
    await expectAccess('get', '/api/messages/unread-count', { volunteer: 403, coordinatorA: 200 });
  });
});

describe('Tokens', () => {
  it('rejects forged, malformed and other-algorithm tokens', async () => {
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign({ id: ctx.users.admin.id, role: 'admin' }, 'not-the-real-secret');
    // Unsigned token ("alg": "none"), built by hand
    const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ id: ctx.users.admin.id, role: 'admin' })}.`;
    for (const token of [forged, none, 'garbage']) {
      const res = await api().get('/api/users').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    }
  });

  it('reads the role from the database, not from the token', async () => {
    // A token issued while the user was a volunteer...
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: ctx.users.volunteer.id, role: 'admin' }, process.env.JWT_SECRET, { algorithm: 'HS256' });
    const res = await api().get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
