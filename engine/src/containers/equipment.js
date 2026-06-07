"use strict";

const Item = requireModule("entities/item");
const BaseContainer = requireModule("containers/base-container");
const Condition = requireModule("combat/condition");
const Enum = requireModule("utils/enum");

const Equipment = function (cid, player, equipment) {
  /*
   * Class Equipment
   * Container for player equipment that can contain items and keep state of all equipped attributes
   *
   * API:
   *
   * Equipment.peekIndex(index) - Looks what is equipped at the requested index (see Equipment.SLOTS)
   * Equipment.isAmmunitionEquipped() - Returns true if the correct ammunition is equipped
   *
   */

  // Save a circular reference to the player
  this.__player = player;

  // A base container to keep all the items
  this.container = new BaseContainer(cid, 10);

  // Add the equipment from the database
  this.__addEquipment(equipment);

  // Self spectate changes to the equipment always
  this.container.spectators.add(player);

  // Life ring regeneration event
  this.__lifeRingEvent = null;
};

Equipment.prototype.getTopParent = function () {
  /*
   * Function Equipment.getTopParent
   * Returns the top parent of the equipment which is the player
   */

  return this.__player;
};

Equipment.prototype.getParent = function () {
  /*
   * Function Equipment.getParent
   * The parent of the container is always the player
   */

  return this.__player;
};

Equipment.prototype.getWeapon = function () {
  /*
   * Function Equipment.getWeapon
   * Returns the equipped weapon and its slot from LEFT or RIGHT
   */

  let slots = [CONST.EQUIPMENT.LEFT, CONST.EQUIPMENT.RIGHT];
  let WEAPON_TYPES = ["sword", "club", "axe", "distance"];
  for (let slot of slots) {
    let item = this.peekIndex(slot);
    if (item !== null && WEAPON_TYPES.includes(item.getAttribute("weaponType"))) {
      return { weapon: item, slot };
    }
  }
  return null;
};

Equipment.prototype.toJSON = function () {
  /*
   * Function Equipment.toJSON
   * Implements the JSON.Stringify interface that is called when the player is serialized
   */

  // Simply return the slots which is an array of items
  return this.container.__slots
    .map(function (item, index) {
      if (item === null) {
        return null;
      }

      return new Object({
        slot: index,
        item: item,
      });
    })
    .nullfilter();
};

Equipment.prototype.handleChangeOnEquip = function (thing, change) {
  let newThing = process.gameServer.database.createThing(change);
  thing.copyProperties(newThing);

  thing.cleanup();

  return newThing;
};

Equipment.prototype.handleChangeThing = function (thing, change) {
  /*
   * Function Equipment.handleChangeThing
   * Handles changing an item on equip event
   */

  let newThing = gameServer.database.createThing(change);

  // Copy over the properties
  thing.copyProperties(newThing);

  // Clean up the item
  thing.cleanup();

  return newThing;
};

