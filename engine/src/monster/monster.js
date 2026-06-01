"use strict";

const Actions = requireModule("utils/actions");
const Creature = requireModule("entities/creature");
const Corpse = requireModule("entities/corpse");
const DamageMap = requireModule("combat/damage-map");
const CombatFormulas = requireModule("combat/combat-formulas");
const LootHandler = requireModule("monster/monster-loot-handler");
const MonsterBehaviour = requireModule("monster/monster-behaviour");

const { EmotePacket, ServerMessagePacket, ChannelWritePacket } = requireModule("network/protocol");

const Monster = function (cid, data) {

  /*
   * Class Monster
   * Container for an attackable monster
   */

  // Inherit from creature
  Creature.call(this, data.creatureStatistics);

  // Save properties of the monster
  this.cid = cid;
  this.corpse = data.corpse;
  this.deathField = data.deathField || null;
  this.fluidType = CONST.COLOR.RED;
  this.experience = data.experience;

  // Map for damage done to the creature
  this.damageMap = new DamageMap(this);

  // Master player if this monster is a summon
  this.master = null;

  // Track creatures summoned by this monster (e.g. Slime clones)
  this.summonedCreatures = [];

  // Store flags
  this.flags = data.flags || {};

  // Load immunities from monster data into the damageImmunities array
  if (data.immunities) {
    for (let [type, immune] of Object.entries(data.immunities)) {
      if (immune === true) {
        this.damageImmunities.push(type);
      }
    }
  }
  // Load elemental resistances from monster data
  if (data.elements) {
    this.elementalResistances = {};
    for (let [type, value] of Object.entries(data.elements)) {
      this.elementalResistances[type] = value;
    }
  }

  // Handler for loot
  this.lootHandler = new LootHandler(data.loot || []);

  // Container for the behaviour
  this.behaviourHandler = new MonsterBehaviour(this, data.behaviour);

  // Initialize spell actions for monster abilities
  this.spellActions = new Actions();

  // Store attacks array for ranged/magic attacks
  this.attacks = data.attacks || [];
  this.specialAttacks = this.attacks.filter(a => a.name !== 'melee');

  // Per-attack cooldown tracking (index → frame when cooldown expires)
  this.__specialAttackCooldowns = new Map();

  // Find the smallest interval among all attacks for locking (default 2000ms)
  this.__specialAttackMinInterval = 2000;
  for (const attack of this.specialAttacks) {
    const atkInterval = attack.interval || 2000;
    if (atkInterval < this.__specialAttackMinInterval) {
      this.__specialAttackMinInterval = atkInterval;
    }
  }

  // If monster has special attacks, add the special attack action
  if (this.specialAttacks.length > 0) {
    this.__boundSpecialAttackHandler = this.handleSpecialAttacks.bind(this);
    this.behaviourHandler.actions.add(this.__boundSpecialAttackHandler);
  }

  // Defense spells (healing, speed buffs) - completely ignored previously
  this.defenseSpells = data.defenseSpells || [];
  this.__defenseSpellCooldowns = new Map();

  // Find the smallest interval among defense spells
  this.__defenseSpellMinInterval = 2000;
  for (const spell of this.defenseSpells) {
    const spellInterval = spell.interval || 2000;
    if (spellInterval < this.__defenseSpellMinInterval) {
      this.__defenseSpellMinInterval = spellInterval;
    }
  }

  // If monster has defense spells, add the defense spell action
  if (this.defenseSpells.length > 0) {
    this.__boundDefenseSpellHandler = this.handleDefenseSpells.bind(this);
    this.behaviourHandler.actions.add(this.__boundDefenseSpellHandler);
  }

  // Load spells from data if provided (legacy format)
  if (data.spells && Array.isArray(data.spells)) {
    this.__addSpells(data.spells);
  }

  // Process summons (monsters that can summon other monsters, like Slime)
  if (data.summons && Array.isArray(data.summons) && data.summons.length > 0) {
    this.summons = data.summons;
    this.__boundSummonHandler = this.handleSummons.bind(this);
    this.behaviourHandler.actions.add(this.__boundSummonHandler);
  }

}

Monster.prototype = Object.create(Creature.prototype);
Monster.prototype.constructor = Monster;

Monster.prototype.setTarget = function (target) {

  /*
   * Function Monster.setTarget
   * Sets the target of the monster
   */

  // Delegate
  this.behaviourHandler.setTarget(target);

}

Monster.prototype.cleanup = function () {

  /*
   * Function Monster.cleanup
   * Call to clean up references from the monster so it can be garbage collected
   */

  this.setTarget(null);
  this.summonedCreatures = [];

}

