// Short access tokens + rotating httpOnly refresh cookie (SEC-18)
const { describe, it, expect, beforeEach, afterAll } = require('@jest/globals');
const jwt = require('jsonwebtoken');
const { api, db, resetDatabase, closeDatabase } = require('./helpers');
const { hashToken, REUSE_GRACE_MS } = require('../../services/token.service');

const PASSWORD = 'river-lantern-42';
const AJAX = { 'X-Requested-With': 'awtc' };

/** "awtc.rt=<value>" from a response, plus the raw Set-Cookie header */
function refreshCookie(res) {
  const header = (res.headers['set-cookie'] || []).find((c) => c.startsWith('awtc.rt='));
  if (!header) return { header: undefined, pair: undefined, value: undefined };
  const pair = header.split(';')[0];
  return { header, pair, value: decodeURIComponent(pair.slice('awtc.rt='.length)) };
}

async function signup(email = 'ana@test.example.com') {
  const res = await api().post('/api/users/signup').send({ name: 'Ana Ruiz', email, password: PASSWORD });
  expect(res.status).toBe(201);
  return res;
}

const refresh = (cookiePair, headers = AJAX) => {
  let req = api().post('/api/auth/refresh').set(headers);
  if (cookiePair) req = req.set('Cookie', cookiePair);
  return req;
};

beforeEach(resetDatabase);
afterAll(closeDatabase);

describe('Issuing tokens', () => {
  it('returns a 15-minute access token and an httpOnly refresh cookie scoped to /api/auth', async () => {
    const res = await signup();
    const payload = jwt.decode(res.body.access_token);
    expect(payload.exp - payload.iat).toBe(15 * 60);

    const { header, value } = refreshCookie(res);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/Path=\/api\/auth/);
    expect(header).toMatch(/SameSite=Lax/i);

    // Only the hash is stored
    const stored = await db.RefreshToken.findOne({ where: { tokenHash: hashToken(value) } });
    expect(stored).not.toBeNull();
    expect(await db.RefreshToken.count({ where: { tokenHash: value } })).toBe(0);
  });

  it('also starts a session on login', async () => {
    await signup();
    const basic = `Basic ${Buffer.from(`ana@test.example.com:${PASSWORD}`).toString('base64')}`;
    const res = await api().post('/api/users/login').set('Authorization', basic);
    expect(res.status).toBe(200);
    expect(refreshCookie(res).value).toEqual(expect.any(String));
  });
});

describe('Refreshing', () => {
  it('rotates the cookie and returns a new access token that works', async () => {
    const first = refreshCookie(await signup());
    const res = await refresh(first.pair);
    expect(res.status).toBe(200);

    const second = refreshCookie(res);
    expect(second.value).toEqual(expect.any(String));
    expect(second.value).not.toBe(first.value);

    const profile = await api().get('/api/users/dashboard').set('Authorization', `Bearer ${res.body.access_token}`);
    expect(profile.status).toBe(200);
    expect(profile.body.user.email).toBe('ana@test.example.com');
  });

  it('requires the X-Requested-With header (CSRF) and the cookie', async () => {
    const { pair } = refreshCookie(await signup());
    expect((await refresh(pair, {})).status).toBe(403);
    expect((await refresh(undefined)).status).toBe(401);
    expect((await refresh('awtc.rt=forged-value-that-does-not-exist')).status).toBe(401);
  });

  it('detects reuse of a rotated token and revokes the whole login', async () => {
    const first = refreshCookie(await signup());
    const second = refreshCookie(await refresh(first.pair));

    // Pretend the first token was rotated long ago (outside the grace window)
    await db.RefreshToken.update(
      { revokedAt: new Date(Date.now() - REUSE_GRACE_MS - 1000) },
      { where: { tokenHash: hashToken(first.value) } }
    );

    expect((await refresh(first.pair)).status).toBe(401); // replay by an attacker
    expect((await refresh(second.pair)).status).toBe(401); // the legitimate one is revoked too
  });

  it('does not end the login when two tabs refresh at the same time', async () => {
    const first = refreshCookie(await signup());
    const second = refreshCookie(await refresh(first.pair));
    const parallel = await refresh(first.pair); // same old cookie, a moment later
    expect(parallel.status).toBe(401);
    expect(parallel.body.message).toMatch(/retry/i);
    expect((await refresh(second.pair)).status).toBe(200); // the session is still alive
  });

  it('refuses expired refresh tokens', async () => {
    const { pair, value } = refreshCookie(await signup());
    await db.RefreshToken.update({ expiresAt: new Date(Date.now() - 1000) }, { where: { tokenHash: hashToken(value) } });
    expect((await refresh(pair)).status).toBe(401);
  });
});

describe('Logging out', () => {
  it('revokes the refresh token on the server and clears the cookie', async () => {
    const { pair } = refreshCookie(await signup());
    const res = await api().post('/api/auth/logout').set(AJAX).set('Cookie', pair);
    expect(res.status).toBe(204);
    expect(refreshCookie(res).header).toMatch(/awtc\.rt=;/);
    expect((await refresh(pair)).status).toBe(401);
  });

  it('removes the tokens of a deleted user', async () => {
    const res = await signup();
    const user = await db.User.findOne({ where: { email: 'ana@test.example.com' } });
    await user.destroy();
    expect(await db.RefreshToken.count({ where: { userId: user.id } })).toBe(0);
    expect((await refresh(refreshCookie(res).pair)).status).toBe(401);
  });
});
