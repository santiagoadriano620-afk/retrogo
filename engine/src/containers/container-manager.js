"use strict";

const GiftContainer = requireModule("containers/gift-container");
const DepotContainer = requireModule("containers/depot");
const Equipment = requireModule("containers/equipment");
const Thing = requireModule("entities/thing");
const Inbox = requireModule("containers/inbox");

const ContainerManager = function (player, containers) {

  /*
   * Class ContainerManager
   * Manager for all the containers that a player has opened (e.g., depot, backpacks, equipment, corpses)
   *
   * API:
   *
   * ContainerManager.getContainerFromId(cid) - Returns the container from a unique container identifier
   * ContainerManager.toggleContainer(container) - Toggles a container between opened/closed
   * ContainerManager.closeAll() - Closes all opened containers (e.g., when logging out)
   * ContainerManager.checkContainer(container) - Checks whether a single container can still be opened by the player (e.g., after container move)
   * ContainerManager.checkContainers() - Checks whether all containers can still be opened by the player (e.g., after player move)
   *
   */

  // Must circular reference the player
  this.__player = player;

  // Keep a set of the opened containers
  this.__openedContainers = new Map();

  // Depots and equipments are owned by individual players
  this.depot = new DepotContainer(CONST.CONTAINER.DEPOT, containers.depot);
  this.equipment = new Equipment(CONST.CONTAINER.EQUIPMENT, player, containers.equipment);
  this.inbox = new Inbox(player, containers.inbox);
  this.giftContainer = new GiftContainer(CONST.CONTAINER.GIFT, containers.giftContainer || [], this.__player);

}

ContainerManager.prototype.MAXIMUM_OPENED_CONTAINERS = 5;

ContainerManager.prototype.toJSON = function () {

  /*
   * Function ContainerManager.toJSON
   * Serializes the container manager
   */

  return new Object({
    "depot": this.depot,
    "equipment": this.equipment,
    "inbox": this.inbox,
    "giftContainer": this.giftContainer
  });

}

ContainerManager.prototype.getContainerFromId = function (cid) {

  /*
   * Function Player.getContainerFromId
   * Returns the container that is referenced by a unique identifier
   */

  // Simple mapping of the container identifier
  switch (cid) {
    case CONST.CONTAINER.DEPOT: return (this.depot.isClosed() ? null : this.depot);
    case CONST.CONTAINER.EQUIPMENT: return this.equipment;
    case CONST.CONTAINER.GIFT: return this.__openedContainers.has(this.giftContainer.container.guid) ? this.giftContainer : null;
    default: return this.__getContainer(cid);
  }

}

ContainerManager.prototype.toggleContainer = function (container) {

  /*
   * Function ContainerManager.toggleContainer
   * Toggles a container between open and closed
   */

  // Handle depot items first - they don't have a .container property like regular containers
  if (container.isDepot && container.isDepot()) {
    if (this.__openedContainers.has(CONST.CONTAINER.DEPOT)) {
      return this.closeContainer(this.depot);
    }
    return this.__openContainer(container);
  }

  // For regular containers, check if already opened using container.container.guid
  if (container.container && this.__openedContainers.has(container.container.guid)) {
    return this.closeContainer(container);
  }

  return this.__openContainer(container);

}

ContainerManager.prototype.toggleGiftContainer = function () {
  let guid = this.giftContainer.container.guid;
  if (this.__openedContainers.has(guid)) {
    return this.closeContainer(this.giftContainer);
  }
  this.__openedContainers.set(guid, this.giftContainer);
  this.__player.openContainer(CONST.CONTAINER.GIFT, "Gifts", this.giftContainer.container);
};

ContainerManager.prototype.cleanup = function () {

  /*
   * Function ContainerManager.cleanup
   * Closes all the containers that are opened by the player
   */

  // Close all opened containers
  this.__openedContainers.forEach(container => this.closeContainer(container));

}

ContainerManager.prototype.checkContainer = function (container) {

  /*
   * Function ContainerManager.checkContainer
   * Confirms whether a player can still see a container and keep it open
   */

  // Walk up a nested container chain to get the parent tile or character
  let parentThing = container.getTopParent();

  // Close the container if the parent chain is broken (e.g., parent was removed)
  if (!parentThing) {
    return this.closeContainer(container);
  }

  // The parent is the player and can always remain opened
  if (parentThing === this.__player) {
    return;
  }

  // If the parent is a depot but the depot is closed we need to eliminate the container
  if (parentThing === this.depot && this.depot.isClosed()) {
    return this.closeContainer(container);
  }

  // The container is on a tile and not besides the player anymore
  if (!this.__player.isBesidesThing(parentThing)) {
    return this.closeContainer(container);
  }

}

