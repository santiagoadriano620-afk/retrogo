"use strict";

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { URL } = require("url");

const AccountDatabase = requireModule("auth/account-database");
const RateLimiter = requireModule("auth/rate-limiter");
const Cache = requireModule("utils/cache");
const { isNameAllowed } = requireModule("utils/forbidden-names");

function getLevelFromExperience(exp) {
  if (!exp || exp <= 0) return 1;
  for (let lvl = 1; lvl <= 1000; lvl++) {
    let required = Math.round((50 / 3) * (Math.pow(lvl, 3) - 6 * Math.pow(lvl, 2) + 17 * lvl - 12));
    if (required > exp) return lvl - 1;
  }
  return 1000;
}

// ─── Stripe Payment Utilities ─────────────────────────────────────────────────
function loadEnvVar(key) {
  if (process.env[key]) return process.env[key];
  try {
    const envPath = path.join(__dirname, "..", "..", "engine", ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      const re = new RegExp("^" + key + "=(.+)$", "m");
      const match = content.match(re);
      if (match) {
        let val = match[1].trim();
        // Remove inline comments
        val = val.split("#")[0].trim();
        return val;
      }
    }
  } catch (e) { /* ignore */ }
  return null;
}

const STRIPE_SECRET = loadEnvVar("STRIPE_SECRET") || null;
let stripe = null;
if (STRIPE_SECRET) {
  try {
    const Stripe = require("stripe");
    stripe = Stripe(STRIPE_SECRET);
  } catch (e) {
    console.warn("Stripe library not available:", e.message);
  }
}

const LoginServer = function (host, port) {

  this.__host = CONFIG.LOGIN.HOST;
  this.__port = CONFIG.LOGIN.PORT;
  this.accountDatabase = new AccountDatabase();
  this.rateLimiter = new RateLimiter();
  this.__highscoreCache = new Cache({ maxSize: 50, ttlMs: 60000 });

  // Check for TLS configuration
  let tlsCertPath = CONFIG.TLS && CONFIG.TLS.CERT;
  let tlsKeyPath = CONFIG.TLS && CONFIG.TLS.KEY;
  let useTls = tlsCertPath && tlsKeyPath && fs.existsSync(tlsCertPath) && fs.existsSync(tlsKeyPath);

  // Create the server (HTTPS or HTTP depending on TLS config)
  if (useTls) {
    let tlsOptions = {
      cert: fs.readFileSync(tlsCertPath),
      key: fs.readFileSync(tlsKeyPath)
    };
    this.server = https.createServer(tlsOptions, this.__handleRequest.bind(this));
    this.__protocol = "https";
  } else {
    this.server = http.createServer(this.__handleRequest.bind(this));
    this.__protocol = "http";
    if (tlsCertPath || tlsKeyPath) {
      console.warn("TLS certificate or key file not found at configured paths. Falling back to HTTP.");
    }
  }

  this.server.on("listening", this.__handleListening.bind(this));
  this.server.on("close", this.__handleClose.bind(this));

  // Graceful close
  process.on("SIGINT", function () { this._cleanup(); this.server.close(); }.bind(this));
  process.on("SIGTERM", function () { this._cleanup(); this.server.close(); }.bind(this));

}

LoginServer.prototype._cleanup = function () {
  this.rateLimiter.cleanup();
  if (this.__highscoreCache) {
    this.__highscoreCache.cleanup();
    this.__highscoreCache = null;
  }
  if (LoginServer.prototype.__nonceCleanupInterval) {
    clearInterval(LoginServer.prototype.__nonceCleanupInterval);
    LoginServer.prototype.__nonceCleanupInterval = null;
  }
  if (LoginServer.prototype.__usedNonces) {
    LoginServer.prototype.__usedNonces.clear();
  }
};

LoginServer.prototype.__handleClose = function () {

  /*
   * LoginServer.__handleClose
   * Callback fired when the HTTP server is closed
   */

  this.accountDatabase.close();

}

LoginServer.prototype.__serveStaticFile = function (filePath, response, request) {

  let ext = path.extname(filePath).toLowerCase();
  let mimeTypes = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".json": "application/json",
    ".spr": "application/octet-stream",
    ".dat": "application/octet-stream",
    ".otfi": "application/octet-stream",
    ".ogg": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".woff2": "font/woff2",
    ".woff": "font/woff"
  };

  response.statusCode = 200;
  response.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
  response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  response.setHeader("Accept-Ranges", "bytes");

  // Compressible file types
  let compressible = {
    ".html": true, ".js": true, ".css": true,
    ".json": true, ".spr": true, ".dat": true
  };

  let acceptEncoding = request ? request.headers["accept-encoding"] || "" : "";
  let useGzip = compressible[ext] && acceptEncoding.includes("gzip");

  if (useGzip) {
    response.setHeader("Content-Encoding", "gzip");
    response.setHeader("Vary", "Accept-Encoding");
    fs.createReadStream(filePath).pipe(zlib.createGzip()).pipe(response);
  } else {
    response.setHeader("Content-Length", fs.statSync(filePath).size);
    var rs = fs.createReadStream(filePath);
    rs.on("error", function(e) { try { response.end(); } catch(_) {} });
    rs.pipe(response);
  }

}

LoginServer.prototype.__handleListening = function () {

  /*
   * LoginServer.__handleListening
   * Callback fired when the HTTP server is listening
   */

  console.log("Login server listening on %s://%s:%s.".format(this.__protocol, this.__host, this.__port));

}

