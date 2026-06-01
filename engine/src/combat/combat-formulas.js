"use strict";

const CombatFormulas = {};

CombatFormulas.COMBAT_TYPES = {
  PHYSICAL: "physical",
  ENERGY: "energy",
  FIRE: "fire",
  COLD: "cold",
  EARTH: "earth",
  MELEE: "melee",
  RANGED: "ranged",
  HOLY: "holy",
  HEALING: "healing",
  LIFEDRAIN: "lifedrain",
  MANADRAIN: "manadrain",
  DROWN: "drown",
  UNDEFINED: "undefined"
};

CombatFormulas.BLOCK_TYPES = {
  NONE: "none",
  DEFENSE: "defense",
  ARMOR: "armor",
  IMMUNITY: "immunity"
};

CombatFormulas.VOCATION_MULTIPLIERS = {
  knight: { meleeDamage: 1.25, distanceDamage: 1.0, defensiveValue: 1.0, armor: 1.1 },
  paladin: { meleeDamage: 1.1, distanceDamage: 1.4, defensiveValue: 1.0, armor: 1.1 },
  sorcerer: { meleeDamage: 1.0, distanceDamage: 1.0, defensiveValue: 1.25, armor: 1.0 },
  druid: { meleeDamage: 1.0, distanceDamage: 1.0, defensiveValue: 1.25, armor: 1.0 },
  admin: { meleeDamage: 2.0, distanceDamage: 2.0, defensiveValue: 2.0, armor: 2.0 },
  none: { meleeDamage: 1.0, distanceDamage: 1.0, defensiveValue: 1.0, armor: 1.0 }
};

CombatFormulas.getAttackFactor = function (fightMode) {
  switch (fightMode) {
    case 0: return 1.0;
    case 1: return 1.2;
    case 2: return 2.0;
    default: return 1.0;
  }
};

CombatFormulas.getDefenseFactor = function (fightMode, timeSinceLastAttack, attackSpeed) {
  switch (fightMode) {
    case 0: return timeSinceLastAttack < attackSpeed ? 0.5 : 1.0;
    case 1: return timeSinceLastAttack < attackSpeed ? 0.75 : 1.0;
    case 2: return 1.0;
    default: return 1.0;
  }
};

CombatFormulas.getMaxWeaponDamage = function (level, attackSkill, attackValue, attackFactor) {
  let maxDamage = (level / 5) +
    (((attackSkill / 4 + 1) * (attackValue / 3)) * 1.03) / attackFactor;
  return Math.round(maxDamage);
};

CombatFormulas.getMaxWeaponDamageClassic = function (attackSkill, attackValue) {
  let formula = (5 * attackSkill + 50) * attackValue;
  let rnd = Math.floor(Math.random() * 100);
  let maxDamage = formula * ((Math.floor(Math.random() * 100) + rnd) / 2) / 10000;
  return Math.ceil(maxDamage);
};

CombatFormulas.getMeleeDamage = function (player, weaponAttack, weaponSkillType) {
  let attackValue = Math.max(0, weaponAttack);
  let attackSkill = (player.getSkillLevel ? player.getSkillLevel(weaponSkillType) : player.skills.getSkillLevel(weaponSkillType));
  let attackFactor = CombatFormulas.getAttackFactor(player.fightMode);
  let maxValue = CombatFormulas.getMaxWeaponDamage(player.getLevel(), attackSkill, attackValue, attackFactor);
  let vocationName = player.getVocationName();
  let mult = CombatFormulas.VOCATION_MULTIPLIERS[vocationName] || CombatFormulas.VOCATION_MULTIPLIERS.none;
  maxValue = maxValue * mult.meleeDamage;
  let finalDamage = -Math.floor(Math.random() * (maxValue + 1));
  return finalDamage;
};

CombatFormulas.getRangeDamage = function (player, weaponAttack, ammoAttack, target) {
  let attackValue = weaponAttack;
  if (ammoAttack) {
    attackValue += ammoAttack;
  }
  let attackSkill = (player.getSkillLevel ? player.getSkillLevel(CONST.PROPERTIES.DISTANCE) : player.skills.getSkillLevel(CONST.PROPERTIES.DISTANCE));
  let attackFactor = CombatFormulas.getAttackFactor(player.fightMode);
  let maxValue = CombatFormulas.getMaxWeaponDamage(player.getLevel(), attackSkill, attackValue, attackFactor);
  let vocationName = player.getVocationName();
  let mult = CombatFormulas.VOCATION_MULTIPLIERS[vocationName] || CombatFormulas.VOCATION_MULTIPLIERS.none;
  maxValue = maxValue * mult.distanceDamage;
  let minValue = 0;
  if (target && target.isPlayer()) {
    minValue = Math.ceil(player.getLevel() * 0.1);
  } else {
    minValue = Math.ceil(player.getLevel() * 0.2);
  }
  let finalDamage = Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
  return Math.max(1, finalDamage);
};

