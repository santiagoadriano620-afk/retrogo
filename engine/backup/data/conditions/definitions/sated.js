"use strict";

function onStart(creature) {

  /*
   * Function onStart
   * Callback fired on condition start
   */

  if (creature.sendCancelMessage) creature.sendCancelMessage("Yum!");

}

function onExpire(creature) {

  /*
   * Function onExpire
   * Callback fired on condition expire
   */

  if (creature.sendCancelMessage) creature.sendCancelMessage("You are feeling hungry!");

}

function onTick(creature) {

  // HP/MP regeneration is now handled by handleActionRegeneration in player-action-handler.js

}

module.exports.onStart = onStart;
module.exports.onExpire = onExpire;
module.exports.onTick = onTick;