const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../config/secrets");

function generateToken(user) {
  if (!user) return null;

  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, getJwtSecret(), { algorithm: "HS256", expiresIn: "24h" });
}

function getCleanUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

module.exports = {
  generateToken,
  getCleanUser,
};
