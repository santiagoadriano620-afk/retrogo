module.exports = function magicRope() {
  let world = process.gameServer.world;
  let currentTile = world.getTileFromWorldPosition(this.position);

  if (!currentTile) {
    this.sendCancelMessage("You cannot use this spell here.");
    return 0;
  }

  let hasRopeSpot = currentTile.id === 384;
  if (!hasRopeSpot && currentTile.hasItems && currentTile.hasItems()) {
    for (const item of currentTile.getItems()) {
      if (item.id === 384) {
        hasRopeSpot = true;
        break;
      }
    }
  }

  if (!hasRopeSpot) {
    this.sendCancelMessage("You cannot use this spell here.");
    return 0;
  }

  world.creatureHandler.teleportCreature(this, this.position.ladder());
  world.sendMagicEffect(this.position, CONST.EFFECT.MAGIC.TELEPORT);
  return 100;
};
