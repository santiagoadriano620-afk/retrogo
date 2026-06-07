const World = function (width, height, depth) {

  /*
   * Class World
   * Container for the game world
   *
   * Public API:
   *
   * isValidWorldPosition - returns TRUE if the world position is valid and falls within the world bounds
   * getChunkFromWorldPosition - returns the chunk that belongs to a given world position
   *
   */

  this.width = width;
  this.height = height;
  this.depth = depth;

  // Determine the number of sectors on the map
  this.nSectorsWidth = this.width / Chunk.prototype.WIDTH;
  this.nSectorsHeight = this.height / Chunk.prototype.HEIGHT;
  this.nSectorsDepth = this.depth / Chunk.prototype.DEPTH;

  // Reference to all active creatures
  this.activeCreatures = new Object();
  this.chunks = new Array();

  // Client side pathfinder
  this.pathfinder = new Pathfinder();
  this.clock = new Clock();

  // Deferred battle list refresh (avoids DOM work during input phase)
  this.__battleListDirty = false;
  this.__lastBattleRefresh = 0;

}

World.prototype.handleSelfTeleport = function () {

  /*
   * Function GameClient.handleSelfTeleport
   * Handles teleport of the self player
   */

  // Set some state
  gameClient.player.__teleported = true;
  gameClient.player.__serverWalkConfirmation = true;
  gameClient.world.checkEntityReferences();
  gameClient.world.checkChunks();
  gameClient.renderer.__collectTilesOnly();
  gameClient.renderer.__tileCacheNeedsRebuild = true;
  gameClient.renderer.__skipNextLightFrame = true;
  gameClient.renderer.minimap.setCenter();

  // Cancel any existing movement event (pre-move) and unlock immediately
  if (gameClient.player.__movementEvent !== null) {
    gameClient.player.__movementEvent.cancel();
  }
  gameClient.player.__movementEvent = gameClient.eventQueue.addEvent(gameClient.player.unlockMovement.bind(gameClient.player), 0);

}

World.prototype.__refreshNeighbours = function (position) {
  let tile = this.getTileFromWorldPosition(position);
  if (tile === null) return;
  let positions = [
    position, position.west(), position.north(), position.east(), position.south(),
    position.northwest(), position.southwest(), position.northeast(), position.southeast()
  ];
  positions.forEach(function (pos) {
    let t = this.getTileFromWorldPosition(pos);
    if (t === null) return;
    t.neighbours = [];
    [pos.west(), pos.north(), pos.east(), pos.south(),
     pos.northwest(), pos.southwest(), pos.northeast(), pos.southeast()].forEach(function (np) {
      let nt = this.getTileFromWorldPosition(np);
      if (nt !== null) t.neighbours.push(nt);
    }, this);
  }, this);
}

World.prototype.handleTransformTile = function (packet) {

  /*
   * Function GameClient.handleTransformTile
   * Handles an incoming event to change a tile to another identifier
   */

  let tile = this.getTileFromWorldPosition(packet.position);

  if (tile === null) {
    return;
  }

  tile.id = packet.id;

  // Refresh neighbour references so pathfinder can discover/reach the tile
  this.__refreshNeighbours(packet.position);

  // Force background cache rebuild so the tile sprite updates instantly
  gameClient.renderer.__tileCacheNeedsRebuild = true;

}


World.prototype.addCreature = function (creature) {

  /*
   * Function GameClient.addCreature
   * Adds a creature to the gameworld
   */

  let tile = this.getTileFromWorldPosition(creature.getPosition());

  if (tile === null) {
    return;
  }

  tile.addCreature(creature);

}

World.prototype.checkEntityReferences = function () {

  /*
   * Function GameClient.checkEntityReferences
   * Called when the server moves the player and references to entities outside of our sector can be dropped by the player
   */

  // Player moves: drop references to entities not in sector
  var playerChunk = gameClient.player ? gameClient.player.getChunk() : null;
  if (!playerChunk) return;

  Object.values(this.activeCreatures).forEach(function (activeCreature) {
    if (!activeCreature) return;

    // Never drop self
    if (gameClient.isSelf(activeCreature)) {
      return;
    }

    var creatureChunk = activeCreature.getChunk();
    if (!creatureChunk) return;

    // Remove reference to the creature
    if (!playerChunk.isWithin(creatureChunk, 3)) {
      gameClient.networkManager.packetHandler.handleEntityRemove(activeCreature.id);
    }

  }, this);

}

World.prototype.handleCreatureMove = function (id, position, speed) {

  /*
   * Function World.handleCreatureMove
   * Handles movement of a creature with a particular identifier to position
   */

  // Set the confirmation of the walking
  gameClient.player.__serverWalkConfirmation = false;

  return this.__handleCreatureMove(id, position, speed);

}

