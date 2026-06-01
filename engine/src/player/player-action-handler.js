"use strict";

const Actions = requireModule("utils/actions");
const TargetHandler = requireModule("combat/target-handler");
const Condition = requireModule("combat/condition");
const Pathfinder = requireModule("utils/pathfinder");

const ActionHandler = function (player) {

  /*
   * Class ActionHandler
   * Wrapper for player action handlers
   */

  this.__player = player;

  this.actions = new Actions();
  this.targetHandler = new TargetHandler(player);

  // Add the available player actions that are checked every server tick
  this.actions.add(this.handleActionAttack);
  this.actions.add(this.handleActionRegeneration);
  this.actions.add(this.handleActionChase);
  this.actions.add(this.handleActionShieldTraining);

  // Anti-cheat: action timing pattern detection
  this.__actionTimestamps = [];
  this.__actionPatternViolations = 0;

}

ActionHandler.prototype.REGENERATION_DURATION = 100;
ActionHandler.prototype.SHIELD_TRAINING_COOLDOWN = Math.floor(1800 / CONFIG.SERVER.MS_TICK_INTERVAL);

ActionHandler.prototype.cleanup = function () {

  /*
   * Function ActionHandler.prototype.cleanup
   * Delegates to the actions to clean up remaining actions
   */

  this.actions.cleanup();

}

ActionHandler.prototype.handleActionAttack = function () {

  /*
   * Function Player.handleActionAttack
   * Handles attack action 
   * Always locks on early returns (GLOBAL_COOLDOWN = 1000ms) to prevent
   * the action firing every tick when conditions aren't met.
   */

  // No target
  if (!this.targetHandler.hasTarget()) {
    return this.actions.lock(this.handleActionAttack, Actions.prototype.GLOBAL_COOLDOWN);
  }

  // Prevent attack if dead
  if (this.__player.isDead) {
    return this.actions.lock(this.handleActionAttack, Actions.prototype.GLOBAL_COOLDOWN);
  }

  // PvP check: prevent attacking a player in protection zone or from protection zone
  let target = this.targetHandler.getTarget();
  if (target && target.isPlayer && target.isPlayer()) {
    let skullManager = gameServer.world.skullManager;
    if (!skullManager.canAttack(this.__player, target)) {
      this.__player.sendCancelMessage("You may not attack this player.");
      return this.actions.lock(this.handleActionAttack, Actions.prototype.GLOBAL_COOLDOWN);
    }
    if (this.__player.isInProtectionZone()) {
      this.__player.sendCancelMessage("You may not attack a person while in a protection zone.");
      return this.actions.lock(this.handleActionAttack, Actions.prototype.GLOBAL_COOLDOWN);
    }
    if (target.isInProtectionZone()) {
      this.__player.sendCancelMessage("You may not attack a person while in a protection zone.");
      return this.actions.lock(this.handleActionAttack, Actions.prototype.GLOBAL_COOLDOWN);
    }
  }

  // Drop the target if it is dead
  if (!gameServer.world.creatureHandler.isCreatureActive(this.targetHandler.getTarget())) {
    this.targetHandler.setTarget(null);
    return this.actions.lock(this.handleActionAttack, Actions.prototype.GLOBAL_COOLDOWN);
  }

  // Validate range: must be besides target or within weapon range
  if (!this.targetHandler.isBesidesTarget()) {
    if (!this.__player.isDistanceWeaponEquipped()) {
      return this.actions.lock(this.handleActionAttack, Actions.prototype.GLOBAL_COOLDOWN);
    }
    let attackRange = this.__player.getRange();
    if (!this.__player.position.isWithinRangeOf(this.targetHandler.getTarget().position, attackRange)) {
      return this.actions.lock(this.handleActionAttack, Actions.prototype.GLOBAL_COOLDOWN);
    }
  }

  // Confirm player can see the creature for distance (or normal) fighting
  if (!this.__player.isInLineOfSight(this.targetHandler.getTarget())) {
    return this.actions.lock(this.handleActionAttack, Actions.prototype.GLOBAL_COOLDOWN);
  }

  this.__player.combatLock.activate();

  // Record last attack time for defense factor calculation
  this.__player.__lastAttackTime = Date.now();

  // Anti-cheat: detect suspiciously regular action intervals
  let now = Date.now();
  this.__actionTimestamps.push(now);
  if (this.__actionTimestamps.length > 20) {
    this.__actionTimestamps.shift();
  }
  if (this.__actionTimestamps.length >= 10) {
    let intervals = [];
    for (let i = 1; i < this.__actionTimestamps.length; i++) {
      intervals.push(this.__actionTimestamps[i] - this.__actionTimestamps[i - 1]);
    }
    let avg = intervals.reduce(function (a, b) { return a + b; }, 0) / intervals.length;
    let variance = intervals.reduce(function (sum, val) { return sum + (val - avg) * (val - avg); }, 0) / intervals.length;
    let stdDev = Math.sqrt(variance);
    if (stdDev < 10 && avg < 3000) {
      this.__actionPatternViolations++;
      if (this.__actionPatternViolations >= 3) {
        gameServer.world.antiCheatManager.flagSuspect(this.__player);
        this.__actionPatternViolations = 0;
        this.__actionTimestamps = [];
      }
    }
  }

  // Handle combat with the target
  gameServer.world.combatHandler.handleCombat(this.__player);

  // Lock the action for the attack speed of the player (36 frames = 1800ms)
  this.actions.lock(this.handleActionAttack, this.__player.getProperty(CONST.PROPERTIES.ATTACK_SPEED));

}

