const NetworkManager = function () {

  /*
   * Class NetworkManager
   * Handles networking over the websocket
   */

  // Internal class state
  this.state = new State();
  this.state.add("bytesRecv", null);
  this.state.add("bytesSent", null);
  this.state.add("latency", null);
  this.state.add("nPackets", null);
  this.state.add("connected", null);

  this.nPacketsSent = 0;

  // The handler for all incoming packets
  this.packetHandler = new PacketHandler();

  // Rate limiter: max packets per second to prevent spam/flood
  this.__rateLimitMax = 25;
  this.__rateLimitWindow = 1000;
  this.__rateLimitTimestamps = [];

  // XOR encryption key (8 bytes, base64-decoded from login response)
  this.__xorKey = null;

  // Keep-alive interval to prevent server/proxy idle timeout
  this.__keepAliveInterval = null;

}

NetworkManager.prototype.close = function () {

  /*
   * Class NetworkManager.close
   * Closes the socket to the gameserver
   */

  return this.socket.close();

}

NetworkManager.prototype.isConnected = function () {

  /*
   * Class NetworkManager.isConnected
   * Returns true if the network manager is connected to the gameserver
   */

  return this.state.connected;

}

NetworkManager.prototype.readPacket = function (packet) {

  /*
   * Class NetworkManager.readPacket
   * Reads a packet received from the gameserver
   */

  this.state.nPackets++;

  // What operation the server sends is the first byte
  switch (packet.readUInt8()) {

    case CONST.PROTOCOL.SERVER.SPELL_ADD: {
      return gameClient.interface.updateSpells(packet.readUInt16());
    }

    case CONST.PROTOCOL.SERVER.PLAYER_STATISTICS: {
      return this.packetHandler.handlePlayerStatistics(packet.readCharacterStatistics());
    }

    // NPC trade offers are received
    case CONST.PROTOCOL.SERVER.TRADE_OFFER: {
      return this.packetHandler.handleTradeOffer(packet.readTradeOffer());
    }

    // A remove friend is requested
    case CONST.PROTOCOL.SERVER.REMOVE_FRIEND: {
      return this.packetHandler.handleRemoveFriend(packet.readString());
    }

    case CONST.PROTOCOL.SERVER.ITEM_TRANSFORM: {
      return this.packetHandler.handleTransformTile(packet.readTransformTile());
    }

    case CONST.PROTOCOL.SERVER.MESSAGE_CANCEL: {
      return this.packetHandler.handleCancelMessage(packet.readString());
    }

    case CONST.PROTOCOL.SERVER.ITEM_INFORMATION: {
      return this.packetHandler.handleItemInformation(packet.readItemInformation());
    }

    case CONST.PROTOCOL.SERVER.TARGET: {
      return this.packetHandler.handleSetTarget(packet.readUInt32());
    }

    case CONST.PROTOCOL.SERVER.OUTFIT: {
      return this.packetHandler.handleChangeOutfit(packet.readChangeOutfit());
    }

    case CONST.PROTOCOL.SERVER.OUTFIT_UNLOCK: {
      return this.packetHandler.handleOutfitUnlock(packet.readOutfitUnlock());
    }

    case CONST.PROTOCOL.SERVER.ITEM_TEXT: {
      return this.packetHandler.handleReadText(packet.readReadable());
    }

    case CONST.PROTOCOL.SERVER.STATE_SERVER: {
      return this.packetHandler.handleServerData(packet);
    }

    case CONST.PROTOCOL.SERVER.CHANNEL_JOIN: {
      return this.packetHandler.handleOpenChannel(packet.readOpenChannel());
    }

    case CONST.PROTOCOL.SERVER.COMBAT_LOCK: {
      return this.packetHandler.handleCombatLock(packet.readBoolean());
    }

    case CONST.PROTOCOL.SERVER.MAGIC_EFFECT: {
      return this.packetHandler.handleSendMagicEffect(packet.readMagicEffect());
    }

    case CONST.PROTOCOL.SERVER.DISTANCE_EFFECT: {
      return this.packetHandler.handleSendDistanceEffect(packet.readDistanceEffect());
    }

    case CONST.PROTOCOL.SERVER.CONTAINER_REMOVE: {
      return this.packetHandler.handleContainerItemRemove(packet.readContainerItemRemove());
    }

    case CONST.PROTOCOL.SERVER.CREATURE_STATE: {
      return this.packetHandler.handleEntityReference(packet.readCreatureInfo());
    }

    case CONST.PROTOCOL.SERVER.CREATURE_INFORMATION: {
      return this.packetHandler.handleCharacterInformation(packet.readCharacterInformation());
    }

    case CONST.PROTOCOL.SERVER.CONTAINER_CLOSE: {
      return this.packetHandler.handleContainerClose(packet.readUInt32());
    }

    case CONST.PROTOCOL.SERVER.LATENCY: {
      return this.packetHandler.handleLatency();
    }

    case CONST.PROTOCOL.SERVER.CREATURE_MOVE: {
      return this.packetHandler.handleCreatureServerMove(packet.readEntityMove());
    }

    case CONST.PROTOCOL.SERVER.ITEM_ADD: {
      return this.packetHandler.handleItemAdd(packet.readTileItemAdd());
    }

    case CONST.PROTOCOL.SERVER.CONTAINER_OPEN: {
      return this.packetHandler.handleContainerOpen(packet.readOpenContainer());
    }

    case CONST.PROTOCOL.SERVER.CONTAINER_ADD: {
      return this.packetHandler.handleContainerAddItem(packet.readContainerItemAdd());
    }

    case CONST.PROTOCOL.SERVER.STATE_PLAYER: {
      return this.packetHandler.handleAcceptLogin(packet.readPlayerInfo());
    }

    case CONST.PROTOCOL.SERVER.ITEM_REMOVE: {
      return this.packetHandler.handleRemoveItem(packet.readRemoveItem());
    }

    case CONST.PROTOCOL.SERVER.SPELL_CAST: {
      return gameClient.player.spellbook.serverCastSpell(packet.readCastSpell());
    }

    case CONST.PROTOCOL.SERVER.CHUNK: {
      return this.packetHandler.handleChunk(packet.readChunkData());
    }

    case CONST.PROTOCOL.SERVER.SERVER_ERROR: {
      return this.packetHandler.handleServerError(packet.readString());
    }

    case CONST.PROTOCOL.SERVER.MESSAGE_SERVER: {
      return this.packetHandler.handleServerMessage(packet.readString());
    }

    case CONST.PROTOCOL.SERVER.CREATURE_REMOVE: {
      return this.packetHandler.handleEntityRemove(packet.readUInt32());
    }

    case CONST.PROTOCOL.SERVER.CREATURE_TELEPORT: {
      return this.packetHandler.handleEntityTeleport(packet.readCreatureTeleport());
    }

    case CONST.PROTOCOL.SERVER.MESSAGE_PRIVATE: {
      return this.packetHandler.handleReceivePrivateMessage(packet.readPrivateMessage());
    }

    case CONST.PROTOCOL.SERVER.PLAYER_LOGIN: {
      return this.packetHandler.handlePlayerConnect(packet.readString());
    }

    case CONST.PROTOCOL.SERVER.PLAYER_LOGOUT: {
      return this.packetHandler.handlePlayerDisconnect(packet.readString());
    }

    case CONST.PROTOCOL.SERVER.WORLD_TIME: {
      return this.packetHandler.handleWorldTime(packet.readUInt32());
    }

    case CONST.PROTOCOL.SERVER.CREATURE_MESSAGE: {
      return this.packetHandler.handleChannelMessage(packet.readChannelMessage());
    }

    case CONST.PROTOCOL.SERVER.TOGGLE_CONDITION: {
      return this.packetHandler.handleCondition(packet.readToggleCondition());
    }

    case CONST.PROTOCOL.SERVER.EMOTE: {
      return this.packetHandler.handleEmote(packet.readDefaultMessage());
    }

    case CONST.PROTOCOL.SERVER.CREATURE_SAY: {
      return this.packetHandler.handleDefaultMessage(packet.readDefaultMessage());
    }

    case CONST.PROTOCOL.SERVER.CREATURE_PROPERTY: {
      return this.packetHandler.handlePropertyChange(packet.readProperty());
    }

    case CONST.PROTOCOL.SERVER.FOOD_TIMER: {
      // Read remaining seconds and update skill window
      let remainingSeconds = packet.readUInt32();
      gameClient.interface.windowManager.getWindow("skill-window").setFoodTimer(remainingSeconds);
      return;
    }

    case CONST.PROTOCOL.SERVER.TRAINING_TIMER: {
      let slotIndex = packet.readUInt8();
      let remainingSeconds = packet.readUInt32();
      if (!gameClient.interface.trainingTimers) {
        gameClient.interface.trainingTimers = {};
      }
      gameClient.interface.trainingTimers[slotIndex] = remainingSeconds;
      // Also update global timer so backpack items can show it
      gameClient.interface.trainingTimer = remainingSeconds;
      return;
    }

    case CONST.PROTOCOL.SERVER.TRADE_OFFER: {
      return this.packetHandler.handleTradeOffer(packet.readTradeOffer());
    }

    case CONST.PROTOCOL.SERVER.ORACLE_SHOW: {
      return this.packetHandler.handleOracleShow(packet.readOracleShow());
    }

    case CONST.PROTOCOL.SERVER.QUEST_LOG: {
      return this.packetHandler.handleQuestLog(packet.readQuestLog());
    }

    case CONST.PROTOCOL.SERVER.QUEST_LINE: {
      return this.packetHandler.handleQuestLine(packet.readQuestLine());
    }

    case 40: {
      return this.packetHandler.handleDeath();
    }

    case CONST.PROTOCOL.SERVER.PARTY_INVITE: {
      return this.packetHandler.handlePartyInvite(packet.readString());
    }
    case CONST.PROTOCOL.SERVER.PARTY_INVITE_RESULT: {
      return this.packetHandler.handlePartyInviteResult(packet.readBoolean(), packet.readString());
    }
    case CONST.PROTOCOL.SERVER.PARTY_LEAVE: {
      return this.packetHandler.handlePartyLeave();
    }
    case CONST.PROTOCOL.SERVER.PARTY_SKULL: {
      return this.packetHandler.handlePartySkull(packet.readUInt32(), packet.readUInt8());
    }
    case CONST.PROTOCOL.SERVER.PARTY_SHIELD: {
      return this.packetHandler.handlePartyShield(packet.readUInt32(), packet.readUInt8());
    }
    case CONST.PROTOCOL.SERVER.PARTY_DATA: {
      return this.packetHandler.handlePartyData(packet);
    }
    case CONST.PROTOCOL.SERVER.VIP_ADD_RESULT: {
      return this.packetHandler.handleVipAddResult(packet.readString(), packet.readBoolean(), packet.readBoolean());
    }

    case CONST.PROTOCOL.SERVER.BLESSING_UPDATE: {
      return this.packetHandler.handleBlessingUpdate({ bitmask: packet.readUInt8(), isPremium: packet.readUInt8() });
    }

    case CONST.PROTOCOL.SERVER.GUILD_DATA: {
      return this.packetHandler.handleGuildData(packet.readString());
    }
    case CONST.PROTOCOL.SERVER.GUILD_UPDATE: {
      return this.packetHandler.handleGuildData(packet.readString());
    }
    case CONST.PROTOCOL.SERVER.GUILD_INVITE_RESULT: {
      return this.packetHandler.handleGuildInviteResult(packet.readUInt8(), packet.readString());
    }

    case CONST.PROTOCOL.SERVER.HOUSE_INFO: {
      return this.packetHandler.handleHouseInfo(packet);
    }

    case CONST.PROTOCOL.SERVER.HOUSE_MANAGE_INFO: {
      return this.packetHandler.handleHouseManageInfo(packet);
    }

    case CONST.PROTOCOL.SERVER.RENT_CONFIRM_INFO: {
      return this.packetHandler.handleRentConfirmInfo(packet);
    }

    case CONST.PROTOCOL.SERVER.TRADE_REQUEST: {
      return this.packetHandler.handleTradeRequest(packet);
    }
    case CONST.PROTOCOL.SERVER.TRADE_START: {
      return this.packetHandler.handleTradeStart(packet);
    }
    case CONST.PROTOCOL.SERVER.TRADE_UPDATE: {
      return this.packetHandler.handleTradeUpdate(packet);
    }
    case CONST.PROTOCOL.SERVER.TRADE_CONFIRM: {
      return this.packetHandler.handleTradeConfirm(packet);
    }
    case CONST.PROTOCOL.SERVER.TRADE_COMPLETE: {
      return this.packetHandler.handleTradeComplete(packet);
    }
    case CONST.PROTOCOL.SERVER.TRADE_CANCEL: {
      return this.packetHandler.handleTradeCancel(packet);
    }
    case CONST.PROTOCOL.SERVER.IGNORE_DATA: {
      return this.packetHandler.handleIgnoreData(packet);
    }
    case CONST.PROTOCOL.SERVER.IGNORE_ADD_RESULT: {
      return this.packetHandler.handleIgnoreAddResult(packet.readString(), packet.readBoolean());
    }
    case CONST.PROTOCOL.SERVER.IGNORE_REMOVE_RESULT: {
      return this.packetHandler.handleIgnoreRemoveResult(packet.readString(), packet.readBoolean());
    }
    case CONST.PROTOCOL.SERVER.VOICE_DATA: {
      return this.packetHandler.handleVoiceData(packet);
    }

    case CONST.PROTOCOL.SERVER.PREMIUM_BALANCE_UPDATE: {
      return this.packetHandler.handlePremiumBalanceUpdate(packet.readUInt32());
    }

    case CONST.PROTOCOL.SERVER.GLOBAL_BOOST_UPDATE: {
      return this.packetHandler.handleGlobalBoostUpdate(packet.readUInt32(), packet.readUInt32(), packet.readUInt32());
    }

    case CONST.PROTOCOL.SERVER.ADMIN_ADD_SKILL_MODAL: {
      return this.packetHandler.handleAdminAddSkillModal();
    }

    case CONST.PROTOCOL.SERVER.BOT_PANEL: {
      return this.packetHandler.handleBotPanel(packet);
    }

    case CONST.PROTOCOL.SERVER.MARKET_OPEN_OWNER: {
      return this.packetHandler.handleMarketOpenOwner(packet);
    }

    case CONST.PROTOCOL.SERVER.MARKET_OPEN_BUYER: {
      return this.packetHandler.handleMarketOpenBuyer(packet);
    }

    case CONST.PROTOCOL.SERVER.MARKET_BUY_RESULT: {
      return this.packetHandler.handleMarketBuyResult(packet);
    }

    case CONST.PROTOCOL.SERVER.MARKET_CLOSED: {
      return this.packetHandler.handleMarketClosed(packet);
    }

    default:
      var _unknownId = packet.buffer && packet.buffer.length > 0 ? packet.buffer[0] : -1;
      console.error("[DEBUG] Unknown packet ID:", _unknownId, "(0x" + (_unknownId >= 0 ? _unknownId.toString(16) : "??") + ")");
      throw ("An unknown packet was received from the server (ID=" + _unknownId + ").");

  }

}

