"use strict";

const Actions = requireModule("utils/actions");
const Enum = requireModule("utils/enum");
const Pathfinder = requireModule("utils/pathfinder");
const Position = requireModule("utils/position");

const MonsterBehaviour = function (monster, behaviour) {

  /*
   * Class MonsterBehaviour
   * Container for monster behaviour and choices: implements different types of monster behaviour
   *
   * API:
   *
   * MonsterBehaviour.hasTarget() - Returns true if the monster has a target
   * MonsterBehaviour.canSeeTarget() - Returns true if the monster can see its target
   * MonsterBehaviour.handleTarget() - Function called occasionally to (re)-target players or drop the target
   * MonsterBehaviour.setTarget(target) - Function to set the target of a monster
   * MonsterBehaviour.handleDamage(attacker) - Callback fired when a monster is damaged and may need to update its behaviour
   * MonsterBehaviour.is(behaviour) - Returns true if the monster currently subscribes to this behavioural state
   * MonsterBehaviour.getNextMoveTile() - Returns the next move for the monster based on its behaviour
   * MonsterBehaviour.setMonsterBehaviour() - Sets the behaviour of a monster from the configuration
   *
   * MonsterBehaviour.BEHAVIOUR - States of possible behaviour for a monster
   *
   */

  // Save a circular reference to the parent monster
  this.monster = monster;

  // Managed for behaviour actions
  this.actions = new Actions();

  // Properties
  this.__target = null;
  this.__gotoPosition = null;

  this.ignoreCharacters = false;
  this.openDoors = behaviour.openDoors;
  this.senseInvisible = behaviour.senseInvisible === true;
  this.fleeHealth = behaviour.fleeHealth || 0;

  this.setBehaviour(behaviour.type);

  // Sayings were configured
  if (behaviour.sayings) {
    this.sayings = behaviour.sayings;
    this.actions.add(this.handleActionSpeak);
  }

}

// The behaviours that can be used by the monsters
MonsterBehaviour.prototype.NEUTRAL = 0;
MonsterBehaviour.prototype.FRIENDLY = 1;
MonsterBehaviour.prototype.HOSTILE = 2;
MonsterBehaviour.prototype.HOSTILE_ON_ATTACK = 3;
MonsterBehaviour.prototype.RANGED = 4;
MonsterBehaviour.prototype.FLEEING = 5;

MonsterBehaviour.prototype.handleActionTarget = function () {

  /*
   * Function Monster.handleActionTarget
   * Handles targeting action of the monster that is done every once in a while
   */

  // Always lock
  this.actions.lock(this.handleActionTarget, Actions.prototype.GLOBAL_COOLDOWN);

  if (!this.requiresTarget()) {
    return;
  }

  // Delegate to find or drop a target
  // If the creature does not have a target yet try to find one
  if (!this.hasTarget()) {
    return this.__findTarget();
  }

  // No longer online
  if (!gameServer.world.creatureHandler.isCreatureActive(this.getTarget())) {
    return this.setTarget(null);
  }

  // Cannot be seen?
  if (!this.canSeeTarget()) {
    return this.setTarget(null);
  }

  // The target is invisible (unless monster can sense invisible)
  const target = this.getTarget();
  if (typeof target.isInvisible === 'function' && target.isInvisible() && !this.senseInvisible) {
    return this.setTarget(null);
  }

  // Target has gone into a protection zone
  if (this.getTarget().isPlayer() && this.getTarget().isInProtectionZone()) {
    return this.setTarget(null);
  }

  // Target is Admin — drop target
  if (this.getTarget().name === "Admin") {
    return this.setTarget(null);
  }

  // Target is dead or has zero health
  if (this.getTarget().isDead || this.getTarget().isZeroHealth()) {
    return this.setTarget(null);
  }

}

MonsterBehaviour.prototype.handleActionSpeak = function () {

  /*
   * Function MonsterBehaviour.handleActionSpeak
   * Handles speaking action of the monster
   */

  // Say a random thing
  if (this.sayings && Math.random() > 0.15) {
    this.monster.speechHandler.internalCreatureSay(this.sayings.texts.random(), CONST.COLOR.ORANGE);
  }

  // Lock the action for a random duration
  let slowness = this.sayings ? this.sayings.slowness : 2000;
  this.actions.lock(this.handleActionSpeak, 0.1 * Number.prototype.random(1, 5) * slowness);

}