Equipment.prototype.removeIndex = function (index, count) {
  /*
   * Function Equipment.removeIndex
   * Implements the removeIndex API that handles removal of an item by the index and amount
   */

  let thing = this.peekIndex(index);

  if (thing === null) {
    return null;
  }

  // If stackable and removing partial amount, BaseContainer logic is safe (it replaces in place)
  if (thing.isStackable() && count < thing.count) {
    return this.container.removeIndex(index, count);
  }

  // CRITICAL FIX: BaseContainer.removeIndex shifts items (like a backpack), which corrupts equipment slots.
  // We must manually remove the item from the fixed slot without shifting.

  // 1. Clear the slot
  this.container.__slots[index] = null;

  // 2. Notify spectators
  const { ContainerRemovePacket } = requireModule("network/protocol");
  this.container.__informSpectators(new ContainerRemovePacket(this.container.guid, index, 0));

  // 3. Update player state (Weight, Parent, Conditions)
  this.__updateWeight(-thing.getWeight());
  thing.setParent(null);

  // If removed item was a lit torch from quiver, remove the light condition
  const LIT_TORCH_IDS = [2051, 2053, 2055, 2042, 2045, 2048, 2163]; // lit torches, candelabrum, lamp, candlestick, magic lightwand
  if (index === CONST.EQUIPMENT.QUIVER && LIT_TORCH_IDS.includes(thing.id)) {
    this.__player.removeCondition(Condition.prototype.LIGHT);
  }

  // Removed thing has attribute invisible?
  if (thing.getAttribute("invisible")) {
    this.__player.removeCondition(Condition.prototype.INVISIBLE);
  }

  if (thing.getAttribute("suppressDrunk")) {
    this.__player.removeCondition(Condition.prototype.SUPPRESS_DRUNK);
  }

  if (thing.getAttribute("manashield")) {
    this.__player.removeCondition(Condition.prototype.MAGIC_SHIELD);
  }

  // Stop life ring regeneration if removing from ring slot
  if (index === CONST.EQUIPMENT.RING) {
    this.__stopLifeRing();
    // Update skill display to remove ring bonuses
    if (this.__player.__resendAllRingSkills) {
      this.__player.__resendAllRingSkills();
    }
  }

  // Check if removed item had speed bonus - broadcast updated speed
  if (thing.getAttribute("speed")) {
    const { CreaturePropertyPacket } = requireModule("network/protocol");
    let newSpeed = this.__player.getSpeed();
    this.__player.broadcast(
      new CreaturePropertyPacket(this.__player.getId(), CONST.PROPERTIES.SPEED, newSpeed)
    );
    this.__player.write(
      new CreaturePropertyPacket(this.__player.getId(), CONST.PROPERTIES.SPEED, newSpeed)
    );
  }

  // Duration item unequipped: save remaining time so it persists across moves
  if (thing.isTrainingWeapon && thing.isTrainingWeapon()) {
    if (thing.__equipTime) {
      let elapsed = Date.now() - thing.__equipTime;
      let expiryMs = thing.getTrainingExpiryMs();
      thing.__remainingTrainingMs = Math.max(0, expiryMs - elapsed);
    }
  }
  // Send current remaining so client always has latest data for this slot
  if (thing.getAttribute("showduration") || (thing.isTrainingWeapon && thing.isTrainingWeapon())) {
    try {
      let { TrainTimerPacket } = requireModule("network/protocol");
      let remaining = thing.isTrainingWeapon && thing.isTrainingWeapon()
        ? thing.getRemainingEquipTime()
        : thing.getRemainingDurationSeconds();
      this.__player.write(new TrainTimerPacket(Number(index), remaining));
    } catch (err) {
      console.error("[EQUIPMENT] Failed to send TrainTimerPacket on removeIndex:", err);
    }
  } else {
    // Clear timer when removing a non-timer item
    try {
      let { TrainTimerPacket } = requireModule("network/protocol");
      this.__player.write(new TrainTimerPacket(Number(index), 0));
    } catch (err) {
      // silently ignore
    }
  }

  let change = thing.getChangeOnUnequip();

  // We have to change the item before returning it
  if (change !== null) {
    return this.handleChangeThing(thing, change);
  }

  // Otherwise return the changed item
  return thing;
};

Equipment.prototype.deleteThing = function (thing) {
  /*
   * Function Equipment.deleteThing
   * Implements the deleteThing API that handles removal of an item by its reference
   */

  // Handle removal by thing reference
  let index = this.container.deleteThing(thing);

  if (index === -1) {
    return -1;
  }

  this.__updateWeight(-thing.getWeight());
  thing.setParent(null);

  // Clean up the conditions
  if (thing.getAttribute("invisible")) {
    this.__player.removeCondition(Condition.prototype.INVISIBLE);
  }

  if (thing.getAttribute("suppressDrunk")) {
    this.__player.removeCondition(Condition.prototype.SUPPRESS_DRUNK);
  }

  if (thing.getAttribute("manashield")) {
    this.__player.removeCondition(Condition.prototype.MAGIC_SHIELD);
  }

  // Stop life ring regeneration if removing from ring slot
  if (index === CONST.EQUIPMENT.RING) {
    this.__stopLifeRing();
  }

  // Check if removed item had speed bonus - broadcast updated speed
  if (thing.getAttribute("speed")) {
    const { CreaturePropertyPacket } = requireModule("network/protocol");
    let newSpeed = this.__player.getSpeed();
    this.__player.broadcast(
      new CreaturePropertyPacket(this.__player.getId(), CONST.PROPERTIES.SPEED, newSpeed)
    );
    this.__player.write(
      new CreaturePropertyPacket(this.__player.getId(), CONST.PROPERTIES.SPEED, newSpeed)
    );
  }

  return index;
};

Equipment.prototype.peekIndex = function (index) {
  /*
   * Function Equipment.peekIndex
   * Peeks at the item at the specified slot index
   */

  return this.container.peekIndex(index);
};

