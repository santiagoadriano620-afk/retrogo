module.exports = function useDough(player, item, tile) {

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

  // Identifiers of the ovens
  if(![1786, 1788, 1790, 1792].includes(thing.id)) {
    return player.sendCancelMessage("You need an oven to bake dough.");
  }

  let bread = [2689, 2690, 2691].random();

  process.gameServer.world.sendMagicEffect(tile.position, CONST.EFFECT.MAGIC.HITBYFIRE);
  item.removeCount(1);

  let baked = process.gameServer.database.createThing(bread).setCount(1);
  player.containerManager.pickupItem(baked);

  return true;

}