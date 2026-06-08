"use strict";

const { CancelMessagePacket, ServerMessagePacket, ChannelWritePacket, PartyInvitePacket, PartyJoinPacket, PartyLeavePacket, PartySkullPacket, PartyShieldPacket, PartyUpdatePacket, PartyDataPacket } = requireModule("network/protocol");

const PartyManager = function () {
  this.__parties = new Map();
  this.__pendingInvites = new Map();
};

PartyManager.prototype.createParty = function (leader) {
  let party = {
    id: this.__parties.size + 1,
    leader: leader,
    members: [leader],
    sharedExperienceEnabled: true
  };

  this.__parties.set(party.id, party);
  leader.partyId = party.id;
  leader.party = party;
  this.__updatePartySkulls(party);
  this.__updatePartyShields(party);

  return party;
};

PartyManager.prototype.addMember = function (party, player) {
  if (party.members.length >= CONFIG.PARTY.MAX_MEMBERS) {
    return false;
  }

  if (!this.__canJoinParty(party, player)) {
    return false;
  }

  party.members.push(player);
  player.partyId = party.id;
  player.party = party;
  this.__updatePartySkulls(party);
  this.__updatePartyShields(party);
  this.__sendPartyData(party);

  return true;
};

PartyManager.prototype.removeMember = function (player) {
  let party = player.party;
  if (!party) return;

  let index = party.members.indexOf(player);
  if (index === -1) return;

  party.members.splice(index, 1);

  party.members.forEach(function (member) {
    member.write(new PartySkullPacket(player.getId(), CONST.SKULL.NONE));
    member.write(new PartyShieldPacket(player.getId(), CONST.SHIELD.NONE));
  });
  player.write(new PartySkullPacket(player.getId(), CONST.SKULL.NONE));
  this.__clearPartyShield(player);
  player.partyId = null;
  player.party = null;

  if (party.members.length === 0) {
    this.__parties.delete(party.id);
    return;
  }

  if (party.leader === player) {
    party.leader = party.members[0];
  }

  this.__updatePartySkulls(party);
  this.__updatePartyShields(party);
  this.__sendPartyData(party);
};

PartyManager.prototype.kickMember = function (leader, targetName) {
  let party = leader.party;
  if (!party || party.leader !== leader) return false;

  let target = party.members.find(m => m.getProperty(CONST.PROPERTIES.NAME) === targetName);
  if (!target) return false;

  this.removeMember(target);
  target.write(new ServerMessagePacket("You have been kicked from the party."));

  return true;
};

PartyManager.prototype.isInParty = function (player) {
  return player.party !== null && player.party !== undefined;
};

PartyManager.prototype.getParty = function (player) {
  return player.party || null;
};

PartyManager.prototype.setInvite = function (from, toName) {
  let target = gameServer.world.creatureHandler.getPlayerByName(toName);
  if (!target) {
    from.write(new CancelMessagePacket("Player not found."));
    return false;
  }

  if (target === from) {
    from.write(new CancelMessagePacket("You cannot invite yourself."));
    return false;
  }

  if (target.party) {
    from.write(new CancelMessagePacket(target.getProperty(CONST.PROPERTIES.NAME) + " is already in a party."));
    return false;
  }

  if (CONFIG.PARTY.ENABLED && !this.__canInvite(from, target)) {
    return false;
  }

  this.__pendingInvites.set(target.getProperty(CONST.PROPERTIES.NAME), from);
  target.write(new PartyInvitePacket(from.getProperty(CONST.PROPERTIES.NAME)));
  target.write(new PartyShieldPacket(from.getId(), CONST.SHIELD.INVITED));
  from.write(new PartyShieldPacket(target.getId(), CONST.SHIELD.REQUEST));

  from.write(new ServerMessagePacket("You have invited " + target.getProperty(CONST.PROPERTIES.NAME) + " to your party."));
  target.write(new ChannelWritePacket(CONST.CHANNEL.DEFAULT, "Party", from.getProperty(CONST.PROPERTIES.NAME) + " has invited you to join a party.", CONST.COLOR.LIGHTGREEN));

  return true;
};

PartyManager.prototype.acceptInvite = function (player, inviterName) {
  let inviter = this.__pendingInvites.get(player.getProperty(CONST.PROPERTIES.NAME));
  if (!inviter) {
    player.write(new CancelMessagePacket("You have no pending party invitation."));
    return false;
  }

  if (inviter.getProperty(CONST.PROPERTIES.NAME) !== inviterName && inviterName !== "") {
    player.write(new CancelMessagePacket("Invalid invitation."));
    return false;
  }

  this.__pendingInvites.delete(player.getProperty(CONST.PROPERTIES.NAME));

  // Clear invite/request shields
  inviter.write(new PartyShieldPacket(player.getId(), CONST.SHIELD.NONE));
  player.write(new PartyShieldPacket(inviter.getId(), CONST.SHIELD.NONE));

  let party = inviter.party;
  if (!party) {
    party = this.createParty(inviter);
  }

  if (!this.addMember(party, player)) {
    player.write(new CancelMessagePacket("Could not join the party."));
    return false;
  }

  player.write(new PartyJoinPacket(party));
  inviter.write(new ServerMessagePacket(player.getProperty(CONST.PROPERTIES.NAME) + " has joined the party."));

  party.members.forEach(function (member) {
    if (member !== inviter && member !== player) {
      member.write(new ChannelWritePacket(CONST.CHANNEL.DEFAULT, "Party", player.getProperty(CONST.PROPERTIES.NAME) + " has joined the party.", CONST.COLOR.LIGHTGREEN));
    }
  });

  return true;
};

