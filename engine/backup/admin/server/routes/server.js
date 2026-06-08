"use strict";

const express = require("express");
const bridge = require("../lib/game-bridge");
const pm = require("../lib/process-manager");

const router = express.Router();

router.get("/status", function (req, res) {
  const pmStatus = pm.getStatus();
  res.json(pmStatus);
});

router.post("/start", async function (req, res) {
  const result = await pm.start();
  res.json(result);
});

router.post("/stop", async function (req, res) {
  const result = await pm.stop();
  res.json(result);
});

router.post("/restart", async function (req, res) {
  const result = await pm.restart();
  res.json(result);
});

router.post("/save", async function (req, res) {
  const result = await bridge.saveAll();
  res.json(result);
});

router.post("/shutdown", async function (req, res) {
  const result = await bridge.shutdown();
  res.json(result);
});

router.post("/broadcast", async function (req, res) {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }
  const result = await bridge.broadcast(message);
  res.json(result);
});

module.exports = router;
