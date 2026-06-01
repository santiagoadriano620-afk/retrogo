const FOOD_IDS = [2666, 2671, 2681, 2674, 2689, 2690, 2696];

module.exports = function food() {
  if (!this.containerManager || !this.containerManager.pickupItem) return 0;
  let world = process.gameServer.world;
  let count = 1 + (Math.random() < 0.5 ? 1 : 0);
  for (let i = 0; i < count; i++) {
    let id = FOOD_IDS[Math.floor(Math.random() * FOOD_IDS.length)];
    let item = gameServer.database.createThing(id);
    if (item) {
      this.containerManager.pickupItem(item);
    }
  }
  world.sendMagicEffect(this.position, CONST.EFFECT.MAGIC.MAGIC_GREEN);
  return 100;
}
