"use strict";

const { NPCTradePacket } = requireModule("network/protocol");

const TradeHandler = function (npc, trade) {

  /*
   * Class TradeHandler
   * Wrapper for NPCs who sell and buy items from players
   */

  this.npc = npc;
  this.trade = trade;

}

TradeHandler.prototype.hasTrades = function () {

  /*
   * Function TradeHandler.hasTrades
   * Returns true if the NPC has trades to make
   */

  return this.trade && this.trade.items && this.trade.items.length !== 0;

}

TradeHandler.prototype.__sendTradePacket = function (player) {

  /*
   * Function TradeHandler.__sendTradePacket
   * Sends the trade window data with up-to-date gold and ownership info
   */

  let gold = player.containerManager.equipment.getTotalGold();
  let equipment = player.containerManager.equipment;
  let backpack = equipment.peekIndex(CONST.EQUIPMENT.BACKPACK);
  let owned = [];

  if (backpack !== null) {
    this.trade.items.forEach(function (offer) {
      if (offer.type === "buy") {
        let count = equipment.__countResourceRecursive(backpack, offer.id);
        owned.push(Math.min(count, 255));
      } else {
        owned.push(0);
      }
    });
  } else {
    this.trade.items.forEach(function () { owned.push(0); });
  }

  player.write(new NPCTradePacket(this.npc.getId(), this.trade.items, gold, owned));

}

TradeHandler.prototype.openTradeWindow = function (player) {

  /*
   * Function TradeHandler.openTradeWindow
   * Opens trade window with a friendly NPC
   */

  this.__sendTradePacket(player);

  // Reset the NPC state
  this.npc.conversationHandler.getFocusHandler().reset();

}

TradeHandler.prototype.refreshTradeWindow = function (player) {

  /*
   * Function TradeHandler.refreshTradeWindow
   * Resends trade data without resetting NPC focus (used after buy/sell)
   */

  this.__sendTradePacket(player);

}

TradeHandler.prototype.getTradeItem = function (index) {

  /*
   * Function TradeHandler.getTradeItem
   * Returns the trade item for a particular index
   */

  // The request trade index is invalid
  if (index < 0 || index >= this.trade.items.length) {
    return null;
  }

  return this.trade.items[index];

}

module.exports = TradeHandler;
