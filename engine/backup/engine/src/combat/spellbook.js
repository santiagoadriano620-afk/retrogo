"use strict";

const { SpellAddPacket, SpellCastPacket } = requireModule("network/protocol");

const Spellbook = function (player, data) {

  /*
   * Class Spellbook
   * Container for all spells that a player has and handles casting / cooldowns
   */

  // Circular reference
  this.player = player;

  // The map of spells that are currently on cooldown
  this.__spellCooldowns = new Map();

  this.__cooldowns = data.cooldowns;

  // Initialize from saved data or default set
  this.__availableSpells = new Set(data.availableSpells || [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 31, 32, 70]);

  this.__availableSpells.add(32);
  this.__availableSpells.add(70);
}

Spellbook.prototype.GLOBAL_COOLDOWN = 0xFFFF;
Spellbook.prototype.GLOBAL_COOLDOWN_DURATION = 20;

Spellbook.prototype.getAvailableSpells = function () {

  /*
   * Function Spellbook.getAvailableSpells
   * Returns the spells that are available in the player's spellbook
   */

  return this.__availableSpells;

}

Spellbook.prototype.toJSON = function () {

  /*
   * Function Spellbook.toJSON
   * Implements the toJSON API to serialize the spellbook when writing to file
   */

  // Serialize
  return new Object({
    "availableSpells": Array.from(this.__availableSpells),
    "cooldowns": Array.from(this.__spellCooldowns).map(this.__serializeCooldown, this)
  });

}

Spellbook.prototype.__serializeCooldown = function ([key, value]) {

  /*
   * Function Spellbook.__serializeCooldown
   * Serializes the cooldowns
   */

  return new Object({
    "sid": key,
    "cooldown": value.remainingFrames()
  });

}

Spellbook.prototype.addAvailableSpell = function (sid) {

  /*
   * Function Spellbook.addAvailableSpell
   * Adds an available spell to the player's spellbook
   */

  // Add it
  this.__availableSpells.add(sid);

  // Inform the player they have learned a new spell
  this.player.sendCancelMessage("You have learned a new spell!");

  this.player.write(new SpellAddPacket(sid));

}

Spellbook.prototype.handleSpell = function (sid, properties) {

  /*
   * Function Spellbook.handleSpell
   * Handles casting of a spell by an entity
   */

  // Try to get the spell
  let spell = gameServer.database.getSpell(sid);

  // Does not exist
  if (spell === null) {
    return;
  }

  // GMs bypass all requirements (role >= GAMEMASTER, or named "Admin"/"Gamemaster")
  let playerRole = this.player.getProperty(CONST.PROPERTIES.ROLE) || 0;
  let playerName = typeof this.player.name === "string" ? this.player.name.toLowerCase() : "";
  let isGM = playerRole >= 3 || playerName === "admin" || playerName === "gamemaster";

  // Ignore cast requests that are already on cooldown (GMs bypass cooldown)
  if (!isGM && (this.__spellCooldowns.has(this.GLOBAL_COOLDOWN) || this.__spellCooldowns.has(sid))) {
    return;
  }

  // The player does not own this spell (GMs can cast any spell)
  if (!isGM && !this.__availableSpells.has(sid)) {
    this.player.sendCancelMessage("You do not know this spell.");
    return;
  }

  // Get spell metadata for requirements
  let spellMeta = gameServer.database.getSpellMeta(sid);

  if (!isGM && spellMeta) {
    // Check level requirement
    let playerLevel = this.player.skills ? this.player.skills.getSkillLevel(CONST.PROPERTIES.EXPERIENCE) : 1;
    if (playerLevel < spellMeta.level) {
      this.player.sendCancelMessage("You need to be at least level " + spellMeta.level + " to cast this spell.");
      return;
    }

    // Check mana requirement
    let playerMana = this.player.getProperty(CONST.PROPERTIES.MANA);
    if (playerMana < spellMeta.mana) {
      this.player.sendCancelMessage("You do not have enough mana. You need " + spellMeta.mana + " mana.");
      return;
    }

    // Check vocation requirement
    let playerVocation = this.player.getVocationName ? this.player.getVocationName() : "knight";
    if (spellMeta.vocations && spellMeta.vocations.length > 0) {
      if (!spellMeta.vocations.includes(playerVocation.toLowerCase())) {
        this.player.sendCancelMessage("Your vocation cannot cast this spell.");
        return;
      }
    }

    // Check premium requirement
    if (spellMeta.premium) {
      let isPremium = this.player.isPremium();
      if (!isPremium) {
        this.player.sendCancelMessage("You need a premium account to cast this spell.");
        return;
      }
    }
  }

  // Store spell ID on player for scripts that need it (e.g., conjure_rune)
  this.player.__castingSpellId = sid;

  // Call with reference to player
  let cooldown = spell.call(this.player, properties);

  // Zero cooldown means that the cast was unsuccessful
  if (cooldown === 0) {
    return;
  }

  // Training Rod (3139): 10% mana reduction
  let manaCost = spellMeta && spellMeta.mana > 0 ? spellMeta.mana : 0;
  if (!isGM && manaCost > 0) {
    let hasTrainingRod = false;
    let slots = [CONST.EQUIPMENT.LEFT, CONST.EQUIPMENT.RIGHT];
    for (let slot of slots) {
      let item = this.player.containerManager.equipment.peekIndex(slot);
      if (item && item.id === 3139) {
        hasTrainingRod = true;
        break;
      }
    }
    if (hasTrainingRod) {
      manaCost = Math.max(1, Math.floor(manaCost * 0.9));
    }
    this.player.decreaseMana(manaCost);
  }

  // Increment magic skill based on mana used (training)
  if (spellMeta && spellMeta.mana > 0 && this.player.skills) {
    const SkillMultipliers = requireModule("utils/skill-multipliers");

    // Calculate base skill points from mana used (use reduced cost if training rod)
    let manaForPoints = manaCost > 0 ? manaCost : spellMeta.mana;
    let skillConfig = SkillMultipliers.getSkillConfig("MAGIC");
    let basePointsPerCast = skillConfig.BASE_POINTS_PER_CAST || 1;
    let basePoints = Math.max(1, Math.floor(manaForPoints * basePointsPerCast));

    // Get vocation name and apply multiplier
    let vocationName = this.player.getVocationName().toUpperCase();
    let totalPoints = SkillMultipliers.calculateSkillPoints(basePoints, vocationName, "MAGIC");

    // Apply stages multiplier if available
    let stageMultiplier = this.__getMagicStageMultiplier();
    let skillPoints = totalPoints * stageMultiplier;
    this.player.skills.incrementSkill(CONST.PROPERTIES.MAGIC, skillPoints);
  }

  // Write a packet to the player that the spell needs to be put on cooldown by a number of frames
  this.player.write(new SpellCastPacket(sid, cooldown));

  // Lock it
  this.__lockSpell(sid, cooldown);

}

