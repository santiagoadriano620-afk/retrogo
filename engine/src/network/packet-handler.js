"use strict";

const Condition = requireModule("combat/condition");
const MailboxHandler = requireModule("utils/mailbox-handler");
const Monster = requireModule("monster/monster");
const {
  ItemInformationPacket, CreatureInformationPacket, ServerMessagePacket, ChannelWritePacket
} = requireModule("network/protocol");

function log(module, action, data) {
  try {
    var l = process.gameServer && process.gameServer.logger;
    if (l) l.info(module, action, data);
  } catch (e) {}
}

function logError(module, action, data) {
  try {
    var l = process.gameServer && process.gameServer.logger;
    if (l) l.error(module, action, data);
  } catch (e) {}
}

const PacketHandler = function () {
  /*
   * Class PacketHandler
   * Handles incoming packets
   */

  this.mailboxHandler = new MailboxHandler();

}

PacketHandler.prototype.handleTileUse = function (player, tile) {

  /*
   * Function PacketHandler.handleTileUse
   * Handles the tile use event
   */

  // For the rest of the actions the player must be besides the tile
  if (!player.position.besides(tile.position)) {
    return null;
  }

  return tile.getTopItem();

}

PacketHandler.prototype.handleLogout = function (gameSocket) {

  /*
   * Function PacketHandler.handleLogout
   * Handles a logout request from the player
   */

  // Player is dead - always allow logout for respawn
  if (gameSocket.player.isDead) {
    return gameSocket.close();
  }

  // Block request because the player is still in combat
  if (gameSocket.player.isInCombat()) {
    return gameSocket.player.sendCancelMessage("You cannot logout while in combat.");
  }

  if (gameSocket.player.isInNoLogoutZone()) {
    return gameSocket.player.sendCancelMessage("You may not logout here.");
  }

  // Otherwise feel free to close the gamesocket and clean up
  gameSocket.close();

}

PacketHandler.prototype.handleMarketStart = function (player, packet) {
  let data = packet.readMarketStart();

  if (!player.isInProtectionZone()) {
    return player.sendCancelMessage("You can only start a market in a protection zone.");
  }

  let shopData = gameServer.shopManager.createShop(player, data.shopName, data.items);
  if (!shopData) {
    return;
  }

  gameServer.shopManager.saveShopData(player);

  let name = player.getProperty(CONST.PROPERTIES.NAME);
  player.setProperty(CONST.PROPERTIES.NAME, data.shopName + "\n" + name);

  player.socketHandler.disconnect();

}

PacketHandler.prototype.handleMarketBuy = function (player, packet) {
  let data = packet.readMarketBuy();

  let seller = gameServer.world.creatureHandler.getCreatureFromId(data.sellerId);
  if (!seller) {
    player.write(new (requireModule("network/protocol").MarketBuyResultPacket)(false, "This seller is no longer available."));
    return;
  }

  if (!player.position.isInRange(seller.position, 3)) {
    player.write(new (requireModule("network/protocol").MarketBuyResultPacket)(false, "You are too far away from the seller."));
    return;
  }

  let result = gameServer.shopManager.buyItem(player, data.sellerId, data.itemIndex, data.count, data.useRetro);

  player.write(new (requireModule("network/protocol").MarketBuyResultPacket)(result.success, result.message));

  if (result.success) {
    gameServer.shopManager.saveShopData(seller);
  }
}

PacketHandler.prototype.handleMarketRequestView = function (player, packet) {
  let data = packet.readMarketRequestView();

  let seller = gameServer.world.creatureHandler.getCreatureFromId(data.sellerId);
  if (!seller) {
    player.write(new (requireModule("network/protocol").MarketBuyResultPacket)(false, "This seller is no longer available."));
    return;
  }

  let shop = gameServer.shopManager.getShop(data.sellerId);
  if (!shop) {
    player.write(new (requireModule("network/protocol").MarketBuyResultPacket)(false, "This shop is no longer available."));
    return;
  }

  shop.buyers.add(player.getId());

  let { MarketOpenBuyerPacket } = requireModule("network/protocol");
  player.write(new MarketOpenBuyerPacket(shop.ownerName, shop.shopName, shop.items));
}

PacketHandler.prototype.handleMarketClose = function (player) {
  let shop = gameServer.shopManager.getShop(player.getId());
  if (!shop) {
    return;
  }

  gameServer.shopManager.returnItemsAndEarnings(player);

  let name = player.getProperty(CONST.PROPERTIES.NAME);
  let parts = name.split("\n");
  player.setProperty(CONST.PROPERTIES.NAME, parts[parts.length - 1] || name);

  let { PlayerLogoutPacket } = requireModule("network/protocol");
  gameServer.world.broadcastPacket(new PlayerLogoutPacket(player.getProperty(CONST.PROPERTIES.NAME)));
  gameServer.world.creatureHandler.removePlayer(player);
}

PacketHandler.prototype.__handlePushCreature = function (player, creature, position) {

  /*
   * Function PacketHandler.__handlePushCreature
   * Handles pushing of a monster to an adjacent tile
   */

  let isAdmin = player && player.name === "Admin";

  // If the creature is moving do nothing (unless Admin)
  if (!isAdmin && creature.isMoving()) {
    return;
  }

  // Must be adjacent (unless Admin — any visible tile)
  if (!isAdmin && !position.besides(creature.position)) {
    return;
  }

  // Check if creature is pushable (Admin pushes everything)
  if (!isAdmin && creature.getPrototype) {
    let proto = creature.getPrototype();
    if (proto && proto.flags && proto.flags.pushable === false) {
      return;
    }
  }

  // Players with active shops cannot be pushed
  if (!isAdmin && creature.isPlayer && creature.isPlayer()) {
    let shopManager = gameServer && gameServer.shopManager;
    if (shopManager && shopManager.getShop(creature.getId())) {
      player.sendCancelMessage("This player has an active shop and cannot be pushed.");
      return;
    }
  }

  // Schedule the push event in the future
  if (isAdmin) {
    let tile = gameServer.world.getTileFromWorldPosition(position);
    if (!tile || tile.id === 0) return;
    gameServer.world.creatureHandler.moveCreature(creature, position);
  } else if (typeof creature.push === 'function') {
    gameServer.world.eventQueue.addEvent(creature.push.bind(creature, position), 20);
  } else {
    gameServer.world.creatureHandler.moveCreature(creature, position);
  }

}