Monster.prototype.isTileOccupied = function (tile) {

  /*
   * Function Monster.isTileOccupied
   * Function evaluated for a tile whether it is occupied for the monster or not
   */

  if (tile === null) {
    return true;
  }

  // Tiles that block solid can never be walked on
  if (tile.isBlockSolid()) {
    return true;
  }

  // Protection zones block monster movement (refresh zones only block combat, not walking)
  if (tile.isProtectionZone()) {
    return true;
  }

  // Cannot walk on no-logout zones
  if (tile.isNoLogoutZone()) {
    return true;
  }

  // The tile items contain a block solid (e.g., a wall)
  if (tile.itemStack && tile.itemStack.isBlockSolid(this.behaviourHandler.openDoors)) {
    return true;
  }

  // Block stairs, ladders, and teleporters — monsters stay on their own floor
  if (tile.hasDestination()) {
    return true;
  }

  // Block visual elevation items (ramps, archways, buttresses) — monsters shouldn't walk on structural decor
  if (tile.itemStack && tile.itemStack.hasHeightItem()) {
    return true;
  }

  // Avoid damaging field items (fire, energy, poison) unless immune
  if (tile.itemStack && tile.itemStack.hasDamagingField(this)) {
    return true;
  }

  // Get monster flags for movement behaviour
  let flags = null;
  let proto = this.getPrototype();
  if (proto) {
    flags = proto.flags;
  }

  // Cannot pass through characters (unless canPushCreatures is true and the creature is actually pushable)
  if (tile.isOccupiedCharacters()) {
    if (flags && flags.canPushCreatures === true) {
      // Check if ALL existing creatures on the tile can actually be pushed
      let allPushable = true;
      for (let existing of tile.creatures) {
        if (typeof existing.getPrototype === 'function') {
          let existingProto = existing.getPrototype();
          if (existingProto && existingProto.flags) {
            if (existingProto.flags.pushable !== true) {
              allPushable = false;
              break;
            }
            // If existing also has canPushCreatures, compare HP — stronger pushes weaker
            if (existingProto.flags.canPushCreatures === true) {
              let thisMaxHp = this.getProperty(CONST.PROPERTIES.HEALTH_MAX);
              let existingMaxHp = existing.getProperty(CONST.PROPERTIES.HEALTH_MAX);
              if (thisMaxHp <= existingMaxHp) {
                allPushable = false;
                break;
              }
            }
          } else if (existing.isPlayer && existing.isPlayer()) {
            // Players without prototypes: check if they have an active shop
            let shopManager = gameServer && gameServer.shopManager;
            if (shopManager && shopManager.getShop(existing.getId())) {
              allPushable = false;
              break;
            }
          } else {
            allPushable = false;
            break;
          }
        } else {
          allPushable = false;
          break;
        }
      }
      if (!allPushable) {
        return true;
      }
    } else {
      return true;
    }
  }

  // Allow stepping up to 1 height level per move (stairs-like behavior up to 4)
  let currentTile = gameServer.world.getTileFromWorldPosition(this.position);
  let heightDiff = tile.countHeight() - (currentTile ? currentTile.countHeight() : 0);
  if (heightDiff > 1) {
    return true;
  }

  // Item stack trap: monsters avoid tiles with many movable items
  if (tile.hasItems()) {
    let movableCount = tile.itemStack.__items.filter(
      i => !i.hasHeight() && i.isMoveable()
    ).length;
    if (movableCount >= CONST.TRAP.BLOCK_SOFT) {
      if (flags && flags.canPushItems === true) {
        // Monster can walk over items
      } else {
        return true;
      }
    }
  }

  return false;

}

Monster.prototype.createCorpse = function () {

  /*
   * Function Monster.createCorpse
   * Returns the corpse of a particular creature
   */

  let monsterName = this.getProperty(CONST.PROPERTIES.NAME) || "creature";

  // Distribute the experience
  this.damageMap.distributeExperience();

  // Monsters with noCorpse flag don't leave a corpse (e.g. Slime leaves poison field instead)
  if (this.flags && this.flags.noCorpse) {
    return null;
  }

  // Create a new corpse based on the monster type
  let thing = gameServer.database.createThing(this.corpse);

  // Add loot to the corpse and schedule a decay event
  if (thing instanceof Corpse) {
    this.lootHandler.addLoot(thing);

    // Build loot message and send to all attackers
    let lootItems = thing.getSlots().filter(item => item !== null);
    let lootText = "";

    if (lootItems.length === 0) {
      lootText = "nothing";
    } else {
      lootText = lootItems.map(item => {
        if (item.isStackable() && item.getCount() > 1) {
          return item.getCount() + " " + item.getName();
        }
        return item.getArticle() + " " + item.getName();
      }).join(", ");
    }

    // Loot message removed
  }

  // Add the experience
  return thing;

}

Monster.prototype.getPrototype = function () {

  /*
   * Function Monster.getPrototype
   * Returns the prototype definition of a monster from its monster identifier
   */

  return gameServer.database.getMonster(this.cid);

}

Monster.prototype.getTarget = function () {

  /*
   * Function Creature.getTarget
   * Returns the target of a creature
   */

  return this.behaviourHandler.getTarget();

}

