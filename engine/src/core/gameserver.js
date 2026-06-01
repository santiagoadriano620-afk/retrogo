"use strict";

const fs = require("fs");
const path = require("path");
const Database = requireModule("core/database");
const Enum = requireModule("utils/enum");
const GameLoop = requireModule("core/gameloop");
const HTTPServer = requireModule("network/http-server");
const QuestManager = requireModule("core/quest-manager");
const QuestDataLoader = requireModule("core/quest-data-loader");
const QuestExecutor = requireModule("core/quest-executor");
const GuildManager = requireModule("guilds/guild-manager");
const HouseRentManager = requireModule("core/house-rent-manager");
const TradeManager = requireModule("core/trade-manager");
const ShopManager = requireModule("core/shop-manager");
const Logger = requireModule("utils/logger");
const BackupManager = requireModule("utils/backup");
const AdminApiServer = requireModule("admin/admin-api-server");

const DB_DIR = path.resolve(__dirname, "..", "..", "..", "data", "database");
const MARKER_PATH = path.join(DB_DIR, "clean_shutdown");

const GameServer = function () {

  process.on("SIGINT", this.scheduleShutdown.bind(this, CONFIG.SERVER.MS_SHUTDOWN_SCHEDULE));
  process.on("SIGTERM", this.scheduleShutdown.bind(this, CONFIG.SERVER.MS_SHUTDOWN_SCHEDULE));

  this.database = new Database();
  this.gameLoop = new GameLoop(CONFIG.SERVER.MS_TICK_INTERVAL, this.__loop.bind(this));
  this.HTTPServer = new HTTPServer(CONFIG.SERVER.HOST, CONFIG.SERVER.PORT);
  this.questManager = new QuestManager();
  this.questDataLoader = new QuestDataLoader();
  this.questExecutor = new QuestExecutor();
  this.guildManager = new GuildManager();
  this.tradeManager = new TradeManager();
  this.shopManager = new ShopManager();

  this.__serverStatus = null;
  this.__initialized = null;
  this.__saveTimer = null;
  this.__worldSaveTimer = null;
  this.__backupTimer = null;

  this.logger = new Logger();
  this.backupManager = null;

  this.__saveCount = 0;
  this.__dirtyPlayers = new Set();
  this.__saveBatchTimer = null;

  this.adminApi = new AdminApiServer();

  this.globalBoosts = {
    exp: 0,
    loot: 0,
    skills: 0
  };

}

GameServer.prototype.STATUS = new Enum("OPEN", "OPENING", "CLOSING", "CLOSED");

GameServer.prototype.isShutdown = function () {
  return this.__serverStatus === this.STATUS.CLOSING;
}

GameServer.prototype.initialize = function () {
  this.__serverStatus = this.STATUS.OPEN;
  this.__initialized = Date.now();

  // Ensure database directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // Clean up any stale clean_shutdown marker from a previous run
  // (crash reports are always available in database/crashes/ for review)
  try { fs.unlinkSync(MARKER_PATH); } catch (e) {}

  // Write running marker — removed on clean shutdown
  try { fs.writeFileSync(MARKER_PATH, ""); } catch (e) {}

  this.database.initialize();
  this.questDataLoader.initialize();
  this.__registerQuestItemHandlers();
  this.__registerRuneHandlers();
  this.__verifyHouses();
  this.houseRentManager = new HouseRentManager();
  this.gameLoop.initialize();
  this.__startAutoSave();
  this.HTTPServer.listen();
  this.adminApi.listen();
  this.__registerErrorHandlers();

  this.logger.info("gameserver", "startup", {
    status: "ok",
    cores: require("os").cpus().length
  });

  console.log("Running with %s cores".format(require("os").cpus().length));

}

GameServer.prototype.__verifyHouses = function () {

  let totalHouses = 0;
  let totalTiles = 0;
  let ownedHouses = 0;
  let guildhalls = 0;
  let housesWithTiles = 0;
  let housesWithoutTiles = [];

  this.database.houses.forEach(function(house) {
    totalHouses++;
    totalTiles += house.tiles.length;

    if(house.owner && house.owner !== "") {
      ownedHouses++;
    }

    if(house.guildhall) {
      guildhalls++;
    }

    if(house.tiles.length > 0) {
      housesWithTiles++;
    } else {
      housesWithoutTiles.push({ id: house.id, name: house.name });
    }
  });

  console.log("");
  console.log("=== Houses loaded successfully ===");
  console.log("  Total houses in definitions: %s".format(totalHouses));
  console.log("  Houses with OTBM tiles:      %s".format(housesWithTiles));
  console.log("  Total house tiles linked:     %s".format(totalTiles));
  console.log("  Guildhalls:                   %s".format(guildhalls));
  console.log("  Owned houses:                 %s".format(ownedHouses));
  console.log("  Available for purchase:       %s".format(totalHouses - ownedHouses));

  if(housesWithoutTiles.length > 0) {
    console.log("  WARNING: %s houses have ZERO tiles (not found in OTBM):".format(housesWithoutTiles.length));
    housesWithoutTiles.slice(0, 10).forEach(function(h) {
      console.log("    [%s] %s".format(h.id, h.name));
    });
    if(housesWithoutTiles.length > 10) {
      console.log("    ... and %s more.".format(housesWithoutTiles.length - 10));
    }
  } else {
    console.log("  All houses have tiles linked from OTBM.");
  }
  console.log("");

}

