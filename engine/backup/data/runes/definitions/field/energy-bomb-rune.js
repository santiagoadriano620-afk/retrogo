const Position = requireModule("utils/position");

module.exports = function energyBombRune(source, target) {
  process.gameServer.world.sendDistanceEffect(source.position, target.position, CONST.EFFECT.PROJECTILE.ENERGY);
  let square = new Position(0, 0, 0).getSquare(1);
  square.forEach(function (offset) {
    let relPos = target.position.add(offset);
    let tile = process.gameServer.world.getTileFromWorldPosition(relPos);
    if (tile === null || tile.isBlockSolid()) return;
    tile.addTopThing(process.gameServer.database.createThing(1495));
  });
  return true;
}
