"use strict";

const Corpse = requireModule("entities/corpse");
const Monster = requireModule("monster/monster");
const Outfit = requireModule("entities/outfit");
const Player = requireModule("player/player");
const Position = requireModule("utils/position");

function log(module, action, data) {
  try {
    var l = process.gameServer && process.gameServer.logger;
    if (l) l.info(module, action, data);
  } catch (e) {}
}

const {
  CreatureForgetPacket,
  CreatureTeleportPacket,
  CreatureMovePacket,
  EffectMagicPacket,
  PlayerLoginPacket
} = requireModule("network/protocol");

const { checkFirstItems } = requireModule("scripts/first-items");

const CreatureHandler = function () {

  /*
   * Class CreatureHandler
   * The world handler for all creatures
   * 
   * API:
   *
   * CreatureHandler.getCreatureFromId(id): returns a creature by its identifier or none
   *
   */

  // All creatures
  this.__creatureMap = new Map();

  // Reference all connected players
  this.__playerMap = new Map();

  // Explicitly active sectors for action NPCs
  this.sceneNPCs = new Set();

  // Statistics
  this.__numberActiveMonsters = 0;

  // Unique identifier for creatures (first 0xFFFF are reserved)
  this.__UIDCounter = 0xFFFF;

}

CreatureHandler.prototype.assignUID = function () {

  /*
   * Function World.assignUID
   * Assigns an incremented unique identifier to a creature or container (up to 2^32)
   */

  // Simply increment the counter to generate a new unique identifier
  return this.__UIDCounter++;

}

CreatureHandler.prototype.registerCreatureId = function (creature) {

  this.__creatureMap.set(creature.getId(), creature);

}

CreatureHandler.prototype.getCreatureFromId = function (id) {

  /*
   * Function CreatureHandler.getCreatureFromId
   * Returns a creature from the creature map by its identifier
   */

  // A creature with this identifier does not exist
  if (!this.__creatureMap.has(id)) {
    return null;
  }

  return this.__creatureMap.get(id);

}

CreatureHandler.prototype.isCreatureActive = function (creature) {
  return this.__creatureMap.has(creature.getId());
}

CreatureHandler.prototype.forEachCreature = function (callback) {
  this.__creatureMap.forEach(callback);
}

CreatureHandler.prototype.addSummon = function (player, monsterName, position) {

  /*
   * Function CreatureHandler.addSummon
   * Creates a monster as the player's summon and spawns it in the world
   */

  let Monster = requireModule("monster/monster");

  // Check max summons
  if (player.getSummonCount() >= CONFIG.SUMMONS.MAX_PER_PLAYER) {
    player.sendCancelMessage("You can only have up to %s summons at a time.".format(CONFIG.SUMMONS.MAX_PER_PLAYER));
    return null;
  }

  // Look up monster data
  let monsterData = gameServer.database.getMonsterByName(monsterName);

  if (!monsterData) {
    player.sendCancelMessage("A creature with that name does not exist.");
    return null;
  }

  // Create the monster instance with its ID and data
  let monster = new Monster(monsterData.id, monsterData.data);

  // Set the master reference
  monster.master = player;

  // Try to find an available tile near the player first (same as monster AI summons)
  let tile = gameServer.world.findAvailableTile(monster, position);
  let spawnPosition = tile !== null ? tile.position : position;

  // Add to world at the found position (handles registration internally)
  if (!this.addCreaturePosition(monster, spawnPosition)) {
    player.sendCancelMessage("Could not place the summon.");
    return null;
  }

  // Track on player
  player.addSummon(monster);

  // Broadcast level icon at summon position
  monster.broadcast(new EffectMagicPacket(position, CONST.EFFECT.MAGIC.MAGIC_BLUE));

  console.log("Player %s summoned a %s.".format(player.getProperty(CONST.PROPERTIES.NAME), monsterName));

  return monster;

};

