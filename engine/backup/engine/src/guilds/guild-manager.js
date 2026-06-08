"use strict";

const fs = require("fs");
const path = require("path");
const Guild = requireModule("guilds/guild");

function log(module, action, data) {
  try {
    var l = process.gameServer && process.gameServer.logger;
    if (l) l.info(module, action, data);
  } catch (e) {}
}

function logError(module, action, data) {
  try {
    var l = process.gameServer && process.gameServer.logger;
    if (l) l.error(module, action, data);
  } catch (e) {}
}

const GUILDS_DIR = path.resolve(__dirname, "..", "..", "..", "data", "guilds");
const ACCOUNTS_DIR = path.resolve(__dirname, "..", "..", "..", "data", "accounts");

function getLevelFromExperience(exp) {
  if (!exp || exp <= 0) return 1;
  for (let lvl = 1; lvl <= 1000; lvl++) {
    let required = Math.round((50 / 3) * (Math.pow(lvl, 3) - 6 * Math.pow(lvl, 2) + 17 * lvl - 12));
    if (required > exp) return lvl - 1;
  }
  return 1000;
}

const GuildManager = function () {
  if (!fs.existsSync(GUILDS_DIR)) {
    fs.mkdirSync(GUILDS_DIR, { recursive: true });
  }
};

GuildManager.prototype.__getGuildPath = function (name) {
  return path.join(GUILDS_DIR, name.toLowerCase().replace(/[^a-z0-9]/g, "_") + ".json");
};

GuildManager.prototype.guildExists = function (name) {
  return fs.existsSync(this.__getGuildPath(name));
};

GuildManager.prototype.getGuild = function (name) {
  let filePath = this.__getGuildPath(name);
  if (!fs.existsSync(filePath)) return null;
  try {
    let data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Guild.fromJSON(data);
  } catch (e) {
    console.error("Error loading guild '%s':", name, e);
    return null;
  }
};

GuildManager.prototype.saveGuild = function (guild) {
  let filePath = this.__getGuildPath(guild.name);
  try {
    fs.writeFileSync(filePath, JSON.stringify(guild.toJSON(), null, 4));
    return true;
  } catch (e) {
    console.error("Error saving guild '%s':", guild.name, e);
    return false;
  }
};

GuildManager.prototype.createGuild = function (name, leaderPlayer) {
  if (this.guildExists(name)) {
    return { success: false, error: "A guild with this name already exists." };
  }
  if (name.length < 3 || name.length > 30) {
    return { success: false, error: "Guild name must be between 3 and 30 characters." };
  }
  if (!/^[a-zA-Z ]+$/.test(name)) {
    return { success: false, error: "Guild name may only contain letters and spaces." };
  }

  let guild = new Guild(name, leaderPlayer.name);
  if (!this.saveGuild(guild)) {
    return { success: false, error: "Could not save guild data." };
  }

  leaderPlayer.setStorage(CONFIG.GUILD.QUEST_STORAGE + 1, name);
  log("guild", "created", { guild: name, leader: leaderPlayer.name });
  console.log("[GUILD] %s created guild '%s'".format(leaderPlayer.name, name));
  return { success: true, guild: guild };
};

GuildManager.prototype.getPlayerGuildName = function (player) {
  let name = player.getStorage(CONFIG.GUILD.QUEST_STORAGE + 1);
  return name === -1 ? null : name;
};

GuildManager.prototype.getPlayerGuild = function (player) {
  let guildName = this.getPlayerGuildName(player);
  if (!guildName) return null;
  return this.getGuild(guildName);
};

GuildManager.prototype.__getPlayerSummary = function (playerName) {
  let player = gameServer.world.creatureHandler.getPlayerByName(playerName);
  if (player) {
    let outfit = player.getProperty(CONST.PROPERTIES.OUTFIT);
    return {
      level: player.getLevel(),
      vocation: player.getProperty(CONST.PROPERTIES.VOCATION),
      outfit: outfit && outfit.toJSON ? outfit.toJSON() : { id: 111, details: { head: 0, body: 0, legs: 0, feet: 0 }, addonOne: false, addonTwo: false }
    };
  }
  try {
    let entries = fs.readdirSync(ACCOUNTS_DIR, { withFileTypes: true });
    for (let entry of entries) {
      if (!entry.isDirectory()) continue;
      let metaPath = path.join(ACCOUNTS_DIR, entry.name, "account.json");
      if (!fs.existsSync(metaPath)) continue;
      let meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      for (let cn of (meta.characters || [])) {
        if (cn.toLowerCase() === playerName.toLowerCase()) {
          let charPath = path.join(ACCOUNTS_DIR, entry.name, cn + ".json");
          if (!fs.existsSync(charPath)) return null;
          let charData = JSON.parse(fs.readFileSync(charPath, "utf-8"));
          let exp = charData.skills ? (charData.skills.experience || 0) : 0;
          let props = charData.properties || {};
          return {
            level: getLevelFromExperience(exp),
            vocation: props.vocation || 0,
            outfit: props.outfit || { id: 111, details: { head: 0, body: 0, legs: 0, feet: 0 }, addonOne: false, addonTwo: false }
          };
        }
      }
    }
  } catch (e) {
    console.error("Error reading player summary for '%s':", playerName, e);
  }
  return null;
};

