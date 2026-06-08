const CombatFormulas = requireModule("combat/combat-formulas");
const AREAS = requireModule("combat/area-definitions");

module.exports = function explosion() {
  let target = null;
  let effectPosition = null;

  if (this.isPlayer() && this.getTarget()) {
    target = this.getTarget();
    effectPosition = target.position;
  } else {
    let direction = this.getProperty(CONST.PROPERTIES.DIRECTION);
    effectPosition = this.position.getPositionFromDirection(direction);
    let tile = process.gameServer.world.getTileFromWorldPosition(effectPosition);
    if (tile && tile.hasOwnProperty("creatures") && tile.creatures.size > 0) {
      target = tile.creatures.values().next().value;
    }
  }

  if (!effectPosition) return 0;

  let world = process.gameServer.world;
  world.sendDistanceEffect(this.position, effectPosition, CONST.EFFECT.PROJECTILE.FIRE);
  world.sendMagicEffect(effectPosition, CONST.EFFECT.MAGIC.HITBYFIRE);

  let direction = this.getProperty(CONST.PROPERTIES.DIRECTION);
  let offsets = AREAS.resolveArea(AREAS.CIRCLE2X2, direction);
  offsets = AREAS.filterBlocked(world, effectPosition, offsets);
  let hitAny = false;
  let seen = new Set();

  offsets.forEach(function (off) {
    let pos = { x: effectPosition.x + off.x, y: effectPosition.y + off.y, z: effectPosition.z };
    let tile = world.getTileFromWorldPosition(pos);
    if (!tile || !tile.creatures) return;
    tile.creatures.forEach(function (creature) {
      if (seen.has(creature.id)) return;
      seen.add(creature.id);
      if (creature.id === this.id) return;
      let damage = CombatFormulas.getMagicDamage(this, 0.40, 0, 0.80, 0);
      let result = CombatFormulas.calculateFinalDamage(this, creature, CombatFormulas.COMBAT_TYPES.FIRE, damage, 0);
      if (result.finalDamage !== 0) {
        creature.decreaseHealth(this, Math.abs(result.finalDamage));
        hitAny = true;
      }
    }, this);
  }, this);

  return hitAny ? 400 : 50;
}
