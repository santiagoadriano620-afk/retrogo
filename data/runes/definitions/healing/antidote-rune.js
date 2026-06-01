const Condition = requireModule("combat/condition");

module.exports = function antidoteRune(source, target) {
  let top = target.getTopCreature();
  if (top === null) {
    return true;
  }
  process.gameServer.world.sendMagicEffect(target.position, CONST.EFFECT.MAGIC.MAGIC_GREEN);
  top.removeCondition(Condition.prototype.POISONED);
  if (top.isPlayer()) {
    top.sendCancelMessage("You are cured.");
  }
  return true;
}