GuildManager.prototype.addMember = function (guildName, playerName) {
  let guild = this.getGuild(guildName);
  if (!guild) return { success: false, error: "Guild not found." };
  if (guild.getMember(playerName)) {
    return { success: false, error: "Player is already a member." };
  }
  guild.members.push({ name: playerName, rank: "member", joinedAt: Date.now() });
  if (!this.saveGuild(guild)) {
    return { success: false, error: "Could not save guild data." };
  }
  log("guild", "member_added", { guild: guildName, member: playerName });
  console.log("[GUILD] %s joined guild '%s'".format(playerName, guildName));
  return { success: true, guild: guild };
};

GuildManager.prototype.inviteMember = function (guildName, leaderPlayer, targetName) {
  let guild = this.getGuild(guildName);
  if (!guild) return { success: false, error: "Guild not found." };
  if (!guild.isLeader(leaderPlayer.name)) return { success: false, error: "Only the guild leader can invite." };
  let target = gameServer.world.creatureHandler.getPlayerByName(targetName);
  if (!target) return { success: false, error: "Player is not online." };
  if (guild.getMember(targetName)) return { success: false, error: "Player is already a member." };
  let existingGuild = this.getPlayerGuildName(target);
  if (existingGuild) return { success: false, error: "Player is already in another guild." };
  guild.members.push({ name: target.name, rank: "member", title: "Member", joinedAt: Date.now() });
  if (!this.saveGuild(guild)) return { success: false, error: "Could not save guild data." };
  target.setStorage(CONFIG.GUILD.QUEST_STORAGE + 1, guildName);
  log("guild", "invited", { guild: guildName, leader: leaderPlayer.name, target: target.name });
  console.log("[GUILD] %s invited %s to guild '%s'".format(leaderPlayer.name, target.name, guildName));
  return { success: true, guild: guild };
};

GuildManager.prototype.setMemberTitle = function (guildName, changerName, targetName, title) {
  let guild = this.getGuild(guildName);
  if (!guild) return { success: false, error: "Guild not found." };
  if (!guild.isLeader(changerName)) return { success: false, error: "Only the guild leader can set titles." };
  let member = guild.getMember(targetName);
  if (!member) return { success: false, error: "Player is not a member." };
  if (typeof title !== "string" || title.length > 30) return { success: false, error: "Title must be a string with at most 30 characters." };
  member.title = title;
  if (!this.saveGuild(guild)) return { success: false, error: "Could not save guild data." };
  console.log("[GUILD] %s set title '%s' for %s in guild '%s'".format(changerName, title, targetName, guildName));
  return { success: true, guild: guild };
};

GuildManager.prototype.transferLeadership = function (guildName, currentLeaderName, targetName) {
  let guild = this.getGuild(guildName);
  if (!guild) return { success: false, error: "Guild not found." };
  if (!guild.isLeader(currentLeaderName)) return { success: false, error: "Only the guild leader can transfer leadership." };
  let targetMember = guild.getMember(targetName);
  if (!targetMember) return { success: false, error: "Target is not a member." };
  if (targetMember.rank === "leader") return { success: false, error: "Target is already the leader." };
  let currentMember = guild.getMember(currentLeaderName);
  if (currentMember) currentMember.rank = "vice";
  targetMember.rank = "leader";
  guild.leader = targetMember.name;
  if (!this.saveGuild(guild)) return { success: false, error: "Could not save guild data." };
  console.log("[GUILD] %s transferred leadership to %s in guild '%s'".format(currentLeaderName, targetName, guildName));
  return { success: true, guild: guild };
};

