"use strict";

const { PartySkullPacket, ServerMessagePacket } = requireModule("network/protocol");

const SkullManager = function () {
  this.__fragDecayTimer = null;
  this.__startFragDecay();
};

SkullManager.prototype.isPvPEnabled = function () {
  return CONFIG.PVP && CONFIG.PVP.ENABLED;
};

SkullManager.prototype.getSkull = function (player) {
  if (!player.__skull) {
    player.__skull = CONST.SKULL.NONE;
  }
  if (!player.__frags) {
    player.__frags = [];
  }
  return player.__skull;
};

SkullManager.prototype.getFrags = function (player) {
  if (!player.__frags) {
    player.__frags = [];
  }
  return player.__frags;
};

SkullManager.prototype.getUnjustifiedFrags = function (player) {
  return this.getFrags(player).filter(function (f) { return !f.justified; });
};

SkullManager.prototype.__countFragsInWindow = function (player, windowMs) {
  let now = Date.now();
  let cutoff = now - windowMs;
  return this.getUnjustifiedFrags(player).filter(function (f) {
    return f.timestamp > cutoff;
  }).length;
};

SkullManager.prototype.__getComputedSkull = function (player) {
  let daily = this.__countFragsInWindow(player, 86400000);
  let weekly = this.__countFragsInWindow(player, 604800000);
  let monthly = this.__countFragsInWindow(player, 2592000000);

  let cfg = CONFIG.PVP;
  let blackMult = cfg.BLACK_SKULL_MULTIPLIER || 2;

  if (daily >= cfg.RED_SKULL_DAILY * blackMult ||
      weekly >= cfg.RED_SKULL_WEEKLY * blackMult ||
      monthly >= cfg.RED_SKULL_MONTHLY * blackMult) {
    return CONST.SKULL.BLACK;
  }

  if (daily >= cfg.RED_SKULL_DAILY ||
      weekly >= cfg.RED_SKULL_WEEKLY ||
      monthly >= cfg.RED_SKULL_MONTHLY) {
    return CONST.SKULL.RED;
  }

  return CONST.SKULL.NONE;
};

SkullManager.prototype.isJustifiedKill = function (attacker, victim) {
  let victimSkull = this.getSkull(victim);

  // Killing a cheater is always justified (no frag penalty)
  if (victimSkull === CONST.SKULL.CHEATER) {
    return true;
  }

  // Killing a player with no skull is unjustified
  if (victimSkull === CONST.SKULL.NONE) {
    return false;
  }

  // Killing any skulled player is justified (green/yellow/white/red/black/orange)
  return true;
};

SkullManager.prototype.canAttack = function (attacker, target) {
  if (!this.isPvPEnabled()) return false;

  if (attacker.isDead || target.isDead) return false;

  // Black skull can only attack marked players
  if (this.getSkull(attacker) === CONST.SKULL.BLACK) {
    let targetSkull = this.getSkull(target);
    if (targetSkull === CONST.SKULL.NONE || targetSkull === CONST.SKULL.YELLOW) {
      return false;
    }
  }

  return true;
};

SkullManager.prototype.getPvPDamageMultiplier = function (attacker, target) {
  if (!this.isPvPEnabled()) return 1.0;

  let cfg = CONFIG.PVP;

  // Cheaters take 30% extra damage from all players
  if (this.getSkull(target) === CONST.SKULL.CHEATER) {
    return 1.3;
  }

  if (this.getSkull(target) === CONST.SKULL.BLACK) {
    return cfg.BLACK_SKULL_PVP_DAMAGE_MULTIPLIER || 1.0;
  }

  let mult = cfg.DAMAGE_MULTIPLIER || 0.5;

  let levelDiff = attacker.getLevel() - target.getLevel();
  if (levelDiff > 0) {
    let reduction = Math.min(cfg.LEVEL_DIFF_CAP || 0.5, levelDiff * (cfg.LEVEL_DIFF_REDUCTION || 0.01));
    mult = Math.max(0, mult - reduction);
  }

  return mult;
};

