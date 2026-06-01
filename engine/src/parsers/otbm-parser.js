"use strict";

const OTBM_HEADERS = requireModule("parsers/otbm-headers");
const OTBMNode = requireModule("parsers/otbm-node");
const Position = requireModule("utils/position");
const World = requireModule("core/world");

const fs = require("fs");

function __remapTileFlags(raw) {
  if (raw & 0x40) {
    raw |= 0x20;
    raw &= ~0x40;
  }
  return raw;
}

const OTBMParser = function() {

  /*
   * Class OTBMParser 
   * Parser for OTBM files that emits all tile/item nodes
   */

}

OTBMParser.prototype.__getItemVersion = function(version) {

  /*
   * Function OTBMParser.__getItemVersion
   * Maps the server version to the major and minor item version
   */

  // Implement other versions here mapping version string -> minor, major item version
  switch(version) {
    case "740":
    case "750":
      return [1, 1];
    case "755":
      return [1, 2];
    case "760":
    case "770":
      return [1, 3];
    case "780":
      return [1, 4];
    case "800":
      return [1, 3];
    case "790":
      return [1, 5];
    case "792":
      return [1, 6];
    case "1098":
      return [3, 57];
    case "10100":
      return [3, 58];
  }

  return [0, 0];

}

OTBMParser.prototype.load = function(filename) {

  /*
   * Function OTBMParser.load
   * Loads the OTBM file and sets it to the game world
   */

  let start = performance.now();
  let filepath = getDataFile("world", filename);

  console.log("Reading OTBM file %s.".format(filepath));

  this.read(filepath);

  // Set the required references in the lattice
  gameServer.world.lattice.setReferences();

  const poolInfo = gameServer.world.lattice.initWorkerPool();
  if (poolInfo) {
    console.log("Worker pool initialized: %s workers on %s CPU cores.".format(poolInfo.maxWorkers, poolInfo.cpuCores));
  }

  console.log("Completed loading world in %s miliseconds.".format(Math.round(performance.now() - start)));


}

OTBMParser.prototype.read = function(file) {

  /*
   * Function OTBMParser.read
   * Reads an OTBM file
   */

  // Sync reading from disk
  let data = fs.readFileSync(file);

  // Get some magic bytes
  let identifier = data.readUInt32LE(0);
  this.version = data.readUInt32LE(6);

  // Determine the minor and major item versions
  let [ majorVersion, minorVersion ] = this.__getItemVersion(CONFIG.SERVER.CLIENT_VERSION);

  this.majorVersion = majorVersion;
  this.minorVersion = minorVersion;

  // Confirm OTBM format by reading magic bytes (NULL or "OTBM")
  if(identifier !== 0x00000000 && identifier !== Buffer.from("OTBM").readUInt32LE()) {
    throw("Unknown OTBM format: unexpected magic bytes.");
  }

  // Begin recursive reading of the OTBM tree
  this.readNode(null, data.subarray(4));

}

OTBMParser.prototype.__parseItem = function(item) {

  /*
   * Function OTBMParser.__parseItem
   * Parses a RME item definition that is present on the map
   */

  // Create a thing with an identifier
  let thing = gameServer.database.createThing(item.properties.id);

  // Skip items that do not exist in the database
  if (thing === null) {
    return null;
  }

  // Attach the map attributes
  item.properties.attributes.forEach(function(value, attribute) {

    switch(attribute) {
      case OTBM_HEADERS.OTBM_ATTR_TEXT: return thing.setContent(value);
      case OTBM_HEADERS.OTBM_ATTR_TELE_DEST:
        if (typeof thing.setDestination === "function") {
          return thing.setDestination(value);
        }
        return;
      case OTBM_HEADERS.OTBM_ATTR_COUNT: return thing.setCount(value);
      case OTBM_HEADERS.OTBM_ATTR_ACTION_ID: return thing.setActionId(value);
      case OTBM_HEADERS.OTBM_ATTR_UNIQUE_ID: return thing.setUniqueId(value);
    }

  });

  return thing;

}

OTBMParser.prototype.emitNode = function(node) {

  /*
   * OTBMParser.emitNode
   * Called for every node that is emitted from OTBM format
   */

  // Map to the proper handler
  switch(node.type) {
    case OTBM_HEADERS.OTBM_MAP_HEADER:
      return this.__createWorldNode(node);  
    case OTBM_HEADERS.OTBM_MAP_DATA:
      return console.log("Map description: %s".format(node.properties.attributes.get(OTBM_HEADERS.OTBM_ATTR_DESCRIPTION)));
    case OTBM_HEADERS.OTBM_TILE:
    case OTBM_HEADERS.OTBM_HOUSETILE:
      return this.__createWorldTileNode(node);
    case OTBM_HEADERS.OTBM_ITEM:
      return this.__createWorldItemNode(node);
  }

}