NetworkManager.prototype.send = function (packet) {

  /*
   * Function NetworkManager.send
   * Writes a packet to the gameserver with rate limiting
   */

  // Not connected to the gameserver
  if (!this.isConnected()) {
    return;
  }

  // Socket is closing or closed — don't attempt to send
  if (this.socket.readyState !== WebSocket.OPEN) {
    return;
  }

  // Rate limiting: drop packet if over limit
  if (!this.__checkRateLimit()) {
    try {
      if (gameClient.interface && gameClient.interface.channelManager) {
        gameClient.interface.channelManager.addConsoleMessage("[DEBUG] Packet dropped by rate limit", gameClient.interface.COLORS.ORANGE);
      }
    } catch(e) {}
    return;
  }

  buffer = packet.getBuffer();

  // Save some state
  this.state.bytesSent += buffer.length;
  this.nPacketsSent++;

  // Encrypt outgoing data
  let encrypted = this.__xorData(buffer);

  // Just write the buffer over the websocket
  this.socket.send(encrypted);

}

NetworkManager.prototype.sendText = function (msg) {

  if (!this.isConnected()) {
    return;
  }

  this.socket.send(msg);

}

NetworkManager.prototype.__checkRateLimit = function () {

  /*
   * Function NetworkManager.__checkRateLimit
   * Returns true if the packet is allowed through, false if rate limited
   */

  let now = performance.now();

  // Remove timestamps older than the window
  this.__rateLimitTimestamps = this.__rateLimitTimestamps.filter(function (t) {
    return (now - t) < this.__rateLimitWindow;
  }, this);

  // Check if we've exceeded the limit
  if (this.__rateLimitTimestamps.length >= this.__rateLimitMax) {
    return false;
  }

  // Record this packet timestamp
  this.__rateLimitTimestamps.push(now);

  return true;

}

