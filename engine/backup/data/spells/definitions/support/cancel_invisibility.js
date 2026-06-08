const AREAS = requireModule("combat/area-definitions");

module.exports = function cancelInvisibility() {
  let direction = this.getProperty(CONST.PROPERTIES.DIRECTION);
  let offsets = AREAS.resolveArea(AREAS.CIRCLE3X3, direction);
  let world = process.gameServer.world;
  let hitAny = false;

  offsets.forEach(function (off) {
    let pos = { x: this.position.x + off.x, y: this.position.y + off.y, z: this.position.z };
    let tile = world.getTileFromWorldPosition(pos);
    if (!tile || !tile.creatures) return;
    tile.creatures.forEach(function (creature) {
      if (creature.id === this.id) return;
      if (creature.isPlayer && creature.isPlayer()) {
        let ring = creature.containerManager && creature.containerManager.equipment && creature.containerManager.equipment.peekIndex(CONST.EQUIPMENT.RING);
        if (ring && ring.id === 2202 && Math.random() < 0.2) {
          creature.containerManager.equipment.removeIndex(CONST.EQUIPMENT.RING, 1);
        }
      }
      creature.removeCondition(CONST.CONDITION.INVISIBLE);
      hitAny = true;
    }, this);
  }, this);

  if (hitAny) {
    world.sendMagicEffect(this.position, CONST.EFFECT.MAGIC.MAGIC_BLUE);
  }

  return hitAny ? 200 : 0;
}
