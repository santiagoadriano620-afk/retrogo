const CombatFormulas = requireModule("combat/combat-formulas");
const AREAS = requireModule("combat/area-definitions");

module.exports = function fireWave() {
  let direction = this.getProperty(CONST.PROPERTIES.DIRECTION);
  let offsets = AREAS.resolveArea(AREAS.WAVE4, direction);
  let world = process.gameServer.world;
  offsets = AREAS.filterBlocked(world, this.position, offsets);
  let hitAny = false;
  let seen = new Set();

  offsets.forEach(function (off) {
    let pos = { x: this.position.x + off.x, y: this.position.y + off.y, z: this.position.z };
    world.sendMagicEffect(pos, CONST.EFFECT.MAGIC.FIREAREA);
    let tile = world.getTileFromWorldPosition(pos);
    if (!tile || !tile.creatures) return;
    tile.creatures.forEach(function (creature) {
      if (seen.has(creature.id)) return;
      seen.add(creature.id);
      if (creature.id === this.id) return;
      let damage = CombatFormulas.getMagicDamage(this, 0.20, 0, 0.40, 0);
      let result = CombatFormulas.calculateFinalDamage(this, creature, CombatFormulas.COMBAT_TYPES.FIRE, damage, 0);
      if (result.finalDamage !== 0) {
        creature.decreaseHealth(this, Math.abs(result.finalDamage));
        hitAny = true;
      }
    }, this);
  }, this);

  return hitAny ? 200 : 50;
}
