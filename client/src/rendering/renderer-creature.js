Renderer.prototype.__renderDeferred = function (tile) {

  if (tile.__deferredCreatures.size === 0) {
    return;
  }

  let wasBatching = this.__batchingCreatures;
  this.__batchingCreatures = false;

  for (let creature of tile.__deferredCreatures) {
    let creatureTile = gameClient.world.getTileFromWorldPosition(creature.__position);
    this.__renderCreature(creatureTile, creature, true);
  }

  this.__batchingCreatures = wasBatching;

  tile.__deferredCreatures.clear();

}

Renderer.prototype.__renderCreature = function (tile, creature, deferred) {

  if (!gameClient.player.canSee(creature)) {
    return;
  }

  let player = gameClient.player;
  let cp = creature.getPosition();
  let pp = player.getPosition();
  let pz = pp.z % 8;
  let cz = cp.z % 8;
  let cmo = creature.getMoveOffset();

  this.__scratchPos.x = this.playerTileOffsetX + player.getMoveOffset().x + (cp.x + cz) - (pp.x + pz) - cmo.x;
  this.__scratchPos.y = this.playerTileOffsetY + player.getMoveOffset().y + (cp.y + cz) - (pp.y + pz) - cmo.y;

  if (this.__shouldDefer(tile, creature) && !deferred) {
    return this.__defer(tile, creature);
  }

  if (this.__batchingCreatures) {
    this.__creatureRenderQueue.push({ creature, tile, deferred });
    return;
  }

  let distX = Math.abs((cp.x + cz) - (pp.x + pz));
  let distY = Math.abs((cp.y + cz) - (pp.y + pz));
  let maxDist = Math.max(distX, distY);
  let isDistant = maxDist > 16;
  let isVeryDistant = maxDist > 20;

  if (!isDistant) {
    this.__renderCreatureAnimationsBelow(creature);
  }

  this.__scratchPos.x -= tile.__renderElevation;
  this.__scratchPos.y -= tile.__renderElevation;

  var spriteOffsetX = creature.type === 1 ? 0.21875 : 0;
  var spriteOffsetY = creature.type === 1 ? 0.21875 : 0;

  if (creature.hasCondition(ConditionManager.prototype.INVISIBLE)) {
    this.screen.drawSprite(LoopedAnimation.prototype.MAGIC_BLUE, {
      x: this.__scratchPos.x + spriteOffsetX,
      y: this.__scratchPos.y + spriteOffsetY
    }, 32);
    return;
  }

  this.screen.drawCharacter(creature, {
    x: this.__scratchPos.x + spriteOffsetX,
    y: this.__scratchPos.y + spriteOffsetY
  }, 32, 0.25);

  if (gameClient.player.isCreatureTarget(creature)) {
    this.__combatRects.push({ x: this.__scratchPos.x, y: this.__scratchPos.y, color: Interface.prototype.COLORS.RED });
  }

  creature.__renderElevation = 0;

  if (!isDistant) {
    this.__renderCreatureAnimationsAbove(creature);
  }

  if (!isVeryDistant) {
    this.__renderSkull(creature, this.__scratchPos);
  }

  if (!isVeryDistant) {
    this.__renderShield(creature, this.__scratchPos);
  }

  if (!isVeryDistant) {
    let px, py;
    if (creature.type === CONST.TYPES.NPC
        && gameClient.player.getPosition().z === creature.getPosition().z) {
      px = Math.round(32 * this.__scratchPos.x) + 22;
      py = Math.round(32 * this.__scratchPos.y) - 18;
      if (creature.hasTrade) this.__npcIconQueue.push({ icon: this.npcTradeIcon, x: px, y: py });
      if (creature.hasBank) this.__npcIconQueue.push({ icon: this.npcBankIcon, x: px, y: py });
      if (creature.hasTravel) this.__npcIconQueue.push({ icon: this.npcTravelIcon, x: px, y: py });
      if (creature.hasSpell) this.__npcIconQueue.push({ icon: this.npcSpellIcon, x: px, y: py });
    }
    if (creature === gameClient.player && gameClient.interface && gameClient.interface.channelManager) {
      if (!gameClient.interface.channelManager.isDisabled()) {
        px = Math.round(32 * this.__scratchPos.x) + 22;
        py = Math.round(32 * this.__scratchPos.y) - 18;
        this.__npcIconQueue.push({ icon: this.typingIcon, x: px, y: py });
      }
    }
  }

}