CreatureHandler.prototype.removeCreature = function (creature) {

  /*
   * Function CreatureHandler.removeCreature
   * Removes a creature from the world
   */

  // Does not exist
  if (!this.exists(creature)) {
    return;
  }

  // Remove summon from master's tracking
  if (creature.master) {
    if (creature.master.isPlayer()) {
      creature.master.removeSummon(creature);
    } else if (typeof creature.master.removeSummonedCreature === 'function') {
      creature.master.removeSummonedCreature(creature);
    }
  }

  // Clean up any creatures this creature summoned
  if (creature.summonedCreatures && creature.summonedCreatures.length > 0) {
    let clones = creature.summonedCreatures.slice();
    for (let clone of clones) {
      this.removeCreature(clone);
    }
    creature.summonedCreatures = [];
  }

  // Delete the creature from the map
  this.__creatureMap.delete(creature.getId());

  // Clean up
  creature.cleanup();

  creature.broadcast(new CreatureForgetPacket(creature.getId()));

  // Get the current chunk
  let chunk = creature.getChunk();
  let tile = creature.getTile();

  if (chunk === null || tile === null) {
    return;
  }

  chunk.removeCreature(creature);
  tile.removeCreature(creature);
  tile.emit("exit", tile, creature);

  if (creature.isPlayer()) {
    gameServer.questExecutor.handleMoveEventOnTile(tile, creature, "onStepOut");
  }

}

CreatureHandler.prototype.addCreaturePosition = function (creature, position, force) {

  /*
   * Function CreatureHandler.addCreaturePosition
   * Adds a nonexisting creature to the respective position
   */

  // Already exists
  if (this.exists(creature)) {
    return false;
  }

  // Determine the chunk to add the creature to
  let chunk = gameServer.world.getChunkFromWorldPosition(position);
  let tile = gameServer.world.getTileFromWorldPosition(position);

  // Somehow does not exist
  if (chunk === null || tile === null) {
    if (!force) return false;
    return this.__addCreaturePositionForced(creature, position);
  }

  // Monsters cannot be placed in protection zones
  if (creature.isMonster() && tile.isProtectionZone()) {
    if (!force) return false;
  }

  // Add the creature to the lookup map
  this.__creatureMap.set(creature.getId(), creature);

  // Set the position on the creature
  creature.setPosition(position);

  // Add to chunk and tile
  chunk.addCreature(creature);
  if (!tile.addCreature(creature)) {
    if (!force) {
      chunk.removeCreature(creature);
      this.__creatureMap.delete(creature.getId());
      return false;
    }
  }

  // Emit the enter event that can be subscribed to
  tile.emit("enter", tile, creature);

  if (creature.isPlayer()) {
    gameServer.questExecutor.handleMoveEventOnTile(tile, creature, "onStepIn");
  }

  // Add to the chunk
  this.handleChunkChange(creature, null, chunk);

  return true;

}

CreatureHandler.prototype.__addCreaturePositionForced = function (creature, position) {

  this.__creatureMap.set(creature.getId(), creature);
  creature.setPosition(position);
  return true;

}

CreatureHandler.prototype.addPlayer = function (player, position) {

  /*
   * Function World.addPlayer
   * Adds a newly logged in player to the game world
   */

  // Attempt to add the player to the position
  if (!this.addCreaturePosition(player, position)) {
    return false;
  }

  var playerName = player.getProperty(CONST.PROPERTIES.NAME);
  console.log("Player %s logged in.".format(playerName));

  log("world", "player_login", { player: playerName, position: position.toString() });

  gameServer.world.broadcastPacket(new PlayerLoginPacket(playerName));

  // Save a reference to the character name so we can look it up by name
  this.__referencePlayer(player);

  player.broadcast(new EffectMagicPacket(player.position, CONST.EFFECT.MAGIC.TELEPORT));

  // Cooldowns
  player.spellbook.applyCooldowns();

  // Write the last visited message
  if (player.lastVisit) {
    player.sendCancelMessage("Welcome back! Your last visit was at %s.".format(new Date(player.lastVisit).toISOString()));
  }

  return true;

}

CreatureHandler.prototype.tick = function () {

  /*
   * Function CreatureHandler.doCreatureActions
   * Applies all actions that creatures & players take
   */

  // Reset the counter
  this.__numberActiveMonsters = 0;

  // Handle always active NPCs
  this.sceneNPCs.forEach(npc => npc.cutsceneHandler.think());

  // Get the unique set of chunks that are activated by a player
  let activeChunks = gameServer.world.lattice.getActiveChunks(this.getConnectedPlayers());

  // Go over each sector activated by a player and make the creatures (monsters & NPCs) think
  activeChunks.forEach(function (chunk) {

    // Save the total number of active monsters
    this.__numberActiveMonsters += chunk.monsters.size;

    // Every character gets to think in this order
    chunk.players.forEach(player => player.think());
    chunk.npcs.forEach(npc => npc.think());
    chunk.monsters.forEach(monster => {
      try {
        monster.think();
      } catch (e) {
        console.log("Error in monster think (%s): %s".format(monster.getId(), e.message));
      }
    });

  }, this);

}

