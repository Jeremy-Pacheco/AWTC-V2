/**
 * Project ownership checks (AUDIT_REPORT.md, SEC-17).
 *
 * - Admins manage every project.
 * - A coordinator manages only the projects they own (Projects.ownerId).
 * - Projects without an owner can only be managed by admins, who can assign
 *   one from the project form.
 *
 * Must run after authentication, a role check (isAdminOrCoordinator) and
 * params validation (req.params.id is a positive integer).
 */
const { Project } = require('../models');

function canManageProject(user, project) {
  if (!user || !project) return false;
  if (user.role === 'admin') return true;
  return user.role === 'coordinator' && project.ownerId != null && project.ownerId === user.id;
}

/** Loads the project in req.params.id into req.project, or answers 404/403. */
async function requireProjectManager(req, res, next) {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (!canManageProject(req.user, project)) {
      return res.status(403).json({ message: 'You can only manage projects you are responsible for' });
    }
    req.project = project;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { canManageProject, requireProjectManager };