MonsterBehaviour.prototype.handleActionAttack = function () {

  /*
   * Function MonsterBehaviour.handleActionAttack
   * Handles the attack action for a monster
   */

  // We do not have a target
  if (!this.hasTarget()) {
    return this.actions.lock(this.handleActionAttack, Actions.prototype.GLOBAL_COOLDOWN);
  }

  // Target is dead or has zero health - drop target immediately
  if (this.getTarget().isDead || this.getTarget().isZeroHealth()) {
    return this.setTarget(null);
  }

  // Target is in a protection zone — drop target
  if (this.getTarget().isPlayer() && this.getTarget().isInProtectionZone()) {
    return this.setTarget(null);
  }

  // Target is offline or missing
  if (!this.canSeeTarget()) {
    return this.actions.lock(this.handleActionAttack, Actions.prototype.GLOBAL_COOLDOWN);
  }

  // Not yet besides the target
  if (!this.isBesidesTarget()) {
    return this.actions.lock(this.handleActionAttack, Actions.prototype.GLOBAL_COOLDOWN);
  }

  // Match the angle to the target
  this.monster.faceCreature(this.getTarget());

  // Delegate to handle the actual combat
  gameServer.world.combatHandler.handleCombat(this.monster);

  // And lock the attack action until next time
  // Convert attackSpeed from milliseconds to frames
  let attackSpeedFrames = Math.floor(this.monster.getProperty(CONST.PROPERTIES.ATTACK_SPEED) / CONFIG.SERVER.MS_TICK_INTERVAL);
  this.actions.lock(this.handleActionAttack, attackSpeedFrames);

}

MonsterBehaviour.prototype.handleActionMove = function () {

  /*
   * Function MonsterBehaviour.handleActionMove
   * Cooldown function that handles the creature movement
   */

  // Let the monster decide its next strategic move
  let tile = this.getNextMoveTile();

  // Invalid tile was returned: do nothing
  if (tile === null || tile.id === 0) {
    return this.actions.lock(this.handleActionMove, Actions.prototype.GLOBAL_COOLDOWN);
  }

  let lockDuration = this.monster.getStepDuration(tile.getFriction());

  // Number of frames to lock
  let slowness = this.monster.position.isDiagonal(tile.position) ? 2 * lockDuration : lockDuration;

  // Delegate to move the creature to the new tile position
  let moved = gameServer.world.creatureHandler.moveCreature(this.monster, tile.position);

  if (!moved) {
    this.__moveFailCount = (this.__moveFailCount || 0) + 1;
    if (this.__moveFailCount >= 3) {
      if (this.hasTarget()) {
        this.setTarget(null);
      }
      this.__moveFailCount = 0;
      return this.actions.lock(this.handleActionMove, Actions.prototype.GLOBAL_COOLDOWN);
    }
    // Short cooldown to try another direction quickly
    return this.actions.lock(this.handleActionMove, Math.ceil(slowness / 3));
  }

  this.__moveFailCount = 0;

  // Lock this function for a number of frames
  this.actions.lock(this.handleActionMove, slowness);

}

MonsterBehaviour.prototype.getPathToTarget = function () {

  /*
   * Function MonsterBehaviour.getPathToTarget
   * Call to the pathfinder to recover the next step to be set by the creature
   */

  if (!this.hasTarget()) {
    return null;
  }

  // Target has gone into protection zone — drop target before pathfinding
  let target = this.getTarget();
  if (target.isPlayer && target.isPlayer() && target.isInProtectionZone()) {
    this.setTarget(null);
    return null;
  }

  // A* pathfinding between creature and target (stop at an adjacent tile)
  let path = gameServer.world.findPath(
    this.monster,
    this.monster.getPosition(),
    this.getTarget().getPosition(),
    Pathfinder.prototype.ADJACENT
  );

  // If no path is found the creature should instead wander randomly
  if (path.length === 0) {
    return null;
  }

  // Get the next position to move to following the pathing algorithm
  return path.pop();

}

MonsterBehaviour.prototype.getTarget = function () {

  /*
   * Function MonsterBehaviour.getTarget
   * Returns true if the monster has a target
   */

  return this.__target;

}

MonsterBehaviour.prototype.hasTarget = function () {

  /*
   * Function MonsterBehaviour.hasTarget
   * Returns true if the monster has a target
   */

  return this.__target !== null;

}

