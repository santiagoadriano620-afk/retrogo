"use strict";

const ShopManager = function () {

  /*
   * Class ShopManager
   * Manages all active player shops in the game world
   */

  this.activeShops = new Map();

}

ShopManager.prototype.SHOP_RANGE = 1;

ShopManager.prototype.getShop = function (playerId) {
  return this.activeShops.get(playerId) || null;
}

ShopManager.prototype.getShopByPlayerId = function (playerId) {
  return this.activeShops.get(playerId) || null;
}

ShopManager.prototype.hasShopAtPosition = function (position) {
  for (let shop of this.activeShops.values()) {
    if (shop.position.isInRange(position, this.SHOP_RANGE)) {
      return true;
    }
  }
  return false;
}

ShopManager.prototype.createShop = function (player, shopName, items) {
  let position = player.position;

  if (this.hasShopAtPosition(position)) {
    return player.sendCancelMessage("There is another shop too close. You need at least 1 empty tile between shops.");
  }

  if (!shopName || shopName.length === 0) {
    return player.sendCancelMessage("You must define a name for your market.");
  }

  if (shopName.length < 3 || shopName.length > 30) {
    return player.sendCancelMessage("The shop name must be between 3 and 30 characters.");
  }

  if (/[^a-zA-Z0-9 ]/.test(shopName)) {
    return player.sendCancelMessage("The shop name can only contain letters and numbers.");
  }

  if (items.length === 0) {
    return player.sendCancelMessage("You must add at least one item to your shop.");
  }

  if (items.length > 20) {
    return player.sendCancelMessage("You can only have up to 20 items in your shop.");
  }

  let shopData = {
    ownerId: player.getId(),
    ownerName: player.getProperty(CONST.PROPERTIES.NAME),
    shopName: shopName,
    position: position,
    items: items.slice(),
    earnings: 0,
    earningsRetro: 0,
    buyers: new Set()
  };

  this.activeShops.set(player.getId(), shopData);

  return shopData;
}

ShopManager.prototype.buyItem = function (buyer, sellerId, itemIndex, count, useRetro) {
  let shop = this.activeShops.get(sellerId);
  if (!shop) {
    return { success: false, message: "This shop is no longer available." };
  }

  if (itemIndex < 0 || itemIndex >= shop.items.length) {
    return { success: false, message: "This item is no longer available." };
  }

  let offer = shop.items[itemIndex];
  if (!offer || offer.count < count) {
    return { success: false, message: "This item is no longer available in the requested quantity." };
  }

  let price = (useRetro ? offer.priceRetro : offer.priceGold) * count;
  if (price <= 0) {
    return { success: false, message: "This item is not for sale with " + (useRetro ? "Retro Gold Coins" : "gold coins") + "." };
  }

  // Check currency FIRST
  let currencyId = useRetro ? 3147 : 2148;
  let backpack = buyer.containerManager.equipment.peekIndex(CONST.EQUIPMENT.BACKPACK);
  if (backpack === null) {
    return { success: false, message: "You need a backpack to carry items." };
  }
  if (!buyer.containerManager.equipment.hasSufficientResources(currencyId, price)) {
    let currencyName = useRetro ? "Retro Gold Coins" : "gold coins";
    return { success: false, message: "You do not have enough " + currencyName + "." };
  }

  // Then check capacity
  let testItem = process.gameServer.database.createThing(offer.id);
  let weightPerUnit = testItem.getWeight();
  let totalWeightInOz = (weightPerUnit * count) / 100;
  if (buyer.getCapacity() < totalWeightInOz) {
    return { success: false, message: "You do not have enough capacity to carry this item." };
  }

  // Finally check inventory space
  if (testItem.isStackable()) {
    testItem.setCount(count);
    if (!buyer.containerManager.equipment.__hasSpaceRecursive(backpack, testItem)) {
      return { success: false, message: "You do not have enough space in your inventory." };
    }
  } else {
    let freeSlots = buyer.containerManager.equipment.__countFreeSlotsRecursive(backpack);
    if (freeSlots < count) {
      return { success: false, message: "You do not have enough space in your inventory." };
    }
  }

  // Deduct currency
  buyer.payWithResource(currencyId, price);

  // Give item(s) to buyer
  let thing = process.gameServer.database.createThing(offer.id);
  if (offer.actionId) {
    thing.setActionId(offer.actionId);
  }
  if (thing.isStackable()) {
    thing.setCount(count);
    buyer.containerManager.equipment.pushItem(thing);
  } else {
    for (let i = 0; i < count; i++) {
      let single = process.gameServer.database.createThing(offer.id);
      if (offer.actionId) {
        single.setActionId(offer.actionId);
      }
      buyer.containerManager.equipment.pushItem(single);
    }
  }

  // Update offer count
  offer.count -= count;
  if (offer.count <= 0) {
    shop.items.splice(itemIndex, 1);
  }

  // Track earnings for seller
  if (useRetro) {
    shop.earningsRetro += price;
  } else {
    shop.earnings += price;
  }

  this.activeShops.set(sellerId, shop);

  return { success: true, message: "Purchase successful!" };
}

