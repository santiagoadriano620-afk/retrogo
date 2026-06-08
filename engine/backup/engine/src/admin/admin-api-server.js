"use strict";

const http = require("http");
const crypto = require("crypto");

const ADMIN_PORT = CONFIG.ADMIN.PORT;
const ADMIN_HOST = CONFIG.ADMIN.HOST;
const ADMIN_SECRET = CONFIG.ADMIN.SECRET;

const AdminApiServer = function () {
  this.__server = http.createServer(this.__handleRequest.bind(this));
  this.__server.on("listening", this.__handleListening.bind(this));
  this.__server.on("error", this.__handleError.bind(this));
};

AdminApiServer.prototype.listen = function () {
  this.__server.listen(ADMIN_PORT, ADMIN_HOST);
};

AdminApiServer.prototype.close = function () {
  this.__server.close();
};

AdminApiServer.prototype.__handleListening = function () {
  console.log("Admin API listening on %s:%s.".format(ADMIN_HOST, ADMIN_PORT));
};

AdminApiServer.prototype.__handleError = function (err) {
  console.error("Admin API error: %s".format(err.message));
};

AdminApiServer.prototype.__parseBody = function (request) {
  return new Promise(function (resolve) {
    let body = "";
    let size = 0;
    const MAX_BODY_SIZE = 65536;
    request.on("data", function (chunk) {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        request.destroy();
        return resolve({});
      }
      body += chunk;
    });
    request.on("end", function () {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch (e) { resolve({}); }
    });
    request.on("error", function () { resolve({}); });
  });
};

AdminApiServer.prototype.__authenticate = function (request) {
  const auth = request.headers["authorization"] || "";
  const expected = "Bearer " + (ADMIN_SECRET || "");
  if (auth.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  } catch {
    return false;
  }
};

AdminApiServer.prototype.__json = function (response, status, data) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(data));
};

AdminApiServer.prototype.__handleRequest = function (request, response) {
  if (!this.__authenticate(request)) {
    return this.__json(response, 401, { error: "Unauthorized" });
  }

  var url;
  try {
    url = new URL(request.url, "http://localhost");
  } catch (e) {
    return this.__json(response, 400, { error: "Invalid URL" });
  }

  var pathname = url.pathname;

  if (request.method === "GET" && pathname === "/api/status") {
    return this.__handleStatus(response);
  }

  if (request.method === "GET" && pathname === "/api/players") {
    return this.__handlePlayers(response);
  }

  if (request.method === "POST" && pathname === "/api/broadcast") {
    return this.__parseBody(request).then(function (body) {
      this.__handleBroadcast(body, response);
    }.bind(this));
  }

  if (request.method === "POST" && pathname === "/api/save") {
    return this.__handleSave(response);
  }

  if (request.method === "POST" && pathname === "/api/shutdown") {
    return this.__handleShutdown(response);
  }

  if (request.method === "POST" && pathname === "/api/kick") {
    return this.__parseBody(request).then(function (body) {
      this.__handleKick(body, response);
    }.bind(this));
  }

  if (request.method === "POST" && pathname === "/api/player") {
    return this.__parseBody(request).then(function (body) {
      this.__handlePlayerUpdate(body, response);
    }.bind(this));
  }

  if (request.method === "POST" && pathname === "/api/premium") {
    return this.__parseBody(request).then(function (body) {
      this.__handlePremiumUpdate(body, response);
    }.bind(this));
  }

  this.__json(response, 404, { error: "Not found" });
};

AdminApiServer.prototype.__handleStatus = function (response) {
  var gs = process.gameServer;
  if (!gs) {
    return this.__json(response, 200, { online: false });
  }

  var players = [];
  var playerCount = 0;
  if (gs.world && gs.world.creatureHandler) {
    gs.world.creatureHandler.forEachPlayer(function (player) {
      playerCount++;
      players.push({
        name: player.getProperty(CONST.PROPERTIES.NAME),
        level: player.getLevel(),
        vocation: player.getProperty(CONST.PROPERTIES.VOCATION),
        health: player.getProperty(CONST.PROPERTIES.HEALTH),
        maxHealth: player.getProperty(CONST.PROPERTIES.HEALTH_MAX),
        mana: player.getProperty(CONST.PROPERTIES.MANA),
        maxMana: player.getProperty(CONST.PROPERTIES.MANA_MAX),
        position: player.position.toJSON()
      });
    });
  }

  this.__json(response, 200, {
    online: true,
    uptime: Date.now() - (gs.__initialized || Date.now()),
    initialized: gs.__initialized,
    status: gs.__serverStatus,
    playersOnline: playerCount,
    players: players,
    version: CONFIG.SERVER.VERSION || "unknown",
    rates: CONFIG.RATES || {}
  });
};

