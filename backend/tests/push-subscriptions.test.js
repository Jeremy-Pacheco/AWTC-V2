// Push subscriptions: allowed push services (SEC-20) and no takeover (SEC-21)
const { describe, it, expect, beforeEach, afterAll } = require('@jest/globals');

jest.mock('web-push', () => ({ setVapidDetails: jest.fn(), sendNotification: jest.fn() }));
jest.mock('../models', () => ({
  Subscription: { findOne: jest.fn(), create: jest.fn(), findAll: jest.fn() },
}));

const webPush = require('web-push');
const { Subscription } = require('../models');
const { isAllowedPushEndpoint, sameKeys, endpointHost } = require('../services/push.service');
const controller = require('../controllers/subscription.controller');
const schemas = require('../validation/schemas');

const KEYS = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };
const FCM = 'https://fcm.googleapis.com/fcm/send/abc123';
const ORIGINAL_ENV = { ...process.env };

const mockRes = () => {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.data = data; return res; };
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  process.env = { ...ORIGINAL_ENV };
  delete process.env.PUSH_ALLOWED_HOSTS;
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
  jest.restoreAllMocks();
});

describe('Allowed push endpoints (SEC-20)', () => {
  it.each([
    FCM,
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
    'https://web.push.apple.com/QGuQyavXutnMH',
    'https://wns2-db5p.notify.windows.com/w/?token=BQYAAAB',
  ])('accepts %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    'https://evil.example/collect',
    'https://fcm.googleapis.com.evil.example/x',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost/admin',
    'http://fcm.googleapis.com/fcm/send/x',
    'https://fcm.googleapis.com:8443/x',
    'https://user:pass@fcm.googleapis.com/x',
    'https://push.apple.com/x', // wildcard needs a subdomain
    'not a url',
  ])('rejects %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });

  it('supports extra hosts from PUSH_ALLOWED_HOSTS', () => {
    process.env.PUSH_ALLOWED_HOSTS = 'push.example.org, *.push.example.net';
    expect(isAllowedPushEndpoint('https://push.example.org/x')).toBe(true);
    expect(isAllowedPushEndpoint('https://eu.push.example.net/x')).toBe(true);
    expect(isAllowedPushEndpoint('https://example.net/x')).toBe(false);
  });

  it('is enforced by the subscribe schema and rounds expirationTime', () => {
    expect(schemas.subscribe.safeParse({ endpoint: 'https://evil.example/x', keys: KEYS }).success).toBe(false);
    expect(schemas.subscribe.parse({ endpoint: FCM, keys: KEYS, expirationTime: 1764000000000.7 }).expirationTime).toBe(1764000000001);
  });

  it('logs only the host of an endpoint', () => {
    expect(endpointHost(FCM)).toBe('fcm.googleapis.com');
  });
});

describe('Subscribing (SEC-21)', () => {
  const req = (userId, keys = KEYS) => ({ user: { id: userId }, body: { endpoint: FCM, keys, expirationTime: null } });

  it('creates a new subscription and does not echo the keys', async () => {
    Subscription.findOne.mockResolvedValue(null);
    Subscription.create.mockResolvedValue({ id: 5, keys: JSON.stringify(KEYS) });
    const res = mockRes();

    await controller.subscribe(req(1), res);

    expect(res.statusCode).toBe(201);
    expect(res.data.subscription).toEqual({ id: 5 });
  });

  it('refuses to move an endpoint to another account with only the URL', async () => {
    const existing = { id: 5, userId: 1, keys: JSON.stringify(KEYS), save: jest.fn() };
    Subscription.findOne.mockResolvedValue(existing);
    const res = mockRes();

    await controller.subscribe(req(2, { p256dh: 'attacker-key', auth: 'attacker-auth' }), res);

    expect(res.statusCode).toBe(409);
    expect(existing.userId).toBe(1);
    expect(existing.save).not.toHaveBeenCalled();
  });

  it('moves it when the same browser (same keys) is used by another account', async () => {
    const existing = { id: 5, userId: 1, keys: JSON.stringify(KEYS), save: jest.fn() };
    Subscription.findOne.mockResolvedValue(existing);
    const res = mockRes();

    await controller.subscribe(req(2), res);

    expect(res.statusCode).toBe(200);
    expect(existing.userId).toBe(2);
    expect(existing.save).toHaveBeenCalled();
  });

  it('lets the owner refresh the keys of their own subscription', async () => {
    const existing = { id: 5, userId: 1, keys: JSON.stringify({ p256dh: 'old', auth: 'old' }), save: jest.fn() };
    Subscription.findOne.mockResolvedValue(existing);
    const res = mockRes();

    await controller.subscribe(req(1), res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(existing.keys)).toEqual(KEYS);
  });

  it('compares keys safely', () => {
    expect(sameKeys(JSON.stringify(KEYS), KEYS)).toBe(true);
    expect(sameKeys('not json', KEYS)).toBe(false);
    expect(sameKeys(JSON.stringify(KEYS), { p256dh: KEYS.p256dh })).toBe(false);
  });
});

describe('Sending notifications', () => {
  it('never calls endpoints outside the allowlist and deletes them', async () => {
    const bad = { endpoint: 'https://169.254.169.254/latest', keys: JSON.stringify(KEYS), destroy: jest.fn() };
    const good = { endpoint: FCM, keys: JSON.stringify(KEYS), destroy: jest.fn() };
    Subscription.findAll.mockResolvedValue([bad, good]);
    webPush.sendNotification.mockResolvedValue({});

    const result = await controller.sendNotificationToUser(1, { title: 'Hi' });

    expect(webPush.sendNotification).toHaveBeenCalledTimes(1);
    expect(webPush.sendNotification.mock.calls[0][0].endpoint).toBe(FCM);
    expect(bad.destroy).toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, sent: 1, failed: 1 });
  });

  it('removes subscriptions the push service reports as gone (404/410)', async () => {
    const gone = { endpoint: FCM, keys: JSON.stringify(KEYS), destroy: jest.fn() };
    Subscription.findAll.mockResolvedValue([gone]);
    webPush.sendNotification.mockRejectedValue(Object.assign(new Error('Not Found'), { statusCode: 404 }));

    await controller.sendNotificationToUser(1, { title: 'Hi' });

    expect(gone.destroy).toHaveBeenCalled();
  });
});
