"use strict";

const Item = requireModule("entities/item");
const { OTBBitFlag } = requireModule("utils/bitflag");
const { ItemAddPacket } = requireModule("network/protocol");

const Door = function(id) {

  /*
   * Class Door
   * Wrapper for doors that can be opened or closed
   *
   */

  // Inherits from item
  Item.call(this, id);

}

Door.prototype = Object.create(Item.prototype);
Door.prototype.constructor = Door;

Door.prototype.getHouseName = function() {

  /*
   * Function Door.getHouseOwner
   * Returns the owner of the house door
   */

  return this.__parent.house.name;

}

Door.prototype.getHouseOwner = function() {

  /*
   * Function Door.getHouseOwner
   * Returns the owner of the house door
   */

  return this.__parent.house.owner;

}

Door.prototype.open = function() {

  /*
   * Function Door.open
   * Opens the door by incrementing the item identifier
   */

  if(this.isOpened()) {
    return;
  }

  // Change the identifier to the closed door
  return this.__change(+1);

}

Door.prototype.close = function() {

  /*
   * Function Door.close
   * Closes the door by decrementing the item identifier
   */

  if(!this.isOpened()) {
    return;
  }

  this.__change(-1);

}

Door.prototype.handleEnterUnwantedDoor = function(player) {

  /*
   * Function Door.handleEnterExpertiseDoor
   * Handling of expertise doors
   */

  // All unwanted doors should have a unique identifier in RME
  if(!this.hasOwnProperty("actionId")) {
    return player.sendCancelMessage("Only the worthy may pass!");
  }

  // Get the callback
  let action = process.gameServer.database.getDoorEvent(this.actionId);

  // Get the parent of the tile
  let tile = this.getParent();

  // There must be an on use action configured and the callback must return true (implement logic there)
  if(action === null || !action.call(this, player)) {
    return player.sendCancelMessage("Only the worthy may pass!");
  }

  this.open();

  player.sendCancelMessage("The gate pulls you in.");

  // Lock movement action
  player.movementHandler.__moveLock.lock(player.getStepDuration(tile.getFriction()));

  // Move the player by walking!
  return process.gameServer.world.creatureHandler.moveCreature(player, tile.position);

}

Door.prototype.handleEnterExpertiseDoor = function(player) {

  /*

   * Function Door.handleEnterExpertiseDoor
   * Handling of expertise doors

   */

  // Determine required level: actionId - 100, or fallback to levelDoor property
  let requiredLevel;
  if (this.hasOwnProperty("actionId")) {
    requiredLevel = this.actionId % 1000;
  } else {
    let levelDoor = this.getAttribute("levelDoor");
    if (levelDoor !== null) {
      requiredLevel = Number(levelDoor);
    }
  }

  if (!requiredLevel || requiredLevel <= 0) {
    return player.sendCancelMessage("Only the worthy may pass!");
  }

  if (player.getLevel() < requiredLevel) {
    return player.sendCancelMessage("Only the worthy may pass!");
  }

  // Open the thing and save a reference to the new door
  this.open();

  // Get the parent of the tile
  let tile = this.getParent();

  // Auto-close when player moves off the door tile
  tile.once("exit", this.close.bind(this));

  player.sendCancelMessage("The gate of expertise pulls you in.");

  // Lock movement action
  player.movementHandler.__moveLock.lock(player.getStepDuration(tile.getFriction()));

  // Move the player by walking!
  return process.gameServer.world.creatureHandler.moveCreature(player, tile.position);

}

Door.prototype.isHouseDoor = function(player) {

  return this.getParent().isHouseTile();
}

Door.prototype.handleHouseDoor = function(player) {

  if(!player.ownsHouseTile(this.getParent())) {
    return player.sendCancelMessage("You do not own this house.");
  }

  if(!this.isOpened()) {
    return this.open();
  } else {
    return this.close();
  }

}

Door.prototype.toggle = function(player) {

  /*
   * Function Door.toggle
   * Toggles the open/closed state of the door
   */

  // Handle expertise doors
  if(player.isPlayer()) {
    if(this.isHouseDoor()) {
      return this.handleHouseDoor(player);
    } else if(this.getAttribute("expertise")) {
      return this.handleEnterExpertiseDoor(player);
    } else if(this.getAttribute("unwanted")) {
      return this.handleEnterUnwantedDoor(player);
    }
  }

  // If the door is closed and it has an action ID it can only be opened by a key
  if(!this.isOpened()) {

    if(this.isLocked()) {

      return player.sendCancelMessage("This door is locked.");

    }

    return this.open();

  }

  // Check if the parent tile is occupied: otherwise close
  if(this.getParent().isOccupiedAny()) {
    return player.sendCancelMessage("Something is blocking the door from closing.");
  }
  
   this.close();

}

Door.prototype.isLocked = function() {

  /*

   * Function Door.isLocked
   * Returns true if the door is locked

   */

  return this.hasOwnProperty("actionId") || this.getAttribute("description") === "It is locked.";

}

Door.prototype.isOpened = function() {

  /*
   * Function Door.isOpened
   * Returns true if the door is opened by checking whether it blocks projectiles
   */

  return !this.isBlockSolid();

}

Door.prototype.__change = function(direction) {

  /*

   * Function Door.__change
   * Replaces the door with its open/closed counterpart

   */

  let newId;

  if (direction === 1) {
    // Opening: if next ID is also a closed door (e.g. locked variant
    // like 1209 where 1209+1=1210 is still closed), skip to id+2
    let nextProto = gameServer.database.getThingPrototype(this.id + 1);
    if (nextProto !== null && nextProto.isDoor() &&
        nextProto.flags.get(OTBBitFlag.prototype.flags.FLAG_BLOCK_SOLID)) {
      newId = this.id + 2;
    } else {
      newId = this.id + 1;
    }
  } else {
    // Closing: always go to previous ID (normal closed variant)
    newId = this.id - 1;
  }

  // Atomic in-place ID change (avoids remove+add duplication)
  this.id = newId;
  let tile = this.getParent();
  if (tile) {
    let index = tile.itemStack.__items.indexOf(this);
    if (index !== -1) {
      tile.broadcast(new ItemAddPacket(tile.position, this, index));
    } else {
      tile.broadcast(new ItemAddPacket(tile.position, this, 0xFF));
    }
  }

  return this;

}

module.exports = Door;

