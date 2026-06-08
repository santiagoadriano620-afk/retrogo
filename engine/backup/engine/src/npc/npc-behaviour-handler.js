"use strict";

const NPCBehaviour = function(npc, behaviour) {

  /*
   * Class NPCBehaviour
   * Code to handle the behavior of the NPC
   *
   * Public API:
   * 
   * @NPCBehaviour.isWandering() - returns true if the NPC is configured to wander
   * @NPCBehaviour.isTileOccupied(tile) - returns true if the passed tile is occupied for the NPC
   * @NPCBehaviour.getWanderMove() - returns a random potential wandering move 
   * @NPCBehaviour.getStepDuration(tile) - returns the duration in frames of a step on the tile
   * 
   */

  this.npc = npc;

  // Defaults: overwrite
  this.behaviour = new Object({
    "openDoors": true,
    "wanderRange": 3,
    "wandering": true,
    "ignoreCharacters": true,
    "pauseAfterWander": true
  }); 

  Object.assign(this.behaviour, behaviour);

}

NPCBehaviour.prototype.isWandering = function() {

  /*
   * Function NPCBehaviour.isWandering
   * Returns true if the NPC is configured to wander
   */

  return this.behaviour.wandering;

}

NPCBehaviour.prototype.__isWithinWanderRange = function(position) {

  /*
   * Function NPCBehaviour.__isWithinWanderRange
   * Return true if the NPC is within wandering range of its spawn point
   */

  return this.npc.spawnPosition.isWithinRangeOf(position, this.__getWanderRange());

}

NPCBehaviour.prototype.__isValidStandingPosition = function(position) {

  /*
   * Function NPCBehaviour.__isValidStandingPosition
   * Return true if the position is a valid position for the NPC
   */

  // Not avaible because it is outside the allowed wander range
  if(!this.__isWithinWanderRange(position)) {
    return false;
  }

  // Get properties of the tile at this position
  let tile = process.gameServer.world.getTileFromWorldPosition(position);

  // The tile is occupied for the NPC
  if(this.isTileOccupied(tile)) {
    return false;
  }

  return true;

}

NPCBehaviour.prototype.isTileOccupied = function(tile) {

  /*
   * Function NPC.isTileOccupied
   * Function evaluated for a tile whether it is occupied for the NPC or not
   */

  // Invalid tile
  if(tile === null || tile.id === 0) {
    return true;
  }

  // If the tile is blocking then definitelyn ot available
  if(tile.isBlockSolid()) {
    return true;
  }

  // The tile items contain a block solid (e.g., a wall or a door that can be opened)
  if(tile.itemStack && tile.itemStack.isBlockNPC()) {
    return true;
  }

  // Block stairs and teleporters to prevent NPCs from climbing/teleporting and getting stuck
  if(tile.hasDestination()) {
    return true;
  }

  // Block visual elevation items (ramps, archways, buttresses) — NPCs shouldn't walk on structural decor
  if(tile.itemStack && tile.itemStack.hasHeightItem()) {
    return true;
  }

  // Only occupied by characters when not in a scene
  if(!this.npc.cutsceneHandler.isInScene() && tile.isOccupiedCharacters()) {
    return true;
  }

  // Allow stepping up to 1 height level per move (stairs-like behavior up to 4)
  let currentTile = gameServer.world.getTileFromWorldPosition(this.npc.position);
  let heightDiff = tile.countHeight() - (currentTile ? currentTile.countHeight() : 0);
  if(heightDiff > 1) {
    return true;
  }

  // Item stack trap: NPCs avoid tiles with many movable items
  if(tile.hasItems()) {
    let movableCount = tile.itemStack.__items.filter(
      i => !i.hasHeight() && i.isMoveable()
    ).length;
    if(movableCount >= CONST.TRAP.BLOCK_SOFT) {
      return true;
    }
  }

  return false;

}

NPCBehaviour.prototype.getWanderMove = function() {

  /*
   * Function NPCBehaviour.getWanderMove
   * Returns a random position around the creature
   */

  // Get all possible movement directions (north, east, south, west)
  let positions = this.npc.position.getNESW();

  positions = positions.filter(this.__isValidStandingPosition, this);

  // No valid positions returned
  if(positions.length === 0) {
    return null;
  }

  return gameServer.world.getTileFromWorldPosition(positions.random());

}

NPCBehaviour.prototype.getStepDuration = function(tile) {
  let stepDuration = Math.ceil(2000 / CONFIG.SERVER.MS_TICK_INTERVAL);
  let pause = Math.ceil(2000 / CONFIG.SERVER.MS_TICK_INTERVAL);
  return stepDuration + pause;
}

NPCBehaviour.prototype.__willPauseAfterWander = function() {

  /*
   * Function NPCBehaviour.__willPauseAfterWander
   * Returns whether the NPC will pause briefly after wandering
   */

  return this.behaviour.pauseAfterWander;

}

NPCBehaviour.prototype.__getWanderRange = function() {

  /*
   * Function NPCBehaviour.__getWanderRange
   * Return the wander range of the NPC
   */

  return this.behaviour.wanderRange;

}

module.exports = NPCBehaviour;