ShopManager.prototype.closeShop = function (player) {
  let shop = this.activeShops.get(player.getId());
  if (!shop) {
    return false;
  }

  this.activeShops.delete(player.getId());

  return true;
}

ShopManager.prototype.notifyBuyersShopClosed = function (shop) {
  let { MarketClosedPacket } = requireModule("network/protocol");
  for (let buyerId of shop.buyers) {
    let buyer = gameServer.world.creatureHandler.getCreatureFromId(buyerId);
    if (buyer && buyer.write) {
      buyer.write(new MarketClosedPacket("This shop is no longer available."));
    }
  }
  shop.buyers.clear();
}

ShopManager.prototype.returnItemsAndEarnings = function (player) {
  let shop = this.activeShops.get(player.getId());
  if (!shop) {
    return;
  }

  this.notifyBuyersShopClosed(shop);

  let backpack = player.containerManager.equipment.peekIndex(CONST.EQUIPMENT.BACKPACK);
  if (!backpack) {
    return;
  }

  if (shop.earnings > 0) {
    player.containerManager.equipment.__addChange(backpack, shop.earnings);
  }

  if (shop.earningsRetro > 0) {
    let thing = process.gameServer.database.createThing(3147);
    thing.setCount(shop.earningsRetro);
    if (!player.containerManager.equipment.canPushItem(thing)) {
      gameServer.world.addTopThing(player.position, thing);
    } else {
      player.containerManager.equipment.pushItem(thing);
    }
  }

  player.setStorage("__marketData", null);
  this.activeShops.delete(player.getId());
}

ShopManager.prototype.returnItemsFromData = function (player, data) {
  let backpack = player.containerManager.equipment.peekIndex(CONST.EQUIPMENT.BACKPACK);
  if (!backpack) return;

  let earnings = data.earnings || 0;
  if (earnings > 0) {
    player.containerManager.equipment.__addChange(backpack, earnings);
  }

  let earningsRetro = data.earningsRetro || 0;
  if (earningsRetro > 0) {
    let thing = process.gameServer.database.createThing(3147);
    thing.setCount(earningsRetro);
    if (!player.containerManager.equipment.canPushItem(thing)) {
      gameServer.world.addTopThing(player.position, thing);
    } else {
      player.containerManager.equipment.pushItem(thing);
    }
  }
}

ShopManager.prototype.getShopDataForBuyer = function (sellerId) {
  let shop = this.activeShops.get(sellerId);
  if (!shop) return null;

  return {
    ownerName: shop.ownerName,
    shopName: shop.shopName,
    items: shop.items.map(function (item, index) {
      return {
        index: index,
        id: item.id,
        name: item.name,
        count: item.count,
        priceGold: item.priceGold,
        priceRetro: item.priceRetro
      };
    })
  };
}

ShopManager.prototype.saveShopData = function (player) {
  let shop = this.activeShops.get(player.getId());
  if (!shop) return;

  let data = JSON.stringify({
    shopName: shop.shopName,
    items: shop.items,
    earnings: shop.earnings,
    earningsRetro: shop.earningsRetro
  });

  player.setStorage("__marketData", data);
}

ShopManager.prototype.loadShopData = function (player) {
  let data = player.getStorage("__marketData");
  if (!data) return null;

  try {
    let parsed = JSON.parse(data);
    player.setStorage("__marketData", null);
    return parsed;
  } catch (e) {
    return null;
  }
}

module.exports = ShopManager;
