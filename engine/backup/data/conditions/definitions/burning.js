"use strict";

function onStart(creature) {
  if (creature.sendCancelMessage) creature.sendCancelMessage("You are burning!");
  // Initial burst damage when stepping on the field
  process.gameServer.world.combatHandler.applyEnvironmentalDamage(creature, 20, CONST.COLOR.ORANGE);
  process.gameServer.world.sendMagicEffect(creature.position, CONST.EFFECT.MAGIC.HITBYFIRE);
}

function onExpire(creature) {
  if (creature.sendCancelMessage) creature.sendCancelMessage("You feel better again.");
}

function onTick(creature) {
  // 10 damage per tick, 7 ticks at 9-second intervals
  process.gameServer.world.combatHandler.applyEnvironmentalDamage(creature, 10, CONST.COLOR.ORANGE);
  process.gameServer.world.sendMagicEffect(creature.position, CONST.EFFECT.MAGIC.HITBYFIRE);
}

module.exports.onStart = onStart;
module.exports.onExpire = onExpire;
module.exports.onTick = onTick;