ContainerManager.prototype.checkContainers = function () {

  /*
   * Function ContainerManager.checkContainers
   * Goes over all the containers to check whether they can still be opened by the character
   */

  this.__openedContainers.forEach(this.checkContainer, this);

}

ContainerManager.prototype.closeContainer = function (container) {

  /*
   * Function ContainerManager.closeContainer
   * Closes a container and writes it to disk
   */

  // Use container.container.guid as key (matches __openContainer)
  let containerGuid = container.container ? container.container.guid : container.id;

  // Guard
  if (!this.__openedContainers.has(containerGuid)) {
    return;
  }

  // Deference the container in a circular way
  this.__openedContainers.delete(containerGuid);

  // Close the container
  if (container === this.depot) {
    this.depot.openAtPosition(null);
    this.__player.closeContainer(this.depot.container);
  } else {
    this.__player.closeContainer(container.container);
  }

}

ContainerManager.prototype.__getContainer = function (cid) {

  /*
   * Function ContainerManager.__getContainer
   * Finds a container by completing a linear search in all opened containers
   */

  if (!this.__openedContainers.has(cid)) {
    return null;
  }

  return this.__openedContainers.get(cid);

}

ContainerManager.prototype.giveChestReward = function (aid) {
  const chestData = gameServer.questDataLoader.getChestData(aid);
  if (!chestData) return false;

  const storageKey = chestData.storageValue;
  if (storageKey === undefined) return false;
  if (this.__player.getStorage(storageKey) > 0) {
    this.__player.sendCancelMessage("You already collected this reward.");
    return false;
  }

  let totalWeight = 0;
  let rewardItems = [];
  let entries = [];

  if (chestData.content && Array.isArray(chestData.content) && chestData.content.length > 0) {
    entries = chestData.content;
  } else if (chestData.item) {
    entries = [chestData.item];
  }

  for (const entry of entries) {
    try {
      const thing = gameServer.database.parseThing(entry);
      if (!thing) continue;
      if (entry.keynumber !== undefined) thing.setActionId(entry.keynumber);
      if (entry.subtype !== undefined && thing.setFluidType) {
        thing.setFluidType(entry.subtype);
      } else if (entry.subtype !== undefined) {
        thing.setCount(entry.subtype);
      }
      if (entry.text !== undefined && thing.setContent) {
        thing.setContent(entry.text);
      }
      totalWeight += thing.getWeight();
      rewardItems.push(thing);
    } catch (e) {
      console.error("[Chest] Error creating item: %s".format(e.message));
    }
  }

  if (rewardItems.length === 0) return false;

  let weightOz = totalWeight / 100;
  let freeCap = this.__player.getCapacity();
  let hasCap = freeCap >= weightOz;

  let backpack = this.__player.containerManager.equipment.peekIndex(6);
  let hasBackpack = backpack !== null;
  let needSlot = rewardItems.length > 1;
  let hasSlot = !hasBackpack || !needSlot || !backpack.container.isFull();

  if (!hasCap && !hasSlot) {
    this.__player.sendCancelMessage("You need more capacity and a free slot to get your reward.");
    return false;
  }
  if (!hasCap) {
    this.__player.sendCancelMessage("You need more capacity to get your reward.");
    return false;
  }
  if (!hasSlot) {
    this.__player.sendCancelMessage("You need a free slot to get your reward.");
    return false;
  }

  if (!hasBackpack) {
    let bp = gameServer.database.createThing(1987);
    if (!bp) return false;
    this.__player.containerManager.equipment.addThing(bp, 6);
    backpack = bp;
  }

  for (const thing of rewardItems) {
    backpack.addThingSmart(thing);
  }

  this.__player.sendCancelMessage("You have received your reward.");
  this.__player.setStorage(storageKey, 1);
  return true;
}

ContainerManager.prototype.__populateChestIfNeeded = function (container) {
  let tile = container.getParent ? container.getParent() : null;
  let aid = container.actionId || (tile ? tile.actionId : 0);
  if (!aid) return true;
  if (!gameServer.questDataLoader.getChestData(aid)) return true;

  if (this.giveChestReward(aid)) {
    return false;
  }
  return false;
}

ContainerManager.prototype.__openContainer = function (container) {

  /*
   * Function ContainerManager.__openContainer
   * Writes packet to open a container
   */

  // A maximum of N containers can be referenced
  if (this.__openedContainers.size >= this.MAXIMUM_OPENED_CONTAINERS) {
    return this.__player.sendCancelMessage("You cannot open any more containers.");
  }

  // Handle depot items first - they don't have a .container property
  if (container.isDepot && container.isDepot()) {
    // Sanity check for opening two depots
    if (!this.depot.isClosed()) {
      return this.__player.sendCancelMessage("You already have another depot opened.");
    }
    // Open the depot at the position
    this.__openedContainers.set(CONST.CONTAINER.DEPOT, this.depot);
    this.depot.openAtPosition(container.getPosition());
    return this.__player.openContainer(container.id, "Depot", this.depot.container);
  }

  // For regular containers, check if already opened using container.container.guid
  if (container.container && this.__openedContainers.has(container.container.guid)) {
    return;
  }

  // Open a regular container (quest chests prevent opening)
  if (container.container) {
    if (this.__populateChestIfNeeded(container) === false) return;
    this.__openedContainers.set(container.container.guid, container);
    return this.__player.openContainer(container.id, container.getName(), container.container);
  }

}

