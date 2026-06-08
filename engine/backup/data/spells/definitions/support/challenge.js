const AREAS = requireModule("combat/area-definitions");

module.exports = function challenge() {
  let direction = this.getProperty(CONST.PROPERTIES.DIRECTION);
  let offsets = AREAS.resolveArea(AREAS.SQUARE1X1, direction);
  let world = process.gameServer.world;
  let target = null;

  for (let off of offsets) {
    let pos = { x: this.position.x + off.x, y: this.position.y + off.y, z: this.position.z };
    let tile = world.getTileFromWorldPosition(pos);
    if (tile && tile.creatures) {
      for (let creature of tile.creatures.values()) {
        if (creature.id !== this.id && !creature.isPlayer()) {
          target = creature;
          break;
        }
      }
    }
    if (target) break;
  }

  if (target) {
    if (this.setTarget) {
      this.setTarget(target);
    }
    world.sendMagicEffect(target.position, CONST.EFFECT.MAGIC.MAGIC_BLUE);
    return 100;
  }

  return 0;
}