Monster.prototype.push = function (position) {

  /*
   * Function Monster.push
   * Cooldown function that handles the creature movement
   */

  // Cannot push when the creature is moving
  if (this.isMoving()) {
    return;
  }

  if (!position.besides(this.position)) {
    return;
  }

  let tile = process.gameServer.world.getTileFromWorldPosition(position);

  if (tile === null || tile.id === 0) {
    return;
  }

  let lockDuration = this.getStepDuration(tile.getFriction());

  // Determine the slowness
  let slowness = this.position.isDiagonal(position) ? 2 * lockDuration : lockDuration;

  // Delegate to move the creature to the new tile position
  gameServer.world.moveCreature(this, position);

  // Lock this function for a number of frames
  this.behaviourHandler.actions.lock(this.handleActionMove, slowness);

}

Monster.prototype.hasTarget = function () {

  /*
   * Function Monster.hasTarget
   * Returns true if the monster has a target
   */

  return this.behaviourHandler.hasTarget();

}

Monster.prototype.think = function () {

  /*
   * Function Monster.think
   * Function called when an creature should think
   */

  this.__updateBlockCount();

  // If the monster is standing in a protection zone or no-logout zone, evict it to its spawn
  let currentTile = gameServer.world.getTileFromWorldPosition(this.position);
  if (currentTile !== null && (currentTile.isProtectionZone() || currentTile.isNoLogoutZone())) {
    this.behaviourHandler.setTarget(null);
    if (this.spawnPosition) {
      let spawnTile = gameServer.world.getTileFromWorldPosition(this.spawnPosition);
      let isSpawnOk = spawnTile !== null && spawnTile.id !== 0 && !spawnTile.isProtectionZone() && !spawnTile.isNoLogoutZone();
      if (isSpawnOk) {
        gameServer.world.creatureHandler.teleportCreature(this, this.spawnPosition);
        return;
      }
      let tile = gameServer.world.findAvailableTile(this, this.spawnPosition);
      if (tile !== null) {
        gameServer.world.creatureHandler.teleportCreature(this, tile.position);
        return;
      }
    }
    // No valid tile found (or no spawn position) — continue thinking so the monster isn't frozen
  }

  // Delegates to handling all the available actions
  this.behaviourHandler.actions.handleActions(this.behaviourHandler);

}

Monster.prototype.handleSpellAction = function () {

  /*
   * Function Monster.handleSpellAction
   * Handles monster cast spell events
   */

  // Must have a target before casting any spells
  if (!this.behaviourHandler.hasTarget()) {
    return;
  }

  // Always lock the global spell cooldown
  this.lockAction(this.handleSpellAction, 1000);

  // Can not shoot at the target (line of sight blocked)
  if (!this.isInLineOfSight(this.behaviourHandler.target)) {
    return;
  }

  // Go over all the available spells in the spellbook
  this.spellActions.forEach(function (spell) {

    // This means there is a failure to cast the spell
    if (Math.random() > spell.chance) {
      return;
    }

    // Get the spell callback from the database and apply it
    let cast = gameServer.database.getSpell(spell.id);

    // If casting was succesful lock it with the specified cooldown
    if (cast.call(this, spell)) {
      this.spellActions.lock(spell, spell.cooldown);
    }

  }, this);

}

Monster.prototype.isDistanceWeaponEquipped = function () {

  /*
   * Function Monster.isDistanceWeaponEquipped
   * Returns true if the monster has a distance weapon equipped
   */

  return false;

}

Monster.prototype.decreaseHealth = function (source, amount) {

  /*
   * Function Monster.decreaseHealth
   * Fired when the monster loses health
   */

  // Clamp
  amount = amount.clamp(0, this.getProperty(CONST.PROPERTIES.HEALTH));

  // Record the attack in the damage map
  this.damageMap.update(source, amount);

  // Track activity for party shared experience
  if (source && source.isPlayer && source.isPlayer()) {
    source.lastActivityTime = Date.now();
  }

  // Damage breaks invisibility
  const Condition = requireModule("combat/condition");
  if (this.hasCondition(Condition.prototype.INVISIBLE)) {
    this.removeCondition(Condition.prototype.INVISIBLE);
  }

  // Change the property
  this.incrementProperty(CONST.PROPERTIES.HEALTH, -amount);

  // Inform behaviour handler of the damage event
  this.behaviourHandler.handleDamage(source);
  this.broadcast(new EmotePacket(this, String(amount), this.fluidType));

  // Send combat message to attacker: "A [monster name] loses [amount] hitpoints due to your attack."
  if (source && source.isPlayer && source.isPlayer() && amount > 0) {
    let monsterName = this.getProperty(CONST.PROPERTIES.NAME) || "creature";
    // Send to Default channel (console) - channel id 0, empty name for system message
    source.write(new ChannelWritePacket(
      CONST.CHANNEL.DEFAULT,
      "",
      "A " + monsterName.toLowerCase() + " loses " + amount + " hitpoints due to your attack.",
      CONST.COLOR.WHITE
    ));
  }

  // When zero health is reached the creature is dead
  if (this.isZeroHealth()) {
    return gameServer.world.creatureHandler.dieCreature(this);
  }

}

