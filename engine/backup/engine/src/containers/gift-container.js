"use strict";

const Item = require("../entities/item");
const BaseContainer = require("../containers/base-container");

const GiftContainer = function (cid, things, player) {

  const GIFT_SIZE = 20;

  this.__player = player;

  this.container = new BaseContainer(cid, Math.max(GIFT_SIZE, things.length));

  this.__addGiftItems(things);

}

GiftContainer.prototype.getTopParent = function () {
  return this.__player;
}

GiftContainer.prototype.toJSON = function () {
  return this.container.__slots.map(function (item) {
    return item === null ? null : item.toJSON();
  });
}

GiftContainer.prototype.getMaximumAddCount = function (player, item, index) {
  return 0;
}

GiftContainer.prototype.peekIndex = function (index) {
  return this.container.peekIndex(index);
}

GiftContainer.prototype.removeIndex = function (index, amount) {
  let thing = this.container.removeIndex(index, amount);
  thing.setParent(null);
  return thing;
}

GiftContainer.prototype.deleteThing = function (thing) {
  let index = this.container.deleteThing(thing);
  if (index === -1) return -1;
  thing.setParent(null);
  return index;
}

GiftContainer.prototype.addThing = function (thing, index) {
  if (index >= this.container.size) return false;
  thing.setParent(this);
  this.container.addThing(thing, index);
  return true;
}

GiftContainer.prototype.addThingSmart = function (thing) {
  thing.setParent(this);
  return this.container.addThingSmart(thing);
}

GiftContainer.prototype.canAddFirstEmpty = function (thing) {
  return false;
}

GiftContainer.prototype.addFirstEmpty = function (thing) {
  return false;
}

GiftContainer.prototype.isContainer = function () {
  return true;
}

GiftContainer.prototype.__addGiftItems = function (things) {
  things.forEach(function (thing, index) {
    if (thing !== null) {
      let t = process.gameServer.database.parseThing(thing);
      if (!t) return;
      t.setParent(this);
      this.container.__slots[index] = t;
    }
  }, this);
}

module.exports = GiftContainer;