CreatureHandler.prototype.getConnectedPlayers = function () {

  /*
   * Function CreatureHandler.getConnectedPlayers
   * Returns the set of connected players
   */

  return this.__playerMap;

}

CreatureHandler.prototype.forEachPlayer = function (callback) {

  /*
   * Function CreatureHandler.forEachPlayer
   * Iterates over all connected players and calls callback for each
   */

  this.__playerMap.forEach(callback);

}

CreatureHandler.prototype.__deferencePlayer = function (name) {

  /*
   * Function CreatureHandler.__deferencePlayer
   * Derefences a player from the game world
   */

  // Remove
  return this.__playerMap.delete(name);

}

CreatureHandler.prototype.__referencePlayer = function (player) {

  /*
   * Function CreatureHandler.__referencePlayer
   * References a player in the game world
   */

  return this.__playerMap.set(player.getProperty(CONST.PROPERTIES.NAME), player);

}

CreatureHandler.prototype.createNewPlayer = function (gameSocket, data) {

  /*
   * Function CreatureHandler.createNewPlayer
   * Creates a new player and adds it to the game world
   */

  // Create the class that wraps the data
  let player = new Player(data);

  // Migrate old outfit IDs (128-143, 150) to new IDs (111-124, 62, 69)
  CreatureHandler.OUTFIT_MIGRATION_MAP = CreatureHandler.OUTFIT_MIGRATION_MAP || {
    128: 111, 129: 112, 130: 113, 131: 114, 132: 115, 133: 116, 134: 117,
    136: 118, 137: 119, 138: 120, 139: 121, 140: 122, 141: 123, 142: 124,
    143: 69, 150: 62
  };
  let migrationMap = CreatureHandler.OUTFIT_MIGRATION_MAP;
  let currentOutfit = player.getOutfit();
  if (currentOutfit && migrationMap[currentOutfit.id]) {
    currentOutfit.id = migrationMap[currentOutfit.id];
    player.properties.setProperty(CONST.PROPERTIES.OUTFIT, currentOutfit);
  }
  if (player.properties.availableOutfits) {
    let migrated = new Set();
    player.properties.availableOutfits.forEach(function (id) {
      migrated.add(migrationMap[id] || id);
    });
    player.properties.availableOutfits = migrated;
  }

  // Admin debug account gets max speed, ADMIN vocation, unlimited capacity, and default outfit 75
  if (player.name === "Admin") {
    player.customSpeed = 1000;
    player.setProperty(CONST.PROPERTIES.SPEED, 1000);
    player.setProperty(CONST.PROPERTIES.VOCATION, CONST.VOCATION.ADMIN);
    player.setProperty(CONST.PROPERTIES.CAPACITY_MAX, 5000);
    player.properties.availableOutfits = new Set([
      CONST.LOOKTYPES.MALE.CITIZEN, CONST.LOOKTYPES.MALE.HUNTER,
      CONST.LOOKTYPES.MALE.MAGE, CONST.LOOKTYPES.MALE.KNIGHT,
      CONST.LOOKTYPES.MALE.NOBLEMAN, CONST.LOOKTYPES.MALE.SUMMONER,
      CONST.LOOKTYPES.MALE.WARRIOR,
      CONST.LOOKTYPES.FEMALE.CITIZEN, CONST.LOOKTYPES.FEMALE.HUNTER,
      CONST.LOOKTYPES.FEMALE.MAGE, CONST.LOOKTYPES.FEMALE.KNIGHT,
      CONST.LOOKTYPES.FEMALE.NOBLEMAN, CONST.LOOKTYPES.FEMALE.SUMMONER,
      CONST.LOOKTYPES.FEMALE.WARRIOR,
      CONST.LOOKTYPES.OTHER.ELF, CONST.LOOKTYPES.OTHER.DWARF
    ]);
    player.changeOutfit(new Outfit({
      id: CONST.LOOKTYPES.OTHER.GAMEMASTER,
      details: { head: 0, body: 0, legs: 0, feet: 0 }
    }));
  }

  // Apply cheater skull on login if flagged
  if (player.__cheater) {
    player.__skull = CONST.SKULL.CHEATER;
  }

  // Bed spawn: if the player slept in a bed, remove the sleeper marker
  if (player.__bedPosition) {
    let bedPos;
    switch (player.__bedDirection) {
      case "north": bedPos = player.__bedPosition.south(); break;
      case "south": bedPos = player.__bedPosition.north(); break;
      case "east": bedPos = player.__bedPosition.west(); break;
      case "west": bedPos = player.__bedPosition.east(); break;
    }
    if (bedPos) {
      let bedTile = gameServer.world.getTileFromWorldPosition(bedPos);
      if (bedTile && bedTile.hasItems()) {
        let topItem = bedTile.getTopItem();
        if (topItem) {
          let proto = gameServer.database.getThingPrototype(topItem.id);
          if (proto && proto.properties.type === "bed" && proto.properties.readable === "true") {
            let emptyBedId = parseInt(proto.properties.maleSleeper);
            if (!isNaN(emptyBedId)) {
              let emptyBed = gameServer.database.createThing(emptyBedId);
              if (emptyBed) {
                topItem.replace(emptyBed);
              }
            }
          }
        }
      }
    }
    player.__bedPosition = null;
    player.__bedDirection = null;
  }

  let position = Position.prototype.fromLiteral(data.position);

  let tile = null;

  // When the requested position is the player's temple position,
  // always place directly on it (must bypass NOLOGOUT and BLOCK_SOLID checks)
  // so the player respawns exactly on the temple tile, not at the door
  if (position.equals(player.templePosition)) {
    let templeTile = gameServer.world.getTileFromWorldPosition(position);
    if (templeTile !== null && templeTile.id !== 0) {
      tile = templeTile;
    }
  }

  // Fallback: find an available tile (normal login, invalid temple tile)
  if (tile === null) {
    tile = gameServer.world.findAvailableTile(player, position);
  }

  // Last resort: teleport to the temple position (ignoring NOLOGOUT)
  if (tile === null) {
    tile = gameServer.world.getTileFromWorldPosition(player.templePosition);
  }

  // Temple position is incorrect
  if (tile === null) {
    return gameSocket.closeError("The character temple position is invalid: %s.".format(player.characterStatistics.templePosition.toString()));
  }

  // Add the player
  if (!this.addPlayer(player, tile.position)) {
    return gameSocket.closeError("An unexpected error occurred.");
  }

  // Send initial training timers for equipped training weapons (per-slot)
  let { TrainTimerPacket } = requireModule("network/protocol");
  let WEAPON_SLOTS = [CONST.EQUIPMENT.LEFT, CONST.EQUIPMENT.RIGHT];
  for (let slot of WEAPON_SLOTS) {
    let item = player.containerManager.equipment.peekIndex(slot);
    if (item && item.isTrainingWeapon && item.isTrainingWeapon()) {
      player.write(new TrainTimerPacket(slot, item.getRemainingEquipTime()));
    }
  }

  // Give first-login items if character has never logged in before
  checkFirstItems(player);

  // Broadcast cheater skull to all players after login
  if (player.__cheater) {
    gameServer.world.skullManager.__setSkull(player, CONST.SKULL.CHEATER);
  }

  // Attach a controller to the player
  player.socketHandler.attachController(gameSocket);

}

