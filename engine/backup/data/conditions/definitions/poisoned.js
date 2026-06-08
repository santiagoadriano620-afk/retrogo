"use strict";

function onStart(creature, properties) {
  if (creature.sendCancelMessage) creature.sendCancelMessage("You were poisoned!");
  var initialDamage = (properties && properties.initialDamage !== undefined) ? properties.initialDamage : 5;
  process.gameServer.world.combatHandler.applyEnvironmentalDamage(creature, initialDamage, CONST.COLOR.LIGHTGREEN);
  process.gameServer.world.sendMagicEffect(creature.position, CONST.EFFECT.MAGIC.GREEN_RINGS);
}

function onExpire(creature) {
  if (creature.sendCancelMessage) creature.sendCancelMessage("You feel healthy again.");
}

function onTick(creature) {
  // Wiki formula: 4×5, 5×4, 7×3, 10×2, 19×1 = 100 total over 45 ticks
  let remaining = this.numberTicks;
  let damage;
  if (remaining > 41) damage = 5;
  else if (remaining > 36) damage = 4;
  else if (remaining > 29) damage = 3;
  else if (remaining > 19) damage = 2;
  else damage = 1;

  process.gameServer.world.combatHandler.applyEnvironmentalDamage(creature, damage, CONST.COLOR.LIGHTGREEN);
  process.gameServer.world.sendMagicEffect(creature.position, CONST.EFFECT.MAGIC.GREEN_RINGS);
}

module.exports.onStart = onStart;
module.exports.onExpire = onExpire;
module.exports.onTick = onTick;