PartyManager.prototype.leaveParty = function (player) {
  let party = player.party;
  if (!party) return false;

  let name = player.getProperty(CONST.PROPERTIES.NAME);
  this.removeMember(player);
  player.write(new PartyLeavePacket());

  party.members.forEach(function (member) {
    member.write(new ChannelWritePacket(CONST.CHANNEL.DEFAULT, "Party", name + " has left the party.", CONST.COLOR.LIGHTGREEN));
  });

  return true;
};

PartyManager.prototype.toggleSharedExperience = function (leader) {
  let party = leader.party;
  if (!party || party.leader !== leader) return false;

  party.sharedExperienceEnabled = !party.sharedExperienceEnabled;
  this.__updatePartyShields(party);
  return party.sharedExperienceEnabled;
};

PartyManager.prototype.updateActivity = function (player) {
  if (player) {
    player.lastActivityTime = Date.now();
  }
};

PartyManager.prototype.getActiveSharedMembers = function (party) {
  if (!party || !party.sharedExperienceEnabled) return [];

  let leader = party.leader;
  if (!leader) return [];

  let now = Date.now();
  let maxLevel = 0;

  party.members.forEach(function (member) {
    let level = member.getLevel();
    if (level > maxLevel) maxLevel = level;
  });

  let minLevel = Math.ceil(maxLevel * CONFIG.PARTY.LEVEL_DIFFERENCE_RULE);

  return party.members.filter(function (member) {
    if (member.getLevel() < minLevel) return false;
    if (!this.areInRange(leader, member)) return false;
    if (now - (member.lastActivityTime || 0) > 60000) return false;
    return true;
  }, this);
};

PartyManager.prototype.isInSameParty = function (a, b) {
  return a.party && b.party && a.party === b.party;
};

PartyManager.prototype.areInRange = function (a, b) {
  return a.getPosition().isWithinRangeOf(b.getPosition(), CONFIG.PARTY.EXPERIENCE_SHARE_RANGE);
};

PartyManager.prototype.__canInvite = function (from, target) {
  let fromLevel = from.getLevel();
  let targetLevel = target.getLevel();
  let maxLevel = Math.max(fromLevel, targetLevel);
  let minLevel = Math.ceil(maxLevel * CONFIG.PARTY.LEVEL_DIFFERENCE_RULE);

  if (fromLevel < minLevel || targetLevel < minLevel) {
    from.write(new CancelMessagePacket("The level difference is too big to invite this player."));
    return false;
  }

  return true;
};

PartyManager.prototype.__canJoinParty = function (party, player) {
  let playerLevel = player.getLevel();
  let maxLevel = 0;

  party.members.forEach(function (member) {
    let level = member.getLevel();
    if (level > maxLevel) maxLevel = level;
  });

  let minLevel = Math.ceil(maxLevel * CONFIG.PARTY.LEVEL_DIFFERENCE_RULE);
  if (playerLevel < minLevel) {
    return false;
  }

  return true;
};

PartyManager.prototype.__updatePartySkulls = function (party) {
  party.members.forEach(function (member) {
    party.members.forEach(function (target) {
      target.write(new PartySkullPacket(member.getId(), CONST.SKULL.GREEN));
    });
  });
};

PartyManager.prototype.__clearPartySkull = function (player) {
  player.write(new PartySkullPacket(player.getId(), CONST.SKULL.NONE));
};

PartyManager.prototype.__sendPartyData = function (party) {
  party.members.forEach(function (member) {
    member.write(new PartySkullPacket(member.getId(), CONST.SKULL.GREEN));
  });
};

PartyManager.prototype.__getShieldType = function (party, player) {
  let isLeader = party.leader === player;
  if (isLeader) {
    return party.sharedExperienceEnabled ? CONST.SHIELD.BLUE_SHARED : CONST.SHIELD.BLUE_NO_SHARED;
  }
  return party.sharedExperienceEnabled ? CONST.SHIELD.YELLOW_SHARED : CONST.SHIELD.YELLOW_NO_SHARED;
};

PartyManager.prototype.__updatePartyShields = function (party) {
  party.members.forEach(function (member) {
    let shieldType = this.__getShieldType(party, member);
    party.members.forEach(function (target) {
      target.write(new PartyShieldPacket(member.getId(), shieldType));
    });
  }, this);
};

PartyManager.prototype.__clearPartySkull = function (player) {
  player.write(new PartySkullPacket(player.getId(), CONST.SKULL.NONE));
};

PartyManager.prototype.__clearPartyShield = function (player) {
  player.write(new PartyShieldPacket(player.getId(), CONST.SHIELD.NONE));
};

module.exports = PartyManager;
