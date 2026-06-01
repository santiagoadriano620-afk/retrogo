const fs = require("fs");
const { TileFlag } = require("../utils/bitflag");

function log(module, action, data) {
  try {
    var l = process.gameServer && process.gameServer.logger;
    if (l) l.info(module, action, data);
  } catch (e) {}
}

const House = function(id, entry) {

  /*
   * Class House
   * Wrapper for a player-ownable house
   */

  this.id = id;

  this.name = entry.name;
  this.owner = entry.owner || "";
  this.invited = entry.invited || [];
  this.exit = entry.exit;
  this.rent = entry.rent || 0;
  this.guildhall = entry.guildhall || false;
  this.rentDueDate = entry.rentDueDate || null;
  this.rentPending = entry.rentPending || false;
  this.rentPrice = entry.rentPrice || 0;
  this.sellPrice = entry.sellPrice || 0;
  this.forRent = entry.forRent || false;
  this.forSale = entry.forSale || false;
  this.boughtOutright = entry.boughtOutright || false;
  this.finalWarningSent = entry.finalWarningSent || false;
  this.renterName = entry.renterName || "";
  this.rentStartDate = entry.rentStartDate || null;
  this.ownerReclaimDate = entry.ownerReclaimDate || null;

  // Save a reference to all the tiles in the house
  this.tiles = new Array();

}

House.prototype.setOwner = function(player) {

  /*
   * Function House.setOwner
   * Updates the owner of the house
   */

  log("house", "set_owner", {
    house: this.name,
    houseId: this.id,
    oldOwner: this.owner || "none",
    newOwner: player ? player.name : "none"
  });

  // Evict all players and items from the emptied house
  this.__evictAllPlayers();
  this.__evictAllItems();

  if(player === null) {
    this.owner = "";
  } else {
    this.owner = player.name;
  }

  this.invited = new Array();
  this.rentDueDate = null;
  this.rentPending = false;
  this.boughtOutright = false;
  this.finalWarningSent = false;
  this.renterName = "";
  this.rentStartDate = null;
  this.ownerReclaimDate = null;

}

House.prototype.save = function () {
  let filePath = getDataFile("houses", "definitions", this.id + ".json");
  fs.writeFileSync(filePath, JSON.stringify(this.toJSON(), null, 4));
};

House.prototype.__evictAllItems = function() {

  /*
   * Function House.__evictAllItems
   * Moves all pickupable items to the inbox
   */

  if(!this.owner) return;

  let owner = process.gameServer.world.creatureHandler.getPlayerByName(this.owner);

  // Check whether the player is online or offline
  if(owner === null) {
    return this.__evictAllItemsOffline(this.owner);
  } else {
    return this.__evictAllItemsOnline(owner);
  }

}

House.prototype.__evictAllItemsOffline = function(owner) {

  /*
   * Function House.__evictAllItemsOffline
   * Updates the player account if the player is offline
   */

  let items = new Array();

  this.tiles.forEach(function(tile) {

    if (!tile.itemStack) return;

    // Get all items that can be picked up
    tile.itemStack.__items.filter(function(thing) {
      return thing.isPickupable();
    }).forEach(function(thing) {

      // Delete each item
      tile.__deleteThing(thing);
      items.push(thing.toJSON());

    });

  });

  // Add each item to the player's depot via the account database
  let accountDb = process.gameServer.HTTPServer.websocketServer.accountDatabase;
  items.forEach(function(item) {
    accountDb.updateCharacterDepot(owner, item, function(error) {
      if(error) {
        console.error("Failed to add item to depot for " + owner);
      }
    });
  });

}

House.prototype.__evictAllItemsOnline = function(owner) {

  /*
   * Function House.__evictAllItemsOnline
   * Moves all pickupable items to the player's depot (fallback to inbox)
   */

  let depot = owner.player.containerManager.depot;
  let inbox = owner.player.containerManager.inbox;

  this.tiles.forEach(function(tile) {

    if (!tile.itemStack) return;

    tile.itemStack.__items.filter(function(thing) {
      return thing.isPickupable();
    }).forEach(function(thing) {

      tile.__deleteThing(thing);

      // Try depot first; fallback to inbox
      if (!depot.addFirstEmpty(thing)) {
        inbox.addThing(thing);
      }

    });

  });

}

House.prototype.__evictAllItemsToBackpacks = function (player) {

  let depot = player.containerManager.depot;
  let items = new Array();
  let BACKPACK_SIZE = 20;

  this.tiles.forEach(function(tile) {
    if (!tile.itemStack) return;
    tile.itemStack.__items.filter(function(thing) {
      return thing.isPickupable();
    }).forEach(function(thing) {
      tile.__deleteThing(thing);
      items.push(thing);
    });
  });

  while (items.length > 0) {
    let bp = process.gameServer.database.createThing(1988);
    if (!bp) break;
    for (let i = 0; i < BACKPACK_SIZE && items.length > 0; i++) {
      bp.addThingSmart(items.shift());
    }
    depot.addFirstEmpty(bp);
  }

}

House.prototype.__evictAllPlayers = function() {

  /*
   * Function House.__evictAllPlayers
   * Evicts all players from the house to the exit tile
   */

  this.tiles.forEach(function(tile) {
    tile.players.forEach(function(player) {
      process.gameServer.world.teleportCreature(player, this.exit);
      process.gameServer.world.sendMagicEffect(player.position, CONST.EFFECT.MAGIC.TELEPORT);
    }, this);
  }, this);

}

House.prototype.toJSON = function() {

  /*
   * Function House.toJSON
   * Implements the toJSON API and serializes the house metadata like owner and exit tile
   */

  return new Object({
    "owner": this.owner,
    "rent": this.rent,
    "exit": this.exit,
    "invited": this.invited,
    "name": this.name,
    "guildhall": this.guildhall,
    "rentDueDate": this.rentDueDate,
    "rentPending": this.rentPending,
    "rentPrice": this.rentPrice,
    "sellPrice": this.sellPrice,
    "forRent": this.forRent,
    "forSale": this.forSale,
    "boughtOutright": this.boughtOutright,
    "finalWarningSent": this.finalWarningSent,
    "renterName": this.renterName,
    "rentStartDate": this.rentStartDate,
    "ownerReclaimDate": this.ownerReclaimDate
  });

}

House.prototype.isOwnedBy = function(player) {

  /*
   * Function House.isOwnedBy
   * Adds a tile reference to the house
   */

  return this.owner === player.name;

}

House.prototype.addTile = function(tile) {

  /*
   * Function House.addTile
   * Adds a tile reference to the house
   */

  this.tiles.push(tile);

  // Circular reference
  tile.house = this;

  // Mark tile with guildhall flag
  if (this.guildhall && tile.tilezoneFlags) {
    tile.tilezoneFlags.set(TileFlag.prototype.flags.TILESTATE_GUILDHALL);
  }

}

House.prototype.countBeds = function () {

  let count = 0;
  this.tiles.forEach(function (tile) {
    if (!tile.hasItems()) return;
    tile.itemStack.__items.forEach(function (item) {
      let proto = process.gameServer.database.getThingPrototype(item.id);
      if (proto && proto.properties && proto.properties.type === "bed") count++;
    });
  });
  return Math.floor(count / 2);

}

module.exports = House;