GameServer.prototype.markPlayerDirty = function (gameSocket) {
  if (gameSocket && gameSocket.account) {
    this.__dirtyPlayers.add(gameSocket);
    this.__scheduleBatchSave();
  }
};

GameServer.prototype.__scheduleBatchSave = function () {
  if (this.__saveBatchTimer) return;
  this.__saveBatchTimer = setTimeout(function () {
    this.__saveBatchTimer = null;
    this.__flushDirtyPlayers();
  }.bind(this), 10000);
};

GameServer.prototype.__flushDirtyPlayers = function () {
  if (this.__dirtyPlayers.size === 0) return;
  var db = this.HTTPServer.websocketServer.accountDatabase;
  var saved = 0;
  var errors = 0;
  var startTime = Date.now();
  var batch = Array.from(this.__dirtyPlayers);
  this.__dirtyPlayers.clear();
  for (var i = 0; i < batch.length; i++) {
    var gameSocket = batch[i];
    try {
      db.saveCharacter(gameSocket, function (err) {
        if (err) errors++;
      });
      saved++;
    } catch (e) {
      errors++;
    }
  }
  this.logger.info("gameserver", "batch_save", {
    saved: saved,
    errors: errors,
    duration_ms: Date.now() - startTime
  });
};

GameServer.prototype.__startAutoSave = function () {

  // Periodic full save as fallback every 120 seconds
  this.__saveTimer = setInterval(function () {
    this.__saveAllPlayers();
  }.bind(this), 120000);

  // Save world state (houses) every 5 minutes
  this.__worldSaveTimer = setInterval(function () {
    this.__saveWorldState();
  }.bind(this), 300000);

  // Backup the database every 60 minutes
  this.__backupTimer = setInterval(function () {
    this.__backupDatabase();
  }.bind(this), 3600000);

  // Create initial backup manager reference
  setTimeout(function () {
    try {
      var accountDb = this.HTTPServer.websocketServer.accountDatabase;
      if (accountDb && accountDb.db) {
        this.backupManager = new BackupManager(accountDb.db);
        this.logger.info("gameserver", "backup_ready", {});
      }
    } catch (e) {
      this.logger.error("gameserver", "backup_init_failed", { error: e.message });
    }
  }.bind(this), 5000);

}

GameServer.prototype.__saveAllPlayers = function () {

  if (!this.world || !this.world.creatureHandler) return;

  var db = this.HTTPServer.websocketServer.accountDatabase;
  var saved = 0;
  var errors = 0;
  var startTime = Date.now();

  this.world.creatureHandler.forEachPlayer(function (player) {
    try {
      var gameSocket = player.socketHandler.getControllingSocket();
      if (gameSocket && gameSocket.account) {
        db.saveCharacter(gameSocket, function (err) {
          if (err) errors++;
        });
        saved++;
      }
    } catch (e) {
      errors++;
      this.logger.error("gameserver", "auto_save_player_error", {
        player: player.name,
        error: e.message
      });
    }
  }.bind(this));

  this.__saveCount++;

  this.logger.info("gameserver", "auto_save_players", {
    saved: saved,
    errors: errors,
    duration_ms: Date.now() - startTime,
    save_count: this.__saveCount
  });

}

GameServer.prototype.__saveWorldState = function () {

  try {
    var startTime = Date.now();
    this.database.saveHouses();
    this.logger.info("gameserver", "world_save", {
      duration_ms: Date.now() - startTime
    });
  } catch (e) {
    this.logger.error("gameserver", "world_save_error", {
      error: e.message,
      stack: e.stack
    });
  }

}

GameServer.prototype.__backupDatabase = function () {

  if (!this.backupManager) {
    this.logger.warn("gameserver", "backup_skipped", { reason: "backup_manager_not_ready" });
    return;
  }

  var startTime = Date.now();
  var backupPath = this.backupManager.createBackup();

  if (backupPath) {
    this.logger.info("gameserver", "backup_created", {
      path: backupPath,
      duration_ms: Date.now() - startTime,
      save_count: this.__saveCount
    });
  } else {
    this.logger.error("gameserver", "backup_failed", {
      duration_ms: Date.now() - startTime
    });
  }

}

GameServer.prototype.setServerStatus = function (serverStatus) {
  this.__serverStatus = serverStatus;
}

