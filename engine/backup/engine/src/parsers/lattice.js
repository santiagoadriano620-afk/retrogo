"use strict";

const path = require("path");
const Chunk = requireModule("entities/chunk");
const Pathfinder = requireModule("utils/pathfinder");
const Position = requireModule("utils/position");

const Lattice = function (size) {

  /*
   * Class Lattice
   * Container for the chunk lattice that blocks all chunks together
   *
   * API:
   *
   * Lattice.createChunk(position) - Creates a chunk at the given position
   * Lattice.findDestination(tile) - Returns the destination of a tile (accounts for floor changes and teleporters)
   * Lattice.getActiveChunks(players) - returns the currently active chunks that need to be updated
   * Lattice.getChunkFromWorldPosition(position) - returns the chunk that belongs to a world position
   * Lattice.getTileFromWorldPosition(position) - returns the tile that belongs to a world position
   * Lattice.setReferences() - Creates the lattice by setting all references to each other
   * Lattice.withinBounds(position) - Returns true if the position is within the configured world bounds
   *
   */

  // Size of the world
  this.width = size.x;
  this.height = size.y;
  this.depth = size.z;

  // Determine the number of chunks on the map on each axis
  this.nChunksWidth = this.width / Chunk.prototype.WIDTH;
  this.nChunksHeight = this.height / Chunk.prototype.HEIGHT;
  this.nChunksDepth = this.depth / Chunk.prototype.DEPTH;

  // Create an A* pathfinder class inside the lattice
  this.pathfinder = new Pathfinder();
  this.__workerPool = null;

  // Create the chunks and tiles and save reference memory
  this.__chunksPositive = new Map();
  this.__chunksNegative = new Map();

}

Lattice.prototype.initWorkerPool = function () {
  const config = global.CONFIG && CONFIG.PERFORMANCE && CONFIG.PERFORMANCE.WORKER_POOL;
  if (!config || !config.ENABLED) return null;
  if (this.__workerPool) return null;

  try {
    const os = require("os");
    const WorkerPool = require(path.join(__dirname, "..", "..", "lib", "worker-pool"));
    const cpuCores = os.cpus().length;
    const maxWorkers = config.MAX_WORKERS > 0 ? config.MAX_WORKERS : Math.max(1, cpuCores - 1);

    this.__workerPool = new WorkerPool("workers/pathfinder-worker.js", {
      maxWorkers,
    });

    return { cpuCores, maxWorkers };
  } catch (e) {
    if (typeof logger !== "undefined" && logger) logger.warn("Worker pool init failed: " + e.message);
    return null;
  }
};

Lattice.prototype.findPath = function (creature, fromPosition, toPosition, mode) {

  /*
   * Function Lattice.findPath
   * Finds a path between two positions in the lattice
   */

  if (fromPosition === null || toPosition === null) {
    return new Array();
  }

  // Same position
  if (fromPosition.equals(toPosition)) {
    return new Array();
  }

  // Not on the same floor
  if (!fromPosition.isSameFloor(toPosition)) {
    return new Array();
  }

  if (mode === Pathfinder.prototype.ADJACENT && fromPosition.besides(toPosition)) {
    return new Array();
  }

  // Get the tiles
  let fromTile = this.getTileFromWorldPosition(fromPosition);
  let toTile = this.getTileFromWorldPosition(toPosition);

  // No path between non-existing tiles
  if (fromTile === null || toTile === null) {
    return new Array();
  }

  // If the target is blocked do not even attempt pathfinding
  if (mode === Pathfinder.prototype.EXACT && creature.isTileOccupied(toTile)) {
    return new Array();
  }

  if (!toTile.neighbours) {
    return new Array();
  }

  // Simple extra heuristic if the target is blocked in every direction do not begin search, otherwise the entire field is searched
  if (toTile.neighbours.every(x => creature.isTileOccupied(x))) {
    return new Array();
  }

  // Delegate
  return this.pathfinder.search(creature, fromTile, toTile, mode);

}

Lattice.prototype.__extractGrid = function (z) {

  /*
   * Function Lattice.__extractGrid
   * Builds a flat walkability grid for a given floor level (z) to send to workers
   */

  const grid = new Float64Array(this.width * this.height);

  for (let x = 0; x < this.width; x++) {
    for (let y = 0; y < this.height; y++) {
      const tile = this.getTileFromWorldPosition(new Position(x, y, z));
      if (tile && tile.neighbours) {
        grid[y * this.width + x] = tile.getWeight(null) || 1;
      }
    }
  }

  return grid;

}

