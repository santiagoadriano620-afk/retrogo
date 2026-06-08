const CombatFormulas = requireModule("combat/combat-formulas");

module.exports = function flameStrike() {
  let direction = this.getProperty(CONST.PROPERTIES.DIRECTION);
  let frontPos = this.position.getPositionFromDirection(direction);
  if (!frontPos) return 0;

  let world = process.gameServer.world;
  let tile = world.getTileFromWorldPosition(frontPos);
  if (!tile) return 0;

  let target = tile.getCreature();
  if (!target || target.id === this.id) {
    world.sendMagicEffect(frontPos, CONST.EFFECT.MAGIC.FIREAREA);
    return 200;
  }

  let damage = CombatFormulas.getMagicDamage(this, 0.35, 0, 0.55, 0);
  let result = CombatFormulas.calculateFinalDamage(this, target, CombatFormulas.COMBAT_TYPES.FIRE, damage, 0);
  if (result.finalDamage !== 0) {
    target.decreaseHealth(this, Math.abs(result.finalDamage));
  }

  world.sendMagicEffect(target.position, CONST.EFFECT.MAGIC.FIREAREA);
  return 200;
}