LoginServer.prototype.__parseBody = function (request) {

  /*
   * LoginServer.__parseBody
   * Parses the request body as JSON. Returns a promise resolving to the parsed object.
   */

  return new Promise(function (resolve) {
    let body = "";
    request.on("data", function (chunk) { body += chunk; });
    request.on("end", function () {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
    request.on("error", function () { resolve({}); });
  });

}

LoginServer.prototype.__collectRawBody = function (request, callback) {

  /*
   * LoginServer.__collectRawBody
   * Collects the raw body as a Buffer for endpoints that need it (e.g. Stripe webhooks).
   */

  let chunks = [];
  request.on("data", function (chunk) { chunks.push(chunk); });
  request.on("end", function () {
    callback(Buffer.concat(chunks));
  });
  request.on("error", function () { callback(Buffer.alloc(0)); });

}

LoginServer.prototype.initialize = function () {

  /*
   * LoginServer.initialize
   * Starts the HTTP server and listens for incoming connections
   */

  this.server.listen(this.__port, this.__host);

}

LoginServer.prototype.__generateToken = function (name) {

  let expire = Date.now() + CONFIG.LOGIN.TOKEN_VALID_MS;
  let nonce = crypto.randomBytes(16).toString("hex");
  let payload = name + expire + nonce;

  let hmac = crypto.createHmac("sha256", CONFIG.HMAC.SHARED_SECRET).update(payload).digest("hex");

  let xorKey = CONFIG.ENCRYPTION.ENABLED
    ? crypto.createHmac("sha256", CONFIG.HMAC.SHARED_SECRET).update(payload).digest().subarray(0, 8)
    : null;

  return {
    name: name,
    expire: expire,
    nonce: nonce,
    hmac: hmac,
    xorKey: xorKey ? xorKey.toString("base64") : null
  };

}

LoginServer.prototype.__isValidCreateAccount = function (queryObject) {

  /*
   * LoginServer.__isValidCreateAccount
   * Returns true if the request to create the account is valid 
   */

  for (let property of ["account", "password", "name", "sex"]) {
    if (!Object.prototype.hasOwnProperty.call(queryObject, property)) {
      return false;
    }
  }

  // Accept only lower case letters for the character name
  if (!/^[a-z]+$/.test(queryObject.name)) {
    return false;
  }

  // Reject forbidden names (admin impersonation, profanity, etc.)
  if (!isNameAllowed(queryObject.name)) {
    return false;
  }

  // Must be male or female
  if (queryObject.sex !== "male" && queryObject.sex !== "female") {
    return false;
  }

  // Password must be alphanumeric only (no special characters)
  if (!/^[a-zA-Z0-9]+$/.test(queryObject.password)) {
    return false;
  }

  return true;

}

LoginServer.prototype.__createAccount = function (queryObject, response) {

  // Rate limit: max 2 account creations per IP per 60 seconds
  let ip = response.socket.remoteAddress || "unknown";
  if (!this.rateLimiter.check(ip, "create", 2, 60000)) {
    response.statusCode = 429;
    return response.end("Too many accounts created from this IP. Try again later.");
  }

  // Is valid
  if (!this.__isValidCreateAccount(queryObject)) {
    response.statusCode = 400;
    return response.end();
  }

  queryObject.ip = response.socket.remoteAddress;

  let refCode = queryObject.ref || "";
  let referrerId = null;

  if (refCode && CONFIG.REFERRAL.ENABLED) {
    referrerId = this.accountDatabase.getReferrerByCode(refCode);
  }

  this.accountDatabase.createAccount(queryObject, function (error, accountObject) {

    // Failure creating the account
    if (error !== null) {
      response.statusCode = error;
      return response.end();
    }

    // Register referral if valid code was provided
    if (referrerId) {
      let newAccountId = queryObject.account.toLowerCase();
      this.accountDatabase.createReferral(referrerId, newAccountId, refCode);
    }

    // Finish the HTTP response
    response.statusCode = 201;
    let body = referrerId ? JSON.stringify({ referral: true }) : "{}";
    response.end(body);

  }.bind(this))

}

LoginServer.prototype.__handleRequest = function (request, response) {

  /*
   * LoginServer.__handleRequest
   * Handles incoming HTTP requests
   */

  // Enabled CORS to allow requests from JavaScript
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "OPTIONS, GET, POST, DELETE, PUT");

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    return response.end();
  }

  // Only GET (static files, highscores, bans) and POST/PUT/DELETE (auth actions)
  if (request.method !== "GET" && request.method !== "POST" && request.method !== "PUT" && request.method !== "DELETE") {
    response.statusCode = 501;
    return response.end();
  }

  // Parse URL
  let requestObject, pathname;
  try {
    requestObject = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    pathname = requestObject.pathname;
  } catch (e) {
    response.statusCode = 400;
    return response.end();
  }

  // ── Stripe webhook needs raw body for signature verification ──
  if (request.method === "POST" && pathname === "/api/payments/webhook") {
    return this.__collectRawBody(request, function (rawBody) {
      this.__handlePaymentWebhook(request, response, rawBody);
    }.bind(this));
  }

  // ── All endpoints that need POST body parsing ──
  if (request.method === "POST" || request.method === "PUT" || request.method === "DELETE") {
    return this.__parseBody(request).then(function (body) {
      this.__handlePostRequest(request, response, pathname, body);
    }.bind(this));
  }

  // ── GET endpoints (static files, highscores, bans) ──

  // GET /api/highscores returns top players sorted by a skill
  if (pathname === "/api/highscores") {
    return this.__listHighscores(requestObject, response);
  }

  // GET /api/bans returns currently banned players (login screen)
  // GET /api/bans/list returns active bans with details (in-game god modal)
  // GET /api/bans/search?q=X searches characters by name (in-game god modal)
  // GET /api/bans/history returns ban history (in-game god modal)
  if (pathname === "/api/bans") {
    return this.__listBans(requestObject, response);
  }
  if (pathname === "/api/bans/list") {
    return this.__listActiveBans(requestObject, response);
  }
  if (pathname === "/api/bans/search") {
    return this.__searchBans(requestObject, response);
  }
  if (pathname === "/api/bans/history") {
    return this.__listBanHistory(requestObject, response);
  }

  // GET /api/deaths returns recent death records (login screen & in-game)
  if (pathname === "/api/deaths") {
    return this.__listDeaths(requestObject, response);
  }

  // GET /api/anticheat returns suspects and active cheaters (in-game god modal)
  if (pathname === "/api/anticheat") {
    return this.__listAntiCheat(response);
  }

  // GET /api/spr-version returns timestamps of .spr and .dat files for cache invalidation
  if (pathname === "/api/spr-version") {
    return this.__listSprVersion(response);
  }

  // GET /api/payments/config returns Stripe publishable key
  if (pathname === "/api/payments/config") {
    return this.__handlePaymentsConfig(response);
  }

  // Static file serving: try client/ first, then root data/
  let clientDir = path.join(__dirname, "..", "..", "..", "client");
  let dataDir = path.join(__dirname, "..", "..", "..", "data");
  let defaultDoc = "index.html";
  if (pathname === "/") {
    var ua = (request.headers["user-agent"] || "").toLowerCase();
    if (/mobi|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
      defaultDoc = "mobile.html";
    }
  }
  let filePath = path.join(clientDir, pathname === "/" ? defaultDoc : pathname);

  if (filePath.startsWith(clientDir)) {
    try {
      if (fs.statSync(filePath).isFile()) {
        this.__serveStaticFile(filePath, response, request);
        return;
      }
    } catch(_) {}
  }

  // Fallback to root data/
  filePath = path.join(dataDir, pathname);
  if (filePath.startsWith(dataDir)) {
    try {
      if (fs.statSync(filePath).isFile()) {
        this.__serveStaticFile(filePath, response, request);
        return;
      }
    } catch(_) {}
  }

  response.statusCode = 404;
  return response.end();

}

