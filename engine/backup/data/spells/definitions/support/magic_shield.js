const Condition = requireModule("combat/condition");

module.exports = function magicShield() {
  this.addCondition(Condition.prototype.MAGIC_SHIELD, 200, 1000);
  return 100;
}
