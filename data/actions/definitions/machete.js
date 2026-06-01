module.exports = function useMachete(player, item, tile) {

  // Only allowed when not moving
  if(player.isMoving()) {
    return player.sendCancelMessage("You cannot do this while moving.");
  }

  if(!player.isBesidesThing(tile)) {
    return player.sendCancelMessage("You need to be closer.");
  }

  let grass = tile.getTopItem();

  if(grass === null) {
    return false;
  }

  // Cut the grass and schedule regrowth
  if(grass.id === 2782) {
    let cutGrass = process.gameServer.database.createThing(2781);
    if (cutGrass) {
      grass.replace(cutGrass);
      let pos = tile.position;
      gameServer.world.eventQueue.addEvent(function() {
        let currentTile = gameServer.world.getTileFromWorldPosition(pos);
        if (currentTile) {
          let topItem = currentTile.getTopItem();
          if (topItem && topItem.id === 2781) {
            let newGrass = process.gameServer.database.createThing(2782);
            if (newGrass) {
              topItem.replace(newGrass);
            }
          }
        }
      }, 6000);
    }
  }

  return true;

}