Monster.prototype.__addSpells = function (spells) {

  /*
   * Function Monster.__addSpells
   * Adds the spells to the spellbook
   */

  spells.forEach(spell => this.spellActions.add(spell));

}

Monster.prototype.handleSpecialAttacks = function () {

  /*
   * Function Monster.handleSpecialAttacks
   * Handles special attacks (fire, energy, lifedrain, etc) from the attacks array
   * Supports both targeted attacks (with shootEffect) and wave attacks (with length+spread)
   * Respects per-attack interval and chance from the JSON definition
   * Handles different attack types: lifedrain heals monster, manadrain drains mana, speed slows target
   */

  const currentFrame = gameServer.gameLoop.getCurrentFrame();

  // Must have a target before casting any special attacks
  if (!this.behaviourHandler.hasTarget()) {
    let shortLock = Math.max(1, Math.floor(500 / CONFIG.SERVER.MS_TICK_INTERVAL));
    this.behaviourHandler.actions.lock(this.__boundSpecialAttackHandler, shortLock);
    return;
  }

  const target = this.behaviourHandler.getTarget();
  const Geometry = requireModule("utils/geometry");

  // Check line of sight
  if (!this.isInLineOfSight(target)) {
    let shortLock = Math.max(1, Math.floor(500 / CONFIG.SERVER.MS_TICK_INTERVAL));
    this.__specialAttackCooldowns.forEach((_, i) => {
      this.__specialAttackCooldowns.set(i, currentFrame + shortLock);
    });
    this.behaviourHandler.actions.lock(this.__boundSpecialAttackHandler, shortLock);
    return;
  }

  // Target is in a protection zone — drop target, do not attack
  if (target.isInProtectionZone()) {
    this.behaviourHandler.setTarget(null);
    let shortLock = Math.max(1, Math.floor(500 / CONFIG.SERVER.MS_TICK_INTERVAL));
    this.__specialAttackCooldowns.forEach((_, i) => {
      this.__specialAttackCooldowns.set(i, currentFrame + shortLock);
    });
    this.behaviourHandler.actions.lock(this.__boundSpecialAttackHandler, shortLock);
    return;
  }

  // Check distance to target
  const distanceToTarget = this.position.manhattanDistance(target.position);

  // Go through each special attack and try to cast it
  for (let i = 0; i < this.specialAttacks.length; i++) {
    const attack = this.specialAttacks[i];

    // Check per-attack cooldown based on interval
    let cooldownUntil = this.__specialAttackCooldowns.get(i) || 0;
    if (currentFrame < cooldownUntil) {
      continue;
    }

    // Check chance
    if (Math.random() > attack.chance) {
      continue;
    }

    // Calculate damage
    const damage = Number.prototype.random(attack.min, attack.max);
    const effectType = attack.areaEffect ? this.__getMagicEffect(attack.areaEffect) : null;

    // Face the target before firing any special attack
    this.faceCreature(target);

    // Check if this is a wave attack (has length and spread)
    if (attack.length && attack.spread) {
      const direction = this.getProperty(CONST.PROPERTIES.DIRECTION);
      const wavePositions = Geometry.prototype.getWave(this.position, direction, attack.length, attack.spread);

      for (const pos of wavePositions) {
        if (effectType !== null) {
          gameServer.world.sendMagicEffect(pos, effectType);
        }

        const tile = gameServer.world.getTileFromWorldPosition(pos);
        if (tile === null || !tile.creatures) {
          continue;
        }

        for (const creature of tile.creatures) {
          if (creature !== this && (damage > 0 || attack.name === 'poison' || attack.name === 'invisible')) {
            this.__applyAttackEffect(attack, creature, damage);
          }
        }
      }

      let intervalFrames = Math.max(1, Math.floor((attack.interval || 2000) / CONFIG.SERVER.MS_TICK_INTERVAL));
      this.__specialAttackCooldowns.set(i, currentFrame + intervalFrames);

      let lockFrames = Math.max(1, Math.floor((this.__specialAttackMinInterval || 2000) / CONFIG.SERVER.MS_TICK_INTERVAL));
      this.behaviourHandler.actions.lock(this.__boundSpecialAttackHandler, lockFrames);

      return;
    }

    // Regular targeted or area attack
    const range = attack.range || 7;
    if (distanceToTarget > range) {
      let shortCooldown = Math.max(1, Math.floor(500 / CONFIG.SERVER.MS_TICK_INTERVAL));
      this.__specialAttackCooldowns.set(i, currentFrame + shortCooldown);
      continue;
    }

    // Send projectile effect if shootEffect is specified
    if (attack.shootEffect) {
      const shootType = this.__getShootEffect(attack.shootEffect);
      if (shootType !== null) {
        gameServer.world.sendDistanceEffect(this.position, target.position, shootType);
      }
    }

    // Apply attack effects based on type
    if (attack.radius) {
      this.__applyRadiusAttack(attack, target, damage, effectType);
    } else {
      // Single target attack
      if (effectType !== null) {
        gameServer.world.sendMagicEffect(target.position, effectType);
      }
      if (damage > 0 || attack.name === 'manadrain' || attack.name === 'speed' || attack.name === 'poison' || attack.name === 'invisible') {
        this.__applyAttackEffect(attack, target, damage);
      }
    }

    // Set per-attack cooldown based on interval
    let intervalFrames = Math.max(1, Math.floor((attack.interval || 2000) / CONFIG.SERVER.MS_TICK_INTERVAL));
    this.__specialAttackCooldowns.set(i, currentFrame + intervalFrames);

    // Lock the handler so it doesn't fire again until the minimum interval
    let lockFrames = Math.max(1, Math.floor((this.__specialAttackMinInterval || 2000) / CONFIG.SERVER.MS_TICK_INTERVAL));
    this.behaviourHandler.actions.lock(this.__boundSpecialAttackHandler, lockFrames);

    return;
  }

  // No attack fired this tick - lock for min interval
  let lockFrames = Math.max(1, Math.floor((this.__specialAttackMinInterval || 2000) / CONFIG.SERVER.MS_TICK_INTERVAL));
  this.behaviourHandler.actions.lock(this.__boundSpecialAttackHandler, lockFrames);

}

