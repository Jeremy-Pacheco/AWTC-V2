// CORS: allowed origins + the server's own origin
const { describe, it, expect, beforeEach, afterAll } = require('@jest/globals');
const express = require('express');
const cors = require('cors');
const request = require('supertest');
const { corsOptionsDelegate } = require('../config/cors');
const { errorHandler } = require('../middlewares/errorHandler.middlewares');

const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, CORS_ORIGINS: 'https://awtc-demo.vercel.app' };
  delete process.env.FRONTEND_URL;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
  jest.restoreAllMocks();
});

function buildApp({ trustProxy = false } = {}) {
  const app = express();
  if (trustProxy) app.set('trust proxy', 1);
  app.use(cors(corsOptionsDelegate({ credentials: true, optionsSuccessStatus: 204 })));
  app.get('/asset.js', (req, res) => res.type('js').send('ok'));
  app.use(errorHandler);
  return app;
}

describe('CORS', () => {
  it('allows requests without Origin (curl, same-origin navigation)', async () => {
    const res = await request(buildApp()).get('/asset.js');
    expect(res.status).toBe(200);
  });

  it('allows configured origins and echoes them with credentials', async () => {
    const res = await request(buildApp()).get('/asset.js').set('Origin', 'https://awtc-demo.vercel.app');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://awtc-demo.vercel.app');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it("allows the server's own origin even if it is not in CORS_ORIGINS", async () => {
    const res = await request(buildApp())
      .get('/asset.js')
      .set('Host', 'localhost:8080')
      .set('Origin', 'http://localhost:8080');
    expect(res.status).toBe(200);
  });

  it('uses X-Forwarded-Proto behind a trusted proxy (https site, http upstream)', async () => {
    const res = await request(buildApp({ trustProxy: true }))
      .get('/asset.js')
      .set('Host', 'awilltochange.me')
      .set('X-Forwarded-Proto', 'https')
      .set('Origin', 'https://awilltochange.me');
    expect(res.status).toBe(200);
  });

  it('still rejects other origins with 403, including look-alikes of the host', async () => {
    const app = buildApp();
    const evil = await request(app).get('/asset.js').set('Origin', 'https://evil.example');
    expect(evil.status).toBe(403);
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();

    const lookAlike = await request(app)
      .get('/asset.js')
      .set('Host', 'awilltochange.me')
      .set('Origin', 'http://awilltochange.me.evil.example');
    expect(lookAlike.status).toBe(403);

    // Without trusting the proxy, a forged X-Forwarded-Proto is ignored
    const forged = await request(app)
      .get('/asset.js')
      .set('Host', 'awilltochange.me')
      .set('X-Forwarded-Proto', 'https')
      .set('Origin', 'https://awilltochange.me');
    expect(forged.status).toBe(403);
  });
});
