module.exports = function useScythe(player, item, tile) {

  // Only allowed when not moving
  if(player.isMoving()) {
    return player.sendCancelMessage("You cannot do this while moving.");
  }

  if(!player.isBesidesThing(tile)) {
    return player.sendCancelMessage("You need to be closer.");
  }

  let thing = tile.getTopItem();

  if(thing === null) {
    return player.sendCancelMessage("There is nothing to cut here.");
  }

  // These are the identifiers of wheat in the field
  if(thing.id === 2739 || thing.id === 2738) {
    thing.replace(process.gameServer.database.createThing(2737));
  }

  // Full grown? Add cut wheat
  if(thing.id === 2739) {
    tile.addTopThing(process.gameServer.database.createThing(2694).setCount(1));
  }

  return true;

}