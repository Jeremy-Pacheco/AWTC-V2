// CSRF protection of the EJS dashboard forms (signed double-submit cookie)
const { describe, it, expect } = require('@jest/globals');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { CSRF_COOKIE, provideCsrfToken, verifyCsrfToken } = require('../middlewares/csrf.middlewares');

const SECRET = 'test-only-cookie-secret';

function buildApp() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.locals.frontendUrl = 'http://localhost:5173';
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser(SECRET));
  app.use(provideCsrfToken);
  app.get('/form', (req, res) => res.json({ token: res.locals.csrfToken }));
  app.post('/action', verifyCsrfToken, (req, res) => res.status(200).send('ok'));
  return app;
}

const csrfCookieFrom = (res) =>
  (res.headers['set-cookie'] || []).find((c) => c.startsWith(`${CSRF_COOKIE}=`));

async function getTokenAndCookie(app) {
  const res = await request(app).get('/form');
  const cookie = csrfCookieFrom(res).split(';')[0];
  return { token: res.body.token, cookie };
}

describe('CSRF protection (EJS dashboard)', () => {
  it('issues an httpOnly, SameSite=Strict, signed token cookie', async () => {
    const res = await request(buildApp()).get('/form');
    const cookie = csrfCookieFrom(res);
    expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    // signed cookies are serialised as "s:<value>.<signature>"
    expect(decodeURIComponent(cookie)).toContain(`s:${res.body.token}.`);
  });

  it('reuses the same token while the cookie is valid', async () => {
    const app = buildApp();
    const { token, cookie } = await getTokenAndCookie(app);
    const again = await request(app).get('/form').set('Cookie', cookie);
    expect(again.body.token).toBe(token);
    expect(csrfCookieFrom(again)).toBeUndefined();
  });

  it('accepts a POST whose _csrf field matches the cookie', async () => {
    const app = buildApp();
    const { token, cookie } = await getTokenAndCookie(app);
    const res = await request(app).post('/action').set('Cookie', cookie).type('form').send({ _csrf: token });
    expect(res.status).toBe(200);
  });

  it('rejects a POST without token (cross-site form)', async () => {
    const app = buildApp();
    const { cookie } = await getTokenAndCookie(app);
    const res = await request(app).post('/action').set('Cookie', cookie).type('form').send({});
    expect(res.status).toBe(403);
    expect(res.text).toContain('Please try again');
    // the re-rendered login form carries a usable token
    expect(res.text).toMatch(/name="_csrf" value="[0-9a-f]{64}"/);
  });

  it('rejects a wrong token', async () => {
    const app = buildApp();
    const { cookie } = await getTokenAndCookie(app);
    const res = await request(app).post('/action').set('Cookie', cookie).type('form').send({ _csrf: 'a'.repeat(64) });
    expect(res.status).toBe(403);
  });

  it('rejects an unsigned (injected) cookie even if the field matches', async () => {
    const forged = 'b'.repeat(64);
    const res = await request(buildApp())
      .post('/action')
      .set('Cookie', `${CSRF_COOKIE}=${forged}`)
      .type('form')
      .send({ _csrf: forged });
    expect(res.status).toBe(403);
  });
});