GuildManager.prototype.removeMember = function (guildName, playerName) {
  let guild = this.getGuild(guildName);
  if (!guild) return { success: false, error: "Guild not found." };
  let idx = guild.members.findIndex(function (m) {
    return m.name.toLowerCase() === playerName.toLowerCase();
  });
  if (idx === -1) return { success: false, error: "Player is not a member." };
  if (guild.members[idx].rank === "leader") {
    return { success: false, error: "Cannot remove the leader. Transfer leadership first or delete the guild." };
  }
  guild.members.splice(idx, 1);
  if (!this.saveGuild(guild)) {
    return { success: false, error: "Could not save guild data." };
  }
  log("guild", "member_removed", { guild: guildName, member: playerName });
  console.log("[GUILD] %s removed from guild '%s'".format(playerName, guildName));
  return { success: true, guild: guild };
};

GuildManager.prototype.setRank = function (guildName, playerName, newRank) {
  let guild = this.getGuild(guildName);
  if (!guild) return { success: false, error: "Guild not found." };
  if (newRank !== "vice" && newRank !== "member") {
    return { success: false, error: "Invalid rank. Use 'vice' or 'member'." };
  }
  let member = guild.getMember(playerName);
  if (!member) return { success: false, error: "Player is not a member." };
  if (member.rank === "leader") {
    return { success: false, error: "Cannot change the leader's rank." };
  }
  member.rank = newRank;
  if (!this.saveGuild(guild)) {
    return { success: false, error: "Could not save guild data." };
  }
  console.log("[GUILD] %s rank changed to '%s' in guild '%s'".format(playerName, newRank, guildName));
  return { success: true, guild: guild };
};

GuildManager.prototype.renameGuild = function (oldName, newName) {
  if (oldName.toLowerCase() === newName.toLowerCase()) {
    return { success: false, error: "The new name is the same as the old name." };
  }
  if (this.guildExists(newName)) {
    return { success: false, error: "A guild with this name already exists." };
  }
  if (newName.length < 3 || newName.length > 30) {
    return { success: false, error: "Guild name must be between 3 and 30 characters." };
  }
  if (!/^[a-zA-Z ]+$/.test(newName)) {
    return { success: false, error: "Guild name may only contain letters and spaces." };
  }
  let guild = this.getGuild(oldName);
  if (!guild) return { success: false, error: "Guild not found." };
  let oldPath = this.__getGuildPath(oldName);
  guild.name = newName;
  if (!this.saveGuild(guild)) {
    return { success: false, error: "Could not save guild data." };
  }
  try {
    fs.unlinkSync(oldPath);
  } catch (e) {
    console.error("Could not remove old guild file:", e);
  }
  console.log("[GUILD] Guild renamed from '%s' to '%s'".format(oldName, newName));
  return { success: true, guild: guild };
};

GuildManager.prototype.deleteGuild = function (guildName) {
  let guild = this.getGuild(guildName);
  if (!guild) return { success: false, error: "Guild not found." };

  // Evict guildhall if the guild owns one
  if (guild.hallId !== null) {
    let house = gameServer.database.getHouse(guild.hallId);
    if (house !== null) {
      house.setOwner(null);
      gameServer.database.saveHouses();
      console.log("[GUILD] Guildhall '%s' evicted from guild '%s'".format(house.name, guildName));
    }
  }

  let filePath = this.__getGuildPath(guildName);
  try {
    fs.unlinkSync(filePath);
  } catch (e) {
    console.error("Error deleting guild file:", e);
    return { success: false, error: "Could not delete guild file." };
  }
  console.log("[GUILD] Guild '%s' deleted.".format(guildName));
  return { success: true, guild: guild };
};

GuildManager.prototype.depositGold = function (guildName, player, amount) {
  if (amount <= 0) return { success: false, error: "Invalid amount." };
  if (!player.payWithResource(2148, amount)) {
    return { success: false, error: "You do not have enough gold." };
  }
  let guild = this.getGuild(guildName);
  if (!guild) return { success: false, error: "Guild not found." };
  guild.bank = (guild.bank || 0) + amount;
  if (!this.saveGuild(guild)) {
    return { success: false, error: "Could not save guild data." };
  }
  log("guild", "gold_deposit", { guild: guildName, player: player.name, amount: amount, newBalance: guild.bank });
  console.log("[GUILD] %s deposited %s gold to guild '%s'".format(player.name, amount, guildName));
  return { success: true, guild: guild };
};