Equipment.prototype.getWeaponType = function () {

  /*
   * Function Equipment.getWeaponType
   * Returns the weapon type that is currently equipped
   */

  // Check both hands for a weapon
  let slots = [CONST.EQUIPMENT.LEFT, CONST.EQUIPMENT.RIGHT];

  for (let i = 0; i < slots.length; i++) {

    let item = this.peekIndex(slots[i]);

    if (item === null) {
      continue;
    }

    // Map weapon type to property
    switch (item.getPrototype().properties.weaponType) {
      case "sword":
        return CONST.PROPERTIES.SWORD;
      case "club":
        return CONST.PROPERTIES.CLUB;
      case "axe":
        return CONST.PROPERTIES.AXE;
      case "distance":
        return CONST.PROPERTIES.DISTANCE;
    }

  }

  // Default fallback to fist fighting
  return CONST.PROPERTIES.FIST;

};

Equipment.prototype.__startLifeRing = function (item) {
  if (this.__lifeRingEvent) return;
  if (!this.__player || item.id !== 2205) return;
  let healthGain = parseInt(item.getAttribute("healthGain")) || 1;
  let manaGain = parseInt(item.getAttribute("manaGain")) || 4;
  let tickMs = parseInt(item.getAttribute("healthTicks")) || 3000;
  this.__lifeRingEvent = gameServer.world.eventQueue.addEventMs(
    this.__tickLifeRing.bind(this, healthGain, manaGain),
    tickMs
  );
};

Equipment.prototype.__stopLifeRing = function () {
  if (this.__lifeRingEvent) {
    this.__lifeRingEvent.cancel();
    this.__lifeRingEvent = null;
  }
};

Equipment.prototype.__tickLifeRing = function (healthGain, manaGain) {
  if (!this.__player) return;
  if (!this.__player.isFullHealth()) {
    this.__player.increaseHealth(healthGain);
  }
  if (!this.__player.isFull(CONST.PROPERTIES.MANA)) {
    this.__player.increaseMana(manaGain);
  }
  let ring = this.peekIndex(CONST.EQUIPMENT.RING);
  if (ring && ring.id === 2205) {
    let tickMs = parseInt(ring.getAttribute("healthTicks")) || 3000;
    this.__lifeRingEvent = gameServer.world.eventQueue.addEventMs(
      this.__tickLifeRing.bind(this, healthGain, manaGain),
      tickMs
    );
  } else {
    this.__lifeRingEvent = null;
  }
};

Equipment.prototype.__consumeMightRingCharge = function () {
  let ring = this.peekIndex(CONST.EQUIPMENT.RING);
  if (!ring || ring.id !== 2164) return;
  if (!ring.currentCharges) {
    ring.currentCharges = parseInt(ring.getAttribute("charges")) || 20;
  }
  ring.currentCharges--;
  ring.setCount(ring.currentCharges);
  if (ring.currentCharges <= 0) {
    this.__player.sendCancelMessage("Your might ring crumbles.");
    this.removeIndex(CONST.EQUIPMENT.RING, 1);
  }
};

