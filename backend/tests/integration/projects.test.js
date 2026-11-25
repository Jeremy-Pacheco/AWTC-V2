// Projects: ownership (SEC-17), validation (SEC-25) and capacity (BUG-06)
const { describe, it, expect, beforeEach, afterAll } = require('@jest/globals');
const { api, db, seed, closeDatabase } = require('./helpers');

let ctx;
beforeEach(async () => { ctx = await seed(); });
afterAll(closeDatabase);

const update = (project, who, body = { name: 'Renamed' }) =>
  api().put(`/api/projects/${project.id}`).set(ctx.auth[who]).send(body);

describe('Ownership', () => {
  it('lets a coordinator manage only the projects they own', async () => {
    expect((await update(ctx.projects.ownedByA, 'coordinatorA')).status).toBe(200);
    expect((await update(ctx.projects.ownedByB, 'coordinatorA')).status).toBe(403);
    expect((await db.Project.findByPk(ctx.projects.ownedByB.id)).name).toBe('Owned by B');
  });

  it('keeps unowned projects for admins only', async () => {
    expect((await update(ctx.projects.unowned, 'coordinatorA')).status).toBe(403);
    expect((await update(ctx.projects.unowned, 'admin')).status).toBe(200);
  });

  it('rejects volunteers and anonymous users', async () => {
    expect((await update(ctx.projects.ownedByA, 'volunteer')).status).toBe(403);
    expect((await api().put(`/api/projects/${ctx.projects.ownedByA.id}`).send({ name: 'x' })).status).toBe(401);
  });

  it('applies to deletion and volunteer management too', async () => {
    const byA = (method, url) => api()[method](url).set(ctx.auth.coordinatorA);
    expect((await byA('delete', `/api/projects/${ctx.projects.ownedByB.id}`)).status).toBe(403);
    expect((await byA('get', `/api/projects/${ctx.projects.ownedByB.id}/volunteers`)).status).toBe(403);
    expect((await byA('post', `/api/projects/${ctx.projects.ownedByB.id}/volunteers/${ctx.users.volunteer.id}`)).status).toBe(403);
    expect((await byA('get', `/api/projects/${ctx.projects.ownedByA.id}/volunteers`)).status).toBe(200);
    expect((await byA('delete', `/api/projects/${ctx.projects.ownedByA.id}`)).status).toBe(200);
    expect(await db.Project.findByPk(ctx.projects.ownedByA.id)).toBeNull();
  });

  it('makes the creating coordinator the owner', async () => {
    const res = await api().post('/api/projects').set(ctx.auth.coordinatorB).send({ name: 'Created by B', capacity: '5' });
    expect(res.status).toBe(201);
    expect((await db.Project.findByPk(res.body.id)).ownerId).toBe(ctx.users.coordinatorB.id);
  });

  it('lets only admins assign the owner, and only to a coordinator', async () => {
    const assign = (who, ownerId) => update(ctx.projects.unowned, who, { ownerId });
    expect((await update(ctx.projects.ownedByA, 'coordinatorA', { ownerId: ctx.users.coordinatorB.id })).status).toBe(403);
    expect((await assign('admin', ctx.users.volunteer.id)).status).toBe(400);
    expect((await assign('admin', ctx.users.coordinatorB.id)).status).toBe(200);
    expect((await db.Project.findByPk(ctx.projects.unowned.id)).ownerId).toBe(ctx.users.coordinatorB.id);
    // and now coordinator B can manage it
    expect((await update(ctx.projects.unowned, 'coordinatorB')).status).toBe(200);
  });
});

describe('Validation', () => {
  it('rejects invalid ids, statuses, capacities and dates', async () => {
    const admin = (url, body) => api().put(url).set(ctx.auth.admin).send(body);
    expect((await admin('/api/projects/abc', { name: 'x' })).status).toBe(400);
    expect((await admin(`/api/projects/${ctx.projects.ownedByA.id}`, { status: 'deleted' })).status).toBe(400);
    expect((await admin(`/api/projects/${ctx.projects.ownedByA.id}`, { capacity: '0' })).status).toBe(400);
    expect((await admin(`/api/projects/${ctx.projects.ownedByA.id}`, { start_date: '2026-12-05', end_date: '2026-12-01' })).status).toBe(400);
  });

  it('ignores fields that are not editable (mass assignment)', async () => {
    const res = await update(ctx.projects.ownedByA, 'coordinatorA', { name: 'Renamed', id: 999999, createdAt: '2000-01-01' });
    expect(res.status).toBe(200);
    expect(await db.Project.findByPk(ctx.projects.ownedByA.id)).not.toBeNull();
  });
});

describe('Registration and capacity', () => {
  const register = (project, who) => api().post(`/api/projects/${project.id}/register`).set(ctx.auth[who]);

  it('registers once, then answers 409', async () => {
    expect((await register(ctx.projects.ownedByA, 'volunteer')).status).toBe(200);
    expect((await register(ctx.projects.ownedByA, 'volunteer')).status).toBe(409);
  });

  it('refuses when the project is full', async () => {
    expect((await register(ctx.projects.small, 'volunteer')).status).toBe(200);
    expect((await register(ctx.projects.small, 'volunteer2')).status).toBe(400);
  });

  it('never exceeds capacity with simultaneous registrations', async () => {
    const extra = [];
    for (let i = 0; i < 6; i++) {
      extra.push(await db.User.create({ name: `Racer ${i}`, email: `racer${i}@test.example.com`, role: 'volunteer' }));
    }
    const { generateToken } = require('../../utils/utils');
    const responses = await Promise.all(extra.map((user) =>
      api().post(`/api/projects/${ctx.projects.small.id}/register`).set('Authorization', `Bearer ${generateToken(user)}`)
    ));
    const accepted = responses.filter((r) => r.status === 200).length;
    expect(accepted).toBe(1);
    expect(await db.UserProject.count({ where: { projectId: ctx.projects.small.id } })).toBe(1);
  });

  it('treats a project without capacity as unlimited', async () => {
    await db.Project.update({ capacity: null }, { where: { id: ctx.projects.ownedByA.id } });
    expect((await register(ctx.projects.ownedByA, 'volunteer')).status).toBe(200);
  });

  it('blocks banned volunteers', async () => {
    await db.UserProjectBan.create({ userId: ctx.users.volunteer.id, projectId: ctx.projects.ownedByA.id });
    expect((await register(ctx.projects.ownedByA, 'volunteer')).status).toBe(403);
  });
});