Lattice.prototype.findPathAsync = function (creature, fromPosition, toPosition, mode) {

  /*
   * Function Lattice.findPathAsync
   * Async pathfinding via worker pool — returns Promise<Position[]>
   */

  if (!this.__workerPool || !fromPosition || !toPosition) {
    return Promise.resolve(this.findPath(creature, fromPosition, toPosition, mode));
  }

  const z = fromPosition.z;

  // Build occupied set for the worker
  const occupied = [];
  const region = { minX: Math.max(0, fromPosition.x - 24), minY: Math.max(0, fromPosition.y - 24),
                   maxX: Math.min(this.width - 1, fromPosition.x + 24), maxY: Math.min(this.height - 1, fromPosition.y + 24) };

  for (let x = region.minX; x <= region.maxX; x++) {
    for (let y = region.minY; y <= region.maxY; y++) {
      const tile = this.getTileFromWorldPosition(new Position(x, y, z));
      if (tile && creature.isTileOccupied(tile)) {
        occupied.push(x + "," + y);
      }
    }
  }

  const width = region.maxX - region.minX + 1;
  const height = region.maxY - region.minY + 1;
  const weights = new Float64Array(width * height);

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const wx = region.minX + x;
      const wy = region.minY + y;
      const tile = this.getTileFromWorldPosition(new Position(wx, wy, z));
      weights[y * width + x] = (tile && tile.neighbours) ? (tile.getWeight(null) || 1) : 0;
    }
  }

  const transfer = [weights.buffer.slice(0)];

  return this.__workerPool.exec("findPath", {
    fromX: fromPosition.x - region.minX,
    fromY: fromPosition.y - region.minY,
    toX: toPosition.x - region.minX,
    toY: toPosition.y - region.minY,
    z,
    mode: mode === Pathfinder.prototype.ADJACENT ? 0 : 1,
    width,
    height,
    weights: weights.buffer,
    occupied,
  }).then((result) => {
    if (!result || result.length === 0) return [];
    return result.map(p => new Position(p.x + region.minX, p.y + region.minY, z));
  }).catch(() => {
    return this.findPath(creature, fromPosition, toPosition, mode);
  });

}

Lattice.prototype.getSpectatingChunks = function (position) {

  /*
   * Function Lattice.getSpectatingChunks
   * Returns the spectating chunks for a given position (3x3 area)
   */

  let chunk = this.getChunkFromWorldPosition(position);

  if (chunk === null) {
    return new Array();
  }

  // All neighbours need to be updated
  return chunk.neighbours;

}

Lattice.prototype.getSpectatingChunksWide = function (position) {

  /*
   * Function Lattice.getSpectatingChunksWide
   * Returns spectating chunks in a wider radius (5x5 area) for monster targeting
   */

  let chunk = this.getChunkFromWorldPosition(position);

  if (chunk === null) {
    return new Array();
  }

  // Collect chunks in a 5x5 grid centered on the chunk
  let chunks = new Set();

  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      let cp = chunk.position.add(new Position(dx, dy, 0));
      let c = this.__getChunkFromChunkPosition(cp);
      if (c !== null) {
        chunks.add(c);
      }
    }
  }

  return [...chunks];

}

Lattice.prototype.getActiveChunks = function (onlinePlayers) {

  /*
   * Function Lattice.getActiveChunks
   * Returns the currently active chunks that have a player in them. Monsters and NPCs in these chunks need to be updated!
   */

  // Create a set of the currently sectors activated by players
  let activeChunks = new Set();

  // Add all neighbouring chunks for all players to the active set (wide radius for monsters)
  onlinePlayers.forEach(function (player) {
    this.getSpectatingChunksWide(player.position).forEach(chunk => activeChunks.add(chunk));
  }, this);

  return activeChunks;

}

