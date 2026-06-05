const CombatFormulas = requireModule("combat/combat-formulas");

module.exports = function healFriend(properties) {
  if (!properties || !properties.targetId) {
    return 0;
  }

  let world = process.gameServer.world;
  let target = world.getCreature(properties.targetId);
  if (!target || !target.isPlayer()) {
    this.sendCancelMessage("Player not found.");
    return 0;
  }

  let dx = Math.abs(this.position.x - target.position.x);
  let dy = Math.abs(this.position.y - target.position.y);
  if (dx > 7 || dy > 5) {
    this.sendCancelMessage("Destination out of reach.");
    return 0;
  }

  let heal = CombatFormulas.getMagicDamage(this, 0.80, 0, 1.60, 0);
  heal = Math.abs(heal);
  let hp = target.getProperty(CONST.PROPERTIES.HEALTH);
  let maxHp = target.getProperty(CONST.PROPERTIES.HEALTH_MAX);
  target.setProperty(CONST.PROPERTIES.HEALTH, Math.min(maxHp, hp + heal));

  target.removeCondition(CONST.CONDITION.PARALYZE);
  process.gameServer.world.sendMagicEffect(target.position, CONST.EFFECT.MAGIC.MAGIC_BLUE);

  return 100;
};
