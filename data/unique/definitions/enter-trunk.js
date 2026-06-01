module.exports = function useTrunk(player, tile, index, item) {

  // Only allowed when not moving
  if(player.isMoving()) {
    return true;
  }

  // Teleport the player and 
  process.gameServer.world.creatureHandler.teleportCreature(player, tile.position.down());
  player.movementHandler.__moveLock.lock(player.getSlowness());

  process.gameServer.world.sendMagicEffect(tile.position.down(), CONST.EFFECT.MAGIC.YELLOW_RINGS);

  return true;

}