const { Project } = require('../models');
const db = require('../models');
const { User } = db;
const logger = require('../utils/logger');
const { sendNotificationToUser } = require('./subscription.controller');
const { getVolunteeringNS } = require('../config/socket');

/**
 * Project ownership (SEC-17). Returns the ownerId to store, or throws an
 * Error with `status`:
 *  - coordinators always own the projects they create and cannot assign owners;
 *  - admins may assign a coordinator (or null = admins only).
 */
async function resolveOwnerId(user, requestedOwnerId, { creating }) {
  if (user.role !== 'admin') {
    if (requestedOwnerId !== undefined && requestedOwnerId !== user.id) {
      throw Object.assign(new Error('Only admins can assign the responsible coordinator'), { status: 403 });
    }
    return creating ? user.id : undefined;
  }
  if (requestedOwnerId === null) return null; // remove the owner: admins only
  if (requestedOwnerId === undefined) return creating ? null : undefined; // keep as is
  const owner = await User.findByPk(requestedOwnerId, { attributes: ['id', 'role'] });
  if (!owner || owner.role !== 'coordinator') {
    throw Object.assign(new Error('The responsible user must be a coordinator'), { status: 400 });
  }
  return owner.id;
}

const ownershipError = (res, error) =>
  error && (error.status === 400 || error.status === 403)
    ? res.status(error.status).json({ message: error.message })
    : null;

// Create a new project
exports.createProject = async (req, res) => {
  try {
    const { name, description, start_date, end_date, location, capacity, status, categoryId } = req.body;
    const filename = req.file ? req.file.filename : null;
    const ownerId = await resolveOwnerId(req.user, req.body.ownerId, { creating: true });

    const project = await Project.create({
      name,
      description,
      start_date,
      end_date,
      location,
      capacity,
      status,
      filename,
      categoryId,
      ownerId
    });

    logger.info(`Project created: ${project.name} (ID: ${project.id})`);

    // Return the created project including its category
    const created = await Project.findByPk(project.id, { include: [{ model: db.Category, as: 'category' }] });
    res.status(201).json(created);
  } catch (error) {
    if (ownershipError(res, error)) return;
    logger.error(`Failed to create project: ${error.message}`);
    console.error(error);
    res.status(400).json({ message: 'Error creating project' });
  }
};

// Get all projects
exports.getAllProjects = async (req, res) => {
  try {
    const projects = await Project.findAll({
      include: [{ model: db.Category, as: 'category' }]
    });

    // Get volunteer counts grouped by project
    const counts = await db.UserProject.findAll({
      attributes: ['projectId', [db.sequelize.fn('COUNT', db.sequelize.col('projectId')), 'count']],
      group: ['projectId'],
      raw: true
    });

    // Create a map for quick lookup
    const countMap = {};
    counts.forEach(c => {
      countMap[c.projectId] = c.count;
    });

    // Merge counts into project objects
    const projectsWithCount = projects.map(p => {
      const pJson = p.toJSON();
      pJson.volunteerCount = countMap[p.id] || 0;
      return pJson;
    });

    res.status(200).json(projectsWithCount);
  } catch (error) {
    console.error('Error retrieving projects:', error);
    res.status(500).json({ message: 'Error retrieving projects' });
  }
};

// Update a project
exports.updateProject = async (req, res) => {
  try {
    // Loaded and ownership-checked by requireProjectManager
    const project = req.project || await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // req.body was validated and whitelisted (validation/schemas.js -> projectUpdate);
    // only the fields actually sent are changed
    const { status } = req.body;
    const updateData = Object.fromEntries(
      Object.entries(req.body).filter(([key, value]) => value !== undefined && key !== 'ownerId')
    );
    const ownerId = await resolveOwnerId(req.user, req.body.ownerId, { creating: false });
    if (ownerId !== undefined) updateData.ownerId = ownerId;

    if (req.file && req.file.filename) {
      updateData.filename = req.file.filename;
    }

    // Capture old status before update
    const oldStatus = project.status;
    logger.info(`Updating project ${project.id}. Old status: ${oldStatus}, New status candidate: ${status}`);

    await project.update(updateData);

    // Check if status changed to active, cancelled, or finished and send push notifications
    if (status && status !== oldStatus && ['active', 'cancelled', 'finished'].includes(status)) {
      logger.info(`Status change detected for project ${project.id}. Checking for enrolled users...`);
      try {
        // Find all users enrolled in this project
        const userProjects = await db.UserProject.findAll({
          where: { 
            projectId: project.id,
            status: 'accepted'
          }
        });

        const userIds = userProjects.map(up => up.userId);
        logger.info(`Found ${userIds.length} enrolled users: ${userIds.join(', ')}`);

        if (userIds.length > 0) {
          const notificationPayload = {
            title: 'Project Status Update',
            body: `The project "${project.name}" is now ${status}.`,
            icon: '/images/logo.png',
            // Unique tag to ensure notifications stack
            tag: `project-${project.id}-${Date.now()}`,
            data: {
              url: `/projects/${project.id}`
            }
          };

          logger.info(`Sending notification payload: ${JSON.stringify(notificationPayload)}`);

          // Send notifications to all enrolled users
          const notificationPromises = userIds.map(userId => 
            sendNotificationToUser(userId, notificationPayload)
          );

          const results = await Promise.allSettled(notificationPromises);
          const sentCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
          const failedCount = results.filter(r => r.status === 'fulfilled' && !r.value.success).length;
          
          logger.info(`Notifications sent: ${sentCount}, Failed: ${failedCount}`);
          
          if (failedCount > 0) {
             const errors = results
                .filter(r => r.status === 'fulfilled' && !r.value.success)
                .map(r => r.value.message);
             logger.error(`Notification errors: ${JSON.stringify(errors)}`);
          }
        } else {
          logger.info('No users enrolled in this project to notify.');
        }
      } catch (notifyError) {
        logger.error(`Error sending push notifications: ${notifyError.message}`);
        console.error(notifyError);
      }
    } else {
      logger.info('No notification sent. Conditions not met (status change or target status).');
    }

    // Return updated project with category
    const updated = await Project.findByPk(project.id, { include: [{ model: db.Category, as: 'category' }] });
    res.status(200).json(updated);
  } catch (error) {
    if (ownershipError(res, error)) return;
    console.error(error);
    res.status(400).json({ message: 'Error updating project' });
  }
};


