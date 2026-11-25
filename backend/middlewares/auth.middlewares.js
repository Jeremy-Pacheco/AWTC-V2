const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { getJwtSecret } = require("../config/secrets");
const { parseBasicAuth } = require("../utils/basicAuth");

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];

    // No Authorization -> continue without user
    if (!authHeader) {
      req.user = null;
      return next();
    }

    // Basic Auth
    if (authHeader.startsWith("Basic ")) {
      // UTF-8 and split on the first ":" only (BUG-03, utils/basicAuth.js):
      // the old ASCII decoding corrupted accents and cut passwords at ":"
      const credentials = parseBasicAuth(authHeader);
      if (!credentials)
        return res.status(400).json({ message: "Basic auth malformed" });

      req.body = req.body || {};
      req.body.email = credentials.email;
      req.body.password = credentials.password;

      return next();
    }

    // Bearer Token
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      let payload;

      try {
        payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
      } catch (err) {
        req.user = null;
        return next();
      }

      const user = await User.findByPk(payload.id);
      req.user = user || null;
      req.token = token;
      return next();
    }

    req.user = null;
    return next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    req.user = null;
    return next();
  }
};
