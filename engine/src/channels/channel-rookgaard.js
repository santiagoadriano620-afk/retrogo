"use strict";

const GlobalChannel = requireModule("channels/channel-global");

const RookgaardChannel = function(id, name) {

  GlobalChannel.call(this, id, name);

}

RookgaardChannel.prototype = Object.create(GlobalChannel.prototype);
RookgaardChannel.prototype.constructor = RookgaardChannel;

RookgaardChannel.prototype.join = function(player) {

  if(player.getProperty(CONST.PROPERTIES.VOCATION) !== CONST.VOCATION.NONE) {
    return player.sendCancelMessage("Only rookgaard characters can enter this channel.");
  }

  GlobalChannel.prototype.join.call(this, player);

}

module.exports = RookgaardChannel;
