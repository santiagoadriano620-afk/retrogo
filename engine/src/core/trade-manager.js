"use strict";

const TradeSession = function (playerA, playerB) {
  this.playerA = playerA;
  this.playerB = playerB;
  this.itemsA = [];
  this.itemsB = [];
  this.goldA = 0;
  this.goldB = 0;
  this.confirmedA = false;
  this.confirmedB = false;
  this.state = "REQUESTED";
};

const TradeManager = function () {
  this.__sessions = new Map();
};

TradeManager.prototype.requestTrade = function (source, targetId) {
  if (source.tradeSession) {
    source.sendCancelMessage("You are already in a trade.");
    return false;
  }

  let world = process.gameServer.world;
  let target = world.creatureHandler.getCreatureFromId(targetId);
  if (!target || !target.isPlayer()) {
    source.sendCancelMessage("Player not found.");
    return false;
  }

  if (target.tradeSession) {
    source.sendCancelMessage(target.getProperty(CONST.PROPERTIES.NAME) + " is already in a trade.");
    return false;
  }

  if (!source.position.isWithinRangeOf(target.position, 2)) {
    source.sendCancelMessage("You are too far away.");
    return false;
  }

  let session = new TradeSession(source, target);
  this.__sessions.set(source.getProperty(CONST.PROPERTIES.NAME), session);
  this.__sessions.set(target.getProperty(CONST.PROPERTIES.NAME), session);
  source.tradeSession = session;
  target.tradeSession = session;

  const { TradeRequestPacket } = requireModule("network/protocol");
  target.write(new TradeRequestPacket(source.getProperty(CONST.PROPERTIES.NAME)));
  return true;
};

TradeManager.prototype.acceptTrade = function (player) {
  let session = player.tradeSession;
  if (!session || session.state !== "REQUESTED") return false;

  session.state = "ACTIVE";
  const { TradeStartPacket } = requireModule("network/protocol");
  let opponent = this.__getOpponent(player, session);
  session.playerA.write(new TradeStartPacket(
    session.playerA.getProperty(CONST.PROPERTIES.NAME),
    opponent.getProperty(CONST.PROPERTIES.NAME)
  ));
  session.playerB.write(new TradeStartPacket(
    session.playerB.getProperty(CONST.PROPERTIES.NAME),
    opponent.getProperty(CONST.PROPERTIES.NAME)
  ));
  return true;
};

TradeManager.prototype.rejectTrade = function (player) {
  let session = player.tradeSession;
  if (!session) return false;
  this.__cancelSession(session, "Trade cancelled.");
  return true;
};

TradeManager.prototype.addItem = function (player, containerId, slotIndex, count) {
  let session = player.tradeSession;
  if (!session || session.state !== "ACTIVE") return false;

  let container = player.containerManager.getContainerFromId(containerId);
  if (!container) return false;

  let item = container.peekIndex(slotIndex);
  if (!item) return false;

  if (!item.isMoveable()) {
    player.sendCancelMessage("This item cannot be traded.");
    return false;
  }

  let isPlayerA = player === session.playerA;
  let items = isPlayerA ? session.itemsA : session.itemsB;
  if (items.length >= 20) {
    player.sendCancelMessage("You can only trade up to 20 items.");
    return false;
  }

  count = count || item.getCount() || 1;
  if (count > (item.getCount() || 1)) count = item.getCount() || 1;

  items.push({
    containerId: containerId,
    slotIndex: slotIndex,
    itemId: item.id,
    count: count
  });

  this.__broadcastUpdate(session);
  return true;
};

TradeManager.prototype.removeItem = function (player, slotIndex) {
  let session = player.tradeSession;
  if (!session || session.state !== "ACTIVE") return false;

  let isPlayerA = player === session.playerA;
  let items = isPlayerA ? session.itemsA : session.itemsB;

  if (slotIndex < 0 || slotIndex >= items.length) return false;
  items.splice(slotIndex, 1);

  this.__broadcastUpdate(session);
  return true;
};

TradeManager.prototype.setGold = function (player, amount) {
  let session = player.tradeSession;
  if (!session || session.state !== "ACTIVE") return false;

  if (amount < 0) amount = 0;

  let totalGold = player.containerManager.equipment.getTotalGold();
  if (amount > totalGold) {
    player.sendCancelMessage("You do not have enough gold.");
    return false;
  }

  let isPlayerA = player === session.playerA;
  if (isPlayerA) {
    session.goldA = amount;
  } else {
    session.goldB = amount;
  }

  session.confirmedA = false;
  session.confirmedB = false;

  this.__broadcastUpdate(session);
  return true;
};

TradeManager.prototype.confirmTrade = function (player) {
  let session = player.tradeSession;
  if (!session || session.state !== "ACTIVE") return false;

  let isPlayerA = player === session.playerA;
  if (isPlayerA) {
    session.confirmedA = true;
  } else {
    session.confirmedB = true;
  }

  const { TradeConfirmPacket } = requireModule("network/protocol");
  session.playerA.write(new TradeConfirmPacket(session.confirmedA, session.confirmedB));
  session.playerB.write(new TradeConfirmPacket(session.confirmedA, session.confirmedB));

  if (session.confirmedA && session.confirmedB) {
    this.__finalizeTrade(session);
  }
  return true;
};

TradeManager.prototype.cancelTrade = function (player, reason) {
  let session = player.tradeSession;
  if (!session) return false;
  this.__cancelSession(session, reason || "Trade cancelled.");
  return true;
};

