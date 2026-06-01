"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../lib/database");

const router = express.Router();

router.post("/login", function (req, res) {
  const { account, password } = req.body;
  if (!account || !password) {
    return res.status(400).json({ error: "Account and password are required" });
  }

  const creds = db.getAccountCredentials(account);
  if (!creds) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (creds.group_id < 5) {
    return res.status(403).json({ error: "Access denied. Insufficient permissions." });
  }

  const match = bcrypt.compareSync(password, creds.hash);
  if (!match) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  req.session.admin = {
    account: creds.id,
    group_id: creds.group_id
  };

  res.json({ success: true, account: creds.id });
});

router.post("/logout", function (req, res) {
  req.session.destroy(function () {
    res.json({ success: true });
  });
});

router.get("/check", function (req, res) {
  if (req.session && req.session.admin) {
    return res.json({ authenticated: true, account: req.session.admin.account });
  }
  res.json({ authenticated: false });
});

module.exports = router;