LoginServer.prototype.__handlePostRequest = function (request, response, pathname, body) {

  /*
   * LoginServer.__handlePostRequest
   * Handles POST/PUT/DELETE requests with parsed JSON body
   */

  // POST /api/login — authenticate (credentials in body, not URL)
  if (pathname === "/api/login") {
    return this.__getAccount(body, response);
  }

  // POST / — create account (credentials in body)
  if (pathname === "/" || pathname === "/api/register") {
    return this.__createAccount(body, response);
  }

  // POST /create-character
  if (pathname === "/create-character") {
    return this.__createCharacter(body, response);
  }

  // POST /delete-character
  if (request.method === "POST" && pathname === "/delete-character") {
    return this.__deleteCharacter(body, response);
  }

  // POST /api/bans — ban, unban, or update ban
  if (pathname === "/api/bans") {
    return this.__handleBanAction(body, response);
  }

  // POST /api/anticheat/confirm — mark player as cheater
  if (pathname === "/api/anticheat/confirm") {
    return this.__confirmCheater(body, response);
  }

  // POST /api/anticheat/dismiss — remove from suspect list
  if (pathname === "/api/anticheat/dismiss") {
    return this.__dismissSuspect(body, response);
  }

  // POST /api/anticheat/remove — remove cheater skull
  if (pathname === "/api/anticheat/remove") {
    return this.__removeCheater(body, response);
  }

  // POST /api/payments/create-payment-intent — create Stripe PaymentIntent
  if (pathname === "/api/payments/create-payment-intent") {
    return this.__handleCreatePaymentIntent(body, response);
  }

  // Fallback: try static file (client/ then root data/)
  let clientDir = path.join(__dirname, "..", "..", "..", "client");
  let dataDir = path.join(__dirname, "..", "..", "..", "data");
  let defaultDoc = "index.html";
  if (pathname === "/") {
    var ua = (request.headers["user-agent"] || "").toLowerCase();
    if (/mobi|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
      defaultDoc = "mobile.html";
    }
  }
  let filePath = path.join(clientDir, pathname === "/" ? defaultDoc : pathname);

  if (filePath.startsWith(clientDir)) {
    try {
      if (fs.statSync(filePath).isFile()) {
        this.__serveStaticFile(filePath, response, request);
        return;
      }
    } catch (_) {}
  }

  // Fallback to root data/
  filePath = path.join(dataDir, pathname);
  if (filePath.startsWith(dataDir)) {
    try {
      if (fs.statSync(filePath).isFile()) {
        this.__serveStaticFile(filePath, response, request);
        return;
      }
    } catch (_) {}
  }

  response.statusCode = 404;
  return response.end();

}