// Delete a project
exports.deleteProject = async (req, res) => {
  try {
    // Loaded and ownership-checked by requireProjectManager
    const project = req.project || await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    await project.destroy();
    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error.message);
    res.status(500).json({ message: 'Error deleting project' });
  }
};

// Register current authenticated user to the project (self-registration)
exports.registerUser = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });

    const project = await Project.findByPk(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const userId = req.user.id;

    // Prevent registration if user is banned from this project
    const existingBan = await db.UserProjectBan.findOne({ where: { userId, projectId } });
    if (existingBan) return res.status(403).json({ message: 'Cannot register to this project' });

    // Check if project has reached capacity
    const volunteerCount = await db.UserProject.count({
      where: { projectId: projectId }
    });

    if (volunteerCount >= project.capacity) {
      return res.status(400).json({ message: 'Project is at full capacity' });
    }

    // Check if subscription already exists
    const [row, created] = await db.UserProject.findOrCreate({
      where: { userId, projectId },
      defaults: { status: 'accepted' }
    });

    if (!created) return res.status(409).json({ message: 'Already registered' });

    // Emit WebSocket event to update volunteer count
    try {
      const updatedVolunteerCount = volunteerCount + 1;
      const volunteeringNS = getVolunteeringNS();
      volunteeringNS.emit('volunteer_count_updated', {
        projectId: projectId,
        enrolled: updatedVolunteerCount,
        capacity: project.capacity
      });
      logger.info(`Volunteer count updated for project ${projectId}: ${updatedVolunteerCount}/${project.capacity}`);
    } catch (socketError) {
      logger.error(`Error emitting WebSocket event: ${socketError.message}`);
      // Don't fail the request if WebSocket fails
    }

    return res.status(200).json({ message: 'Registered to project', subscription: row });
  } catch (err) {
    console.error('Register user error', err.message);
    return res.status(500).json({ message: 'Error registering user to project' });
  }
};

// Get volunteers for a project (requires admin/coordinator role)
exports.getVolunteers = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const project = await Project.findByPk(projectId, { include: [{ model: db.User, through: { attributes: ['status', 'role'] } }] });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // project.Users is the list of volunteer users associated
    return res.status(200).json({ projectId: project.id, volunteers: project.Users || [] });
  } catch (err) {
    console.error('Get volunteers error', err.message);
    return res.status(500).json({ message: 'Error fetching volunteers' });
  }
};

// Accept a volunteer registration (admin/coordinator)
exports.acceptVolunteer = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const volunteerId = parseInt(req.params.userId, 10);
    const record = await db.UserProject.findOne({ where: { userId: volunteerId, projectId } });
    if (!record) return res.status(404).json({ message: 'Registration not found' });
    await record.update({ status: 'accepted' });
    return res.status(200).json({ message: 'Volunteer accepted', record });
  } catch (err) {
    console.error('Accept volunteer error', err.message);
    return res.status(500).json({ message: 'Error accepting volunteer' });
  }
};