AdminApiServer.prototype.__handlePlayers = function (response) {
  var gs = process.gameServer;
  if (!gs || !gs.world || !gs.world.creatureHandler) {
    return this.__json(response, 200, { players: [] });
  }

  var players = [];
  gs.world.creatureHandler.forEachPlayer(function (player) {
    players.push({
      name: player.getProperty(CONST.PROPERTIES.NAME),
      level: player.getLevel(),
      vocation: player.getProperty(CONST.PROPERTIES.VOCATION),
      health: player.getProperty(CONST.PROPERTIES.HEALTH),
      maxHealth: player.getProperty(CONST.PROPERTIES.HEALTH_MAX),
      mana: player.getProperty(CONST.PROPERTIES.MANA),
      maxMana: player.getProperty(CONST.PROPERTIES.MANA_MAX),
      capacity: player.getProperty(CONST.PROPERTIES.CAPACITY),
      position: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z
      },
      skull: player.getSkull(),
      outfit: player.getProperty(CONST.PROPERTIES.OUTFIT),
      sex: player.getProperty(CONST.PROPERTIES.SEX),
      skills: {
        experience: player.skills.experience,
        level: player.skills.level,
        magic: player.skills.magic,
        fist: player.skills.fist,
        club: player.skills.club,
        sword: player.skills.sword,
        axe: player.skills.axe,
        distance: player.skills.distance,
        shielding: player.skills.shielding,
        fishing: player.skills.fishing
      }
    });
  });

  this.__json(response, 200, { players: players });
};

AdminApiServer.prototype.__handleBroadcast = function (body, response) {
  var gs = process.gameServer;
  if (!gs || !gs.world) {
    return this.__json(response, 503, { error: "Server not ready" });
  }

  var message = body.message || "";
  if (!message) {
    return this.__json(response, 400, { error: "Message is required" });
  }

  var ServerMessagePacket = requireModule("network/protocol").ServerMessagePacket;
  gs.world.broadcastPacket(new ServerMessagePacket(message));

  this.__json(response, 200, { success: true, message: message });
};

AdminApiServer.prototype.__handleSave = function (response) {
  var gs = process.gameServer;
  if (!gs) {
    return this.__json(response, 503, { error: "Server not ready" });
  }

  try {
    gs.__saveAllPlayers();
    gs.__saveWorldState();
    this.__json(response, 200, { success: true });
  } catch (e) {
    this.__json(response, 500, { error: e.message });
  }
};

AdminApiServer.prototype.__handleShutdown = function (response) {
  var gs = process.gameServer;
  if (!gs) {
    return this.__json(response, 503, { error: "Server not ready" });
  }

  this.__json(response, 200, { success: true, message: "Shutting down..." });

  setTimeout(function () {
    gs.scheduleShutdown(CONFIG.SERVER.MS_SHUTDOWN_SCHEDULE || 1000);
  }, 500);
};