MonsterBehaviour.prototype.canSeeTarget = function () {

  /*
   * Function MonsterBehaviour.hasTarget
   * Returns true if the monster has a target
   */

  // Check whether the monster can see the target
  return this.monster.canSee(this.getTarget().getPosition());

}

MonsterBehaviour.prototype.setTarget = function (target) {

  /*
   * Function MonsterBehaviour.setTarget
   * Sets the target of the monster
   */

  // Active the combat lock when targeting a player
  this.__target = target;

}

MonsterBehaviour.prototype.setGotoPosition = function (pos) {
  this.__gotoPosition = pos;
}

MonsterBehaviour.prototype.clearGotoPosition = function () {
  this.__gotoPosition = null;
}

MonsterBehaviour.prototype.handleDamage = function (attacker) {

  /*
   * Function MonsterBehaviour.handleDamage
   * Handles changes to behaviour for an incoming event by an attacker
   */

  // Summons don't change targets based on damage — they follow the master
  if (this.monster.master) {
    return;
  }

  // Don't target Admin
  if (attacker && attacker.name === "Admin") {
    return;
  }

  // If hostile on attack change to being hostile and set the target to the attacker
  if (this.is(this.HOSTILE_ON_ATTACK)) {
    this.setState(this.HOSTILE);
    this.setTarget(attacker);
  }

  // Fleeing
  if (this.monster.health <= this.fleeHealth) {
    this.setState(this.FLEEING);
    this.setTarget(attacker);
  }

}

MonsterBehaviour.prototype.is = function (behaviour) {

  /*
   * Function MonsterBehaviour.is
   * Returns true if the behaviour state is currently equal to the passed behaviour
   */

  return this.state === behaviour;

}

MonsterBehaviour.prototype.isBesidesTarget = function () {

  /*
   * Function Monster.isBesidesTarget
   * Handles moving behaviour
   */

  return this.monster.isBesidesThing(this.getTarget());

}

MonsterBehaviour.prototype.requiresTarget = function () {

  /*
   * Function MonsterBehaviour.requiresTarget
   * Returns whether the particular behaviour state requires a target
   */

  return this.is(this.HOSTILE) || this.is(this.FLEEING) || this.is(this.FRIENDLY) || this.is(this.RANGED);

}

MonsterBehaviour.prototype.wander = function () {

  /*
   * Function MonsterBehaviour.wander
   * Returns a random position around the monster's position
   */

  // We have these options: explore them in a random order
  let position = this.monster.getPosition();

  if (position === null) {
    return null;
  }

  // Try NESW first (random order)
  let nsw = position.getNESW();
  while (nsw.length > 0) {
    let tile = gameServer.world.getTileFromWorldPosition(nsw.popRandom());
    if (tile !== null && tile.id !== 0 && !this.monster.isTileOccupied(tile)) {
      return tile;
    }
  }

  // Fallback: try diagonals (random order, only if both cardinal tiles are walkable)
  let diagonals = [
    position.add(new Position(1, -1, 0)),
    position.add(new Position(1, 1, 0)),
    position.add(new Position(-1, 1, 0)),
    position.add(new Position(-1, -1, 0))
  ];
  while (diagonals.length > 0) {
    let targetPos = diagonals.popRandom();
    let tile = gameServer.world.getTileFromWorldPosition(targetPos);
    if (tile === null || tile.id === 0 || this.monster.isTileOccupied(tile)) continue;
    // Check cardinal path tiles are walkable
    let dx = targetPos.x - position.x;
    let dy = targetPos.y - position.y;
    let c1 = gameServer.world.getTileFromWorldPosition(new Position(position.x + dx, position.y, position.z));
    let c2 = gameServer.world.getTileFromWorldPosition(new Position(position.x, position.y + dy, position.z));
    if (c1 === null || c1.id === 0 || c1.isBlockSolid() ||
        c2 === null || c2.id === 0 || c2.isBlockSolid()) continue;
    return tile;
  }

  return null;

}

MonsterBehaviour.prototype.__followMaster = function () {

  let master = this.monster.master;

  if (!master || !master.getPosition()) {
    return null;
  }

  // Don't follow the master into a protection zone
  if (master.isPlayer && master.isPlayer() && master.isInProtectionZone()) {
    return null;
  }

  // Already beside the master
  if (master.getPosition().besides(this.monster.getPosition())) {
    return null;
  }

  // Try to pathfind to the master (stop adjacent)
  let path = gameServer.world.findPath(
    this.monster,
    this.monster.getPosition(),
    master.getPosition(),
    Pathfinder.prototype.ADJACENT
  );

  if (path.length === 0) {
    return null;
  }

  return path.pop();

};

