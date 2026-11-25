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

  // Short-lived access token (SEC-18); sessions are renewed with the refresh
  // cookie (services/token.service.js)
  return jwt.sign(payload, getJwtSecret(), { algorithm: "HS256", expiresIn: process.env.ACCESS_TOKEN_TTL || "15m" });
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
