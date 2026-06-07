"use strict";

const PacketReader = requireModule("network/packet-reader");
const PacketHandler = requireModule("network/packet-handler");

const { createWriteStream, existsSync, mkdirSync } = require("fs");
const path = require("path");



function NetworkManager() {

  /*
   * Class NetworkManager
   * Accepts all the incoming network messages and delegates to the appropriate handlers
   *
   * API:
   *
   * @NetworkManager.writeOutgoingBuffer(socket) - writes the outgoing buffered messages to the socket
   * @NetworkManager.readIncomingBuffer(socket) - reads the incoming buffered messages from the socket
   * @NetworkManager.getDataDetails() - returns the number of bytes written/read by the server
   *
   */

  // The handler for packets
  this.packetHandler = new PacketHandler(this);

  // Stream for all packets received by the server
  let packetPath = path.join(__dirname, "..", "..", "logs", "packets.wal");
  let packetDir = path.dirname(packetPath);
  if (!existsSync(packetDir)) {
    mkdirSync(packetDir, { recursive: true });
  }
  this.packetStream = createWriteStream(packetPath);

}

NetworkManager.prototype.writeOutgoingBuffer = function (gameSocket) {

  /*
   * Function WebsocketServer.writeOutgoingBuffer
   * Flushes the outgoing network buffer to the client
   */

  // Ignore if the socket was already destroyed
  if (gameSocket.socket.destroyed) {
    return;
  }

  // No messages
  if (gameSocket.outgoingBuffer.isEmpty()) {
    return;
  }

  let message = gameSocket.outgoingBuffer.flush();

  // XOR encrypt outgoing data
  if (gameSocket.__xorKey) {
    let encrypted = Buffer.allocUnsafe(message.length);
    for (let i = 0; i < message.length; i++) {
      encrypted[i] = message[i] ^ gameSocket.__xorKey[i % gameSocket.__xorKey.length];
    }
    message = encrypted;
  }

  gameSocket.socket.send(message);

}

NetworkManager.prototype.handleIO = function (gameSocket) {

  /*
   * Function NetworkManager.handleIO
   * Handles buffered input and output for a game socket
   */

  this.readIncomingBuffer(gameSocket);
  this.writeOutgoingBuffer(gameSocket);

}

NetworkManager.prototype.readIncomingBuffer = function (gameSocket) {

  /*
   * Function GameServer.readIncomingBuffer
   * Flushes the incoming network message buffer
   */

  // Read the incoming buffer
  let buffer = gameSocket.incomingBuffer.flush();

  // Write all received records to disk
  this.packetStream.write(buffer);

  // Block excessively large inputs by the users
  if (buffer.length > CONFIG.SERVER.MAX_PACKET_SIZE) {
    return gameSocket.close();
  }

  // Class to easily read a buffer sequentially
  let packet = new PacketReader(buffer);

  // Extend the idle lock if a packet is received
  if (packet.isReadable()) {
    gameSocket.player.idleHandler.extend();
  }

  // Keep parsing the incoming buffer
  while (packet.isReadable()) {

    // Prevent reading the incoming buffer if the socket was destroyed
    if (gameSocket.socket.destroyed) {
      return;
    }

    // Parsing client packets is very dangerous so wrap in a try/catch. Should probably verify length of packets!
    try {
      this.__readPacket(gameSocket, packet);
    } catch (exception) {
      console.trace(exception);
      return gameSocket.close();
    }

  }

}


