// Input validation and field whitelisting (SEC-24, SEC-25)
const { describe, it, expect } = require('@jest/globals');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');
const schemas = require('../validation/schemas');
const { validate } = require('../middlewares/validate.middlewares');

const ok = (schema, value) => schema.parse(value);
const fails = (schema, value) => expect(schema.safeParse(value).success).toBe(false);

describe('Schemas', () => {
  it('drops fields that are not in the schema (no mass assignment)', () => {
    expect(ok(schemas.categoryCreate, { name: 'Health', id: 99, createdAt: '2000-01-01' })).toEqual({ name: 'Health' });
    expect(ok(schemas.contactUpdate, { read: true, email: 'attacker@example.com', message: 'x' })).toEqual({ read: true });
    expect(ok(schemas.profileUpdate, { name: 'Ana', role: 'admin', passwordHash: 'x' })).toEqual({ name: 'Ana' });
    expect(ok(schemas.signup, { name: 'Ana', email: 'ana@example.com', password: 'x', role: 'admin' })).not.toHaveProperty('role');
  });

  it('validates ids in URL params', () => {
    expect(ok(schemas.idParams, { id: '42' })).toEqual({ id: 42 });
    ['abc', '0', '-3', '1.5', '99999999999', ''].forEach((id) => fails(schemas.idParams, { id }));
  });

  it('validates projects: status, capacity, dates and category', () => {
    const project = ok(schemas.projectCreate, {
      name: '  Beach Clean-Up ', capacity: '30', status: 'Active',
      start_date: '2026-12-01', end_date: '2026-12-02', categoryId: '3', description: '',
    });
    expect(project).toMatchObject({ name: 'Beach Clean-Up', capacity: 30, status: 'active', categoryId: 3, description: '' });
    expect(project.start_date).toBeInstanceOf(Date);

    fails(schemas.projectCreate, { name: 'X', status: 'deleted' });
    fails(schemas.projectCreate, { name: 'X', capacity: '0' });
    fails(schemas.projectCreate, { name: 'X', capacity: 'many' });
    fails(schemas.projectCreate, { name: 'X', start_date: 'not a date' });
    fails(schemas.projectCreate, { name: 'X', start_date: '2026-12-05', end_date: '2026-12-01' });
    fails(schemas.projectCreate, { name: 'X', categoryId: 'abc' });
    fails(schemas.projectCreate, { name: '   ' });
    fails(schemas.projectCreate, { name: 'x'.repeat(151) });
  });

  it('allows partial project updates, including clearing free text', () => {
    expect(ok(schemas.projectUpdate, {})).toEqual({});
    expect(ok(schemas.projectUpdate, { location: '' })).toEqual({ location: '' });
  });

  it('bounds the length of free text', () => {
    fails(schemas.reviewCreate, { content: 'x'.repeat(2001) });
    fails(schemas.reviewCreate, { content: '  ' });
    fails(schemas.contactCreate, { name: 'A', email: 'a@example.com', message: 'x'.repeat(5001) });
    fails(schemas.contactCreate, { name: 'A', email: 'not-an-email', message: 'hi' });
  });

  it('validates roles, signup names and push subscriptions', () => {
    fails(schemas.roleUpdate, { role: 'superadmin' });
    fails(schemas.categoryUpdate, {});
    fails(schemas.signup, { email: 'a@example.com', password: 'x' });
    expect(ok(schemas.signup, { firstName: 'Ana', lastName: 'Ruiz', email: 'a@example.com', password: 'x' }).firstName).toBe('Ana');
    expect(ok(schemas.reviewUpdate, { content: 'ok', removeImage: 'true' }).removeImage).toBe(true);

    const keys = { p256dh: 'BKey', auth: 'secret' };
    expect(ok(schemas.subscribe, { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', expirationTime: null, keys }).endpoint)
      .toBe('https://fcm.googleapis.com/fcm/send/abc');
    fails(schemas.subscribe, { endpoint: 'http://fcm.googleapis.com/x', keys });
    fails(schemas.subscribe, { endpoint: 'javascript:alert(1)', keys });
    fails(schemas.subscribe, { endpoint: 'https://fcm.googleapis.com/x' });
  });
});

describe('validate middleware', () => {
  function buildApp(schemasForRoute, beforeValidate) {
    const app = express();
    app.use(express.json());
    if (beforeValidate) app.use(beforeValidate);
    app.put('/items/:id', validate(schemasForRoute), (req, res) => res.json({ params: req.params, body: req.body }));
    return app;
  }

  it('replaces body and params with the parsed, whitelisted values', async () => {
    const res = await request(buildApp({ params: schemas.idParams, body: schemas.categoryUpdate }))
      .put('/items/7').send({ name: '  Health ', isAdmin: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ params: { id: 7 }, body: { name: 'Health' } });
  });

  it('answers 400 with field errors and without internals', async () => {
    const res = await request(buildApp({ params: schemas.idParams, body: schemas.categoryUpdate }))
      .put('/items/abc').send({ name: 'Health' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/^Invalid input: id: /);
    expect(res.body.errors[0]).toEqual({ field: 'id', message: expect.any(String) });
    expect(JSON.stringify(res.body)).not.toMatch(/zod|stack/i);
  });

  it('removes a file multer already wrote to disk when the request is invalid', async () => {
    const tmp = path.join(os.tmpdir(), `awtc-upload-${Date.now()}.png`);
    fs.writeFileSync(tmp, 'fake image');
    const fakeMulter = (req, res, next) => { req.file = { path: tmp }; next(); };

    const res = await request(buildApp({ body: schemas.reviewCreate }, fakeMulter)).put('/items/1').send({ content: '' });
    expect(res.status).toBe(400);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fs.existsSync(tmp)).toBe(false);
  });
});

describe('Routes use validation', () => {
  // Every write route and every route with an :id must validate before its controller
  const routesDir = path.join(__dirname, '..', 'routes');
  const files = ['category', 'contact', 'project', 'reviews', 'user', 'message', 'subscription'].map((n) => `${n}.routes.js`);

  it.each(files)('%s validates every route with params or a body', (file) => {
    const source = fs.readFileSync(path.join(routesDir, file), 'utf8');
    const definitions = source.match(/router\.(post|put|delete|get)\(\s*['"][^'"]*['"][\s\S]*?\);/g) || [];
    const unvalidated = definitions
      .filter((def) => /router\.(post|put|delete)/.test(def) || /['"][^'"]*:\w+/.test(def))
      .filter((def) => !def.includes('validate('))
      // documented exceptions: login (Basic auth/JSON handled by the auth service)
      // and routes whose only input is the authenticated user
      .filter((def) => !/['"]\/login['"]|['"]\/dashboard['"]\s*,\s*authMiddleware,\s*requireAuth,\s*protectDemoSelf/.test(def));
    expect(unvalidated).toEqual([]);
  });
});