Equipment.prototype.addThing = function (thing, index) {
  /*
   * Function Equipment.addThing
   * Adds an item to the passed slot index
   */

  // Redirect to backpack container when backpack slot has a container
  if (Number(index) === CONST.EQUIPMENT.BACKPACK) {
    let backpackItem = this.peekIndex(CONST.EQUIPMENT.BACKPACK);
    if (backpackItem !== null && backpackItem.isContainer && backpackItem.isContainer()) {
      // Use Container.addThingSmart (not BaseContainer.addThingSmart) to get __includesSelf cycle check + setParent
      let added = backpackItem.addThingSmart(thing);
      if (!added) {
        return false;
      }
      return true;
    }
  }

  // Guard
  if (!thing.isPickupable()) {
    return false;
  }

  let change = thing.getChangeOnEquip();

  // We have to change the item before adding it
  if (change !== null) {
    thing = this.handleChangeThing(thing, change);
  }

  // The equipped item has a property invisible
  if (thing.getAttribute("invisible")) {
    this.__player.addCondition(Condition.prototype.INVISIBLE, -1, -1, null);
  }

  if (thing.getAttribute("suppressDrunk")) {
    this.__player.addCondition(
      Condition.prototype.SUPPRESS_DRUNK,
      -1,
      -1,
      null
    );
  }

  if (thing.getAttribute("manashield")) {
    this.__player.addCondition(Condition.prototype.MAGIC_SHIELD, -1, -1, null);
  }

  // Training weapon: track equip time (restore from saved remaining on re-equip)
  if (thing.isTrainingWeapon && thing.isTrainingWeapon()) {
    if (thing.__remainingTrainingMs !== undefined) {
      // Restore from saved remaining: set equipTime so elapsed counts correctly
      let remainingFromSaved = thing.__remainingTrainingMs;
      thing.__equipTime = Date.now() - (thing.getTrainingExpiryMs() - remainingFromSaved);
      delete thing.__remainingTrainingMs;
    } else if (!thing.__equipTime) {
      thing.__equipTime = Date.now();
    }
  }

  // Check if it's a lit torch/light source in the quiver slot - add LIGHT condition
  const LIT_TORCH_IDS = [2051, 2053, 2055, 2042, 2045, 2048, 2163]; // lit torches, candelabrum, lamp, candlestick, magic lightwand
  if (index === CONST.EQUIPMENT.QUIVER && LIT_TORCH_IDS.includes(thing.id)) {
    this.__player.addCondition(Condition.prototype.LIGHT, -1, -1, null);
  }

  // Dual-wield block: prevent equipping a weapon if the other hand already has one
  let WEAPON_TYPES = ["sword", "club", "axe", "distance"];
  if ((index === CONST.EQUIPMENT.LEFT || index === CONST.EQUIPMENT.RIGHT)
      && WEAPON_TYPES.includes(thing.getAttribute("weaponType"))) {
    let otherSlot = index === CONST.EQUIPMENT.LEFT ? CONST.EQUIPMENT.RIGHT : CONST.EQUIPMENT.LEFT;
    let otherItem = this.peekIndex(otherSlot);
    if (otherItem !== null && WEAPON_TYPES.includes(otherItem.getAttribute("weaponType"))) {
      this.__player.sendCancelMessage("You may not carry two weapons.");
      return false;
    }
  }

  // Now feel free to add it
  this.container.addThing(thing, index);

  // The things parent is of course the player
  thing.setParent(this);

  // Send duration timer update after item is in slot (per-slot)
  if (thing.getAttribute("showduration") || (thing.isTrainingWeapon && thing.isTrainingWeapon())) {
    try {
      let { TrainTimerPacket } = requireModule("network/protocol");
      let remaining = thing.isTrainingWeapon && thing.isTrainingWeapon()
        ? thing.getRemainingEquipTime()
        : thing.getRemainingDurationSeconds();
      this.__player.write(new TrainTimerPacket(Number(index), remaining));
    } catch (err) {
      console.error("[EQUIPMENT] Failed to send TrainTimerPacket:", err);
    }
  } else {
    // Clear the timer for this slot when equipping a non-timer item
    try {
      let { TrainTimerPacket } = requireModule("network/protocol");
      this.__player.write(new TrainTimerPacket(Number(index), 0));
    } catch (err) {
      // silently ignore
    }
  }

  // Check if item has speed bonus - broadcast updated speed
  // Guard: only broadcast if player is fully initialized (has containerManager.equipment)
  if (thing.getAttribute("speed") && this.__player.containerManager && this.__player.containerManager.equipment) {
    const { CreaturePropertyPacket } = requireModule("network/protocol");
    let newSpeed = this.__player.getSpeed();
    this.__player.broadcast(
      new CreaturePropertyPacket(this.__player.getId(), CONST.PROPERTIES.SPEED, newSpeed)
    );
    this.__player.write(
      new CreaturePropertyPacket(this.__player.getId(), CONST.PROPERTIES.SPEED, newSpeed)
    );
  }

  // Start life ring regeneration if equipped
  if (index === CONST.EQUIPMENT.RING) {
    this.__startLifeRing(thing);
    // Update skill display to include ring bonuses
    if (this.__player.__resendAllRingSkills) {
      this.__player.__resendAllRingSkills();
    }
  }

  // Decrement the capacity
  this.__updateWeight(thing.getWeight());
  return true;
};

