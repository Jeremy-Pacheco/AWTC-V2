const { User } = require("../models");
const utils = require("../utils/utils");
const authService = require("../services/auth.service");

// Maps validation errors from the auth service / Sequelize to a 400 response
function sendRegistrationError(res, error, fallbackMessage) {
  if (error && error.status === 400) {
    return res.status(400).json({ message: error.message });
  }
  if (error && (error.name === "SequelizeValidationError" || error.name === "SequelizeUniqueConstraintError")) {
    return res.status(400).json({ message: "Invalid or already registered email" });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({ message: fallbackMessage });
}

// Create user (registration)
exports.createUser = async (req, res) => {
  try {
    // Accept either `name` or `firstName` + `lastName`
    let { name, email, password, firstName, lastName } = req.body;
    if (!name && firstName && lastName) {
      name = `${firstName} ${lastName}`.trim();
    }

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing data" });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    const user = await authService.registerUser({ name, email, password, role: "volunteer" });

    const token = utils.generateToken(user);
    const cleanUser = utils.getCleanUser(user);

    res.status(201).json({
      message: "User created successfully",
      user: cleanUser,
      access_token: token,
    });
  } catch (error) {
    sendRegistrationError(res, error, "Error creating user");
  }
};

// User login
exports.login = async (req, res) => {
  try {
    let email, password;

    // Check for Basic Auth header (email:password in base64)
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Basic ")) {
      const base64Credentials = authHeader.split(" ")[1] || "";
      // UTF-8 (not ASCII) and split on the FIRST colon only: passwords may contain ':'
      const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
      const separator = credentials.indexOf(":");
      if (separator > 0) {
        email = credentials.slice(0, separator);
        password = credentials.slice(separator + 1);
      }
    }
    // Check for JSON body (email and password in request body)
    else if (req.body && req.body.email && req.body.password) {
      email = req.body.email;
      password = req.body.password;
    }

    if (!email || !password) {
      return res.status(400).json({ message: "Authorization header or email/password body required" });
    }

    // Same response for unknown email and wrong password: no user enumeration
    const user = await authService.authenticate(email, password);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = utils.generateToken(user);
    const cleanUser = utils.getCleanUser(user);

    res.json({
      message: "Login successful",
      user: cleanUser,
      access_token: token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error signing in" });
  }
};

// Create coordinator (admin only, validated in middleware)
exports.createCoordinator = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing data" });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    const user = await authService.registerUser({ name, email, password, role: "coordinator" });

    res.status(201).json({ message: "Coordinator created successfully", user: utils.getCleanUser(user) });
  } catch (error) {
    sendRegistrationError(res, error, "Error creating coordinator");
  }
};

// Get all users (admin or coordinator only, validated in middleware)
exports.getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "name", "email", "role", "profileImage"],
    });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error retrieving users" });
  }
};

// Update user role (admin only, validated in middleware)
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["volunteer", "coordinator", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    await user.update({ role });
    res.json({ message: `User role updated to ${role}`, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating role" });
  }
};

// Delete user (admin only, validated in middleware)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    await user.destroy();
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting user" });
  }
};

// Update own profile (name and profile image)
exports.updateOwnProfile = async (req, res) => {
  try {
    const user = req.user;
    const { name } = req.body;
    let updatedData = {};

    if (name && name.trim() !== "") {
      updatedData.name = name.trim();
    }

    if (req.file) {
      // Save only the filename
      updatedData.profileImage = req.file.filename;
    }

    await user.update(updatedData);

    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
    };

    res.json({
      message: "Profile updated successfully",
      user: userData,
    });
  } catch (err) {
    console.error("Error updating own profile:", err);
    res.status(500).json({ message: "Error updating profile" });
  }
};

exports.getOwnProfile = async (req, res) => {
  try {
    const user = req.user;

    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage || null,
    };

    res.json({ user: userData });
  } catch (err) {
    console.error("Error fetching own profile:", err);
    res.status(500).json({ message: "Error fetching profile" });
  }
};

// Return projects associated with current user
exports.getOwnProjects = async (req, res) => {
  try {
    const user = req.user;
    const projects = await user.getProjects({ through: { attributes: ['status', 'role'] } });
    return res.json({ projects });
  } catch (err) {
    console.error('Error fetching user projects:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Return bans for current user
exports.getOwnBans = async (req, res) => {
  try {
    const user = req.user;
    const { UserProjectBan, Project } = require('../models');
    const bans = await UserProjectBan.findAll({ 
      where: { userId: user.id }, 
      include: [{ model: Project }] 
    });
    const projects = bans.map(b => ({ id: b.projectId, name: b.Project ? b.Project.name : null, reason: b.reason }));
    return res.json({ projects });
  } catch (err) {
    console.error('Error fetching user bans:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Admin/coordinator: get projects for a specific user
exports.getUserProjects = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const projects = await user.getProjects({ through: { attributes: ['status', 'role'] } });
    return res.json({ projects });
  } catch (err) {
    console.error('Error fetching user projects:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Admin/coordinator: get banned projects for a specific user
exports.getUserBans = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Import models in runtime to avoid circular dependencies
    const { UserProjectBan, Project } = require('../models');
    const bans = await UserProjectBan.findAll({ where: { userId: id }, include: [{ model: Project }] });
    const projects = bans.map(b => ({ id: b.projectId, name: b.Project ? b.Project.name : null }));
    return res.json({ projects });
  } catch (err) {
    console.error('Error fetching user bans:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Delete own profile (dashboard) - authenticated user
exports.deleteOwnProfile = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    // Optionally: remove related associations; for now, just destroy user record
    await user.destroy();
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting own profile:', err);
    res.status(500).json({ message: 'Error deleting profile' });
  }
};
