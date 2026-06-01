module.exports = function conjureBolt() {
  if (!this.containerManager || !this.containerManager.pickupItem) return 0;
  let item = gameServer.database.createThing(2543);
  if (!item) return 0;
  if (item.setCount) item.setCount(10);
  this.containerManager.pickupItem(item);
  return 100;
}