SkullManager.prototype.onPlayerAttack = function (attacker, target) {
  if (!this.isPvPEnabled()) return;

  let attackerSkull = this.getSkull(attacker);
  let targetSkull = this.getSkullForPlayer(target, attacker);

  // Cheater skull: no additional skulls needed
  if (attackerSkull === CONST.SKULL.CHEATER) {
    return;
  }

  // Attacking a cheater: no skull for attacker (cheater is fair game)
  if (targetSkull === CONST.SKULL.CHEATER) {
    return;
  }

  // Yellow skull attacking someone other than their original target → becomes white aggressor
  if (attackerSkull === CONST.SKULL.YELLOW) {
    if (attacker.__skullVisibleTo !== target.getId()) {
      attacker.__skullVisibleTo = undefined;
      this.__setSkull(attacker, CONST.SKULL.WHITE);
      attacker.__whiteSkullTimer = Date.now() + (CONFIG.PVP.WHITE_SKULL_DURATION_NO_KILL || 60000);
    }
    return;
  }

  // No skull attacking someone WITH a skull (green/yellow/white/red/black/orange) → yellow (self-defense)
  if (attackerSkull === CONST.SKULL.NONE && targetSkull !== CONST.SKULL.NONE) {
    attacker.__skullVisibleTo = target.getId();
    this.__setSkull(attacker, CONST.SKULL.YELLOW);
    attacker.__yellowSkullTimer = Date.now() + 120000;
    return;
  }

  // No skull attacking no skull → white skull (unjustified aggressor)
  if (attackerSkull === CONST.SKULL.NONE) {
    this.__setSkull(attacker, CONST.SKULL.WHITE);
    attacker.__whiteSkullTimer = Date.now() + (CONFIG.PVP.WHITE_SKULL_DURATION_NO_KILL || 60000);
    return;
  }
};