Monster.prototype.__getCombatTypeFromName = function (name) {
  var map = {
    "melee": CombatFormulas.COMBAT_TYPES.PHYSICAL,
    "physical": CombatFormulas.COMBAT_TYPES.PHYSICAL,
    "fire": CombatFormulas.COMBAT_TYPES.FIRE,
    "energy": CombatFormulas.COMBAT_TYPES.ENERGY,
    "ice": CombatFormulas.COMBAT_TYPES.COLD,
    "cold": CombatFormulas.COMBAT_TYPES.COLD,
    "earth": CombatFormulas.COMBAT_TYPES.EARTH,
    "holy": CombatFormulas.COMBAT_TYPES.HOLY,
    "lifedrain": CombatFormulas.COMBAT_TYPES.LIFEDRAIN,
    "manadrain": CombatFormulas.COMBAT_TYPES.MANADRAIN,
    "drown": CombatFormulas.COMBAT_TYPES.DROWN,
    "undefined": CombatFormulas.COMBAT_TYPES.UNDEFINED
  };
  return map[name] || CombatFormulas.COMBAT_TYPES.PHYSICAL;
};

Monster.prototype.__applyAttackEffect = function (attack, target, damage) {

  /*
   * Function Monster.__applyAttackEffect
   * Applies attack effect based on attack name (lifedrain, manadrain, etc)
   * Routes damage through the unified combat pipeline
   */

  // Never deal damage to creatures in protection zones
  if (target.isInProtectionZone && target.isInProtectionZone()) {
    return;
  }

  var combatHandler = gameServer.world.combatHandler;

  switch (attack.name) {
    case 'lifedrain':
      // Deal damage AND heal monster for same amount
      if (damage > 0) {
        var result = CombatFormulas.combatBlockHit(-damage, target, CombatFormulas.COMBAT_TYPES.LIFEDRAIN, {
          checkDefense: false,
          checkArmor: false,
          ignoreResistances: false
        });
        if (result.finalDamage !== 0) {
          combatHandler.combatChangeHealth(this, target, {
            finalDamage: result.finalDamage,
            combatType: CombatFormulas.COMBAT_TYPES.LIFEDRAIN,
            blockType: result.blockType
          });
          this.increaseHealth(Math.abs(result.finalDamage));
        }
      }
      break;

    case 'manadrain':
      // Drain target's mana
      if (target.isPlayer && target.isPlayer()) {
        var currentMana = target.getProperty(CONST.PROPERTIES.MANA);
        var manaDrained = Math.min(damage, currentMana);
        target.incrementProperty(CONST.PROPERTIES.MANA, -manaDrained);
      } else {
        if (damage > 0) {
          combatHandler.applyEnvironmentalDamage(target, damage, CONST.COLOR.ORANGE);
        }
      }
      break;

    case 'speed':
      // Slow target's speed (debuff in attacks array has negative speedChange)
      if (attack.speedChange) {
        if (target.isPlayer && target.isPlayer()) {
          // For players: apply PARALYZE condition instead of direct property set
          var Condition = requireModule("combat/condition");
          var ticks = attack.duration > 0 ? Math.max(1, Math.floor(attack.duration / CONFIG.SERVER.MS_TICK_INTERVAL)) : 20;
          target.addCondition(Condition.prototype.PARALYZE, ticks, CONFIG.SERVER.MS_TICK_INTERVAL);
          if (target.sendCancelMessage) target.sendCancelMessage("You are paralyzed!");
        } else {
          // For monsters: direct speed property modification works
          var currentSpeed = target.getProperty(CONST.PROPERTIES.SPEED);
          var newSpeed = currentSpeed + attack.speedChange;
          target.setProperty(CONST.PROPERTIES.SPEED, Math.max(0, newSpeed));
          if (attack.duration && attack.duration > 0) {
            var revertFrames = Math.max(1, Math.floor(attack.duration / CONFIG.SERVER.MS_TICK_INTERVAL));
            gameServer.world.eventQueue.addEvent(function () {
              target.setProperty(CONST.PROPERTIES.SPEED, currentSpeed);
            }, revertFrames);
          }
        }
      }
      break;

    case 'poison':
      // Poison the target (applies POISONED condition for damage over time)
      if (target.isPlayer && target.isPlayer()) {
        var Condition = requireModule("combat/condition");
        target.addCondition(Condition.prototype.POISONED, attack.ticks || 10, attack.tickDuration || 2000, { initialDamage: attack.initialDamage });
      }
      break;

    case 'firefield':
      // Fire field attacks create a fire field item on the target tile
      if (target && target.position) {
        var tile = gameServer.world.getTileFromWorldPosition(target.position);
        if (tile) {
          tile.addTopThing(gameServer.database.createThing(1487));
          gameServer.world.sendMagicEffect(target.position, CONST.EFFECT.MAGIC.HITBYFIRE);
        }
      }
      break;

    case 'invisible':
      // Make the target invisible
      if (target.isPlayer && target.isPlayer()) {
        var Condition = requireModule("combat/condition");
        var InvisibilityDefinition = gameServer.database.getConditionDefinition(Condition.prototype.INVISIBLE);
        if (InvisibilityDefinition) {
          target.addCondition(new Condition(
            Condition.prototype.INVISIBLE,
            InvisibilityDefinition.ticks,
            InvisibilityDefinition.tickDuration
          ));
        }
      }
      break;

    default:
      // Standard damage attack (fire, energy, ice, earth, etc.) — route through pipeline
      if (damage > 0) {
        var combatType = this.__getCombatTypeFromName(attack.name);
        var isPhysical = (combatType === CombatFormulas.COMBAT_TYPES.PHYSICAL);
        var blockResult = CombatFormulas.combatBlockHit(-damage, target, combatType, {
          checkDefense: isPhysical,
          checkArmor: isPhysical,
          ignoreResistances: false
        });
        if (blockResult.finalDamage !== 0) {
          combatHandler.combatChangeHealth(this, target, {
            finalDamage: blockResult.finalDamage,
            combatType: combatType,
            blockType: blockResult.blockType
          });
        }
      }
      break;
  }

}