LoginServer.prototype.__getAccount = function (queryObject, response) {

  // Rate limit: max 5 attempts per IP per 60 seconds
  let ip = response.socket.remoteAddress || "unknown";
  if (!this.rateLimiter.check(ip, "login", 5, 60000)) {
    response.statusCode = 429;
    response.setHeader("Retry-After", Math.ceil(this.rateLimiter.getRemainingCooldown(ip, "login", 60000) / 1000));
    return response.end("Too many login attempts. Try again later.");
  }

  // Account or password were not supplied
  if (!queryObject.account || !queryObject.password) {
    response.statusCode = 401;
    return response.end();
  }

  this.accountDatabase.getAccountCredentials(queryObject.account, function (error, result) {

    // Database error or account does not exist
    if (error || result == null) {
      response.statusCode = 401;
      return response.end();
    }

    let premiumExpiry = result.premiumExpiry || 0;

    // Compare the submitted password with the hashed + salted password
    bcrypt.compare(queryObject.password, result.hash, function (error, isPasswordCorrect) {

      if (error) {
        response.statusCode = 500;
        return response.end();
      }

      if (!isPasswordCorrect) {
        response.statusCode = 401;
        return response.end();
      }

      // Fetch character data to return in the response
      this.accountDatabase.getCharacter(queryObject.account, function (error, result2) {

        if (error || !result2) {
          response.statusCode = 500;
          return response.end();
        }

        // Build character list from the characters array
        let OUTFIT_MIGRATION_MAP = {
          128: 111, 129: 112, 130: 113, 131: 114, 132: 115, 133: 116, 134: 117,
          136: 118, 137: 119, 138: 120, 139: 121, 140: 122, 141: 123, 142: 124,
          143: 69, 150: 62
        };
        let characters = [];
        for (let i = 0; i < result2.characters.length; i++) {
          let c = result2.characters[i];
          if (typeof c === "string") {
            c = JSON.parse(c);
          }
          if (typeof c === "string") {
            c = JSON.parse(c);
          }
          let outfit = c.properties ? c.properties.outfit || { details: { head: 0, body: 0, legs: 0, feet: 0 } } : { details: { head: 0, body: 0, legs: 0, feet: 0 } };
          if (outfit && OUTFIT_MIGRATION_MAP[outfit.id]) {
            outfit.id = OUTFIT_MIGRATION_MAP[outfit.id];
          }
          characters.push({
            name: c.properties ? c.properties.name || queryObject.account : queryObject.account,
            level: c.skills ? getLevelFromExperience(c.skills.experience) : 1,
            outfit: outfit
          });
        }

        // Generate token with embedded XOR key
        let tokenPayload = this.__generateToken(queryObject.account);

        // Valid return a HMAC token to be verified by the GameServer
        response.writeHead(200, { "Content-Type": "application/json" });

        // Return the host, token, character list, and premium info
        let referralData = {};
        if (CONFIG.REFERRAL.ENABLED) {
          referralData.refCode = this.accountDatabase.getReferralCode(queryObject.account);
          referralData.refStats = this.accountDatabase.getReferralStats(queryObject.account);
          referralData.refLevelRequired = CONFIG.REFERRAL.LEVEL_REQUIRED || 20;
          referralData.refRewardPoints = CONFIG.REFERRAL.REWARD_PREMIUM_POINTS || 10;
        }
        response.end(JSON.stringify(Object.assign({
          "token": Buffer.from(JSON.stringify(tokenPayload)).toString("base64"),
          "host": process.env.EXTERNAL_HOST || CONFIG.SERVER.EXTERNAL_HOST,
          "characters": characters,
          "premiumExpiry": premiumExpiry,
          "xorKey": tokenPayload.xorKey
        }, referralData)));

        // Check referral rewards for this account (referred characters level check)
        if (CONFIG.REFERRAL.ENABLED) {
          this.accountDatabase.checkAndRewardReferrals(queryObject.account);
        }

      }.bind(this));

    }.bind(this));

  }.bind(this));

}

LoginServer.prototype.__createCharacter = function (queryObject, response) {

  if (!queryObject.account || !queryObject.password || !queryObject.name || !queryObject.sex) {
    response.statusCode = 400;
    return response.end();
  }

  // Validate name (lowercase letters only)
  if (!/^[a-z]+$/.test(queryObject.name)) {
    response.statusCode = 400;
    return response.end();
  }

  // Reject forbidden names (admin impersonation, profanity, etc.)
  if (!isNameAllowed(queryObject.name)) {
    response.statusCode = 400;
    return response.end();
  }

  // Validate sex
  if (queryObject.sex !== "male" && queryObject.sex !== "female") {
    response.statusCode = 400;
    return response.end();
  }

  this.accountDatabase.getAccountCredentials(queryObject.account, function (error, result) {

    if (error || result == null) {
      response.statusCode = 401;
      return response.end();
    }

    bcrypt.compare(queryObject.password, result.hash, function (error, isPasswordCorrect) {

      if (error || !isPasswordCorrect) {
        response.statusCode = 401;
        return response.end();
      }

      this.accountDatabase.addCharacter(queryObject.account, queryObject, function (error, message) {

        if (error) {
          if (error === 403 || error === 409) {
            response.statusCode = error;
            return response.end(message || "");
          }
          response.statusCode = 500;
          return response.end();
        }

        response.statusCode = 201;
        response.end();

      }.bind(this));

    }.bind(this));

  }.bind(this));

}

LoginServer.prototype.__deleteCharacter = function (queryObject, response) {

  if (!queryObject.account || !queryObject.password || !queryObject.name) {
    response.statusCode = 401;
    return response.end();
  }

  this.accountDatabase.getAccountCredentials(queryObject.account, function (error, result) {

    if (error || result == null) {
      response.statusCode = 401;
      return response.end();
    }

    bcrypt.compare(queryObject.password, result.hash, function (error, isPasswordCorrect) {

      if (error) {
        response.statusCode = 500;
        return response.end();
      }

      if (!isPasswordCorrect) {
        response.statusCode = 401;
        return response.end();
      }

      this.accountDatabase.deleteCharacter(queryObject.account, queryObject.name, function (error) {

        if (error) {
          response.statusCode = 500;
          return response.end();
        }

        response.statusCode = 200;
        response.end();

      }.bind(this));

    }.bind(this));

  }.bind(this));

};

