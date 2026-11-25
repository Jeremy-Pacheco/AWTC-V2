// LDAP <-> database consistency when creating and deleting users (BUG-04, BUG-05)
const { describe, it, expect, beforeEach, afterAll } = require('@jest/globals');

const mockTransaction = jest.fn();
jest.mock('../models', () => ({
  User: {
    build: jest.fn(),
    findByPk: jest.fn(),
    sequelize: { transaction: (...args) => mockTransaction(...args) },
  },
}));
jest.mock('../utils/ldap.util', () => ({
  addUser: jest.fn(),
  deleteUser: jest.fn(),
  authenticate: jest.fn(),
  LDAP_ENTRY_ALREADY_EXISTS: 68,
}));

const { User } = require('../models');
const ldapUtil = require('../utils/ldap.util');
const authService = require('../services/auth.service');

const ORIGINAL_ENV = { ...process.env };
const NEW_USER = { name: 'Noa Martin', email: 'noa.martin@example.com', password: 'river-lantern-42' };

function fakeUser(overrides = {}) {
  return {
    id: 11,
    email: NEW_USER.email,
    validate: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  process.env = { ...ORIGINAL_ENV, AUTH_PROVIDER: 'ldap' };
  ldapUtil.addUser.mockResolvedValue(undefined);
  ldapUtil.deleteUser.mockResolvedValue(undefined);
  // Runs the callback like Sequelize: rejects (rolls back) if it throws
  mockTransaction.mockImplementation(async (cb) => cb({ id: 'tx' }));
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
  jest.restoreAllMocks();
});

describe('Registration with LDAP (BUG-04)', () => {
  it('validates, creates the LDAP entry and then the DB row', async () => {
    const user = fakeUser();
    User.build.mockReturnValue(user);
    User.findByPk.mockResolvedValue({ id: 11 });

    await authService.registerUser(NEW_USER);

    expect(user.validate).toHaveBeenCalled();
    expect(ldapUtil.addUser).toHaveBeenCalledWith(NEW_USER.name, NEW_USER.email, NEW_USER.password);
    expect(user.save).toHaveBeenCalled();
    expect(ldapUtil.deleteUser).not.toHaveBeenCalled();
  });

  it('does not touch LDAP when the DB validation fails', async () => {
    const user = fakeUser({ validate: jest.fn().mockRejectedValue(Object.assign(new Error('bad'), { name: 'SequelizeValidationError' })) });
    User.build.mockReturnValue(user);

    await expect(authService.registerUser(NEW_USER)).rejects.toThrow('bad');
    expect(ldapUtil.addUser).not.toHaveBeenCalled();
  });

  it('removes the LDAP entry again if saving the DB row fails (compensation)', async () => {
    const user = fakeUser({ save: jest.fn().mockRejectedValue(new Error('duplicate email')) });
    User.build.mockReturnValue(user);

    await expect(authService.registerUser(NEW_USER)).rejects.toThrow('duplicate email');
    expect(ldapUtil.deleteUser).toHaveBeenCalledWith(NEW_USER.email);
  });

  it('reports the original DB error even if the LDAP cleanup also fails', async () => {
    const user = fakeUser({ save: jest.fn().mockRejectedValue(new Error('db down')) });
    User.build.mockReturnValue(user);
    ldapUtil.deleteUser.mockRejectedValue(new Error('ldap down'));

    await expect(authService.registerUser(NEW_USER)).rejects.toThrow('db down');
  });

  it('answers 400 (not 500) for an existing directory entry and never overwrites it', async () => {
    User.build.mockReturnValue(fakeUser());
    ldapUtil.addUser.mockRejectedValue(Object.assign(new Error('Entry Already Exists'), { code: 68 }));

    await expect(authService.registerUser(NEW_USER)).rejects.toMatchObject({ status: 400, message: 'Email is already registered' });
    expect(ldapUtil.deleteUser).not.toHaveBeenCalled();
  });
});

describe('Deletion with LDAP (BUG-05)', () => {
  it('deletes the DB row and the LDAP entry in one transaction', async () => {
    const user = fakeUser();
    await authService.deleteUser(user);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(user.destroy).toHaveBeenCalledWith({ transaction: { id: 'tx' } });
    expect(ldapUtil.deleteUser).toHaveBeenCalledWith(NEW_USER.email);
  });

  it('fails (so the transaction rolls back) when LDAP cannot delete the entry', async () => {
    const user = fakeUser();
    ldapUtil.deleteUser.mockRejectedValue(new Error('ldap unreachable'));

    await expect(authService.deleteUser(user)).rejects.toThrow('ldap unreachable');
  });

  it('only deletes the DB row with the local provider', async () => {
    process.env.AUTH_PROVIDER = 'local';
    const user = fakeUser();
    await authService.deleteUser(user);

    expect(user.destroy).toHaveBeenCalledWith();
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(ldapUtil.deleteUser).not.toHaveBeenCalled();
  });
});
