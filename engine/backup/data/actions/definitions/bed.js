module.exports = function useBed(player, tile, index, item) {

  if (player.isMoving()) {
    return player.sendCancelMessage("You cannot do this while moving.");
  }

  if (!player.isBesidesThing(tile)) {
    return player.sendCancelMessage("You need to be closer.");
  }

  if (tile.constructor.name !== "Tile") {
    return;
  }

  if (!tile.isHouseTile()) {
    return player.sendCancelMessage("You can only sleep in a bed inside a house.");
  }

  if (!player.ownsHouseTile(tile)) {
    return player.sendCancelMessage("You do not own this house.");
  }

  let prototype = process.gameServer.database.getThingPrototype(item.id);
  if (!prototype || prototype.properties.type !== "bed") {
    return;
  }

  let props = prototype.properties;

  if (props.readable === "true") {
    return false;
  }

  let sex = player.getProperty(CONST.PROPERTIES.SEX);
  let sleeperId = parseInt(sex === 1 || !props.femaleSleeper ? props.maleSleeper : props.femaleSleeper);

  let sleeper = process.gameServer.database.createThing(sleeperId);
  if (!sleeper) {
    return player.sendCancelMessage("Something went wrong.");
  }

  item.replace(sleeper);

  let partnerPos = getPartnerPosition(tile.position, props.partnerDirection);

  player.__bedPosition = partnerPos;
  player.__bedDirection = props.partnerDirection;
  player.position = partnerPos;

  process.gameServer.world.sendMagicEffect(tile.position, CONST.EFFECT.MAGIC.POFF);

  player.disconnect();

  return false;

};

function getPartnerPosition(pos, direction) {
  switch (direction) {
    case "north": return pos.north();
    case "south": return pos.south();
    case "east": return pos.east();
    case "west": return pos.west();
  }
}
