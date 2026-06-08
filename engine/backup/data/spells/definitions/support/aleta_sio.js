module.exports = function aletaSio() {
  let tile = this.getTile();
  if (!tile || !tile.isHouseTile()) {
    this.sendCancelMessage("You are not inside a house.");
    return 0;
  }
  let house = tile.house;
  if (house.owner !== this.name) {
    this.sendCancelMessage("You do not own this house.");
    return 0;
  }
  const { HouseManageInfoPacket } = requireModule("network/protocol");
  let json = JSON.stringify({
    houseId: house.id,
    name: house.name,
    sqm: house.tiles ? house.tiles.length : 0,
    guildhall: house.guildhall || false,
    owner: house.owner,
    invited: house.invited || [],
    rentDueDate: house.rentDueDate,
    rentPending: house.rentPending || false,
    rentPrice: house.rentPrice || 0,
    forRent: house.forRent || false,
    sellPrice: house.sellPrice || 0,
    forSale: house.forSale || false
  });
  this.write(new HouseManageInfoPacket(json));
  process.gameServer.world.sendMagicEffect(this.position, CONST.EFFECT.MAGIC.MAGIC_BLUE);
  return 100;
};