// Admin manually add an existing user as volunteer for a project (accepted)
exports.addVolunteer = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const volunteerId = parseInt(req.params.userId, 10);
    const project = await Project.findByPk(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Do not add if a ban exists
    const existingBan = await db.UserProjectBan.findOne({ where: { userId: volunteerId, projectId } });
    if (existingBan) return res.status(403).json({ message: 'User is banned from this project' });

    // Check if project has reached capacity
    const volunteerCount = await db.UserProject.count({
      where: { projectId: projectId }
    });

    if (volunteerCount >= project.capacity) {
      return res.status(400).json({ message: 'Project is at full capacity' });
    }

    const [row, created] = await db.UserProject.findOrCreate({ where: { userId: volunteerId, projectId }, defaults: { status: 'accepted' } });
    if (!created) return res.status(409).json({ message: 'User already registered to this project' });

    // Emit WebSocket event to update volunteer count
    try {
      const updatedVolunteerCount = volunteerCount + 1;
      const volunteeringNS = getVolunteeringNS();
      volunteeringNS.emit('volunteer_count_updated', {
        projectId: projectId,
        enrolled: updatedVolunteerCount,
        capacity: project.capacity
      });
      logger.info(`Volunteer count updated for project ${projectId}: ${updatedVolunteerCount}/${project.capacity}`);
    } catch (socketError) {
      logger.error(`Error emitting WebSocket event: ${socketError.message}`);
      // Don't fail the request if WebSocket fails
    }

    return res.status(200).json({ message: 'Volunteer added to project', subscription: row });
  } catch (err) {
    console.error('Add volunteer error', err.message);
    return res.status(500).json({ message: 'Error adding volunteer to project' });
  }
};

// Reject a volunteer registration (admin/coordinator) — implemented as deletion + ban
exports.rejectVolunteer = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const volunteerId = parseInt(req.params.userId, 10);
    const record = await db.UserProject.findOne({ where: { userId: volunteerId, projectId } });
    if (!record) return res.status(404).json({ message: 'Registration not found' });
    
    const project = await Project.findByPk(projectId);
    
    await record.destroy();
    // Create a ban so the volunteer can't re-register
    await db.UserProjectBan.findOrCreate({ where: { userId: volunteerId, projectId }, defaults: { reason: 'Rejected by admin' } });

    // Emit WebSocket event to update volunteer count
    try {
      const updatedVolunteerCount = await db.UserProject.count({
        where: { projectId: projectId }
      });
      const volunteeringNS = getVolunteeringNS();
      volunteeringNS.emit('volunteer_count_updated', {
        projectId: projectId,
        enrolled: updatedVolunteerCount,
        capacity: project.capacity
      });
      logger.info(`Volunteer count updated for project ${projectId}: ${updatedVolunteerCount}/${project.capacity}`);
    } catch (socketError) {
      logger.error(`Error emitting WebSocket event: ${socketError.message}`);
      // Don't fail the request if WebSocket fails
    }

    return res.status(200).json({ message: 'Volunteer rejected and banned' });
  } catch (err) {
    console.error('Reject volunteer error', err.message);
    return res.status(500).json({ message: 'Error rejecting volunteer' });
  }
};

// User self-unregister from a project; delete their UserProject row and ban them from re-registering
exports.unregisterUser = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    const userId = req.user.id;
    const record = await db.UserProject.findOne({ where: { userId, projectId } });
    if (!record) return res.status(404).json({ message: 'Not registered to project' });
    
    const project = await Project.findByPk(projectId);
    
    await record.destroy();
    // Add ban so the user cannot re-register
    await db.UserProjectBan.findOrCreate({ where: { userId, projectId }, defaults: { reason: 'User unsubscribed' } });

    // Emit WebSocket event to update volunteer count
    try {
      const updatedVolunteerCount = await db.UserProject.count({
        where: { projectId: projectId }
      });
      const volunteeringNS = getVolunteeringNS();
      volunteeringNS.emit('volunteer_count_updated', {
        projectId: projectId,
        enrolled: updatedVolunteerCount,
        capacity: project.capacity
      });
      logger.info(`Volunteer count updated for project ${projectId}: ${updatedVolunteerCount}/${project.capacity}`);
    } catch (socketError) {
      logger.error(`Error emitting WebSocket event: ${socketError.message}`);
      // Don't fail the request if WebSocket fails
    }

    return res.status(200).json({ message: 'Unregistered from project and banned' });
  } catch (err) {
    console.error('Unregister error', err.message);
    return res.status(500).json({ message: 'Error unregistering from project' });
  }
};

// Admin unban a volunteer (remove ban so they can register again)
exports.unbanVolunteer = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const volunteerId = parseInt(req.params.userId, 10);
    const ban = await db.UserProjectBan.findOne({ where: { userId: volunteerId, projectId } });
    if (!ban) return res.status(404).json({ message: 'Ban not found' });
    await ban.destroy();
    return res.status(200).json({ message: 'Unbanned user from project' });
  } catch (err) {
    console.error('Unban volunteer error', err.message);
    return res.status(500).json({ message: 'Error unbanning volunteer' });
  }
};

// Exposed for tests
exports._resolveOwnerId = resolveOwnerId;