CreatureHandler.prototype.exists = function (creature) {

  /*
   * Function CreatureHandler.exists
   * Returns true if a creature exists in the world
   */

  return this.__creatureMap.has(creature.getId());

}

CreatureHandler.prototype.removePlayer = function (player) {

  /*
   * Function World.removePlayer
   * Removes a player from the world and completes a cleanup
   */

  // Remove reference to the player
  this.__deferencePlayer(player.getProperty(CONST.PROPERTIES.NAME));

  // Clean up the player references
  player.cleanup();

  // Remove from the game world
  this.removeCreature(player);

}

CreatureHandler.prototype.removePlayerFromWorld = function (gameSocket) {

  /*
   * Function GameServer.__removePlayerFromWorld
   * Closes a game socket and removes the player from the game world
   */

  // If the game socket is not a controller they are spectating
  if (!gameSocket.isController()) {
    return;
  }

  // Despawn all active summons before removing the player
  let player = gameSocket.player;
  let summons = player.getSummons().slice();

  for (let summon of summons) {
    player.removeSummon(summon);
    this.removeCreature(summon);
  }

  var playerName = player.getProperty(CONST.PROPERTIES.NAME);
  log("world", "player_logout", { player: playerName, position: player.position ? player.position.toString() : "unknown" });

  // Dereference player from gameworld
  gameServer.world.sendMagicEffect(player.position, CONST.EFFECT.MAGIC.POFF);
  gameServer.world.writePlayerLogout(playerName);
  this.removePlayer(player);

  player.gameSocket = null;

}

