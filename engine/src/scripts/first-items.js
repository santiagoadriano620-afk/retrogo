"use strict";

const FIRST_ITEMS_KEY = 50000;

function checkFirstItems(player) {
  if (player.getStorage(FIRST_ITEMS_KEY) !== -1) {
    return;
  }

  let eq = player.containerManager.equipment;

  // Remove existing backpack in slot 6 if any (so bag goes directly into the slot, not inside the backpack)
  let existingBackpack = eq.peekIndex(CONST.EQUIPMENT.BACKPACK);
  if (existingBackpack !== null) {
    eq.removeIndex(CONST.EQUIPMENT.BACKPACK);
  }

  // Coat (2651) on ARMOR (slot 1)
  let coat = process.gameServer.database.createThing(2651);
  if (coat !== null) {
    eq.addThing(coat, CONST.EQUIPMENT.ARMOR);
  }

  // Club (2382) in LEFT hand (slot 5)
  let club = process.gameServer.database.createThing(2382);
  if (club !== null) {
    eq.addThing(club, CONST.EQUIPMENT.LEFT);
  }

  // Bag (1987) in BACKPACK (slot 6)
  let bag = process.gameServer.database.createThing(1987);
  if (bag !== null) {
    eq.addThing(bag, CONST.EQUIPMENT.BACKPACK);
  }

  // Red Apple x2 (2674) in QUIVER / ammunition (slot 9)
  let apple = process.gameServer.database.createThing(2674);
  if (apple !== null) {
    apple.setCount(2);
    eq.addThing(apple, CONST.EQUIPMENT.QUIVER);
  }

  player.setStorage(FIRST_ITEMS_KEY, 1);
}

module.exports = { checkFirstItems };