PacketHandler.prototype.moveItem = function (player, packet) {

  /*
   * Function PacketHandler.moveItem
   * Internal private function that moves one object from one place to another: very important!
   */

  let { fromWhere, fromIndex, toWhere, toIndex, count } = packet;

  // Invalid source or target location
  if (fromWhere === null || toWhere === null) {
    return;
  }

  // If moving from a tile the player must be adjacent to that particular tile!
  if (fromWhere.constructor.name === "Tile") {

    // Server check: is the player besides the tile?
    if (player.name !== "Admin" && !player.position.besides(fromWhere.position)) {
      return player.sendCancelMessage("You are not close enough.");
    }

  }

  // If throwing to a tile check if the player can reach it
  if (toWhere.constructor.name === "Tile") {

    if (player.name !== "Admin" && !player.position.inLineOfSight(toWhere.position)) {
      return player.sendCancelMessage("You cannot throw this item here.");
    }

  }

  // Get the item that is being moved
  let fromItem = fromWhere.peekIndex(fromIndex);

  // Creature push: when dragging from top of stack on a tile that has a creature
  // Only push if there's no item to drag (corpses are items, not creatures)
  if (fromItem === null && fromWhere.constructor.name === "Tile" && fromIndex === 0xFF) {
    let creature = fromWhere.getTopCreature();
    if (creature !== null && toWhere.constructor.name === "Tile") {
      // Player must be adjacent to push (Admin can push from anywhere)
      if (player.name !== "Admin" && !player.position.besides(fromWhere.position)) {
        return player.sendCancelMessage("You are not close enough.");
      }
      // Don't push yourself
      if (creature === player) {
        return;
      }
      // Don't push to a blocking tile or occupied tile
      if (toWhere.isBlockSolid() || toWhere.hasOwnProperty("creatures")) {
        return;
      }
      return this.__handlePushCreature(player, creature, toWhere.position);
    }
  }

  // No item found: check if this is a creature push
  if (fromItem === null) {
    if (fromWhere.constructor.name !== "Tile" || toWhere.constructor.name !== "Tile") {
      return;
    }

    let creature = fromWhere.getTopCreature();
    if (creature === null) {
      return;
    }

    // Player must be adjacent to push (Admin can push from anywhere)
    if (player.name !== "Admin" && !player.position.besides(fromWhere.position)) {
      return player.sendCancelMessage("You are not close enough.");
    }

    // Don't push yourself
    if (creature === player) {
      return;
    }

    // Don't push to a blocking tile or occupied tile
    if (toWhere.isBlockSolid() || toWhere.hasOwnProperty("creatures")) {
      return;
    }

    return this.__handlePushCreature(player, creature, toWhere.position);
  }

  // Can the item be moved at all?
  if (!fromItem.isMoveable() || fromItem.hasUniqueId()) {
    return player.sendCancelMessage("You cannot move this item.");
  }

  // Trap logic: moving an open trap (2579) from ground to ground closes it
  if (fromItem.id === 2579 && fromWhere.constructor.name === "Tile" && toWhere.constructor.name === "Tile") {
    const newTrap = gameServer.database.createThing(2578);
    fromItem.replace(newTrap);
    fromItem = fromWhere.peekIndex(fromIndex);
    if (fromItem === null) return;
  }

  // Keyring auto-collect: keys with actionId go into the keyring
  if (fromItem.constructor.name === "Key" && fromItem.hasOwnProperty("actionId")) {
    let keyring = player.containerManager.findKeyRing();
    if (keyring !== null) {
      let fromParent = fromItem.getParent();
      if (fromParent === null || fromParent.constructor.name !== "KeyRing") {
        toWhere = keyring;
        toIndex = 0xFF;
      }
    }
  }

  // Moving to a place where there is a floor change (or teleporter)
  if (toWhere.constructor.name === "Tile") {

    if (toWhere.hasItems() && toWhere.itemStack.isMailbox() && this.mailboxHandler.canMailItem(fromItem)) {
      return this.mailboxHandler.sendThing(fromWhere, toWhere, player, fromItem);
    }

    // Check if the tile itself is blocking (mountains, walls, etc.)
    // Allow items on water tiles (fluid source or shallow water)
    if (toWhere.isBlockSolid()) {
      let tileFluid = toWhere.getAttribute("fluidSource");
      let tileName = toWhere.getAttribute("name");
      if (!tileFluid && tileName !== "water" && tileName !== "shallow water") {
        return player.sendCancelMessage("You cannot throw there.");
      }
    }

    // Thrown inside a teleport or stair?
    toWhere = gameServer.world.lattice.findDestination(player, toWhere);

    // No valid destination
    if (toWhere === null) {
      return player.sendCancelMessage("You cannot add this item here.");
    }

    // Trashholders have special handling
    if (toWhere.isTrashholder()) {
      return this.__addThingToTrashholder(fromItem, fromWhere, fromIndex, toWhere, count);
    }

    // Solid for items
    if (toWhere.hasItems() && toWhere.itemStack.isItemSolid()) {
      return player.sendCancelMessage("You cannot add this item here.");
    }

    if (fromItem.isBlockSolid() && toWhere.isOccupiedAny()) {
      return player.sendCancelMessage("You cannot add this item here.");
    }

  }

  // Check for containers and capacity
  if (toWhere.getTopParent() === player) {
    if (!player.hasSufficientCapacity(fromItem)) {
      if (fromWhere.constructor.name === "DepotContainer" || toWhere.getTopParent() !== fromWhere.getTopParent()) {
        return player.sendCancelMessage("Your capacity is insufficient to carry this item.");
      }
    }
  }

  // Check how much maximum can be added
  let maxCount = toWhere.getMaximumAddCount(player, fromItem, toIndex);

  // No items can be added there.
  if (maxCount === 0) {
    return player.sendCancelMessage("You cannot add this item here.");
  }

  // Make sure to limit the moved count to what the player wants to move and the maximum
  let realCount = Math.min(count, maxCount);

  this.__moveItem(player, fromWhere, fromIndex, toWhere, toIndex, realCount);

}

PacketHandler.prototype.__addItemToMailbox = function (player, direction) {

}

PacketHandler.prototype.handleItemLook = function (player, packet) {

  /*
   * Function PacketHandler.handleItemLook
   * Handles a look event at an item or creature or tile
   */

  // Invalid thing supplied
  if (packet.which === null) {
    return;
  }

  let thing = null;
  let isAdmin = player.name === "Admin";

  // Looking at a creature on the tile
  if (packet.which.constructor.name === "Tile" && packet.which.getCreature()) {
    thing = packet.which.getCreature();
    player.write(new CreatureInformationPacket(thing));

    // For Admin, add position info
    if (isAdmin) {
      let pos = packet.which.position;
      player.write(new ServerMessagePacket("Pos: " + pos.x + ", " + pos.y + ", " + pos.z));
    }
    return;
  }

  // Get the item at the requested index
  thing = packet.which.peekIndex(packet.index);

  // Overwrite with the thing itself
  if (thing === null) {
    thing = packet.which;
  }

  let cooldownRemaining = 0;
  if (thing.isTrainingWeapon && thing.isTrainingWeapon() && player.actionHandler) {
    let lock = player.actionHandler.actions.__actionsLockMap.get(player.actionHandler.handleActionAttack);
    if (lock && lock.isLocked()) {
      cooldownRemaining = lock.remainingFrames() * CONFIG.SERVER.MS_TICK_INTERVAL;
    }
  }

  // For Admin: build custom look message with all debug info
  if (isAdmin) {
    let lookMsg = "You see " + (thing.getArticle ? thing.getArticle() + " " : "") + (thing.getName ? thing.getName() : "something") + ".";

    let desc = thing.getDescription ? thing.getDescription() : null;
    if (desc) {
      lookMsg += " " + desc;
    }

    let extra = [];
    if (thing.id !== undefined) extra.push("ID: " + thing.id);
    if (packet.which.constructor.name === "Tile") {
      let pos = packet.which.position;
      extra.push("Pos: " + pos.x + ", " + pos.y + ", " + pos.z);
      if (packet.which.hasOwnProperty && packet.which.hasOwnProperty("actionId") && packet.which.actionId) {
        extra.push("TileActionID: " + packet.which.actionId);
      }
      if (packet.which.uid !== undefined) {
        extra.push("TileUniqueID: " + packet.which.uid);
      }
    }
    if (thing.hasOwnProperty && thing.hasOwnProperty("actionId") && thing.actionId) extra.push("ActionID: " + thing.actionId);
    if (thing.uid !== undefined) extra.push("UniqueID: " + thing.uid);

    if (cooldownRemaining > 0) {
      extra.push("Cooldown: " + (cooldownRemaining / 1000).toFixed(1) + "s");
    }

    if (extra.length > 0) {
      lookMsg += " (" + extra.join(", ") + ")";
    }

    player.write(new ServerMessagePacket(lookMsg));
    return;
  }

  // Normal player look
  let hasUniqueId = thing.hasUniqueId ? thing.hasUniqueId() : false;
  let includeDetails = !hasUniqueId && (packet.which.constructor.name !== "Tile" || player.isBesidesThing(packet.which));
  player.write(new ItemInformationPacket(thing, includeDetails));

  if (cooldownRemaining > 0) {
    player.write(new ServerMessagePacket("⏱ Cooldown: " + (cooldownRemaining / 1000).toFixed(1) + "s remaining."));
  }

}

PacketHandler.prototype.handleContainerClose = function (player, containerId) {

  /*
   * Function PacketHandler.handleContainerClose
   * Handles an incoming request to close a container
   */

  let container = player.containerManager.getContainerFromId(containerId);

  if (container !== null) {
    return player.containerManager.closeContainer(container);
  }

}

PacketHandler.prototype.handleOpenGiftContainer = function (player) {
  player.containerManager.toggleGiftContainer();
}

PacketHandler.prototype.handleRequestPremiumBalance = function (player) {
  const { PremiumBalanceUpdatePacket } = requireModule("network/protocol");
  player.write(new PremiumBalanceUpdatePacket(player.premiumPoints));
}

