const Condition = requireModule("combat/condition");

module.exports = function greatLight() {
  this.addCondition(Condition.prototype.LIGHT, 1, 695000, { intensity: 25 });
  return 100;
};
