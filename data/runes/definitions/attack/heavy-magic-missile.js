module.exports = function heavyMagicMissile(source, target) {
  let top = target.getTopCreature();
  if (top === null || top === source) {
    return true;
  }
  process.gameServer.world.sendDistanceEffect(source.position, target.position, CONST.EFFECT.PROJECTILE.ENERGY);
  process.gameServer.world.sendMagicEffect(target.position, CONST.EFFECT.MAGIC.ENERGYHIT);
  let damage = Number.prototype.random(20, 40);
  process.gameServer.world.__damageEntity(source, top, damage, CONST.COLOR.LIGHTBLUE, "energy");
  return true;
}