/* TFS COMBAT_FORMULA_LEVELMAGIC: levelFormula = level*2 + ml*3; damage = random(levelFormula*mina + minb, levelFormula*maxa + maxb) */
CombatFormulas.getMagicDamage = function (caster, mina, minb, maxa, maxb) {
  let magicLevel = caster.skills.getSkillLevel(CONST.PROPERTIES.MAGIC);
  let level = caster.getLevel();
  let levelFormula = level * 2 + magicLevel * 3;
  let minDamage = Math.round(levelFormula * mina + minb);
  let maxDamage = Math.round(levelFormula * maxa + maxb);
  let finalDamage = -(Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage);
  return finalDamage;
};

/* TFS COMBAT_FORMULA_SKILL: damage = random(minb, weaponMaxDamage*maxa + maxb) */
CombatFormulas.getSkillDamage = function (caster, target, minb, maxa, maxb) {
  let weaponInfo = caster.containerManager.equipment.getWeapon();
  if (!weaponInfo || !weaponInfo.weapon) {
    let finalDamage = -(Math.floor(Math.random() * (maxb - minb + 1)) + minb);
    return finalDamage;
  }
  let item = weaponInfo.weapon;
  let attackValue = Math.max(0, item.getAttribute("attack") || 7);
  let weaponSkillType = CombatFormulas.__getWeaponSkillProperty(item);
  let attackSkill = (caster.getSkillLevel ? caster.getSkillLevel(weaponSkillType) : caster.skills.getSkillLevel(weaponSkillType));
  let attackFactor = CombatFormulas.getAttackFactor(caster.fightMode);
  let maxWeaponDamage = CombatFormulas.getMaxWeaponDamage(caster.getLevel(), attackSkill, attackValue, attackFactor);
  let vocationName = caster.getVocationName();
  let mult = CombatFormulas.VOCATION_MULTIPLIERS[vocationName] || CombatFormulas.VOCATION_MULTIPLIERS.none;
  maxWeaponDamage = Math.round(maxWeaponDamage * mult.meleeDamage);
  let maxDamage = Math.round(maxWeaponDamage * maxa + maxb);
  let finalDamage = -(Math.floor(Math.random() * (maxDamage - minb + 1)) + minb);
  return finalDamage;
};

