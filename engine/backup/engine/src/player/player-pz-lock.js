"use strict";

const GenericLock = requireModule("utils/generic-lock");

const PZLock = function(player) {

  /*
   * Class PZLock
   * Wrapper for the player PZ (protection zone) lock so they cannot log out for 60 seconds
   * when attacked by a monster or targeted by another player
   */

  // Inherit from generic lock to use all the toys
  GenericLock.call(this);

  // Owner of the lock
  this.__player = player;

  // Assign the callbacks to add or remove the condition during lock / unlock
  this.on("lock", this.__onLock.bind(this));
  this.on("unlock", this.__onUnlock.bind(this));

}

PZLock.prototype = Object.create(GenericLock.prototype);
PZLock.prototype.constructor = PZLock;

PZLock.prototype.activate = function() {

  /*
   * Function PZLock.activate
   * Triggers or extends the PZ lock
   */

  const PZ_LOCK_SECONDS = 60;

  this.lockSeconds(PZ_LOCK_SECONDS);

}

PZLock.prototype.__onLock = function() {

  /*
   * Function PZLock.__onLock
   * Adds the condition to the player to show on the status bar
   */

  this.__player.addCondition(CONST.CONDITION.PZ_LOCK, -1, 0, null);

}

PZLock.prototype.__onUnlock = function() {

  /*
   * Function PZLock.__onUnlock
   * Removes the condition from the player
   */

  this.__player.removeCondition(CONST.CONDITION.PZ_LOCK);

}

module.exports = PZLock;
