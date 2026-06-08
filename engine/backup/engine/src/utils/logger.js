"use strict";

const fs = require("fs");
const path = require("path");

const LOG_DIR = path.resolve(__dirname, "..", "..", "..", "data", "database", "logs");
const CRASH_DIR = path.resolve(__dirname, "..", "..", "..", "data", "database", "crashes");
const RECENT_ACTIONS_MAX = 1000;

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

const Logger = function (options) {
  options = options || {};
  this.minLevel = options.minLevel || LOG_LEVELS.INFO;
  this.recentActions = [];
  this._currentDate = null;
  this._stream = null;
};

Logger.prototype._ensureDir = function () {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
  if (!fs.existsSync(CRASH_DIR)) {
    fs.mkdirSync(CRASH_DIR, { recursive: true });
  }
};

Logger.prototype._getDateStr = function () {
  var d = new Date();
  return d.getFullYear() +
    "-" + String(d.getMonth() + 1).padStart(2, "0") +
    "-" + String(d.getDate()).padStart(2, "0");
};

Logger.prototype._rotate = function () {
  var dateStr = this._getDateStr();
  if (dateStr === this._currentDate && this._stream) return;

  this._ensureDir();

  if (this._stream) {
    try { this._stream.end(); } catch (e) {}
  }

  var filePath = path.join(LOG_DIR, "server-" + dateStr + ".log");
  this._stream = fs.createWriteStream(filePath, { flags: "a" });
  this._currentDate = dateStr;
};

Logger.prototype._write = function (entry) {
  var line = JSON.stringify(entry) + "\n";

  this._rotate();
  try {
    this._stream.write(line);
  } catch (e) {
    console.error("Logger write error:", e.message);
  }

  // Keep circular buffer of recent actions
  this.recentActions.push(entry);
  if (this.recentActions.length > RECENT_ACTIONS_MAX) {
    this.recentActions.shift();
  }
};

Logger.prototype._format = function (level, module, action, data) {
  return {
    ts: new Date().toISOString(),
    level: level,
    module: module,
    action: action,
    data: data || null
  };
};

Logger.prototype.log = function (level, module, action, data) {
  if (typeof level === "string" && !data) {
    // Called as log(level, module, action, data)
    var lvl = level.toUpperCase();
    if (LOG_LEVELS[lvl] < this.minLevel) return;
    this._write(this._format(lvl, module, action, data));
  } else if (typeof level === "string") {
    // Called as log(module, action, data)
    if (LOG_LEVELS.INFO < this.minLevel) return;
    this._write(this._format("INFO", level, action, module));
  } else {
    // Called as log() — gameloop tick statistics
    if (LOG_LEVELS.INFO < this.minLevel) return;
    this._write(this._format("INFO", "gameloop", "tick", { tick: process.gameServer && process.gameServer.world ? process.gameServer.world.tickCounter : null }));
  }
};

Logger.prototype.debug = function (action, data) {
  if (LOG_LEVELS.DEBUG < this.minLevel) return;
  this._write(this._format("DEBUG", null, action, data));
};

Logger.prototype.info = function (module, action, data) {
  if (LOG_LEVELS.INFO < this.minLevel) return;
  this._write(this._format("INFO", module, action, data));
};

Logger.prototype.warn = function (module, action, data) {
  if (LOG_LEVELS.WARN < this.minLevel) return;
  this._write(this._format("WARN", module, action, data));
};

Logger.prototype.error = function (module, action, data) {
  if (LOG_LEVELS.ERROR < this.minLevel) return;
  this._write(this._format("ERROR", module, action, data));
};

Logger.prototype.fatal = function (module, action, data) {
  if (LOG_LEVELS.FATAL < this.minLevel) return;
  this._write(this._format("FATAL", module, action, data));
};

Logger.prototype.writeCrashReport = function (crashData) {
  this._ensureDir();
  var timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  var filePath = path.join(CRASH_DIR, timestamp + "-crash.json");

  crashData.recent_actions = this.recentActions.slice(-100);

  try {
    fs.writeFileSync(filePath, JSON.stringify(crashData, null, 2));
    console.log("Crash report written: " + filePath);
  } catch (e) {
    console.error("Failed to write crash report:", e.message);
  }

  return filePath;
};

Logger.prototype.close = function () {
  if (this._stream) {
    try { this._stream.end(); } catch (e) {}
    this._stream = null;
  }
};

module.exports = Logger;
