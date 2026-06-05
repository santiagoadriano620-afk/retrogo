const Creature = function (data) {

  /*
   * Class Creature
   * Container for a generic interactive creature (e.g., monster, NPC, players) that are not the game player itself
   *
   * Public API:
   *
   * @Creature.getHealthColor - returns the health color of the creature based on its current health percentage
   * @Creature.getHealthPercentage - returns the player health percentage (0 - 100%)
   * @Creature.getHealthFraction - returns the player health as a fraction (0 - 1)
   *
   */

  this.state = new State();
  this.state.add("health", this.setHealthStatus.bind(this));
  this.state.add("mana", this.setManaStatus.bind(this));

  // Save properties to the instance
  this.id = data.id;
  this.type = data.type;           // 0: player, 1: monster, 2: npc
  this.name = data.name;
  this.__position = data.position;
  this.maxHealth = data.maxHealth;
  this.speed = data.speed;
  this.attackSlowness = data.attackSlowness;
  this.conditions = new ConditionManager(this, data.conditions);

  this.__lookDirection = data.direction;
  this.__previousPosition = data.position.copy();
  this.skull = CONST.SKULL.NONE;
  this.shield = CONST.SHIELD.NONE;
  this.hasTrade = (data.npcFlags & 1) !== 0;
  this.hasBank = (data.npcFlags & 2) !== 0;
  this.hasTravel = (data.npcFlags & 4) !== 0;
  this.hasSpell = (data.npcFlags & 8) !== 0;

  // The creature outfit
  this.outfit = new Outfit(data.outfit);
  this.castingManager = new CastingManager();

  // Internal information

  // Set the current sector
  this.__movementEvent = null;
  this.__movementQueue = [];
  this.__lookDirectionBuffer = null;
  this.__chunk = gameClient.world.getChunkFromWorldPosition(this.__position);
  this.__teleported = false;

  // Create a name DOM element for the creature
  this.__createCharacterElement();

  // The active text element that appears above the player's head
  this.__activeTextElement = null;

  // The target creature of the player
  this.__target = null;

  // Animations that affect the creature
  this.__animations = new Set();

  this.state.health = data.health;

}

Creature.prototype.removeCondition = function (cid) {

  /*
   * Function Player.removeCondition
   * Removes a condition from the player and updates the status bar
   */

  this.conditions.remove(cid);

}

Creature.prototype.addCondition = function (cid) {

  /*
   * Function Player.addCondition
   * Adds a condition ro the player and updates the status bar
   */

  // Add the condition identifier to the set
  this.conditions.add(cid);

}

Creature.prototype.hasCondition = function (cid) {

  /*
   * Function Player.hasCondition
   * Returns true if the player has a condition
   */

  return this.conditions.has(cid);

}

Creature.prototype.blockHit = function () {

  /*
   * Function Creature.blockHit
   * Plays a simple block hit animation effect on the creature
   */

  return gameClient.renderer.addPositionAnimation({
    "position": this.__position,
    "type": 3
  });

}

Creature.prototype.setHealthStatus = function () {

  this.characterElement.setDefault();

  if (gameClient.interface && gameClient.interface.windowManager) {
    gameClient.interface.windowManager.getWindow("battle-window").updateCreature(this);
  }

}

Creature.prototype.setManaStatus = function () {

  if (gameClient.interface && gameClient.interface.windowManager) {
    gameClient.interface.windowManager.getWindow("battle-window").updateCreature(this);
  }

}

Creature.prototype.getMaxFloor = function () {

  /*
   * Function Creature.getMaxFloor
   * Returns the maximum visible floor for the creature
   */

  return gameClient.world.getChunkFromWorldPosition(this.getPosition()).getFirstFloorFromBottom(this.getPosition());

}

