const Position = requireModule("utils/position");

module.exports = function fireField(source, target) {

  /*
   * function suddenDeath
   * Code that handles the sudden death rune
   */

  // Get circle position for the GFB
  process.gameServer.world.sendDistanceEffect(source.position, target.position, CONST.EFFECT.PROJECTILE.FIRE);
  target.addTopThing(process.gameServer.database.createThing(1492));

  return true;

}