MonsterBehaviour.prototype.__gotoPathfind = function () {

  let targetPos = this.__gotoPosition;
  if (!targetPos) return null;

  let pos = this.monster.getPosition();

  // Reached the exact target position
  if (targetPos.isEqual(pos)) {
    this.__gotoPosition = null;
    return null;
  }

  // Move in a straight line toward the target
  let dx = targetPos.x - pos.x;
  let dy = targetPos.y - pos.y;
  let stepX = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
  let stepY = dy > 0 ? 1 : (dy < 0 ? -1 : 0);

  // Try diagonal step first (toward target)
  let diagPos = pos.add(new Position(stepX, stepY, 0));
  let diagTile = gameServer.world.getTileFromWorldPosition(diagPos);
  if (diagTile && diagTile.id !== 0 && !this.monster.isTileOccupied(diagTile)) {
    return diagTile;
  }

  // Try cardinal X
  if (stepX !== 0) {
    let xPos = pos.add(new Position(stepX, 0, 0));
    let xTile = gameServer.world.getTileFromWorldPosition(xPos);
    if (xTile && xTile.id !== 0 && !this.monster.isTileOccupied(xTile)) {
      return xTile;
    }
  }

  // Try cardinal Y
  if (stepY !== 0) {
    let yPos = pos.add(new Position(0, stepY, 0));
    let yTile = gameServer.world.getTileFromWorldPosition(yPos);
    if (yTile && yTile.id !== 0 && !this.monster.isTileOccupied(yTile)) {
      return yTile;
    }
  }

  return null;

}

MonsterBehaviour.prototype.getNextMoveTile = function () {

  /*
   * Function MonsterBehaviour.getNextMoveTile
   * Returns the next move action for the monster based on its behaviour
   */

  // Summon without a target: follow the master
  if (this.monster.master && !this.hasTarget()) {
    return this.__followMaster();
  }

  // Has a goto position: walk toward it
  if (this.__gotoPosition && !this.hasTarget()) {
    return this.__gotoPathfind();
  }

  // If the monster does not have a target always aimlessly wander around
  if (!this.hasTarget()) {
    return this.wander();
  }

  // Ranged monsters keep their distance instead of walking adjacent
  let proto = this.monster.getPrototype();
  let targetDistance = (proto && proto.flags && proto.flags.targetDistance) || 1;
  if (targetDistance > 1) {
    return this.__handleRangedMoveMonsterBehaviour();
  }

  return this.__handleTargetMoveMonsterBehaviour();

}

MonsterBehaviour.prototype.setBehaviour = function (state) {

  // Set the state
  this.state = state;

  // Monsters have these actions
  this.actions.add(this.handleActionMove);
  this.actions.add(this.handleActionSpeak);

  if (this.is(this.HOSTILE)) {
    this.actions.add(this.handleActionAttack);
    this.actions.add(this.handleActionTarget);
  } else {
    this.actions.remove(this.handleActionAttack);
    this.actions.remove(this.handleActionTarget);
    this.setTarget(null);
  }

}

MonsterBehaviour.prototype.__findTarget = function () {

  /*
   * Function MonsterBehaviour.__findTarget
   * Finds a player to target and be hostile or friendly with
   */

  // Summon: use master's target instead of searching independently
  if (this.monster.master) {
    let masterTarget = this.monster.master.getTarget();
    if (masterTarget && gameServer.world.creatureHandler.isCreatureActive(masterTarget)) {
      this.setTarget(masterTarget);
    }
    return;
  }

  // All chunks (wide radius)
  let chunks = gameServer.world.getSpectatingChunksWide(this.monster.getPosition());

  // Go over all potential chunks
  for (let chunk of chunks) {

    // Go over all players in the chunks
    for (let player of chunk.players) {

      // Cannot target players in protection zones
      if (player.isInProtectionZone()) {
        continue;
      }

      // Cannot target invisible players (unless monster can sense invisible)
      if (player.isInvisible() && !this.senseInvisible) {
        continue;
      }

      // Cannot target dead players
      if (player.isDead || player.isZeroHealth()) {
        continue;
      }

      // Cannot target Admin
      if (player.name === "Admin") {
        continue;
      }

      player.combatLock.activate();
      player.pzLock.activate();

      this.setTarget(player);

    }

  }

}

