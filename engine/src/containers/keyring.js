"use strict";

const Container = requireModule("containers/container");

const KeyRing = function(id, size) {

  /*
   * Class KeyRing
   * Container that only accepts keys with action IDs
   */

  Container.call(this, id, size);

}

KeyRing.prototype = Object.create(Container.prototype);
KeyRing.prototype.constructor = KeyRing;

KeyRing.prototype.__isKey = function(thing) {
  return thing.constructor.name === "Key" && thing.hasOwnProperty("actionId");
}

KeyRing.prototype.getMaximumAddCount = function(player, thing, index) {
  if (!this.__isKey(thing)) {
    return 0;
  }
  return Container.prototype.getMaximumAddCount.call(this, player, thing, index);
}

KeyRing.prototype.addThing = function(thing, index) {
  if (!this.__isKey(thing)) {
    return false;
  }
  return Container.prototype.addThing.call(this, thing, index);
}

KeyRing.prototype.addThingSmart = function(thing) {
  if (!this.__isKey(thing)) {
    return false;
  }
  return Container.prototype.addThingSmart.call(this, thing);
}

KeyRing.prototype.addFirstEmpty = function(thing) {
  if (!this.__isKey(thing)) {
    return false;
  }
  return Container.prototype.addFirstEmpty.call(this, thing);
}

module.exports = KeyRing;
