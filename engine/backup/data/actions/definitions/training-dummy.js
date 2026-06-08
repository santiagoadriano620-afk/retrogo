module.exports = function useTrainingDummy(player, item, toWhere, toIndex) {

  if (player.isMoving()) {
    player.sendCancelMessage("You cannot do this while moving.");
    return false;
  }

  if (!toWhere || toWhere.constructor.name !== "Tile") {
    player.sendCancelMessage("You must target a floor tile in your house.");
    return false;
  }

  var tile = toWhere;

  if (!tile.isHouseTile() || !player.ownsHouseTile(tile)) {
    player.sendCancelMessage("You can only place this in your own house.");
    return false;
  }

  if (tile.isOccupiedAny()) {
    player.sendCancelMessage("There is something in the way.");
    return false;
  }

  if (!player.position.besides(tile.position)) {
    player.sendCancelMessage("You are not close enough.");
    return false;
  }

  var parent = item.getParent();
  if (!parent || typeof parent.deleteThing !== "function") {
    player.sendCancelMessage("Cannot use this item here.");
    return false;
  }

  var removedIndex = parent.deleteThing(item);
  if (removedIndex === -1) {
    player.sendCancelMessage("Could not remove the item.");
    return false;
  }

  var monsterData = process.gameServer.database.getMonsterByName("Training Dummy");
  if (!monsterData) {
    player.sendCancelMessage("Failed to spawn Training Dummy.");
    parent.addThing(item, 0);
    return false;
  }

  var Monster = requireModule("monster/monster");
  var dummy = new Monster(monsterData.id, monsterData.data);

  if (!process.gameServer.world.creatureHandler.addCreaturePosition(dummy, tile.position, true)) {
    player.sendCancelMessage("Could not place the Training Dummy.");
    parent.addThing(item, 0);
    return false;
  }

  process.gameServer.world.sendMagicEffect(tile.position, CONST.EFFECT.MAGIC.MAGIC_BLUE);
  player.sendCancelMessage("You place the Training Dummy.");
  return false;
}