MonsterBehaviour.prototype.__canReach = function (targetPosition) {

  /*
   * Function MonsterBehaviour.__canReach
   * Returns true if the creature can reach a particular target position
   */

  // Not visible so no
  if (!this.monster.canSee(targetPosition)) {
    return false;
  }

  // Already besides the target
  if (targetPosition.besides(this.monster.getPosition())) {
    return true;
  }

  // A* pathfinding between creature and target (stop at an adjacent tile)
  let path = gameServer.world.findPath(
    this.monster,
    this.monster.getPosition(),
    targetPosition,
    Pathfinder.prototype.ADJACENT
  );

  // Must be a path
  return path.length > 0;

}

MonsterBehaviour.prototype.__handleRangedMoveMonsterBehaviour = function () {

  /*
   * Function MonsterBehaviour.__handleRangedMoveMonsterBehaviour
   * Returns the next move action for the monster if its behaviour is ranged
   */

  // Distance to be kept from the target (from flags.targetDistance, default 3)
  let proto = this.monster.getPrototype();
  const KEEP_DISTANCE = (proto && proto.flags && proto.flags.targetDistance) || 3;

  // Calculate distance
  let distance = this.monster.position.pythagoreanDistance(this.getTarget().getPosition());

  // Either move inward or outward
  if (distance < KEEP_DISTANCE) {
    return this.__handleFleeMoveMonsterBehaviour();
  } else if (distance > KEEP_DISTANCE) {
    let path = this.getPathToTarget();
    if (path !== null) {
      return path;
    }
    // Can't get closer — wander while keeping target (retry pathfinding next tick)
    return this.wander();
  }

  // At the right distance — stand still and fire
  // Ranged monsters don't need to be adjacent to attack
  return null;

}

MonsterBehaviour.prototype.__handleTargetMoveMonsterBehaviour = function () {

  /*
   * Function Monster.__handleTargetMoveMonsterBehaviour
   * Handles moving behaviour for melee monsters
   */

  // Always stop moving when already besides the target
  if (this.isBesidesTarget()) {
    return null;
  }

  // Try to pathfind to the target
  let path = this.getPathToTarget();

  // Can reach the target
  if (path !== null) {
    return path;
  }

  // Can't pathfind — wander while keeping target (retry pathfinding next tick)
  return this.wander();

}

MonsterBehaviour.prototype.__handleFleeMoveMonsterBehaviour = function () {

  /*
   * Function Monster.__handleFleeMoveMonsterBehaviour
   * Returns the optimal fleeing position using a simple heuristic
   */

  let heuristics = new Array();
  let tiles = new Array();

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {

      let added = this.monster.position.add(new Position(x, y, 0));
      let tile = process.gameServer.world.getTileFromWorldPosition(added);

      // The tile cannot be used to walk on
      if (this.monster.isTileOccupied(tile)) {
        continue;
      }

      // Determine simple heuristic: farther distance (higher) away from "target" is better
      let heuristic = this.getTarget().getPosition().manhattanDistance(added);

      // Impose a penalty for diagonal movement
      if (this.monster.position.isDiagonal(added)) {
        heuristic /= 3;
      }

      // Save the heuristic and beloning tiles
      heuristics.push(heuristic);
      tiles.push(tile);

    }
  }

  // This means no tiles were found
  if (tiles.length === 0) {
    return null;
  }

  // Maximum heuristic
  let maximum = Math.max.apply(null, heuristics);

  // The best tile
  return tiles[heuristics.indexOf(maximum)];

}

MonsterBehaviour.prototype.handleOpenDoor = function (thing) {

  /*
   * Function MonsterBehaviour.handleOpenDoor
   * Checks whether a door exists at the tile and that the door can be opened
   */

  // There is no thing or the thing is not a door
  if (thing === null || !thing.isDoor()) {
    return;
  }

  // If the door is closed and not truly locked (has actionId), open it
  // Description-based locking ("It is locked.") does not block monsters
  if (!thing.isOpened() && !thing.hasActionId()) {
    return thing.open();
  }

}

module.exports = MonsterBehaviour;