NetworkManager.prototype.getLatency = function () {

  /*
   * Function NetworkManager.pingServer
   * Pings the game server with a stay-alive message
   */

  // Save the ping timing and write the packet
  this.__latency = performance.now();

  this.send(new LatencyPacket());

  try {
    if (gameClient.interface && gameClient.interface.channelManager) {
      var now = Date.now();
      if (!this.__lastPingLog || now - this.__lastPingLog > 10000) {
        this.__lastPingLog = now;
      }
    }
  } catch(e) {}

}

NetworkManager.prototype.getConnectionString = function (response, characterName) {

  /*
   * Function NetworkManager.getConnectionString
   * Returns the connection string from the protocol, host, and port
   */

  let url = "%s?token=%s".format(response.host, response.token);
  if (characterName) {
    url += "&character=%s".format(encodeURIComponent(characterName));
  }
  return url;

}

NetworkManager.prototype.getConnectionSettings = function () {

  /*
   * Function NetworkManager.getConnectionSettings
   * Returns the configured connection settings from the DOM
   */

  return document.getElementById("host").value;

}

NetworkManager.prototype.createAccount = function (options) {

  /*
   * Function NetworkManager.createAccount
   * Creates a new account and character via POST with JSON body
   */

  // Send credentials in JSON body, never in URL
  let refCode = window.gameClient && window.gameClient.referralCode;
  let body = {
    account: options.account,
    password: options.password,
    email: options.email
  };
  if (refCode) {
    body.ref = refCode;
  }
  fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(function (response) {

    switch (response.status) {
      case 201: break;
      case 400: throw ("Malformed account creation request.");
      case 409: throw ("An account with this name already exists.");
      case 500: throw ("The server experienced an internal error.");
    }

    // Update the DOM with the newly created account
    document.getElementById("user-username").value = options.account;
    document.getElementById("user-password").value = options.password;
    localStorage.setItem("__savedUsername", options.account);
    localStorage.setItem("__savedPassword", options.password);

    gameClient.interface.modalManager.open("floater-enter")

  }).catch(x => gameClient.interface.modalManager.open("floater-connecting", x));

}