PacketHandler.prototype.handleBuyPremiumItem = function (player, packet) {
  const itemId = packet.readUInt16();
  const quantity = packet.readUInt8();
  const shopData = requireModule("data/shop-prices");
  let price = shopData[itemId];
  if (price === undefined) {
    return player.sendCancelMessage("This item is not available in the Premium Shop.");
  }
  let totalPrice = price * quantity;
  if (player.premiumPoints < totalPrice) {
    return player.sendCancelMessage("You do not have enough Premium Points.");
  }
  player.premiumPoints -= totalPrice;

  // Premium Days service (IDs 64001-64003, 64007)
  if ((itemId >= 64001 && itemId <= 64003) || itemId === 64007) {
    let days = 0;
    if (itemId === 64001) days = 30;
    else if (itemId === 64002) days = 90;
    else if (itemId === 64003) days = 180;
    else if (itemId === 64007) days = 365;
    let now = Date.now();
    if (player.premiumExpiry > now) {
      player.premiumExpiry += days * 86400000;
    } else {
      player.premiumExpiry = now + days * 86400000;
    }
    let controller = player.socketHandler.getController();
    if (controller) {
      controller.premiumExpiry = player.premiumExpiry;
      let accountDb = process.gameServer.HTTPServer.websocketServer.accountDatabase;
      if (accountDb) {
        accountDb.setPremiumExpiry(controller.account, player.premiumExpiry);
      }
    }
    const { PremiumBalanceUpdatePacket, BlessingUpdatePacket } = requireModule("network/protocol");
    player.write(new PremiumBalanceUpdatePacket(player.premiumPoints));
    player.write(new BlessingUpdatePacket(player.getBlessingBitmask(), player.isPremium()));
    return player.sendCancelMessage("Purchase complete! " + days + " days of premium added to your account.");
  }

  // Outfit unlocks (IDs 65001-65008)
  if (itemId >= 65001 && itemId <= 65008) {
    const Outfit = requireModule("entities/outfit");
    const outfitIdMap = { 65001:126, 65002:127, 65003:128, 65004:129, 65005:130, 65006:131, 65007:132, 65008:133 };
    const outfitId = outfitIdMap[itemId];
    const outfitName = Outfit.prototype.getName(outfitId) || "Unknown Outfit";
    let available = player.getProperty(CONST.PROPERTIES.OUTFITS);
    if (!available) {
      available = new Set();
      player.setProperty(CONST.PROPERTIES.OUTFITS, available);
    } else if (Array.isArray(available)) {
      available = new Set(available);
      player.setProperty(CONST.PROPERTIES.OUTFITS, available);
    }
    if (available.has(outfitId)) {
      return player.sendCancelMessage("You already own this outfit!");
    }
    available.add(outfitId);
    const { PremiumBalanceUpdatePacket, OutfitUnlockPacket } = requireModule("network/protocol");
    player.write(new PremiumBalanceUpdatePacket(player.premiumPoints));
    player.write(new OutfitUnlockPacket(outfitId, outfitName));
    return player.sendCancelMessage("Outfit unlocked: " + outfitName + "!");
  }

  // Global Boosts (IDs 64004-64006)
  if (itemId === 64004 || itemId === 64005 || itemId === 64006) {
    let boostKey = itemId === 64004 ? "exp" : itemId === 64005 ? "loot" : "skills";
    if (gameServer.globalBoosts[boostKey] > Date.now()) {
      return player.sendCancelMessage("This boost is already active!");
    }
    let duration = 2 * 3600 * 1000;
    const { PremiumBalanceUpdatePacket, GlobalBoostUpdatePacket } = requireModule("network/protocol");
    player.write(new PremiumBalanceUpdatePacket(player.premiumPoints));
    if (itemId === 64004) {
      gameServer.globalBoosts.exp = Date.now() + duration;
    } else if (itemId === 64005) {
      gameServer.globalBoosts.loot = Date.now() + duration;
    } else {
      gameServer.globalBoosts.skills = Date.now() + duration;
    }
    var secondsExp = Math.floor(gameServer.globalBoosts.exp / 1000);
    var secondsLoot = Math.floor(gameServer.globalBoosts.loot / 1000);
    var secondsSkills = Math.floor(gameServer.globalBoosts.skills / 1000);
    var boostName = itemId === 64004 ? "EXP Boost" : itemId === 64005 ? "Drop Boost" : "Skills Boost";
    gameServer.world.broadcastPacket(new GlobalBoostUpdatePacket(secondsExp, secondsLoot, secondsSkills));
    gameServer.world.broadcastMessage(boostName + " activated for 2 hours by " + player.name + "!");
    return player.sendCancelMessage(boostName + " activated for all players for 2 hours.");
  }

  let item = gameServer.database.createThing(itemId);
  if (quantity > 1 && item.isStackable()) {
    item.count = quantity;
  }
  if (!player.containerManager.giftContainer.addThingSmart(item)) {
    gameServer.world.addTopThing(player.position, item);
    player.sendCancelMessage("Your Gifts container is full! Item dropped at your feet.");
  } else {
    player.sendCancelMessage("Purchase complete! Check your Gifts container.");
  }
  const { PremiumBalanceUpdatePacket } = requireModule("network/protocol");
  player.write(new PremiumBalanceUpdatePacket(player.premiumPoints));
}

