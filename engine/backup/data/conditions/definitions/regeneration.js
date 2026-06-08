"use strict";

function onStart(creature) {

  /*
   * Function onStart
   * Callback fired on condition start
   */

}

function onExpire(creature) {

  /*
   * Function onExpire
   * Callback fired on condition expire
   */

}

function onTick(creature) {

  /*
   * Function onTick
   * Callback fired every condition tick (600ms = 1 food tick)
   * Heals 1 HP per tick (always) and 1 MP per tick (only outside combat)
   */

  if (!creature.isFullHealth()) {
    creature.increaseHealth(1);
  }

  if (!creature.isFull(CONST.PROPERTIES.MANA) && !creature.isInCombat()) {
    creature.increaseMana(1);
  }

}

module.exports.onStart = onStart;
module.exports.onExpire = onExpire;
module.exports.onTick = onTick;