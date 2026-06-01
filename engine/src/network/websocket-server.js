"use strict";

const GameSocket = requireModule("network/gamesocket");
const WebsocketSocketHandler = requireModule("network/websocket-server-socket-handler");
const AccountDatabase = requireModule("auth/account-database");

const { Server } = require("ws");

function log(module, action, data) {
  try {
    var l = process.gameServer && process.gameServer.logger;
    if (l) l.info(module, action, data);
  } catch (e) {}
}

const WebsocketServer = function () {
  /*
   *
   * Class WebsocketServer
   *
   * Container for the websocket server that accepts incoming HTTP connections
   * and upgrades them to websocket connections
   *
   */

  // Create the websocket server
  this.websocket = new Server({
    noServer: true,
    perMessageDeflate: this.__getCompressionConfiguration(),
  });

  // Reference the database
  this.accountDatabase = new AccountDatabase();

  // The handler for sockets
  this.socketHandler = new WebsocketSocketHandler();

  // The main websocket server listener
  this.websocket.on("connection", this.__handleConnection.bind(this));
  this.websocket.on("close", this.__handleClose.bind(this));
};

WebsocketServer.prototype.getDataDetails = function () {
  /*
   * Function WebsocketServer.getDataDetails
   * Returns data details of the websocket server
   */

  // Expose this information
  return new Object({
    sockets: this.socketHandler.getTotalConnectedSockets(),
  });
};

WebsocketServer.prototype.upgrade = function (
  request,
  socket,
  head,
  accountName,
  characterName,
  xorKey
) {
  /*
   * Function WebsocketServer.upgrade
   * Upgrades an accepted HTTP connection to WS
   */

  // Otherwise handle the upgrade with the submitted account information
  this.websocket.handleUpgrade(
    request,
    socket,
    head,
    function upgradeWebsocket(websocket) {
      // Tell the websocket server the connection upgrade is succesful
      this.websocket.emit("connection", websocket, request, accountName, characterName, xorKey);
    }.bind(this)
  );
};

WebsocketServer.prototype.close = function () {
  /*
   * Function WebsocketServer.close
   * Call to the web socket server to close it
   */

  console.log("The websocket server has started to close.");

  // Terminate all remaining socket connections
  this.socketHandler.disconnectClients();

  // Close the websocket server after all clients were forcefully terminated
  this.websocket.close();
};

WebsocketServer.prototype.__handleClose = function () {
  /*
   * Function WebsocketServer.__handleClose
   * Callback fired when the websocket server is closed
   */

  console.log("The websocket server has closed.");

  // The database may be closed
  this.accountDatabase.close();
};

WebsocketServer.prototype.__handleConnection = function (
  socket,
  request,
  accountName,
  characterName,
  xorKey
) {
  /*
   * Function WebsocketServer.__handleConnection
   * Handles an incoming websocket connection that was upgraded from HTTP with a valid token
   */

  // Create a new class that wraps the connected socket
  let gameSocket = new GameSocket(socket, accountName, xorKey);

  // The server is full
  if (this.socketHandler.isOverpopulated()) {
    return gameSocket.closeError(
      "The server is currently overpopulated. Please try again later."
    );
  }

  // Server is in the process of shutting down: do not accept any new connections
  if (gameServer.isShutdown()) {
    return gameSocket.closeError(
      "The server is going offline. Please try again later."
    );
  }

  // The socket can be accepted
  this.__acceptConnection(gameSocket, accountName, characterName);
};

WebsocketServer.prototype.__acceptConnection = function (
  gameSocket,
  accountName,
  characterName
) {
  /*
   * Function WebsocketServer.__acceptConnection
   * Accepts the connection of the websocket
   */

  // Get the socket address
  let addr = gameSocket.getAddress();

  // Check: only 1 character per IP address
  if (CONFIG.GAME.ONE_CHAR_PER_IP) {
    let clientIp = addr.address;
    let connectedSockets = this.socketHandler.getConnectedSockets();
    let ipCount = 0;
    connectedSockets.forEach(function (gs) {
      if (gs.__address === clientIp && gs !== gameSocket) {
        ipCount++;
      }
    });
    if (ipCount > 0) {
      return gameSocket.closeError(
        "Only one character per IP address is allowed."
      );
    }
  }

  log("websocket", "connection", {
    account: accountName,
    character: characterName,
    ip: gameSocket.__address
  });

  // Attach the socket listeners for socket closure
  gameSocket.socket.on(
    "close",
    this.__handleSocketClose.bind(this, gameSocket)
  );

  // Try logging in to a character
  this.__handleLoginRequest(gameSocket, accountName, characterName);
};

