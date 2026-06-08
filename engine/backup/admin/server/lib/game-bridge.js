"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const ENGINE_HOST = process.env.ADMIN_HOST || "127.0.0.1";
const ENGINE_PORT = parseInt(process.env.ADMIN_PORT || "2224", 10);

function loadAdminSecret() {
  if (process.env.ADMIN_SECRET) return process.env.ADMIN_SECRET;
  try {
    const envPath = path.resolve(__dirname, "..", "..", "..", "engine", ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      const match = content.match(/^ADMIN_SECRET=(.+)$/m);
      if (match) {
        const secret = match[1].trim();
        if (!secret.startsWith("CHANGE_ME")) return secret;
      }
    }
  } catch (e) { /* ignore */ }
  console.error("[FATAL] ADMIN_SECRET not configured. Add ADMIN_SECRET to engine/.env");
  process.exit(1);
}

const ADMIN_SECRET = loadAdminSecret();

function apiRequest(method, path, body) {
  return new Promise(function (resolve, reject) {
    const jsonBody = body ? JSON.stringify(body) : null;
    const options = {
      hostname: ENGINE_HOST,
      port: ENGINE_PORT,
      path: path,
      method: method,
      headers: {
        "Authorization": "Bearer " + ADMIN_SECRET,
        "Content-Type": "application/json"
      },
      timeout: 5000
    };
    if (jsonBody) {
      options.headers["Content-Length"] = Buffer.byteLength(jsonBody);
    }
    const req = http.request(options, function (res) {
      let data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: "Invalid JSON response", raw: data });
        }
      });
    });
    req.on("error", function (err) {
      resolve({ error: err.message, code: "CONNECTION_REFUSED" });
    });
    req.on("timeout", function () {
      req.destroy();
      resolve({ error: "Timeout", code: "TIMEOUT" });
    });
    if (jsonBody) req.write(jsonBody);
    req.end();
  });
}

function getStatus() {
  return apiRequest("GET", "/api/status");
}

function getPlayers() {
  return apiRequest("GET", "/api/players");
}

function broadcast(message) {
  return apiRequest("POST", "/api/broadcast", { message: message });
}

function saveAll() {
  return apiRequest("POST", "/api/save");
}

function shutdown() {
  return apiRequest("POST", "/api/shutdown");
}

function kickPlayer(name) {
  return apiRequest("POST", "/api/kick", { name: name });
}

function updatePlayer(body) {
  return apiRequest("POST", "/api/player", body);
}

function updatePremiumPoints(name, amount) {
  return apiRequest("POST", "/api/premium", { name: name, amount: amount });
}

module.exports = {
  getStatus,
  getPlayers,
  broadcast,
  saveAll,
  shutdown,
  kickPlayer,
  updatePlayer,
  updatePremiumPoints
};
