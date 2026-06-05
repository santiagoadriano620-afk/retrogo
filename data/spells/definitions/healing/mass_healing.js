const CombatFormulas = requireModule("combat/combat-formulas");
const AREAS = requireModule("combat/area-definitions");

module.exports = function massHealing() {
  let direction = this.getProperty(CONST.PROPERTIES.DIRECTION);
  let offsets = AREAS.resolveArea(AREAS.CIRCLE3X3, direction);
  let world = process.gameServer.world;

  let heal = CombatFormulas.getMagicDamage(this, 1.60, 0, 2.40, 0);
  heal = Math.abs(heal);

  let hp = this.getProperty(CONST.PROPERTIES.HEALTH);
  let maxHp = this.getProperty(CONST.PROPERTIES.HEALTH_MAX);
  this.setProperty(CONST.PROPERTIES.HEALTH, Math.min(maxHp, hp + heal));
  this.removeCondition(CONST.CONDITION.PARALYZE);

  offsets.forEach(function (off) {
    let pos = { x: this.position.x + off.x, y: this.position.y + off.y, z: this.position.z };
    world.sendMagicEffect(pos, CONST.EFFECT.MAGIC.MAGIC_BLUE);
    let tile = world.getTileFromWorldPosition(pos);
    if (!tile || !tile.creatures) return;
    tile.creatures.forEach(function (creature) {
      if (creature.id === this.id) return;
      let hp = creature.getProperty(CONST.PROPERTIES.HEALTH);
      let maxHp = creature.getProperty(CONST.PROPERTIES.HEALTH_MAX);
      creature.setProperty(CONST.PROPERTIES.HEALTH, Math.min(maxHp, hp + heal));
    }, this);
  }, this);

  return 200;
}
