/**
 * Helpers for integration tests: reset the test database and seed a small,
 * known dataset with one user per role.
 */
const request = require('supertest');
const db = require('../../models');
const app = require('../../app');
const { generateToken } = require('../../utils/utils');

// Children first so foreign keys never block the deletion
const TABLES_IN_DELETE_ORDER = [
  'RefreshToken', 'Message', 'Subscription', 'UserProjectBan', 'UserProject', 'Reviews',
  'Contact', 'Project', 'Category', 'User',
];

function assertTestDatabase() {
  const name = db.sequelize.config.database || '';
  if (process.env.NODE_ENV !== 'test' || !/test/i.test(name)) {
    throw new Error(`Refusing to wipe database "${name}": integration tests need a dedicated *test* database.`);
  }
}

async function resetDatabase() {
  assertTestDatabase();
  for (const modelName of TABLES_IN_DELETE_ORDER) {
    await db[modelName].destroy({ where: {} });
  }
}

/** Creates rows one by one so every instance has its generated id. */
async function createEach(model, rows) {
  const created = [];
  for (const row of rows) created.push(await model.create(row));
  return created;
}

/**
 * Seeds:
 *  - users: admin, coordinatorA, coordinatorB, volunteer, volunteer2
 *  - a category
 *  - projects: ownedByA (coordinator A), ownedByB (coordinator B),
 *    unowned (admins only), small (capacity 1, owned by A)
 * Returns the records plus a Bearer header per user.
 */
async function seed() {
  await resetDatabase();
  const [admin, coordinatorA, coordinatorB, volunteer, volunteer2] = await createEach(db.User, [
    { name: 'Admin', email: 'admin@test.example.com', role: 'admin' },
    { name: 'Coordinator A', email: 'coord-a@test.example.com', role: 'coordinator' },
    { name: 'Coordinator B', email: 'coord-b@test.example.com', role: 'coordinator' },
    { name: 'Volunteer', email: 'volunteer@test.example.com', role: 'volunteer' },
    { name: 'Volunteer Two', email: 'volunteer2@test.example.com', role: 'volunteer' },
  ]);
  const category = await db.Category.create({ name: 'Environment', description: 'Test category' });
  const base = { status: 'active', categoryId: category.id, capacity: 10, location: 'Test' };
  const [ownedByA, ownedByB, unowned, small] = await createEach(db.Project, [
    { ...base, name: 'Owned by A', ownerId: coordinatorA.id },
    { ...base, name: 'Owned by B', ownerId: coordinatorB.id },
    { ...base, name: 'Unowned', ownerId: null },
    { ...base, name: 'Small', capacity: 1, ownerId: coordinatorA.id },
  ]);

  const users = { admin, coordinatorA, coordinatorB, volunteer, volunteer2 };
  const auth = Object.fromEntries(
    Object.entries(users).map(([key, user]) => [key, { Authorization: `Bearer ${generateToken(user)}` }])
  );
  return { users, auth, category, projects: { ownedByA, ownedByB, unowned, small } };
}

async function closeDatabase() {
  await db.sequelize.close();
}

/** supertest agent for the app */
const api = () => request(app);

module.exports = { api, app, db, seed, resetDatabase, closeDatabase };