SkullManager.prototype.onPlayerKill = function (killer, victim) {
  if (!this.isPvPEnabled()) return;

  // Revenge: if victim had an orange skull visible to the killer, fulfil revenge
  if (victim.__orangeSkulls && victim.__orangeSkulls.length > 0) {
    let before = victim.__orangeSkulls.length;
    victim.__orangeSkulls = victim.__orangeSkulls.filter(function (o) {
      return o.victimId !== killer.getId();
    });
    if (victim.__orangeSkulls.length === 0 && before > 0) {
      victim.__skullVisibleTo = undefined;
      this.clearSkull(victim);
    }
  }

  let justified = this.isJustifiedKill(killer, victim);

  // Unjustified kill → killer gets orange skull (revenge marker) for this victim
  if (!justified) {
    if (!killer.__orangeSkulls) killer.__orangeSkulls = [];
    killer.__orangeSkulls.push({
      victimId: victim.getId(),
      victimName: victim.getProperty(CONST.PROPERTIES.NAME),
      timestamp: Date.now()
    });

    // Only show orange if killer has no frag-based skull (white/red/black)
    // White was already assigned on attack, red/black computed from frags
    let currentSkull = this.getSkull(killer);
    if (currentSkull === CONST.SKULL.NONE || currentSkull === CONST.SKULL.YELLOW) {
      killer.__skullVisibleTo = victim.getId();
      this.__setSkull(killer, CONST.SKULL.ORANGE);
    }
  }

  let frag = {
    victimId: victim.getId(),
    victimName: victim.getProperty(CONST.PROPERTIES.NAME),
    timestamp: Date.now(),
    justified: justified
  };

  this.getFrags(killer).push(frag);

  // Cheater killed someone unjustifiably: check for auto-ban
  if (this.getSkull(killer) === CONST.SKULL.CHEATER && !justified) {
    let daily = this.__countFragsInWindow(killer, 86400000);
    let weekly = this.__countFragsInWindow(killer, 604800000);
    let monthly = this.__countFragsInWindow(killer, 2592000000);
    let cfg = CONFIG.PVP;
    let blackDaily = (cfg.RED_SKULL_DAILY || 3) * (cfg.BLACK_SKULL_MULTIPLIER || 2);
    let blackWeekly = (cfg.RED_SKULL_WEEKLY || 5) * (cfg.BLACK_SKULL_MULTIPLIER || 2);
    let blackMonthly = (cfg.RED_SKULL_MONTHLY || 10) * (cfg.BLACK_SKULL_MULTIPLIER || 2);
    if (daily >= blackDaily || weekly >= blackWeekly || monthly >= blackMonthly) {
      try {
        let AccountDatabase = requireModule("auth/account-database");
        let db = new AccountDatabase();
        db.createBan(killer.getProperty(CONST.PROPERTIES.NAME), "System", 7, "[Auto] Cheater - excessive kills while marked.");
      } catch (e) {
        console.error("Failed to auto-ban cheater:", e);
      }
      killer.socketHandler.getControllingSocket().closeError("Banned for 7 days: excessive kills while marked as cheater.");
      return;
    }
  }

  let message;
  if (justified) {
    message = killer.getProperty(CONST.PROPERTIES.NAME) + " justifiably killed " +
      victim.getProperty(CONST.PROPERTIES.NAME) + ".";
  } else {
    message = killer.getProperty(CONST.PROPERTIES.NAME) + " unjustifiably killed " +
      victim.getProperty(CONST.PROPERTIES.NAME) + ".";
  }

  killer.broadcast(new ServerMessagePacket(message));

  // Cheater skull: no skull upgrades or timers
  if (this.getSkull(killer) === CONST.SKULL.CHEATER) {
    return;
  }

  let computedSkull = this.__getComputedSkull(killer);
  let currentSkull = this.getSkull(killer);

  // Upgrade to red/black if threshold reached
  if (computedSkull !== CONST.SKULL.NONE && computedSkull !== currentSkull) {
    // If currently orange, clear visibility before upgrading
    if (currentSkull === CONST.SKULL.ORANGE) {
      killer.__skullVisibleTo = undefined;
    }
    this.__setSkull(killer, computedSkull);
  }

  // White skull timer: 15 min after kill
  if (currentSkull === CONST.SKULL.WHITE || computedSkull === CONST.SKULL.WHITE) {
    killer.__whiteSkullTimer = Date.now() + (CONFIG.PVP.WHITE_SKULL_DURATION || 900000);
  }

  // Red skull: 30 day timer
  if (computedSkull === CONST.SKULL.RED) {
    killer.__redSkullTimer = Date.now() + (CONFIG.PVP.RED_SKULL_DURATION || 2592000000);
  }

  // Black skull: 45 day timer
  if (computedSkull === CONST.SKULL.BLACK) {
    killer.__blackSkullTimer = Date.now() + (CONFIG.PVP.BLACK_SKULL_DURATION || 3888000000);
  }
};

SkullManager.prototype.__setSkull = function (player, skullType) {
  player.__skull = skullType;

  // Restricted visibility skull (yellow/orange) → only send to the specific player
  if (player.__skullVisibleTo !== undefined && player.__skullVisibleTo !== null) {
    let targetPlayer = gameServer.world.creatureHandler.getCreatureFromId(player.__skullVisibleTo);
    if (targetPlayer && targetPlayer.isPlayer && targetPlayer.isPlayer()) {
      targetPlayer.write(new PartySkullPacket(player.getId(), skullType));
    }
    return;
  }

  // Normal skull (white/red/black/green) → send to all connected players directly
  let allPlayers = gameServer.world.creatureHandler.getConnectedPlayers();
  allPlayers.forEach(function (p) {
    p.write(new PartySkullPacket(player.getId(), skullType));
  });
};

SkullManager.prototype.clearSkull = function (player) {
  if (player.__skull !== CONST.SKULL.NONE) {
    this.__setSkull(player, CONST.SKULL.NONE);
  }
  player.__whiteSkullTimer = null;
  player.__redSkullTimer = null;
  player.__blackSkullTimer = null;
  player.__yellowSkullTimer = null;
  player.__skullVisibleTo = undefined;
};

