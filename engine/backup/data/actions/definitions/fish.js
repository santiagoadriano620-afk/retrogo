module.exports = function useFishingRod(player, item, tile) {

  if (player.isMoving()) {
    return player.sendCancelMessage("You can not do this while moving.");
  }

  let dx = Math.abs(player.position.x - tile.position.x);
  let dy = Math.abs(player.position.y - tile.position.y);
  if (Math.max(dx, dy) > 10 || player.position.z !== tile.position.z) {
    return player.sendCancelMessage("You need to be closer.");
  }

  if (!isWaterTile(tile.id)) {
    return player.sendCancelMessage("You can not fish here.");
  }

  process.gameServer.world.sendMagicEffect(tile.position, CONST.EFFECT.MAGIC.LOSEENERGY);

  let fishingLevel = player.skills.getSkillLevel(CONST.PROPERTIES.FISHING);

  let failChance = Math.max(5, Math.min(97, Math.floor(94 - fishingLevel * 0.9)));
  if (Math.random() * 100 < failChance) {
    return;
  }

  let fishId = 2667;
  if (fishingLevel >= 50 && Math.random() < 0.15) {
    fishId = 2669;
  } else if (fishingLevel >= 30 && Math.random() < 0.15) {
    fishId = 2668;
  }

  let fish = process.gameServer.database.createThing(fishId).setCount(1);
  let equipment = player.containerManager.equipment;
  if (equipment.canPushItem(fish)) {
    equipment.pushItem(fish);
  } else {
    let tile = player.getTile();
    if (tile) tile.addTopThing(fish);
  }

  player.skills.incrementSkill(CONST.PROPERTIES.FISHING, 1);
};

function isWaterTile(id) {
  return (id >= 490 && id <= 492) ||
         (id >= 606 && id <= 637) ||
         (id >= 658 && id <= 669);
}
