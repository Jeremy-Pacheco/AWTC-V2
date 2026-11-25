// HTTP security headers and CSP (SEC-23)
const { describe, it, expect, beforeEach, afterAll } = require('@jest/globals');
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const { cspNonce, securityHeaders, buildCspDirectives } = require('../config/security-headers');

const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.CSP_REPORT_ONLY;
  delete process.env.CSP_CONNECT_SRC;
});
afterAll(() => { process.env = ORIGINAL_ENV; });

function buildApp({ httpsOnly = false } = {}) {
  const app = express();
  app.use(cspNonce);
  app.use(securityHeaders({ httpsOnly }));
  app.get('/', (req, res) => res.send(`<script nonce="${res.locals.cspNonce}">1</script>`));
  return app;
}

const directive = (csp, name) => (csp.split(';').find((d) => d.trim().startsWith(`${name} `)) || '').trim();

describe('Security headers', () => {
  it('sends a CSP whose script nonce matches the page and changes per request', async () => {
    const app = buildApp();
    const a = await request(app).get('/');
    const b = await request(app).get('/');
    const csp = a.headers['content-security-policy'];
    const nonce = /'nonce-([^']+)'/.exec(directive(csp, 'script-src'))[1];

    expect(a.text).toContain(`nonce="${nonce}"`);
    expect(b.headers['content-security-policy']).not.toContain(nonce);
    expect(directive(csp, 'script-src')).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(directive(csp, 'script-src-attr')).toBe("script-src-attr 'none'");
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
  });

  it('removes X-Powered-By and sets the other protective headers', async () => {
    const res = await request(buildApp()).get('/');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    // images are embedded by the SPA from another origin (Vercel)
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('only sends HSTS and upgrade-insecure-requests on HTTPS deployments', async () => {
    const http = await request(buildApp({ httpsOnly: false })).get('/');
    expect(http.headers['strict-transport-security']).toBeUndefined();
    expect(http.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');

    const https = await request(buildApp({ httpsOnly: true })).get('/');
    expect(https.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(https.headers['content-security-policy']).toContain('upgrade-insecure-requests');
  });

  it('supports report-only mode to try the policy without blocking', async () => {
    process.env.CSP_REPORT_ONLY = 'true';
    const res = await request(buildApp({ httpsOnly: true })).get('/');
    expect(res.headers['content-security-policy']).toBeUndefined();
    expect(res.headers['content-security-policy-report-only']).toBeDefined();
  });

  it('accepts only well-formed extra origins in CSP_CONNECT_SRC', () => {
    process.env.CSP_CONNECT_SRC = "https://api.example.com, wss://api.example.com, javascript:alert(1), https://x.com' 'unsafe-eval";
    expect(buildCspDirectives({}).connectSrc).toEqual(["'self'", 'https://api.example.com', 'wss://api.example.com']);
  });
});

describe('EJS views are CSP compatible', () => {
  const viewsDir = path.join(__dirname, '..', 'views');
  const views = fs.readdirSync(viewsDir).filter((f) => f.endsWith('.ejs'));

  it.each(views)('%s has no inline event handlers', (file) => {
    const html = fs.readFileSync(path.join(viewsDir, file), 'utf8');
    expect(html).not.toMatch(/\son[a-z]+\s*=\s*["']/i);
  });

  it.each(views)('%s gives every inline executable <script> the nonce', (file) => {
    const html = fs.readFileSync(path.join(viewsDir, file), 'utf8');
    // An opening tag may contain EJS expressions ("<%= ... %>") with their own ">"
    const tags = html.match(/<script\b(?:<%[\s\S]*?%>|[^>])*>/gi) || [];
    for (const tag of tags) {
      const external = /\ssrc=/.test(tag);
      const dataBlock = /type="application\/json"/.test(tag);
      if (!external && !dataBlock) expect(tag).toContain('nonce="<%= cspNonce %>"');
      if (external) expect(tag).not.toMatch(/src="https?:\/\//); // no third-party scripts
    }
  });
});