Monster.prototype.__applyRadiusAttack = function (attack, target, damage, effectType) {

  /*
   * Function Monster.__applyRadiusAttack
   * Applies area-of-effect damage around the target position
   * firefield attacks create fire field items on each tile in radius
   */

  const radius = attack.radius;
  const targetPos = target.position;

  // Show area effect at center
  if (effectType !== null) {
    gameServer.world.sendMagicEffect(targetPos, effectType);
  }

  // Handle firefield: create fire field items on every tile in radius
  if (attack.name === 'firefield') {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        let pos = targetPos.addVector(dx, dy, 0);
        if (pos === null) continue;

        let tile = gameServer.world.getTileFromWorldPosition(pos);
        if (tile === null) continue;

        tile.addTopThing(gameServer.database.createThing(1487));
      }
    }
    gameServer.world.sendMagicEffect(targetPos, CONST.EFFECT.MAGIC.HITBYFIRE);
    return;
  }

  // Handle poisonfield: create poison field items on every tile in radius
  if (attack.name === 'poisonfield') {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        let pos = targetPos.addVector(dx, dy, 0);
        if (pos === null) continue;

        let tile = gameServer.world.getTileFromWorldPosition(pos);
        if (tile === null) continue;

        tile.addTopThing(gameServer.database.createThing(1496));
      }
    }
    gameServer.world.sendMagicEffect(targetPos, CONST.EFFECT.MAGIC.GREEN_RINGS);
    return;
  }

  // Damage the main target
  if (damage > 0 || attack.name === 'manadrain') {
    this.__applyAttackEffect(attack, target, damage);
  }

  // Damage all other creatures within radius
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (dx === 0 && dy === 0) continue;

      let pos = targetPos.addVector(dx, dy, 0);
      if (pos === null) continue;

      let tile = gameServer.world.getTileFromWorldPosition(pos);
      if (tile === null || !tile.creatures) continue;

      for (const creature of tile.creatures) {
        if (creature !== this && creature !== target && damage > 0) {
          this.__applyAttackEffect(attack, creature, damage);
        }
      }
    }
  }
}