AdminApiServer.prototype.__handlePlayerUpdate = function (body, response) {
  var gs = process.gameServer;
  if (!gs || !gs.world || !gs.world.creatureHandler) {
    return this.__json(response, 503, { error: "Server not ready" });
  }

  var name = body.name;
  if (!name) {
    return this.__json(response, 400, { error: "Player name is required" });
  }

  var player = gs.world.creatureHandler.getPlayerByName(name);
  if (!player) {
    return this.__json(response, 404, { error: "Player not found online" });
  }

  try {
    var { CreaturePropertyPacket } = requireModule("network/protocol");
    var CONST_PROP = CONST.PROPERTIES;
    var propsMap = {
      magic: CONST_PROP.MAGIC,
      fist: CONST_PROP.FIST,
      club: CONST_PROP.CLUB,
      sword: CONST_PROP.SWORD,
      axe: CONST_PROP.AXE,
      distance: CONST_PROP.DISTANCE,
      shielding: CONST_PROP.SHIELDING,
      fishing: CONST_PROP.FISHING,
    };

    Object.keys(propsMap).forEach(function (key) {
      if (body[key] !== undefined) {
        var level = parseInt(body[key], 10);
        if (!isNaN(level) && level >= 0) {
          player.skills.setSkillLevel(propsMap[key], level);
          var tries = player.skills.getSkillValue(propsMap[key]);
          player.write(new CreaturePropertyPacket(player.getId(), propsMap[key], tries));
        }
      }
    });

    if (body.experience !== undefined) {
      var exp = parseInt(body.experience, 10);
      if (!isNaN(exp) && exp >= 0) {
        player.skills.setSkillLevel(CONST_PROP.EXPERIENCE, exp);
        var expTries = player.skills.getSkillValue(CONST_PROP.EXPERIENCE);
        player.write(new CreaturePropertyPacket(player.getId(), CONST_PROP.EXPERIENCE, expTries));
        player.skills.setMaximumProperties();
        player.write(new CreaturePropertyPacket(player.getId(), CONST_PROP.HEALTH_MAX, player.getProperty(CONST_PROP.HEALTH_MAX)));
        player.write(new CreaturePropertyPacket(player.getId(), CONST_PROP.MANA_MAX, player.getProperty(CONST_PROP.MANA_MAX)));
        player.setProperty(CONST_PROP.HEALTH, player.getProperty(CONST_PROP.HEALTH_MAX));
        player.setProperty(CONST_PROP.MANA, player.getProperty(CONST_PROP.MANA_MAX));
      }
    }

    var gameSocket = player.socketHandler.getControllingSocket();
    if (gameSocket && gameSocket.account) {
      var db = gs.HTTPServer.websocketServer.accountDatabase;
      db.saveCharacter(gameSocket, function () {});
    }

    this.__json(response, 200, { success: true, player: name });
  } catch (e) {
    this.__json(response, 500, { error: e.message });
  }
};

AdminApiServer.prototype.__handlePremiumUpdate = function (body, response) {
  var gs = process.gameServer;
  if (!gs || !gs.world || !gs.world.creatureHandler) {
    return this.__json(response, 503, { error: "Server not ready" });
  }

  var name = body.name;
  var amount = parseInt(body.amount, 10);

  if (!name || isNaN(amount) || amount === 0) {
    return this.__json(response, 400, { error: "Player name and non-zero amount are required" });
  }

  var player = gs.world.creatureHandler.getPlayerByName(name);
  if (!player) {
    return this.__json(response, 404, { error: "Player not found online" });
  }

  try {
    player.premiumPoints = Math.max(0, (player.premiumPoints || 0) + amount);
    var PremiumBalanceUpdatePacket = requireModule("network/protocol").PremiumBalanceUpdatePacket;
    player.write(new PremiumBalanceUpdatePacket(player.premiumPoints));

    var gameSocket = player.socketHandler.getControllingSocket();
    if (gameSocket && gameSocket.account) {
      var db = gs.HTTPServer.websocketServer.accountDatabase;
      db.saveCharacter(gameSocket, function () {});
    }

    this.__json(response, 200, { success: true, premiumPoints: player.premiumPoints });
  } catch (e) {
    this.__json(response, 500, { error: e.message });
  }
};

AdminApiServer.prototype.__handleKick = function (body, response) {
  var gs = process.gameServer;
  if (!gs || !gs.world || !gs.world.creatureHandler) {
    return this.__json(response, 503, { error: "Server not ready" });
  }

  var name = body.name;
  if (!name) {
    return this.__json(response, 400, { error: "Player name is required" });
  }

  var player = gs.world.creatureHandler.getPlayerByName(name);
  if (!player) {
    return this.__json(response, 404, { error: "Player not found" });
  }

  try {
    var socket = player.socketHandler.getControllingSocket();
    if (socket) socket.close();
    this.__json(response, 200, { success: true });
  } catch (e) {
    this.__json(response, 500, { error: e.message });
  }
};

module.exports = AdminApiServer;