Equipment.prototype.getMaximumAddCount = function (player, thing, index) {
  /*
   * Function Equipment.getMaximumAddCount
   * Returns the count of the item that can be added to a tile
   */

  // Backpack slot with existing container: accept any item (will be redirected to backpack container)
  if (Number(index) === CONST.EQUIPMENT.BACKPACK) {
    let currentItem = this.peekIndex(CONST.EQUIPMENT.BACKPACK);
    if (currentItem !== null && currentItem.isContainer && currentItem.isContainer()) {
      return Item.prototype.MAXIMUM_STACK_COUNT;
    }
  }

  // Check whether the item type matches that of the slot
  if (!this.__isRightType(thing, index)) {
    return 0;
  }

  // Take a look at the item in the slot
  let currentItem = this.peekIndex(index);

  // The slot is currently empty, accept the maximum count
  if (currentItem === null) {
    return Item.prototype.MAXIMUM_STACK_COUNT;
  }

  // Not empty but the identifiers match and the item is stackable: return the maximum minus what is already there.
  if (currentItem.id === thing.id && thing.isStackable()) {
    return Item.prototype.MAXIMUM_STACK_COUNT - currentItem.count;
  }

  // Not able to add: another item is occupying the slot
  return 0;
};

Equipment.prototype.isAmmunitionEquipped = function () {
  /*
   * Public Function Equipment.isAmmunitionEquipped
   * Returns true if the player has ammunition equipped
   */

  let ammunition = this.peekIndex(CONST.EQUIPMENT.QUIVER);
  if (ammunition === null) {
    return false;
  }

  let result = this.getWeapon();
  if (result !== null && !result.weapon.isRightAmmunition(ammunition)) {
    return false;
  }

  return true;
};

Equipment.prototype.isDistanceWeaponEquipped = function () {
  /*
   * Public Function Equipment.isDistanceWeaponEquipped
   * Returns true if distance weapon equipped
   */

  let result = this.getWeapon();
  return result !== null && result.weapon.isDistanceWeapon();
};

Equipment.prototype.isShieldEquipped = function () {
  /*
   * Public Function Equipment.isShieldEquipped
   * Returns true if shield equipped
   */

  let slots = [CONST.EQUIPMENT.LEFT, CONST.EQUIPMENT.RIGHT];

  for (let i = 0; i < slots.length; i++) {
    let item = this.peekIndex(slots[i]);
    if (item && item.getPrototype().properties.weaponType === "shield") {
      return true;
    }
  }

  return false;
};

// Currency constants
Equipment.prototype.CURRENCY = {
  GOLD_COIN: 2148,       // 1 gold
  PLATINUM_COIN: 2152,   // 100 gold
  CRYSTAL_COIN: 2160     // 10000 gold
};

Equipment.prototype.getTotalGold = function () {
  /*
   * Function Equipment.getTotalGold
   * Returns the total gold value from all coin types in the player's inventory
   */

  let backpack = this.peekIndex(CONST.EQUIPMENT.BACKPACK);

  if (backpack === null) {
    return 0;
  }

  let goldCoins = this.__countResourceRecursive(backpack, this.CURRENCY.GOLD_COIN);
  let platinumCoins = this.__countResourceRecursive(backpack, this.CURRENCY.PLATINUM_COIN);
  let crystalCoins = this.__countResourceRecursive(backpack, this.CURRENCY.CRYSTAL_COIN);

  return goldCoins + (platinumCoins * 100) + (crystalCoins * 10000);
};

Equipment.prototype.hasSufficientResources = function (resource, amount) {
  /*
   * Function Equipment.hasSufficientResources
   * Returns true if the player has enough gold (counts all coin types)
   */

  // If checking for gold coins, calculate total gold value from all coin types
  if (resource === this.CURRENCY.GOLD_COIN) {
    return this.getTotalGold() >= amount;
  }

  // For other resources, use the old recursive method
  let backpack = this.peekIndex(CONST.EQUIPMENT.BACKPACK);

  if (backpack === null) {
    return false;
  }

  let totalFound = this.__countResourceRecursive(backpack, resource);
  return totalFound >= amount;
};

Equipment.prototype.__countResourceRecursive = function (container, resource, visited) {
  /*
   * Function Equipment.__countResourceRecursive
   * Recursively counts resources in a container and all nested containers
   */

  if (!visited) {
    visited = new Set();
  }

  if (visited.has(container)) {
    return 0;
  }
  visited.add(container);

  let total = 0;

  for (let i = 0; i < container.container.__slots.length; i++) {
    let slot = container.container.__slots[i];

    if (slot === null) {
      continue;
    }

    // Check if this slot is a container (has a container property)
    if (slot.container && slot.container.__slots) {
      total += this.__countResourceRecursive(slot, resource, visited);
    } else if (slot.id === resource) {
      total += slot.count || 1;
    }
  }

  return total;
};