LoginServer.prototype.__listHighscores = function (requestObject, response) {

  let skillFilter = requestObject.searchParams.get("skill") || "experience";
  let vocationFilter = parseInt(requestObject.searchParams.get("vocation"), 10) || -1;
  let order = requestObject.searchParams.get("order") || "desc";
  let limit = parseInt(requestObject.searchParams.get("limit"), 10) || 5;
  let offset = parseInt(requestObject.searchParams.get("offset"), 10) || 0;

  // Cache key based on query params
  let cacheKey = "hs:" + skillFilter + ":" + vocationFilter + ":" + order + ":" + limit + ":" + offset;
  let cached = this.__highscoreCache.get(cacheKey);
  if (cached !== undefined) {
    response.setHeader("Content-Type", "application/json");
    response.statusCode = 200;
    return response.end(JSON.stringify(cached));
  }

  const SKILL_KEYS = ["magic", "fist", "club", "sword", "axe", "distance", "shielding", "fishing", "experience"];

  function getSkillPoints(skills, key) {
    return skills && skills[key] !== undefined ? skills[key] : 0;
  }

  function skillLevel(points, skillKey, vocation) {
    if (skillKey === "experience") return getLevelFromExperience(points);
    if (points <= 0) return 0;

    let offset = skillKey === "magic" ? 0 : 10;
    let A = { magic: 1600, fist: 50, club: 50, sword: 50, axe: 50, distance: 25, shielding: 100, fishing: 20 }[skillKey] || 50;
    let B = 1.1;

    let v = vocation || 0;
    if (v === 0) {
      if (skillKey === "magic") B = 3.0;
      else if (["club", "sword", "axe", "distance"].includes(skillKey)) B = 2.0;
      else if (["fist", "shielding"].includes(skillKey)) B = 1.5;
    } else if (v === 1 || v === 5) {
      if (skillKey === "magic") B = 3.0;
      else if (skillKey === "distance") B = 1.4;
      else B = 1.1;
    } else if (v === 2 || v === 6) {
      if (skillKey === "magic") B = 1.4;
      else if (["club", "sword", "axe", "fist"].includes(skillKey)) B = 1.2;
      else B = 1.1;
    } else if (v === 3 || v === 7) {
      if (skillKey === "magic") B = 1.1;
      else if (["club", "sword", "axe", "distance"].includes(skillKey)) B = 2.0;
      else if (["fist", "shielding"].includes(skillKey)) B = 1.5;
    } else if (v === 4 || v === 8) {
      if (skillKey === "magic") B = 1.1;
      else if (["club", "sword", "axe", "distance"].includes(skillKey)) B = 1.8;
      else if (["fist", "shielding"].includes(skillKey)) B = 1.5;
    }

    return Math.floor(offset + (Math.log(points * ((B - 1) / A) + 1) / Math.log(B)));
  }

  try {
    let allRows = this.accountDatabase.db.prepare("SELECT data FROM characters").all();
    let entries = [];
    let totalBeforeFilter = 0;

    for (let i = 0; i < allRows.length; i++) {
      try {
        let p = JSON.parse(allRows[i].data);
        let props = p.properties || {};
        let name = props.name;
        if (!name) continue;
        let vocation = props.vocation || 0;
        if (vocationFilter >= 0 && vocation !== vocationFilter) continue;
        let skills = p.skills || {};
        let expPoints = getSkillPoints(skills, "experience");

        entries.push({
          name: name,
          level: getLevelFromExperience(expPoints),
          vocation: vocation,
          sex: props.sex || 0,
          outfit: props.outfit || null,
          experience: expPoints,
          magic: getSkillPoints(skills, "magic"),
          fist: getSkillPoints(skills, "fist"),
          club: getSkillPoints(skills, "club"),
          sword: getSkillPoints(skills, "sword"),
          axe: getSkillPoints(skills, "axe"),
          distance: getSkillPoints(skills, "distance"),
          shielding: getSkillPoints(skills, "shielding"),
          fishing: getSkillPoints(skills, "fishing")
        });
      } catch (_) {}
    }

    let total = entries.length;

    let sortKey = SKILL_KEYS.includes(skillFilter) ? skillFilter : "experience";
    entries.sort(function (a, b) {
      return order === "asc" ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey];
    });

    entries = entries.slice(offset, offset + limit).map(function (e, i) {
      return {
        rank: offset + i + 1,
        name: e.name,
        level: e.level,
        vocation: e.vocation,
        sex: e.sex,
        outfit: e.outfit,
        skillValue: skillLevel(e[sortKey], sortKey, e.vocation),
        skillPoints: e[sortKey]
      };
    });

    var result = { entries: entries, total: total };
    this.__highscoreCache.set(cacheKey, result);
    response.setHeader("Content-Type", "application/json");
    response.statusCode = 200;
    response.end(JSON.stringify(result));
  } catch (error) {
    console.error("Highscore error:", error);
    response.statusCode = 500;
    response.end(JSON.stringify({ error: "Internal server error" }));
  }

};

