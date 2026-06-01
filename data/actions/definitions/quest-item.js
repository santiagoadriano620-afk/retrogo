module.exports = function handleQuestItem(player, item, targetTile, targetIndex) {
  const targetItem = targetTile.peekIndex(targetIndex) || null;

  const handled = gameServer.questExecutor.handleQuestItemUse(player, item, targetItem, targetTile);
  if (handled) return false;

  return true;
};
