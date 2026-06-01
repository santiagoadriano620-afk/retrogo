const Condition = requireModule("combat/condition");

module.exports = function ultimateLight() {
  this.addCondition(Condition.prototype.LIGHT, 1, 1980000, { intensity: 34 });
  return 100;
};
