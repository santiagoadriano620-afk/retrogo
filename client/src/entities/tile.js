const Tile = function(tile, position) {

  /*
   * Class Tile
   * Container for a tile in the gameworld
   */

  // Inherits from thing
  Thing.call(this, tile.id);

  // Tile properties
  this.flags = tile.flags;
  this.zone = tile.zone;
  this.houseState = tile.houseState || 0;

  // Tiles have a position
  this.__position = position;

  // Stack for items and entities on the tile
  this.items = tile.items;
  this.monsters = new Set();

  // Animations that belong to the tile
  this.__animations = new Set();

  // Private state variable to keep the elevation of the tile
  this.__renderElevation = 0;

  // Set of deferred entities to render
  this.__deferredCreatures = new Set();

  // Clean tile for A* pathfinding
  this.cleanPathfinding();

}

Tile.prototype = Object.create(Thing.prototype);
Tile.prototype.constructor = Tile;

Tile.prototype.getFriction = function() {

  const obj = this.getDataObject();
  return obj ? (obj.properties.speed || 100) : 100;

}

Tile.prototype.isNoLogoutZone = function() {

  return Boolean(this.flags & 8);

}

Tile.prototype.isGuildhall = function() {

  /*
   * Function Tile.isGuildhall
   * Returns true if the tile belongs to a guildhall
   */

  return Boolean(this.flags & 0x40);

}

Tile.prototype.hasDoor = function () {

  for (let i = 0; i < this.items.length; i++) {
    let def = gameClient.itemDefinitions[this.items[i].id];
    if (def && def.properties && def.properties.type === "door") {
      return true;
    }
  }
  return false;

}

Tile.prototype.isEntrance = function () {

  if (!this.isGuildhall() || !this.hasDoor()) {
    return false;
  }

  let pos = this.getPosition();
  let dirs = [pos.north(), pos.south(), pos.east(), pos.west()];

  for (let i = 0; i < dirs.length; i++) {
    let neighbor = gameClient.world.getTileFromWorldPosition(dirs[i]);
    if (!neighbor || !neighbor.isGuildhall()) {
      return true;
    }
  }

  return false;

}

Tile.prototype.isProtectionZone = function() {

  /*
   * Function Tile.isProtectionZone
   * Returns true if the tile is a protection zone
   */

  return Boolean(this.flags & 1);

}

Tile.prototype.getCost = function() {

  /*
   * Function Tile.getCost
   * Returns the A* cost of walking on a tile which should be the groundspeed
   */

  if(!this.hasFlag(PropBitFlag.prototype.flags.DatFlagGround)) {
    return 1;
  }

  // Returns the speed of the tile as cost (lower = better)
  const obj = this.getDataObject();
  return obj ? (obj.properties.speed || 100) : 100;

}

Tile.prototype.cleanPathfinding = function() {

  /*
   * Function Tile.cleanPathfinding
   * Cleans the pathfindig parameters from the tile
   */

  // Pathfinding parameters for A*
  this.__f = 0;
  this.__g = 0;
  this.__h = 0;
  this.__visited = false;
  this.__closed = false;
  this.__parent = null;

}

Tile.prototype.getPosition = function() {

  /*
   * Class Tile.getPosition
   * Implements the position API to return the position of a thing
   */

  return this.__position;

}

Tile.prototype.addElevation = function(elevation) {

  /*
   * Class Tile.addElevation
   * Adds the current elevation to the tile for rendering purposes
   */

  // Clamp the maximum elevation to 3/4ths
  this.setElevation(Math.min(24 / 32, this.__renderElevation + elevation / 32));

}

Tile.prototype.deleteAnimation = function(animation) {

  /*
   * Class Tile.addElevation
   * Deletes an animation from the tile
   */

  this.__animations.delete(animation);

}

Tile.prototype.addAnimation = function(animation) {

  /*
   * Class Tile.addAnimation
   * Adds an animation to the tile
   */

  this.__animations.add(animation);

}

Tile.prototype.setElevation = function(elevation) {

  /*
   * Class Tile.setElevation
   * Adds the current elevation to the tile for rendering purposes
   */

  this.__renderElevation = elevation;

}

Tile.prototype.countElevation = function() {

  /*
   * Class Tile.countElevation
   * Returns the number of items with elevation on this tile
   */

  let count = 0;
  for(let i = 0; i < this.items.length; i++) {
    if(this.items[i].isElevation()) {
      count++;
    }
  }
  return count;

}

Tile.prototype.hasMaximumElevation = function() {

  /*
   * Class Tile.hasMaximumElevation
   * Returns true if the tile has reached maximum elevation
   */

  return this.__renderElevation === 0.75;

}

Tile.prototype.addCreature = function(creature) {

  /*
   * Function Tile.addCreature
   * Adds a creature to the tile
   */

  // Entering protection zone
  if(creature === gameClient.player && this.isProtectionZone() && !gameClient.player.hasCondition(ConditionManager.prototype.PROTECTION_ZONE)) {
    gameClient.player.addCondition(5);
  }

  this.monsters.add(creature);

}

Tile.prototype.removeCreature = function(creature) {

  /*
   * Function Tile.removeCreature
   * Removes a creature from the tile
   */

  // Leaving protection zone
  if(creature === gameClient.player && this.isProtectionZone() && gameClient.player.hasCondition(ConditionManager.prototype.PROTECTION_ZONE)) {
    gameClient.player.removeCondition(5);
  }

  this.monsters.delete(creature);

}

