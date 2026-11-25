// Dashboard session hardening: session fixation (SEC-15) and persistent store (SEC-16)
const { describe, it, expect, beforeEach, afterAll } = require('@jest/globals');

jest.mock('../services/auth.service', () => ({ authenticate: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const session = require('express-session');
const { Sequelize } = require('sequelize');
const authService = require('../services/auth.service');
const sessionController = require('../controllers/session.controller');
const { createSessionStore, getSessionStoreKind } = require('../config/session-store');

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.SESSION_STORE;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('Session store selection', () => {
  it('uses the database store by default in production and memory otherwise', () => {
    process.env.NODE_ENV = 'production';
    expect(getSessionStoreKind()).toBe('database');
    process.env.NODE_ENV = 'development';
    expect(getSessionStoreKind()).toBe('memory');
  });

  it('respects SESSION_STORE and rejects unknown values', () => {
    process.env.SESSION_STORE = 'DATABASE';
    expect(getSessionStoreKind()).toBe('database');
    process.env.SESSION_STORE = 'redis';
    expect(() => getSessionStoreKind()).toThrow(/Invalid SESSION_STORE/);
  });

  it('returns undefined (MemoryStore) for memory', () => {
    process.env.SESSION_STORE = 'memory';
    expect(createSessionStore(session, null)).toBeUndefined();
  });

  it('creates a Sequelize-backed store on the Sessions table for database', () => {
    process.env.SESSION_STORE = 'database';
    // No connection is opened: defining the model is enough for this check
    const sequelize = new Sequelize('db', 'user', 'pass', { dialect: 'mysql', logging: false });
    const store = createSessionStore(session, sequelize);
    try {
      expect(store).toBeInstanceOf(session.Store);
      expect(store.sessionModel.getTableName()).toBe('Sessions');
    } finally {
      store.stopExpiringSessions();
    }
  });
});

describe('Dashboard login (session fixation)', () => {
  function buildReq() {
    const oldSession = { id: 'attacker-planted-id' };
    const req = {
      body: { email: 'demo-admin@example.com', password: 'correct-password' },
      session: oldSession,
    };
    // Mimics express-session: regenerate() replaces req.session with a new object
    oldSession.regenerate = jest.fn((cb) => {
      req.session = { id: 'fresh-id' };
      cb();
    });
    return { req, oldSession };
  }

  const buildRes = () => ({ redirect: jest.fn(), render: jest.fn() });

  it('regenerates the session id and stores the user only in the new session', async () => {
    authService.authenticate.mockResolvedValue({ id: 7, role: 'admin' });
    const { req, oldSession } = buildReq();
    const res = buildRes();

    await sessionController.login(req, res);

    expect(oldSession.regenerate).toHaveBeenCalledTimes(1);
    expect(req.session.id).toBe('fresh-id');
    expect(req.session.userId).toBe(7);
    expect(oldSession.userId).toBeUndefined();
    expect(res.redirect).toHaveBeenCalledWith('/');
  });

  it('does not touch the session when the credentials are wrong', async () => {
    authService.authenticate.mockResolvedValue(null);
    const { req, oldSession } = buildReq();
    const res = buildRes();

    await sessionController.login(req, res);

    expect(oldSession.regenerate).not.toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('login', expect.objectContaining({ error: 'Invalid credentials' }));
  });

  it('shows a generic error if the session cannot be regenerated', async () => {
    authService.authenticate.mockResolvedValue({ id: 7, role: 'admin' });
    const { req } = buildReq();
    req.session.regenerate = jest.fn((cb) => cb(new Error('store down')));
    const res = buildRes();

    await sessionController.login(req, res);

    expect(req.session.userId).toBeUndefined();
    expect(res.redirect).not.toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('login', expect.objectContaining({ error: 'Unexpected error during login' }));
  });
});
