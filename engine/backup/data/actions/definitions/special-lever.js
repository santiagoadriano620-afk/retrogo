const leverStates = {
  1945: 1946,
  1946: 1945
};

module.exports = function handleSpecialLever(player, tile, index, item) {
  if (player.isMoving()) {
    return player.sendCancelMessage("You can't do that while moving.");
  }

  if (!player.isBesidesThing(tile)) {
    return player.sendCancelMessage("You have to move closer.");
  }

  const actionId = item.actionId;

  // Check for quest data actions (lever, bridge, puzzle, elevator, switch, entrance, portal)
  const questAction = gameServer.questDataLoader.getByActionId(actionId);
  let questHandled = false;

  if (questAction) {
    if (gameServer.questExecutor.isLeverType(questAction)) {
      const result = gameServer.questExecutor.handleLeverQuest(player, tile, item, questAction);
      if (result) {
        process.gameServer.world.sendMagicEffect(tile.position, CONST.EFFECT.MAGIC.POFF);
        questHandled = true;
      }
    } else {
      // Non-toggle action types (basin, switch without itemIds, altar, etc.)
      const conditions = questAction.conditions || [];
      if (gameServer.questExecutor.evaluateConditions(conditions, player, tile, item)) {
        gameServer.questExecutor.executeEffects(questAction.effects || [], player, tile, item);
        process.gameServer.world.sendMagicEffect(tile.position, CONST.EFFECT.MAGIC.POFF);
        questHandled = true;
      }
    }
    if (questHandled) {
      return true;
    }
  }

  // 3. Fallback: basic lever toggle (1945 <-> 1946)
  if (leverStates.hasOwnProperty(item.id)) {
    const newLeverId = leverStates[item.id];
    const newLever = process.gameServer.database.createThing(newLeverId);
    if (actionId) {
      newLever.setActionId(actionId);
    }
    item.replace(newLever);
    process.gameServer.world.sendMagicEffect(tile.position, CONST.EFFECT.MAGIC.POFF);
  }

  return true;
};
