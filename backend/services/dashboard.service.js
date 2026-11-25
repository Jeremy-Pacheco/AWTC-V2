/**
 * Data for the EJS admin dashboard (views/index.ejs and its sections).
 * Moved out of app.js (audit task 3.8).
 */
const db = require('../models');

/**
 * model.findAll(), falling back to a raw SELECT * if the model query fails
 * (e.g. a column missing in an old database).
 */
async function safeFindAll(model) {
  if (!model) return [];
  try {
    return await model.findAll();
  } catch (err) {
    try {
      const tableName = typeof model.getTableName === 'function' ? model.getTableName() : (model.tableName || model.name || null);
      if (!tableName) throw err;
      console.warn(`Model query failed for ${model.name}, falling back to raw SELECT * FROM ${tableName}:`, err.message);
      const [rows] = await db.sequelize.query(`SELECT * FROM \`${tableName}\``);
      // Raw rows bypass the model's defaultScope: never leak password hashes
      return rows.map(({ passwordHash, ...row }) => row); // eslint-disable-line no-unused-vars
    } catch (err2) {
      console.error('Fallback raw query also failed for model', model && model.name, err2.message);
      return [];
    }
  }
}

/** Newest first by createdAt / created_at / date, then by id; first `n` items. */
function recent(items, n = 5) {
  if (!Array.isArray(items)) return [];
  const dateOf = (item) => {
    const value = item && (item.createdAt || item.created_at || item.date);
    return value ? new Date(value) : null;
  };
  return items.slice().sort((a, b) => {
    const aDate = dateOf(a);
    const bDate = dateOf(b);
    if (aDate && bDate) return bDate - aDate;
    if (aDate) return -1;
    if (bDate) return 1;
    return (b.id || 0) - (a.id || 0);
  }).slice(0, n);
}

/** Sent messages per user id (only the aggregate is queried). */
async function messageCountsByUser() {
  const counts = {};
  if (!db.Message) return counts;
  try {
    const [rows] = await db.sequelize.query(
      'SELECT senderId AS userId, COUNT(*) AS messageCount FROM `Messages` GROUP BY senderId'
    );
    rows.forEach((row) => { counts[row.userId] = parseInt(row.messageCount, 10) || 0; });
  } catch (err) {
    console.warn('Could not load message counts:', err.message);
  }
  return counts;
}

/** Everything the dashboard sections render. */
async function getDashboardData() {
  const projects = await safeFindAll(db.Project);
  const users = await safeFindAll(db.User);
  const categories = await safeFindAll(db.Category);
  const contacts = await safeFindAll(db.Contact);

  let reviews;
  try {
    reviews = await db.Reviews.findAll({
      include: [{ model: db.User, as: 'user', attributes: ['id', 'email', 'name', 'role'] }]
    });
  } catch (err) {
    console.warn('Could not load reviews with users:', err.message);
    reviews = await safeFindAll(db.Reviews);
  }

  const messageCounts = await messageCountsByUser();
  reviews = reviews.map((review) => {
    const data = review.toJSON ? review.toJSON() : review;
    return { ...data, messageCount: messageCounts[data.user && data.user.id] || 0 };
  });

  const result = {
    projects,
    users,
    categories,
    reviews,
    contacts,
    latestUsers: recent(users, 6),
    latestProjects: recent(projects, 6),
    latestReviews: recent(reviews, 10),
    usersPerProject: null,
    projectsWithVolunteers: null,
    projectsPerUser: null,
    allUserProjects: [],
  };

  try {
    const [usersPerProject] = await db.sequelize.query(
      `SELECT p.id AS projectId, p.name AS projectName, COUNT(up.userId) AS volunteersCount
       FROM \`Projects\` p
       LEFT JOIN \`UserProjects\` up ON up.projectId = p.id
       GROUP BY p.id, p.name`
    );
    result.usersPerProject = usersPerProject;
  } catch (err) {
    console.warn('Could not compute usersPerProject:', err.message);
  }

  try {
    result.projectsWithVolunteers = await db.Project.findAll({
      include: [{ model: db.User, through: { attributes: ['status', 'role'] } }]
    });
  } catch (err) {
    console.warn('Could not load projectsWithVolunteers:', err.message);
  }

  try {
    const [projectsPerUser] = await db.sequelize.query(
      `SELECT u.id AS userId, u.name AS userName, u.email, COUNT(up.projectId) AS projectCount
       FROM \`Users\` u
       LEFT JOIN \`UserProjects\` up ON up.userId = u.id
       GROUP BY u.id, u.name, u.email
       ORDER BY projectCount DESC`
    );
    result.projectsPerUser = projectsPerUser;
    result.allUserProjects = await db.UserProject.findAll({
      attributes: ['userId', 'projectId', 'status', 'role', 'createdAt', 'updatedAt']
    });
  } catch (err) {
    console.warn('Could not compute projectsPerUser:', err.message);
  }

  return result;
}

module.exports = { getDashboardData, safeFindAll, recent };