World.prototype.__handleCreatureMove = function (id, position, speed) {

  /*
   * Function World.handleCreatureMove
   * Handles movement of a creature with a particular identifier to position
   */

  // Fetch the creature
  let creature = this.getCreature(id);

  if (creature === null) {
    return false;
  }

  // Do nothing if the creature is already on that position
  if (position.equals(creature.getPosition())) {
    return false;
  }

  let fromTile = this.getTileFromWorldPosition(creature.getPosition());

  if (fromTile !== null) {
    fromTile.removeCreature(creature);
  }

  let tile = this.getTileFromWorldPosition(position);

  if (tile === null) {
    return false;
  }

  tile.addCreature(creature);

  // Actually update the actual creature position
  creature.moveTo(position, speed);

  // Check ambient sound
  if (creature === gameClient.player) {
    gameClient.player.setAmbientSound();
    this.__battleListDirty = true;
  } else {
    gameClient.interface.windowManager.getWindow("battle-window").updateCreature(creature);
  }

  return true;

}

World.prototype.createCreature = function (id, creature) {

  /*
   * Function World.createCreature
   * Creates a creature by adding it to cache
   */

  // Prevent duplication: remove old creature references before replacing
  if (this.activeCreatures.hasOwnProperty(id)) {
    let oldCreature = this.activeCreatures[id];
    let oldTile = this.getTileFromWorldPosition(oldCreature.getPosition());
    if (oldTile !== null) {
      oldTile.removeCreature(oldCreature);
    }
    if (gameClient.player && gameClient.player.__target === oldCreature) {
      gameClient.player.setTarget(creature);
    }
    oldCreature.remove();
    this.activeCreatures[id] = creature;
    this.addCreature(creature);
    return gameClient.interface.windowManager.getWindow("battle-window").addCreature(creature);
  }

  // Set and add
  this.activeCreatures[id] = creature;
  this.addCreature(creature);

  return gameClient.interface.windowManager.getWindow("battle-window").addCreature(creature);

}

World.prototype.updateBattleListVisibility = function () {

  /*
   * Function World.updateBattleListVisibility
   * Updates the visibility of all creatures in the battle list
   * DEFERRED: called once per frame at most; set flag via __battleListDirty
   */

  let battleWindow = gameClient.interface.windowManager.getWindow("battle-window");
  if (!battleWindow) {
    return;
  }

  battleWindow.refresh();

}

World.prototype.getCreature = function (id) {

  /*
   * Function GameClient.getCreature
   * Returns a creature from the list by id of active creatures or null
   */

  // Unavailable
  if (!this.activeCreatures.hasOwnProperty(id)) {
    return null;
  }

  return this.activeCreatures[id];

}

World.prototype.checkChunks = function () {

  /*
   * Function World.checkChunks
   * Will drop buffered chunks that do not need to be kept in memory
   */

  // Keep chunks within 8 chunks distance for pre-rendering buffer
  var playerChunk = gameClient.player ? gameClient.player.getChunk() : null;
  if (!playerChunk) return;
  this.chunks = this.chunks.filter(function (chunk) {
    return playerChunk.isWithin(chunk, 3);
  });

}

World.prototype.referenceTileNeighbours = function () {

  /*
   * Function World.referenceTileNeighbours
   * Saves a reference to neighbouring tiles for client-side pathfinding
   */

  this.chunks.forEach(function (chunk) {

    chunk.tiles.forEach(function (tile) {

      tile.neighbours = new Array();

      let tiles = new Array(
        tile.getPosition().west(),
        tile.getPosition().north(),
        tile.getPosition().east(),
        tile.getPosition().south(),
        tile.getPosition().northwest(),
        tile.getPosition().southwest(),
        tile.getPosition().northeast(),
        tile.getPosition().southeast()
      );

      // Add the neighbouring chunks
      tiles.map(this.getTileFromWorldPosition, this).forEach(function (x) {

        if (x === null) {
          return;
        }

        tile.neighbours.push(x);

      });

    }, this);
  }, this);

}

World.prototype.isValidWorldPosition = function (worldPosition) {

  /*
   * Function World.isValidWorldPosition
   * Returns whether the given position is inside the world bounds
   */

  return worldPosition.x >= 0 &&
    worldPosition.y >= 0 &&
    worldPosition.z >= 0 &&
    worldPosition.x < this.width &&
    worldPosition.y < this.height &&
    worldPosition.z < this.depth;

}

World.prototype.findChunk = function (position) {

  /*
   * Function World.findChunk
   * Attempts to find a chunk in the known chunk list (not optimised)
   */

  let index = this.getChunkIndex(this.getChunkPositionFromWorldPosition(position));

  // Linear search over all known chunks
  for (let i = 0; i < this.chunks.length; i++) {
    if (index === this.chunks[i].id) {
      return this.chunks[i];
    }
  }

  return null;

}

