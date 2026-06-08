"use strict";

const Item = requireModule("entities/item");
const Condition = requireModule("combat/condition");
const { EmotePacket } = requireModule("network/protocol");

const FluidContainer = function (id) {

  /*
   * Class FluidContainer
   * Container for items that can contain a fluid
   */

  // Inherit from container
  Item.call(this, id);

  // Count means the fluid type for fluid containers
  this.count = 0;

}

FluidContainer.prototype = Object.create(Item.prototype);
FluidContainer.prototype.constructor = FluidContainer;

FluidContainer.prototype.handleUseWith = function (player, item, tile, index) {

  /*
   * Function FluidContainer.handleUseWith
   * Callback fired when the fluid container is used with something
   */

  // The container is not filled
  if (this.isEmpty()) {
    return this.__handleFill(player, item, tile, index);
  }

  // Drinking? (only possible when tile is a creature-hosting Tile)
  if (typeof tile.getCreature === "function" && tile.getCreature() === player) {

    player.broadcast(new EmotePacket(player, this.__getDrinkText(), CONST.COLOR.ORANGE));

    // Add drunk condition to the player
    if (this.isAlcohol()) {
      player.addCondition(Condition.prototype.DRUNK, 1, 500, null);
    }

    // Drinking slime is a bad idea..
    if (this.isSlime()) {
      player.addCondition(Condition.prototype.POISONED, 10, 20, null);
    }

    // Drinking lava..? Why would you do that
    if (this.isLava()) {
      player.addCondition(Condition.prototype.BURNING, 5, 50, null);
    }

    // Life Fluid - heals health (50-100 HP)
    if (this.isLifeFluid()) {
      let healAmount = Math.floor(50 + Math.random() * 51); // 50-100
      player.increaseHealth(healAmount);
      player.sendCancelMessage("You feel healed.");
    }

    // Mana Fluid - restores mana (75-150 MP)
    if (this.isManaFluid()) {
      let manaAmount = Math.floor(75 + Math.random() * 76); // 75-150
      player.increaseMana(manaAmount);
      player.sendCancelMessage("You feel refreshed.");
    }

    return this.__empty();

  }

  // Not besides?
  if (!player.isBesidesThing(tile)) {
    return player.sendCancelMessage("You have to move closer.");
  }

  let useWithItem = tile.peekIndex(index);

  if (useWithItem !== null && useWithItem instanceof FluidContainer) {
    if (useWithItem.isEmpty()) {
      return this.__swapLiquid(useWithItem);
    } else {
      return player.sendCancelMessage("This container is already full.");
    }
  }

  // Tile-specific: empty container contents onto the ground
  if (typeof tile.isOccupied === "function") {
    if (tile.isOccupied()) {
      return player.sendCancelMessage("You cannot empty this fluid container here.");
    }

    this.__createSplash(tile);

    return this.__empty();
  }

  // Non-Tile target with no valid FluidContainer to transfer to
  return player.sendCancelMessage("You cannot use this item here.");

}

FluidContainer.prototype.containsWater = function () {
  return this.isFluidType("water");
};

FluidContainer.prototype.isOil = function () {
  return this.isFluidType("oil");
};

FluidContainer.prototype.isLava = function () {
  return this.isFluidType("lava");
};

FluidContainer.prototype.isSlime = function () {
  return this.isFluidType("slime");
};

FluidContainer.prototype.isAlcohol = function () {
  return this.isFluidType("alcohol");
};

FluidContainer.prototype.isLifeFluid = function () {
  return this.isFluidType("health");
};

FluidContainer.prototype.isManaFluid = function () {
  return this.isFluidType("mana");
};

/**
 * Check if the current fluid matches a type
 * Centralized fluid type checking to reduce code duplication
 * @param {string} type - Fluid type to check: water, oil, lava, slime, alcohol, health, mana
 * @returns {boolean} True if the fluid matches this type
 */
FluidContainer.prototype.isFluidType = function (type) {
  const FLUID_TYPES = {
    water: [CONST.FLUID.WATER],
    oil: [CONST.FLUID.OIL],
    lava: [CONST.FLUID.LAVA],
    slime: [CONST.FLUID.SLIME],
    alcohol: [CONST.FLUID.BEER, CONST.FLUID.WINE, CONST.FLUID.RUM],
    health: [CONST.FLUID.HEALTH],
    mana: [CONST.FLUID.MANA],
  };

  const fluidIds = FLUID_TYPES[type];
  return fluidIds ? fluidIds.includes(this.count) : false;
};

