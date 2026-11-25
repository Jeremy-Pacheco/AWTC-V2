// DB_SSL_CA parsing: certificates pasted into hosting panels (Render, etc.)
const { describe, it, expect } = require('@jest/globals');
const { normalizePem } = require('../config/sequelize.config');

// Certificate-shaped sample (only its base64 body matters here)
const PEM = `-----BEGIN CERTIFICATE-----
MIIBtjCCAVugAwIBAgIUUZ9i0rU8m5vV0bqX3yN7oV7oQb8wCgYIKoZIzj0EAwIw
EjEQMA4GA1UEAwwHdGVzdC1jYTAeFw0yNjAxMDEwMDAwMDBaFw0zNjAxMDEwMDAw
MDBaMBIxEDAOBgNVBAMMB3Rlc3QtY2EwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNC
AARZ0b8iQ0e8r7m1w0v6x2nH7wq9f4mVt3xg9Yk1Q5n6d0c3XWm2hTzvWJ4qk8lP
d2Bq0eVb9m2r3W0g6uB8E1Cro1MwUTAdBgNVHQ4EFgQU8Yw2Gx8q2sVv6KxWm3nK
0H7aG1MwHwYDVR0jBBgwFoAU8Yw2Gx8q2sVv6KxWm3nK0H7aG1MwDwYDVR0TAQH/
BAUwAwEB/zAKBggqhkjOPQQDAgNJADBGAiEAvYq0o3m6xQ1Y4Ww9E0t9W8x5o2b4
nT0b2qkqA4Jx0lECIQDy4sQb0q9w0b5n6m7x8y9z0a1b2c3d4e5f6g7h8i9j0k1l
-----END CERTIFICATE-----`;

const body = (pem) => pem.split('\n').filter((l) => !l.startsWith('-----')).join('');

describe('normalizePem', () => {
  it('keeps a correct PEM', () => {
    expect(body(normalizePem(PEM))).toBe(body(PEM));
  });

  it('repairs newlines turned into spaces, literal \n and a single long line', () => {
    const variants = [
      PEM.replace(/\n/g, ' '),
      PEM.replace(/\n/g, '\n'),
      `-----BEGIN CERTIFICATE-----${body(PEM)}-----END CERTIFICATE-----`,
      `  "${PEM.replace(/\n/g, '\r\n')}"  `,
    ];
    for (const value of variants) {
      const pem = normalizePem(value);
      expect(pem.startsWith('-----BEGIN CERTIFICATE-----\n')).toBe(true);
      expect(pem.trim().endsWith('\n-----END CERTIFICATE-----')).toBe(true);
      expect(body(pem)).toBe(body(PEM));
      expect(pem.split('\n').every((l) => l.length <= 64)).toBe(true);
    }
  });

  it('keeps every certificate of a chain', () => {
    expect(normalizePem(`${PEM}\n${PEM}`).match(/BEGIN CERTIFICATE/g)).toHaveLength(2);
  });

  it('returns null when there is no certificate (e.g. a pasted URI)', () => {
    expect(normalizePem('mysql://user:pass@host:1234/db')).toBeNull();
  });

});
