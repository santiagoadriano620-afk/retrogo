module.exports = function wildGrowth() {
  let direction = this.getProperty(CONST.PROPERTIES.DIRECTION);
  let frontPos = this.position.getPositionFromDirection(direction);
  let world = process.gameServer.world;

  if (!frontPos) return 0;

  let tile = world.getTileFromWorldPosition(frontPos);
  if (!tile) return 0;

  if (tile.isProtectionZone()) {
    this.sendCancelMessage("You may not cast this spell in a protection zone.");
    return 0;
  }

  let item = gameServer.database.createThing(1499);
  if (item) {
    tile.addThing(item, -1);
    world.sendMagicEffect(frontPos, CONST.EFFECT.MAGIC.MAGIC_GREEN);
    return 200;
  }

  return 0;
}
