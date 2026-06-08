const Condition = requireModule("combat/condition");

module.exports = function invisibility() {
  this.addCondition(Condition.prototype.INVISIBLE, 200, 1000);
  return 100;
}