ContainerManager.prototype.pickupItem = function (item) {

  /*
   * Function ContainerManager.pickupItem
   * Picks up an item following Tibia 7.4 behavior:
   * - Ammunition goes to the QUIVER slot first (if empty or same item)
   * - Otherwise tries the backpack (stacking with existing stacks)
   * - If no space anywhere, drops to the ground at the player's feet
   */

  let proto = item.getPrototype();

  // 1. Ammunition goes to the QUIVER slot if empty or has matching stack
  if (proto && proto.properties && proto.properties.weaponType === "ammunition") {
    let quiverItem = this.equipment.peekIndex(CONST.EQUIPMENT.QUIVER);
    if (quiverItem === null || (quiverItem.id === item.id && item.isStackable())) {
      this.equipment.addThing(item, CONST.EQUIPMENT.QUIVER);
      return true;
    }
  }

  // 2. Keyring auto-collect for keys with actionId
  if (item.constructor.name === "Key" && item.hasOwnProperty("actionId")) {
    let keyring = this.findKeyRing();
    if (keyring !== null && keyring.addThingSmart(item)) {
      return true;
    }
  }

  // 3. Try the backpack
  let backpack = this.equipment.peekIndex(CONST.EQUIPMENT.BACKPACK);
  if (backpack !== null && backpack.container) {
    if (backpack.addThingSmart(item)) {
      return true;
    }
  }

  // 4. No space — drop to ground at the player's feet
  if (this.__player) {
    gameServer.world.addTopThing(this.__player.position, item);
  }
  return true;

}

ContainerManager.prototype.findItemById = function (itemId) {

  /*
   * Function ContainerManager.findItemById
   * Finds an item by its unique Thing ID in equipment, backpack, and opened containers
   */

  // Search in equipment slots using peekIndex
  for (let i = 0; i < 10; i++) {
    let item = this.equipment.peekIndex(i);
    if (item !== null && item.id === itemId) {
      return item;
    }
    // Check if item is a container with contents
    if (item !== null && item.container) {
      let found = this.__searchContainerForItem(item.container, itemId);
      if (found !== null) {
        return found;
      }
    }
  }

  // Search in opened containers
  for (let [guid, container] of this.__openedContainers) {
    if (!container || !container.container) {
      continue;
    }
    let found = this.__searchContainerForItem(container.container, itemId);
    if (found !== null) {
      return found;
    }
  }

  // Search in depot
  if (!this.depot.isClosed()) {
    let found = this.__searchContainerForItem(this.depot.container, itemId);
    if (found !== null) {
      return found;
    }
  }

  return null;

}

ContainerManager.prototype.__searchContainerForItem = function (container, itemId) {

  /*
   * Function ContainerManager.__searchContainerForItem
   * Recursively searches a container for an item by ID
   */

  if (!container || !container.__slots) {
    return null;
  }

  for (let i = 0; i < container.__slots.length; i++) {
    let item = container.__slots[i];
    if (item === null) {
      continue;
    }
    if (item.id === itemId) {
      return item;
    }
    // Recursively search nested containers
    if (item.container) {
      let found = this.__searchContainerForItem(item.container, itemId);
      if (found !== null) {
        return found;
      }
    }
  }

  return null;

}

ContainerManager.prototype.findKeyRing = function () {

  /*
   * Function ContainerManager.findKeyRing
   * Searches the player's backpack and nested containers for a KeyRing item
   */

  let backpack = this.equipment.peekIndex(CONST.EQUIPMENT.BACKPACK);
  if (backpack !== null && backpack.container) {
    return this.__searchContainerForKeyRing(backpack.container);
  }

  return null;

}

ContainerManager.prototype.__searchContainerForKeyRing = function (container) {

  if (!container || !container.__slots) {
    return null;
  }

  for (let i = 0; i < container.__slots.length; i++) {
    let item = container.__slots[i];
    if (item === null) {
      continue;
    }
    if (item.constructor.name === "KeyRing") {
      return item;
    }
    if (item.container) {
      let found = this.__searchContainerForKeyRing(item.container);
      if (found !== null) {
        return found;
      }
    }
  }

  return null;

}

module.exports = ContainerManager;
