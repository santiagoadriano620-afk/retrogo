module.exports = function useMultitool(player, item, tile) {

  if(player.isMoving()) {
    return player.sendCancelMessage("You cannot do this while moving.");
  }

  if(!player.isBesidesThing(tile)) {
    return player.sendCancelMessage("You need to be closer.");
  }

  // --- ROPE: holes with floorchange ---
  if(tile.getFloorChange() === "down") {
    let down = process.gameServer.world.getTileFromWorldPosition(tile.position.down());
    if(down !== null) {
      let itemBelow = down.getTopItem();
      if(itemBelow !== null && itemBelow.isMoveable() && itemBelow.getAttribute("floorchange") === null) {
        let up = process.gameServer.world.getTileFromWorldPosition(tile.position.south());
        if(up !== null) {
          const PacketHandler = requireModule("network/packet-handler");
          PacketHandler.prototype.__moveItem(player, down, 0xFF, up, 0xFF, 0);
        }
      }
    }
    return true;
  }

  // --- ROPE: rope hole (384) ---
  if(tile.id === 384) {
    process.gameServer.world.creatureHandler.teleportCreature(player, tile.position.ladder());
    player.movementHandler.__moveLock.lock(10);
    return true;
  }

  // --- SHOVEL: loose stone piles ---
  if(tile.id === 468) {
    tile.replace(469);
    return true;
  }
  if(tile.id === 481) {
    tile.replace(482);
    return true;
  }
  if(tile.id === 483) {
    tile.replace(484);
    return true;
  }

  // --- PICK: mud tiles ---
  if(tile.id >= 351 && tile.id <= 355) {
    if(tile.actionId === 101) {
      tile.replace(392);
    }
    return true;
  }

  let thing = tile.getTopItem();
  if(thing === null) {
    return player.sendCancelMessage("There is nothing to use here.");
  }

  // --- MACHETE: cut grass (2782) ---
  if(thing.id === 2782) {
    let cutGrass = process.gameServer.database.createThing(2781);
    if(cutGrass) {
      thing.replace(cutGrass);
      let pos = tile.position;
      gameServer.world.eventQueue.addEvent(function() {
        let currentTile = gameServer.world.getTileFromWorldPosition(pos);
        if(currentTile) {
          let topItem = currentTile.getTopItem();
          if(topItem && topItem.id === 2781) {
            let newGrass = process.gameServer.database.createThing(2782);
            if(newGrass) {
              topItem.replace(newGrass);
            }
          }
        }
      }, 6000);
    }
    return true;
  }

  // --- SCYTHE: cut wheat (2739 / 2738) ---
  if(thing.id === 2739 || thing.id === 2738) {
    thing.replace(process.gameServer.database.createThing(2737));
    if(thing.id === 2739) {
      tile.addTopThing(process.gameServer.database.createThing(2694).setCount(1));
    }
    return true;
  }

  return player.sendCancelMessage("You cannot use this item here.");

}
