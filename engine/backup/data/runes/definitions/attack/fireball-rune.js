module.exports = function fireballRune(source, target) {
  process.gameServer.world.sendDistanceEffect(source.position, target.position, CONST.EFFECT.PROJECTILE.FIRE);
  process.gameServer.world.sendMagicEffect(target.position, CONST.EFFECT.MAGIC.FIREAREA);
  let minDamage = 15;
  let maxDamage = 35;
  let areaPositions = target.position.getRadius(1);
  areaPositions.forEach(function (position) {
    let tile = process.gameServer.world.getTileFromWorldPosition(position);
    if (tile === null || tile.isBlockSolid()) return;
    process.gameServer.world.sendMagicEffect(position, CONST.EFFECT.MAGIC.FIREAREA);
    tile.players.forEach(function (creature) {
      if (creature !== source) {
        let damage = Number.prototype.random(minDamage, maxDamage);
        process.gameServer.world.__damageEntity(source, creature, damage, CONST.COLOR.ORANGE, "fire");
      }
    });
    tile.monsters.forEach(function (monster) {
      let damage = Number.prototype.random(minDamage, maxDamage);
      process.gameServer.world.__damageEntity(source, monster, damage, CONST.COLOR.ORANGE);
    });
  });
  return true;
}