WebsocketServer.prototype.__handleLoginRequest = function (
  gameSocket,
  accountName,
  characterName
) {
  /*
   * Function WebsocketServer.__handleLoginRequest
   * Handles a login request from a socket
   */

  if (characterName) {
    // Load specific character by name (multi-character support)
    this.accountDatabase.getCharacterByName(
      accountName,
      characterName,
      function getCharacterCallback(error, character) {
        if (error || !character) {
          return gameSocket.terminate();
        }

        // Check if character is banned
        let ban = this.accountDatabase.getBanByName(characterName);
        if (ban && ban.active === 1 && (ban.expires_at === 0 || ban.expires_at > Date.now())) {
          let msg = "Your character has been banned.";
          if (ban.reason) msg += "\nReason: " + ban.reason;
          if (ban.days > 0) msg += "\nDuration: " + ban.days + " days";
          return gameSocket.closeError(msg);
        }

        // Fallback: ensure name exists in properties
        if (!character.properties) {
          character.properties = {};
        }
        if (!character.properties.name) {
          character.properties.name = characterName;
        }

        // Fallback: ensure maxHealth exists
        if (character.properties.maxHealth === undefined) {
          character.properties.maxHealth = character.properties.health || 150;
        }

        // Fallback: ensure maxMana exists
        if (character.properties.maxMana === undefined) {
          character.properties.maxMana = character.properties.mana !== undefined ? character.properties.mana : 0;
        }

        // Fallback: ensure experience exists in skills
        if (character.skills && (character.skills.experience === null || character.skills.experience === undefined)) {
          character.skills.experience = 0;
        }

        // Fallback: ensure level exists in skills
        if (character.skills && (character.skills.level === null || character.skills.level === undefined)) {
          let exp = character.skills.experience || 0;
          if (exp <= 0) {
            character.skills.level = 1;
          } else {
            let level = 1;
            for (let i = 1; i <= 1000; i++) {
              let requiredExp = Math.round((50 / 3) * (Math.pow(i, 3) - 6 * Math.pow(i, 2) + 17 * i - 12));
              if (exp >= requiredExp) {
                level = i;
              } else {
                break;
              }
            }
            character.skills.level = level;
          }
        }

        this.accountDatabase.getPremiumExpiry(accountName, function (err, expiry) {
          gameSocket.premiumExpiry = expiry || 0;
          this.__acceptCharacterConnection(gameSocket, character);
        }.bind(this));
      }.bind(this)
    );
  } else {
    // Legacy fallback: load first character from account (for older clients)
    this.accountDatabase.getCharacter(
      accountName,
      function getPlayerAccount(error, result) {
        if (error || !result || !result.characters || result.characters.length === 0) {
          return gameSocket.terminate();
        }

        let character = result.characters[0];

        if (typeof character === "string") {
          character = JSON.parse(character);
        }
        if (typeof character === "string") {
          character = JSON.parse(character);
        }

        if (!character.properties.name) {
          character.properties.name = accountName;
        }

        // Check if character is banned
        let charName = character.properties.name;
        let ban = this.accountDatabase.getBanByName(charName);
        if (ban && ban.active === 1 && (ban.expires_at === 0 || ban.expires_at > Date.now())) {
          let msg = "Your character has been banned.";
          if (ban.reason) msg += "\nReason: " + ban.reason;
          if (ban.days > 0) msg += "\nDuration: " + ban.days + " days";
          return gameSocket.closeError(msg);
        }

        if (character.properties.maxHealth === undefined) {
          character.properties.maxHealth = character.properties.health || 150;
        }

        if (character.properties.maxMana === undefined) {
          character.properties.maxMana = character.properties.mana !== undefined ? character.properties.mana : 0;
        }

        if (character.skills && (character.skills.experience === null || character.skills.experience === undefined)) {
          character.skills.experience = 0;
        }

        if (character.skills && (character.skills.level === null || character.skills.level === undefined)) {
          let exp = character.skills.experience || 0;
          if (exp <= 0) {
            character.skills.level = 1;
          } else {
            let level = 1;
            for (let i = 1; i <= 1000; i++) {
              let requiredExp = Math.round((50 / 3) * (Math.pow(i, 3) - 6 * Math.pow(i, 2) + 17 * i - 12));
              if (exp >= requiredExp) {
                level = i;
              } else {
                break;
              }
            }
            character.skills.level = level;
          }
        }

        this.accountDatabase.getPremiumExpiry(accountName, function (err, expiry) {
          gameSocket.premiumExpiry = expiry || 0;
          this.__acceptCharacterConnection(gameSocket, character);
        }.bind(this));
      }.bind(this)
    );
  }
};

