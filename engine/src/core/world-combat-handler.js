"use strict";

const CombatFormulas = requireModule("combat/combat-formulas");
const Position = requireModule("utils/position");

const TRAINING_WEAPON_SKILLS = {
  3139: CONST.PROPERTIES.MAGIC,
  3140: CONST.PROPERTIES.DISTANCE,
  3141: CONST.PROPERTIES.SHIELDING,
  3142: CONST.PROPERTIES.CLUB,
  3143: CONST.PROPERTIES.SWORD,
  3144: CONST.PROPERTIES.AXE
};

const CombatHandler = function () {};

CombatHandler.prototype.__getTrainingWeapon = function (player) {
  let slots = [CONST.EQUIPMENT.LEFT, CONST.EQUIPMENT.RIGHT];
  for (let slot of slots) {
    let item = player.containerManager.equipment.peekIndex(slot);
    if (item && item.isTrainingWeapon && item.isTrainingWeapon()) {
      return item;
    }
  }
  return null;
};

CombatHandler.prototype.__handleTrainingHit = function (source, target, weapon) {
  gameServer.world.sendMagicEffect(target.position, CONST.EFFECT.MAGIC.MAGIC_RED);
  let points = 10;
  if (!source.skills || !source.skills.incrementSkill) return;

  let skill = TRAINING_WEAPON_SKILLS[weapon.id];

  if (skill === CONST.PROPERTIES.SHIELDING) {
    source.skills.incrementSkill(CONST.PROPERTIES.SHIELDING, points);
    return;
  }

  source.skills.incrementSkill(skill, points);
};

CombatHandler.prototype.__handleDummyPickup = function (player, dummy) {
  var tile = dummy.getTile();
  if (!tile || !tile.isHouseTile() || !player.ownsHouseTile(tile)) {
    return player.sendCancelMessage("You can only pick up your own Training Dummy.");
  }

  // Create the dummy item
  var item = process.gameServer.database.createThing(3138);
  if (!item) {
    return player.sendCancelMessage("Failed to create item.");
  }

  // Despawn the dummy monster
  gameServer.world.creatureHandler.removeCreature(dummy);

  // Add to player's inventory (backpack → ground fallback)
  player.containerManager.pickupItem(item);

  gameServer.world.sendMagicEffect(tile.position, CONST.EFFECT.MAGIC.MAGIC_GREEN);
  player.sendCancelMessage("You pick up the Training Dummy.");
};

CombatHandler.prototype.__log = function (source, target, msg) {
  let s = source ? (source.name || source.getId()) : "??";
  let t = target ? (target.name || target.getId()) : "??";
  console.log("[COMBAT] %s → %s | %s".format(s, t, msg));
};

/*
 * Applies final combat damage to target.
 * Delegates to target.decreaseHealth which handles mana shield, effects, death, etc.
 * For healing: calls target.increaseHealth.
 */
CombatHandler.prototype.combatChangeHealth = function (attacker, target, combatDamage) {
  if (!target) return false;

  // Admin takes no damage
  if (combatDamage.finalDamage < 0 && target.name === "Admin") {
    return true;
  }

  let damageValue = Math.abs(combatDamage.finalDamage);
  if (damageValue === 0) return true;

  if (combatDamage.finalDamage > 0) {
    if (target.increaseHealth) target.increaseHealth(damageValue);
    return true;
  }

  if (target.decreaseHealth) {
    target.decreaseHealth(attacker, damageValue);
  }
  return true;
};

