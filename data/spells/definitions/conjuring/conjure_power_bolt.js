module.exports = function conjurePowerBolt() {
  if (!this.containerManager || !this.containerManager.pickupItem) return 0;
  let item = gameServer.database.createThing(2547);
  if (!item) return 0;
  if (item.setCount) item.setCount(1);
  this.containerManager.pickupItem(item);
  return 100;
}