Spellbook.prototype.__lockSpell = function (sid, duration) {

  /*
   * Function Spellbook.__lockSpell
   * Handles locking of a spell by adding it to the cooldown map. A reference to the locked down event is included
   */

  // Also lock to the global cooldown
  this.__internalLockSpell(sid, duration);
  this.__internalLockSpell(this.GLOBAL_COOLDOWN, this.GLOBAL_COOLDOWN_DURATION);

}

Spellbook.prototype.applyCooldowns = function () {

  /*
   * Function Spellbook.applyCooldowns
   * Applies the serialized cooldowns when the player logs in
   */

  // Apply a correction for the duration the player has been offline
  let correction = (Date.now() - this.player.lastVisit);

  this.__cooldowns.forEach(function ({ sid, cooldown }) {

    cooldown = Math.max(0, cooldown - (correction / CONFIG.SERVER.MS_TICK_INTERVAL));

    // Cooldown of zero: not needed
    if (cooldown === 0) {
      return;
    }

    // Lock and inform
    this.__internalLockSpell(sid, cooldown);
    this.player.write(new SpellCastPacket(sid, cooldown));

  }, this);

}

Spellbook.prototype.writeSpells = function (gameSocket) {

  /*
   * Function Spellbook.writeSpells
   * Serializes the spellbook as a binary packet
   */

  this.__availableSpells.forEach(sid => gameSocket.write(new SpellAddPacket(sid)));

}

Spellbook.prototype.__internalLockSpell = function (sid, duration) {

  /*
   * Function Spellbook.__internalLockSpell
   * Internal function actually schedule the lock
   */

  this.__spellCooldowns.set(sid, gameServer.world.eventQueue.addEvent(this.__unlockSpell.bind(this, sid), duration));

}

Spellbook.prototype.__unlockSpell = function (sid) {

  /*
   * Function Spellbook.__unlockSpell
   * Handles unlocking of a spell by deleting it from the cooldown map
   */

  this.__spellCooldowns.delete(sid);

}

Spellbook.prototype.__getMagicStageMultiplier = function () {

  /*
   * Function Spellbook.__getMagicStageMultiplier
   * Returns the magic level stage multiplier based on current magic level
   */

  try {
    const stages = require(process.cwd() + "/data/misc/stages.json");

    if (!stages || !stages.enabled || !stages.stages) {
      return 1;
    }

    let currentMagicLevel = this.player.skills ? this.player.skills.getSkillLevel(CONST.PROPERTIES.MAGIC) : 0;

    for (let stage of stages.stages) {
      let minLevel = stage.minLevel || 0;
      let maxLevel = stage.maxLevel || Infinity;

      if (currentMagicLevel >= minLevel && currentMagicLevel <= maxLevel) {
        return stage.multiplier || 1;
      }
    }

    return 1;
  } catch (error) {
    return 1;
  }

}

module.exports = Spellbook;
