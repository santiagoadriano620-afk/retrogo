const Condition = requireModule("combat/condition");

module.exports = function haste() {
  this.addCondition(Condition.prototype.HASTE, 60, 30);
  return 100;
}