Equipment.prototype.payWithResource = function (resource, amount) {
  /*
   * Function Equipment.payWithResource
   * Pays with gold and gives back proper change in the optimal coin denominations
   */

  let backpack = this.peekIndex(CONST.EQUIPMENT.BACKPACK);

  if (backpack === null) {
    return false;
  }

  // Guard against not sufficient resources
  if (!this.hasSufficientResources(resource, amount)) {
    return false;
  }

  // If paying with gold coins, use the new currency system
  if (resource === this.CURRENCY.GOLD_COIN) {
    return this.__payWithGold(backpack, amount);
  }

  // For other resources, use the old method
  let remainingAmount = this.__removeResourceRecursive(backpack, resource, amount);
  return remainingAmount === 0;
};

Equipment.prototype.__payWithGold = function (backpack, amount) {
  /*
   * Function Equipment.__payWithGold
   * Removes coins to pay the amount and gives change in optimal denominations
   */

  let totalGold = this.getTotalGold();

  if (totalGold < amount) {
    return false;
  }

  // Calculate change to give back
  let change = totalGold - amount;

  // Remove ALL coins first
  this.__removeAllCoins(backpack);

  // Add back proper change in optimal denominations
  this.__addChange(backpack, change);

  return true;
};

Equipment.prototype.__removeAllCoins = function (container) {
  /*
   * Function Equipment.__removeAllCoins
   * Removes all gold, platinum, and crystal coins from a container recursively
   */

  for (let i = container.container.__slots.length - 1; i >= 0; i--) {
    let slot = container.container.__slots[i];

    if (slot === null) {
      continue;
    }

    // Check if this slot is a container (has a container property)
    if (slot.container && slot.container.__slots) {
      this.__removeAllCoins(slot);
    } else if (slot.id === this.CURRENCY.GOLD_COIN ||
      slot.id === this.CURRENCY.PLATINUM_COIN ||
      slot.id === this.CURRENCY.CRYSTAL_COIN) {
      // Remove entire coin stack
      container.removeIndex(i, slot.count);
    }
  }
};

Equipment.prototype.__addChange = function (backpack, amount) {
  /*
   * Function Equipment.__addChange
   * Adds coins in optimal denominations to the backpack
   */

  if (amount <= 0) {
    return;
  }

  // Calculate optimal coin distribution (highest denominations first)
  let crystalCoins = Math.floor(amount / 10000);
  amount = amount % 10000;

  let platinumCoins = Math.floor(amount / 100);
  amount = amount % 100;

  let goldCoins = amount;

  // Add Crystal Coins (in stacks of max 100)
  while (crystalCoins > 0) {
    let stackSize = Math.min(crystalCoins, 100);
    let thing = process.gameServer.database.createThing(this.CURRENCY.CRYSTAL_COIN);
    thing.setCount(stackSize);
    backpack.addFirstEmpty(thing);
    crystalCoins -= stackSize;
  }

  // Add Platinum Coins (in stacks of max 100)
  while (platinumCoins > 0) {
    let stackSize = Math.min(platinumCoins, 100);
    let thing = process.gameServer.database.createThing(this.CURRENCY.PLATINUM_COIN);
    thing.setCount(stackSize);
    backpack.addFirstEmpty(thing);
    platinumCoins -= stackSize;
  }

  // Add Gold Coins (in stacks of max 100)
  while (goldCoins > 0) {
    let stackSize = Math.min(goldCoins, 100);
    let thing = process.gameServer.database.createThing(this.CURRENCY.GOLD_COIN);
    thing.setCount(stackSize);
    backpack.addFirstEmpty(thing);
    goldCoins -= stackSize;
  }
};

Equipment.prototype.__removeResourceRecursive = function (container, resource, amountToRemove, visited) {
  /*
   * Function Equipment.__removeResourceRecursive
   * Recursively removes resources from a container and all nested containers
   * Returns the remaining amount that still needs to be removed
   */

  if (!visited) {
    visited = new Set();
  }

  if (visited.has(container)) {
    return amountToRemove;
  }
  visited.add(container);

  let remaining = amountToRemove;

  for (let i = 0; i < container.container.__slots.length && remaining > 0; i++) {
    let slot = container.container.__slots[i];

    if (slot === null) {
      continue;
    }

    // Check if this slot is a container (has a container property)
    if (slot.container && slot.container.__slots) {
      remaining = this.__removeResourceRecursive(slot, resource, remaining, visited);
    } else if (slot.id === resource) {
      if (slot.count >= remaining) {
        // This stack has enough - remove what we need
        container.removeIndex(i, remaining);
        remaining = 0;
      } else {
        // Remove entire stack and continue
        let removedCount = slot.count;
        container.removeIndex(i, removedCount);
        remaining -= removedCount;
        // Decrement i because we removed an item and indices shifted
        i--;
      }
    }
  }

  return remaining;
};

