// CRUD through the HTTP API with a real database. Replaces the former
// tests/{category,contact,project,reviews}.test.js, which called the
// controllers directly against whatever database .env.development pointed to.
const { describe, it, expect, beforeEach, afterAll } = require('@jest/globals');
const { api, db, seed, closeDatabase } = require('./helpers');

let ctx;
beforeEach(async () => { ctx = await seed(); });
afterAll(closeDatabase);

describe('Categories', () => {
  it('create, read, update and delete (coordinator)', async () => {
    const created = await api().post('/api/categories').set(ctx.auth.coordinatorA)
      .send({ name: '  Health ', description: 'Wellbeing', id: 4242 });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe('Health');
    expect(created.body.id).not.toBe(4242); // not mass-assignable

    const list = await api().get('/api/categories');
    expect(list.body.map((c) => c.name)).toEqual(expect.arrayContaining(['Environment', 'Health']));

    const updated = await api().put(`/api/categories/${created.body.id}`).set(ctx.auth.coordinatorA).send({ name: 'Health & care' });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Health & care');

    expect((await api().delete(`/api/categories/${created.body.id}`).set(ctx.auth.coordinatorA)).status).toBe(200);
    expect(await db.Category.findByPk(created.body.id)).toBeNull();
  });

  it('validates input', async () => {
    expect((await api().post('/api/categories').set(ctx.auth.admin).send({ name: '' })).status).toBe(400);
    expect((await api().put(`/api/categories/${ctx.category.id}`).set(ctx.auth.admin).send({})).status).toBe(400);
  });
});

describe('Contacts', () => {
  it('public submission, admin can only toggle "read"', async () => {
    const created = await api().post('/api/contacts')
      .send({ name: 'Jordan', email: 'jordan@test.example.com', subject: 'Groups', message: 'Can we join together?' });
    expect(created.status).toBe(201);

    const res = await api().put(`/api/contacts/${created.body.id}`).set(ctx.auth.admin)
      .send({ read: true, email: 'attacker@evil.example', message: 'changed' });
    expect(res.status).toBe(200);
    const stored = await db.Contact.findByPk(created.body.id);
    expect(stored.read).toBe(true);
    expect(stored.email).toBe('jordan@test.example.com');
    expect(stored.message).toBe('Can we join together?');
  });

  it('validates submissions', async () => {
    expect((await api().post('/api/contacts').send({ name: 'A', email: 'not-an-email', message: 'hi' })).status).toBe(400);
    expect((await api().post('/api/contacts').send({ name: 'A', email: 'a@test.example.com', message: 'x'.repeat(5001) })).status).toBe(400);
  });
});

describe('Reviews', () => {
  it('authors edit their own reviews; admins (not others) can delete them', async () => {
    const created = await api().post('/api/reviews').set(ctx.auth.volunteer).send({ content: 'Great beach clean-up!' });
    expect(created.status).toBe(201);
    const id = created.body.id;

    expect((await api().put(`/api/reviews/${id}`).set(ctx.auth.volunteer2).send({ content: 'hijacked' })).status).toBe(403);
    expect((await api().put(`/api/reviews/${id}`).set(ctx.auth.volunteer).send({ content: 'Great clean-up, again!' })).status).toBe(200);
    expect((await db.Reviews.findByPk(id)).content).toBe('Great clean-up, again!');

    expect((await api().delete(`/api/reviews/${id}`).set(ctx.auth.volunteer2)).status).toBe(403);
    expect((await api().delete(`/api/reviews/${id}`).set(ctx.auth.admin)).status).toBe(200);
  });

  it('requires authentication and content', async () => {
    expect((await api().post('/api/reviews').send({ content: 'anonymous' })).status).toBe(401);
    expect((await api().post('/api/reviews').set(ctx.auth.volunteer).send({ content: '   ' })).status).toBe(400);
  });
});

describe('Projects (public listing)', () => {
  it('lists projects with their category and volunteer counts', async () => {
    await db.UserProject.create({ userId: ctx.users.volunteer.id, projectId: ctx.projects.ownedByA.id, status: 'accepted' });
    const res = await api().get('/api/projects');
    expect(res.status).toBe(200);
    const project = res.body.find((p) => p.id === ctx.projects.ownedByA.id);
    expect(project.category.name).toBe('Environment');
    expect(Number(project.volunteerCount)).toBe(1);
  });
});