Lattice.prototype.findAvailableTile = function (creature, position) {

  /*
   * Function Lattice.findAvailableTile
   * Finds an available tile for the creature starting from itself and its neighbours
   * Searches in expanding rings up to a reasonable distance
   */

  let isPositionOk = function (checkTile) {
    if (checkTile === null || checkTile.id === 0 || checkTile.isBlockSolid()) return false;
    if (checkTile.isOccupiedCharacters()) return false;
    if (!creature.isPlayer()) {
      if (checkTile.isProtectionZone() || checkTile.isNoLogoutZone()) return false;
    } else {
      if (checkTile.isNoLogoutZone()) return false;
    }
    if (creature.isTileOccupied(checkTile)) return false;
    return true;
  };

  // Try the exact requested tile first
  let centerTile = this.getTileFromWorldPosition(position);
  if (centerTile !== null && isPositionOk(centerTile)) {
    return centerTile;
  }

  // Search in expanding rings (ring 1 = 8 immediate neighbors, ring 2 = 16, etc.)
  for (let radius = 1; radius <= 15; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        let checkPos = position.addVector(dx, dy, 0);
        if (checkPos === null) continue;
        let checkTile = this.getTileFromWorldPosition(checkPos);
        if (isPositionOk(checkTile)) {
          return checkTile;
        }
      }
    }
  }

  return null;

}

Lattice.prototype.findDestination = function (creature, tile) {

  /*
   * Function Lattice.findDestination
   * When teleporting: recursively go down the tile to find its eventual destination
   */

  if (tile === null) {
    return null;
  }

  // If this is not a portal just return the tile
  if (!tile.hasDestination()) {
    return tile;
  }

  // Maximum of eight hops before giving up (e.g., infinite loops)
  let hops = 8;

  // Following floor changes & teleporters forever
  while (tile.hasDestination()) {

    // Prevent infinite loops from one to back
    if (--hops === 0) {
      return null;
    }

    // Get the floor change
    let position = tile.getDestination();

    // Nothing found
    if (position === null) {
      return null;
    }

    // To self: infinite loop
    if (tile.position.equals(position)) {
      return null;
    }

    // Update the tile for the next iteration
    tile = this.getTileFromWorldPosition(position);

    if (tile === null) {
      return null;
    }

  }

  // Found the final tile to put the player
  return this.findAvailableTile(creature, tile.position);

}

Lattice.prototype.getChunkFromWorldPosition = function (position) {

  /*
   * Function Lattice.getChunkFromWorldPosition
   * Returns the chunk beloning to a particular position
   */

  if (position === null) {
    return null;
  }

  // Calculate the chunk position
  let chunkPosition = this.__getChunkPositionFromWorldPosition(position);

  // Must be valid
  if (!this.__isValidChunkPosition(chunkPosition)) {
    return null;
  }

  let map = chunkPosition.z === 0 ? this.__chunksPositive : this.__chunksNegative;

  if (!map.has(chunkPosition.xy)) {
    return null;
  }

  // Return the chunk
  return map.get(chunkPosition.xy);

}

Lattice.prototype.getTileFromWorldPosition = function (position) {

  /*
   * Function Lattice.getTileFromWorldPosition
   * Returns tile based on a requested world position
   */

  if (position === null) {
    return null;
  }

  // Not within world range
  if (!this.withinBounds(position)) {
    return null;
  }

  // First get the chunk
  let chunk = this.getChunkFromWorldPosition(position);

  if (chunk === null) {
    return null;
  }

  // Delegate to find the tile within the chunk
  return chunk.getTileFromWorldPosition(position);

}

Lattice.prototype.createChunk = function (position) {

  /*
   * Function Lattice.createChunk
   * Creates a chunk that contains the given worldPosition (executed during database load)
   */

  let chunkPosition = this.__getChunkPositionFromWorldPosition(position);
  let index = this.__getChunkIndex(chunkPosition);
  let chunk = new Chunk(index, chunkPosition);

  if (chunkPosition.z === 0) {
    this.__chunksPositive.set(chunkPosition.xy, chunk);
  } else {
    this.__chunksNegative.set(chunkPosition.xy, chunk);
  }

  // Return the created chunk
  return chunk;

}

Lattice.prototype.enablePathfinding = function (tile, refreshNeighbours) {

  /*
   * Function Lattice.enablePathfinding
   * Goes over all available chunks and references its neighbours, including tiles for pathfinding
   */

  // Self and eight surrounding tiles or chunks
  let things = new Array(
    tile.position,
    tile.position.west(),
    tile.position.north(),
    tile.position.east(),
    tile.position.south(),
    tile.position.northwest(),
    tile.position.southwest(),
    tile.position.northeast(),
    tile.position.southeast()
  );

  // Set the neighbours of the tile
  tile.neighbours = things.map(this.getTileFromWorldPosition, this).nullfilter().filter(x => !x.isBlockSolid());

  // Also refresh the neighbours pathfinding: but not recursively
  if (refreshNeighbours) {
    tile.neighbours.forEach(tile => this.enablePathfinding(tile, false));
  }

}

