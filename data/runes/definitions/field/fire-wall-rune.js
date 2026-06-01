const Position = requireModule("utils/position");

module.exports = function fireWallRune(source, target) {
  process.gameServer.world.sendDistanceEffect(source.position, target.position, CONST.EFFECT.PROJECTILE.FIRE);
  let offsets = new Position(0, 0, 0).getCross(1);
  offsets.forEach(function (offset) {
    let relPos = target.position.add(offset);
    let tile = process.gameServer.world.getTileFromWorldPosition(relPos);
    if (tile === null || tile.isBlockSolid()) return;
    tile.addTopThing(process.gameServer.database.createThing(1487));
  });
  return true;
}
