// Demo mode tests - service, protections and demo login (no database needed)
const { describe, it, expect, beforeEach, afterAll } = require('@jest/globals');

jest.mock('../models', () => ({
  User: { findByPk: jest.fn(), findOne: jest.fn() },
}));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const demo = require('../services/demo.service');
const demoMw = require('../middlewares/demo.middlewares');
const demoCtrl = require('../controllers/demo.controller');

const ORIGINAL_ENV = { ...process.env };

const mockResponse = () => {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.data = data; return res; };
  res.send = (data) => { res.data = data; return res; };
  return res;
};

const runMiddleware = async (mw, req) => {
  const res = mockResponse();
  let nextCalled = false;
  await mw(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV, JWT_SECRET: 'test-only-jwt-secret-value' };
  delete process.env.DEMO_MODE;
  delete process.env.DEMO_MAX_UPLOAD_MB;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('Demo service', () => {
  it('is disabled unless DEMO_MODE=true', () => {
    expect(demo.isDemoMode()).toBe(false);
    process.env.DEMO_MODE = 'false';
    expect(demo.isDemoMode()).toBe(false);
    process.env.DEMO_MODE = 'TRUE';
    expect(demo.isDemoMode()).toBe(true);
  });

  it('defines one demo account per role on the reserved example.com domain', () => {
    expect(demo.DEMO_ACCOUNTS.map((a) => a.role).sort()).toEqual(['admin', 'coordinator', 'volunteer']);
    demo.DEMO_ACCOUNTS.forEach((a) => expect(a.email).toMatch(/@example\.com$/));
  });

  it('recognises demo accounts by user object or email (case-insensitive)', () => {
    expect(demo.isDemoAccount({ email: 'demo-admin@example.com' })).toBe(true);
    expect(demo.isDemoAccount('DEMO-VOLUNTEER@example.com')).toBe(true);
    expect(demo.isDemoAccount({ email: 'someone@example.com' })).toBe(false);
    expect(demo.isDemoAccount(null)).toBe(false);
  });

  it('only accepts known roles', () => {
    expect(demo.findDemoAccount('admin').email).toBe('demo-admin@example.com');
    expect(demo.findDemoAccount('superadmin')).toBeNull();
    expect(demo.findDemoAccount(undefined)).toBeNull();
  });

  it('uses a smaller upload limit in demo mode, capped at the normal limit', () => {
    expect(demo.getMaxUploadMb()).toBe(5);
    process.env.DEMO_MODE = 'true';
    expect(demo.getMaxUploadMb()).toBe(1);
    process.env.DEMO_MAX_UPLOAD_MB = '2';
    expect(demo.getMaxUploadMb()).toBe(2);
    process.env.DEMO_MAX_UPLOAD_MB = '50';
    expect(demo.getMaxUploadMb()).toBe(1);
  });

  it('public config never exposes emails or passwords', () => {
    expect(demo.getPublicConfig()).toEqual({ enabled: false });
    process.env.DEMO_MODE = 'true';
    process.env.DEMO_PASSWORD = 'should-not-leak';
    const json = JSON.stringify(demo.getPublicConfig());
    expect(json).not.toMatch(/@/);
    expect(json).not.toMatch(/should-not-leak/);
  });
});

describe('Demo protections', () => {
  it('protectDemoTarget blocks role change / deletion of demo accounts', async () => {
    process.env.DEMO_MODE = 'true';
    User.findByPk.mockResolvedValue({ id: 3, email: 'demo-admin@example.com' });
    const { res, nextCalled } = await runMiddleware(demoMw.protectDemoTarget, { params: { id: '3' } });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it('protectDemoTarget allows other users', async () => {
    process.env.DEMO_MODE = 'true';
    User.findByPk.mockResolvedValue({ id: 9, email: 'alex.rivera@example.com' });
    const { nextCalled } = await runMiddleware(demoMw.protectDemoTarget, { params: { id: '9' } });
    expect(nextCalled).toBe(true);
  });

  it('protectDemoTarget does nothing when demo mode is off', async () => {
    const { nextCalled } = await runMiddleware(demoMw.protectDemoTarget, { params: { id: '3' } });
    expect(nextCalled).toBe(true);
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it('protectDemoSelf blocks a demo account from deleting itself', async () => {
    process.env.DEMO_MODE = 'true';
    const blocked = await runMiddleware(demoMw.protectDemoSelf, { user: { email: 'demo-volunteer@example.com' } });
    expect(blocked.nextCalled).toBe(false);
    expect(blocked.res.statusCode).toBe(403);

    const allowed = await runMiddleware(demoMw.protectDemoSelf, { user: { email: 'noa.martin@example.com' } });
    expect(allowed.nextCalled).toBe(true);
  });

  it('requireDemoMode hides demo routes when disabled', async () => {
    const off = await runMiddleware(demoMw.requireDemoMode, {});
    expect(off.nextCalled).toBe(false);
    expect(off.res.statusCode).toBe(404);

    process.env.DEMO_MODE = 'true';
    const on = await runMiddleware(demoMw.requireDemoMode, {});
    expect(on.nextCalled).toBe(true);
  });
});

describe('Demo login', () => {
  beforeEach(() => { process.env.DEMO_MODE = 'true'; });

  it('rejects unknown roles', async () => {
    const res = mockResponse();
    await demoCtrl.login({ body: { role: 'root' } }, res);
    expect(res.statusCode).toBe(400);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('returns 503 when the demo accounts have not been seeded', async () => {
    User.findOne.mockResolvedValue(null);
    const res = mockResponse();
    await demoCtrl.login({ body: { role: 'volunteer' } }, res);
    expect(res.statusCode).toBe(503);
  });

  it('returns a valid JWT for the requested demo account', async () => {
    User.findOne.mockResolvedValue({ id: 2, name: 'Demo Coordinator', email: 'demo-coordinator@example.com', role: 'coordinator' });
    const res = mockResponse();
    await demoCtrl.login({ body: { role: 'coordinator' } }, res);

    expect(User.findOne).toHaveBeenCalledWith({ where: { email: 'demo-coordinator@example.com' } });
    expect(res.data.user).toEqual({ id: 2, name: 'Demo Coordinator', email: 'demo-coordinator@example.com', role: 'coordinator' });
    const payload = jwt.verify(res.data.access_token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    expect(payload.id).toBe(2);
    expect(payload.role).toBe('coordinator');
  });

  it('EJS demo login returns 404 when demo mode is off', async () => {
    process.env.DEMO_MODE = 'false';
    const res = mockResponse();
    await demoCtrl.sessionLogin({ session: {} }, res);
    expect(res.statusCode).toBe(404);
  });

  it('EJS demo login regenerates the session and stores the admin id', async () => {
    User.findOne.mockResolvedValue({ id: 1, email: 'demo-admin@example.com', role: 'admin' });
    const session = { regenerate: jest.fn((cb) => cb()) };
    const req = { session, app: { locals: {} } };
    const res = mockResponse();
    res.redirect = jest.fn();
    await demoCtrl.sessionLogin(req, res);

    expect(session.regenerate).toHaveBeenCalled();
    expect(req.session.userId).toBe(1);
    expect(res.redirect).toHaveBeenCalledWith('/');
  });
});