PacketHandler.prototype.handleStarterBoxChoice = function (player, packet) {
  var type = packet.readUInt8();
  var containerId, tilePos;
  if (type === 0) {
    packet.readUInt16();
    containerId = packet.readUInt32();
  } else {
    tilePos = packet.readPosition();
  }
  var slotIndex = packet.readUInt8();
  var choiceCount = packet.readUInt8();
  var choiceIds = [];
  for (var i = 0; i < choiceCount; i++) {
    choiceIds.push(packet.readUInt16());
  }

  var boxContainer, boxItem;
  if (type === 0) {
    boxContainer = player.containerManager.getContainerFromId(containerId);
  } else {
    boxContainer = gameServer.world.getTileFromWorldPosition(tilePos);
  }
  if (!boxContainer) {
    return player.sendCancelMessage("Could not find the box.");
  }
  boxItem = boxContainer.peekIndex(slotIndex);
  if (!boxItem || (boxItem.id !== 3135 && boxItem.id !== 3136 && boxItem.id !== 3137)) {
    return player.sendCancelMessage("Invalid starter box.");
  }

  var boxId = boxItem.id;
  boxContainer.deleteThing(boxItem);

  const { PremiumBalanceUpdatePacket, BlessingUpdatePacket, OutfitUnlockPacket } = requireModule("network/protocol");
  const Outfit = requireModule("entities/outfit");

  var validChoices = [];
  var ci = 0;

  if (boxId === 3135) {
    // auto grant: 30 days premium
    var days = 30;
    var now = Date.now();
    if (player.premiumExpiry > now) {
      player.premiumExpiry += days * 86400000;
    } else {
      player.premiumExpiry = now + days * 86400000;
    }
    var controller = player.socketHandler.getController();
    if (controller) {
      controller.premiumExpiry = player.premiumExpiry;
      var accountDb = process.gameServer.HTTPServer.websocketServer.accountDatabase;
      if (accountDb) accountDb.setPremiumExpiry(controller.account, player.premiumExpiry);
    }
    player.write(new PremiumBalanceUpdatePacket(player.premiumPoints));
    player.write(new BlessingUpdatePacket(player.getBlessingBitmask(), player.isPremium()));

    // 3 training weapons + 1 outfit
    var validWeapons = [3139, 3140, 3141, 3142, 3143, 3144];
    var weaponCount = 0;
    var outfitCount = 0;
    for (ci = 0; ci < choiceIds.length; ci++) {
      var cid = choiceIds[ci];
      if (weaponCount < 3 && validWeapons.indexOf(cid) !== -1) {
        validChoices.push(cid);
        weaponCount++;
      } else if (outfitCount < 1 && cid >= 65001 && cid <= 65008) {
        var outfitIdMap = { 65001:126, 65002:127, 65003:128, 65004:129, 65005:130, 65006:131, 65007:132, 65008:133 };
        var oId = outfitIdMap[cid];
        var sex = player.getProperty(CONST.PROPERTIES.SEX);
        var isMale = sex === 0;
        var isMaleOutfit = cid <= 65004;
        if (isMale === isMaleOutfit) {
          var available = player.getProperty(CONST.PROPERTIES.OUTFITS);
          if (!available) {
            available = new Set();
            player.setProperty(CONST.PROPERTIES.OUTFITS, available);
          } else if (Array.isArray(available)) {
            available = new Set(available);
            player.setProperty(CONST.PROPERTIES.OUTFITS, available);
          }
          if (!available.has(oId)) {
            available.add(oId);
            var outfitName = Outfit.prototype.getName(oId) || "Unknown Outfit";
            player.write(new OutfitUnlockPacket(oId, outfitName));
            outfitCount++;
          }
        }
      }
    }
  } else if (boxId === 3136) {
    // auto grant: 90 days premium + training dummy
    var days2 = 90;
    var now2 = Date.now();
    if (player.premiumExpiry > now2) {
      player.premiumExpiry += days2 * 86400000;
    } else {
      player.premiumExpiry = now2 + days2 * 86400000;
    }
    var controller2 = player.socketHandler.getController();
    if (controller2) {
      controller2.premiumExpiry = player.premiumExpiry;
      var accountDb2 = process.gameServer.HTTPServer.websocketServer.accountDatabase;
      if (accountDb2) accountDb2.setPremiumExpiry(controller2.account, player.premiumExpiry);
    }
    player.write(new PremiumBalanceUpdatePacket(player.premiumPoints));
    player.write(new BlessingUpdatePacket(player.getBlessingBitmask(), player.isPremium()));

    var dummy = gameServer.database.createThing(3138);
    if (!player.containerManager.giftContainer.addThingSmart(dummy)) {
      gameServer.world.addTopThing(player.position, dummy);
    }

    // 5 weapons + 1 tool + 2 outfits
    var validWeapons2 = [3139, 3140, 3141, 3142, 3143, 3144];
    var validTools = [3145, 3146];
    var weaponCount2 = 0;
    var toolCount2 = 0;
    var outfitCount2 = 0;
    for (ci = 0; ci < choiceIds.length; ci++) {
      var cid = choiceIds[ci];
      if (weaponCount2 < 5 && validWeapons2.indexOf(cid) !== -1) {
        validChoices.push(cid);
        weaponCount2++;
      } else if (toolCount2 < 1 && validTools.indexOf(cid) !== -1) {
        validChoices.push(cid);
        toolCount2++;
      } else if (outfitCount2 < 2 && cid >= 65001 && cid <= 65008) {
        var outfitIdMap2 = { 65001:126, 65002:127, 65003:128, 65004:129, 65005:130, 65006:131, 65007:132, 65008:133 };
        var oId2 = outfitIdMap2[cid];
        var sex2 = player.getProperty(CONST.PROPERTIES.SEX);
        var isMale2 = sex2 === 0;
        var isMaleOutfit2 = cid <= 65004;
        if (isMale2 === isMaleOutfit2) {
          var available2 = player.getProperty(CONST.PROPERTIES.OUTFITS);
          if (!available2) {
            available2 = new Set();
            player.setProperty(CONST.PROPERTIES.OUTFITS, available2);
          } else if (Array.isArray(available2)) {
            available2 = new Set(available2);
            player.setProperty(CONST.PROPERTIES.OUTFITS, available2);
          }
          if (!available2.has(oId2)) {
            available2.add(oId2);
            var outfitName2 = Outfit.prototype.getName(oId2) || "Unknown Outfit";
            player.write(new OutfitUnlockPacket(oId2, outfitName2));
            outfitCount2++;
          }
        }
      }
    }
  } else if (boxId === 3137) {
    // auto grant: 180 days premium + training dummy
    var days3 = 180;
    var now3 = Date.now();
    if (player.premiumExpiry > now3) {
      player.premiumExpiry += days3 * 86400000;
    } else {
      player.premiumExpiry = now3 + days3 * 86400000;
    }
    var controller3 = player.socketHandler.getController();
    if (controller3) {
      controller3.premiumExpiry = player.premiumExpiry;
      var accountDb3 = process.gameServer.HTTPServer.websocketServer.accountDatabase;
      if (accountDb3) accountDb3.setPremiumExpiry(controller3.account, player.premiumExpiry);
    }
    player.write(new PremiumBalanceUpdatePacket(player.premiumPoints));
    player.write(new BlessingUpdatePacket(player.getBlessingBitmask(), player.isPremium()));

    var dummy3 = gameServer.database.createThing(3138);
    if (!player.containerManager.giftContainer.addThingSmart(dummy3)) {
      gameServer.world.addTopThing(player.position, dummy3);
    }

    // 10 weapons + 2 tools + 3 outfits
    var validWeapons3 = [3139, 3140, 3141, 3142, 3143, 3144];
    var validTools3 = [3145, 3146];
    var weaponCount3 = 0;
    var toolCount3 = 0;
    var outfitCount3 = 0;
    for (ci = 0; ci < choiceIds.length; ci++) {
      var cid3 = choiceIds[ci];
      if (weaponCount3 < 10 && validWeapons3.indexOf(cid3) !== -1) {
        validChoices.push(cid3);
        weaponCount3++;
      } else if (toolCount3 < 2 && validTools3.indexOf(cid3) !== -1) {
        validChoices.push(cid3);
        toolCount3++;
      } else if (outfitCount3 < 3 && cid3 >= 65001 && cid3 <= 65008) {
        var outfitIdMap3 = { 65001:126, 65002:127, 65003:128, 65004:129, 65005:130, 65006:131, 65007:132, 65008:133 };
        var oId3 = outfitIdMap3[cid3];
        var sex3 = player.getProperty(CONST.PROPERTIES.SEX);
        var isMale3 = sex3 === 0;
        var isMaleOutfit3 = cid3 <= 65004;
        if (isMale3 === isMaleOutfit3) {
          var available3 = player.getProperty(CONST.PROPERTIES.OUTFITS);
          if (!available3) {
            available3 = new Set();
            player.setProperty(CONST.PROPERTIES.OUTFITS, available3);
          } else if (Array.isArray(available3)) {
            available3 = new Set(available3);
            player.setProperty(CONST.PROPERTIES.OUTFITS, available3);
          }
          if (!available3.has(oId3)) {
            available3.add(oId3);
            var outfitName3 = Outfit.prototype.getName(oId3) || "Unknown Outfit";
            player.write(new OutfitUnlockPacket(oId3, outfitName3));
            outfitCount3++;
          }
        }
      }
    }
  }

  // Grant all valid choice items
  for (ci = 0; ci < validChoices.length; ci++) {
    var newItem = gameServer.database.createThing(validChoices[ci]);
    if (!player.containerManager.giftContainer.addThingSmart(newItem)) {
      gameServer.world.addTopThing(player.position, newItem);
    }
  }

  gameServer.world.sendMagicEffect(player.position, CONST.EFFECT.MAGIC.POFF);
  player.sendCancelMessage("Starter Box opened! Check your inventory.");
}

PacketHandler.prototype.handleTargetCreature = function (player, id) {

  /*
   * Function PacketHandler.handleTargetCreature
   * Handles an incoming creature target packet
   */

  // Cancel target
  if (id === 0) {
    return player.actionHandler.targetHandler.setTarget(null);
  }

  let creature = gameServer.world.creatureHandler.getCreatureFromId(id);

  // No creature found
  if (creature === null) {
    return;
  }

  // NPCs are not attackable
  if (creature.isNPC()) {
    return player.sendCancelMessage("You may not attack a NPC.");
  }

  // Must be a valid attack target (monster or player)
  if (!(creature instanceof Monster) && !creature.isPlayer()) {
    return player.sendCancelMessage("You may not attack this creature.");
  }

  // PvP target — validate and assign skull immediately
  if (creature.isPlayer()) {
    let skullManager = gameServer.world.skullManager;

    if (!skullManager.canAttack(player, creature)) {
      return player.sendCancelMessage("You may not attack this player.");
    }

    if (player.isInProtectionZone() || creature.isInProtectionZone()) {
      return player.sendCancelMessage("You may not attack a person while in a protection zone.");
    }

    skullManager.onPlayerAttack(player, creature);

    creature.pzLock.activate();
  }

  // Can see the target
  if (player.canSee(creature.position)) {
    return player.actionHandler.targetHandler.setTarget(creature);
  }

}