Monster.prototype.handleDefenseSpells = function () {

  /*
   * Function Monster.handleDefenseSpells
   * Handles defense spells (healing, speed buffs) from the defenseSpells array
   * Respects per-spell interval and chance from the JSON definition
   */

  if (!this.hasTarget()) {
    // Without a target, only healing spells are permitted
    this.__handleHealingOnly();
    return;
  }

  const currentFrame = gameServer.gameLoop.getCurrentFrame();

  for (let i = 0; i < this.defenseSpells.length; i++) {
    const spell = this.defenseSpells[i];

    // Check per-spell cooldown based on interval
    let cooldownUntil = this.__defenseSpellCooldowns.get(i) || 0;
    if (currentFrame < cooldownUntil) {
      continue;
    }

    // Check chance
    if (Math.random() > spell.chance) {
      continue;
    }

    // Handle based on spell name
    switch (spell.name) {
      case 'healing': {
        // Only heal if not at full health
        if (this.isFull(CONST.PROPERTIES.HEALTH)) {
          continue;
        }

        const healAmount = Number.prototype.random(spell.min, spell.max);
        this.increaseHealth(healAmount);

        // Show effect
        if (spell.areaEffect) {
          const effectType = this.__getMagicEffect(spell.areaEffect);
          if (effectType !== null) {
            gameServer.world.sendMagicEffect(this.position, effectType);
          }
        }

        break;
      }

      case 'speed': {
        // Apply speed buff to self (50% increase per original Tibia formula)
        if (spell.speedChange) {
          let currentSpeed = this.getProperty(CONST.PROPERTIES.SPEED);
          let newSpeed = Math.floor(currentSpeed * 1.5);
          this.setProperty(CONST.PROPERTIES.SPEED, Math.max(0, newSpeed));

          // Schedule speed revert after duration
          if (spell.duration) {
            const revertSpeed = currentSpeed;
            let revertFrames = Math.max(1, Math.floor(spell.duration / CONFIG.SERVER.MS_TICK_INTERVAL));
            gameServer.world.eventQueue.addEvent(function () {
              this.setProperty(CONST.PROPERTIES.SPEED, revertSpeed);
            }.bind(this), revertFrames);
          }

          // Show effect
          if (spell.areaEffect) {
            const effectType = this.__getMagicEffect(spell.areaEffect);
            if (effectType !== null) {
              gameServer.world.sendMagicEffect(this.position, effectType);
            }
          }
        }

        break;
      }
    }

    // Set per-spell cooldown based on interval
    let intervalFrames = Math.max(1, Math.floor((spell.interval || 2000) / CONFIG.SERVER.MS_TICK_INTERVAL));
    this.__defenseSpellCooldowns.set(i, currentFrame + intervalFrames);

    // Lock the handler so it doesn't fire again until the minimum interval
    let lockFrames = Math.max(1, Math.floor((this.__defenseSpellMinInterval || 2000) / CONFIG.SERVER.MS_TICK_INTERVAL));
    this.behaviourHandler.actions.lock(this.__boundDefenseSpellHandler, lockFrames);

    return;
  }

  // No spell fired this tick - lock for min interval
  let lockFrames = Math.max(1, Math.floor((this.__defenseSpellMinInterval || 2000) / CONFIG.SERVER.MS_TICK_INTERVAL));
  this.behaviourHandler.actions.lock(this.__boundDefenseSpellHandler, lockFrames);

}

Monster.prototype.__getShootEffect = function (effectName) {
  /*
   * Maps shoot effect names to CONST projectile IDs (Tibia 7.4 compatible)
   */
  const effectMap = {
    'spear': CONST.EFFECT.PROJECTILE.SPEAR,
    'bolt': CONST.EFFECT.PROJECTILE.BOLT,
    'arrow': CONST.EFFECT.PROJECTILE.ARROW,
    'fire': CONST.EFFECT.PROJECTILE.FIRE,
    'energy': CONST.EFFECT.PROJECTILE.ENERGY,
    'poisonarrow': CONST.EFFECT.PROJECTILE.POISONARROW,
    'burstarrow': CONST.EFFECT.PROJECTILE.BURSTARROW,
    'throwingstar': CONST.EFFECT.PROJECTILE.THROWINGSTAR,
    'throwingknife': CONST.EFFECT.PROJECTILE.THROWINGKNIFE,
    'smallstone': CONST.EFFECT.PROJECTILE.SMALLSTONE,
    'death': CONST.EFFECT.PROJECTILE.DEATH,
    'largerock': CONST.EFFECT.PROJECTILE.LARGEROCK,
    'snowball': CONST.EFFECT.PROJECTILE.SNOWBALL,
    'powerbolt': CONST.EFFECT.PROJECTILE.POWERBOLT,
    'poison': CONST.EFFECT.PROJECTILE.POISON
  };
  return effectMap[effectName.toLowerCase()] || null;
}