SkullManager.prototype.tickSkulls = function () {
  if (!this.isPvPEnabled()) return;

  let now = Date.now();
  let players = gameServer.world.creatureHandler.getConnectedPlayers();

  players.forEach(function (player) {
    let skull = player.__skull;
    if (skull === CONST.SKULL.NONE || skull === CONST.SKULL.CHEATER) return;

    // White skull: check timer
    if (skull === CONST.SKULL.WHITE && player.__whiteSkullTimer) {
      if (now > player.__whiteSkullTimer) {
        // Before clearing white, check if there are pending orange skulls
        if (player.__orangeSkulls && player.__orangeSkulls.length > 0) {
          // If player has orange entries but white faded, show orange to victims
          player.__skull = CONST.SKULL.NONE;
        } else {
          this.clearSkull(player);
        }
        player.sendCancelMessage("Your white skull has faded.");
        return;
      }
    }

    // Yellow skull: fade after 2 minutes
    if (skull === CONST.SKULL.YELLOW && player.__yellowSkullTimer) {
      if (now > player.__yellowSkullTimer) {
        this.clearSkull(player);
        return;
      }
    }

    // Orange skull: decay expired entries
    if (skull === CONST.SKULL.ORANGE && player.__orangeSkulls) {
      let sevenDays = CONFIG.PVP.ORANGE_SKULL_DURATION || 604800000;
      let before = player.__orangeSkulls.length;
      player.__orangeSkulls = player.__orangeSkulls.filter(function (o) {
        return (Date.now() - o.timestamp) < sevenDays;
      });
      if (player.__orangeSkulls.length === 0 && before > 0) {
        player.__skullVisibleTo = undefined;
        this.clearSkull(player);
        player.sendCancelMessage("Your revenge skull has faded.");
        return;
      }
    }

    // Red skull: check timer and frag decay
    if (skull === CONST.SKULL.RED) {
      if (now > player.__redSkullTimer) {
        let computed = this.__getComputedSkull(player);
        if (computed === CONST.SKULL.NONE) {
          player.sendCancelMessage("Your red skull has faded.");
          this.clearSkull(player);
        } else {
          this.__setSkull(player, computed);
        }
      }
    }

    // Black skull: check timer
    if (skull === CONST.SKULL.BLACK) {
      if (now > player.__blackSkullTimer) {
        let computed = this.__getComputedSkull(player);
        this.__setSkull(player, computed);
      }
    }
  }, this);
};

SkullManager.prototype.isSkulled = function (player) {
  return this.getSkull(player) !== CONST.SKULL.NONE;
};

SkullManager.prototype.__startFragDecay = function () {
  let interval = CONFIG.PVP.FRAG_DECAY_INTERVAL || 3600000;

  this.__fragDecayTimer = setInterval(function () {
    this.__decayFrags();
    this.tickSkulls();
  }.bind(this), interval);
};

SkullManager.prototype.__decayFrags = function () {
  if (!this.isPvPEnabled()) return;

  let now = Date.now();
  let month = 2592000000;

  // Remove frags older than 30 days (they no longer count toward skulls)
  let cutoff = now - month;

  let players = gameServer.world.creatureHandler.getConnectedPlayers();
  players.forEach(function (player) {
    let frags = player.__frags;
    if (!frags || frags.length === 0) return;

    player.__frags = frags.filter(function (f) {
      return f.timestamp > cutoff;
    });
  });
};

SkullManager.prototype.cleanup = function () {
  if (this.__fragDecayTimer) {
    clearInterval(this.__fragDecayTimer);
    this.__fragDecayTimer = null;
  }
};

SkullManager.prototype.getSkullForPlayer = function (player, viewer) {
  let skull = this.getSkull(player);

  // Yellow skull visible only to the attacked player
  if (skull === CONST.SKULL.YELLOW) {
    if (player.__skullVisibleTo !== viewer.getId()) return CONST.SKULL.NONE;
  }

  // Orange skull visible only to the victim(s)
  if (skull === CONST.SKULL.ORANGE) {
    if (player.__skullVisibleTo !== viewer.getId()) return CONST.SKULL.NONE;
  }

  return skull;
};

module.exports = SkullManager;
