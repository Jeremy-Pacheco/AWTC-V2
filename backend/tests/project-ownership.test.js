// Project ownership: coordinators only manage their own projects (SEC-17)
const { describe, it, expect, beforeEach } = require('@jest/globals');
const fs = require('fs');
const path = require('path');

jest.mock('../models', () => ({
  Project: { findByPk: jest.fn() },
  User: { findByPk: jest.fn() },
  sequelize: {},
}));
jest.mock('../config/socket', () => ({ getVolunteeringNS: jest.fn() }));
jest.mock('../controllers/subscription.controller', () => ({ sendNotificationToUser: jest.fn() }));

const { Project, User } = require('../models');
const { canManageProject, requireProjectManager } = require('../middlewares/projectAccess.middlewares');
const { _resolveOwnerId: resolveOwnerId } = require('../controllers/project.controller');

const admin = { id: 1, role: 'admin' };
const coordinator = { id: 2, role: 'coordinator' };
const otherCoordinator = { id: 3, role: 'coordinator' };
const volunteer = { id: 4, role: 'volunteer' };

beforeEach(() => jest.clearAllMocks());

describe('canManageProject', () => {
  it('lets admins manage every project, owned or not', () => {
    expect(canManageProject(admin, { ownerId: 2 })).toBe(true);
    expect(canManageProject(admin, { ownerId: null })).toBe(true);
  });

  it('lets a coordinator manage only the projects they own', () => {
    expect(canManageProject(coordinator, { ownerId: 2 })).toBe(true);
    expect(canManageProject(otherCoordinator, { ownerId: 2 })).toBe(false);
  });

  it('keeps projects without owner for admins only', () => {
    expect(canManageProject(coordinator, { ownerId: null })).toBe(false);
    expect(canManageProject(coordinator, { ownerId: undefined })).toBe(false);
  });

  it('never lets volunteers (or a demoted former owner) manage projects', () => {
    expect(canManageProject(volunteer, { ownerId: 4 })).toBe(false);
    expect(canManageProject(null, { ownerId: 2 })).toBe(false);
  });
});

describe('requireProjectManager', () => {
  const run = async (user, project) => {
    Project.findByPk.mockResolvedValue(project);
    const req = { user, params: { id: 10 } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    await requireProjectManager(req, res, next);
    return { req, res, next };
  };

  it('loads the project for its owner', async () => {
    const project = { id: 10, ownerId: 2 };
    const { req, next } = await run(coordinator, project);
    expect(next).toHaveBeenCalledWith();
    expect(req.project).toBe(project);
  });

  it('answers 403 to another coordinator', async () => {
    const { res, next } = await run(otherCoordinator, { id: 10, ownerId: 2 });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('answers 404 when the project does not exist', async () => {
    const { res } = await run(admin, null);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('Assigning the responsible coordinator', () => {
  it('makes a coordinator the owner of the projects they create', async () => {
    await expect(resolveOwnerId(coordinator, undefined, { creating: true })).resolves.toBe(2);
    await expect(resolveOwnerId(coordinator, undefined, { creating: false })).resolves.toBeUndefined();
  });

  it('does not let coordinators assign or remove owners', async () => {
    await expect(resolveOwnerId(coordinator, 3, { creating: true })).rejects.toMatchObject({ status: 403 });
    await expect(resolveOwnerId(coordinator, null, { creating: false })).rejects.toMatchObject({ status: 403 });
  });

  it('lets admins assign a coordinator, remove the owner or leave it unchanged', async () => {
    User.findByPk.mockResolvedValue({ id: 3, role: 'coordinator' });
    await expect(resolveOwnerId(admin, 3, { creating: false })).resolves.toBe(3);
    await expect(resolveOwnerId(admin, null, { creating: false })).resolves.toBeNull();
    await expect(resolveOwnerId(admin, undefined, { creating: false })).resolves.toBeUndefined();
    await expect(resolveOwnerId(admin, undefined, { creating: true })).resolves.toBeNull();
  });

  it('only accepts existing coordinators as owners', async () => {
    User.findByPk.mockResolvedValue({ id: 4, role: 'volunteer' });
    await expect(resolveOwnerId(admin, 4, { creating: false })).rejects.toMatchObject({ status: 400 });
    User.findByPk.mockResolvedValue(null);
    await expect(resolveOwnerId(admin, 99, { creating: false })).rejects.toMatchObject({ status: 400 });
  });
});

describe('Project routes', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'routes', 'project.routes.js'), 'utf8');
  const route = (pattern) => source.split('\n').find((line) => line.includes(pattern)) || '';

  it.each([
    "router.get('/:id/volunteers'",
    "router.post('/:id/volunteers/:userId/accept'",
    "router.post('/:id/volunteers/:userId/reject'",
    "router.post('/:id/volunteers/:userId',",
    "router.post('/:id/volunteers/:userId/unban'",
    "router.put('/:id'",
    "router.delete('/:id'",
  ])('%s checks ownership', (pattern) => {
    expect(route(pattern)).toContain('requireProjectManager');
  });

  it('checks ownership before accepting an upload on update', () => {
    const line = route("router.put('/:id'");
    expect(line.indexOf('requireProjectManager')).toBeLessThan(line.indexOf("upload.single('file')"));
  });
});