NetworkManager.prototype.fetchCallback = function (response) {

  /*
   * Function NetworkManager.fetchCallback
   * Callback to fire for fetch requests: check HTTP Status Code
   */

  if (response.status !== 200) {
    return Promise.reject(response);
  }

  return Promise.resolve(response.arrayBuffer());

}

NetworkManager.prototype.loadGameFilesServer = function (callback) {

  // The resource to load from the server
  let resources = new Array("Tibia.spr", "Tibia.dat");

  let promises = resources.map(function (url) {
    let fullUrl = "/things/" + url;

    // Add 30s timeout to prevent hanging
    var controller = new AbortController();
    var timeoutId = setTimeout(function() {
      controller.abort();
    }.bind(this), 30000);

    return fetch(fullUrl + "?v=" + Date.now(), { signal: controller.signal }).then(function(response) {
      clearTimeout(timeoutId);
      if (response.status !== 200) {
        throw new Error("HTTP " + response.status + " for " + fullUrl);
      }
      return response.arrayBuffer();
    }.bind(this)).catch(function(err) {
      clearTimeout(timeoutId);
      throw err;
    }.bind(this));
  }, this);

  // Wait for completing of resources
  Promise.all(promises).then(function ([dataSprites, dataObjects]) {
    gameClient.spriteBuffer.load("Tibia.spr", { "target": { "result": dataSprites } });
    gameClient.dataObjects.load("Tibia.dat", { "target": { "result": dataObjects } });
    if (callback) { callback(null); }
  }.bind(this)).catch(function (error) {
    var errMsg = "Failed loading files: " + (error && error.status ? "HTTP " + error.status : (error && error.message ? error.message : String(error)));
    if (callback) { callback(error); }
  }.bind(this));

}

