/**
 * EJS admin dashboard pages (server-side session, admins only).
 * Moved out of app.js (audit task 3.8).
 */
const express = require('express');
const router = express.Router();
const db = require('../models');
const { getDashboardData } = require('../services/dashboard.service');

const SECTIONS = ['overview', 'projects', 'users', 'categories', 'reviews', 'contacts'];

/** Admins only: anonymous users go to the login page, others get 403. */
function requireDashboardAdmin(req, res, next) {
  if (!req.user) return res.redirect('/login');
  if (req.user.role !== 'admin') {
    return res.status(403).render('access-denied', { currentUser: req.user, frontendUrl: req.app.locals.frontendUrl });
  }
  next();
}

async function renderDashboard(req, res, section, extra = {}) {
  const base = {
    shopName: 'A Will To Change',
    currentUser: req.user,
    currentSection: section,
    frontendUrl: req.app.locals.frontendUrl,
  };
  try {
    const data = await getDashboardData();
    res.render('index', {
      ...base,
      projectsNumber: data.projects.length,
      usersNumber: data.users.length,
      categoriesNumber: data.categories.length,
      reviewsNumber: data.reviews.length,
      contactsNumber: data.contacts.length,
      ...data,
      ...extra,
    });
  } catch (err) {
    console.error('Error fetching data for dashboard:', err.message);
    res.render('index', {
      ...base,
      projects: [], projectsNumber: 0,
      users: [], usersNumber: 0,
      categories: [], categoriesNumber: 0,
      reviews: [], reviewsNumber: 0,
      contacts: [], contactsNumber: 0,
    });
  }
}

router.get('/', requireDashboardAdmin, (req, res) => renderDashboard(req, res, 'overview'));
for (const section of SECTIONS) {
  router.get(`/${section}`, requireDashboardAdmin, (req, res) => renderDashboard(req, res, section));
}

// Volunteers of one project (projects section) (BUG-07, SEC-08)
router.get('/projects/:id/volunteers', requireDashboardAdmin, async (req, res) => {
  const projectId = Number(req.params.id);
  if (!Number.isInteger(projectId) || projectId <= 0) return res.redirect('/projects');
  try {
    const project = await db.Project.findByPk(projectId, { include: [{ model: db.User, through: { attributes: ['status', 'role'] } }] });
    if (!project) return res.redirect('/projects');
    return renderDashboard(req, res, 'projects', {
      projectVolunteers: project.Users || [],
      projectName: project.name,
    });
  } catch (err) {
    console.error('Error loading project volunteers:', err.message);
    return res.redirect('/projects');
  }
});

module.exports = router;
module.exports.DASHBOARD_PATHS = ['/', ...SECTIONS.map((s) => `/${s}`)];