Creature.prototype.getCharacterFrames = function () {

  /*
   * Function Creature.getCharacterFrames
   * Returns the character frames and frame groups to be rendered
   */

  let characterObject = this.outfit.getDataObject();

  if (characterObject === null) {
    return null;
  }

  let characterGroup, characterFrame;

  if (!this.isMoving()) {
    characterGroup = characterObject.getFrameGroup(FrameGroup.prototype.GROUP_IDLE);
    if (characterObject.frameGroups.length === 1 && !characterObject.isAlwaysAnimated()) {
      characterFrame = 0;
    } else {
      characterFrame = characterGroup.getAlwaysAnimatedFrame();
    }
  } else {
    characterGroup = characterObject.getFrameGroup(FrameGroup.prototype.GROUP_MOVING);
    characterFrame = this.__getWalkingFrame(characterGroup);
  }

  return new Object({
    characterGroup,
    characterFrame
  });

}

Creature.prototype.getPosition = function () {

  /*
   * Function Creature.getPosition
   * Returns the position of the creature
   */

  return this.__position;

}

Creature.prototype.hasTarget = function () {

  /*
   * Function Creature.hasTarget
   * Returns true if the creature has a target
   */

  return this.__target !== null;

}

Creature.prototype.serverSetOutfit = function (outfit) {

  /*
   * Function Creature.serverSetOutfit
   * Updates the current outfit of the creature with a new outfit
   */

  this.outfit = outfit;

}

Creature.prototype.setPosition = function (position) {

  let fromTile = gameClient.world.getTileFromWorldPosition(this.getPosition());

  if (fromTile !== null) {
    fromTile.removeCreature(this);
  }

  this.__position = position;
  this.__chunk = gameClient.world.getChunkFromWorldPosition(position);

  let toTile = gameClient.world.getTileFromWorldPosition(position);
  if (toTile !== null) {
    toTile.addCreature(this);
  }

  if (this.__movementEvent) {
    this.__movementEvent.cancel();
    this.__movementEvent = null;
  }
  this.__movementQueue = [];

  if (gameClient.interface && gameClient.interface.windowManager) {
    if (this === gameClient.player) {
      gameClient.world.updateBattleListVisibility();
    } else {
      gameClient.interface.windowManager.getWindow("battle-window").updateCreature(this);
    }
  }

}

Creature.prototype.getHealthPercentage = function () {

  /*
   * Function Creature.getHealthPercentage
   * Returns the health as a percentage 
   */

  return this.getHealthFraction().toPercentage();

}

Creature.prototype.getHealthFraction = function () {

  /*
   * Function Creature.getHealthFraction
   * Returns the health fraction of a creature
   */

  // Clamp the fraction between 0 and 1
  return (this.state.health / this.maxHealth).clamp(0, 1);

}

Creature.prototype.say = function (packet) {

  /*
   * Function Creature.say
   * Says a message packet from the server
   */

  // Reset the text buffer
  this.textBuffer = new Array();

  // Overwrite the currently active DOM element if it exists
  if (this.__activeTextElement !== null) {
    this.__activeTextElement.complete();
  }

  // New lines indicate breaks in speaking
  this.textBuffer = packet.message.split("\n");

  // Write text to the game screen
  return this.__setActiveTextElement(this.textBuffer.shift(), packet.color);

}

Creature.prototype.addBoxAnimation = function (color) {

  /*
   * Function Renderer.addBoxAnimation
   * Adds a box animation around the creature (e.g., when attacking or being attacked)
   */

  this.__animations.add(new BoxAnimation(color));

}

Creature.prototype.deleteAnimation = function (animation) {

  /*
   * Function Creature.deleteAnimation
   * Deletes an animation that is attached to a creature
   */

  this.__animations.delete(animation);

}

Creature.prototype.addAnimation = function (id) {

  /*
   * Function Renderer.addCreatureAnimation
   * Adds an animation that sticks to the passed creature identifier
   */

  // Get the animation identifier
  let aid = gameClient.dataObjects.getAnimationId(id);

  if (aid === null) {
    return;
  }

  this.__animations.add(new Animation(aid));

}

Creature.prototype.increaseHealth = function (amount) {

  /*
   * Function Creature.increaseHealth
   * Increases the health of the creature until a maximum
   */

  this.state.health = (this.state.health + amount).clamp(0, this.maxHealth);

}

Creature.prototype.getTarget = function () {

  /*
   * Function Creature.getTarget
   * Returns the current target of the creature
   */

  return this.__target;

}

