const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");

// Load .env file if it exists (now in engine/ dir alongside require.js)
const dotenvPath = path.join(__dirname, ".env");
if (fs.existsSync(dotenvPath)) {
  try {
    require("dotenv").config({ path: dotenvPath });
  } catch (e) {
    console.warn("dotenv failed to load .env file:", e.message);
  }
} else {
  console.warn("No .env file found at %s — using defaults from config.js. Copy .env.example to .env for production.", dotenvPath);
}

global.CONFIG = require("./config");

// Override config values from environment variables using centralized mapper
const { mapEnvironmentToConfig } = require("./lib/env-mapper");
mapEnvironmentToConfig(global.CONFIG);

// Validate required secrets in production
if (global.CONFIG.SERVER.PRODUCTION || process.env.DEV_MODE === "false") {
  if (!global.CONFIG.HMAC.SHARED_SECRET || global.CONFIG.HMAC.SHARED_SECRET.startsWith("CHANGE_ME") || global.CONFIG.HMAC.SHARED_SECRET.startsWith("0000")) {
    console.error("[FATAL] HMAC_SECRET is not set or still has default value. Generate one and add to .env:");
    console.error("  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    process.exit(1);
  }
  if (!global.CONFIG.ADMIN.SECRET || global.CONFIG.ADMIN.SECRET.startsWith("CHANGE_ME") || global.CONFIG.ADMIN.SECRET === "changeme") {
    console.error("[FATAL] ADMIN_SECRET is not set or still has default value. Generate one and add to .env:");
    console.error("  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    process.exit(1);
  }
}

// Warn about dev mode
if (process.env.DEV_MODE !== "false" && process.env.DEV_MODE !== "0" && global.CONFIG.devMode !== false) {
  console.warn("⚠  Server running in DEVELOPMENT mode. Set DEV_MODE=false in .env for production.");
}

global.getDataFile = function () {
  return path.join(ROOT, "data", ...arguments);
};

global.requireData = function () {
  return require(getDataFile(...arguments));
};

global.requireModule = function () {
  return require(path.join(__dirname, "src", ...arguments));
};

requireModule("utils/__proto__");

global.CONST = require(path.join(ROOT, "client", "things", "constants.json"));

// Validate CONST has all expected keys — helps catch path/resolution issues early
var REQUIRED_CONST_KEYS = ["SKULL", "VOCATION", "PROPERTIES", "DIRECTION", "FLUID"];
for (var i = 0; i < REQUIRED_CONST_KEYS.length; i++) {
  var key = REQUIRED_CONST_KEYS[i];
  if (typeof CONST[key] === "undefined") {
    console.error(
      "[FATAL] CONST.%s is undefined after loading constants.json from %s".format(
        key,
        path.join(ROOT, "client", "things", "constants.json")
      )
    );
    console.error("[FATAL] Available CONST keys: %s".format(Object.keys(CONST).join(", ")));
    process.exit(1);
  }
}

let [major] = process.versions.node.split(".");
if (major < 16) {
  console.log(
    "Could not launch gameserver: required version > 16.0.0 and current version: %s.".format(process.versions.node)
  );
  process.exit(1);
}
