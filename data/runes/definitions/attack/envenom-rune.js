const Condition = requireModule("combat/condition");

module.exports = function envenomRune(source, target) {
  let top = target.getTopCreature();
  if (top === null || top === source) {
    return true;
  }
  process.gameServer.world.sendDistanceEffect(source.position, target.position, CONST.EFFECT.PROJECTILE.POISON);
  process.gameServer.world.sendMagicEffect(target.position, CONST.EFFECT.MAGIC.POISONHIT);
  top.addCondition(Condition.prototype.POISONED, 3, 100);
  if (top.isPlayer()) {
    top.sendCancelMessage("You are poisoned.");
  }
  return true;
}