LoginServer.prototype.__listBans = function (requestObject, response) {
  let limit = parseInt(requestObject.searchParams.get("limit"), 10) || 5;
  let offset = parseInt(requestObject.searchParams.get("offset"), 10) || 0;

  try {
    let result = this.accountDatabase.getBansList(limit, offset);
    let entries = (result.entries || []).map(function (b) {
      let row = null;
      try {
        row = this.accountDatabase.db.prepare(
          "SELECT data FROM characters WHERE LOWER(name) = LOWER(?)"
        ).get(b.character_name);
      } catch (_) {}
      let p = row ? JSON.parse(row.data) : {};
      let props = p.properties || {};
      return {
        name: b.character_name,
        level: props.level || 1,
        vocation: props.vocation || 0,
        outfit: props.outfit || null,
        reason: b.reason || "",
        days: b.days || 0,
        expires_at: b.expires_at || 0
      };
    }.bind(this));

    response.setHeader("Content-Type", "application/json");
    response.statusCode = 200;
    response.end(JSON.stringify({ entries: entries, total: result.total }));
  } catch (error) {
    console.error("Bans error:", error);
    response.statusCode = 500;
    response.end(JSON.stringify({ error: "Internal server error" }));
  }
};

LoginServer.prototype.__listActiveBans = function (requestObject, response) {
  let limit = parseInt(requestObject.searchParams.get("limit"), 10) || 5;
  let offset = parseInt(requestObject.searchParams.get("offset"), 10) || 0;

  try {
    let result = this.accountDatabase.getBansList(limit, offset);
    response.setHeader("Content-Type", "application/json");
    response.statusCode = 200;
    response.end(JSON.stringify({ entries: result.entries, total: result.total }));
  } catch (error) {
    console.error("Active bans error:", error);
    response.statusCode = 500;
    response.end(JSON.stringify({ error: "Internal server error" }));
  }
};

LoginServer.prototype.__listBanHistory = function (requestObject, response) {
  let limit = parseInt(requestObject.searchParams.get("limit"), 10) || 5;
  let offset = parseInt(requestObject.searchParams.get("offset"), 10) || 0;

  try {
    let result = this.accountDatabase.getBansHistory(limit, offset);
    response.setHeader("Content-Type", "application/json");
    response.statusCode = 200;
    response.end(JSON.stringify({ entries: result.entries, total: result.total }));
  } catch (error) {
    console.error("Ban history error:", error);
    response.statusCode = 500;
    response.end(JSON.stringify({ error: "Internal server error" }));
  }
};

LoginServer.prototype.__searchBans = function (requestObject, response) {
  let query = requestObject.searchParams.get("q") || "";

  try {
    let results = this.accountDatabase.searchCharacters(query);
    response.setHeader("Content-Type", "application/json");
    response.statusCode = 200;
    response.end(JSON.stringify({ results: results }));
  } catch (error) {
    console.error("Search bans error:", error);
    response.statusCode = 500;
    response.end(JSON.stringify({ error: "Internal server error" }));
  }
};

LoginServer.prototype.__handleBanAction = function (body, response) {
  let action = body.action;
  let name = body.name ? body.name.trim() : "";
  let days = parseInt(body.days, 10) || 0;
  let reason = body.reason || "";

  try {
    let result;
    if (action === "ban") {
      let bannedBy = body.banned_by || "Admin";
      result = this.accountDatabase.createBan(name, bannedBy, days, reason);
    } else if (action === "unban") {
      result = this.accountDatabase.removeBan(name);
    } else if (action === "update") {
      result = this.accountDatabase.updateBan(name, days, reason);
    } else {
      response.statusCode = 400;
      return response.end(JSON.stringify({ error: "Invalid action" }));
    }

    response.setHeader("Content-Type", "application/json");
    response.statusCode = result.success ? 200 : 500;
    response.end(JSON.stringify(result));
  } catch (error) {
    console.error("Ban action error:", error);
    response.statusCode = 500;
    response.end(JSON.stringify({ error: "Internal server error" }));
  }
};

LoginServer.prototype.__listDeaths = function (requestObject, response) {
  let limit = parseInt(requestObject.searchParams.get("limit"), 10) || 5;
  let offset = parseInt(requestObject.searchParams.get("offset"), 10) || 0;

  try {
    let result = this.accountDatabase.getDeathsList(limit, offset);
    let entries = (result.entries || []).map(function (d) {
      let row = null;
      try {
        row = this.accountDatabase.db.prepare(
          "SELECT data FROM characters WHERE LOWER(name) = LOWER(?)"
        ).get(d.character_name);
      } catch (_) {}
      let p = row ? JSON.parse(row.data) : {};
      let props = p.properties || {};
      return {
        name: d.character_name,
        killed_by: d.killed_by,
        level: d.level,
        killed_by_type: d.killed_by_type,
        vocation: props.vocation || 0,
        outfit: props.outfit || null,
        created_at: d.created_at
      };
    }.bind(this));

    response.setHeader("Content-Type", "application/json");
    response.statusCode = 200;
    response.end(JSON.stringify({ entries: entries, total: result.total }));
  } catch (error) {
    console.error("Deaths error:", error);
    response.statusCode = 500;
    response.end(JSON.stringify({ error: "Internal server error" }));
  }
};

LoginServer.prototype.__listAntiCheat = function (response) {
  try {
    if (typeof gameServer === "undefined" || !gameServer || !gameServer.world) {
      response.statusCode = 503;
      return response.end(JSON.stringify({ suspects: [], cheaters: [], error: "Game server not available" }));
    }
    let ac = gameServer.world.antiCheatManager;
    let data = {
      suspects: ac.getSuspects(),
      cheaters: ac.getCheaters()
    };
    response.setHeader("Content-Type", "application/json");
    response.statusCode = 200;
    response.end(JSON.stringify(data));
  } catch (error) {
    console.error("AntiCheat list error:", error);
    response.statusCode = 500;
    response.end(JSON.stringify({ error: "Internal server error" }));
  }
};