Lattice.prototype.setReferences = function () {

  this.__setReferences(this.__chunksPositive);
  this.__setReferences(this.__chunksNegative);

}

Lattice.prototype.__setReferences = function (chunks) {

  /*
   * Function Lattice.setReferences
   * Goes over all available chunks and references its neighbours, including tiles for pathfinding
   */

  chunks.forEach(function (chunk) {

    // Save chunk neighbours
    this.__referenceNeighbours(chunk, this.__getChunkFromChunkPosition);

    // Go over all tiles that exist and reference its neighbours
    chunk.layers.forEach(function (layer) {

      if (layer === null) {
        return;
      }

      layer.forEach(function (tile) {

        // The tile does not exist
        if (tile === null) {
          return;
        }

        // Does not need pathfinding now
        if (tile.isBlockSolid()) {
          return;
        }

        // Enable pathfinding for this particular tile
        this.enablePathfinding(tile, false);

      }, this);

    }, this);

  }, this);

}

Lattice.prototype.__referenceNeighbours = function (thing, callback) {

  /*
   * Function Lattice.__referenceNeighbour
   * References neighbours of a chunk or a tile
   */

  // Self and eight surrounding tiles or chunks
  let things = new Array(
    thing.position,
    thing.position.west(),
    thing.position.north(),
    thing.position.east(),
    thing.position.south(),
    thing.position.northwest(),
    thing.position.southwest(),
    thing.position.northeast(),
    thing.position.southeast()
  );

  thing.neighbours = things.map(callback, this).nullfilter();

}

Lattice.prototype.__isValidChunkPosition = function (position) {

  /*
   * Function Lattice.__isValidChunkPosition
   * Returns true if the chunk position is valid
   */

  return (position.x >= 0) && (position.x < this.nChunksWidth) &&
    (position.y >= 0) && (position.y < this.nChunksHeight) &&
    (position.z >= 0) && (position.z < this.nChunksDepth);

}

Lattice.prototype.__getChunkIndex = function (position) {

  /*
   * Function Lattice.__getChunkIndex
   * Returns the chunk index from a chunk position
   */

  return position.x +
    (position.y * this.nChunksWidth) +
    (position.z * this.nChunksWidth * this.nChunksHeight);

}

Lattice.prototype.__getChunkFromChunkPosition = function (position) {

  /*
   * Function Lattice.__getChunkFromChunkPosition
   * Returns the chunk from a chunk (x, y) position
   */

  // Not a valid chunk position
  if (!this.__isValidChunkPosition(position)) {
    return null;
  }

  let map = position.z === 0 ? this.__chunksPositive : this.__chunksNegative;

  if (!map.has(position.xy)) {
    return null;
  }

  return map.get(position.xy);

}

Lattice.prototype.withinBounds = function (position) {

  /*
   * Function Lattice.withinBounds
   * Returns whether a position is within the accepted world bounds
   */

  // Guard against null
  if (position === null) {
    return false;
  }

  return (position.x >= 0) && (position.x < this.width) &&
    (position.y >= 0) && (position.y < this.height) &&
    (position.z >= 0) && (position.z < this.depth);

}

Lattice.prototype.__getChunkPositionFromWorldPosition = function (position) {

  /*
   * Function Lattice.__getChunkPositionFromWorldPosition
   * Returns the chunk position based on the world position
   */

  // Project the z-component tile on the zeroth floor
  let x = position.x + (position.z % Chunk.prototype.DEPTH);
  let y = position.y + (position.z % Chunk.prototype.DEPTH);

  // Simple division to get the chunk x, y
  let sx = Math.floor(x / Chunk.prototype.WIDTH);
  let sy = Math.floor(y / Chunk.prototype.HEIGHT);
  let sz = Math.floor(position.z / Chunk.prototype.DEPTH);

  // Calculate the chunk index
  return new Position(sx, sy, sz);

}

module.exports = Lattice;
