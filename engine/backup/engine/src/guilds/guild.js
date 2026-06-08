"use strict";

const Guild = function (name, leader) {
  this.name = name;
  this.leader = leader;
  this.members = [{ name: leader, rank: "leader", title: "Leader", joinedAt: Date.now() }];
  this.bank = 0;
  this.hallId = null;
  this.wars = [];
  this.createdAt = Date.now();
};

Guild.prototype.getMember = function (playerName) {
  return this.members.find(function (m) {
    return m.name.toLowerCase() === playerName.toLowerCase();
  }) || null;
};

Guild.prototype.isLeader = function (playerName) {
  let m = this.getMember(playerName);
  return m && m.rank === "leader";
};

Guild.prototype.isViceOrLeader = function (playerName) {
  let m = this.getMember(playerName);
  return m && (m.rank === "leader" || m.rank === "vice");
};

Guild.prototype.toJSON = function () {
  return {
    name: this.name,
    leader: this.leader,
    members: this.members,
    bank: this.bank,
    hallId: this.hallId,
    wars: this.wars,
    createdAt: this.createdAt
  };
};

Guild.fromJSON = function (data) {
  let guild = new Guild(data.name, data.leader);
  guild.members = data.members || [];
  if (!guild.getMember(data.leader)) {
    guild.members.push({ name: data.leader, rank: "leader", title: "Leader", joinedAt: data.createdAt || Date.now() });
  }
  guild.bank = data.bank || 0;
  guild.hallId = data.hallId || null;
  guild.wars = data.wars || [];
  guild.createdAt = data.createdAt || Date.now();
  return guild;
};

module.exports = Guild;
