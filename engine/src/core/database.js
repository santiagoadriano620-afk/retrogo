"use strict";

const Container = requireModule("containers/container");
const Corpse = requireModule("entities/corpse");
const DataValidator = requireModule("utils/validator");
const Door = requireModule("entities/door");
const FluidContainer = requireModule("utils/fluidcontainer");
const House = requireModule("entities/house");
const Item = requireModule("entities/item");
const Key = requireModule("utils/key");
const KeyRing = requireModule("containers/keyring");
const NPC = requireModule("npc/npc");
const Readable = requireModule("entities/readable");
const Rune = requireModule("utils/rune");
const Teleporter = requireModule("entities/teleporter");
const Thing = requireModule("entities/thing");
const ThingPrototype = requireModule("entities/thing-prototype");
const ActionLoader = requireModule("core/database-action-loader");
const OTBMParser = requireModule("parsers/otbm-parser");

const fs = require("fs");

const Database = function () {

  /*
   * Class Database
   * Container for the database that maintains all the server data
   *
   * API:
   * 
   * getSpell(id) - returns a spell with a particular identifier
   * getRune(id) - returns a rune with a particular identifier
   * getMoster(id) - returns a monster with a particular identifier
   * getZone(id) - returns a zone with a particular identifier
   *
   */

  // Validate for server data using JSON schemas
  this.validator = new DataValidator();

  // Parser for the world file
  this.worldParser = new OTBMParser();

  // Loader for the scripting actions
  this.actionLoader = new ActionLoader();

}

Database.prototype.loadHouseItems = function () {

  /*
   * Function Database.loadHouseItems
   * Loads the items that are within the houses
   */

  // Go over all the house definitions
  this.houses.forEach(function (house) {

    // Read the house definition from disk
    let json = JSON.parse(fs.readFileSync(getDataFile("houses", "definitions", "%s.json".format(house.id))));

    json.forEach(function (entry) {

      // Get the tile and create the item
      let tile = gameServer.world.getTileFromWorldPosition(entry.position);
      let thing = gameServer.database.parseThing(entry.item);

      // Push the thing to the top of the tile
      tile.addTopThing(thing);

    });

  });

}

Database.prototype.saveHouses = function () {

  /*
   * Function Database.saveHouses
   * Serializes and saves the house items to disk
   */

  // Go over everything
  this.houses.forEach(function (house) {

    // Collect all things for serialization
    let things = new Array();

    house.tiles.forEach(function (tile) {

      if (!tile.hasOwnProperty("itemStack")) return;

      tile.itemStack.__items.forEach(function (item) {

        // Save everything that can be moved or picked up
        if (!item.isPickupable() && !item.isMoveable()) {
          return;
        }

        // We have to save a position and the item itself
        things.push(new Object({
          "position": tile.position,
          "item": item
        }));

      });

    });

    // Write to disk
    fs.writeFileSync(getDataFile("houses", "definitions", "%s.json".format(house.id)), JSON.stringify(things));

  });

  // Serialize house metadata only (via toJSON which excludes tiles to avoid tile.house circular refs)
  let housesMeta = {};
  this.houses.forEach(function (house, id) {
    housesMeta[id] = house.toJSON();
  });
  let done = JSON.stringify(housesMeta, null, 2);

  // Write to disk
  fs.writeFileSync(getDataFile("houses", "definitions.json"), done);

}

Database.prototype.initialize = function () {

  /*
   * Function Database.initialize
   * Loads all the server data and things
   */

  // Load all other data files
  this.items = this.__loadItemDefinitions("items");
  this.spells = this.__loadSpellDefinitions("spells");
  this.runes = this.__loadDefinitions("runes");
  this.doors = this.__loadDefinitions("doors");

  // Read house information from the database
  this.houses = this.__loadHouses("houses");

  this.conditions = this.__loadDefinitions("conditions");

  // Actions need the item definitions to be present: so load them now before the game world is parsed
  this.actionLoader.initialize();

  // Load the gameworld itself
  this.worldParser.load(CONFIG.WORLD.WORLD_FILE);

  // Clock events requires the world to be present
  this.actionLoader.attachClockEvents("clock");

  // Load house items
  this.loadHouseItems();

  // Monsters now
  this.monsters = this.__loadDefinitions("monsters");

  // Validate monsters
  Object.entries(this.monsters).forEach(function ([key, value]) {
    this.validator.validateMonster(key, value);
  }, this);

  // Build a name→data lookup for ALL NPC definitions (for spawning from XML)
  this.__npcNameToData = this.__buildNPCNameDataMap();

  // Spawns if they are enabled
  if (CONFIG.WORLD.SPAWNS.ENABLED) {
    this.__loadSpawnDefinitions("spawns");
  }

}