Monster.prototype.__getMagicEffect = function (effectName) {
  /*
   * Maps area effect names to CONST values
   */
  const effectMap = {
    'firearea': CONST.EFFECT.MAGIC.HITBYFIRE,
    'energyarea': CONST.EFFECT.MAGIC.ENERGY_AREA,
    'icearea': CONST.EFFECT.MAGIC.ICE_AREA,
    'eartharea': CONST.EFFECT.MAGIC.EARTH_AREA,
    'blueshimmer': CONST.EFFECT.MAGIC.MAGIC_BLUE,
    'redshimmer': CONST.EFFECT.MAGIC.MAGIC_RED,
    'greenshimmer': CONST.EFFECT.MAGIC.MAGIC_GREEN,
    'mortarea': CONST.EFFECT.MAGIC.DEATH_AREA,
    'holyarea': CONST.EFFECT.MAGIC.HOLY_AREA
  };
  return effectMap[effectName.toLowerCase()] || null;
}

Monster.prototype.__handleHealingOnly = function () {

  if (this.defenseSpells.length === 0) return;

  const currentFrame = gameServer.gameLoop.getCurrentFrame();

  for (let i = 0; i < this.defenseSpells.length; i++) {
    const spell = this.defenseSpells[i];
    if (spell.name !== 'healing') continue;

    let cooldownUntil = this.__defenseSpellCooldowns.get(i) || 0;
    if (currentFrame < cooldownUntil) continue;
    if (Math.random() > spell.chance) continue;

    const healAmount = Number.prototype.random(spell.min, spell.max);
    this.increaseHealth(healAmount);

    if (spell.areaEffect) {
      const effectType = this.__getMagicEffect(spell.areaEffect);
      if (effectType !== null) {
        gameServer.world.sendMagicEffect(this.position, effectType);
      }
    }

    let intervalFrames = Math.max(1, Math.floor((spell.interval || 2000) / CONFIG.SERVER.MS_TICK_INTERVAL));
    this.__defenseSpellCooldowns.set(i, currentFrame + intervalFrames);
    let lockFrames = Math.max(1, Math.floor((this.__defenseSpellMinInterval || 2000) / CONFIG.SERVER.MS_TICK_INTERVAL));
    this.behaviourHandler.actions.lock(this.__boundDefenseSpellHandler, lockFrames);
    return;
  }

  let lockFrames = Math.max(1, Math.floor((this.__defenseSpellMinInterval || 2000) / CONFIG.SERVER.MS_TICK_INTERVAL));
  this.behaviourHandler.actions.lock(this.__boundDefenseSpellHandler, lockFrames);

}

Monster.prototype.handleSummons = function () {

  /*
   * Function Monster.handleSummons
   * Handles summoning other creatures (e.g. Slime summoning Squidgy Slime)
   */

  if (!this.summons || this.summons.length === 0) {
    return;
  }

  const currentFrame = gameServer.gameLoop.getCurrentFrame();

  for (const summon of this.summons) {
    // Check max summons limit
    if (this.summonedCreatures.length >= (summon.maxSummons || 1)) {
      continue;
    }

    // Check chance
    if (Math.random() > (summon.chance || 0.1)) {
      continue;
    }

    // Look up the monster to summon
    let monsterData = gameServer.database.getMonsterByName(summon.name);
    if (!monsterData) {
      continue;
    }

    // Find an available tile near the summoner
    let tile = gameServer.world.findAvailableTile(this, this.position);
    if (tile === null) {
      continue;
    }

    // Create the summoned monster
    let summoned = new Monster(monsterData.id, monsterData.data);
    summoned.master = this;

    // Add to world
    if (!gameServer.world.creatureHandler.addCreaturePosition(summoned, tile.position)) {
      continue;
    }

    // Track the summon
    this.summonedCreatures.push(summoned);

    // Effect
    gameServer.world.sendMagicEffect(tile.position, CONST.EFFECT.MAGIC.MAGIC_GREEN);
  }

  // Lock for the minimum interval among all summons
  let minInterval = 2000;
  for (const summon of this.summons) {
    if (summon.interval && summon.interval < minInterval) {
      minInterval = summon.interval;
    }
  }
  let lockFrames = Math.max(1, Math.floor(minInterval / CONFIG.SERVER.MS_TICK_INTERVAL));
  this.behaviourHandler.actions.lock(this.__boundSummonHandler, lockFrames);

};

Monster.prototype.removeSummonedCreature = function (creature) {

  /*
   * Function Monster.removeSummonedCreature
   * Removes a creature from the summoned creatures tracking array
   */

  let idx = this.summonedCreatures.indexOf(creature);
  if (idx !== -1) {
    this.summonedCreatures.splice(idx, 1);
  }

};

module.exports = Monster;