NetworkManager.prototype.connect = function () {

  /*
   * Function NetworkManager.connect
   * Connects to the server websocket at the remote host and port
   */

  let { account, password } = gameClient.interface.getAccountDetails();

  // Contact the login server — POST with JSON body (credentials never in URL)
  fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account: account, password: password })
  }).then(function (response) {

    switch (response.status) {
      case 200: return response.json();
      case 401: throw new AuthenticationError("The account number or password is incorrect.");
      case 500: throw new ServerError("The server experienced an internal error.");
      case 503: throw new ServerError("Login server unavailable.");
      default: throw new Error("Login failed (HTTP " + response.status + ")");
    }

  }).then(function (response) {

    this.__openSocket(response);

  }.bind(this)).catch(x => gameClient.interface.modalManager.open("floater-connecting", x));

}

NetworkManager.prototype.connectWithToken = function (token, host, characterName, xorKey) {

  /*
   * Function NetworkManager.connectWithToken
   * Opens websocket connection with an existing token and character name
   */

  this.__openSocket({ token: token, host: host, characterName: characterName, xorKey: xorKey });

}

NetworkManager.prototype.__setXorKey = function (base64Key) {
  if (!base64Key) { this.__xorKey = null; return; }
  let binary = atob(base64Key);
  let key = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    key[i] = binary.charCodeAt(i);
  }
  this.__xorKey = key;
}

