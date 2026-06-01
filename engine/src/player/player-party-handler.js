"use strict";

const { CancelMessagePacket, ServerMessagePacket, ChannelWritePacket, PartyUpdatePacket } = requireModule("network/protocol");

const PlayerPartyHandler = function (player) {
  this.player = player;
};

PlayerPartyHandler.prototype.handleInvite = function (targetName) {
  if (!CONFIG.PARTY.ENABLED) {
    this.player.write(new CancelMessagePacket("Party system is disabled."));
    return;
  }
  gameServer.world.partyManager.setInvite(this.player, targetName);
};

PlayerPartyHandler.prototype.handleJoin = function (inviterName) {
  if (!CONFIG.PARTY.ENABLED) {
    this.player.write(new CancelMessagePacket("Party system is disabled."));
    return;
  }
  gameServer.world.partyManager.acceptInvite(this.player, inviterName);
};

PlayerPartyHandler.prototype.handleLeave = function () {
  gameServer.world.partyManager.leaveParty(this.player);
};

PlayerPartyHandler.prototype.handleKick = function (targetName) {
  gameServer.world.partyManager.kickMember(this.player, targetName);
};

PlayerPartyHandler.prototype.handlePassLeadership = function (targetName) {
  let party = this.player.party;
  if (!party || party.leader !== this.player) {
    this.player.write(new CancelMessagePacket("You are not the party leader."));
    return;
  }
  let target = party.members.find(m => m.getProperty(CONST.PROPERTIES.NAME) === targetName);
  if (!target) {
    this.player.write(new CancelMessagePacket("Player not found in party."));
    return;
  }

  let oldLeaderName = this.player.getProperty(CONST.PROPERTIES.NAME);
  let newLeaderName = target.getProperty(CONST.PROPERTIES.NAME);

  party.leader = target;

  this.player.write(new ServerMessagePacket("You have passed leadership to " + newLeaderName + "."));
  target.write(new ServerMessagePacket("You are now the party leader."));

  party.members.forEach(function (member) {
    if (member === this.player) return;
    if (member === target) return;
    member.write(new ChannelWritePacket(CONST.CHANNEL.DEFAULT, "Party", oldLeaderName + " has transferred leadership to " + newLeaderName + ".", CONST.COLOR.LIGHTGREEN));
  }, this);

  party.members.forEach(function (member) {
    member.write(new PartyUpdatePacket(party));
  });

  gameServer.world.partyManager.__updatePartyShields(party);
};

module.exports = PlayerPartyHandler;
