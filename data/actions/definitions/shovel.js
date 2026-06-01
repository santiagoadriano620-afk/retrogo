module.exports = function useShovel(player, item, tile) {

  // Only allowed when not moving
  if(player.isMoving()) {
    return player.sendCancelMessage("You cannot do this while moving.");
  }

  if(!player.isBesidesThing(tile)) {
    return player.sendCancelMessage("You need to be closer.");
  }

  // If the tile being used is a pile of loose stones: open it
  if(tile.id === 468) {
    tile.replace(469);
  } else if(tile.id === 481) {
    tile.replace(482);
  } else if(tile.id === 483) {
    tile.replace(484);
  } else {
    return player.sendCancelMessage("You cannot use the shovel on this tile.");
  }

  return true;

}
