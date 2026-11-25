// Audit task 3.7: BUG-03 (Basic auth decoding) and BUG-06 (capacity race)
const { describe, it, expect, beforeEach } = require('@jest/globals');

const mockTx = { LOCK: { UPDATE: 'UPDATE' } };
jest.mock('../models', () => ({
  Project: { findByPk: jest.fn() },
  User: { findByPk: jest.fn() },
  UserProject: { findOne: jest.fn(), count: jest.fn(), create: jest.fn() },
  UserProjectBan: { findOne: jest.fn() },
  sequelize: { transaction: jest.fn((cb) => cb(mockTx)) },
}));
jest.mock('../config/socket', () => ({ getVolunteeringNS: jest.fn(() => ({ emit: jest.fn() })) }));
jest.mock('../controllers/subscription.controller', () => ({ sendNotificationToUser: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const db = require('../models');
const { parseBasicAuth } = require('../utils/basicAuth');
const controller = require('../controllers/project.controller');

const basic = (text) => `Basic ${Buffer.from(text, 'utf8').toString('base64')}`;

describe('Basic auth parsing (BUG-03)', () => {
  it('keeps non-ASCII characters', () => {
    expect(parseBasicAuth(basic('ana@example.com:contraseña-ñandú-😀'))).toEqual({
      email: 'ana@example.com', password: 'contraseña-ñandú-😀',
    });
  });

  it('splits on the first colon only, so passwords may contain ":"', () => {
    expect(parseBasicAuth(basic('ana@example.com:a:b:c'))).toEqual({ email: 'ana@example.com', password: 'a:b:c' });
  });

  it('rejects missing parts and other schemes', () => {
    expect(parseBasicAuth(basic('no-colon'))).toBeNull();
    expect(parseBasicAuth(basic(':password'))).toBeNull();
    expect(parseBasicAuth(basic('ana@example.com:'))).toBeNull();
    expect(parseBasicAuth('Bearer abc')).toBeNull();
    expect(parseBasicAuth(undefined)).toBeNull();
  });
});

describe('Enrolment with capacity (BUG-06)', () => {
  const enroll = controller._enrollVolunteer;

  beforeEach(() => {
    jest.clearAllMocks();
    db.UserProjectBan.findOne.mockResolvedValue(null);
    db.UserProject.findOne.mockResolvedValue(null);
    db.UserProject.create.mockResolvedValue({ id: 99 });
  });

  it('locks the project row inside a transaction and counts only accepted volunteers', async () => {
    db.Project.findByPk.mockResolvedValue({ id: 1, capacity: 10 });
    db.UserProject.count.mockResolvedValue(3);

    const result = await enroll(1, 7);

    expect(db.sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(db.Project.findByPk).toHaveBeenCalledWith(1, { transaction: mockTx, lock: 'UPDATE' });
    expect(db.UserProject.count).toHaveBeenCalledWith({ where: { projectId: 1, status: 'accepted' }, transaction: mockTx });
    expect(db.UserProject.create).toHaveBeenCalledWith({ userId: 7, projectId: 1, status: 'accepted' }, { transaction: mockTx });
    expect(result).toMatchObject({ status: 'created', enrolled: 4 });
  });

  it('refuses when the project is full', async () => {
    db.Project.findByPk.mockResolvedValue({ id: 1, capacity: 3 });
    db.UserProject.count.mockResolvedValue(3);

    await expect(enroll(1, 7)).resolves.toMatchObject({ status: 'full' });
    expect(db.UserProject.create).not.toHaveBeenCalled();
  });

  it('treats a project without capacity as unlimited (was always "full")', async () => {
    db.Project.findByPk.mockResolvedValue({ id: 1, capacity: null });
    db.UserProject.count.mockResolvedValue(250);

    await expect(enroll(1, 7)).resolves.toMatchObject({ status: 'created' });
  });

  it('reports existing registrations, bans and missing projects before counting', async () => {
    db.Project.findByPk.mockResolvedValue({ id: 1, capacity: 1 });
    db.UserProject.findOne.mockResolvedValueOnce({ id: 5 });
    await expect(enroll(1, 7)).resolves.toMatchObject({ status: 'exists' });

    db.UserProjectBan.findOne.mockResolvedValueOnce({ id: 2 });
    await expect(enroll(1, 7)).resolves.toMatchObject({ status: 'banned' });

    db.Project.findByPk.mockResolvedValueOnce(null);
    await expect(enroll(1, 7)).resolves.toMatchObject({ status: 'not_found' });
    expect(db.UserProject.count).not.toHaveBeenCalled();
  });
});
