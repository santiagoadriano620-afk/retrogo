"use strict";

const GenericLock = requireModule("utils/generic-lock");
const { ReadTextPacket } = requireModule("network/protocol");

const UseHandler = function (player) {

  /*
   * Class UseHandler
   * Wrapper for the logic that handles using items
   */

  // Always reference the parent player
  this.__player = player;

  // The lock that prevents things being used too quickly
  this.__useWithLock = new GenericLock();

}

UseHandler.prototype.GLOBAL_USE_COOLDOWN = 20;

UseHandler.prototype.handleActionUseWith = function (packet) {

  /*
   * Function UseHandler.handleActionUseWith
   * Called when a client request is made to use an item with another item
   */

  // This function is not available
  if (this.__useWithLock.isLocked()) {
    return this.__player.sendCancelMessage("You cannot use this object yet.");
  }

  // Both must be present in the packet
  if (packet.fromWhere === null || packet.toWhere === null) {
    return;
  }

  // Must be besides the from (using) item (only for map tiles)
  if (typeof packet.fromWhere.getPosition === "function" && !this.__player.isBesidesThing(packet.fromWhere)) {
    return this.__player.sendCancelMessage("You have to move closer to use this item.");
  }

  // Fetch the item
  let item = packet.fromWhere.peekIndex(packet.fromIndex);

  // If there is no item there is nothing to do
  if (item === null) {
    return;
  }

  // Emit the event for the prototype listeners.
  // If the callback returns false (handled), skip built-in handlers.
  // If the callback returns true (not handled or no custom script), run built-in handlers.
  let emitResult = item.emit("useWith", this.__player, item, packet.toWhere, packet.toIndex);

  if (emitResult !== false) {

    // Explicitly handle key uses
    if (item.constructor.name === "Key") {
      item.handleKeyUse(this.__player, packet.toWhere);
    }

    if (item.constructor.name === "FluidContainer") {
      item.handleUseWith(this.__player, item, packet.toWhere, packet.toIndex);
    }

  }

  // Lock the action for the coming global cooldown
  this.__useWithLock.lock(UseHandler.prototype.GLOBAL_USE_COOLDOWN);

}

UseHandler.prototype.handleActionUseOnCreature = function (packet) {

  /*
   * Function UseHandler.handleActionUseOnCreature
   * Called when a client uses an item (like a rune) on a creature from the battle list
   */

  // This function is not available
  if (this.__useWithLock.isLocked()) {
    return this.__player.sendCancelMessage("You cannot use this object yet.");
  }

  // Must have a valid source
  if (packet.fromWhere === null) {
    return;
  }

  // Must be besides the from (using) item
  if (!this.__player.isBesidesThing(packet.fromWhere)) {
    return this.__player.sendCancelMessage("You have to move closer to use this item.");
  }

  // Fetch the item
  let item = packet.fromWhere.peekIndex(packet.fromIndex);

  // If there is no item there is nothing to do
  if (item === null) {
    return;
  }

  // Get the creature by ID
  let creature = gameServer.world.creatureHandler.getCreatureFromId(packet.creatureId);

  if (creature === null) {
    return this.__player.sendCancelMessage("This creature does not exist.");
  }

  // Get the creature's tile
  let tile = creature.getTile();

  if (tile === null) {
    return this.__player.sendCancelMessage("Cannot use on this creature.");
  }

  // Check line of sight
  if (!this.__player.position.inLineOfSight(tile.position)) {
    return this.__player.sendCancelMessage("Target is not in line of sight.");
  }

  // Emit the event for the prototype listeners (runas are handled via "useWith" event)
  item.emit("useWith", this.__player, item, tile, 0);

  // Lock the action for the coming global cooldown
  this.__useWithLock.lock(UseHandler.prototype.GLOBAL_USE_COOLDOWN);

}