GameServer.prototype.shutdown = async function () {

  this.logger.info("gameserver", "shutdown_start", {
    uptime_ms: Date.now() - this.__initialized,
    save_count: this.__saveCount
  });

  console.log("The game server is shutting down.");

  this.setServerStatus(this.STATUS.CLOSED);
  this.gameLoop.stop();

  // Close all active sockets
  if (this.world && this.world.creatureHandler) {
    this.world.creatureHandler.forEachPlayer(function (player) {
      if (player && player.socket) {
        try { player.socket.close(); } catch (e) {}
      }
    });
  }

  this.HTTPServer.close();
  this.adminApi.close();

  if (this.IPCSocket) {
    this.IPCSocket.close();
  }

  // Clear auto-save timers
  if (this.__saveTimer) clearInterval(this.__saveTimer);
  if (this.__worldSaveTimer) clearInterval(this.__worldSaveTimer);
  if (this.__backupTimer) clearInterval(this.__backupTimer);

  // Remove running marker — clean shutdown is now proven
  // Next startup will see the marker is absent and proceed normally
  try {
    fs.unlinkSync(MARKER_PATH);
    this.logger.info("gameserver", "clean_shutdown_marker_removed", {});
  } catch (e) {
    this.logger.error("gameserver", "clean_shutdown_marker_failed", { error: e.message });
  }

  // Wait for pending database operations
  console.log("Waiting for pending database operations...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  this.logger.close();

  console.log("Server shutdown complete.");
  process.exit(0);

}

GameServer.prototype.scheduleShutdown = function (seconds) {

  if (this.__serverStatus === this.STATUS.CLOSING) {
    return console.log("Shutdown command refused because the server is already shutting down.");
  }

  this.setServerStatus(this.STATUS.CLOSING);

  this.world.broadcastMessage(
    "The gameserver is closing in %s seconds. Please log out in a safe place."
      .format(Math.floor(1E-3 * seconds))
  );

  setTimeout(this.shutdown.bind(this), seconds);

}

GameServer.prototype.__loop = function () {
  this.HTTPServer.websocketServer.socketHandler.flushSocketBuffers();
  this.world.tick();
}

GameServer.prototype.isClosed = function () {
  return this.__serverStatus === this.STATUS.CLOSED;
}

GameServer.prototype.__handleUncaughtException = function (error, origin) {

  console.error("[FATAL] Uncaught %s: %s".format(origin || "exception", error.message || error));
  console.error(error.stack || error);

  // Attempt to save all online players before shutting down
  var accountDb = this.HTTPServer.websocketServer.accountDatabase;
  var playersOnline = [];

  try {
    this.world.creatureHandler.forEachPlayer(function (player) {
      try {
        var gameSocket = player.socketHandler.getControllingSocket();
        if (gameSocket && gameSocket.account) {
          accountDb.saveCharacter(gameSocket, function () {});
          playersOnline.push({ name: player.name, level: player.getLevel() });
        }
      } catch (e) {
        console.error("[FATAL] Error saving player %s: %s".format(player.name, e.message));
      }
    });
  } catch (e) {
    console.error("[FATAL] Error during emergency player save:", e.message);
  }

  // Write crash report
  var crashData = {
    event: "crash",
    timestamp: new Date().toISOString(),
    origin: origin || "unknown",
    error: {
      message: error.message || String(error),
      stack: error.stack || ""
    },
    players_online: playersOnline,
    uptime_ms: Date.now() - (this.__initialized || Date.now()),
    save_count: this.__saveCount
  };

  this.logger.writeCrashReport(crashData);

  // Shut the server down
  this.shutdown();

}

GameServer.prototype.__registerQuestItemHandlers = function () {
  const questItems = this.questDataLoader.getAllQuestItems();
  const questItemCallback = require(getDataFile("actions", "definitions", "quest-item.js"));

  for (const questAction of questItems) {
    const itemId = questAction.itemId;
    if (itemId === undefined) continue;
    const proto = this.database.getThingPrototype(itemId);
    if (proto) {
      proto.on("useWith", questItemCallback);
    }
  }

  if (questItems.length > 0) {
    console.log("Registered [[ %s ]] quest item handlers.".format(questItems.length));
  }
}

GameServer.prototype.__registerRuneHandlers = function () {

  this.database.runes.forEach(function (handler, itemId) {
    const proto = this.database.getThingPrototype(itemId);
    if (proto) {
      proto.on("useWith", function (player, item, targetTile, targetIndex) {
        if (targetTile === null) return false;
        let top = targetTile.getTopCreature();
        if (top === null) return false;
        handler(player, targetTile);
        return true;
      });
    }
  }.bind(this));

  console.log("Registered [[ %s ]] rune handlers.".format(this.database.runes.size));

}

GameServer.prototype.__registerErrorHandlers = function () {

  process.on("uncaughtException", function (error) {
    this.__handleUncaughtException(error, "exception");
  }.bind(this));

  process.on("unhandledRejection", function (reason) {
    console.error("[FATAL] Unhandled Promise rejection:", reason);
    if (reason instanceof Error) {
      this.__handleUncaughtException(reason, "unhandled_rejection");
    }
  }.bind(this));

}

module.exports = GameServer;