TradeManager.prototype.__finalizeTrade = function (session) {
  let aItems = session.itemsA;
  let bItems = session.itemsB;
  let aGold = session.goldA;
  let bGold = session.goldB;
  let playerA = session.playerA;
  let playerB = session.playerB;

  if (!this.__verifyItems(playerA, aItems) || !this.__verifyItems(playerB, bItems)) {
    return this.__cancelSession(session, "Trade failed: items changed.");
  }

  if (playerA.containerManager.equipment.getTotalGold() < aGold ||
      playerB.containerManager.equipment.getTotalGold() < bGold) {
    return this.__cancelSession(session, "Trade failed: insufficient gold.");
  }

  let weightNeededA = this.__calculateItemWeight(aItems) + bGold;
  let weightNeededB = this.__calculateItemWeight(bItems) + aGold;
  let freeCapA = playerA.getProperty(CONST.PROPERTIES.CAPACITY_MAX) * 100 - playerA.containerManager.equipment.getTotalWeight();
  let freeCapB = playerB.getProperty(CONST.PROPERTIES.CAPACITY_MAX) * 100 - playerB.containerManager.equipment.getTotalWeight();

  if (freeCapB < weightNeededA) {
    return this.__cancelSession(session, playerB.getProperty(CONST.PROPERTIES.NAME) + " does not have enough capacity.");
  }
  if (freeCapA < weightNeededB) {
    return this.__cancelSession(session, playerA.getProperty(CONST.PROPERTIES.NAME) + " does not have enough capacity.");
  }

  if (!this.__canPushItems(playerA, bItems) || !this.__canPushItems(playerB, aItems)) {
    return this.__cancelSession(session, "Trade failed: no space available.");
  }

  this.__transferItems(playerA, playerB, aItems);
  this.__transferItems(playerB, playerA, bItems);
  this.__transferGold(playerA, playerB, aGold);
  this.__transferGold(playerB, playerA, bGold);

  session.state = "COMPLETED";

  const { TradeCompletePacket } = requireModule("network/protocol");
  session.playerA.write(new TradeCompletePacket());
  session.playerB.write(new TradeCompletePacket());

  this.__cleanup(session);
};

TradeManager.prototype.__verifyItems = function (player, items) {
  return items.every(function (entry) {
    let container = player.containerManager.getContainerFromId(entry.containerId);
    if (!container) return false;
    let item = container.peekIndex(entry.slotIndex);
    return item && item.id === entry.itemId && (item.getCount() || 1) >= entry.count;
  });
};

TradeManager.prototype.__canPushItems = function (player, items) {
  let eq = player.containerManager.equipment;
  return items.every(function (entry) {
    let thing = process.gameServer.database.createThing(entry.itemId);
    if (thing.isStackable()) {
      thing.setCount(entry.count);
    }
    return eq.canPushItem(thing);
  });
};

TradeManager.prototype.__calculateItemWeight = function (items) {
  let total = 0;
  items.forEach(function (entry) {
    let proto = process.gameServer.database.getThingPrototype(entry.itemId);
    if (proto) {
      total += (proto.properties.weight || 0) * entry.count;
    }
  });
  return total;
};

TradeManager.prototype.__transferItems = function (fromPlayer, toPlayer, items) {
  items.forEach(function (entry) {
    let container = fromPlayer.containerManager.getContainerFromId(entry.containerId);
    if (!container) return;

    let removed = container.removeIndex(entry.slotIndex, entry.count);
    if (removed) {
      let thing = process.gameServer.database.createThing(entry.itemId);
      if (thing.isStackable()) {
        thing.setCount(entry.count);
      }
      toPlayer.containerManager.equipment.pushItem(thing);
    }
  });
};

TradeManager.prototype.__transferGold = function (fromPlayer, toPlayer, amount) {
  if (amount <= 0) return;

  fromPlayer.containerManager.equipment.payWithResource(2148, amount);

  while (amount > 0) {
    let stackSize = Math.min(amount, 100);
    let thing = process.gameServer.database.createThing(2148);
    thing.setCount(stackSize);
    toPlayer.containerManager.equipment.pushItem(thing);
    amount -= stackSize;
  }
};

TradeManager.prototype.__broadcastUpdate = function (session) {
  session.confirmedA = false;
  session.confirmedB = false;

  const { TradeUpdatePacket } = requireModule("network/protocol");
  session.playerA.write(new TradeUpdatePacket(
    session.itemsB, session.goldB, session.itemsA, session.goldA
  ));
  session.playerB.write(new TradeUpdatePacket(
    session.itemsA, session.goldA, session.itemsB, session.goldB
  ));
};

TradeManager.prototype.__cancelSession = function (session, reason) {
  if (session.state === "COMPLETED" || session.state === "CANCELLED") return;

  session.state = "CANCELLED";
  const { TradeCancelPacket } = requireModule("network/protocol");
  try { session.playerA.write(new TradeCancelPacket(reason)); } catch (e) {}
  try { session.playerB.write(new TradeCancelPacket(reason)); } catch (e) {}
  this.__cleanup(session);
};

TradeManager.prototype.__cleanup = function (session) {
  if (session.playerA) {
    session.playerA.tradeSession = null;
    this.__sessions.delete(session.playerA.getProperty(CONST.PROPERTIES.NAME));
  }
  if (session.playerB) {
    session.playerB.tradeSession = null;
    this.__sessions.delete(session.playerB.getProperty(CONST.PROPERTIES.NAME));
  }
};

TradeManager.prototype.__getOpponent = function (player, session) {
  return player === session.playerA ? session.playerB : session.playerA;
};

module.exports = TradeManager;