Database.prototype.__loadHouses = function (definition) {

  let json = JSON.parse(fs.readFileSync(getDataFile(definition, "definitions.json")));
  let houses = new Map();

  Object.entries(json).forEach(function ([id, entry]) {
    houses.set(Number(id), new House(Number(id), entry));
  });

  return houses;

}

Database.prototype.getHouse = function (hid) {

  if (!this.houses.has(hid)) {
    return null;
  }

  return this.houses.get(hid);

}

Database.prototype.getCondition = function (name) {

  if (!this.conditions.has(name)) {
    return null;
  }

  return this.conditions.get(name);

}

Database.prototype.createThing = function (id) {

  /*
   * Function Database.createThing
   * Creates a new thing from a particular identifier
   */

  // The requested item identifier does not exist
  if (!this.items.hasOwnProperty(id)) {
    return null;
  }

  // Get the right constructor from the identifier
  let thing = this.__createClassFromId(id);

  // Set the weight of pickupable items
  if (thing.isPickupable()) {
    thing.setWeight(thing.getPrototype().properties.weight);
  }

  // Initialize count from charges for charged items (garlic necklace, rings, etc.)
  let charges = thing.getAttribute("charges");
  if (charges) {
    thing.setCount(charges);
  }

  // Schedule the decay event
  if (thing.isDecaying()) {
    thing.scheduleDecay();
  }

  return thing;

}

Database.prototype.parseItems = function (container, things) {

  /*
   * Function Database.parseItems
   * Recursively parses items from JSON
   */

  things.forEach(function (thing, index) {

    if (thing !== null) {
      return container.addThing(gameServer.database.parseThing(thing), index);
    }

  }, this);

}

Database.prototype.getDoorEvent = function (aid) {

  // Create a bucket to collect the functions
  if (!this.doors.hasOwnProperty(aid)) {
    return null;
  }

  return this.doors[aid];

}

Database.prototype.parseThing = function (item) {

  /*
   * Function Database.parseThing
   * Parses a thing from a database JSON definition
   */

  // Create the thing based on the identifier
  let thing = this.createThing(item.id);

  if (!thing) return null;

  // Copy over the count
  if (item.count) {
    thing.setCount(item.count);
  }

  // Recursively add items to the container
  if (thing.isContainer()) {

    if (item.items) {
      this.parseItems(thing, item.items);
    }

    if (item.content) {
      this.parseItems(thing, item.content);
    }

  }

  // Copy the item identifier
  if (item.actionId) {
    thing.setActionId(item.actionId);
  }

  if (item.duration) {
    thing.setDuration(item.duration);
    if (thing.isDecaying()) {
      thing.__scheduleDecay(item.duration);
    }
  }

  if (item.content) {
    thing.setContent(item.content);
  }

  if (item.equipTime) {
    thing.__equipTime = item.equipTime;
  }

  return thing;

}

Database.prototype.getMonster = function (id) {

  /*
   * Function Database.getMonster
   * Returns the monsters that belongs to a particular identifier
   */

  // Does not exist
  if (!this.monsters.has(id)) {
    return null;
  }

  return this.monsters.get(id);

}

Database.prototype.getMonsterByName = function (name) {

  /*
   * Function Database.getMonsterByName
   * Finds a monster by name (case-insensitive) and returns { id, data }
   */

  let searchName = name.toLowerCase();

  for (let [id, data] of this.monsters) {
    if (data.creatureStatistics && data.creatureStatistics.name) {
      if (data.creatureStatistics.name.toLowerCase() === searchName) {
        return { id: id, data: data };
      }
    }
  }

  return null;

}