WebsocketServer.prototype.__getCompressionConfiguration = function () {
  /*
   * Function WebsocketServer.__getCompressionConfiguration
   * Returns the compression options for zlib used in ws
   */

  // Compression is disabled
  if (!CONFIG.SERVER.COMPRESSION.ENABLED) {
    return false;
  }

  // Compression options: level 1 is sufficient to reach ~85% percent compression for chunks
  return new Object({
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    threshold: CONFIG.SERVER.COMPRESSION.THRESHOLD,
    zlibDeflateOptions: {
      level: CONFIG.SERVER.COMPRESSION.LEVEL,
    },
  });
};

WebsocketServer.prototype.__acceptCharacterConnection = function (
  gameSocket,
  data
) {
  /*
   * Function WebsocketServer.__acceptConnection
   * Handles a login request from a socket
   */

  // Save a reference to the game socket
  this.socketHandler.referenceSocket(gameSocket);

  // Attempt to get the player again in case of a race condition
  let existingPlayer = gameServer.world.creatureHandler.getPlayerByName(
    data.properties.name
  );

  // Not existing in the world: create a new player
  if (existingPlayer === null) {
    return gameServer.world.creatureHandler.createNewPlayer(gameSocket, data);
  }

  // Close any active shop and restore original name
  if (gameServer.shopManager) {
    let shop = gameServer.shopManager.getShop(existingPlayer.getId());
    if (shop) {
      gameServer.shopManager.returnItemsAndEarnings(existingPlayer);
    }
    existingPlayer.__restoreNameFromShop();
  }

  // What to do when this player is already online
  switch (CONFIG.SERVER.ON_ALREADY_ONLINE) {
    case "replace":
      return existingPlayer.socketHandler.attachController(gameSocket);
    case "spectate":
      return existingPlayer.socketHandler.addSpectator(gameSocket);
  }

  // Default behavior is closing the new socket
  return gameSocket.closeError("This character is already online.");
};

WebsocketServer.prototype.__handleSocketClose = function (gameSocket) {
  /*
   * Function WebsocketServer.__handleSocketClose
   * Closes a game socket and removes the player from the game world
   */

  console.log("A client has left the server: %s.".format(gameSocket.__address));

  var playerName = gameSocket.player ? gameSocket.player.getProperty(CONST.PROPERTIES.NAME) : "unknown";
  log("websocket", "disconnect", {
    account: gameSocket.account,
    player: playerName,
    ip: gameSocket.__address
  });

  // Dereference from the list of gamesockets
  this.socketHandler.dereferenceSocket(gameSocket);

  // Socket closed without being referenced to a player (e.g., spectating)
  if (gameSocket.player === null) {
    return;
  }

  // Shop owners stay in the world after disconnect
  if (gameServer.shopManager && gameServer.shopManager.getShop(gameSocket.player.getId())) {
    if (gameSocket.player.socketHandler.getController() !== gameSocket) {
      gameServer.shopManager.returnItemsAndEarnings(gameSocket.player);
      gameSocket.player.__restoreNameFromShop();
      gameSocket.player.setStorage("__marketData", null);
      gameServer.shopManager.closeShop(gameSocket.player);
      let { MarketClosedPacket } = requireModule("network/protocol");
      gameSocket.player.write(new MarketClosedPacket("Your market has closed."));
    }
    return;
  }

  // Cancel any active trade
  if (gameSocket.player.tradeSession) {
    gameServer.tradeManager.cancelTrade(gameSocket.player, "Trade cancelled.");
  }

  // If the player is not in combat we can immediately remove the player
  if (!gameSocket.player.isInCombat() || gameServer.isClosed()) {
    return this.__removePlayer(gameSocket);
  }

  let delayFrames = Math.max(
    gameSocket.player.combatLock.remainingFrames(),
    gameSocket.player.pzLock.remainingFrames()
  );

  let logoutEvent = gameServer.world.eventQueue.addEvent(
    this.__removePlayer.bind(this, gameSocket),
    delayFrames
  );

  return gameSocket.player.socketHandler.setLogoutEvent(logoutEvent);
};

WebsocketServer.prototype.__removePlayer = function (gameSocket) {
  /*
   * WebsocketServer.__removePlayer
   * Removes a player from the game world and stored its informaton in the database
   */

  try {
    // Make sure player exists and has valid properties
    if (!gameSocket.player) {
      return;
    }

    // Sync properties before removing from world
    gameSocket.player.syncProperties();

    // Delete the player from the world
    gameServer.world.creatureHandler.removePlayerFromWorld(gameSocket);

    // Save the character information to the database (via batch save)
    gameServer.markPlayerDirty(gameSocket);
    this.accountDatabase.saveCharacter(gameSocket, function (error) {
      if (error) {
        console.error(
          "Error storing player information for %s: %s".format(
            gameSocket.player.getProperty(CONST.PROPERTIES.NAME),
            error
          )
        );
        return;
      }
    });
  } catch (error) {
    console.error("Error in __removePlayer:", error);
  }
};

module.exports = WebsocketServer;
