module.exports = function levitate(properties) {
  if (!properties || !properties.direction) {
    this.sendCancelMessage("You cannot levitate there.");
    return 0;
  }

  let world = process.gameServer.world;
  let creatureHandler = gameServer.world.creatureHandler;
  let facing = this.getProperty(CONST.PROPERTIES.DIRECTION);
  let frontPos = this.position.getPositionFromDirection(facing);
  let frontTile = world.getTileFromWorldPosition(frontPos);

  if (properties.direction === "up") {
    if (this.position.z <= 0) {
      this.sendCancelMessage("You cannot levitate there.");
      return 0;
    }
    // Up requires a solid wall/mountain in front
    if (!frontTile || frontTile.id === 0) {
      this.sendCancelMessage("You cannot levitate there.");
      return 0;
    }
    let targetPos = {
      x: frontPos.x,
      y: frontPos.y,
      z: this.position.z - 1
    };
    let targetTile = world.getTileFromWorldPosition(targetPos);
    if (targetTile && targetTile.id !== 0 && !targetTile.isOccupiedAny()) {
      let oldPos = { x: this.position.x, y: this.position.y, z: this.position.z };
      creatureHandler.teleportCreature(this, targetPos);
      world.sendMagicEffect(oldPos, CONST.EFFECT.MAGIC.TELEPORT);
      return 100;
    }
    this.sendCancelMessage("You cannot levitate there.");
    return 0;
  }

  if (properties.direction === "down") {
    if (this.position.z >= 15) {
      this.sendCancelMessage("You cannot levitate there.");
      return 0;
    }
    // Down: front tile is empty (cliff edge) or has a hole → go down
    if (frontTile && frontTile.id !== 0 && frontTile.__getFloorChange() !== "down") {
      this.sendCancelMessage("You cannot levitate there.");
      return 0;
    }
    let targetPos = {
      x: frontPos.x,
      y: frontPos.y,
      z: this.position.z + 1
    };
    let targetTile = world.getTileFromWorldPosition(targetPos);
    if (targetTile && targetTile.id !== 0 && !targetTile.isOccupiedAny()) {
      let oldPos = { x: this.position.x, y: this.position.y, z: this.position.z };
      creatureHandler.teleportCreature(this, targetPos);
      world.sendMagicEffect(oldPos, CONST.EFFECT.MAGIC.TELEPORT);
      return 100;
    }
    this.sendCancelMessage("You cannot levitate there.");
    return 0;
  }

  this.sendCancelMessage("You cannot levitate there.");
  return 0;
};