Database.prototype.getItemIdByName = function (name) {

  /*
   * Function Database.getItemIdByName
   * Finds an item by name (case-insensitive exact match) and returns the item ID
   */

  let searchName = name.toLowerCase();

  for (let [id, proto] of Object.entries(this.items)) {
    if (proto.properties && proto.properties.name) {
      if (proto.properties.name.toLowerCase() === searchName) {
        return Number(id);
      }
    }
  }

  return null;

}

Database.prototype.getRune = function (id) {

  /*
   * Function Database.getRune
   * Returns the function that belongs to a rune with a particular ID
   */

  if (!this.runes.has(id)) {
    return null;
  }

  return this.runes.get(id);

}

Database.prototype.getSpell = function (sid) {

  /*
   * Function Database.getSpell
   * Returns the function that belongs to a spell with a particular ID
   */

  if (!this.spells.has(sid)) {
    return null;
  }

  return this.spells.get(sid).script;

}

Database.prototype.getSpellMeta = function (sid) {

  /*
   * Function Database.getSpellMeta
   * Returns the metadata (mana, level, vocations) for a spell
   */

  if (!this.spells.has(sid)) {
    return null;
  }

  return this.spells.get(sid);

}

Database.prototype.__loadDefinitions = function (definition) {

  /*
   * Function Database.__loadDefinitions
   * Loads particular data definitions from the folders
   */

  let reference = new Map();

  Object.entries(this.readDataDefinition(definition)).forEach(function ([key, value]) {
    reference.set(Number(key), require(getDataFile(definition, "definitions", value)));
  });

  console.log("Loaded [[ %s ]] %s definitions.".format(reference.size, definition));

  return reference;

}

Database.prototype.getThingPrototype = function (id) {

  /*
   * Function Database.getThingPrototype
   * Returns the prototype of a thing with an identifier
   */

  // The item does not exist
  if (!this.items.hasOwnProperty(id)) {
    return null;
  }

  return this.items[id];

}

Database.prototype.getClientId = function (id) {

  /*
   * Function Database.getClientId
   * Returns the client identifier from server identifier
   */

  let proto = this.getThingPrototype(id);

  if (proto === null) {
    return 0;
  }

  // Use clientId from OTB if available, fall back to server ID
  return proto.properties.clientId || proto.id;

}