OTBMParser.prototype.__createWorldNode = function(node) {

  /*
   * OTBMParser.__createWorldNode
   * Creates the wrapper for the game world
   */

   // Confirm version (only for OTBM v3+ that includes items version fields)
   if(node.properties.itemsMajorVersion !== undefined && (this.majorVersion !== node.properties.itemsMajorVersion || this.minorVersion !== node.properties.itemsMinorVersion)) {
     console.log("Item minor or major version (%s, %s) does NOT match the server version (%s).".format(this.minorVersion, this.majorVersion, CONFIG.SERVER.CLIENT_VERSION));
   }

  let width = CONFIG.WORLD.CHUNK.WIDTH * Math.ceil(node.properties.mapWidth / CONFIG.WORLD.CHUNK.WIDTH);
  let height = CONFIG.WORLD.CHUNK.HEIGHT * Math.ceil(node.properties.mapHeight / CONFIG.WORLD.CHUNK.HEIGHT);

  let worldSize = new Position(width, height, 16);

  // Create the empty world
  gameServer.world = new World(worldSize);

}

OTBMParser.prototype.__createWorldItemNode = function(node) {

  /*
   * OTBMParser.__createWorldItemNode
   * Creates an item node in the game world
   */

  let tile = gameServer.world.lattice.getTileFromWorldPosition(node.getPosition());

  // Tile doesn't exist at this position
  if (tile === null) {
    return;
  }

  if(tile.id === 0) {

    if(node.hasAttribute(OTBM_HEADERS.OTBM_ATTR_ACTION_ID)) {
      tile.setActionId(node.getAttribute(OTBM_HEADERS.OTBM_ATTR_ACTION_ID));
    }

    if(node.hasAttribute(OTBM_HEADERS.OTBM_ATTR_UNIQUE_ID)) {
      tile.setUniqueId(node.getAttribute(OTBM_HEADERS.OTBM_ATTR_UNIQUE_ID));
    }

  }

  // Create the thing
  let thing = this.__parseItem(node);

  // Skip items that do not exist in the database
  if (thing === null) {
    return;
  }

  // If tile had no ground, set its id from the first item (ground type)
  if (tile.id === 0) {
    tile.id = thing.id;
  }

  // Simple: add
  if(node.parentNode.type !== OTBM_HEADERS.OTBM_ITEM) {
    return tile.addTopThing(thing);
  }

  // If this node is a child of a parent container we need to find the right container to add it
  let container = tile.getTopItem();

  // Guard: container must exist and have addFirstEmpty
  if (container === null || typeof container.addFirstEmpty !== "function") {
    return;
  }

  let current = node.parentNode;

  // Go down the chain to find the container
  while(current.parentNode.type === OTBM_HEADERS.OTBM_ITEM) {
    container = container.peekIndex(container.getNumberItems() - 1);
    if (container === null) return;
    current = current.parentNode;
  }

  container.addFirstEmpty(thing);

}

OTBMParser.prototype.__createWorldTileNode = function(node) {

  /*
   * OTBMParser.__createWorldTileNode
   * Creates a tile node in the game world
   */

  let worldPosition = node.getPosition();

  // If chunk exists
  let chunk = gameServer.world.lattice.getChunkFromWorldPosition(worldPosition);

  // Create a new one
  if(chunk === null) {
    chunk = gameServer.world.lattice.createChunk(worldPosition);
  }

  // Create the tile
  let tile = chunk.createTile(worldPosition, node.properties.attributes.get(OTBM_HEADERS.OTBM_ATTR_ITEM) || 0);

  if(node.properties.attributes.has(OTBM_HEADERS.OTBM_ATTR_TILE_FLAGS)) {
    tile.setZoneFlags(__remapTileFlags(node.properties.attributes.get(OTBM_HEADERS.OTBM_ATTR_TILE_FLAGS)));
  }

  if(node.properties.attributes.has(OTBM_HEADERS.OTBM_ATTR_ACTION_ID)) {
    tile.setActionId(node.properties.attributes.get(OTBM_HEADERS.OTBM_ATTR_ACTION_ID));
  }

  if(node.properties.attributes.has(OTBM_HEADERS.OTBM_ATTR_UNIQUE_ID)) {
    tile.setUniqueId(node.properties.attributes.get(OTBM_HEADERS.OTBM_ATTR_UNIQUE_ID));
  }

  // Link house tiles to their House object
  if(node.type === OTBM_HEADERS.OTBM_HOUSETILE) {
    let house = process.gameServer.database.getHouse(Number(node.properties.id));
    if(house !== null) {
      house.addTile(tile);
    }
  }

}

OTBMParser.prototype.readNode = function(parentNode, data) {

  /*
   * OTBMParser.readNode
   * Reads a single OTBM node from the data array
   */

  let i = 1;
  let currentNode = null;

  // Start reading the array
  while(i < data.length) {

    // Current byte
    let cByte = data.readUInt8(i);

    // Data belonging to this particular node, between 0xFE and (OxFE || 0xFF)
    if(currentNode === null && (cByte === OTBM_HEADERS.OTBM_NODE_INIT || cByte === OTBM_HEADERS.OTBM_NODE_TERM)) {
      currentNode = new OTBMNode(parentNode, data.subarray(1, i), this.version); 
      this.emitNode(currentNode);
    }

    switch(cByte) {
      case OTBM_HEADERS.OTBM_NODE_TERM: // Terminate
        return i;
      case OTBM_HEADERS.OTBM_NODE_ESC: // Escape
        i++
        break;
      case OTBM_HEADERS.OTBM_NODE_INIT: // Recurse
        i = i + this.readNode(currentNode, data.subarray(i));
        break;
    }

    i++;

  }

}

module.exports = OTBMParser;
