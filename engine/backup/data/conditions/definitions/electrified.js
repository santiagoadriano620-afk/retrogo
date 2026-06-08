"use strict";

function onStart(creature) {
  if (creature.sendCancelMessage) creature.sendCancelMessage("You were electrified!");
  // Initial 30 damage when stepping on field
  process.gameServer.world.combatHandler.applyEnvironmentalDamage(creature, 30, CONST.COLOR.LIGHTBLUE);
  process.gameServer.world.sendMagicEffect(creature.position, CONST.EFFECT.MAGIC.ENERGYHIT);
}

function onExpire(creature) {
  if (creature.sendCancelMessage) creature.sendCancelMessage("You feel better again.");
}

function onTick(creature) {
  // Remaining 25 damage split over 2 ticks (13 + 12)
  let damage = this.isFirstTick() ? 13 : 12;
  process.gameServer.world.combatHandler.applyEnvironmentalDamage(creature, damage, CONST.COLOR.LIGHTBLUE);
  process.gameServer.world.sendMagicEffect(creature.position, CONST.EFFECT.MAGIC.ENERGYHIT);
}

module.exports.onStart = onStart;
module.exports.onExpire = onExpire;
module.exports.onTick = onTick;