Tile.prototype.isItemBlocked = function() {

  /*
   * Function Tile.isItemBlocked
   * Returns TRUE if the tile is blocked by an item that cannot be walked on
   */

  // Go over all items
  for(let i = 0; i < this.items.length; i++) {
    if(!this.items[i].isWalkable()) {
      return true;
    }
  }

  // Item stack trap: 10+ movable items (without elevation) block the tile
  let movableCount = 0;
  for(let i = 0; i < this.items.length; i++) {
    if(!this.items[i].isElevation() && this.items[i].isMoveable()) {
      movableCount++;
    }
  }
  if(movableCount >= 10) {
    return true;
  }

  return false;

}

Tile.prototype.isTranslucent = function() {

  /*
   * Class Tile.isTranslucent
   * Returns true if the tile is completely translucent
   */

  return this.hasFlag(PropBitFlag.prototype.flags.DatFlagTranslucent);

}

Tile.prototype.isHookSouth = function() {

  /*
   * Function Tile.isHookSouth
   * Returns true if a tile can accommodate a hangable item
   */

  // Go over all items
  for(let i = 0; i < this.items.length; i++) {
    if(this.items[i].isHookSouth()) {
      return true;
    }
  }

  return false;

}

Tile.prototype.isHookEast = function() {

  /*
   * Function Tile.isHookEast
   * Returns true if a tile can accommodate a hangable item
   */

  // Go over all items
  for(let i = 0; i < this.items.length; i++) {
    if(this.items[i].isHookEast()) {
      return true;
    }
  }

  return false;

}

Tile.prototype.isWalkable = function() {

  /*
   * Function Tile.isWalkable
   * Returns true when a tile is walkable
   */

  return !this.hasFlag(PropBitFlag.prototype.flags.DatFlagNotWalkable);

}

Tile.prototype.isOccupied = function() {

  /*
   * Function Tile.isOccupied
   * Returns true when the path is occupied with a unwalkable object
   */

  // Identifier 0 means that the tile does not exist and is therefore blocked
  if(this.id === 0) {
    // But there may be items on the tile (e.g. switch/flooring with actionId from an item node)
    if (this.items && this.items.length > 0) {
      return this.isItemBlocked();
    }
    return true;
  }

  // The tile cannot be walked on (e.g., water)
  if(!this.isWalkable()) {
    return true;
  }

  // Is blocked by an item (e.g., wall)
  if(this.isItemBlocked()) {
    return true;
  }

  // Can not walk through entities
  if(Array.from(this.monsters).filter(x => x.type !== 0).length > 0) {
    return true;
  }

  // Available
  return false;

}

Tile.prototype.addItem = function(item, slot) {

  /*
   * Function Tile.addItem
   * Adds an item to the tile
   */

  // We must reference the parent tile to the item
  item.__parent = this;

  // Fetch the current item at this slot
  let selectedItem = this.peekItem(slot);

  // No item there or slot out of bounds: just push
  if(selectedItem === null || selectedItem === undefined) {
    return this.items.push(item);
  }

  // Add to the requested slot position
  if(slot === 0xFF) {
    this.items.push(item);
  } else if(selectedItem.constructor !== item.constructor) {
    // Different item class (e.g. Item vs FluidThing): insert at position
    this.items.splice(slot, 0, item);
  } else if(selectedItem.id !== item.id) {
    // Same class, different ID: atomic server-side transformation (e.g. door open)
    this.items[slot] = item;
  } else {
    this.items.splice(slot, 0, item);
  }

}

Tile.prototype.removeItem = function(index, count) {

  /*
   * Function Tile.removeItem
   * Returns the top monster of a tile
   */

  if(index === 0xFF) {
    index = this.items.length - 1;
  }

  let item = this.items[index];

  // Splice the full item
  if(count === 0) {
    return this.items.splice(index, 1);
  }

  // Splice the full item
  if(item.isFluidContainer()) {
    return this.items.splice(index, 1);
  }

  item.count -= count;

  if(item.count === 0) {
    this.items.splice(index, 1);
  }

}

Tile.prototype.peekItem = function(slot) {

  /*
   * Function Tile.peekItem
   * Returns the top monster of a tile
   */

  // No items
  if(this.items.length === 0) {
    return null;
  }

  // This means top slot
  if(slot === 0xFF) {
    return this.items[this.items.length - 1];
  }

  return this.items[slot];

}

Tile.prototype.hasBlockProjectile = function () {

  for (let i = 0; i < this.items.length; i++) {
    if (this.items[i].hasFlag(PropBitFlag.prototype.flags.DatFlagBlockProjectile)) {
      return true;
    }
  }

  return false;

}

Tile.prototype.getTopCreature = function () {
  if (this.monsters && this.monsters.size > 0) {
    return this.monsters.values().next().value;
  }
  return null;
}

Tile.prototype.getPattern = function() {

  /*
   * Function Tile.getPattern
   * Returns the pattern of a tile
   */

  let obj = this.getDataObject();
  if (!obj) return new Position(0, 0, 0);
  let proto = obj.getFrameGroup(FrameGroup.prototype.NONE);

  return new Position(
    this.__position.x % proto.pattern.x,
    this.__position.y % proto.pattern.y,
    this.__position.z % proto.pattern.z
  );

}