Renderer.prototype.__defer = function (tile, creature) {

  let deferTile = this.__getDeferTile(tile, creature);

  if (deferTile !== null) {
    deferTile.__deferredCreatures.add(creature);
  }

}

Renderer.prototype.__renderSkull = function (creature, renderPosition) {

  if (creature.skull === CONST.SKULL.NONE) {
    return;
  }

  let img = this.skullImages[creature.skull];
  if (!img || !img.complete) {
    return;
  }

  let pixelX = Math.round(32 * renderPosition.x) + 10;
  let pixelY = Math.round(32 * renderPosition.y) - 15;

  this.screen.drawImage(img, pixelX, pixelY);

}

Renderer.prototype.__renderShield = function (creature, renderPosition) {

  if (creature.shield === CONST.SHIELD.NONE) {
    return;
  }

  let img = this.shieldImages[creature.shield];
  if (!img || !img.complete) {
    return;
  }

  this.screen.setImageSmoothing(false);

  let pixelX = Math.round(32 * renderPosition.x) + 10;
  let pixelY = Math.round(32 * renderPosition.y) - 4;

  this.screen.drawImage(img, pixelX, pixelY, 11, 11);

}

Renderer.prototype.__renderNpcIcon = function (creature, renderPosition, iconImage) {

  if (!iconImage || !iconImage.complete) {
    return;
  }

  let pixelX = Math.round(32 * renderPosition.x) + 22;
  let pixelY = Math.round(32 * renderPosition.y) - 18;

  this.screen.drawImage(iconImage, pixelX, pixelY);

}

Renderer.prototype.__renderNpcIcons = function () {

  for (let entry of this.__npcIconQueue) {
    if (entry.icon && entry.icon.complete) {
      this.screen.drawImage(entry.icon, entry.x, entry.y);
    }
  }
  this.__npcIconQueue.length = 0;

}

Renderer.prototype.__getDeferTile = function (tile, creature) {

  if (creature.__lookDirection === CONST.DIRECTION.NORTH_EAST) {
    return gameClient.world.getTileFromWorldPosition(creature.getPosition().south());
  } else if (creature.__lookDirection === CONST.DIRECTION.SOUTH_WEST) {
    return gameClient.world.getTileFromWorldPosition(creature.getPosition().east());
  } else {
    return gameClient.world.getTileFromWorldPosition(creature.__previousPosition);
  }

}

Renderer.prototype.__shouldDefer = function (tile, creature) {

  if (creature.__teleported) {
    return false;
  }

  if (!creature.isMoving()) {
    return false;
  }

  if (creature.getPosition().z !== creature.__previousPosition.z) {
    return false;
  }

  if ((creature.__lookDirection === CONST.DIRECTION.NORTH || creature.__lookDirection === CONST.DIRECTION.WEST || creature.__lookDirection === CONST.DIRECTION.NORTH_WEST)) {
    if (!creature.__previousPosition.equals(tile.getPosition())) {
      return true;
    }
  }

  if ((creature.__lookDirection === CONST.DIRECTION.NORTH_EAST)) {
    if (!creature.__previousPosition.equals(tile.getPosition().west())) {
      return true;
    }
  }

  if ((creature.__lookDirection === CONST.DIRECTION.SOUTH_WEST)) {
    if (!creature.__previousPosition.equals(tile.getPosition().north())) {
      return true;
    }
  }

  return false;

}

Renderer.prototype.__renderCreatureAnimationsAbove = function (creature) {

  let player = gameClient.player;
  let cp = creature.getPosition();
  let pp = player.getPosition();
  let distX = Math.abs((cp.x) - (pp.x));
  let distY = Math.abs((cp.y) - (pp.y));
  let maxDist = Math.max(distX, distY);

  if (maxDist > 20) {
    return;
  }

  creature.__animations.forEach(function (animation) {
    if (animation.constructor.name !== "BoxAnimation") {
      this.__renderAnimation(animation, creature);
    }
  }, this);

}

Renderer.prototype.__renderCreatureAnimationsBelow = function (creature) {

  let player = gameClient.player;
  let cp = creature.getPosition();
  let pp = player.getPosition();
  let distX = Math.abs((cp.x) - (pp.x));
  let distY = Math.abs((cp.y) - (pp.y));
  let maxDist = Math.max(distX, distY);

  if (maxDist > 20) {
    return;
  }

  creature.__animations.forEach(function (animation) {
    if (animation.constructor.name === "BoxAnimation") {
      this.__renderAnimation(animation, creature);
    }
  }, this);

}
