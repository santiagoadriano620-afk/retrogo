"use strict";

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized. Please login." });
}

module.exports = { requireAdmin };