Database.prototype.__loadSpawnDefinitions = function (definition) {
  /*
   * Function Database.__loadSpawnDefinitions
   * Loads all the configured spawns and associated monsters
   */

  const Monster = require("../monster/monster");
  const xml2js = require("xml2js");

  // Mapping of monster name to ID
  let nameToId = new Map();

  this.monsters.forEach((data, id) => {
    if (data.creatureStatistics && data.creatureStatistics.name) {
      nameToId.set(data.creatureStatistics.name.toLowerCase(), id);
    }
  });

  // Determine the path to the spawn file
  let path = getDataFile("world", "map-spawn.xml");

  if (!fs.existsSync(path)) {
    return console.log("Could not find spawn file at %s".format(path));
  }

  let content = fs.readFileSync(path, 'utf8');
  let count = 0, monsterCount = 0, npcCount = 0;

  // TFS tvpspawn format: <tvpspawn attrs.../>
  let tvpRegex = /<tvpspawn\s+([^>]*)\/>/g;
  let match;

  while ((match = tvpRegex.exec(content)) !== null) {

    let attrs = {};
    match[1].replace(/(\w+)="([^"]*)"/g, (_, k, v) => attrs[k] = v);

    let cx = parseInt(attrs.centerx);
    let cy = parseInt(attrs.centery);
    let cz = parseInt(attrs.centerz);
    let radius = parseInt(attrs.radius) || 4;
    let amount = parseInt(attrs.amount) || 1;

    if (attrs.monstername) {
      let id = nameToId.get(attrs.monstername.toLowerCase());
      if (id === undefined) continue;

      let data = this.getMonster(id);

      for (let i = 0; i < amount; i++) {
        let pos = this.__findSpawnTile(cx, cy, cz, radius, true);
        if (pos === null) {
          console.log("Could not find free tile for %s (all radii exhausted).".format(attrs.monstername));
          continue;
        }

        let monster = new Monster(id, data);
        gameServer.world.creatureHandler.addCreatureSpawn(monster, pos);
        count++;
        monsterCount++;
      }

    } else if (attrs.npcname) {
      let lookupKey = attrs.npcname.toLowerCase().replace(/[^a-z0-9]/g, "");
      let npcData = this.__npcNameToData[lookupKey];
      if (npcData === undefined) continue;

      for (let i = 0; i < amount; i++) {
        let pos = this.__findSpawnTile(cx, cy, cz, radius, false);
        if (pos === null) {
          console.log("Could not find free tile for %s (all radii exhausted).".format(attrs.npcname));
          continue;
        }

        let npc = new NPC(npcData);
        gameServer.world.creatureHandler.addCreatureSpawn(npc, pos);
        count++;
        npcCount++;
      }
    }
  }

  // Standard TFS spawn format: <spawn centerx="..." centery="..." centerz="..." radius="...">
  //   <monster name="..." x="..." y="..." z="..." spawntime="..." />
  //   <npc name="..." x="..." y="..." z="..." spawntime="..." />
  // </spawn>

  xml2js.parseString(content, function (err, result) {
    if (err) {
      return console.log("Could not parse map-spawn.xml: %s".format(err.message));
    }

    if (!result || !result.spawns || !result.spawns.spawn) {
      return;
    }

    result.spawns.spawn.forEach(function (spawn) {
      let cx = parseInt(spawn.$.centerx);
      let cy = parseInt(spawn.$.centery);
      let cz = parseInt(spawn.$.centerz);

      // Parse monster children
      if (spawn.monster) {
        spawn.monster.forEach(function (monster) {
          let offsetX = parseInt(monster.$.x) || 0;
          let offsetY = parseInt(monster.$.y) || 0;
          let offsetZ = parseInt(monster.$.z) || cz;
          let name = monster.$.name;

          let pos = { x: cx + offsetX, y: cy + offsetY, z: offsetZ };

          let id = nameToId.get(name.toLowerCase());
          if (id === undefined) {
            console.log("Unknown monster '%s' in spawn at %s".format(name, JSON.stringify(pos)));
            return;
          }

          let data = this.getMonster(id);
          let creature = new Monster(id, data);
          gameServer.world.creatureHandler.addCreatureSpawn(creature, pos);
          count++;
          monsterCount++;
        }, this);
      }

      // Parse NPC children
      if (spawn.npc) {
        spawn.npc.forEach(function (npc) {
          let offsetX = parseInt(npc.$.x) || 0;
          let offsetY = parseInt(npc.$.y) || 0;
          let offsetZ = parseInt(npc.$.z) || cz;
          let name = npc.$.name;

          let pos = { x: cx + offsetX, y: cy + offsetY, z: offsetZ };

          let lookupKey = name.toLowerCase().replace(/[^a-z0-9]/g, "");
          let npcData = this.__npcNameToData[lookupKey];

          if (npcData === undefined) {
            console.log("Unknown NPC '%s' in spawn at %s".format(name, JSON.stringify(pos)));
            return;
          }

          let creature = new NPC(npcData);
          gameServer.world.creatureHandler.addCreatureSpawn(creature, pos);
          count++;
          npcCount++;
        }, this);
      }
    }, this);
  }.bind(this));

  console.log("Loaded %s creature spawns (%s monsters, %s NPCs).".format(count, monsterCount, npcCount));

  if (npcCount < 100) {
    console.log("WARNING: Only %s NPCs spawned from XML. Expected 280+. Check spawn XML and NPC definitions.".format(npcCount));
  }

}

Database.prototype.__findSpawnTile = function (cx, cy, cz, radius, isMonster) {
  let Position = require("../utils/position");
  return new Position(cx, cy, cz);
}

Database.prototype.__buildNPCNameDataMap = function () {

  /*
   * Function Database.__buildNPCNameDataMap
   * Scans all NPC definition files and builds a normalized-name → data lookup.
   * Used by the spawn loader to find NPC definitions by spawn XML name.
   */

  const path = require("path");
  const defsDir = getDataFile("npcs", "definitions");
  const files = fs.readdirSync(defsDir).filter(f => f.endsWith(".json"));
  const map = {};

  for (const file of files) {
    let raw;
    try {
      raw = fs.readFileSync(path.join(defsDir, file), "utf-8");
    } catch (e) {
      continue;
    }
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    try {
      const data = JSON.parse(raw);
      const name = data.creatureStatistics && data.creatureStatistics.name;
      if (name) {
        const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
        map[key] = data;
      }
    } catch (e) {
      // skip invalid files
    }
  }

  console.log("Built NPC name lookup: %s entries.".format(Object.keys(map).length));

  return map;

}