World.prototype.getChunkFromWorldPosition = function (position) {

  /*
   * Function World.getChunkFromWorldPosition
   * Returns whether the given position is inside the world bounds
   */

  if (position === null) return null;

  // Confirm the world position is valid
  if (!this.isValidWorldPosition(position)) {
    return null;
  }

  // Delegate to the chunk lattice
  return this.findChunk(position);

}

World.prototype.getChunkPositionFromWorldPosition = function (worldPosition) {

  /*
   * Function World.getChunkPositionFromWorldPosition
   * Returns the sector position based on the world position
   */

  // Project the z-component tile on the main floor
  let x = worldPosition.x + (worldPosition.z % Chunk.prototype.DEPTH);
  let y = worldPosition.y + (worldPosition.z % Chunk.prototype.DEPTH);

  // Simple division to get the sector x, y
  let sx = (x / Chunk.prototype.WIDTH) | 0;
  let sy = (y / Chunk.prototype.HEIGHT) | 0;

  // The z-component is either (0) underground or (1) above ground
  let sz = worldPosition.z < 8 ? 0 : 1;

  // Calculate the index
  return new Position(sx, sy, sz);

}

World.prototype.getChunkIndex = function (sectorPosition) {

  /*
   * Function World.getChunkIndex
   * Returns the sector index from a chunk position
   */

  return sectorPosition.x +
    (sectorPosition.y * this.nSectorsWidth) +
    (sectorPosition.z * this.nSectorsWidth * this.nSectorsHeight);

}

World.prototype.isTopTile = function (position) {

  /*
   * Function World.isTopTile
   * Returns whether the given position is inside the world bounds
   */

  // Get the top tile at a position
  for (let z = position.z + 1; z < position.z + 8; z++) {
    let tile = this.getTileFromWorldPosition(new Position(position.x, position.y, z));
    if (tile === null || tile.id !== 0) {
      return false;
    }
  }

  return true;

}

World.prototype.getTopTileFromWorldPosition = function (position) {

  /*
   * Function World.getTopTileFromWorldPosition
   * Returns the top tile based of a position
   */

  // The sector of the tile
  let chunk = this.getChunkFromWorldPosition(position);

  if (chunk === null) {
    return null;
  }

  // Return the top of the tile within the sector
  return chunk.getFirstTileFromTop(position);

}

World.prototype.targetMonster = function (monsters) {

  /*
   * Function World.targetMonster
   * Targets the top creature from a monster set, or un-targets if already targeted
   */

  // Get the next monster
  let monster = monsters.values().next().value;

  // You cannot target yourself
  if (monster === gameClient.player) {
    return;
  }

  // NPCs cannot be attacked
  if (monster.type === 2) {
    return gameClient.interface.notificationManager.setCancelMessage("You may not attack a NPC.");
  }

  // Only monsters can be attacked
  if (monster.constructor.name !== "Creature") {
    return gameClient.interface.notificationManager.setCancelMessage("You cannot attack this creature.");
  }

  // If already targeting this monster, untarget it
  if (gameClient.player.isCreatureTarget(monster)) {
    gameClient.player.setTarget(null);
    gameClient.send(new TargetPacket(0));
    return;
  }

  gameClient.player.setTarget(monster);
  gameClient.send(new TargetPacket(monster.id));

}

World.prototype.getTileFromWorldPosition = function (worldPosition) {

  /*
   * Function World.getTileFromWorldPosition
   * Returns tile based on a world position
   */

  // First get the chunk
  let chunk = this.getChunkFromWorldPosition(worldPosition);

  if (chunk === null) {
    return null;
  }

  // Get the tile from within the chunk
  return chunk.getTileFromWorldPosition(worldPosition);

}

World.prototype.getItemFromPosition = function (position) {

  /*
   * Function World.getItemFromPosition
   * Returns the top item at a particular world position
   */

  let tile = this.getTileFromWorldPosition(position);

  if (tile === null) {
    return null;
  }

  return tile.peekItem(0xFF);

}

World.prototype.hasLineOfSight = function (fromPos, toPos) {

  /*
   * Function World.hasLineOfSight
   * Returns true if there is no item blocking projectiles between two positions
   */

  let dx = toPos.x - fromPos.x;
  let dy = toPos.y - fromPos.y;
  let steps = Math.max(Math.abs(dx), Math.abs(dy));

  for (let i = 1; i < steps; i++) {
    let fraction = i / steps;
    let x = Math.round(fraction * dx);
    let y = Math.round(fraction * dy);
    let tile = this.getTileFromWorldPosition(new Position(
      fromPos.x + x,
      fromPos.y + y,
      fromPos.z
    ));
    if (tile === null) continue;
    if (tile.hasBlockProjectile()) return false;
  }

  return true;

}

World.prototype.addItem = function (position, item, slot) {

  /*
   * Function World.addItem
   * Adds an item to the game world
   */

  let tile = this.getTileFromWorldPosition(position);

  if (tile === null) {
    return;
  }

  tile.addItem(item, slot);

}
