module.exports = function explosiveArrow() {
  if (!this.containerManager || !this.containerManager.pickupItem) return 0;
  let item = gameServer.database.createThing(2546);
  if (!item) return 0;
  if (item.setCount) item.setCount(5);
  this.containerManager.pickupItem(item);
  return 100;
}
