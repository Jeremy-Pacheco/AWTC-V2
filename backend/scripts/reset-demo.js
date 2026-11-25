#!/usr/bin/env node
/**
 * Resets the PUBLIC DEMO database: deletes ALL application data and inserts
 * the fake dataset from scripts/demo-data.js plus the three demo accounts.
 *
 * Run nightly by .github/workflows/demo-reset.yml. Usage:
 *
 *   DEMO_MODE=true NODE_ENV=production node scripts/reset-demo.js --yes
 *
 * Safety: it refuses to run unless DEMO_MODE=true AND --yes is passed, so it
 * cannot wipe a real database by accident. Run the migrations first.
 *
 * Optional env:
 *   DEMO_PASSWORD  if set (>= 8 chars), demo accounts can also sign in with the
 *                  normal login form when AUTH_PROVIDER=local.
 *   STORAGE_PROVIDER=cloudinary + CLOUDINARY_URL: uploads under
 *                  CLOUDINARY_FOLDER (default "awtc") are deleted as well.
 */
const path = require('path');
const dotenv = require('dotenv');

const env = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(__dirname, '..', `.env.${env}.local`) });
dotenv.config({ path: path.resolve(__dirname, '..', `.env.${env}`) });

const bcrypt = require('bcrypt');
const demo = require('../services/demo.service');
const data = require('./demo-data');

const DAY = 24 * 60 * 60 * 1000;

// Children first, so foreign keys never block the deletion
const TABLES_IN_DELETE_ORDER = [
  'Message',
  'Subscription',
  'UserProjectBan',
  'UserProject',
  'Reviews',
  'Contact',
  'Project',
  'Category',
  'User',
];

function fail(message) {
  console.error(`[reset-demo] ${message}`);
  process.exit(1);
}

async function hashDemoPassword() {
  const password = process.env.DEMO_PASSWORD;
  if (!password) return null;
  if (password.length < 8) fail('DEMO_PASSWORD must be at least 8 characters long');
  return bcrypt.hash(password, 12);
}

async function wipeAndSeed(db) {
  const passwordHash = await hashDemoPassword();
  const now = Date.now();

  await db.sequelize.transaction(async (transaction) => {
    const opts = { transaction };

    for (const modelName of TABLES_IN_DELETE_ORDER) {
      const model = db[modelName];
      if (!model) fail(`Model ${modelName} not found`);
      await model.destroy({ where: {}, ...opts });
    }

    // Users: the 3 shared demo accounts + some extra fake people
    const users = await db.User.bulkCreate(
      [
        ...demo.DEMO_ACCOUNTS.map((a) => ({
          ...a,
          passwordHash,
          profileImage: a.role === 'admin' ? 'admin-profile.png' : null,
        })),
        ...data.extraUsers,
      ],
      opts
    );
    const userByEmail = new Map(users.map((u) => [u.email, u]));

    const categories = await db.Category.bulkCreate(data.categories, opts);
    const categoryByName = new Map(categories.map((c) => [c.name, c]));

    const projects = await db.Project.bulkCreate(
      data.projects.map(({ category, startInDays, durationDays, ...p }) => ({
        ...p,
        status: 'Active',
        start_date: new Date(now + startInDays * DAY),
        end_date: new Date(now + (startInDays + durationDays) * DAY),
        categoryId: categoryByName.get(category).id,
      })),
      opts
    );
    const projectByName = new Map(projects.map((p) => [p.name, p]));

    const registrations = [];
    for (const [email, projectNames] of Object.entries(data.registrations)) {
      for (const name of projectNames) {
        registrations.push({
          userId: userByEmail.get(email).id,
          projectId: projectByName.get(name).id,
          status: 'accepted',
          role: 'volunteer',
        });
      }
    }
    await db.UserProject.bulkCreate(registrations, opts);

    await db.Reviews.bulkCreate(
      data.reviews.map(({ author, ...r }, i) => ({
        ...r,
        userId: userByEmail.get(author).id,
        date: new Date(now - (i + 1) * DAY),
      })),
      opts
    );

    await db.Contact.bulkCreate(data.contacts, opts);

    await db.Message.bulkCreate(
      data.messages.map(({ from, to, content }) => ({
        senderId: userByEmail.get(from).id,
        receiverId: userByEmail.get(to).id,
        content,
      })),
      opts
    );
  });
}

/** Logs everyone out of the EJS dashboard (sessions point to deleted users). */
async function clearSessions(db) {
  try {
    await db.sequelize.query('DELETE FROM `Sessions`');
    console.log('[reset-demo] Dashboard sessions cleared');
  } catch (err) {
    // The table only exists when SESSION_STORE=database has been migrated
    console.warn(`[reset-demo] Sessions not cleared: ${err.message}`);
  }
}

/** Best effort: remove images uploaded by visitors to Cloudinary. */
async function cleanCloudinary() {
  if ((process.env.STORAGE_PROVIDER || '').toLowerCase() !== 'cloudinary' || !process.env.CLOUDINARY_URL) return;
  const folder = process.env.CLOUDINARY_FOLDER || 'awtc';
  try {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({ secure: true });
    let deleted = 0;
    // The API deletes up to 1000 resources per call and reports `partial` when more remain
    for (let i = 0; i < 20; i++) {
      const result = await cloudinary.api.delete_resources_by_prefix(`${folder}/`, { resource_type: 'image' });
      deleted += Object.keys(result.deleted || {}).length;
      if (!result.partial) break;
    }
    console.log(`[reset-demo] Cloudinary: ${deleted} uploaded image(s) removed from "${folder}/"`);
  } catch (err) {
    console.warn(`[reset-demo] Cloudinary cleanup failed (data reset is still done): ${err.message}`);
  }
}

async function main() {
  if (!demo.isDemoMode()) fail('Refusing to run: DEMO_MODE is not "true". This script deletes ALL data.');
  if (!process.argv.includes('--yes')) fail('Refusing to run without --yes. This script deletes ALL data.');

  const db = require('../models');
  try {
    await db.sequelize.authenticate();
    await wipeAndSeed(db);
    console.log('[reset-demo] Demo data reset successfully');
    await clearSessions(db);
    await cleanCloudinary();
  } finally {
    await db.sequelize.close();
  }
}

main().catch((err) => {
  console.error('[reset-demo] Failed:', err.message);
  process.exit(1);
});
