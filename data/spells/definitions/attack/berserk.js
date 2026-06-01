const CombatFormulas = requireModule("combat/combat-formulas");
const AREAS = requireModule("combat/area-definitions");

module.exports = function berserk() {
  let direction = this.getProperty(CONST.PROPERTIES.DIRECTION);
  let offsets = AREAS.resolveArea(AREAS.SQUARE1X1, direction);
  let world = process.gameServer.world;
  offsets = AREAS.filterBlocked(world, this.position, offsets);
  let hitAny = false;
  let seen = new Set();

  offsets.forEach(function (off) {
    let pos = { x: this.position.x + off.x, y: this.position.y + off.y, z: this.position.z };
    world.sendMagicEffect(pos, CONST.EFFECT.MAGIC.HITAREA);
    let tile = world.getTileFromWorldPosition(pos);
    if (!tile || !tile.creatures) return;
    tile.creatures.forEach(function (creature) {
      if (seen.has(creature.id)) return;
      seen.add(creature.id);
      if (creature.id === this.id) return;
      let damage = CombatFormulas.getSkillDamage(this, creature, 0, 1.0, 40);
      let result = CombatFormulas.calculateFinalDamage(this, creature, CombatFormulas.COMBAT_TYPES.PHYSICAL, damage, 0);
      if (result.finalDamage !== 0) {
        creature.decreaseHealth(this, Math.abs(result.finalDamage));
        hitAny = true;
      }
    }, this);
  }, this);

  return hitAny ? 200 : 50;
}
