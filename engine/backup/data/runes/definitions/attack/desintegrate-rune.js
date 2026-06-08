module.exports = function desintegrateRune(source, target) {
  let item;
  if (typeof target.peekItem === "function") {
    item = target.peekItem(0xFF);
  } else {
    item = target;
  }
  if (item === null) {
    process.gameServer.world.sendMagicEffect(source.position, CONST.EFFECT.MAGIC.POFF);
    return false;
  }
  if (!item.isMoveable()) {
    process.gameServer.world.sendMagicEffect(source.position, CONST.EFFECT.MAGIC.POFF);
    return false;
  }
  item.remove();
  process.gameServer.world.sendMagicEffect(target.position, CONST.EFFECT.MAGIC.POFF);
  source.sendCancelMessage("The item crumbles and turns to dust.");
  return true;
}