Creature.prototype.remove = function () {

  /*
   * Function Creature.remove
   * Removes the creatures references and DOM elements
   */

  // Make sure to remove the name element from the DOM
  this.characterElement.remove();

}

Creature.prototype.getMoveOffset = function () {

  /*
   * Function GameClient.getMoveOffset
   * Returns the movement fraction offset in pixels
   */

  // The creature is moving, there is no offset
  if (!this.isMoving() || this.__teleported) {
    return Position.prototype.NULL;
  }

  // Get the fraction of how much of the movement event has been completed
  let fraction = this.getMovingFraction();

  // The face direction is important here
  switch (this.getLookDirection()) {
    case CONST.DIRECTION.WEST:
      return new Position(-fraction, 0, 0);
    case CONST.DIRECTION.NORTH:
      return new Position(0, -fraction, 0);
    case CONST.DIRECTION.EAST:
      return new Position(fraction, 0, 0);
    case CONST.DIRECTION.SOUTH:
      return new Position(0, fraction, 0);
    case CONST.DIRECTION.NORTH_WEST:
      return new Position(-fraction, -fraction, 0);
    case CONST.DIRECTION.NORTH_EAST:
      return new Position(fraction, -fraction, 0);
    case CONST.DIRECTION.SOUTH_EAST:
      return new Position(fraction, fraction, 0);
    case CONST.DIRECTION.SOUTH_WEST:
      return new Position(-fraction, fraction, 0);
  }

}


Creature.prototype.moveTo = function (position, speed) {

  if (!gameClient.world.isValidWorldPosition(position)) {
    return false;
  }

  if (this.isMoving() && this !== gameClient.player) {
    this.__movementQueue.push({
      position: position,
      speed: speed
    });
    if (this.__movementQueue.length > 10) {
      this.__movementQueue.splice(0, this.__movementQueue.length - 10);
    }
    return true;
  }

  this.__chunk = gameClient.world.getChunkFromWorldPosition(position);

  if (this.__movementEvent) {
    this.__movementEvent.cancel();
  }

  this.__startMove(position, speed);

  if (this === gameClient.player) {
    return gameClient.renderer.minimap.cache();
  }

}

Creature.prototype.__startMove = function (position, speed) {

  let modSlowness = (this.getPosition().isDiagonal(position) ? 2 : 1) * speed;

  this.__movementEvent = gameClient.eventQueue.addEvent(this.unlockMovement.bind(this), modSlowness);

  let angle = this.getPosition().getLookDirection(position);

  if (angle !== null) {
    this.__lookDirection = angle;
  }

  this.__previousPosition = this.getPosition();
  this.__position = position;

  if (gameClient.player && gameClient.player.canSeeSmall(this) && position.z === gameClient.player.__position.z) {
    gameClient.interface.soundManager.playWalkBit(position);
  }

}

Creature.prototype.getLookDirection = function () {

  /*
   * Function Creature.getLookDirection
   * Returns the facing direction of the creature
   */

  return this.__lookDirection;

}

Creature.prototype.setTurnBuffer = function (direction) {

  /*
   * Function Creature.setTurnBuffer
   * Sets the direction of the creature to a new direction
   */

  // If moving update the buffer to be updated when creature stops moving
  if (this.isMoving()) {
    return this.__lookDirectionBuffer = direction;
  }

  // Update the look direction
  this.__setLookDirection(direction);

}

Creature.prototype.unlockMovement = function () {

  if (this.__lookDirectionBuffer !== null) {
    this.__lookDirection = this.__lookDirectionBuffer;
    this.__lookDirectionBuffer = null;
  }

  this.__movementEvent = null;
  this.__teleported = false;

  if (gameClient.player === this && this.__previousPosition && this.__previousPosition.isDiagonal(this.__position)) {
    gameClient.keyboard.__diagonalMoveCooldown = Date.now() + 500;
  }

  if (this.__movementQueue.length > 0) {
    if (gameClient.player === this) {
      let fn = this.__movementQueue.shift();
      fn();
    } else {
      let next = this.__movementQueue.shift();
      this.__chunk = gameClient.world.getChunkFromWorldPosition(next.position);
      this.__startMove(next.position, next.speed);
    }
    return;
  }

  if (gameClient.player === this && (gameClient.world.pathfinder.__pathfindCache.length > 0 || gameClient.world.pathfinder.__finalDestination !== null)) {
    return gameClient.world.pathfinder.handlePathfind();
  }

}

