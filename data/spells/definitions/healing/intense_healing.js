const CombatFormulas = requireModule("combat/combat-formulas");

module.exports = function intenseHealing() {
  let heal = CombatFormulas.getMagicDamage(this, 0.20, 0, 0.60, 0);
  heal = Math.abs(heal);
  let hp = this.getProperty(CONST.PROPERTIES.HEALTH);
  let maxHp = this.getProperty(CONST.PROPERTIES.HEALTH_MAX);
  this.setProperty(CONST.PROPERTIES.HEALTH, Math.min(maxHp, hp + heal));
  this.removeCondition(CONST.CONDITION.PARALYZE);
  process.gameServer.world.sendMagicEffect(this.position, CONST.EFFECT.MAGIC.MAGIC_BLUE);
  return 100;
}
