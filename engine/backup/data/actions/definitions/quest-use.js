module.exports = function handleQuestUse(player, tile, index, item) {
  const actionId = item.actionId;
  if (!actionId) return true;

  const questAction = gameServer.questDataLoader.getByActionId(actionId);
  if (!questAction) return true;

  if (gameServer.questExecutor.isLeverType(questAction)) {
    return true;
  }

  const conditions = questAction.conditions || [];
  if (!gameServer.questExecutor.evaluateConditions(conditions, player, tile, item)) {
    return true;
  }

  gameServer.questExecutor.executeEffects(questAction.effects || [], player, tile, item);
  process.gameServer.world.sendMagicEffect(tile.position, CONST.EFFECT.MAGIC.POFF);
  return false;
};
