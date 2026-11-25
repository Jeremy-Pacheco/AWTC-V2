// LDAP hardening (SEC-11 password hashing, SEC-19 DN injection) and password policy
const { describe, it, expect, beforeEach, afterAll } = require('@jest/globals');
const crypto = require('crypto');

jest.mock('../models', () => ({ User: {} }));

const ldapjs = require('ldapjs');
const ldapUtil = require('../utils/ldap.util');
const { validatePassword } = require('../services/auth.service');

const ORIGINAL_ENV = { ...process.env };
beforeEach(() => { process.env = { ...ORIGINAL_ENV }; delete process.env.LDAP_PASSWORD_HASH; });
afterAll(() => { process.env = ORIGINAL_ENV; });

describe('LDAP DN escaping (SEC-19)', () => {
  it('builds cn=<email> under ou=users', () => {
    expect(ldapUtil.buildUserDN('ana@example.com')).toBe(`cn=ana@example.com,${ldapUtil.LDAP_USERS_DN}`);
  });

  it('escapes DN metacharacters so they cannot add components', () => {
    const raw = 'x,ou=admins+cn=root\\@example.com';
    const dn = ldapUtil.buildUserDN(raw);
    const parsed = ldapjs.parseDN(dn);
    // Exactly one RDN more than the users branch (no injected components),
    // a single-valued cn (no injected "+cn=") and the raw value round-trips intact
    expect(parsed.length).toBe(ldapjs.parseDN(ldapUtil.LDAP_USERS_DN).length + 1);
    expect(parsed.rdnAt(0).size).toBe(1);
    expect(parsed.rdnAt(0).getValue('cn')).toBe(raw);
    expect(dn.endsWith(`,${ldapUtil.LDAP_USERS_DN}`)).toBe(true);
  });

  it('escapes every RFC 4514 special character, including backslash', () => {
    // Leading/trailing spaces are escaped too (checked below as text): ldapjs'
    // parser drops them even when escaped, and valid emails never contain them.
    const tricky = ['a\\2cou=admins@example.com', '#lead', 'q"<>;@x.com', 'nul\u0000x'];
    for (const value of tricky) {
      const dn = ldapjs.parseDN(ldapUtil.buildUserDN(value));
      expect(dn.rdnAt(0).getValue('cn')).toBe(value);
    }
    expect(ldapUtil.escapeDNValue('a\\b,c')).toBe('a\\5cb\\2cc');
    expect(ldapUtil.escapeDNValue(' x ')).toBe('\\20x\\20');
  });

  it('rejects implausible emails before contacting LDAP', async () => {
    expect(ldapUtil.isValidEmail('a,b@example.com')).toBe(false);
    expect(ldapUtil.isValidEmail('ana@example.com')).toBe(true);
    await expect(ldapUtil.authenticate('cn=admin,dc=awtc', 'x')).resolves.toBe(false);
    await expect(ldapUtil.addUser('Ana', 'not-an-email', 'whatever123')).rejects.toMatchObject({ status: 400 });
  });

  it('never sends an empty password (unauthenticated bind)', async () => {
    await expect(ldapUtil.authenticate('ana@example.com', '')).resolves.toBe(false);
  });
});

describe('LDAP password storage (SEC-11)', () => {
  it('produces a verifiable OpenLDAP {SSHA} hash with a random salt', () => {
    const hash = ldapUtil.hashPasswordSSHA('Correct horse battery');
    expect(hash).toMatch(/^\{SSHA\}[A-Za-z0-9+/]+=*$/);
    const raw = Buffer.from(hash.slice(6), 'base64');
    const digest = raw.subarray(0, 20);
    const salt = raw.subarray(20);
    expect(salt.length).toBe(16);
    const expected = crypto.createHash('sha1').update('Correct horse battery').update(salt).digest();
    expect(digest.equals(expected)).toBe(true);
    expect(ldapUtil.hashPasswordSSHA('Correct horse battery')).not.toBe(hash);
  });

  it('stores the hash, never the clear text, by default', () => {
    const entry = ldapUtil.buildUserEntry('Ana', 'ana@example.com', 'Correct horse battery');
    expect(entry.userPassword.startsWith('{SSHA}')).toBe(true);
    expect(entry.userPassword).not.toContain('Correct horse battery');
  });

  it('only sends clear text when the server is configured to hash it', () => {
    process.env.LDAP_PASSWORD_HASH = 'server';
    expect(ldapUtil.buildUserEntry('Ana', 'ana@example.com', 'Correct horse battery').userPassword).toBe('Correct horse battery');
    process.env.LDAP_PASSWORD_HASH = 'plain';
    expect(() => ldapUtil.getPasswordHashMode()).toThrow(/Invalid LDAP_PASSWORD_HASH/);
  });
});

describe('Password policy', () => {
  const ctx = { email: 'maria.lopez@example.com', name: 'Maria Lopez' };

  it('accepts a reasonable passphrase', () => {
    expect(validatePassword('river-lantern-42', ctx)).toBeNull();
  });

  it('enforces length limits', () => {
    expect(validatePassword('short1', ctx)).toMatch(/at least 8/);
    expect(validatePassword('ñ'.repeat(40), ctx)).toMatch(/at most 72 bytes/);
  });

  it('rejects common and trivially repeated passwords', () => {
    expect(validatePassword('password123', ctx)).toMatch(/too common/);
    expect(validatePassword('Contraseña123', ctx)).toMatch(/too common/);
    expect(validatePassword('aaaaaaaaaa', ctx)).toMatch(/too common/);
  });

  it('rejects passwords containing the user name or email', () => {
    expect(validatePassword('Maria.lopez2025', ctx)).toMatch(/name or email/);
    expect(validatePassword('xxlopezxx99', ctx)).toMatch(/name or email/);
  });
});
