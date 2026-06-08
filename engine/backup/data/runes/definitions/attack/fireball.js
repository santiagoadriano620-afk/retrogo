module.exports = function greatFireball(source, target) {
  process.gameServer.world.sendDistanceEffect(source.position, target.position, CONST.EFFECT.PROJECTILE.FIRE);
  let minDamage = 35;
  let maxDamage = 65;
  let areaPositions = target.position.getRadius(4);
  areaPositions.forEach(function (position) {
    let tile = process.gameServer.world.getTileFromWorldPosition(position);
    if (tile === null || tile.isBlockSolid()) {
      return;
    }
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