CreatureHandler.prototype.getPlayerByName = function (name) {

  /*
   * Function World.getPlayerByName
   * Returns a reference to the gamesocket by player name
   */

  // Guard against undefined/null name
  if (!name) {
    return null;
  }

  // Always capitalize the name
  let upperName = name.capitalize();

  // Does not exist
  if (!this.__playerMap.has(upperName)) {
    return null;
  }

  // Return the gamesocket
  return this.__playerMap.get(upperName);

}

CreatureHandler.prototype.isPlayerOnline = function (player) {

  /*
   * Function World.isPlayerOnline
   * Returns true if a player with a particular name is online
   */

  return this.getPlayerByName(player.getProperty(CONST.PROPERTIES.NAME)) === player;

}

CreatureHandler.prototype.dieCreature = function (creature) {

  /*
   * Function World.dieCreature
   * Call to kill a creature and remove it from the game world
   */

  // Handle summoned creatures (clones) killed before their master
  if (creature.master) {
    if (creature.master.isPlayer()) {
      // Player summon cleanup
      creature.master.removeSummon(creature);
    } else {
      // Monster summon cleanup (e.g. Squidgy Slime clone)
      if (typeof creature.master.removeSummonedCreature === 'function') {
        creature.master.removeSummonedCreature(creature);
      }
      // POFF effect for clones
      gameServer.world.sendMagicEffect(creature.getPosition(), CONST.EFFECT.MAGIC.POFF);
      this.removeCreature(creature);
      return;
    }
  }

  // Kill all summoned creatures if this monster has any
  if (creature.summonedCreatures && creature.summonedCreatures.length > 0) {
    let clones = creature.summonedCreatures.slice();
    for (let clone of clones) {
      gameServer.world.sendMagicEffect(clone.getPosition(), CONST.EFFECT.MAGIC.POFF);
      this.removeCreature(clone);
    }
    creature.summonedCreatures = [];
  }

  // Generate the corpse (handles XP distribution internally)
  let corpse = creature.createCorpse();

  let position = creature.getPosition();

  // Monsters with noCorpse flag: spawn death field instead of corpse
  if (corpse === null) {
    // Use deathEffect or default to poison
    var deathMagic;
    if (creature.deathEffect === 'fire') {
      deathMagic = CONST.EFFECT.MAGIC.HITBYFIRE;
    } else {
      deathMagic = CONST.EFFECT.MAGIC.POISONAREA;
      gameServer.world.addSplash(2016, position, CONST.FLUID.SLIME);
    }
    gameServer.world.sendMagicEffect(position, deathMagic);
    // Spawn death field item (e.g. poison field for Slime, fire field for Fire Elemental)
    if (creature.deathField) {
      let field = gameServer.database.createThing(creature.deathField);
      if (field !== null) {
        gameServer.world.addTopThing(position, field);
      }
    }
    this.removeCreature(creature);
    return;
  }

  // Normal corpse handling
  gameServer.world.addTopThing(position, corpse);

  // Also add a splash when the creature is killed
  if (corpse instanceof Corpse) {
    gameServer.world.addSplash(2016, position, corpse.getFluidType());
  }

  // Remove the creature from the world
  this.removeCreature(creature);

}

