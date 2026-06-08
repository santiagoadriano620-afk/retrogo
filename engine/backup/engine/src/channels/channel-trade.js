"use strict";

const GlobalChannel = requireModule("channels/channel-global");
const { ChannelWritePacket } = requireModule("network/protocol");

const TRADE_COOLDOWN_MS = 120000;

const TradeChannel = function(id, name) {

  GlobalChannel.call(this, id, name);

  this.__lastMessageTime = new Map();

}

TradeChannel.prototype = Object.create(GlobalChannel.prototype);
TradeChannel.prototype.constructor = TradeChannel;

TradeChannel.prototype.send = function(player, clientPacket) {

  let now = Date.now();
  let lastTime = this.__lastMessageTime.get(player);

  if(lastTime !== undefined && (now - lastTime) < TRADE_COOLDOWN_MS) {
    let remaining = Math.ceil((TRADE_COOLDOWN_MS - (now - lastTime)) / 1000);
    return player.sendCancelMessage("You must wait " + remaining + " seconds before sending another trade message.");
  }

  let message = clientPacket.message.trim();

  if(message.substring(0, 4).toUpperCase() !== "SELL" && message.substring(0, 3).toUpperCase() !== "BUY") {
    return player.sendCancelMessage("Your message must start with 'SELL' or 'BUY'.");
  }

  this.__lastMessageTime.set(player, now);

  let packet = new ChannelWritePacket(
    this.id,
    player.getProperty(CONST.PROPERTIES.NAME),
    clientPacket.message,
    player.getTextColor()
  );

  this.__players.forEach(function(p) {
    p.write(packet);
  });

}

module.exports = TradeChannel;