LoginServer.prototype.__listSprVersion = function (response) {
  let thingsDir = path.join(__dirname, "..", "..", "..", "client", "things");
  let result = {};
  for (let name of ["Tibia.spr", "Tibia.dat"]) {
    let filePath = path.join(thingsDir, name);
    try {
      let stat = fs.statSync(filePath);
      result[name] = { mtime: stat.mtimeMs, size: stat.size };
    } catch (_) {
      result[name] = null;
    }
  }
  response.setHeader("Content-Type", "application/json");
  response.statusCode = 200;
  response.end(JSON.stringify(result));
};

LoginServer.prototype.__confirmCheater = function (body, response) {
  try {
    if (typeof gameServer === "undefined" || !gameServer || !gameServer.world) {
      response.statusCode = 503;
      return response.end(JSON.stringify({ error: "Game server not available" }));
    }
    let name = body && body.name;
    if (!name) {
      response.statusCode = 400;
      return response.end(JSON.stringify({ error: "Name required" }));
    }
    let player = gameServer.world.creatureHandler.getPlayerByName(name);
    if (player) {
      player.setCheater(true);
    } else {
      // Offline player: persist flag for next login
      let row = this.accountDatabase.db.prepare(
        "SELECT data FROM characters WHERE LOWER(name) = LOWER(?)"
      ).get(name.trim());
      if (row) {
        let charData = JSON.parse(row.data);
        charData.__cheater = true;
        this.accountDatabase.db.prepare(
          "UPDATE characters SET data = ?, updated_at = ? WHERE LOWER(name) = LOWER(?)"
        ).run(JSON.stringify(charData), Date.now(), name.trim());
      } else {
        response.statusCode = 404;
        return response.end(JSON.stringify({ error: "Character not found" }));
      }
    }
    gameServer.world.antiCheatManager.clearSuspect(name);
    console.log("[ANTICHEAT] " + name + " confirmed as cheater.");
    response.statusCode = 200;
    response.end(JSON.stringify({ success: true }));
  } catch (error) {
    console.error("Confirm cheater error:", error);
    response.statusCode = 500;
    response.end(JSON.stringify({ error: "Internal server error" }));
  }
};

LoginServer.prototype.__dismissSuspect = function (body, response) {
  try {
    if (typeof gameServer === "undefined" || !gameServer || !gameServer.world) {
      response.statusCode = 503;
      return response.end(JSON.stringify({ error: "Game server not available" }));
    }
    let name = body && body.name;
    if (!name) {
      response.statusCode = 400;
      return response.end(JSON.stringify({ error: "Name required" }));
    }
    gameServer.world.antiCheatManager.clearSuspect(name);
    response.statusCode = 200;
    response.end(JSON.stringify({ success: true }));
  } catch (error) {
    console.error("Dismiss suspect error:", error);
    response.statusCode = 500;
    response.end(JSON.stringify({ error: "Internal server error" }));
  }
};

LoginServer.prototype.__removeCheater = function (body, response) {
  try {
    if (typeof gameServer === "undefined" || !gameServer || !gameServer.world) {
      response.statusCode = 503;
      return response.end(JSON.stringify({ error: "Game server not available" }));
    }
    let name = body && body.name;
    if (!name) {
      response.statusCode = 400;
      return response.end(JSON.stringify({ error: "Name required" }));
    }
    let player = gameServer.world.creatureHandler.getPlayerByName(name);
    if (player) {
      player.setCheater(false);
    } else {
      let row = this.accountDatabase.db.prepare(
        "SELECT data FROM characters WHERE LOWER(name) = LOWER(?)"
      ).get(name.trim());
      if (row) {
        let charData = JSON.parse(row.data);
        charData.__cheater = false;
        this.accountDatabase.db.prepare(
          "UPDATE characters SET data = ?, updated_at = ? WHERE LOWER(name) = LOWER(?)"
        ).run(JSON.stringify(charData), Date.now(), name.trim());
      } else {
        response.statusCode = 404;
        return response.end(JSON.stringify({ error: "Character not found" }));
      }
    }
    console.log("[ANTICHEAT] " + name + " cheater skull removed.");
    response.statusCode = 200;
    response.end(JSON.stringify({ success: true }));
  } catch (error) {
    console.error("Remove cheater error:", error);
    response.statusCode = 500;
    response.end(JSON.stringify({ error: "Internal server error" }));
  }
};

LoginServer.prototype.__usedNonces = new Set();
LoginServer.prototype.__nonceCleanupInterval = setInterval(function () {
  if (LoginServer.prototype.__usedNonces.size > 10000) {
    LoginServer.prototype.__usedNonces.clear();
  }
}, 60000);

LoginServer.prototype.__validateToken = function (tokenBase64) {
  try {
    let payload = JSON.parse(Buffer.from(tokenBase64, "base64").toString("utf8"));
    if (!payload.name || !payload.expire || !payload.hmac || !payload.nonce) return null;
    if (Date.now() > payload.expire) return null;
    if (LoginServer.prototype.__usedNonces.has(payload.nonce)) return null;
    let payloadStr = payload.name + payload.expire + payload.nonce;
    let expected = crypto.createHmac("sha256", CONFIG.HMAC.SHARED_SECRET)
      .update(payloadStr).digest("hex");
    if (payload.hmac !== expected) return null;
    LoginServer.prototype.__usedNonces.add(payload.nonce);
    return payload;
  } catch (_) {
    return null;
  }
};

// ─── Stripe Payment Handlers ─────────────────────────────────────────────────

