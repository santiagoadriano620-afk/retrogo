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

  /*
   * Function onTick
   * Callback fired every condition tick
   * Regenerates 1 HP per tick (always) + 1 MP per tick (only outside combat)
   */

  let hp = creature.getProperty(CONST.PROPERTIES.HEALTH);
  let hpMax = creature.getProperty(CONST.PROPERTIES.HEALTH_MAX);
  let mp = creature.getProperty(CONST.PROPERTIES.MANA);
  let mpMax = creature.getProperty(CONST.PROPERTIES.MANA_MAX);

  if (hp < hpMax) {
    creature.setProperty(CONST.PROPERTIES.HEALTH, Math.min(hp + 1, hpMax));
  }

  if (!creature.isInCombat() && mp < mpMax) {
    creature.setProperty(CONST.PROPERTIES.MANA, Math.min(mp + 1, mpMax));
  }

}

module.exports.onStart = onStart;
module.exports.onExpire = onExpire;
module.exports.onTick = onTick;