CreatureHandler.prototype.spawnCreature = function (cid, position, player) {

  /*
   * Function CreatureHandler.spawnCreature
   * Spawns a creature to the world from the configured spawn data
   * Returns true on success, false on failure (sends cancel message if player provided)
   */

  let data = gameServer.database.getMonster(cid);

  if (data === null) {
    if (player) player.sendCancelMessage("Monster with ID %s does not exist.".format(cid));
    return false;
  }

  let monster;

  try {
    monster = new Monster(cid, data);
  } catch (e) {
    console.log("Error creating monster %s: %s".format(cid, e.message));
    if (player) player.sendCancelMessage("Failed to create monster: " + e.message);
    return false;
  }

  // Find an available tile for the monster
  let tile = gameServer.world.findAvailableTile(monster, position);

  // If no safe tile found, fallback: try the exact position (admin command override)
  if (tile === null) {
    let exactTile = gameServer.world.getTileFromWorldPosition(position);
    if (exactTile !== null && exactTile.id !== 0 && !exactTile.isBlockSolid()) {
      tile = exactTile;
    } else if (exactTile !== null && exactTile.neighbours) {
      // Fallback to any valid neighbour (including zoned tiles) if exact tile is solid
      for (let neighbour of exactTile.neighbours) {
        if (neighbour.id !== 0 && !neighbour.isBlockSolid()) {
          tile = neighbour;
          break;
        }
      }
    }
  }

  // Impossible to add the creature
  if (tile === null) {
    console.log("Could not find available tile for monster %s at %s.".format(cid, position));
    if (player) player.sendCancelMessage("Could not find available tile nearby.");
    return false;
  }

  // Add the creature to the world at the position (force=true to allow zone tiles for admin spawns)
  if (!this.addCreaturePosition(monster, tile.position, true)) {
    console.log("Could not spawn creature %s at %s (tile occupied or protection zone).".format(cid, tile.position));
    if (player) player.sendCancelMessage("Cannot spawn monster here (occupied or protection zone).");
    return false;
  }

  gameServer.world.sendMagicEffect(tile.position, CONST.EFFECT.MAGIC.TELEPORT);
  return true;

}

CreatureHandler.prototype.__getChunksInRange = function (chunk, distance) {

  /*
   * Function CreatureHandler.__getChunksInRange
   * Returns all chunks within Chebyshev distance of the given chunk
   */

  let result = new Set();
  let queue = [chunk];
  let visited = new Set();
  visited.add(chunk.id);
  let cx = chunk.position.x;
  let cy = chunk.position.y;

  while (queue.length > 0) {
    let current = queue.shift();
    result.add(current);

    current.neighbours.forEach(n => {
      if (!visited.has(n.id) && Math.max(Math.abs(n.position.x - cx), Math.abs(n.position.y - cy)) <= distance) {
        visited.add(n.id);
        queue.push(n);
      }
    });
  }

  return result;

}

CreatureHandler.prototype.handleChunkChange = function (creature, oldChunk, newChunk) {

  /*
   * Function CreatureHandler.handleChunkChange
   * Handles change from one chunk to another
   */

  // No change in chunk was detected: do nothing
  if (oldChunk === newChunk) {
    return;
  }

  let distance = 3;

  // Only old neighbours
  if (newChunk === null) {
    return creature.leaveOldChunks(this.__getChunksInRange(oldChunk, distance));
  }

  // Only new neighbours
  if (oldChunk === null) {
    return creature.enterNewChunks(this.__getChunksInRange(newChunk, distance));
  }

  // Gather all chunks within distance of old and new centers
  let oldSet = this.__getChunksInRange(oldChunk, distance);
  let newSet = this.__getChunksInRange(newChunk, distance);

  // Enter chunks in newSet not in oldSet
  let entering = Array.from(newSet).filter(c => !oldSet.has(c));
  if (entering.length > 0) {
    creature.enterNewChunks(entering);
  }

  // Leave chunks in oldSet not in newSet
  let leaving = Array.from(oldSet).filter(c => !newSet.has(c));
  if (leaving.length > 0) {
    creature.leaveOldChunks(leaving);
  }

}

