"use strict";

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const START_JS = path.join(ROOT, "start.js");

let currentProcess = null;
let logCallback = null;
let isRunning = false;

function setLogCallback(cb) {
  logCallback = cb;
}

function log(level, msg) {
  if (logCallback) {
    logCallback(level, msg);
  } else {
    console.log("[" + level + "] " + msg);
  }
}

function isServerRunning() {
  return isRunning && currentProcess !== null && !currentProcess.killed;
}

function start() {
  return new Promise(function (resolve) {
    if (isServerRunning()) {
      return resolve({ success: false, error: "Server is already running" });
    }

    if (!fs.existsSync(START_JS)) {
      return resolve({ success: false, error: "start.js not found at " + START_JS });
    }

    log("info", "Starting server: node start.js");

    currentProcess = spawn(process.execPath, [START_JS], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false
    });

    isRunning = true;

    currentProcess.stdout.on("data", function (buf) {
      const lines = buf.toString().split("\n").filter(Boolean);
      lines.forEach(function (line) { log("stdout", line); });
    });

    currentProcess.stderr.on("data", function (buf) {
      const lines = buf.toString().split("\n").filter(Boolean);
      lines.forEach(function (line) { log("stderr", line); });
    });

    currentProcess.on("error", function (err) {
      log("error", "Process error: " + err.message);
      isRunning = false;
      currentProcess = null;
    });

    currentProcess.on("exit", function (code, signal) {
      log("info", "Server exited (code=" + code + ", signal=" + signal + ")");
      isRunning = false;
      currentProcess = null;
    });

    setTimeout(function () {
      resolve({ success: true, pid: currentProcess.pid });
    }, 1000);
  });
}

function stop() {
  return new Promise(function (resolve) {
    if (!currentProcess || currentProcess.killed) {
      isRunning = false;
      return resolve({ success: false, error: "Server is not running" });
    }

    log("info", "Stopping server (SIGTERM)...");

    const killTimeout = setTimeout(function () {
      if (currentProcess && !currentProcess.killed) {
        log("warn", "Force killing server...");
        try { process.kill(currentProcess.pid, "SIGKILL"); } catch (e) {}
      }
    }, 10000);

    currentProcess.on("exit", function () {
      clearTimeout(killTimeout);
      isRunning = false;
      currentProcess = null;
      resolve({ success: true });
    });

    try {
      currentProcess.kill("SIGTERM");
    } catch (e) {
      clearTimeout(killTimeout);
      isRunning = false;
      currentProcess = null;
      resolve({ success: true });
    }
  });
}

function restart() {
  return new Promise(function (resolve) {
    var settled = false;
    var guard = function (result) {
      if (!settled) { settled = true; resolve(result); }
    };
    var safetyTimer = setTimeout(function () {
      isRunning = false;
      currentProcess = null;
      guard({ success: false, error: 'Restart timed out after 25s' });
    }, 25000);
    stop().then(function () {
      setTimeout(function () {
        start().then(function (startResult) {
          clearTimeout(safetyTimer);
          guard(startResult);
        });
      }, 2000);
    });
  });
}

function getStatus() {
  if (isServerRunning()) {
    return {
      running: true,
      pid: currentProcess ? currentProcess.pid : null
    };
  }
  return { running: false, pid: null };
}

module.exports = {
  setLogCallback,
  isServerRunning,
  start,
  stop,
  restart,
  getStatus
};
