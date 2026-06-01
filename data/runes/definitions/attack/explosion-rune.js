module.exports = function explosionRune(source, target) {
  process.gameServer.world.sendDistanceEffect(source.position, target.position, CONST.EFFECT.PROJECTILE.EXPLOSION);
  process.gameServer.world.sendMagicEffect(target.position, CONST.EFFECT.MAGIC.EXPLOSIONHIT);
  if (target.players.size === 0 && target.monsters.size === 0) {
    return true;
  }
  let minDamage = 20;
  let maxDamage = 100;
  let areaPositions = target.position.getRadius(1);
  areaPositions.forEach(function (position) {
    let tile = process.gameServer.world.getTileFromWorldPosition(position);
    if (tile === null || tile.isBlockSolid()) return;
    tile.players.forEach(function (creature) {
      if (creature !== source) {
        let damage = Number.prototype.random(minDamage, maxDamage);
        process.gameServer.world.__damageEntity(source, creature, damage, CONST.COLOR.WHITE, "fire");
      }
    });
    tile.monsters.forEach(function (monster) {
      let damage = Number.prototype.random(minDamage, maxDamage);
      process.gameServer.world.__damageEntity(source, monster, damage, CONST.COLOR.WHITE);
    });
  });
  return true;
}