CombatFormulas.getPlayerDefense = function (player) {
  let equipment = player.containerManager.equipment;
  let defenseSkill = (player.getSkillLevel ? player.getSkillLevel(CONST.PROPERTIES.FIST) : player.skills.getSkillLevel(CONST.PROPERTIES.FIST));
  let defenseValue = 7;
  let weapon = null;
  let shield = null;
  let leftItem = equipment.peekIndex(CONST.EQUIPMENT.LEFT);
  let rightItem = equipment.peekIndex(CONST.EQUIPMENT.RIGHT);
  if (leftItem && leftItem.getPrototype().properties.weaponType === "shield") {
    shield = leftItem;
  } else if (leftItem && (
    leftItem.getPrototype().properties.weaponType === "sword" ||
    leftItem.getPrototype().properties.weaponType === "club" ||
    leftItem.getPrototype().properties.weaponType === "axe" ||
    leftItem.getPrototype().properties.weaponType === "distance"
  )) {
    weapon = leftItem;
  }
  if (rightItem && rightItem.getPrototype().properties.weaponType === "shield") {
    shield = rightItem;
  } else if (rightItem && !weapon && (
    rightItem.getPrototype().properties.weaponType === "sword" ||
    rightItem.getPrototype().properties.weaponType === "club" ||
    rightItem.getPrototype().properties.weaponType === "axe" ||
    rightItem.getPrototype().properties.weaponType === "distance"
  )) {
    weapon = rightItem;
  }
  if (weapon) {
    defenseValue = (weapon.getAttribute("defense") || 0) + (weapon.getAttribute("extraDefense") || 0);
    defenseSkill = (player.getSkillLevel ? player.getSkillLevel(CombatFormulas.__getWeaponSkillProperty(weapon)) : player.skills.getSkillLevel(CombatFormulas.__getWeaponSkillProperty(weapon)));
  }
  if (shield) {
    if (weapon) {
      defenseValue = (shield.getAttribute("defense") || 0) + (weapon.getAttribute("extraDefense") || 0);
    } else {
      defenseValue = shield.getAttribute("defense") || 0;
    }
    defenseSkill = (player.getSkillLevel ? player.getSkillLevel(CONST.PROPERTIES.SHIELDING) : player.skills.getSkillLevel(CONST.PROPERTIES.SHIELDING));
  }
  if (defenseSkill === 0) {
    switch (player.fightMode) {
      case 0: case 1: return 1;
      case 2: return 2;
      default: return 1;
    }
  }
  if (CONFIG.COMBAT && CONFIG.COMBAT.USE_CLASSIC_FORMULAS) {
    let totalDefense = defenseValue;
    let fightMode = player.fightMode;
    if (fightMode === 2) {
      totalDefense += 8 * totalDefense / 10;
    } else if (fightMode === 0) {
      totalDefense -= 4 * totalDefense / 10;
    }
    let vocationName = player.getVocationName();
    let mult = CombatFormulas.VOCATION_MULTIPLIERS[vocationName] || CombatFormulas.VOCATION_MULTIPLIERS.none;
    totalDefense *= mult.defensiveValue;
    let formula = (5 * defenseSkill + 50) * totalDefense;
    let rnd = Math.floor(Math.random() * 100);
    totalDefense = formula * ((Math.floor(Math.random() * 100) + rnd) / 2) / 10000;
    return Math.round(totalDefense);
  }
  let attackSpeed = player.getAttackSpeed();
  let timeSinceLastAttack = Date.now() - (player.__lastAttackTime || 0);
  let defenseFactor = CombatFormulas.getDefenseFactor(player.fightMode, timeSinceLastAttack, attackSpeed);
  let vocationName = player.getVocationName();
  let mult = CombatFormulas.VOCATION_MULTIPLIERS[vocationName] || CombatFormulas.VOCATION_MULTIPLIERS.none;
  let totalDefense = (defenseSkill / 4 + 2.23) * defenseValue * 0.15 * defenseFactor * mult.defensiveValue;
  return Math.round(totalDefense);
};

CombatFormulas.__getWeaponSkillProperty = function (item) {
  let wt = item.getPrototype().properties.weaponType;
  switch (wt) {
    case "sword": return CONST.PROPERTIES.SWORD;
    case "club": return CONST.PROPERTIES.CLUB;
    case "axe": return CONST.PROPERTIES.AXE;
    case "distance": return CONST.PROPERTIES.DISTANCE;
    default: return CONST.PROPERTIES.FIST;
  }
};

CombatFormulas.getPlayerArmor = function (player) {
  let equipment = player.containerManager.equipment;
  let armor = 0;
  let armorSlots = [
    CONST.EQUIPMENT.HELMET, CONST.EQUIPMENT.NECKLACE, CONST.EQUIPMENT.ARMOR,
    CONST.EQUIPMENT.LEGS, CONST.EQUIPMENT.BOOTS, CONST.EQUIPMENT.RING
  ];
  for (let i = 0; i < armorSlots.length; i++) {
    let item = equipment.peekIndex(armorSlots[i]);
    if (item) {
      let arm = item.getAttribute("armor");
      if (arm !== null && arm !== undefined) {
        armor += arm;
      }
    }
  }
  let vocationName = player.getVocationName();
  let mult = CombatFormulas.VOCATION_MULTIPLIERS[vocationName] || CombatFormulas.VOCATION_MULTIPLIERS.none;
  armor *= mult.armor;
  if (CONFIG.COMBAT && CONFIG.COMBAT.USE_CLASSIC_FORMULAS) {
    if (armor > 1) {
      armor = Math.floor(Math.random() * (armor >> 1)) + (armor >> 1);
    }
  }
  return Math.floor(armor);
};

/* TFS exact: armor > 3 ? random(armor/2, armor - (armor%2 + 1)) : (armor > 0 ? 1 : 0) */
CombatFormulas.applyArmorReduction = function (damage, armor) {
  if (damage > 0) return damage;
  damage = Math.abs(damage);
  if (CONFIG.COMBAT && CONFIG.COMBAT.USE_CLASSIC_FORMULAS) {
    damage -= armor;
  } else {
    if (armor > 3) {
      let minReduction = Math.floor(armor / 2);
      let maxReduction = armor - (armor % 2 + 1);
      if (maxReduction >= minReduction) {
        damage -= Math.floor(Math.random() * (maxReduction - minReduction + 1)) + minReduction;
      } else {
        damage -= minReduction;
      }
    } else if (armor > 0) {
      damage -= 1;
    }
  }
  return damage <= 0 ? 0 : -damage;
};