Equipment.prototype.canPushItem = function (thing) {
  /*
   * Function Equipment.canPushItem
   * Return true if a thing can be pushed to the players inventory
   */

  // Take a look if there is a backpack equipped
  let backpack = this.peekIndex(CONST.EQUIPMENT.BACKPACK);

  // If the item cannot be added to the backpack just drop it on the ground
  if (backpack === null) {
    return false;
  }

  // Prevent unwanted nesting of containers in the players own backpack (e.g., when evicting nested backpacks from a house)
  if (
    thing.constructor.name === "Container" &&
    thing.exceedsMaximumChildCount()
  ) {
    return false;
  }

  // Check capacity
  if (!this.__player.hasSufficientCapacity(thing)) {
    return false;
  }

  // Check if there's space in the backpack or any nested containers
  if (!this.__hasSpaceRecursive(backpack, thing)) {
    return false;
  }

  return true;
};

Equipment.prototype.__hasSpaceRecursive = function (containerItem, thing, visited) {
  /*
   * Function Equipment.__hasSpaceRecursive
   * Recursively checks if a container or any nested container has space for the thing
   */

  if (!visited) {
    visited = new Set();
  }

  if (visited.has(containerItem)) {
    return false;
  }
  visited.add(containerItem);

  // Get the actual BaseContainer - Container objects have a .container property
  let baseContainer = containerItem.container || containerItem;

  // If stackable, check if we can merge with existing stack
  if (thing.isStackable()) {
    let stackSlot = baseContainer.findStackableSlot(thing);
    if (stackSlot !== -1 && baseContainer.__slots[stackSlot] !== null && baseContainer.__slots[stackSlot].id === thing.id) {
      return true;
    }
  }

  // Check if this container has empty space
  if (!baseContainer.isFull()) {
    return true;
  }

  // Recursively check nested containers
  for (let i = 0; i < baseContainer.__slots.length; i++) {
    let item = baseContainer.__slots[i];
    if (item !== null && item.isContainer && item.isContainer()) {
      if (this.__hasSpaceRecursive(item, thing, visited)) {
        return true;
      }
    }
  }

  return false;
};

Equipment.prototype.__countFreeSlotsRecursive = function (containerItem, visited) {
  if (!visited) visited = new Set();
  if (visited.has(containerItem)) return 0;
  visited.add(containerItem);

  let baseContainer = containerItem.container || containerItem;
  let freeSlots = 0;

  for (let i = 0; i < baseContainer.__slots.length; i++) {
    if (baseContainer.__slots[i] === null) {
      freeSlots++;
    }
  }

  for (let i = 0; i < baseContainer.__slots.length; i++) {
    let item = baseContainer.__slots[i];
    if (item !== null && item.isContainer && item.isContainer()) {
      freeSlots += this.__countFreeSlotsRecursive(item, visited);
    }
  }

  return freeSlots;
};

Equipment.prototype.pushItem = function (thing) {
  /*
   * Function Equipment.pushItem
   * Pushes an item into the backpack of the player or on the ground
   */

  // Take a look if there is a backpack equipped
  let backpack = this.peekIndex(CONST.EQUIPMENT.BACKPACK);

  if (backpack === null) {
    return;
  }

  // Use addThingSmart to properly stack stackable items
  backpack.addThingSmart(thing);
};

Equipment.prototype.getAttributeState = function (attribute) {
  /*
   * Function Equipment.getAttributeState
   * Returns the state of the player equipment by summing individual contributions
   */

  let sum = 0;

  // Go over all the slots
  this.container.__slots.forEach(function (thing) {
    // A thing is equipped..
    if (thing === null) {
      return;
    }

    let value = thing.getAttribute(attribute);

    if (value === null) {
      return;
    }

    sum += value;
  });

  return sum;
};