NetworkManager.prototype.__xorData = function (data) {
  if (!this.__xorKey) return data;
  let view = new Uint8Array(data);
  for (let i = 0; i < view.length; i++) {
    view[i] ^= this.__xorKey[i % this.__xorKey.length];
  }
  return view.buffer;
}

NetworkManager.prototype.__openSocket = function (response) {

  // Show the connecting message
  gameClient.interface.modalManager.open("floater-connecting", "Connecting to Gameworld...");

  // Store XOR encryption key from login response
  this.__setXorKey(response.xorKey);

  // Open the websocket connection: binary transfer of data
  this.socket = new WebSocket(this.getConnectionString(response, response.characterName));
  this.socket.binaryType = "arraybuffer";

  // Attach callbacks
  this.socket.onopen = this.__handleConnection.bind(this);
  this.socket.onmessage = this.__handlePacket.bind(this);
  this.socket.onclose = this.__handleClose.bind(this);
  this.socket.onerror = this.__handleError.bind(this);

}

NetworkManager.prototype.__handlePacket = function (event) {

  /*
   * Function NetworkManager.__handlePacket
   * Handles an incoming binary message
   */

  // Decrypt incoming data
  let decrypted = this.__xorData(event.data);

  // Wrap the buffer in a readable packet
  let packet = new PacketReader(decrypted);

  // Save the number of received bytes
  this.state.bytesRecv += packet.buffer.length;

  // Can still read the packet
  while (packet.readable()) {
    try {
      this.readPacket(packet);
    } catch (e) {
      console.error("[DEBUG] __handlePacket: error processing packet:", e);
    }
  }



}

NetworkManager.prototype.__handleError = function (event) {

  /*
   * Function GameClient.__handleError
   * Gracefully handle websocket errors..
   */

  gameClient.interface.modalManager.open("floater-connecting", new ConnectionError("Could not connect to the Gameworld. <br> Please try again later."));

  try {
    if (gameClient.interface && gameClient.interface.channelManager) {
      var msg = event && event.message ? event.message : (event && event.type ? event.type : "unknown");
      gameClient.interface.channelManager.addConsoleMessage("[DEBUG] WebSocket error: " + msg, gameClient.interface.COLORS.RED);
    }
  } catch(e) {}

}

NetworkManager.prototype.__handleClose = function (event) {

  /*
   * Function NetworkManager.__handleClose
   * Callback function for when the websocket connection is closed
   */

  var closeCode = event ? event.code : "unknown";
  var closeReason = event && event.reason ? event.reason : "none";
  console.log("Disconnected: code=" + closeCode + " reason=" + closeReason);

  // If we are connected to the game world: handle a reset
  if (this.state.connected && gameClient.renderer) {
    gameClient.reset();
  }

  // Set connected to false
  this.state.connected = false;

  // Stop keep-alive interval
  if (this.__keepAliveInterval) {
    clearInterval(this.__keepAliveInterval);
    this.__keepAliveInterval = null;
  }

}

NetworkManager.prototype.__handleConnection = function (event) {

  /*
   * Function NetworkManager.__handleConnection
   * Callback fired when connected to the gameserver
   */

  this.state.connected = true;

  try {
    if (gameClient.interface && gameClient.interface.channelManager) {
    }
  } catch(e) {}

  // Start keep-alive pings every 2 seconds to prevent idle timeout disconnects
  if (this.__keepAliveInterval) {
    clearInterval(this.__keepAliveInterval);
  }
  this.__keepAliveInterval = setInterval(function () {
    if (this.isConnected()) {
      this.getLatency();
    }
  }.bind(this), 2000);

}
