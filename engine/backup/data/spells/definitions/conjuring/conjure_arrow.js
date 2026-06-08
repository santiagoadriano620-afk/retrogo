module.exports = function conjureArrow() {
  if (!this.containerManager || !this.containerManager.pickupItem) return 0;
  let item = gameServer.database.createThing(2544);
  if (!item) return 0;
  if (item.setCount) item.setCount(15);
  this.containerManager.pickupItem(item);
  return 100;
}