CreatureHandler.prototype.updateCreaturePosition = function (creature, position) {

  /*
   * Function World.updateCreaturePosition
   * Handles movement of an creature in the world
   */

  // Get the new chunk at the new position
  let oldChunk = gameServer.world.getChunkFromWorldPosition(creature.position);
  let newChunk = gameServer.world.getChunkFromWorldPosition(position);

  // If the new position falls within a new chunk: introduce yourself there
  this.handleChunkChange(creature, oldChunk, newChunk);

  // Unset the old tile and chunk
  let oldTile = gameServer.world.getTileFromWorldPosition(creature.position);
  oldTile.removeCreature(creature);
  oldChunk.removeCreature(creature);

  // Actually update the position
  creature.position = position;

  // Set the new tile and chunk
  let newTile = gameServer.world.getTileFromWorldPosition(position);
  newChunk.addCreature(creature);
  if (!newTile.addCreature(creature)) {
    newChunk.removeCreature(creature);
    creature.position = oldTile.position;

    // If old tile is already occupied (pre-existing stack), try adjacent tiles to break the loop
    let placed = false;
    if (oldTile.hasOwnProperty("creatures") && oldTile.creatures.size > 0) {
      let neighbours = oldTile.getPosition().getNESW();
      for (let i = 0; i < neighbours.length; i++) {
        let neighbourTile = gameServer.world.getTileFromWorldPosition(neighbours[i]);
        if (neighbourTile && (!neighbourTile.hasOwnProperty("creatures") || neighbourTile.creatures.size === 0)) {
          if (neighbourTile.addCreature(creature)) {
            let neighbourChunk = gameServer.world.getChunkFromWorldPosition(neighbours[i]);
            neighbourChunk.addCreature(creature);
            placed = true;
            break;
          }
        }
      }
    }

    if (!placed) {
      oldTile.forceAddCreature(creature);
      oldChunk.addCreature(creature);
    }

    return;
  }

  // Special handling for players entering a new tile
  if (!creature.is("Player")) {
    return;
  }

  // Write an alert to all NPCs in the new sector
  this.__alertNPCEnter(creature);

  // Always check containers after moving
  creature.containerManager.checkContainers();

}

CreatureHandler.prototype.__alertNPCEnter = function (creature) {

  /*
   * Function World.__alertNPCEnter
   * Emits an enter event to the NPC when a creature walks in range
   */

  // Go over all neighbouring sectors and NPCs
  gameServer.world.getSpectatingChunks(creature).forEach(function (chunk) {

    chunk.npcs.forEach(function (npc) {

      if (npc.cutsceneHandler.isInScene()) {
        return;
      }

      // Skip alert on self
      if (creature === npc) {
        return;
      }

      if (npc.conversationHandler.hasSeen(creature)) {
        return;
      }

      // Within range 6 emit an enter event
      if (npc.isWithinRangeOf(creature, 5)) {
        return npc.conversationHandler.enterAlert(creature);
      }

    });

  });

}

CreatureHandler.prototype.teleportCreature = function (creature, position) {

  /*
   * Function Creature.teleportCreature
   * Teleports a creature to a particular world position
   */

  let tile = gameServer.world.getTileFromWorldPosition(position);
  let oldTile = gameServer.world.getTileFromWorldPosition(creature.position);

  // Not possible
  if (tile === null) {
    return false;
  }

  // Find the destination through other portals etc..
  let destination = gameServer.world.lattice.findDestination(creature, tile);

  if (destination === null) {
    destination = creature;
  }

  // Try to set the position: it may fail however
  this.updateCreaturePosition(creature, destination.position);

  destination.broadcast(new CreatureTeleportPacket(creature.getId(), destination.getPosition()));

  // Clear movement buffer and unlock movement lock
  if (creature.isPlayer() && creature.movementHandler) {
    creature.movementHandler.__setMoveBuffer(null);
    if (creature.movementHandler.__moveLock.isLocked()) {
      creature.movementHandler.__moveLock.unlock();
    }
  }

  creature.emit("move", tile);
  oldTile.emit("exit", oldTile, creature);
  tile.emit("enter", tile, creature);

  if (creature.isPlayer()) {
    gameServer.questExecutor.handleMoveEventOnTile(tile, creature, "onStepIn");
    gameServer.questExecutor.handleMoveEventOnTile(oldTile, creature, "onStepOut");
  }

  // Success
  return true;

}

