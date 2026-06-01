const Condition = requireModule("combat/condition");

module.exports = function creatureIllusion(properties) {
  if (!properties || !properties.id) {
    return 0;
  }

  // Check if the creature is illusionable
  let monsterData = gameServer.database.getMonster(properties.id);
  if (monsterData && monsterData.flags && monsterData.flags.illusionable === false) {
    this.sendCancelMessage("You cannot illusion this creature.");
    return 0;
  }

  this.addCondition(Condition.prototype.MORPH, 200, 1000, { id: properties.id });
  return 100;
}