GuildManager.prototype.withdrawGold = function (guildName, player, amount) {
  if (amount <= 0) return { success: false, error: "Invalid amount." };
  let guild = this.getGuild(guildName);
  if (!guild) return { success: false, error: "Guild not found." };
  if (!guild.isLeader(player.name)) {
    return { success: false, error: "Only the guild leader may withdraw gold." };
  }
  if ((guild.bank || 0) < amount) {
    return { success: false, error: "Insufficient guild bank balance." };
  }
  guild.bank -= amount;
  if (!this.saveGuild(guild)) {
    return { success: false, error: "Could not save guild data." };
  }
  let goldItem = gameServer.database.createThing(2148);
  goldItem.setCount(amount);
  player.containerManager.equipment.pushItem(goldItem);
  log("guild", "gold_withdraw", { guild: guildName, player: player.name, amount: amount, newBalance: guild.bank });
  console.log("[GUILD] %s withdrew %s gold from guild '%s'".format(player.name, amount, guildName));
  return { success: true, guild: guild };
};

GuildManager.prototype.declareWar = function (guildName, enemyName) {
  let guild = this.getGuild(guildName);
  if (!guild) return { success: false, error: "Guild not found." };
  let enemy = this.getGuild(enemyName);
  if (!enemy) return { success: false, error: "Enemy guild not found." };
  if (guildName.toLowerCase() === enemyName.toLowerCase()) {
    return { success: false, error: "Cannot declare war on yourself." };
  }
  let existing = guild.wars.find(function (w) {
    return w.enemyName.toLowerCase() === enemyName.toLowerCase();
  });
  if (existing) return { success: false, error: "War already declared against this guild." };
  guild.wars.push({ enemyName: enemy.name, declaredAt: Date.now() });
  if (!this.saveGuild(guild)) {
    return { success: false, error: "Could not save guild data." };
  }
  console.log("[GUILD] Guild '%s' declared war on '%s'".format(guildName, enemyName));
  return { success: true, guild: guild };
};

GuildManager.prototype.getOnlineMembers = function (guild) {
  let online = [];
  guild.members.forEach(function (m) {
    let player = gameServer.world.creatureHandler.getPlayerByName(m.name);
    if (player) {
      online.push({ name: m.name, rank: m.rank });
    }
  });
  return online;
};

GuildManager.prototype.getOnlineMembersRaw = function (guild) {
  let online = [];
  guild.members.forEach(function (m) {
    let player = gameServer.world.creatureHandler.getPlayerByName(m.name);
    if (player) {
      online.push({ name: m.name, rank: m.rank, player: player });
    }
  });
  return online;
};

GuildManager.prototype.broadcastToMembers = function (guildName, packet) {
  let guild = this.getGuild(guildName);
  if (!guild) return;
  guild.members.forEach(function (m) {
    let player = gameServer.world.creatureHandler.getPlayerByName(m.name);
    if (player) {
      player.write(packet);
    }
  });
};

GuildManager.prototype.broadcastGuildData = function (guildName) {
  let guild = this.getGuild(guildName);
  if (!guild) return;
  const { GuildDataPacket } = requireModule("network/protocol");
  guild.members.forEach(function (m) {
    let player = gameServer.world.creatureHandler.getPlayerByName(m.name);
    if (player) {
      let data = this.getGuildDataForPlayer(player);
      player.write(new GuildDataPacket(data));
    }
  }, this);
};

GuildManager.prototype.getGuildDataForPlayer = function (player) {
  let guildName = this.getPlayerGuildName(player);
  if (!guildName) return null;
  let guild = this.getGuild(guildName);
  if (!guild) return null;
  let online = this.getOnlineMembers(guild);
  let self = this;
  return {
    name: guild.name,
    leader: guild.leader,
    myRank: guild.getMember(player.name) ? guild.getMember(player.name).rank : null,
    members: guild.members.map(function (m) {
      let isOnline = online.some(function (o) { return o.name.toLowerCase() === m.name.toLowerCase(); });
      let summary = self.__getPlayerSummary(m.name);
      return {
        name: m.name,
        rank: m.rank,
        joinedAt: m.joinedAt,
        online: isOnline,
        level: summary ? summary.level : 1,
        vocation: summary ? summary.vocation : 0,
        outfit: summary ? summary.outfit : { id: 111, details: { head: 0, body: 0, legs: 0, feet: 0 }, addonOne: false, addonTwo: false }
      };
    }),
    bank: guild.bank,
    wars: guild.wars,
    createdAt: guild.createdAt
  };
};

module.exports = GuildManager;
