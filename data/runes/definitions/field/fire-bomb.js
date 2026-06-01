const Position = requireModule("utils/position");

module.exports = function fireBomb(source, target) {
  process.gameServer.world.sendDistanceEffect(source.position, target.position, CONST.EFFECT.PROJECTILE.FIRE);
  let square = new Position(0, 0, 0).getSquare(1);
  square.forEach(function (offset) {
    let relPosition = target.position.add(offset);
    let tile = process.gameServer.world.getTileFromWorldPosition(relPosition);
    if (tile === null || tile.isBlockSolid()) return;
    tile.addTopThing(process.gameServer.database.createThing(1487));
  });
  return true;
}