Database.prototype.__loadDefinitions = function (definition) {

  /*
   * Function Database.__loadDefinitions
   * Loads particular data definitions from the folders
   */

  let reference = new Map();

  Object.entries(this.readDataDefinition(definition)).forEach(function ([key, value]) {
    reference.set(Number(key), require(getDataFile(definition, "definitions", value)));
  });

  console.log("Loaded [[ %s ]] %s definitions.".format(reference.size, definition));

  return reference;

}

Database.prototype.__loadSpellDefinitions = function (definition) {

  /*
   * Function Database.__loadSpellDefinitions
   * Loads spell definitions with metadata (mana, level, vocations)
   */

  let reference = new Map();

  Object.entries(this.readDataDefinition(definition)).forEach(function ([key, spellData]) {
    let script;
    try {
      script = require(getDataFile(definition, "definitions", spellData.script));
    } catch (e) {
      console.warn("Failed to load spell script %s for ID %s: %s".format(spellData.script, key, e.message));
      return;
    }

    reference.set(Number(key), {
      script: script,
      name: spellData.name || "Unknown",
      words: spellData.words || "",
      mana: spellData.mana || 0,
      level: spellData.level || 1,
      vocations: spellData.vocations || ["sorcerer", "druid", "paladin", "knight"],
      premium: spellData.premium || false,
      soul: spellData.soul || 0,
      cooldown: spellData.cooldown || 0,
      needTarget: spellData.needTarget || false,
      needDirection: spellData.needDirection || false,
      isBlockingWalls: spellData.isBlockingWalls || false,
      isSelfTarget: spellData.isSelfTarget || false
    });
  });

  console.log("Loaded [[ %s ]] %s definitions.".format(reference.size, definition));

  return reference;

}

Database.prototype.__loadItemDefinitions = function (definition) {

  /*
   * Function Database.__loadItemDefinitions
   * Loads items from the combined item.xml and items.otbm. These were merged to a JSON file using a tool.
   */

  let reference = new Object();

  // Create a thing prototype
  Object.entries(this.readDataDefinition(definition)).forEach(function ([key, value]) {
    reference[key] = new ThingPrototype(value);
  });

  return reference;

}

Database.prototype.__createClassFromId = function (id) {

  /*
   * Function Database.__createClassFromId
   * Creates the appropriate class entity for a particular identifier
   */

  // Create a wrapper for easy lookup
  let proto = this.getThingPrototype(id);

  if (proto.properties === null) {
    return new Item(id);
  }

  // Determine class from type, then fall back to group
  var type = proto.properties.type;

  if (type === "keyring") {
    return new KeyRing(id, Number(proto.properties.containerSize) || 20);
  }

  if (proto.group === 0x0C) {
    return new FluidContainer(id);
  }

  if (proto.group === 0x02 || type === "container" || type === "depot" || proto.properties.corpseType) {
    if (type === "corpse" || proto.properties.corpseType) {
      return new Corpse(id, Number(proto.properties.containerSize) || 20);
    }
    return new Container(id, Number(proto.properties.containerSize) || 20);
  }

  // Specific mapping of thing types to classes
  switch (type) {
    case "corpse": return new Corpse(id, Number(proto.properties.containerSize) || 4);
    case "rune": return new Rune(id);
    case "key": return new Key(id);
    case "door": return new Door(id);
    case "readable": return new Readable(id);
    case "teleport": return new Teleporter(id);
    case "mailbox": return new Item(id);
    case "fluidContainer": return new FluidContainer(id);
    default: return new Item(id);
  }

}

Database.prototype.readDataDefinition = function (definition) {

  /*
   * Function Database.readDataDefinition
   * Loads a JSON definition file from a particular folder
   */

  return JSON.parse(fs.readFileSync(getDataFile(definition, "definitions.json")));

}

module.exports = Database;