UseHandler.prototype.handleItemUse = function (packet) {

  /*
   * Function UseHandler.handleItemUse
   * Handles a use event for the tile
   */

  // An invalid tile or container was requested
  if (packet.which === null) {
    return;
  }

  let item;
  if (packet.which.constructor.name === "Tile") {
    if (!this.__player.position.besides(packet.which.position)) {
      return;
    }
    item = packet.which.peekIndex(packet.index);
  } else if (packet.which.constructor.name === "Equipment" || packet.which.constructor.name === "DepotContainer" || packet.which.isContainer()) {
    item = packet.which.peekIndex(packet.index);
  }

  if (item === null) {
    return;
  }

  // Emitter. If a callback returns false (handled), skip built-in handlers.
  if (item.emit("use", this.__player, packet.which, packet.index, item) === false) {
    return;
  }

  // Debug: log right-click on items with actionId
  let tile = item.getParent ? item.getParent() : null;
  let tileAid = tile && tile.actionId ? tile.actionId : 0;

  // Check for quest actions triggered by item use (non-lever types: switch, basin, etc.)
  const aid = item.actionId;
  if (aid && !item.isDoor()) {
    const questAction = gameServer.questDataLoader.getByActionId(aid);
    if (questAction && !gameServer.questExecutor.isLeverType(questAction)) {
      const conditions = questAction.conditions || [];
      if (gameServer.questExecutor.evaluateConditions(conditions, this.__player, packet.which, item)) {
        gameServer.questExecutor.executeEffects(questAction.effects || [], this.__player, packet.which, item);
        gameServer.world.sendMagicEffect(this.__player.position, CONST.EFFECT.MAGIC.POFF);
        return;
      }
    }
  }

  // Check for tile-based chest rewards (e.g., wooden flooring with actionId that has chest data)
  if (aid && !item.isDoor()) {
    const chestData = gameServer.questDataLoader.getChestData(aid);
    if (chestData) {
      if (this.__player.containerManager.giveChestReward(aid)) {
        gameServer.world.sendMagicEffect(this.__player.position, CONST.EFFECT.MAGIC.POFF);
      }
      return;
    }
  }

  // Intercept house door use to show purchase modal
  if (item.isDoor() && item.isHouseDoor()) {
    let tile = item.getParent();
    if (tile && tile.house && !tile.house.owner) {
      let house = tile.house;
      let price = house.tiles.length * (CONFIG.HOUSE ? CONFIG.HOUSE.PRICE_PER_SQM : 100);

      let canBuy = true;
      let reason = "";

      let ownedCount = this.__player.countOwnedHouses();
      let maxHouses = CONFIG.HOUSE ? CONFIG.HOUSE.MAX_PER_PLAYER : 1;
      if (ownedCount >= maxHouses) {
        canBuy = false;
        reason = "You already own the maximum number of houses.";
      }

      if (house.guildhall) {
        let guild = gameServer.guildManager.getPlayerGuild(this.__player);
        if (!guild || guild.leader !== this.__player.name) {
          canBuy = false;
          reason = "Only the guild leader can buy a guildhall.";
        } else if (guild.hallId !== null) {
          canBuy = false;
          reason = "Your guild already owns a guildhall.";
        }
      }

      let pricePerSqm = CONFIG.HOUSE ? CONFIG.HOUSE.PRICE_PER_SQM : 100;
      let rentPeriodDays = CONFIG.HOUSE ? CONFIG.HOUSE.RENT_PERIOD_DAYS : 7;
      let buyPrice = Math.floor(price * 52 * 0.8);
      const { HouseInfoPacket } = requireModule("network/protocol");
      this.__player.write(new HouseInfoPacket(
        house.id, house.tiles.length, price, house.name,
        house.guildhall, canBuy, reason, pricePerSqm, rentPeriodDays, buyPrice, house.countBeds()
      ));
      return;
    }
  }

  if (item.isDoor()) {
    item.toggle(this.__player);
  }

  if (item.isMailbox()) {
    return this.__player.containerManager.inbox.pop(item.getPosition());
  }

  if (item.hasUniqueId()) {
    return;
  }

  // Retro Gold Coin → Premium Points
  if (item.id === 3151) {
    return this.__handleRetroGoldCoin(packet.which, item);
  }

  // If the item clicked is a container: toggle it
  if (item.isContainer() || item.isDepot()) {
    return this.__player.containerManager.toggleContainer(item);
  }

  // Fluid container: auto-drink if has liquid, otherwise try to fill from tile
  if (item.constructor.name === "FluidContainer") {
    let playerTile = gameServer.world.getTileFromWorldPosition(this.__player.position);
    if (playerTile !== null) {
      return item.handleUseWith(this.__player, item, playerTile, 0xFF);
    }
    return;
  }

  // Rotate the item
  if (item.isRotateable()) {
    return item.rotate();
  }

  // Readable
  if (item.isReadable()) {

    if (item.isHangable() && !this.__player.canUseHangable(item)) {
      return this.__player.sendCancelMessage("You have to move to the other side.");
    }

    return this.__player.write(new ReadTextPacket(item));

  }

}

UseHandler.prototype.__handleRetroGoldCoin = function (fromWhere, item) {
  let total = item.count || 1;
  fromWhere.deleteThing(item);
  this.__player.premiumPoints += total;
  this.__player.sendCancelMessage("You converted " + total + " Retro Gold Coin" + (total > 1 ? "s" : "") + " into " + total + " Premium Point" + (total > 1 ? "s" : "") + ".");
}

UseHandler.prototype.handleTileUse = function (tile) {

  /*
   * Function UseHandler.handleTileUse
   * Handles the tile use event
   */

  // For the rest of the actions the player must be besides the tile
  if (!this.__player.position.besides(tile.position)) {
    return null;
  }

  // If there are no items on the tile, return the tile itself to allow using the base tile (e.g. sewer grate)
  let item = tile.getTopItem();

  if (item === null) {
    return tile;
  }

  return item;

}

module.exports = UseHandler;
