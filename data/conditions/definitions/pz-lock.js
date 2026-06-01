"use strict";

function onStart(creature) {

  /*
   * Function onStart
   * Callback fired on condition start
   */

  if (creature.sendCancelMessage) creature.sendCancelMessage("You are now in combat. You may not logout for 60 seconds.");

}

function onExpire(creature) {

  /*
   * Function onExpire
   * Callback fired on condition expire
   */

  if (creature.sendCancelMessage) creature.sendCancelMessage("You are no longer in combat.");

}

function onTick(creature) {

  /*
   * Function onTick
   * Callback fired every condition tick
   */

}

module.exports.onStart = onStart;
module.exports.onExpire = onExpire;
module.exports.onTick = onTick;