FluidContainer.prototype.__empty = function () {

  /*
   * Function FluidContainer.__empty
   * Callback fired when the fluid container is used with something
   */

  this.setFluidType(CONST.FLUID.NONE);
  let thing = gameServer.database.createThing(this.id);

  this.replace(thing);

}

FluidContainer.prototype.isEmpty = function () {

  /*
   * Function FluidContainer.isEmpty
   * Returns true if the fluid container is empty
   */

  return this.count === CONST.FLUID.NONE;

}

FluidContainer.prototype.__handleFill = function (player, item, tile, index) {

  /*
   * Function FluidContainer.__handleFill
   * Handles filling of a fluid container after using it with another tile or item
   */

  // Must be within range (2 SQM) — only for Tile targets
  if (typeof tile.getTopItem === "function") {
    if (!player.position.isWithinRangeOf(tile.position, 2)) {
      return player.sendCancelMessage("You are too far away.");
    }
  }

  // Get the target item: getTopItem for Tiles, peekIndex for Containers/Equipment
  let useWithItem;
  if (typeof tile.getTopItem === "function") {
    useWithItem = tile.getTopItem();
  } else if (typeof tile.peekIndex === "function") {
    useWithItem = tile.peekIndex(index);
  } else {
    return player.sendCancelMessage("You cannot fill this container here.");
  }

  // Nothing found: check if the tile itself is a fluid source (Tile only)
  if (useWithItem === null) {
    if (typeof tile.getAttribute !== "function") {
      return player.sendCancelMessage("You cannot fill this container here.");
    }
    let tileFluid = tile.getAttribute("fluidSource");
    if (!tileFluid) {
      let tileName = tile.getAttribute("name");
      if (tileName === "water") {
        tileFluid = "water";
      }
    }
    if (!tileFluid) {
      return player.sendCancelMessage("You cannot fill this container here.");
    }
    useWithItem = tile;
  }

  // If the player is using it with another container that has liquid
  if (useWithItem.constructor === FluidContainer && !useWithItem.isEmpty()) {
    return useWithItem.__swapLiquid(this);
  }

  // Fetch the prototype
  let fluidSource = useWithItem.getAttribute("fluidSource");

  // Fallback: check if the tile is water by name
  if (fluidSource === null) {
    let name = useWithItem.getAttribute("name");
    if (name === "water") {
      fluidSource = "water";
    }
  }

  // Fill the fluid container
  if (fluidSource === null) {
    return player.sendCancelMessage("You cannot fill this container here.");
  }

  let thing = process.gameServer.database.createThing(this.id);
  thing.setFluidType(this.__mapString(fluidSource));
  this.replace(thing);

}

FluidContainer.prototype.__swapLiquid = function (item) {

  /*
   * Function FluidContainer.__swapLiquid
   * Swaps liquid between this and a new item
   */

  // Create a new item of the appropriate type
  let other = process.gameServer.database.createThing(item.id);
  other.setFluidType(this.count);
  item.replace(other);

  // And clear itself with count is zero
  let itself = process.gameServer.database.createThing(this.id);
  itself.setFluidType(CONST.FLUID.NONE);
  this.replace(itself);

}

FluidContainer.prototype.__createSplash = function (tile) {

  /*
   * Function FluidContainer.__createSplash
   * Callback fired when the fluid container is used with something
   */

  // The splash identifier is 2016
  let splash = process.gameServer.database.createThing(2016);
  splash.setFluidType(this.count);
  splash.scheduleDecay();

  tile.addThing(splash, 0);

}

FluidContainer.prototype.__mapString = function (string) {

  /*
   * Function FluidContainer.__mapString
   * Maps item definition string to the proper fill type
   */

  switch (string) {
    case "blood": return CONST.FLUID.BLOOD;
    case "water": return CONST.FLUID.WATER;
    case "slime": return CONST.FLUID.SLIME;
    case "mana": return CONST.FLUID.MANA;
    case "health": return CONST.FLUID.HEALTH;
    case "life": return CONST.FLUID.HEALTH;
    default: return CONST.FLUID.NONE;
  }

}

FluidContainer.prototype.__getDrinkText = function () {

  /*
   * Function FluidContainer.__getDrinkText
   * Returns the text when something is drank from the container
   */

  switch (this.count) {
    case CONST.FLUID.WATER: return "Gulp..";
    case CONST.FLUID.SLIME: return "Ugh!";
    case CONST.FLUID.HEALTH: return "Aaaah...";
    case CONST.FLUID.MANA: return "Aaaah...";
    default: return "Ahhh..";
  }

}

module.exports = FluidContainer;