Equipment.prototype.__isRightType = function (item, slot) {
  /*
   * Function Equipment.__isRightType
   * Returns true if the item matches the slot type
   */

  // Ensure slot is a number
  slot = Number(slot);

  // Get the prototype
  let proto = item.getPrototype();

  switch (slot) {
    case CONST.EQUIPMENT.HELMET:
      return proto.properties.slotType === "head";
    case CONST.EQUIPMENT.ARMOR:
      return proto.properties.slotType === "body";
    case CONST.EQUIPMENT.LEGS:
      return proto.properties.slotType === "legs";
    case CONST.EQUIPMENT.BOOTS:
      return proto.properties.slotType === "feet";
    case CONST.EQUIPMENT.RIGHT:
    case CONST.EQUIPMENT.LEFT:
      return (
        proto.properties.weaponType === "sword" ||
        proto.properties.weaponType === "club" ||
        proto.properties.weaponType === "axe" ||
        proto.properties.weaponType === "distance" ||
        proto.properties.weaponType === "shield" ||
        proto.properties.weaponType === "wand"
      );
    case CONST.EQUIPMENT.BACKPACK:
      return proto.properties.slotType === "backpack";
    case CONST.EQUIPMENT.NECKLACE:
      return proto.properties.slotType === "necklace";
    case CONST.EQUIPMENT.RING:
      return proto.properties.slotType === "ring";
    case CONST.EQUIPMENT.QUIVER:
      // Accept any pickupable item (arrows, bolts, potions, runes, etc.)
      return item.isPickupable();
    default:
      return false;
  }
};

Equipment.prototype.__updateWeight = function (weight) {
  /*
   * Function Equipment.__updateWeight
   * Updates the capacity of the parent player
   */

  // Invert the weight
  this.__player.changeCapacity(-weight);
};

Equipment.prototype.__addEquipment = function (equipment) {
  /*
   * Function Equipment.__addEquipment
   * Adds equipment in serialised form from the database
   */

  // Go over all the equipment slots from the database
  equipment.forEach(function (entry, slot) {
    if (entry === null) {
      return;
    }

    // Support both saved formats:
    //   Old: { slot: N, item: { id, count, ... } }
    //   New: flat array indexed by slot number (entry IS the item data)
    let itemData = entry.item !== undefined ? entry.item : entry;
    let slotIndex = entry.slot !== undefined ? entry.slot : slot;

    // Create the thing from the equipped item
    let thing = process.gameServer.database.parseThing(itemData);

    this.addThing(thing, slotIndex);

    // Adding something with invisible attribute
    if (thing.getAttribute("invisible")) {
      this.__player.addCondition(Condition.prototype.INVISIBLE, -1, -1, null);
    }
  }, this);
};

Equipment.prototype.getItemCount = function (itemId) {
  /*
   * Function Equipment.getItemCount
   * Returns total count of a specific item ID in the player's inventory (backpack + nested)
   */

  let backpack = this.peekIndex(CONST.EQUIPMENT.BACKPACK);

  if (backpack === null) {
    return 0;
  }

  return this.__countResourceRecursive(backpack, itemId);
};

Equipment.prototype.removeItem = function (itemId, count) {
  /*
   * Function Equipment.removeItem
   * Removes a specific amount of an item by ID from the player's inventory
   * Returns true if successful, false if insufficient items
   */

  let backpack = this.peekIndex(CONST.EQUIPMENT.BACKPACK);

  if (backpack === null) {
    return false;
  }

  let totalFound = this.__countResourceRecursive(backpack, itemId);

  if (totalFound < count) {
    return false;
  }

  return this.__removeResourceRecursive(backpack, itemId, count) === 0;
};

Equipment.prototype.getTotalWeight = function () {
  /*
   * Function Equipment.getTotalWeight
   * Calculates the total weight of all items equipped
   */

  let totalWeight = 0;
  this.container.__slots.forEach((slot, index) => {
    if (slot !== null) {
      let itemWeight = slot.getWeight();
      totalWeight += itemWeight;
    }
  });
  return totalWeight;
};

Equipment.prototype.toJSON = function () {

  /*
   * Function Equipment.toJSON
   * Serializes equipment slots without the __player circular reference
   */

  var visited = new Set();
  return this.container.__slots.map(function (item) {
    return item === null ? null : item.toJSON(visited);
  });

};

Equipment.prototype.getTrainingTimerSeconds = function () {
  let minRemaining = 0;
  let slots = [CONST.EQUIPMENT.LEFT, CONST.EQUIPMENT.RIGHT];
  for (let slot of slots) {
    let item = this.peekIndex(slot);
    if (item && item.isTrainingWeapon && item.isTrainingWeapon()) {
      let remaining = item.getRemainingEquipTime();
      if (remaining > 0) {
        if (minRemaining === 0 || remaining < minRemaining) {
          minRemaining = remaining;
        }
      }
    }
  }
  return minRemaining;
};

module.exports = Equipment;
