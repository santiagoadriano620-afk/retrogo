module.exports = function findPerson(properties) {
  if (!properties || !properties.playerName) {
    return 0;
  }

  let targetName = properties.playerName.toLowerCase();
  let world = process.gameServer.world;
  let target = null;

  for (let [, creature] of world.activeCreatures) {
    if (creature.isPlayer && creature.isPlayer()) {
      let name = creature.getProperty(CONST.PROPERTIES.NAME);
      if (name && name.toLowerCase() === targetName) {
        target = creature;
        break;
      }
    }
  }

  if (!target) {
    this.sendCancelMessage("A player with this name is not online.");
    return 0;
  }

  let dx = this.position.x - target.position.x;
  let dy = this.position.y - target.position.y;
  let dz = this.position.z - target.position.z;
  let dist = Math.max(Math.abs(dx), Math.abs(dy));

  let dirStr = "";
  if (dist >= 5) {
    let angle = Math.abs(dy / (dx || 0.001));
    if (angle < 0.4142) {
      dirStr = dx > 0 ? "west" : "east";
    } else if (angle < 2.4142) {
      if (dy > 0) dirStr = dx > 0 ? "north-west" : "south-east";
      else dirStr = dx > 0 ? "south-west" : "north-east";
    } else {
      dirStr = dy > 0 ? "north" : "south";
    }
  }

  let levelStr = dz > 0 ? "on a higher level" : dz < 0 ? "on a lower level" : "";
  let distStr = dist < 5 ? "standing next to you" : dist < 101 ? "is to the " + dirStr : dist < 250 ? "is far to the " + dirStr : "is very far to the " + dirStr;

  let message = target.getProperty(CONST.PROPERTIES.NAME) + " " + (levelStr ? levelStr + " " : "") + distStr + ".";
  this.sendCancelMessage(message);
  process.gameServer.world.sendMagicEffect(this.position, CONST.EFFECT.MAGIC.MAGIC_BLUE);

  return 100;
}
