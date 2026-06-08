module.exports = function useFlour(player, item, targetWhere, targetIndex) {

  if(player.isMoving()) {
    return player.sendCancelMessage("You cannot do this while moving.");
  }

  let thing = targetWhere.peekIndex(targetIndex);

  if(thing === null) {
    return player.sendCancelMessage("There is nothing there.");
  }

  if(!thing.isFluidContainer() || !thing.containsWater()) {
    return player.sendCancelMessage("You need a container with water.");
  }

  thing.__empty();
  item.removeCount(1);

  let dough = process.gameServer.database.createThing(2693).setCount(1);
  player.containerManager.pickupItem(dough);

  return true;

}