const Condition = requireModule("combat/condition");

module.exports = function strongHaste() {
  this.addCondition(Condition.prototype.STRONG_HASTE, 43, 70);
  return 100;
}
