module.exports = function useWheat(player, item, tile) {

  // Only allowed when not moving
  if(player.isMoving()) {
    return player.sendCancelMessage("You cannot do this while moving.");
  }

  if(!player.isBesidesThing(tile)) {
    return player.sendCancelMessage("You need to be closer.");
  }

  let thing = tile.getTopItem();

  if(thing === null) {
    return player.sendCancelMessage("There is nothing there.");
  }

  // Must be a millstone
  if(![1381, 1382, 1383, 1384].includes(thing.id)) {
    return player.sendCancelMessage("You cannot use the wheat on this object.");
  }

  item.removeCount(1);

  let flour = process.gameServer.database.createThing(2692).setCount(1);
  player.containerManager.pickupItem(flour);

  return true;

}