NetworkManager.prototype.__readPacket = function (gameSocket, packet) {

  /*
   * Function NetworkManager.__readPacket
   * Reads a single packet from the passed buffer
   */

  // Read the opcode of the packet
  let opcode = packet.readUInt8();

  // The packet operational code
  switch (opcode) {

    // Cancel target packet is requested (esc key)
    case CONST.PROTOCOL.CLIENT.BUY_OFFER: {
      return gameSocket.player.handleBuyOffer(packet.readBuyOffer());
    }

    // Player sells an item to an NPC
    case CONST.PROTOCOL.CLIENT.SELL_OFFER: {
      return gameSocket.player.handleSellOffer(packet.readSellOffer());
    }

    // Premium Shop: request current balance
    case CONST.PROTOCOL.CLIENT.REQUEST_PREMIUM_BALANCE: {
      return this.packetHandler.handleRequestPremiumBalance(gameSocket.player);
    }

    // Premium Shop: buy an item
    case CONST.PROTOCOL.CLIENT.BUY_PREMIUM_ITEM: {
      return this.packetHandler.handleBuyPremiumItem(gameSocket.player, packet);
    }

    // Cancel target packet is requested (esc key)
    case CONST.PROTOCOL.CLIENT.TARGET_CANCEL: {
      return gameSocket.player.setTarget(null);
    }

    // Adding friend packet is received
    case CONST.PROTOCOL.CLIENT.FRIEND_ADD: {
      let name = packet.readString();
      let playerName = gameSocket.player.getProperty(CONST.PROPERTIES.NAME);
      if (!name || name === playerName) {
        gameSocket.write(new (requireModule("network/protocol").CancelMessagePacket)("You cannot add yourself to the VIP list."));
        return;
      }
      let existing = gameSocket.player.friendlist.add(name);
      if (!existing) return; // already in list
      let target = gameServer.world.creatureHandler.getPlayerByName(name);
      if (target) {
        gameSocket.write(new (requireModule("network/protocol").VipAddResultPacket)(name, true, true));
        return;
      }
      let accountDb = process.gameServer.HTTPServer.websocketServer.accountDatabase;
      accountDb.findPlayerByName(name, function (error, exists) {
        if (!error && exists) {
          gameSocket.write(new (requireModule("network/protocol").VipAddResultPacket)(name, true, false));
        } else {
          gameSocket.player.friendlist.remove(name);
          gameSocket.write(new (requireModule("network/protocol").VipAddResultPacket)(name, false));
        }
      });
      return;
    }

    // Remove friend packet is received
    case CONST.PROTOCOL.CLIENT.FRIEND_REMOVE: {
      return gameSocket.player.friendlist.remove(packet.readString());
    }

    // Packet that requests looking at an item
    case CONST.PROTOCOL.CLIENT.THING_LOOK: {
      return this.packetHandler.handleItemLook(gameSocket.player, packet.readPositionAndIndex(gameSocket.player));
    }

    // An outfit change is requested
    case CONST.PROTOCOL.CLIENT.THING_USE: {
      return gameSocket.player.useHandler.handleItemUse(packet.readPositionAndIndex(gameSocket.player));
    }

    // An outfit change is requested
    case CONST.PROTOCOL.CLIENT.THING_USE_WITH: {
      return gameSocket.player.useHandler.handleActionUseWith(packet.readItemUseWith(gameSocket.player));
    }

    case CONST.PROTOCOL.CLIENT.OUTFIT: {
      const Outfit = requireModule("entities/outfit");
      let outfit = packet.readOutfit();
      let outfitData = Outfit.prototype.OUTFITS[String(outfit.id)];
      if (outfitData && outfitData.premium && !gameSocket.player.isPremium()) {
        return gameSocket.player.write(new (requireModule("network/protocol").CancelMessagePacket)("This outfit is only available to premium players."));
      }
      if (outfitData && !outfitData.premium) {
        let defaults = gameSocket.player.getProperty(CONST.PROPERTIES.SEX) === CONST.SEX.MALE
          ? [111, 112, 113, 114] : [118, 119, 120, 121];
        if (defaults.indexOf(outfit.id) === -1) {
          let available = gameSocket.player.getProperty(CONST.PROPERTIES.OUTFITS);
          if (Array.isArray(available)) available = new Set(available);
          if (!available || !available.has(outfit.id)) {
            return gameSocket.player.write(new (requireModule("network/protocol").CancelMessagePacket)("You don't own this outfit."));
          }
        }
      }
      return gameSocket.player.changeOutfit(outfit);
    }

    case CONST.PROTOCOL.CLIENT.CHANNEL_LEAVE: {
      return gameServer.world.channelManager.leaveChannel(gameSocket.player, packet.readUInt8());
    }

    case CONST.PROTOCOL.CLIENT.CHANNEL_JOIN: {
      return gameServer.world.channelManager.joinChannel(gameSocket.player, packet.readUInt8());
    }

    // A spell was casted by the player
    case CONST.PROTOCOL.CLIENT.CAST_SPELL: {
      return gameSocket.player.spellbook.handleSpell(packet.readUInt16());
    }

    // An item move was requested
    case CONST.PROTOCOL.CLIENT.THING_MOVE: {
      return this.packetHandler.moveItem(gameSocket.player, packet.readMoveItem(gameSocket.player));
    }

    case CONST.PROTOCOL.CLIENT.TURN: {
      return gameSocket.player.setDirection(packet.readUInt8());
    }

    case CONST.PROTOCOL.CLIENT.CONTAINER_CLOSE: {
      return this.packetHandler.handleContainerClose(gameSocket.player, packet.readUInt32());
    }

    case CONST.PROTOCOL.CLIENT.OPEN_GIFT_CONTAINER: {
      return this.packetHandler.handleOpenGiftContainer(gameSocket.player);
    }

    case CONST.PROTOCOL.CLIENT.TARGET: {
      return this.packetHandler.handleTargetCreature(gameSocket.player, packet.readUInt32());
    }

    case CONST.PROTOCOL.CLIENT.CLIENT_USE_TILE: {
      return this.handleTileUse(gameSocket.player, packet.readWorldPosition());
    }

    // A string is sent by the player
    case CONST.PROTOCOL.CLIENT.CHANNEL_MESSAGE: {
      return this.packetHandler.handlePlayerSay(gameSocket.player, packet.readClientMessage());
    }

    case CONST.PROTOCOL.CLIENT.MARKET_START: {
      return this.packetHandler.handleMarketStart(gameSocket.player, packet);
    }

    case CONST.PROTOCOL.CLIENT.MARKET_BUY: {
      return this.packetHandler.handleMarketBuy(gameSocket.player, packet);
    }

    case CONST.PROTOCOL.CLIENT.MARKET_CLOSE: {
      return this.packetHandler.handleMarketClose(gameSocket.player);
    }

    case CONST.PROTOCOL.CLIENT.MARKET_REQUEST_VIEW: {
      return this.packetHandler.handleMarketRequestView(gameSocket.player, packet);
    }

    case CONST.PROTOCOL.CLIENT.LOGOUT: {
      return this.packetHandler.handleLogout(gameSocket);
    }

    // A private message is received
    case CONST.PROTOCOL.CLIENT.CHANNEL_PRIVATE_MESSAGE: {
      return gameServer.world.channelManager.handleSendPrivateMessage(gameSocket.player, packet.readPrivateMessage());
    }

    // Player movement operation
    case CONST.PROTOCOL.CLIENT.MOVE: {
      return gameSocket.player.movementHandler.handleMovement(packet.readUInt8());
    }

    // Fight mode change (OFFENSIVE, BALANCED, DEFENSIVE)
    case CONST.PROTOCOL.CLIENT.FIGHT_MODE: {
      return gameSocket.player.setFightMode(packet.readUInt8());
    }

    // Chase mode change (STAND, CHASE)
    case CONST.PROTOCOL.CLIENT.CHASE_MODE: {
      return gameSocket.player.setChaseMode(packet.readUInt8());
    }

    // Use item on creature (from battle list)
    case CONST.PROTOCOL.CLIENT.THING_USE_ON_CREATURE: {
      return gameSocket.player.useHandler.handleActionUseOnCreature(packet.readItemUseOnCreature(gameSocket.player));
    }

    // Write text to item (labels, letters, books)
    case CONST.PROTOCOL.CLIENT.WRITE_TEXT: {
      return this.packetHandler.writeText(gameSocket.player, packet);
    }

    // Quest Log Request
    case CONST.PROTOCOL.CLIENT.QUEST_LOG: {
      return this.packetHandler.handleQuestLog(gameSocket.player, packet.readQuestLog());
    }

    // Party invite
    case CONST.PROTOCOL.CLIENT.PARTY_INVITE: {
      return gameSocket.player.partyHandler.handleInvite(packet.readString());
    }
    case CONST.PROTOCOL.CLIENT.PARTY_JOIN: {
      return gameSocket.player.partyHandler.handleJoin(packet.readString());
    }
    case CONST.PROTOCOL.CLIENT.PARTY_LEAVE: {
      return gameSocket.player.partyHandler.handleLeave();
    }
    case CONST.PROTOCOL.CLIENT.PARTY_KICK: {
      return gameSocket.player.partyHandler.handleKick(packet.readString());
    }
    case CONST.PROTOCOL.CLIENT.PARTY_PASS_LEADERSHIP: {
      return gameSocket.player.partyHandler.handlePassLeadership(packet.readString());
    }

    // Oracle character creation selection
    case CONST.PROTOCOL.CLIENT.ORACLE_SELECTION: {
      return gameSocket.player.handleOracleSelection(packet.readOracleSelection());
    }

    // Blessing purchase from client modal
    case CONST.PROTOCOL.CLIENT.BUY_BLESSING: {
      let blessingData = packet.readBlessingBuy();
      return gameSocket.player.handleBlessingBuy(blessingData.index, blessingData.currency);
    }

    // Guild operations
    case CONST.PROTOCOL.CLIENT.GUILD_REQUEST_INFO: {
      return this.packetHandler.handleGuildRequestInfo(gameSocket);
    }
    case CONST.PROTOCOL.CLIENT.GUILD_DEPOSIT: {
      return this.packetHandler.handleGuildDeposit(gameSocket, packet.readUInt32());
    }
    case CONST.PROTOCOL.CLIENT.GUILD_WITHDRAW: {
      return this.packetHandler.handleGuildWithdraw(gameSocket, packet.readUInt32());
    }
    case CONST.PROTOCOL.CLIENT.GUILD_RENAME: {
      return this.packetHandler.handleGuildRename(gameSocket, packet.readString());
    }
    case CONST.PROTOCOL.CLIENT.GUILD_SET_RANK: {
      return this.packetHandler.handleGuildSetRank(gameSocket, packet.readString(), packet.readUInt8());
    }
    case CONST.PROTOCOL.CLIENT.GUILD_REMOVE_MEMBER: {
      return this.packetHandler.handleGuildRemoveMember(gameSocket, packet.readString());
    }
    case CONST.PROTOCOL.CLIENT.GUILD_DELETE: {
      return this.packetHandler.handleGuildDelete(gameSocket);
    }
    case CONST.PROTOCOL.CLIENT.GUILD_DECLARE_WAR: {
      return this.packetHandler.handleGuildDeclareWar(gameSocket, packet.readString());
    }
    case CONST.PROTOCOL.CLIENT.GUILD_INVITE: {
      return this.packetHandler.handleGuildInvite(gameSocket, packet.readString());
    }
    case CONST.PROTOCOL.CLIENT.GUILD_SET_TITLE: {
      return this.packetHandler.handleGuildSetTitle(gameSocket, packet.readString(), packet.readString());
    }

    // House operations
    case CONST.PROTOCOL.CLIENT.HOUSE_BUY: {
      const { HouseBuyPacket } = requireModule("network/protocol");
      return this.packetHandler.handleHouseBuy(gameSocket, new HouseBuyPacket(packet));
    }
    case CONST.PROTOCOL.CLIENT.HOUSE_BUY_OUTRIGHT: {
      const { HouseBuyOutrightPacket } = requireModule("network/protocol");
      return this.packetHandler.handleHouseBuyOutright(gameSocket, new HouseBuyOutrightPacket(packet));
    }
    case CONST.PROTOCOL.CLIENT.HOUSE_INVITE: {
      const { HouseInvitePacketReader } = requireModule("network/protocol");
      return this.packetHandler.handleHouseInvite(gameSocket, new HouseInvitePacketReader(packet));
    }
    case CONST.PROTOCOL.CLIENT.HOUSE_REMOVE_GUEST: {
      const { HouseRemoveGuestPacketReader } = requireModule("network/protocol");
      return this.packetHandler.handleHouseRemoveGuest(gameSocket, new HouseRemoveGuestPacketReader(packet));
    }
    case CONST.PROTOCOL.CLIENT.HOUSE_SELL: {
      const { HouseSellPacketReader } = requireModule("network/protocol");
      return this.packetHandler.handleHouseSell(gameSocket, new HouseSellPacketReader(packet));
    }
    case CONST.PROTOCOL.CLIENT.HOUSE_SET_RENT: {
      const { HouseSetRentPacketReader } = requireModule("network/protocol");
      return this.packetHandler.handleHouseSetRent(gameSocket, new HouseSetRentPacketReader(packet));
    }
    case CONST.PROTOCOL.CLIENT.HOUSE_SET_LISTING: {
      const { HouseSetListingPacketReader } = requireModule("network/protocol");
      return this.packetHandler.handleHouseSetListing(gameSocket, new HouseSetListingPacketReader(packet));
    }
    case CONST.PROTOCOL.CLIENT.HOUSE_CONFIRM_RENT: {
      const { HouseConfirmRentPacketReader } = requireModule("network/protocol");
      return this.packetHandler.handleHouseConfirmRent(gameSocket, new HouseConfirmRentPacketReader(packet));
    }

    // Ignore list operations
    case CONST.PROTOCOL.CLIENT.IGNORE_ADD: {
      let ignoreName = packet.readString();
      let playerName = gameSocket.player.getProperty(CONST.PROPERTIES.NAME);
      if (!ignoreName || ignoreName === playerName) {
        gameSocket.write(new (requireModule("network/protocol").CancelMessagePacket)("You cannot ignore yourself."));
        return;
      }
      if (gameSocket.player.ignorelist.has(ignoreName)) {
        gameSocket.write(new (requireModule("network/protocol").CancelMessagePacket)("This player is already on your ignore list."));
        return;
      }
      gameSocket.player.ignorelist.add(ignoreName);
      gameSocket.write(new (requireModule("network/protocol").IgnoreAddResultPacket)(ignoreName, true));
      return;
    }

    case CONST.PROTOCOL.CLIENT.IGNORE_REMOVE: {
      let removeName = packet.readString();
      if (gameSocket.player.ignorelist.has(removeName)) {
        gameSocket.player.ignorelist.remove(removeName);
        gameSocket.write(new (requireModule("network/protocol").IgnoreRemoveResultPacket)(removeName, true));
      } else {
        gameSocket.write(new (requireModule("network/protocol").CancelMessagePacket)("This player is not on your ignore list."));
      }
      return;
    }

    case CONST.PROTOCOL.CLIENT.IGNORE_LIST: {
      let { IgnoreDataPacket } = requireModule("network/protocol");
      gameSocket.write(new IgnoreDataPacket(gameSocket.player.ignorelist.getList()));
      return;
    }

    case CONST.PROTOCOL.CLIENT.VOICE_DATA: {
      let { VoiceDataPacketClient, VoiceDataPacket } = requireModule("network/protocol");
      let voicePacket = new VoiceDataPacketClient(packet);
      let senderName = gameSocket.player.getProperty(CONST.PROPERTIES.NAME);
      let relay = new VoiceDataPacket(senderName, voicePacket.audioData);
      gameSocket.player.broadcastFloor(relay);
      return;
    }

    // Trade operations
    case CONST.PROTOCOL.CLIENT.TRADE_REQUEST: {
      const { TradeRequestPacketClient } = requireModule("network/protocol");
      return this.packetHandler.handleTradeRequest(gameSocket, new TradeRequestPacketClient(packet));
    }
    case CONST.PROTOCOL.CLIENT.TRADE_ACCEPT: {
      return this.packetHandler.handleTradeAccept(gameSocket);
    }
    case CONST.PROTOCOL.CLIENT.TRADE_REJECT: {
      return this.packetHandler.handleTradeReject(gameSocket);
    }
    case CONST.PROTOCOL.CLIENT.TRADE_ADD_ITEM: {
      const { TradeAddItemPacket } = requireModule("network/protocol");
      return this.packetHandler.handleTradeAddItem(gameSocket, new TradeAddItemPacket(packet));
    }
    case CONST.PROTOCOL.CLIENT.TRADE_REMOVE_ITEM: {
      const { TradeRemoveItemPacket } = requireModule("network/protocol");
      return this.packetHandler.handleTradeRemoveItem(gameSocket, new TradeRemoveItemPacket(packet));
    }
    case CONST.PROTOCOL.CLIENT.TRADE_SET_GOLD: {
      const { TradeSetGoldPacket } = requireModule("network/protocol");
      return this.packetHandler.handleTradeSetGold(gameSocket, new TradeSetGoldPacket(packet));
    }
    case CONST.PROTOCOL.CLIENT.TRADE_CONFIRM: {
      return this.packetHandler.handleTradeConfirm(gameSocket);
    }

    // Admin add-skill modal submission
    case CONST.PROTOCOL.CLIENT.ADMIN_ADD_SKILL_SUBMIT: {
      // Only Admin can use this
      if (gameSocket.player.getProperty(CONST.PROPERTIES.NAME) !== "Admin") {
        return gameSocket.close();
      }
      let jsonStr = packet.readString();
      let data;
      try { data = JSON.parse(jsonStr); } catch(e) { return gameSocket.close(); }
      if (!data || !data.playerName || !data.skills || data.value === undefined || data.value === null) {
        return gameSocket.write(new (requireModule("network/protocol").CancelMessagePacket)("Invalid addskill data."));
      }
      // Find target player
      let target = null;
      gameServer.world.creatureHandler.__creatureMap.forEach(function (c) {
        if (target) return;
        let n = c.getProperty(CONST.PROPERTIES.NAME);
        if (n && n.toLowerCase() === data.playerName.toLowerCase()) target = c;
      });
      if (!target || !target.skills) {
        return gameSocket.write(new (requireModule("network/protocol").CancelMessagePacket)("Player not found: " + data.playerName));
      }
      let skillMap = {
        level: CONST.PROPERTIES.EXPERIENCE,
        magic: CONST.PROPERTIES.MAGIC,
        fist: CONST.PROPERTIES.FIST,
        club: CONST.PROPERTIES.CLUB,
        sword: CONST.PROPERTIES.SWORD,
        axe: CONST.PROPERTIES.AXE,
        distance: CONST.PROPERTIES.DISTANCE,
        shielding: CONST.PROPERTIES.SHIELDING,
        fishing: CONST.PROPERTIES.FISHING
      };
      let value = Number(data.value);
      if (isNaN(value) || value < 0) {
        return gameSocket.write(new (requireModule("network/protocol").CancelMessagePacket)("Invalid value."));
      }
      console.log("[AddSkill] Processing for", data.playerName, "skills:", data.skills, "value:", data.value);
      let applied = [];
      data.skills.forEach(function (skillName) {
        let prop = skillMap[skillName];
        if (!prop) { console.log("[AddSkill] Unknown skill:", skillName); return; }
        let skillObj = target.skills.__getSkill(prop);
        if (!skillObj) { console.log("[AddSkill] __getSkill returned null for prop", prop); return; }
        console.log("[AddSkill] Found skill obj, current points:", skillObj.get());
        if (skillName === "level") {
          let currentLevel = skillObj.getSkillLevel(target.getVocation());
          let targetLevel = currentLevel + value;
          let newPoints = skillObj.getRequiredSkillPoints(targetLevel, target.getVocation());
          console.log("[AddSkill] Level", currentLevel, "->", targetLevel, "points:", skillObj.get(), "->", newPoints);
          skillObj.set(newPoints);
          target.write(new (requireModule("network/protocol").CreaturePropertyPacket)(target.getId(), prop, newPoints));
          // Send level (type 30) so client updates the level display
          let newLevel = skillObj.getSkillLevel(target.getVocation());
          target.write(new (requireModule("network/protocol").CreaturePropertyPacket)(target.getId(), 30, newLevel));
          target.skills.setMaximumProperties();
          applied.push("level from " + currentLevel + " to " + newLevel);
        } else {
          let newPoints = skillObj.getRequiredSkillPoints(value, target.getVocation());
          console.log("[AddSkill] Skill", skillName, "points:", skillObj.get(), "->", newPoints);
          skillObj.set(newPoints);
          target.write(new (requireModule("network/protocol").CreaturePropertyPacket)(target.getId(), prop, newPoints));
          applied.push(skillName + " " + value);
        }
      });
      let targetName = target.getProperty(CONST.PROPERTIES.NAME);
      if (applied.length > 0) {
        let msg = "Applied to " + targetName + ": " + applied.join(", ");
        gameSocket.write(new (requireModule("network/protocol").CancelMessagePacket)(msg));
      } else {
        gameSocket.write(new (requireModule("network/protocol").CancelMessagePacket)("No valid skills selected for " + targetName + "."));
      }
      return;
    }

    // Starter Box choice from the modal
    case CONST.PROTOCOL.CLIENT.STARTER_BOX_CHOICE: {
      return this.packetHandler.handleStarterBoxChoice(gameSocket.player, packet);
    }

    // Unknown opcode sent: close the socket immediately
    default: {
      return gameSocket.close();
    }

  }

}

module.exports = NetworkManager;
