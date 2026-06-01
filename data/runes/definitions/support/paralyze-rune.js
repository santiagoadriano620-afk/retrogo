const Condition = requireModule("combat/condition");

module.exports = function paralyzeRune(source, target) {
  let top = target.getTopCreature();
  if (top === null || top === source) {
    return false;
  }
  process.gameServer.world.sendDistanceEffect(source.position, target.position, CONST.EFFECT.PROJECTILE.ENERGY);
  process.gameServer.world.sendMagicEffect(target.position, CONST.EFFECT.MAGIC.ENERGYHIT);
  top.addCondition(Condition.prototype.PARALYZE, 200, 10);
  if (top.isPlayer()) {
    top.sendCancelMessage("You are paralyzed.");
  }
  return true;
}