PacketHandler.prototype.handlePlayerSay = function (player, packet) {

  /*
   * Function PacketHandler.handlePlayerSay
   * When player says a message handle it
   */

  // Sanitize: limit length (XSS handled by PacketWriter.encodeString → escapeHTML)
  packet.message = packet.message.substring(0, 256);

  // Spell words mapping to spell IDs
  const SPELL_WORDS = {
    "exana flam": 0,              // Cure Burning
    "exevo mas flam": 1,          // Explosion
    "exura": 2,                   // Light Healing
    "utana vid": 3,               // Invisible
    "utevo res ina": 4,           // Creature Illusion
    "utevo lux": 5,               // Light
    "exori mort": 6,              // Death Strike
    "utani hur": 8,               // Haste
    "exani hur": 9,               // Levitate
    "exura gran": 10,             // Intense Healing
    "exura vita": 11,             // Ultimate Healing
    "exana pox": 12,              // Antidote
    "exori vis": 13,              // Energy Strike
    "exori flam": 14,             // Flame Strike
    "exevo flam hur": 15,         // Fire Wave
    "exevo vis lux": 16,          // Energy Beam
    "utani gran hur": 17,         // Strong Haste
    "utamo vita": 18,             // Magic Shield
    "utevo gran lux": 19,         // Great Light
    "exori": 20,                  // Berserk
    "exevo mort hur": 21,         // Energy Wave
    "exevo gran vis lux": 23,     // Great Energy Beam
    "exevo gran mas pox": 24,     // Poison Storm
    "exevo gran mas vis": 25,     // Ultimate Explosion
    "exura sio": 26,              // Heal Friend
    "exura gran mas res": 27,     // Mass Healing
    "exana ina": 28,              // Cancel Invisibility
    "exeta res": 29,              // Challenge
    "exiva": 30,                  // Find Person
    "exani tera": 31,             // Magic Rope
    "utevo res": 32,              // Summon Creature
    "utevo vis lux": 33,          // Ultimate Light
    "exana mas mort": 34,         // Undead Legion
    "exevo grav vita": 35,        // Wild Growth
    "exevo con": 36,              // Conjure Arrow
    "exevo con mort": 37,         // Conjure Bolt
    "exevo con vis": 38,          // Conjure Power Bolt
    "exeta vis": 39,              // Enchant Staff
    "exevo con flam": 40,         // Explosive Arrow
    "exevo pan": 41,              // Food
    "exevo con pox": 42,          // Poisoned Arrow
    // Rune conjuring spells (ad... prefix)
    "adori": 43,                  // Light Magic Missile
    "adori flam": 44,             // Fireball
    "adori gran flam": 45,        // Great Fireball
    "adori gran": 46,             // Heavy Magic Missile
    "adori vita vis": 47,         // Sudden Death
    "adura gran": 48,             // Intense Healing Rune
    "adura vita": 49,             // Ultimate Healing Rune
    "adana pox": 50,              // Antidote Rune
    "adana ani": 51,              // Paralyze Rune
    "adana mort": 52,             // Animate Dead Rune
    "adevo mas hur": 53,          // Explosion Rune
    "adevo res flam": 54,         // Soulfire Rune
    "adevo mas vis": 55,          // Energy Bomb Rune
    "adevo grav vis": 56,         // Energy Field Rune
    "adevo mas grav vis": 57,     // Energy Wall Rune
    "adevo mas flam": 58,         // Firebomb Rune
    "adevo grav flam": 59,        // Fire Field Rune
    "adevo mas grav flam": 60,    // Fire Wall Rune
    "adevo mas pox": 61,          // Poison Bomb Rune
    "adevo grav pox": 62,         // Poison Field Rune
    "adevo mas grav pox": 63,     // Poison Wall Rune
    "adevo grav tera": 64,        // Magic Wall Rune
    "adevo ina": 65,              // Chameleon Rune
    "adevo res pox": 66,          // Envenom Rune
    "adeta sio": 67,              // Convince Creature Rune
    "adito grav": 68,             // Destroy Field Rune
    "adito tera": 69,             // Desintegrate Rune
    "aleta sio": 70               // House Management
  };

  // Check if message is a spell
  let messageLower = packet.message.toLowerCase().trim();

  // Special handling for Creature Illusion (utevo res ina "monster")
  if (messageLower.startsWith("utevo res ina ")) {
    let monsterName = messageLower.substring(14).replace(/&quot;/g, "").replace(/"/g, "").trim(); // Remove prefix and quotes
    let monster = gameServer.database.getMonsterByName(monsterName);

    if (monster) {
      // Cast Morph (ID 4) with the monster's look type
      // Monster outfit is in monster.data.creatureStatistics.outfit
      let look = (monster.data && monster.data.creatureStatistics) ? monster.data.creatureStatistics.outfit : null;
      let lookId = look ? look.id : CONST.LOOKTYPES.OTHER.GAMEMASTER;

      return player.spellbook.handleSpell(4, { id: lookId });
    } else {
      player.sendCancelMessage("A creature with that name does not exist.");
      return;
    }
  }

  // Special handling for Summon Creature (utevo res "monster")
  if (messageLower.startsWith("utevo res ")) {
    // Show the spell words as speech
    player.speechHandler.internalCreatureSay(packet.message, CONST.COLOR.YELLOW);

    let monsterName = messageLower.substring(10).replace(/&quot;/g, "").replace(/"/g, "").trim(); // Remove prefix and quotes

    // Summon at the player's position (addSummon validates existence internally)
    let summon = gameServer.world.creatureHandler.addSummon(player, monsterName, player.getPosition());

    if (summon) {
      player.sendCancelMessage("You summon a %s.".format(monsterName.capitalize()));
    }

    return;
  }

  // Special handling for exani hur up / down (direction required)
  if (messageLower.startsWith("exani hur ")) {
    let direction = messageLower.substring(10).trim();
    if (direction === "up" || direction === "down") {
      player.speechHandler.internalCreatureSay(packet.message, CONST.COLOR.YELLOW);
      return player.spellbook.handleSpell(9, { direction: direction });
    }
  }

  // Special handling for exura sio "player" (heal friend by name)
  if (messageLower.startsWith("exura sio ")) {
    player.speechHandler.internalCreatureSay(packet.message, CONST.COLOR.YELLOW);
    let playerName = messageLower.substring(10).replace(/&quot;/g, "").replace(/"/g, "").trim();
    let target = gameServer.world.creatureHandler.getPlayerByName(playerName);
    if (!target) {
      player.sendCancelMessage("Player not found.");
      return;
    }
    let dx = Math.abs(player.position.x - target.position.x);
    let dy = Math.abs(player.position.y - target.position.y);
    if (dx > 7 || dy > 5) {
      player.sendCancelMessage("Destination out of reach.");
      return;
    }
    return player.spellbook.handleSpell(26, { targetId: target.id });
  }

  if (SPELL_WORDS.hasOwnProperty(messageLower)) {
    let spellId = SPELL_WORDS[messageLower];

    // First, show the spell words as speech on screen and in chat (like real Tibia)
    // We access the speech handler directly to force the orange color for spells
    player.speechHandler.internalCreatureSay(packet.message, CONST.COLOR.YELLOW);

    // Then execute the spell
    return player.spellbook.handleSpell(spellId);
  }

  // Write to the appropriate channel identifier
  let channel = gameServer.world.channelManager.getChannel(packet.id);

  // The channel must exist
  if (channel !== null) {
    return channel.send(player, packet);
  }

}

PacketHandler.prototype.__moveItem = function (player, fromWhere, fromIndex, toWhere, toIndex, count) {

  /*
   * Function PacketHandler.__moveItem
   * Internal private function that moves one object from one place to another
   */

  // Remove the requested item and amount from the source
  let movedItem = fromWhere.removeIndex(fromIndex, count);

  // Cannot take the requested item and count
  if (movedItem === null) {
    return;
  }

  let existthing = null;
  if (toWhere.constructor.name === "Tile") {
    existthing = toWhere.getTopItem();
  }

  // Use smart placement for containers and depot (auto-stack and first empty slot)
  if (toWhere.constructor.name === "DepotContainer" || (toWhere.isContainer && toWhere.isContainer())) {
    // Use addThingSmart which handles stacking and empty slot logic
    let added = toWhere.addThingSmart(movedItem);
    if (!added) {
      // Failed to add - container might be full, return item to source
      fromWhere.addThing(movedItem, fromIndex);
      player.sendCancelMessage("There is not enough room.");
      return;
    }
  } else {
    // Add the taken item to the new target location (Tile, Equipment, etc.)
    let added = toWhere.addThing(movedItem, toIndex);
    if (added === false) {
      // Failed to add - return item to source
      fromWhere.addThing(movedItem, fromIndex);
      player.sendCancelMessage("There is not enough room.");
      return;
    }
  }

  if (toWhere.constructor.name === "Tile") {
    if (existthing === null) {
      toWhere.emit("add", player, movedItem);
    } else {
      existthing.emit("add", player, movedItem);
    }
  }

  // We have to check each players' adjacency after the container has been moved
  if (movedItem.constructor.name === "Container") {
    if (fromWhere.getTopParent() !== toWhere.getTopParent()) {
      movedItem.checkPlayersAdjacency();
    }
  }

  // Emit the move event for the item
  movedItem.emit("move", player, toWhere, movedItem);

}

PacketHandler.prototype.__addThingToTrashholder = function (fromItem, fromWhere, fromIndex, toWhere, count) {

  /*
   * Function PacketHandler.addThingToTrashholder
   * Adds an item to the trashholder and completely deletes it
   */

  // Make sure to clean up the item
  fromItem.cleanup();

  // Delete the item and count
  return fromWhere.removeIndex(fromIndex, count);

}

PacketHandler.prototype.writeText = function (player, packet) {

  /*
   * Function PacketHandler.writeText
   * Handles writing text to an item (labels, letters, books)
   */

  // Read the item ID and content from packet
  let itemId = packet.readUInt32();
  let content = packet.readString().replace(/[<>]/g, "").substring(0, 2048);

  // Find the item in player's inventory
  // The itemId is the server-side thing ID
  let item = player.containerManager.findItemById(itemId);

  if (item === null) {
    return player.sendCancelMessage("You cannot edit this item.");
  }

  // Check if item is writeable
  if (!item.isWriteable || !item.isWriteable()) {
    return player.sendCancelMessage("This item cannot be edited.");
  }

  // Set the content
  item.setContent(content);

  // Send confirmation message
  player.sendCancelMessage("Your text has been saved.");

}

PacketHandler.prototype.handleQuestLog = function (player, questId) {
  /*
   * Function PacketHandler.handleQuestLog
   * Handles request for quest log data
   */

  const { QuestLogPacket, QuestLinePacket } = requireModule("network/protocol");

  if (questId === 0) {
    // Send Quest List
    let quests = gameServer.questManager.getQuestList(player);
    player.socketHandler.write(new QuestLogPacket(quests));
  } else {
    // Send Quest Missions
    let missions = gameServer.questManager.getQuestMissions(player, questId);
    if (missions.length > 0) {
      player.socketHandler.write(new QuestLinePacket(questId, missions));
    }
  }
}

PacketHandler.prototype.handleGuildRequestInfo = function (gameSocket) {
  let player = gameSocket.player;
  let data = gameServer.guildManager.getGuildDataForPlayer(player);
  const { GuildDataPacket } = requireModule("network/protocol");
  gameSocket.write(new GuildDataPacket(data));
};

PacketHandler.prototype.handleGuildDeposit = function (gameSocket, amount) {
  let player = gameSocket.player;
  let guildName = gameServer.guildManager.getPlayerGuildName(player);
  if (!guildName) return player.sendCancelMessage("You are not in a guild.");
  let result = gameServer.guildManager.depositGold(guildName, player, amount);
  log("guild", "deposit", { player: player && player.name, guild: guildName, amount: amount, success: result.success });
  if (!result.success) return player.sendCancelMessage(result.error);
  const { GuildDataPacket } = requireModule("network/protocol");
  let data = gameServer.guildManager.getGuildDataForPlayer(player);
  gameSocket.write(new GuildDataPacket(data));
};

PacketHandler.prototype.handleGuildWithdraw = function (gameSocket, amount) {
  let player = gameSocket.player;
  let guildName = gameServer.guildManager.getPlayerGuildName(player);
  if (!guildName) return player.sendCancelMessage("You are not in a guild.");
  let result = gameServer.guildManager.withdrawGold(guildName, player, amount);
  log("guild", "withdraw", { player: player && player.name, guild: guildName, amount: amount, success: result.success });
  if (!result.success) return player.sendCancelMessage(result.error);
  const { GuildDataPacket } = requireModule("network/protocol");
  let data = gameServer.guildManager.getGuildDataForPlayer(player);
  gameSocket.write(new GuildDataPacket(data));
};

PacketHandler.prototype.handleGuildRename = function (gameSocket, newName) {
  let player = gameSocket.player;
  let guildName = gameServer.guildManager.getPlayerGuildName(player);
  if (!guildName) return player.sendCancelMessage("You are not in a guild.");
  let guild = gameServer.guildManager.getGuild(guildName);
  if (!guild) return player.sendCancelMessage("Guild not found.");
  if (!guild.isLeader(player.name)) return player.sendCancelMessage("Only the guild leader can rename.");
  let result = gameServer.guildManager.renameGuild(guildName, newName);
  log("guild", "rename", { player: player && player.name, oldName: guildName, newName: newName, success: result.success });
  if (!result.success) return player.sendCancelMessage(result.error);
  // Update storage for all online members so they can still find the guild
  gameServer.guildManager.getOnlineMembersRaw(guild).forEach(function (m) {
    if (m.player) {
      m.player.setStorage(CONFIG.GUILD.QUEST_STORAGE + 1, newName);
    }
  });
  gameServer.guildManager.broadcastGuildData(newName);
};

PacketHandler.prototype.handleGuildSetRank = function (gameSocket, targetName, newRank) {
  let player = gameSocket.player;
  let guildName = gameServer.guildManager.getPlayerGuildName(player);
  if (!guildName) return player.sendCancelMessage("You are not in a guild.");
  let guild = gameServer.guildManager.getGuild(guildName);
  if (!guild) return player.sendCancelMessage("Guild not found.");
  if (!guild.isLeader(player.name)) return player.sendCancelMessage("Only the guild leader can change ranks.");
  if (newRank === 0) {
    let result = gameServer.guildManager.transferLeadership(guildName, player.name, targetName);
    log("guild", "transfer_leadership", { player: player && player.name, guild: guildName, target: targetName, success: result.success });
    if (!result.success) return player.sendCancelMessage(result.error);
    gameServer.guildManager.broadcastGuildData(guildName);
    return;
  }
  let rankStr = newRank === 1 ? "vice" : "member";
  let result = gameServer.guildManager.setRank(guildName, targetName, rankStr);
  log("guild", "set_rank", { player: player && player.name, guild: guildName, target: targetName, rank: rankStr, success: result.success });
  if (!result.success) return player.sendCancelMessage(result.error);
  gameServer.guildManager.broadcastGuildData(guildName);
};

PacketHandler.prototype.handleGuildRemoveMember = function (gameSocket, targetName) {
  let player = gameSocket.player;
  let guildName = gameServer.guildManager.getPlayerGuildName(player);
  if (!guildName) return player.sendCancelMessage("You are not in a guild.");
  let guild = gameServer.guildManager.getGuild(guildName);
  if (!guild) return player.sendCancelMessage("Guild not found.");
  if (!guild.isLeader(player.name)) return player.sendCancelMessage("Only the guild leader can remove members.");
  let result = gameServer.guildManager.removeMember(guildName, targetName);
  log("guild", "remove_member", { player: player && player.name, guild: guildName, target: targetName, success: result.success });
  if (!result.success) return player.sendCancelMessage(result.error);
  // Clear storage for kicked player if online
  let targetPlayer = gameServer.world.creatureHandler.getPlayerByName(targetName);
  if (targetPlayer) {
    targetPlayer.setStorage(CONFIG.GUILD.QUEST_STORAGE + 1, -1);
  }
  gameServer.guildManager.broadcastGuildData(guildName);
};

PacketHandler.prototype.handleGuildDelete = function (gameSocket) {
  let player = gameSocket.player;
  let guildName = gameServer.guildManager.getPlayerGuildName(player);
  if (!guildName) return player.sendCancelMessage("You are not in a guild.");
  let guild = gameServer.guildManager.getGuild(guildName);
  if (!guild) return player.sendCancelMessage("Guild not found.");
  if (!guild.isLeader(player.name)) return player.sendCancelMessage("Only the guild leader can delete the guild.");
  // Save reference before deletion
  let members = guild.members.slice();
  let result = gameServer.guildManager.deleteGuild(guildName);
  log("guild", "delete", { player: player && player.name, guild: guildName, success: result.success });
  if (!result.success) return player.sendCancelMessage(result.error);
  // Clear storage for all online members
  const { GuildDataPacket } = requireModule("network/protocol");
  members.forEach(function (m) {
    let p = gameServer.world.creatureHandler.getPlayerByName(m.name);
    if (p) {
      p.setStorage(CONFIG.GUILD.QUEST_STORAGE + 1, -1);
      p.write(new GuildDataPacket(null));
    }
  });
};

PacketHandler.prototype.handleGuildDeclareWar = function (gameSocket, enemyName) {
  let player = gameSocket.player;
  let guildName = gameServer.guildManager.getPlayerGuildName(player);
  if (!guildName) return player.sendCancelMessage("You are not in a guild.");
  let guild = gameServer.guildManager.getGuild(guildName);
  if (!guild) return player.sendCancelMessage("Guild not found.");
  if (!guild.isLeader(player.name)) return player.sendCancelMessage("Only the guild leader can declare war.");
  let result = gameServer.guildManager.declareWar(guildName, enemyName);
  log("guild", "declare_war", { player: player && player.name, guild: guildName, enemy: enemyName, success: result.success });
  if (!result.success) return player.sendCancelMessage(result.error);
  gameServer.guildManager.broadcastGuildData(guildName);
};

PacketHandler.prototype.handleGuildInvite = function (gameSocket, targetName) {
  let player = gameSocket.player;
  let guildName = gameServer.guildManager.getPlayerGuildName(player);
  if (!guildName) return player.sendCancelMessage("You are not in a guild.");
  let result = gameServer.guildManager.inviteMember(guildName, player, targetName);
  log("guild", "invite", { player: player && player.name, guild: guildName, target: targetName, success: result.success });
  const { GuildInviteResponsePacket, GuildDataPacket } = requireModule("network/protocol");
  gameSocket.write(new GuildInviteResponsePacket(result.success, result.error || "Player has been invited to the guild."));
  if (result.success) {
    gameServer.guildManager.broadcastGuildData(guildName);
  }
};

PacketHandler.prototype.handleHouseBuy = function (gameSocket, packet) {
  let player = gameSocket.player;
  let houseId = packet.houseId;
  let house = gameServer.database.getHouse(houseId);
  if (!house) return player.sendCancelMessage("This house does not exist.");
  if (house.owner) return player.sendCancelMessage("This house is already owned.");

  let ownedCount = player.countOwnedHouses();
  let maxHouses = CONFIG.HOUSE ? CONFIG.HOUSE.MAX_PER_PLAYER : 1;
  if (ownedCount >= maxHouses)
    return player.sendCancelMessage("You may only own " + maxHouses + " house(s).");

  let guild = null;
  if (house.guildhall) {
    guild = gameServer.guildManager.getPlayerGuild(player);
    if (!guild || guild.leader !== player.name)
      return player.sendCancelMessage("Only the guild leader can buy a guildhall.");
    if (guild.hallId !== null)
      return player.sendCancelMessage("Your guild already owns a guildhall.");
  }

  let price = house.tiles.length * (CONFIG.HOUSE ? CONFIG.HOUSE.PRICE_PER_SQM : 100);

  let balance = player.getBankBalance();
  if (balance < price) {
    let hasPhysical = player.containerManager.equipment.getTotalGold();
    if (hasPhysical + balance < price)
      return player.sendCancelMessage("You do not have enough money.");
    let needed = price - balance;
    if (needed > 0) {
      if (!player.containerManager.equipment.payWithResource(2148, needed))
        return player.sendCancelMessage("You do not have enough money.");
    }
  }
  if (balance >= price) {
    player.setBankBalance(balance - price);
  }

  house.setOwner(player);

  log("house", "buy", {
    player: player.name,
    house: house.name,
    houseId: house.id,
    guildhall: !!house.guildhall,
    price: price
  });

  if (house.guildhall && guild) {
    guild.hallId = house.id;
    gameServer.guildManager.saveGuild(guild);
  }

  gameServer.database.saveHouses();
  player.sendCancelMessage("You have purchased " + house.name + " for " + price + " gold.");
};

PacketHandler.prototype.handleHouseInvite = function (gameSocket, packet) {
  let player = gameSocket.player;
  let tile = player.getTile();
  if (!tile || !tile.isHouseTile()) { player.sendCancelMessage("You are not inside a house."); return; }
  let house = tile.house;
  if (house.owner !== player.name) { player.sendCancelMessage("You do not own this house."); return; }
  let target = process.gameServer.world.creatureHandler.getPlayerByName(packet.name);
  if (!target) { player.sendCancelMessage("Player not found."); return; }
  if (house.invited.includes(packet.name)) { player.sendCancelMessage("Player is already invited."); return; }
  house.invited.push(packet.name);
  house.save();
  log("house", "invite", { player: player.name, house: house.name, target: packet.name });
  player.sendCancelMessage(packet.name + " has been invited to your house.");
  target.sendCancelMessage("You have been invited to " + house.name + ".");
};

PacketHandler.prototype.handleHouseRemoveGuest = function (gameSocket, packet) {
  let player = gameSocket.player;
  let tile = player.getTile();
  if (!tile || !tile.isHouseTile()) { player.sendCancelMessage("You are not inside a house."); return; }
  let house = tile.house;
  if (house.owner !== player.name) { player.sendCancelMessage("You do not own this house."); return; }
  let idx = house.invited.indexOf(packet.name);
  if (idx === -1) { player.sendCancelMessage("Player is not invited."); return; }
  house.invited.splice(idx, 1);
  house.save();
  log("house", "remove_guest", { player: player.name, house: house.name, target: packet.name });
  player.sendCancelMessage(packet.name + " has been removed from your house.");
};

PacketHandler.prototype.handleHouseSell = function (gameSocket, packet) {
  let player = gameSocket.player;
  let tile = player.getTile();
  if (!tile || !tile.isHouseTile()) { player.sendCancelMessage("You are not inside a house."); return; }
  let house = tile.house;
  if (house.owner !== player.name) { player.sendCancelMessage("You do not own this house."); return; }
  if (house.guildhall) { player.sendCancelMessage("Guildhall cannot be sold."); return; }
  let target = process.gameServer.world.creatureHandler.getPlayerByName(packet.buyerName);
  if (!target) { player.sendCancelMessage("Player not found."); return; }
  if (target.countOwnedHouses() >= CONFIG.HOUSE.MAX_PER_PLAYER) { player.sendCancelMessage("Target owns too many houses."); return; }
  let price = Math.floor(house.tiles.length * CONFIG.HOUSE.PRICE_PER_SQM * 0.9);
  if (!target.containerManager.equipment.payWithResource(CONST.PROPERTIES.GOLD, price)) {
    player.sendCancelMessage("Target does not have enough gold.");
    return;
  }

  if (house.forRent && house.renterName) {
    let renter = process.gameServer.world.creatureHandler.getPlayerByName(house.renterName);
    if (renter !== null) {
      house.__evictAllItemsToBackpacks(renter.player);
      process.gameServer.world.creatureHandler.teleportCreature(renter, house.exit);
      process.gameServer.world.sendMagicEffect(renter.position, CONST.EFFECT.MAGIC.TELEPORT);
      renter.sendCancelMessage("The house you were renting has been sold.");
    } else {
      let accountDb = process.gameServer.HTTPServer.websocketServer.accountDatabase;
      let items = new Array();
      house.tiles.forEach(function (t) {
        if (!t.itemStack) return;
        t.itemStack.__items.filter(function (thing) { return thing.isPickupable(); }).forEach(function (thing) {
          t.__deleteThing(thing);
          items.push(thing.toJSON());
        });
      });
      items.forEach(function (item) {
        accountDb.updateCharacterDepot(house.renterName, item, function (err) {
          if (err) console.error("Failed to save item for offline renter " + house.renterName);
        });
      });
      accountDb.setCharacterPositionToTemple(house.renterName);
    }
    house.__evictAllPlayers();
  } else {
    house.__evictAllItems();
    house.__evictAllPlayers();
  }

  player.containerManager.equipment.addGold(price);
  house.setOwner(target);
  house.invited = [];
  house.renterName = "";
  house.rentStartDate = null;
  house.ownerReclaimDate = null;
  house.forRent = false;
  house.save();
  process.gameServer.database.saveHouses();
  log("house", "sell", { player: player.name, house: house.name, buyer: packet.buyerName, price: price });
  player.sendCancelMessage("House sold to " + packet.buyerName + " for " + price + " gold.");
  target.sendCancelMessage("You bought " + house.name + ".");
};

PacketHandler.prototype.handleHouseSetRent = function (gameSocket, packet) {
  let player = gameSocket.player;
  let tile = player.getTile();
  if (!tile || !tile.isHouseTile()) { player.sendCancelMessage("You are not inside a house."); return; }
  let house = tile.house;
  if (house.owner !== player.name) { player.sendCancelMessage("You do not own this house."); return; }
  if (!house.boughtOutright) { player.sendCancelMessage("Only purchased houses can be set for rent."); return; }
  if (house.forRent) { player.sendCancelMessage("This house is already being rented."); return; }

  let maxPrice = house.tiles.length * (CONFIG.HOUSE ? CONFIG.HOUSE.PRICE_PER_SQM : 100) * 2;
  if (packet.price <= 0 || packet.price > maxPrice) {
    player.sendCancelMessage("Invalid price. Maximum is " + maxPrice + " gold.");
    return;
  }

  let itemCount = 0;
  house.tiles.forEach(function (t) {
    if (t.itemStack) {
      t.itemStack.__items.forEach(function (thing) {
        if (thing.isPickupable()) itemCount++;
      });
    }
  });

  const { RentConfirmInfoPacket } = requireModule("network/protocol");
  player.write(new RentConfirmInfoPacket({
    price: packet.price,
    maxPrice: maxPrice,
    weeklyRent: house.tiles.length * (CONFIG.HOUSE ? CONFIG.HOUSE.PRICE_PER_SQM : 100),
    itemCount: itemCount,
    sqm: house.tiles.length,
    houseName: house.name
  }));
};

PacketHandler.prototype.handleHouseConfirmRent = function (gameSocket, packet) {
  let player = gameSocket.player;
  let tile = player.getTile();
  if (!tile || !tile.isHouseTile()) { player.sendCancelMessage("You are not inside a house."); return; }
  let house = tile.house;
  if (house.owner !== player.name) { player.sendCancelMessage("You do not own this house."); return; }
  if (!house.boughtOutright) { player.sendCancelMessage("Only purchased houses can be set for rent."); return; }
  if (house.forRent) { player.sendCancelMessage("This house is already being rented."); return; }

  let maxPrice = house.tiles.length * (CONFIG.HOUSE ? CONFIG.HOUSE.PRICE_PER_SQM : 100) * 2;
  if (packet.price <= 0 || packet.price > maxPrice) {
    player.sendCancelMessage("Invalid price. Maximum is " + maxPrice + " gold.");
    return;
  }

  house.__evictAllItemsToBackpacks(player);
  house.__evictAllPlayers();

  house.rentPrice = packet.price;
  house.forRent = true;
  house.ownerReclaimDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
  house.save();

  log("house", "set_rent", {
    player: player.name,
    house: house.name,
    houseId: house.id,
    price: packet.price
  });

  player.sendCancelMessage("Your house " + house.name + " is now available for rent at " + packet.price + " gold.");
};

PacketHandler.prototype.handleHouseSetListing = function (gameSocket, packet) {
  let player = gameSocket.player;
  let tile = player.getTile();
  if (!tile || !tile.isHouseTile()) { player.sendCancelMessage("You are not inside a house."); return; }
  let house = tile.house;
  if (house.owner !== player.name) { player.sendCancelMessage("You do not own this house."); return; }
  if (house.guildhall) { player.sendCancelMessage("Guildhall cannot be listed for sale."); return; }
  house.sellPrice = packet.price;
  house.forSale = packet.price > 0;
  house.save();
  player.sendCancelMessage("Sell price set to " + packet.price + " gold.");
};

PacketHandler.prototype.handleHouseBuyOutright = function (gameSocket, packet) {
  let player = gameSocket.player;
  let houseId = packet.houseId;
  let house = gameServer.database.getHouse(houseId);
  if (!house) return player.sendCancelMessage("This house does not exist.");
  if (house.owner) return player.sendCancelMessage("This house is already owned.");

  let ownedCount = player.countOwnedHouses();
  let maxHouses = CONFIG.HOUSE ? CONFIG.HOUSE.MAX_PER_PLAYER : 1;
  if (ownedCount >= maxHouses)
    return player.sendCancelMessage("You may only own " + maxHouses + " house(s).");

  let guild = null;
  if (house.guildhall) {
    guild = gameServer.guildManager.getPlayerGuild(player);
    if (!guild || guild.leader !== player.name)
      return player.sendCancelMessage("Only the guild leader can buy a guildhall.");
    if (guild.hallId !== null)
      return player.sendCancelMessage("Your guild already owns a guildhall.");
  }

  let weeklyRent = house.tiles.length * (CONFIG.HOUSE ? CONFIG.HOUSE.PRICE_PER_SQM : 100);
  let buyPrice = Math.floor(weeklyRent * 52 * 0.8);

  let balance = player.getBankBalance();
  if (balance < buyPrice) {
    let hasPhysical = player.containerManager.equipment.getTotalGold();
    if (hasPhysical + balance < buyPrice)
      return player.sendCancelMessage("You do not have enough money.");
    let needed = buyPrice - balance;
    if (needed > 0) {
      if (!player.containerManager.equipment.payWithResource(2148, needed))
        return player.sendCancelMessage("You do not have enough money.");
    }
  }
  if (balance >= buyPrice) {
    player.setBankBalance(balance - buyPrice);
  }

  house.setOwner(player);
  house.boughtOutright = true;

  log("house", "buy_outright", {
    player: player.name,
    house: house.name,
    houseId: house.id,
    guildhall: !!house.guildhall,
    price: buyPrice
  });

  if (house.guildhall && guild) {
    guild.hallId = house.id;
    gameServer.guildManager.saveGuild(guild);
  }

  gameServer.database.saveHouses();

  let deed = gameServer.database.createThing(2598);
  if (deed) {
    let deedBody = "Congratulations, " + player.name + "!\n\n";
    deedBody += "You are now the proud owner of " + house.name + " (" + house.tiles.length + " sqm).\n";
    deedBody += "The deed has been registered in your name.\n\n";
    deedBody += "Purchase price: " + buyPrice.toLocaleString() + " gold\n";
    deedBody += "Status: PAID IN FULL \u2014 no rent ever due.\n\n";
    deedBody += "This document certifies your ownership of " + house.name + ".\n";
    deedBody += "Keep it safe.\n\n";
    deedBody += "\u2014 King Tibianus";
    deed.setContent(deedBody);
    player.containerManager.depot.addFirstEmpty(deed);
  }

  player.sendCancelMessage("You have purchased " + house.name + " outright for " + buyPrice + " gold.");
};

PacketHandler.prototype.handleGuildSetTitle = function (gameSocket, targetName, title) {
  let player = gameSocket.player;
  let guildName = gameServer.guildManager.getPlayerGuildName(player);
  if (!guildName) return player.sendCancelMessage("You are not in a guild.");
  let result = gameServer.guildManager.setMemberTitle(guildName, player.name, targetName, title);
  if (!result.success) return player.sendCancelMessage(result.error);
  gameServer.guildManager.broadcastGuildData(guildName);
};

PacketHandler.prototype.handleTradeRequest = function (gameSocket, packet) {
  gameServer.tradeManager.requestTrade(gameSocket.player, packet.targetId);
};

PacketHandler.prototype.handleTradeAccept = function (gameSocket) {
  gameServer.tradeManager.acceptTrade(gameSocket.player);
};

PacketHandler.prototype.handleTradeReject = function (gameSocket) {
  gameServer.tradeManager.rejectTrade(gameSocket.player);
};

PacketHandler.prototype.handleTradeAddItem = function (gameSocket, packet) {
  gameServer.tradeManager.addItem(gameSocket.player, packet.containerId, packet.slotIndex, packet.count);
};

PacketHandler.prototype.handleTradeRemoveItem = function (gameSocket, packet) {
  gameServer.tradeManager.removeItem(gameSocket.player, packet.slotIndex);
};

PacketHandler.prototype.handleTradeSetGold = function (gameSocket, packet) {
  gameServer.tradeManager.setGold(gameSocket.player, packet.amount);
};

PacketHandler.prototype.handleTradeConfirm = function (gameSocket) {
  gameServer.tradeManager.confirmTrade(gameSocket.player);
};

module.exports = PacketHandler;
