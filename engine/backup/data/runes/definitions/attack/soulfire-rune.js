const Condition = requireModule("combat/condition");

module.exports = function soulfireRune(source, target) {
  let top = target.getTopCreature();
  if (top === null || top === source) {
    return true;
  }
  process.gameServer.world.sendDistanceEffect(source.position, target.position, CONST.EFFECT.PROJECTILE.FIRE);
  process.gameServer.world.sendMagicEffect(target.position, CONST.EFFECT.MAGIC.FIREAREA);
  top.addCondition(Condition.prototype.BURNING, 8, 100);
  if (top.isPlayer()) {
    top.sendCancelMessage("You are set on fire.");
  }
  return true;
}
