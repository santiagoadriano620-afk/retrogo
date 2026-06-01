"use strict";

const ServerMessagePacket = requireModule("network/protocol");
const DamageMapEntry = requireModule("combat/damage-map-entry");

const { EmotePacket, CreaturePropertyPacket } = requireModule("network/protocol");

const DamageMap = function (monster) {

  /*
   * Class DamageMap
   * Contains and records the damage caused to a creature
   */

  this.__map = new Map();
  this.__monster = monster;

}

DamageMap.prototype.getDividedExperience = function (experience) {

  /*
   * Function DamageMap.getDividedExperience
   * Equally divides the total experience over the number of characters in the map
   */

  // Divide over all character in the map
  return Math.floor(experience / this.__map.size);

}

DamageMap.prototype.update = function (attacker, amount) {

  /*
   * Function DamageMap.update
   * Adds incoming damage from an attacker to the damage map
   */

  if (attacker === null) {
    return;
  }

  // Attribute damage from summons to their master
  let effectiveAttacker = attacker.master || attacker;

  if (!this.__map.has(effectiveAttacker)) {
    this.__map.set(effectiveAttacker, new DamageMapEntry());
  }

  // Add to the existing amount
  this.__map.get(effectiveAttacker).addDamage(amount);

}

DamageMap.prototype.distributeExperience = function () {

  let partyManager = gameServer.world.partyManager;
  let monsterExp = this.__monster.experience;

  let stagesConfig = null;
  try {
    stagesConfig = require(process.cwd() + "/data/misc/stages.json");
  } catch (e) {
    stagesConfig = { enabled: false, stages: [] };
  }

  let getStageMultiplier = function (level) {
    if (!stagesConfig.enabled) return 1;
    for (let stage of stagesConfig.stages) {
      let minLevel = stage.minLevel || 1;
      let maxLevel = stage.maxLevel || Infinity;
      if (level >= minLevel && level <= maxLevel) {
        return stage.multiplier || 1;
      }
    }
    return 1;
  };

  let activeMembers = [];
  let attackerParty = null;

  // Check if ANY attacker has a party with shared XP enabled
  this.__map.forEach(function (_, attacker) {
    if (!attackerParty && attacker.isPlayer()) {
      let party = partyManager.getParty(attacker);
      if (party && party.sharedExperienceEnabled) {
        attackerParty = party;
        activeMembers = partyManager.getActiveSharedMembers(party);
      }
    }
  });

  let useShared = attackerParty && activeMembers.length >= 2;

  this.__map.forEach((map, attacker) => {
    if (!attacker.isPlayer()) return;
    if (!attacker.isOnline()) return;

    let mult = getStageMultiplier(attacker.getLevel());
    let finalExp;

    if (useShared) {
      let totalExp = Math.floor(monsterExp * mult);
      let sharePerMember = Math.floor(totalExp / activeMembers.length);

      // Only active members receive shared XP; others get solo
      if (activeMembers.indexOf(attacker) !== -1) {
        finalExp = sharePerMember;
      } else {
        // Fall back to solo share for non-active party members
        let baseSolo = Math.floor(monsterExp / this.__map.size);
        finalExp = Math.floor(baseSolo * mult);
      }
    } else {
      // Solo: equal split among all damage dealers
      let baseSolo = Math.floor(monsterExp / this.__map.size);
      finalExp = Math.floor(baseSolo * mult);
    }

    if (finalExp > 0) {
      if (gameServer.globalBoosts.exp > Date.now()) {
        finalExp = Math.floor(finalExp * 1.1);
      }
      attacker.skills.incrementSkill(CONST.PROPERTIES.EXPERIENCE, finalExp);
      attacker.write(new EmotePacket(attacker, String(finalExp), CONST.COLOR.WHITE));
      let expAfter = attacker.skills.getSkillValue(CONST.PROPERTIES.EXPERIENCE);
      attacker.write(new CreaturePropertyPacket(attacker.getId(), CONST.PROPERTIES.EXPERIENCE, expAfter));
    }
  });

}

DamageMap.prototype.__createLootText = function (thing) {

  /*
   * Function DamageMap.__createLootText
   * Creates loot text entry
   */

  if (thing.isStackable()) {
    return thing.getCount() + " " + thing.getName();
  }

  return thing.getArticle() + " " + thing.getName();

}

module.exports = DamageMap;
