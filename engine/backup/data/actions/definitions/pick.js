module.exports = function usePick(player, item, tile) {

  // Only allowed when not moving
  if(player.isMoving()) {
    return player.sendCancelMessage("You cannot do this while moving.");
  }

  if(!player.isBesidesThing(tile)) {
    return player.sendCancelMessage("You need to be closer.");
  }

  // Must be mud!
  if(tile.id < 351 || tile.id > 355) {
    return player.sendCancelMessage("You cannot use the pick on this tile.");
  }

  // Mud tiles with action ID 101 are pick holes
  if(tile.actionId === 101) {
    tile.replace(392);
    return true;
  }

  return true;

}