Creature.prototype.getName = function () {
  return this.name;
}

Creature.prototype.getChunk = function () {

  /*
   * Function Creature.getChunk
   * Returns the current chunk that the creature belongs to
   */

  return this.__chunk;

}

Creature.prototype.isMoving = function () {

  /*
   * Function Creature.isMoving
   * Returns true when the character has a movement event lock and is moving
   */

  return this.__movementEvent !== null;

}

Creature.prototype.getMovingFraction = function () {

  /*
   * Function Creature.getMovingFraction
   * Returns the fraction of movement completed by the creature
   */

  // If not moving: the fraction is most definitely 0
  if (!this.isMoving()) {
    return 0;
  }

  // Was teleported and does not have a moving fraction
  if (this.__teleported) {
    return 0;
  }

  // Calculate the fraction of movement completion: negative?
  return this.__movementEvent.remainingFraction();

}

Creature.prototype.canSee = function (thing) {

  /*
   * Function Creature.canSee
   * Returns true when the creature can see a world object completely
   */

  let projectedSelf = this.getPosition().projected();
  let projectedThing = thing.getPosition().projected();

  // Calculate delta in view (account for elevation projection)
  let dx = Math.abs(projectedSelf.x - projectedThing.x);
  let dy = Math.abs(projectedSelf.y - projectedThing.y);

  // Delta must be smaller than the screen width (with 2-tile buffer for pre-rendering)
  // OPTIMIZED: Reduced from +4 buffer to +2 buffer to reduce draw calls
  let limitX = Math.ceil(Interface.prototype.SCREEN_WIDTH_MIN / 32) + 2;
  let limitY = Math.ceil(Interface.prototype.SCREEN_HEIGHT_MIN / 32) + 2;
  return (dx < limitX) && (dy < limitY);

}

Creature.prototype.canSeeSmall = function (thing) {

  /*
   * Function Creature.canSeeSmall
   * Returns true when the creature can see a world object fully
   */

  let projectedSelf = this.getPosition().projected();
  let projectedThing = thing.getPosition().projected();

  // Calculate delta in view (account for elevation projection)
  let dx = Math.abs(projectedSelf.x - projectedThing.x);
  let dy = Math.abs(projectedSelf.y - projectedThing.y);

  // Must be visible in both x and y
  let limitX = Math.ceil(Interface.prototype.SCREEN_WIDTH_MIN / 64) - 2;
  let limitY = Math.ceil(Interface.prototype.SCREEN_HEIGHT_MIN / 64) - 2;
  return (dx < Math.max(1, limitX)) && (dy < Math.max(1, limitY));

}

Creature.prototype.__setLookDirection = function (direction) {

  /*
   * Function Creature.__setLookDirection
   * Sets the direction of the creature to a new direction
   */

  this.__lookDirection = direction;

}

Creature.prototype.__setActiveTextElement = function (message, color) {

  /*
   * Function Creature.__setActiveTextElement
   * Sets a new active text element for the creature
   */

  // Show NPC and Player inforation in the chat channel
  this.__activeTextElement = gameClient.interface.screenElementManager.createTextElement(
    this,
    message,
    color
  );

}

Creature.prototype.__getWalkingFrame = function (frameGroup) {

  /*
   * Function Creature.__getWalkingFrame
   * Returns the walking frame of the creature depending on the movement event
   */

  // Calculate the appropriate frame
  return Math.round((1 - this.getMovingFraction()) * (frameGroup.animationLength - 1));

}

Creature.prototype.__createCharacterElement = function () {

  /*
   * Function Creature.__createCharacterElement
   * Creates a name tag DOM element for the creature
   */

  // We use a sticky text element for the nametag
  this.characterElement = new CharacterElement(this);

  // Add it to the DOM
  gameClient.interface.screenElementManager.add(this.characterElement.element);

  // Make sure to update it directly
  this.characterElement.setHealthFraction(this.getHealthFraction());

}
