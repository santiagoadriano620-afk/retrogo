"use strict";

const GenericLock = requireModule("utils/generic-lock");

const PlayerMovementHandler = function (player) {
  /*
   * Class PlayerMovementHandler
   * Handler for movement of the player
   */

  // Reference the parent
  this.__player = player;

  // Create a generic lock for movement
  this.__moveLock = new GenericLock();
  this.__moveLock.on("unlock", this.__unlockMovementAction.bind(this));

  // The buffer if more consecutive inputs are given by the client
  this.__clientMoveBuffer = null;

  // Anti-cheat: track last move time for speed detection
  this.__lastMoveTime = 0;
  this.__lastStepDuration = 0;
};

PlayerMovementHandler.prototype.isMoving = function () {
  /*
   * Function PlayerMovementHandler.isMoving
   * Returns true if the creature is moving and does not have the move action available
   */

  return this.__moveLock.isLocked();
};

PlayerMovementHandler.prototype.handleMovement = function (direction) {
  /*
   * Function PlayerMovementHandler.prototype.handleMovement
   * Callback fired when a particular function is unlocked
   */

  // If the player has its move action locked: set the movement buffer
  if (this.isMoving()) {
    return this.__setMoveBuffer(direction);
  }

  // Prevent movement if dead
  if (this.__player.isDead) {
    return;
  }

  // Anti-cheat: detect movement too fast for step duration
  if (this.__lastMoveTime > 0 && this.__lastStepDuration > 0) {
    let elapsed = Date.now() - this.__lastMoveTime;
    if (elapsed < this.__lastStepDuration * 0.5) {
      this.__player.__moveViolations = (this.__player.__moveViolations || 0) + 1;
      if (this.__player.__moveViolations >= 5) {
        gameServer.world.antiCheatManager.flagSuspect(this.__player);
        this.__player.__moveViolations = 0;
      }
    }
  }
  this.__lastMoveTime = Date.now();

  let position = this.__player
    .getPosition()
    .getPositionFromDirection(direction);

  // Red/Black skull cannot enter protection zones
  let targetTile = gameServer.world.getTileFromWorldPosition(position);
  if (targetTile && targetTile.isProtectionZone && targetTile.isProtectionZone()) {
    let skull = this.__player.__skull;
    if (skull === CONST.SKULL.RED || skull === CONST.SKULL.BLACK) {
      this.__player.sendCancelMessage("You may not enter a protection zone while marked with a red or black skull.");
      return;
    }
  }

  // Move the dude
  let tile = gameServer.world.getTileFromWorldPosition(position);

  // Early validation: reject movement onto tiles too high to step onto
  if (tile !== null) {
    if (tile.isBlockSolid() || (tile.hasItems() && tile.itemStack.isBlockSolid())) {
      return;
    }
    let currentTile = gameServer.world.getTileFromWorldPosition(this.__player.position);
    let heightDiff = tile.countHeight() - (currentTile ? currentTile.countHeight() : 0);
    if (heightDiff > 1) {
      return;
    }
  }

  let stepDuration =
    tile === null || tile.id === 0
      ? 0
      : this.__player.getStepDuration(tile.getFriction());

  this.__lastStepDuration = stepDuration;

  // Lock movement action
  this.__moveLock.lock(stepDuration);

  // Move the player by walking!
  let success = gameServer.world.creatureHandler.moveCreature(
    this.__player,
    position
  );

  // Set direction after move
  if (success) {
    this.__player.setDirection(direction);
  }

  // Not succesful: teleport to the current position
  if (!success) {
    this.__player.setDirection(direction);
    gameServer.world.creatureHandler.teleportCreature(
      this.__player,
      this.__player.position
    );
  }
};

PlayerMovementHandler.prototype.__unlockMovementAction = function (action) {
  /*
   * Function Player.__unlockMovementAction
   * Callback fired when a particular function is unlocked
   */

  // Movement buffer actions must have special handling
  if (this.__clientMoveBuffer === null) {
    return;
  }

  this.handleMovement(this.__clientMoveBuffer);

  // Clear the buffer
  this.__setMoveBuffer(null);
};

PlayerMovementHandler.prototype.__setMoveBuffer = function (direction) {
  /*
   * Function Player.__setMoveBuffer
   * Updates the server-side movement buffer of the player
   */

  // Sets the server side move buffer
  this.__clientMoveBuffer = direction;
};

module.exports = PlayerMovementHandler;