LoginServer.prototype.__handlePaymentsConfig = function (response) {
  const STRIPE_PUBLISHABLE_KEY = loadEnvVar("STRIPE_PUBLISHABLE_KEY") || null;
  response.setHeader("Content-Type", "application/json");
  if (!STRIPE_PUBLISHABLE_KEY) {
    response.statusCode = 500;
    return response.end(JSON.stringify({ error: "Stripe publishable key not configured" }));
  }
  response.statusCode = 200;
  return response.end(JSON.stringify({ publishableKey: STRIPE_PUBLISHABLE_KEY }));
};

LoginServer.prototype.__handleCreatePaymentIntent = async function (body, response) {
  if (!stripe) {
    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json");
    return response.end(JSON.stringify({ error: "Stripe not configured on server" }));
  }
  const points = parseInt(body.points, 10) || 0;
  if (points <= 0) {
    response.statusCode = 400;
    response.setHeader("Content-Type", "application/json");
    return response.end(JSON.stringify({ error: "Invalid points value" }));
  }

  // 5 points = 1 euro -> amount in cents
  const amountCents = Math.max(1, Math.round((points * 100) / 5));

  try {
    const metadata = {};
    if (body.playerName) metadata.playerName = body.playerName;
    metadata.points = String(points);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "eur",
      metadata: metadata,
      automatic_payment_methods: { enabled: true }
    });
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json");
    return response.end(JSON.stringify({ clientSecret: paymentIntent.client_secret, amount: amountCents }));
  } catch (err) {
    console.error("Stripe createPaymentIntent error:", err);
    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json");
    return response.end(JSON.stringify({ error: "failed to create payment intent" }));
  }
};

LoginServer.prototype.__handlePaymentWebhook = function (request, response, rawBody) {

  /*
   * LoginServer.__handlePaymentWebhook
   * Handles Stripe webhook events using the raw body for signature verification.
   * On payment_intent.succeeded, credits premium points via admin API with DB fallback.
   */

  if (!stripe) {
    response.statusCode = 500;
    return response.end("Stripe not configured");
  }

  const sig = request.headers["stripe-signature"];
  const STRIPE_WEBHOOK_SECRET = loadEnvVar("STRIPE_WEBHOOK_SECRET") || null;
  let event;

  try {
    if (STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
    } else {
      // Fallback: parse raw body as JSON (less safe, but works without webhook secret)
      event = JSON.parse(rawBody.toString("utf8"));
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    response.statusCode = 400;
    return response.end("Webhook Error: " + err.message);
  }

  // Process payment_intent.succeeded event
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    const metadata = pi.metadata || {};
    const points = parseInt(metadata.points || "0", 10);
    const playerName = metadata.playerName || null;

    if (playerName && points > 0) {
      const http = require("http");
      const adminPort = parseInt(process.env.ADMIN_PORT || "2224", 10);
      const adminHost = process.env.ADMIN_HOST || "127.0.0.1";
      const ADMIN_SECRET = loadEnvVar("ADMIN_SECRET") || process.env.ADMIN_SECRET || null;

      if (!ADMIN_SECRET) {
        console.warn("ADMIN_SECRET not configured, cannot credit points via admin API");
        // Fallback: credit directly via account database if player is online
        this.__creditPointsFallback(playerName, points);
        response.statusCode = 200;
        return response.end(JSON.stringify({ received: true }));
      }

      const postData = JSON.stringify({ name: playerName, amount: points });
      const options = {
        hostname: adminHost,
        port: adminPort,
        path: "/api/premium",
        method: "POST",
        headers: {
          "Authorization": "Bearer " + ADMIN_SECRET,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData)
        }
      };

      const req = http.request(options, function (res) {
        let data = "";
        res.on("data", function (chunk) { data += chunk; });
        res.on("end", function () {
          if (res.statusCode === 200) {
            console.log("Credited", points, "points to", playerName, "via webhook");
          } else {
            console.warn("Webhook credit returned", res.statusCode, "- using fallback");
            this.__creditPointsFallback(playerName, points);
          }
        }.bind(this));
      }.bind(this));
      req.on("error", function (e) {
        console.error("Failed to credit points via admin API:", e.message, "- using fallback");
        this.__creditPointsFallback(playerName, points);
      }.bind(this));
      req.write(postData);
      req.end();
    } else {
      console.warn("PaymentIntent succeeded but missing metadata (playerName/points)");
    }
  }

  response.statusCode = 200;
  response.setHeader("Content-Type", "application/json");
  return response.end(JSON.stringify({ received: true }));
};

LoginServer.prototype.__creditPointsFallback = function (playerName, points) {

  /*
   * LoginServer.__creditPointsFallback
   * Tries to credit premium points directly when admin API is unavailable.
   * First attempts online player, then falls back to direct database update.
   */

  try {
    var gs = process.gameServer;
    if (gs && gs.world && gs.world.creatureHandler) {
      var player = gs.world.creatureHandler.getPlayerByName(playerName);
      if (player) {
        player.premiumPoints = Math.max(0, (player.premiumPoints || 0) + points);
        var PremiumBalanceUpdatePacket = requireModule("network/protocol").PremiumBalanceUpdatePacket;
        player.write(new PremiumBalanceUpdatePacket(player.premiumPoints));

        var gameSocket = player.socketHandler.getControllingSocket();
        if (gameSocket && gameSocket.account) {
          gs.HTTPServer.websocketServer.accountDatabase.saveCharacter(gameSocket, function () {
            console.log("Fallback: credited", points, "points to online player", playerName);
          });
        } else {
          console.log("Fallback: credited", points, "points to online player", playerName, "(DB save skipped - no socket)");
        }
        return;
      }
    }
    console.warn("Fallback: player", playerName, "not online, cannot credit points directly");
  } catch (e) {
    console.error("Fallback credit error:", e);
  }

}

module.exports = LoginServer;
