const AREAS = requireModule("combat/area-definitions");

module.exports = function undeadLegion() {
  let direction = this.getProperty(CONST.PROPERTIES.DIRECTION);
  let offsets = AREAS.resolveArea(AREAS.CIRCLE3X3, direction);
  let world = process.gameServer.world;
  let summoned = 0;

  offsets.forEach(function (off) {
    let pos = { x: this.position.x + off.x, y: this.position.y + off.y, z: this.position.z };
    let tile = world.getTileFromWorldPosition(pos);
    if (!tile) return;

    let topItem = tile.getTopThing && tile.getTopThing();
    if (topItem && topItem.isCorpse && topItem.isCorpse() && topItem.isPickupable && topItem.isPickupable()) {
      topItem.remove();
      if (world.addSummon) {
        world.addSummon(this, "Skeleton", pos);
        summoned++;
      }
    }
  }, this);

  if (summoned > 0) {
    world.sendMagicEffect(this.position, CONST.EFFECT.MAGIC.MAGIC_BLUE);
    return 200;
  }

  this.sendCancelMessage("There are no corpses nearby.");
  return 0;
}
