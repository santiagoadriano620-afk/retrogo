const Condition = requireModule("combat/condition");

module.exports = function light() {
  this.addCondition(Condition.prototype.LIGHT, 1, 370000, { intensity: 15 });
  return 100;
};