/*
 * TFS: damage -= random(defense/2, defense). Se damage <= 0 → block total.
 * Retorna { blocked: true, damage: 0 } ou { blocked: false, damage }.
 */
CombatFormulas.tryBlockDefense = function (damage, defense) {
  if (damage >= 0) return { blocked: false, damage: damage };
  let absDmg = Math.abs(damage);
  if (CONFIG.COMBAT && CONFIG.COMBAT.USE_CLASSIC_FORMULAS) {
    absDmg -= defense;
  } else {
    absDmg -= Math.floor(Math.random() * (defense - Math.floor(defense / 2) + 1)) + Math.floor(defense / 2);
  }
  if (absDmg <= 0) return { blocked: true, damage: 0 };
  return { blocked: false, damage: -absDmg };
};

CombatFormulas.isImmune = function (target, combatType) {
  let immunities = target.damageImmunities || [];
  return immunities.includes(combatType);
};

CombatFormulas.applyEquipmentAbsorb = function (damage, target, combatType, field) {
  if (!target.isPlayer || !target.isPlayer()) return damage;
  if (damage === 0) return damage;
  let absDamage = Math.abs(damage);
  let equipment = target.containerManager.equipment;
  let slots = [
    CONST.EQUIPMENT.HELMET, CONST.EQUIPMENT.NECKLACE, CONST.EQUIPMENT.ARMOR,
    CONST.EQUIPMENT.LEGS, CONST.EQUIPMENT.BOOTS, CONST.EQUIPMENT.RING,
    CONST.EQUIPMENT.LEFT, CONST.EQUIPMENT.RIGHT, CONST.EQUIPMENT.QUIVER
  ];
  for (let i = 0; i < slots.length; i++) {
    let item = equipment.peekIndex(slots[i]);
    if (!item) continue;
    let absorb = item.getAttribute("absorbPercent");
    if (!absorb && typeof absorb !== "number") {
      if (field) {
        absorb = item.getAttribute("fieldAbsorbPercent");
      }
    }
    if (absorb && absorb[combatType] !== undefined) {
      absDamage = Math.round(absDamage * (100 - absorb[combatType]) / 100);
      // Consume might ring charge when it absorbs damage
      if (slots[i] === CONST.EQUIPMENT.RING && item.id === 2164) {
        if (target.containerManager && target.containerManager.equipment) {
          target.containerManager.equipment.__consumeMightRingCharge();
        }
      }
    } else if (field) {
      let fieldAbsorb = item.getAttribute("fieldAbsorbPercent");
      if (fieldAbsorb && fieldAbsorb[combatType] !== undefined) {
        absDamage = Math.round(absDamage * (100 - fieldAbsorb[combatType]) / 100);
      }
    }
    if (absDamage <= 0) return 0;
  }
  return -absDamage;
};

CombatFormulas.getMonsterSpellDamage = function (minCombatValue, maxCombatValue) {
  let damage = Math.floor(Math.random() * (maxCombatValue - minCombatValue + 1)) + minCombatValue;
  return -damage;
};

CombatFormulas.applyPvPDivision = function (damage, attacker, target, combatType) {
  if (combatType === CombatFormulas.COMBAT_TYPES.HEALING) return damage;
  if (!attacker || !target) return damage;
  if (!attacker.isPlayer || !target.isPlayer) return damage;
  let aPlayer = attacker.isPlayer();
  let tPlayer = target.isPlayer();
  if (aPlayer && tPlayer && attacker !== target) {
    return Math.round(damage / 2);
  }
  return damage;
};

CombatFormulas.applyCriticalHit = function (damage, player) {
  if (!player || !player.isPlayer || !player.isPlayer()) return damage;
  if (damage >= 0) return damage;
  let chance = player.getSpecialSkill ? player.getSpecialSkill("criticalHitChance") : 0;
  let skill = player.getSpecialSkill ? player.getSpecialSkill("criticalHitAmount") : 0;
  if (chance > 0 && skill > 0 && Math.random() * 100 < chance) {
    let absDmg = Math.abs(damage);
    absDmg += Math.round(absDmg * skill / 100);
    return -absDmg;
  }
  return damage;
};

