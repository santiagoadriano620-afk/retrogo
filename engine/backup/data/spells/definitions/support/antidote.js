module.exports = function antidote() {
  this.removeCondition(CONST.CONDITION.POISONED);
  return 100;
}
