"use strict";

const AntiCheatManager = function () {
  this.__suspects = new Map();
};

AntiCheatManager.prototype.flagSuspect = function (player) {
  let name = player.getProperty(CONST.PROPERTIES.NAME);
  let existing = this.__suspects.get(name);
  if (existing) {
    existing.score++;
    existing.lastSeen = Date.now();
  } else {
    this.__suspects.set(name, {
      name: name,
      score: 1,
      firstSeen: Date.now(),
      lastSeen: Date.now()
    });
  }
  console.log("[ANTICHEAT] Suspect flagged: " + name + " (score: " + (existing ? existing.score : 1) + ")");
};

AntiCheatManager.prototype.getSuspects = function () {
  let result = [];
  this.__suspects.forEach(function (s) {
    result.push({
      name: s.name,
      score: s.score,
      firstSeen: s.firstSeen,
      lastSeen: s.lastSeen
    });
  });
  return result;
};

AntiCheatManager.prototype.clearSuspect = function (name) {
  this.__suspects.delete(name);
};

AntiCheatManager.prototype.getCheaters = function () {
  let cheaters = [];
  let players = gameServer.world.creatureHandler.getConnectedPlayers();
  players.forEach(function (p) {
    if (p.isCheater && p.isCheater()) {
      cheaters.push({
        name: p.getProperty(CONST.PROPERTIES.NAME)
      });
    }
  });
  return cheaters;
};

module.exports = AntiCheatManager;
