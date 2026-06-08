module.exports = function enchantStaff() {
  if (!this.containerManager || !this.containerManager.equipment) return 0;
  let equipment = this.containerManager.equipment;
  let leftItem = equipment.peekIndex(CONST.EQUIPMENT.LEFT);
  if (leftItem && leftItem.id === 2401) {
    let newItem = gameServer.database.createThing(2433);
    if (!newItem) return 0;
    equipment.removeIndex(CONST.EQUIPMENT.LEFT, 1);
    equipment.addThing(newItem, CONST.EQUIPMENT.LEFT);
    return 100;
  }
  this.sendCancelMessage("You need a snakebite rod.");
  return 0;
}