ActionHandler.prototype.getRegenInterval = function () {
  let vocation = this.__player.getProperty(CONST.PROPERTIES.VOCATION);
  switch (vocation) {
    case CONST.VOCATION.NONE: return { hp: 6000, mp: 6000 };
    case CONST.VOCATION.SORCERER:
    case CONST.VOCATION.DRUID: return { hp: 12000, mp: 6000 };
    case CONST.VOCATION.PALADIN: return { hp: 8000, mp: 8000 };
    case CONST.VOCATION.KNIGHT: return { hp: 6000, mp: 12000 };
    case CONST.VOCATION.MASTER_SORCERER:
    case CONST.VOCATION.ELDER_DRUID: return { hp: 10000, mp: 4000 };
    case CONST.VOCATION.ROYAL_PALADIN: return { hp: 6000, mp: 6000 };
    case CONST.VOCATION.ELITE_KNIGHT: return { hp: 4000, mp: 10000 };
    case CONST.VOCATION.ADMIN: return { hp: 1000, mp: 1000 };
    default: return { hp: 6000, mp: 6000 };
  }
};

ActionHandler.prototype.handleActionRegeneration = function () {
  let now = Date.now();
  if (!this.__lastHpRegen) this.__lastHpRegen = now;
  if (!this.__lastMpRegen) this.__lastMpRegen = now;

  let intervals = this.getRegenInterval();

  if (now - this.__lastHpRegen >= intervals.hp) {
    if (!this.__player.isFull(CONST.PROPERTIES.HEALTH)) {
      this.__player.increaseHealth(1);
    }
    this.__lastHpRegen = now;
  }

  if (now - this.__lastMpRegen >= intervals.mp) {
    if (!this.__player.isFull(CONST.PROPERTIES.MANA)) {
      this.__player.increaseMana(1);
    }
    this.__lastMpRegen = now;
  }

  this.actions.lock(this.handleActionRegeneration, Math.min(intervals.hp, intervals.mp) / 6 || 1000);
}

ActionHandler.prototype.handleActionShieldTraining = function () {
  this.actions.lock(this.handleActionShieldTraining, this.SHIELD_TRAINING_COOLDOWN);

  let target = this.targetHandler.getTarget();
  if (!target) return;

  let isTrainingDummy = target.flags && target.flags.trainer === true;
  if (!isTrainingDummy) return;

  let slots = [CONST.EQUIPMENT.LEFT, CONST.EQUIPMENT.RIGHT];
  let hasShield = false;
  for (let slot of slots) {
    let item = this.__player.containerManager.equipment.peekIndex(slot);
    if (item && item.id === 3141) {
      hasShield = true;
      break;
    }
  }
  if (!hasShield) return;

  this.__player.checkDefensiveSkillAdvance();
};

ActionHandler.prototype.CHASE_DURATION = 5;

ActionHandler.prototype.handleActionChase = function () {

  /*
   * Function Player.handleActionChase
   * Handles automatic chasing of target when chase mode is enabled
   */

  // Always lock to prevent spamming
  this.actions.lock(this.handleActionChase, this.CHASE_DURATION);

  // Only chase if chase mode is CHASE (1)
  if (this.__player.chaseMode !== CONST.CHASE_MODE.CHASE) {
    return;
  }

  // No target to chase
  if (!this.targetHandler.hasTarget()) {
    return;
  }

  // Prevent chase if dead
  if (this.__player.isDead) {
    return;
  }

  // Already moving, don't interrupt
  if (this.__player.movementHandler.isMoving()) {
    return;
  }

  // Already besides target, no need to chase
  if (this.targetHandler.isBesidesTarget()) {
    return;
  }

  // Check if the target is still valid
  let target = this.targetHandler.getTarget();
  if (!gameServer.world.creatureHandler.isCreatureActive(target)) {
    return;
  }

  // Use A* pathfinding to find path to target (stop at adjacent tile)
  let path = gameServer.world.findPath(
    this.__player,
    this.__player.getPosition(),
    target.getPosition(),
    Pathfinder.prototype.ADJACENT
  );

  // No path found
  if (path.length === 0) {
    return;
  }

  // Get the next tile to move to (last in path since path is reversed)
  let nextTile = path.pop();

  if (nextTile === null) {
    return;
  }

  // Calculate the direction to move
  let direction = this.__player.getPosition().getFacingDirection(nextTile.position);

  // Move the player in that direction
  this.__player.movementHandler.handleMovement(direction);

}

module.exports = ActionHandler;
