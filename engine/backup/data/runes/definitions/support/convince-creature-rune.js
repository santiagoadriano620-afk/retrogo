module.exports = function convinceCreatureRune(source, target) {
  // Target must be a monster
  if (!target.isMonster) {
    source.sendCancelMessage("You may only convince monsters.");
    return false;
  }

  // Check if the creature is convinceable
  let proto = target.getPrototype();
  if (!proto || !proto.flags || !proto.flags.convinceable) {
    source.sendCancelMessage("You cannot convince this creature.");
    return false;
  }

  // Check if source already has a convinced creature
  let summons = source.getSummons ? source.getSummons() : [];
  if (summons.length >= 2) {
    source.sendCancelMessage("You cannot convince more creatures.");
    return false;
  }

  // Find available tile near the source to place the convinced creature
  let tile = gameServer.world.findAvailableTile(source, source.position);
  if (!tile) {
    source.sendCancelMessage("There is not enough room.");
    return false;
  }

  // Create a copy of the monster as a summon
  if (gameServer.world.addSummon) {
    let success = gameServer.world.addSummon(source, proto.creatureStatistics.name);
    if (success) {
      gameServer.world.sendMagicEffect(target.position, CONST.EFFECT.MAGIC.MAGIC_BLUE);
      source.sendCancelMessage("You have convinced the creature.");
      return true;
    }
  }

  source.sendCancelMessage("You cannot convince this creature.");
  return false;
}