CombatHandler.prototype.handleCombat = function (source) {
  let target = source.getTarget();
  if (!target) return;

  if (target.getPrototype && target.getPrototype()) {
    let proto = target.getPrototype();
    if (proto.flags && proto.flags.attackable === false) {
      source.setTarget(null);
      return;
    }
  }

  // Training Dummy / Training Weapon logic
  if (source.isPlayer && source.isPlayer()) {
    let isTrainingDummy = target.flags && target.flags.trainer === true;
    let trainingWeapon = this.__getTrainingWeapon(source);

    if (trainingWeapon && !isTrainingDummy) {
      source.sendCancelMessage("Training weapons can only be used on Training Dummies.");
      return;
    }

    if (isTrainingDummy) {
      if (!trainingWeapon) {
        let tile = target.getTile();
        if (tile && tile.isHouseTile() && source.ownsHouseTile && source.ownsHouseTile(tile)) {
          return this.__handleDummyPickup(source, target);
        }
        source.sendCancelMessage("You need a training weapon to attack this target.");
        return;
      }
      this.__handleTrainingHit(source, target, trainingWeapon);
      return;
    }
  }

  // Defense: check line of sight for ranged attacks
  if (!source.position.isWithinRangeOf(target.position, 2)) {
    if (!source.position.inLineOfSight(target.position)) {
      return;
    }
  }

  let pvpSource = source.master || source;
  let pvpTarget = target.master || target;

  let combatType = CombatFormulas.COMBAT_TYPES.PHYSICAL;
  let checkDefense = true;
  let checkArmor = true;
  let blockCount = target.blockCount || 0;
  let meleeHit = true;

  // Distance weapon handling
  if (!source.master && source.isPlayer && source.isPlayer()) {
    let result = source.containerManager.equipment.getWeapon();
    if (result && result.weapon.isDistanceWeapon()) {
      combatType = CombatFormulas.COMBAT_TYPES.RANGED;
      meleeHit = false;

      let weapon = result.weapon;
      let slot = result.slot;

      if (weapon.getAttribute("ammoAction") === "move") {
        gameServer.world.sendDistanceEffect(source.position, target.position, weapon.getShootType());
        let breaks = Math.random() < 0.03;
        source.containerManager.equipment.removeIndex(slot, 1);
        if (!breaks) {
          let tile = gameServer.world.getTileFromWorldPosition(target.position);
          if (tile) {
            let dropped = gameServer.database.createThing(weapon.id);
            tile.addThing(dropped, -1);
          }
        }
      } else {
        if (!source.isAmmunitionEquipped()) return;
        let weaponItem = source.containerManager.equipment.peekIndex(CONST.EQUIPMENT.LEFT);
        let weaponHitChance = weaponItem ? (parseInt(weaponItem.getAttribute("hitChance")) || 0) : 0;
        let ammo = source.containerManager.equipment.peekIndex(CONST.EQUIPMENT.QUIVER);
        let ammoHitChance = parseInt(ammo.getAttribute("hitChance")) || 0;
        let baseChance = weapon.getAttribute("ammoAction") === "move" ? 75 : 90;
        let hitChance = Math.min(100, ammoHitChance + weaponHitChance + baseChance);
        let distanceSkill = (source.getSkillLevel ? source.getSkillLevel(CONST.PROPERTIES.DISTANCE) : source.skills.getSkillLevel(CONST.PROPERTIES.DISTANCE));
        let distX = Math.abs(source.position.x - target.position.x);
        let distY = Math.abs(source.position.y - target.position.y);
        let distance = Math.max(distX, distY);
        if (distance <= 1) distance = 5;

        source.consumeAmmunition();
        gameServer.world.sendDistanceEffect(source.position, target.position, ammo.getShootType());

        // TFS distance hit formula: random(0, distance*15-1) <= skill AND random%100 <= chance
        let skillCheck = Math.floor(Math.random() * (distance * 15)) <= distanceSkill;
        let chanceCheck = Math.floor(Math.random() * 100) <= hitChance;
        let missed = !skillCheck || !chanceCheck;

        this.__log(source, target, "Distance: skillCheck=%s chanceCheck=%s dist=%d skill=%d hitChance=%d".format(
          skillCheck ? "hit" : "miss", chanceCheck ? "ok" : "fail", distance, distanceSkill, hitChance
        ));

        if (ammo.id !== 2546 && missed) {
          gameServer.world.sendMagicEffect(target.position, CONST.EFFECT.MAGIC.POFF);
          return;
        }

        if (ammo.id === 2545) {
          target.addCondition(CONST.CONDITION.POISONED, 10, 2000);
        }

        if (ammo.id === 2546) {
          let magicDamage = Math.abs(CombatFormulas.getMagicDamage(source, 0.15, 0, 0.45, 0));
          magicDamage = Math.max(1, magicDamage);
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              let pos = new Position(target.position.x + dx, target.position.y + dy, target.position.z);
              gameServer.world.sendMagicEffect(pos, CONST.EFFECT.MAGIC.EXPLOSIONHIT);
              let tile = gameServer.world.getTileFromWorldPosition(pos);
              if (tile && tile.creatures) {
                tile.creatures.forEach(creature => {
                  if (creature !== source) {
                    let dmg = Math.min(magicDamage, creature.getProperty(CONST.PROPERTIES.HEALTH));
                    let cd = { finalDamage: -dmg, combatType: CombatFormulas.COMBAT_TYPES.FIRE, blockType: CombatFormulas.BLOCK_TYPES.NONE };
                    CombatHandler.prototype.combatChangeHealth(source, creature, cd);
                  }
                });
              }
            }
          }
          return;
        }
      }
    }
  }

  let rawDamage = source.calculateDamage(target);
  let damage = rawDamage > 0 ? -rawDamage : rawDamage;

  let isMonsterAttackingPlayer = !source.isPlayer();
  if (isMonsterAttackingPlayer) {
    this.__log(source, target, "Raw damage: %d".format(rawDamage));
    if (target.isPlayer && target.isPlayer()) {
      let playerDef = CombatFormulas.getPlayerDefense(target);
      let playerArm = CombatFormulas.getPlayerArmor(target);
      this.__log(source, target, "Player defense: %d | armor: %d".format(playerDef, playerArm));
    }
  }

  let result = CombatFormulas.combatBlockHit(damage, target, combatType, {
    checkDefense: checkDefense,
    checkArmor: checkArmor,
    blockCount: blockCount,
    meleeHit: meleeHit
  });

  if (isMonsterAttackingPlayer && result.finalDamage !== 0) {
    this.__log(source, target, "After blockHit: %d (blockType: %s)".format(
      Math.abs(result.finalDamage), result.blockType
    ));
  }

  let finalDamage = result.finalDamage;
  let blockType = result.blockType;

  if (finalDamage === 0) {
    if (blockType === CombatFormulas.BLOCK_TYPES.DEFENSE) {
      gameServer.world.sendMagicEffect(target.position, CONST.EFFECT.MAGIC.POFF);
    } else if (blockType === CombatFormulas.BLOCK_TYPES.ARMOR) {
      gameServer.world.sendMagicEffect(target.position, CONST.EFFECT.MAGIC.BLOCKHIT);
    }
    if (pvpSource.isPlayer()) pvpSource.checkSkillAdvance(false);
    if (pvpTarget.isPlayer()) pvpTarget.checkDefensiveSkillAdvance();
    return;
  }

  if (pvpSource.isPlayer() && pvpTarget.isPlayer() && source !== target) {
    finalDamage = CombatFormulas.applyPvPDivision(finalDamage, source, target, combatType);
    if (isMonsterAttackingPlayer) {
      this.__log(source, target, "After PvP division: %d".format(Math.abs(finalDamage)));
    }
  }

  finalDamage = CombatFormulas.applyCriticalHit(finalDamage, source);

  let isPvP = pvpSource.isPlayer() && pvpTarget.isPlayer();
  if (isPvP) {
    let skullManager = gameServer.world.skullManager;
    if (!skullManager.canAttack(pvpSource, pvpTarget)) return;
    skullManager.onPlayerAttack(pvpSource, pvpTarget);
    pvpTarget.pzLock.activate();
  }

  if (pvpSource.isPlayer()) pvpSource.checkSkillAdvance(true);
  if (pvpTarget.isPlayer()) pvpTarget.checkDefensiveSkillAdvance();

  if (!source.master && source.hasCondition && source.hasCondition(CONST.CONDITION.INVISIBLE)) {
    source.removeCondition(CONST.CONDITION.INVISIBLE);
  }

  gameServer.world.sendMagicEffect(target.position, 1);

  if (isMonsterAttackingPlayer) {
    this.__log(source, target, "Final damage applied: %d HP".format(Math.abs(finalDamage)));
  }

  let combatDamage = {
    finalDamage: finalDamage,
    combatType: combatType,
    blockType: blockType
  };
  this.combatChangeHealth(source, target, combatDamage);
};

CombatHandler.prototype.handleDistanceCombat = function (source, target) {
  let ammo = source.consumeAmmunition();
  gameServer.world.sendDistanceEffect(source.position, target.position, ammo.getShootType());
};

CombatHandler.prototype.applyEnvironmentalDamage = function (target, amount, color) {
  if (target.isPlayer && target.isPlayer()) {
    target.combatLock.activate();
  }
  let combatDamage = {
    finalDamage: -Math.abs(amount),
    combatType: CombatFormulas.COMBAT_TYPES.UNDEFINED,
    blockType: CombatFormulas.BLOCK_TYPES.NONE
  };
  this.combatChangeHealth(null, target, combatDamage);
};

module.exports = CombatHandler;