/* Main block hit pipeline matching TFS Creature::blockHit + Player::blockHit */
CombatFormulas.combatBlockHit = function (damage, target, combatType, options) {
  options = options || {};
  let checkDefense = options.checkDefense || false;
  let checkArmor = options.checkArmor || false;
  let field = options.field || false;
  let ignoreResistances = options.ignoreResistances || false;
  let blockCount = options.blockCount || 0;

  if (combatType === CombatFormulas.COMBAT_TYPES.UNDEFINED) {
    return { finalDamage: damage, blockType: CombatFormulas.BLOCK_TYPES.NONE, blockCount: blockCount };
  }

  if (CombatFormulas.isImmune(target, combatType)) {
    return { finalDamage: 0, blockType: CombatFormulas.BLOCK_TYPES.IMMUNITY, blockCount: blockCount };
  }

  if (checkDefense || checkArmor) {
    let hasDefense = false;
    if (checkDefense && blockCount > 0) {
      hasDefense = true;
      blockCount--;
    }

    if (checkDefense && hasDefense && target.canUseDefense !== false) {
      let defense = 0;
      if (target.isPlayer && target.isPlayer()) {
        defense = CombatFormulas.getPlayerDefense(target);
      } else if (target.getDefense) {
        defense = target.getDefense();
      }
      if (defense > 0) {
        let result = CombatFormulas.tryBlockDefense(damage, defense);
        if (result.blocked) {
          return { finalDamage: 0, blockType: CombatFormulas.BLOCK_TYPES.DEFENSE, blockCount: blockCount };
        }
        damage = result.damage;
        checkArmor = false;
      }
    }

    if (checkArmor) {
      let armor = 0;
      if (target.isPlayer && target.isPlayer()) {
        armor = CombatFormulas.getPlayerArmor(target);
      } else if (target.getArmor) {
        armor = target.getArmor();
      }
      if (armor > 0) {
        damage = CombatFormulas.applyArmorReduction(damage, armor);
        if (damage === 0) {
          return { finalDamage: 0, blockType: CombatFormulas.BLOCK_TYPES.ARMOR, blockCount: blockCount };
        }
      }
    }
  }

  if (!ignoreResistances) {
    if (target.isPlayer && target.isPlayer()) {
      let result = CombatFormulas.applyEquipmentAbsorb(damage, target, combatType, field);
      if (result === 0) {
        return { finalDamage: 0, blockType: CombatFormulas.BLOCK_TYPES.IMMUNITY, blockCount: blockCount };
      }
      damage = result;
    }
    if (target.elementalResistances && combatType !== CombatFormulas.COMBAT_TYPES.PHYSICAL &&
        combatType !== CombatFormulas.COMBAT_TYPES.MELEE) {
      damage = CombatFormulas.applyElementalResistance(damage, target, combatType);
      if (damage === 0) {
        return { finalDamage: 0, blockType: CombatFormulas.BLOCK_TYPES.IMMUNITY, blockCount: blockCount };
      }
    }
  }

  return { finalDamage: damage, blockType: CombatFormulas.BLOCK_TYPES.NONE, blockCount: blockCount };
};

CombatFormulas.calculateFinalDamage = function (attacker, target, combatType, initialDamage, blockCount) {
  let result = CombatFormulas.combatBlockHit(initialDamage, target, combatType, {
    checkDefense: combatType === CombatFormulas.COMBAT_TYPES.PHYSICAL || combatType === CombatFormulas.COMBAT_TYPES.MELEE,
    checkArmor: combatType === CombatFormulas.COMBAT_TYPES.PHYSICAL || combatType === CombatFormulas.COMBAT_TYPES.MELEE,
    blockCount: blockCount
  });
  if (result.finalDamage !== 0 && attacker && target) {
    result.finalDamage = CombatFormulas.applyPvPDivision(result.finalDamage, attacker, target, combatType);
  }
  return result;
};

CombatFormulas.applyElementalResistance = function (damage, target, combatType) {
  let resistances = target.elementalResistances || {};
  let resistance = resistances[combatType];
  if (resistance === undefined || resistance === null || resistance === 0) return damage;
  damage = Math.abs(damage);
  let finalDamage = damage * ((100 - resistance) / 100);
  finalDamage = Math.round(finalDamage);
  if (finalDamage <= 0) return 0;
  return -finalDamage;
};

module.exports = CombatFormulas;
