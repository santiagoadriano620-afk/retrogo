module.exports = function summonCreature(properties) {
  if (!properties || !properties.monsterName) {
    return 0;
  }

  let monsterName = properties.monsterName;
  let creatureHandler = process.gameServer.world.creatureHandler;

  if (this.getSummonCount() >= CONFIG.SUMMONS.MAX_PER_PLAYER) {
    this.sendCancelMessage("You cannot summon more creatures.");
    return 0;
  }

  // Check if the creature is summonable
  let monsterData = gameServer.database.getMonsterByName(monsterName);
  if (!monsterData || !monsterData.data || !monsterData.data.flags || !monsterData.data.flags.summonable) {
    this.sendCancelMessage("You cannot summon this creature.");
    return 0;
  }

  let summon = creatureHandler.addSummon(this, monsterName, this.getPosition());
  if (!summon) {
    this.sendCancelMessage("You do not have enough room to summon.");
    return 0;
  }

  process.gameServer.world.sendMagicEffect(this.position, CONST.EFFECT.MAGIC.MAGIC_BLUE);
  return 200;
}
