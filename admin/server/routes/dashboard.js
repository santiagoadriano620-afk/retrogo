"use strict";

const express = require("express");
const db = require("../lib/database");
const bridge = require("../lib/game-bridge");

const router = express.Router();

router.get("/", async function (req, res) {
  const engineStatus = await bridge.getStatus();
  const totalPlayers = db.getTotalCharacterCount();
  const totalAccounts = db.getTotalAccountCount();

  res.json({
    server: engineStatus,
    database: {
      totalCharacters: totalPlayers,
      totalAccounts: totalAccounts
    }
  });
});

module.exports = router;
