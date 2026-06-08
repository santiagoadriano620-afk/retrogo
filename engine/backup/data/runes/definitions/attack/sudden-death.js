module.exports = function suddenDeath(source, target) {
  let top = target.getTopCreature();
  if (top === null || top === source) {
    return true;
  }
  process.gameServer.world.sendDistanceEffect(source.position, target.position, CONST.EFFECT.PROJECTILE.DEATH);
  process.gameServer.world.sendMagicEffect(target.position, CONST.EFFECT.MAGIC.MORTAREA);
  let damage = Number.prototype.random(100, 170);
  process.gameServer.world.__damageEntity(source, top, damage, CONST.COLOR.WHITE, "physical");
  return true;
}