CreatureHandler.prototype.moveCreature = function (creature, position) {

  /*
   * Function CreatureHandler.moveCreature
   * Moves a creature to a new position
   */

  // Get the chunk the creature is moving to
  let chunk = gameServer.world.getChunkFromWorldPosition(position);
  let tile = gameServer.world.getTileFromWorldPosition(position);

  // Not possible
  if (tile === null) {
    return false;
  }

  // Find the destination for the creature (e.g. through portals)
  let destination = gameServer.world.lattice.findDestination(creature, tile);
  if (destination === null) {
    destination = creature;
  }

  // Capture old tile before any mutations
  let oldTile = gameServer.world.getTileFromWorldPosition(creature.position);

  // General movement validation: reject movement onto tiles with blocking items
  let destTile = gameServer.world.getTileFromWorldPosition(destination.position);
  if (destTile !== null && destTile !== oldTile) {
    if (destTile.isBlockSolid() || (destTile.hasItems() && destTile.itemStack.isBlockSolid())) {
      // Process quest actions on blocked tiles (bridge, entrance, portal, etc.)
      if (creature.isPlayer && creature.isPlayer()) {
        this.__handleBlockedTileQuest(creature, destTile);
      }
      return false;
    }
    // Allow stepping up to 1 height level per move (stairs-like behavior up to 4)
    let heightDiff = destTile.countHeight() - oldTile.countHeight();
    if (heightDiff > 1) {
      return false;
    }
  }

  // Monsters cannot move into protection zones — hard stop as last line of defense
  if (creature.isMonster && creature.isMonster()) {
    if (destTile !== null && typeof destTile.isProtectionZone === 'function' && destTile.isProtectionZone()) {
      return false;
    }
  }

  // Try to set the position (it may fail)
  this.updateCreaturePosition(creature, destination.position);

  // Calculate step duration for smooth client animation
  let stepDuration = destTile ? creature.getStepDuration(destTile.getFriction()) : 1;

  // Broadcast the movement packet
  creature.broadcast(new CreatureMovePacket(creature.getId(), destination.position, stepDuration));

  // Emit enter/exit events on the tiles
  tile.emit("enter", tile, creature);
  oldTile.emit("exit", oldTile, creature);

  if (creature.isPlayer()) {
    gameServer.questExecutor.handleMoveEventOnTile(tile, creature, "onStepIn");
    gameServer.questExecutor.handleMoveEventOnTile(oldTile, creature, "onStepOut");
  }

  // Check for magic fields and apply damage
  if (tile.hasItems()) {
    tile.itemStack.applyFieldDamage(creature);
  }

  // Trap logic: open trap (2579) triggers when stepped on
  if (tile.hasItems()) {
    for (const item of tile.getItems()) {
      if (item.id === 2579) {
        const newTrap = gameServer.database.createThing(2578);
        item.replace(newTrap);
        if (!creature.isPlayer()) {
          const damage = Math.floor(Math.random() * 30) + 1;
          creature.decreaseHealth(null, damage);
          gameServer.world.sendMagicEffect(tile.position, CONST.EFFECT.MAGIC.ENERGYHIT);
        }
        break;
      }
    }
  }

  return true;

}

CreatureHandler.prototype.__handleBlockedTileQuest = function (creature, destTile) {
  const aid = destTile.actionId;
  if (!aid) return;
  const questAction = gameServer.questDataLoader.getByActionId(aid);
  if (!questAction) return;
  const moveTypes = ["bridge", "entrance", "portal", "wall", "seal", "moveEvent", "tile", "exit", "reward", "switch", "basin"];
  if (!moveTypes.includes(questAction.type)) return;
  const conditions = questAction.conditions || [];
  if (!gameServer.questExecutor.evaluateConditions(conditions, creature, destTile, null)) return;
  gameServer.questExecutor.executeEffects(questAction.effects || [], creature, destTile, null);
  if (questAction.teleport) {
    let toPos = this.__resolveBlockedTileTeleport(questAction.teleport, destTile);
    if (toPos) {
      this.teleportCreature(creature, toPos);
      if (questAction.magicEffect !== undefined) {
        gameServer.world.sendMagicEffect(creature.position, questAction.magicEffect);
      }
    }
  }
}

CreatureHandler.prototype.__resolveBlockedTileTeleport = function (teleport, tile) {
  if (teleport.to) {
    return new Position(teleport.to.x, teleport.to.y, teleport.to.z);
  }
  if (teleport.offsetX !== undefined || teleport.offsetY !== undefined) {
    return new Position(
      tile.position.x + (teleport.offsetX || 0),
      tile.position.y + (teleport.offsetY || 0),
      teleport.z !== undefined ? teleport.z : tile.position.z
    );
  }
  return null;
}

CreatureHandler.prototype.addCreatureSpawn = function (creature, literal) {

  if (literal === null) {
    return;
  }

  let position = Position.prototype.fromLiteral(literal);

  creature.position = creature.spawnPosition = position;
  if (!this.addCreaturePosition(creature, position)) {
    if (!this.addCreaturePosition(creature, position, true)) {
      console.log("Could not force spawn %s at %s.".format(creature.getProperty(CONST.PROPERTIES.NAME), position));
    }
  }

}

module.exports = CreatureHandler;
