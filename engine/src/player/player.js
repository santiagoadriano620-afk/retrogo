"use strict";

const CombatFormulas = requireModule("combat/combat-formulas");
const Creature = requireModule("entities/creature");
const ContainerManager = requireModule("containers/container-manager");
const Friendlist = requireModule("utils/friendlist.js");
const Ignorelist = requireModule("utils/ignorelist.js");
const PacketReader = requireModule("network/packet-reader");
const Spellbook = requireModule("combat/spellbook");

const BANK_BALANCE_KEY = 50001;

const PlayerIdleHandler = requireModule("player/player-idle-handler");
const CharacterProperties = requireModule("player/player-properties");
const SocketHandler = requireModule("player/player-socket-handler");
const PlayerMovementHandler = requireModule("player/player-movement-handler");
const ChannelManager = requireModule("player/player-channel-manager");
const CombatLock = requireModule("player/player-combat-lock");
const PZLock = requireModule("player/player-pz-lock");
const ActionHandler = requireModule("player/player-action-handler");
const UseHandler = requireModule("player/player-use-handler");
const PlayerPartyHandler = requireModule("player/player-party-handler");
const Skills = requireModule("utils/skills");
const Position = requireModule("utils/position");

const { EmotePacket, CreatureStatePacket, ContainerOpenPacket, ContainerClosePacket, CancelMessagePacket, ServerMessagePacket, ChannelWritePacket, CreaturePropertyPacket } = requireModule("network/protocol");

const Player = function (data) {
  /*
   * Class Player
   * Wrapper for a playable character
   *
   * API:
   *
   * Player.isInCombat - Returns true if the player is or has recently been in combat
   *
   *
   */

  // Inherit from Creature class
  Creature.call(this, data.properties);

  // Death state
  this.isDead = false;

  this.templePosition = Position.prototype.fromLiteral(data.templePosition);

  // Add the player properties (sex, role, vocation, etc.)
  this.addPlayerProperties(data.properties);

  // The player skills and experience
  // IMPORTANT: Skills constructor calls setMaximumProperties() which sets HEALTH_MAX, MANA_MAX, CAPACITY_MAX
  this.skills = new Skills(this, data.skills);

  // Always restore HP/MANA on login (guarantees full heal on respawn)
  // This MUST be after Skills init so HEALTH_MAX is properly calculated from level/vocation
  let healthMax = this.getProperty(CONST.PROPERTIES.HEALTH_MAX);
  let manaMax = this.getProperty(CONST.PROPERTIES.MANA_MAX);
  this.setProperty(CONST.PROPERTIES.HEALTH, healthMax);
  this.setProperty(CONST.PROPERTIES.MANA, manaMax);

  // Force attack speed to 36 frames (1800ms) for all vocations on login
  this.setProperty(CONST.PROPERTIES.ATTACK_SPEED, 36);

  // Child classes with data for player handlers
  this.socketHandler = new SocketHandler(this);
  this.friendlist = new Friendlist(data.friends);
  this.ignorelist = new Ignorelist(data.ignored);
  this.containerManager = new ContainerManager(this, data.containers);
  this.spellbook = new Spellbook(this, data.spellbook);

  // Storage for quests/values
  this.storage = data.storage || {};

  // Check if we need to return shop items on login
  this.__checkMarketDataOnLogin();

  // Premium Shop points
  this.premiumPoints = data.premiumPoints || 0;
  this.premiumExpiry = data.premiumExpiry || 0;

  // Bed spawn position (set when player sleeps in a bed)
  this.__bedPosition = data.bedPosition ? Position.prototype.fromLiteral(data.bedPosition) : null;
  this.__bedDirection = data.bedDirection || null;

  // Update current capacity based on equipped items weight
  this.__updateCurrentCapacity();

  // Non-data handlers
  this.idleHandler = new PlayerIdleHandler(this);
  this.movementHandler = new PlayerMovementHandler(this);
  this.channelManager = new ChannelManager(this);
  this.actionHandler = new ActionHandler(this);
  this.combatLock = new CombatLock(this);
  this.pzLock = new PZLock(this);
  this.useHandler = new UseHandler(this);
  this.partyHandler = new PlayerPartyHandler(this);

  // Last visited
  this.lastVisit = data.lastVisit;

  // Combat mode state (default to balanced)
  this.fightMode = CONST.FIGHT_MODE.BALANCED;

  // Last attack time for defense factor calculation
  this.__lastAttackTime = 0;

  // Active summons (monster instances)
  this.summons = [];

  // Chase mode state (default to stand)
  this.chaseMode = CONST.CHASE_MODE.STAND;

  // Party state
  this.partyId = null;
  this.party = null;

  // PvP skull state (managed by SkullManager)
  // Defensive guard: CONST.SKULL should always exist (validated at startup),
  // but default to NONE=0 if something went wrong to prevent a hard crash.
  this.__skull = CONST.SKULL ? CONST.SKULL.NONE : 0;
  this.__frags = [];
  this.__lastDamageSource = null;
  this.__skullVisibleTo = undefined;
  this.__whiteSkullTimer = null;
  this.__yellowSkullTimer = null;
  this.__redSkullTimer = null;
  this.__blackSkullTimer = null;

  // Anti-cheat: confirmed cheater flag (persisted)
  this.__cheater = data.__cheater || false;

  // Detection violations counter
  this.__moveViolations = 0;
};

Player.prototype = Object.create(Creature.prototype);
Player.prototype.constructor = Player;

Player.prototype.addPlayerProperties = function (properties) {
  /*
   * Player.addPlayerProperties
   * Adds the properties of the player to the available properties
   */


  // Add these properties
  this.properties.add(CONST.PROPERTIES.OUTFITS, properties.availableOutfits);
  this.properties.add(CONST.PROPERTIES.SEX, properties.sex);
  this.properties.add(CONST.PROPERTIES.ROLE, properties.role);
  this.properties.add(CONST.PROPERTIES.VOCATION, properties.vocation);

};

Player.prototype.getTarget = function () {
  return this.actionHandler.targetHandler.getTarget();
};

Player.prototype.getStorage = function (key) {
  /*
   * Function Player.getStorage
   * Returns the value for a storage key
   */

  return this.storage[key] || -1;
};

Player.prototype.getGuildName = function () {
  let name = this.getStorage(CONFIG.GUILD.QUEST_STORAGE + 1);
  if (name === -1) return null;
  let str = String(name);
  return str.charAt(0).toUpperCase() + str.slice(1);
};

Player.prototype.isPremium = function () {

  /*
   * Function Player.isPremium
   * Returns true if the player's account has premium status
   */

  let controller = this.socketHandler.getController();
  return controller ? controller.isPremium() : false;

};

function getBlessingPrice(level) {
  if (level <= 30) return 2000;
  if (level < 120) return 200 * (level - 20);
  return 20000 + 75 * (level - 120);
}

function getBlessingTotalPrice(level) {
  return getBlessingPrice(level) * 5;
}

Player.prototype.getBlessingPrice = function () {
  return getBlessingPrice(this.skills.getSkillLevel(CONST.PROPERTIES.EXPERIENCE));
};

Player.prototype.hasBlessing = function (blessId) {

  /*
   * Function Player.hasBlessing
   * Returns true if the player has the given blessing
   */

  return this.getStorage(blessId) > 0;

};

Player.prototype.addBlessing = function (blessId) {

  /*
   * Function Player.addBlessing
   * Adds a blessing to the player
   */

  this.setStorage(blessId, 1);

};

Player.prototype.getBlessingCount = function () {

  /*
   * Function Player.getBlessingCount
   * Returns the number of active blessings the player has
   */

  let count = 0;
  for (let key of CONFIG.BLESSINGS.STORAGE_KEYS) {
    if (this.getStorage(key) > 0) count++;
  }
  return count;

};

Player.prototype.getBlessingBitmask = function () {
  let mask = 0;
  let keys = CONFIG.BLESSINGS.STORAGE_KEYS;
  for (let i = 0; i < keys.length; i++) {
    if (this.getStorage(keys[i]) > 0) mask |= (1 << i);
  }
  return mask;
};

Player.prototype.setStorage = function (key, value) {
  /*
   * Function Player.setStorage
   * Sets the value for a storage key
   */

  this.storage[key] = value;

  // Check if this storage key is related to a quest
  if (gameServer.questManager) {
    const quest = gameServer.questManager.getQuestForStorage(key);
    if (quest) {
      // Notify the player
      const { ServerMessagePacket, QuestLogPacket } = requireModule("network/protocol");
      this.write(new ServerMessagePacket("Your quest log has been updated."));

      // Send the updated quest list
      let quests = gameServer.questManager.getQuestList(this);
      this.write(new QuestLogPacket(quests));
    }
  }
};

Player.prototype.__checkMarketDataOnLogin = function () {
  if (!process.gameServer || !process.gameServer.shopManager) {
    return;
  }
  let data = process.gameServer.shopManager.loadShopData(this);
  if (!data) {
    return;
  }
  this.storage.__marketRestored = true;
  process.gameServer.shopManager.returnItemsFromData(this, data);
  this.__restoreNameFromShop();
}

Player.prototype.__restoreNameFromShop = function () {
  let name = this.getProperty(CONST.PROPERTIES.NAME);
  if (name && name.indexOf("\n") !== -1) {
    let parts = name.split("\n");
    this.setProperty(CONST.PROPERTIES.NAME, parts[parts.length - 1]);
  }
}

Player.prototype.getBankBalance = function () {
  /*
   * Function Player.getBankBalance
   * Returns the player's bank account balance
   */

  let val = this.getStorage(BANK_BALANCE_KEY);
  return val === -1 ? 0 : val;
};

Player.prototype.setBankBalance = function (value) {
  /*
   * Function Player.setBankBalance
   * Sets the player's bank account balance
   */

  this.setStorage(BANK_BALANCE_KEY, value);
};

Player.prototype.getTextColor = function () {
  /*
   * Function Player.getTextColor
   * Returns the text color of the player
   */

  return this.getProperty(CONST.PROPERTIES.ROLE) === CONST.ROLES.ADMIN
    ? CONST.COLOR.RED
    : CONST.COLOR.YELLOW;
};

Player.prototype.getLevel = function () {
  /*
   * Function Player.getLevel
   * Returns the level of the player
   */

  return this.skills.getSkillLevel(CONST.PROPERTIES.EXPERIENCE);
};

Player.prototype.setLevel = function (level) {
  /*
   * Function Player.setLevel
   * Sets the level of a player character
   */

  // Set the level & experience
  this.characterStatistics.skills.setSkillLevel(CONST.SKILL.EXPERIENCE, level);
};

Player.prototype.onLevelUp = function (oldLevel, newLevel) {
  /*
   * Function Player.onLevelUp
   * Called when player gains a level - updates stats and notifies client
   */

  // Recalculate max health, mana, capacity based on new level
  this.skills.setMaximumProperties();

  // Send level update to client (using a custom property ID for level)
  // We'll use property ID 30 for LEVEL
  this.write(new CreaturePropertyPacket(this.getId(), 30, newLevel));

  // Send experience update to client
  let currentExp = this.skills.getSkillValue(CONST.PROPERTIES.EXPERIENCE);
  this.write(new CreaturePropertyPacket(this.getId(), CONST.PROPERTIES.EXPERIENCE, currentExp));

  // Send max health and max mana updates
  let newMaxHealth = this.getProperty(CONST.PROPERTIES.HEALTH_MAX);
  let newMaxMana = this.getProperty(CONST.PROPERTIES.MANA_MAX);
  let newMaxCapacity = this.getProperty(CONST.PROPERTIES.CAPACITY_MAX);

  this.write(new CreaturePropertyPacket(this.getId(), CONST.PROPERTIES.HEALTH_MAX, newMaxHealth));
  this.write(new CreaturePropertyPacket(this.getId(), CONST.PROPERTIES.MANA_MAX, newMaxMana));
  this.write(new CreaturePropertyPacket(this.getId(), CONST.PROPERTIES.CAPACITY_MAX, newMaxCapacity));

  // Send congratulations message
  let message = `You advanced from Level ${oldLevel} to Level ${newLevel}. Congratulations!`;
  this.write(new ServerMessagePacket(message));

  // Also send to console
  this.write(new ChannelWritePacket(
    CONST.CHANNEL.DEFAULT,
    "Server",
    message,
    CONST.COLOR.WHITE
  ));
};

Player.prototype.getExperiencePoints = function () {
  /*
   * Function Player.getExperience
   * Returns the number of experience points a player has
   */

  return this.characterStatistics.skills.getSkillPoints(CONST.SKILL.EXPERIENCE);
};

Player.prototype.isCheater = function () {
  return this.__cheater === true;
};

Player.prototype.setCheater = function (value) {
  this.__cheater = value === true;
  if (value) {
    gameServer.world.skullManager.__setSkull(this, CONST.SKULL.CHEATER);
  } else {
    gameServer.world.skullManager.clearSkull(this);
  }
};

Player.prototype.think = function () {
  this.__updateBlockCount();
  this.__checkTrainingWeaponExpiry();
  this.actionHandler.actions.handleActions(this.actionHandler);
};

Player.prototype.__checkTrainingWeaponExpiry = function () {
  let eq = this.containerManager && this.containerManager.equipment;
  if (!eq) return;
  let slots = [CONST.EQUIPMENT.LEFT, CONST.EQUIPMENT.RIGHT];
  for (let slot of slots) {
    let item = eq.peekIndex(slot);
    if (!item || !item.isTrainingWeapon || !item.isTrainingWeapon()) continue;
    if (!item.__equipTime) continue;
    let remaining = item.getRemainingEquipTime();
    if (remaining > 0) continue;
    let backpack = eq.peekIndex(CONST.EQUIPMENT.BACKPACK);
    if (backpack && backpack.isContainer && backpack.isContainer()) {
      eq.removeIndex(slot, 1);
      backpack.addThingSmart(item);
      this.sendCancelMessage("Your training weapon has lost its power.");
    }
  }
};

Player.prototype.getVocation = function () {
  /*
   * Function Player.getVocation
   * Returns the vocation of the player
   */

  return this.getProperty(CONST.PROPERTIES.VOCATION);
};

Player.prototype.extendCondition = function (id, ticks, duration) {
  const Condition = requireModule("combat/condition");
  if (!this.hasCondition(id)) {
    return this.conditions.add(new Condition(id, ticks, duration), null);
  }

  this.conditions.extendCondition(id, ticks);
};

Player.prototype.isSated = function (ticks) {
  const Condition = requireModule("combat/condition");
  return (
    this.hasCondition(Condition.prototype.SATED) &&
    ticks +
    this.conditions.__conditions.get(Condition.prototype.SATED).numberTicks >
    2000
  );
};

Player.prototype.isInvisible = function () {
  const Condition = requireModule("combat/condition");
  return this.hasCondition(Condition.prototype.INVISIBLE);
};

Player.prototype.enterNewChunks = function (newChunks) {
  /*
   * Function Player.enterNewChunk
   * Necessary functions to call when a creature enters a new chunk
   */

  // Get the serialized chunks
  newChunks.forEach((chunk) => chunk.serialize(this));

  newChunks.forEach((chunk) =>
    chunk.internalBroadcast(new CreatureStatePacket(this))
  );
};

Player.prototype.isInNoLogoutZone = function () {
  /*
   * Function Player.isInNoLogoutZone
   * Returns true if the player is in a no-logout zone
   */

  return process.gameServer.world
    .getTileFromWorldPosition(this.position)
    .isNoLogoutZone();
};

Player.prototype.isInProtectionZone = function () {
  /*
   * Function Player.isInProtectionZone
   * Returns true if the player is in a protection zone
   */

  return process.gameServer.world
    .getTileFromWorldPosition(this.position)
    .isProtectionZone();
};

Player.prototype.getOwnedHouses = function () {

  /*
   * Function Player.getOwnedHouses
   * Returns an array of all houses owned by this player
   */

  let houses = [];
  gameServer.database.houses.forEach(function(house) {
    if(house.owner === this.name) {
      houses.push(house);
    }
  }, this);

  return houses;

}

Player.prototype.countOwnedHouses = function () {

  /*
   * Function Player.countOwnedHouses
   * Returns the number of houses owned by this player
   */

  let count = 0;
  gameServer.database.houses.forEach(function(house) {
    if(house.owner === this.name) count++;
  }, this);

  return count;

}

Player.prototype.ownsHouseTile = function (tile) {
  /*
   * Function Player.ownsHouseTile
   * Returns true if the tile is a house tile
   */

  return (
    tile.house.owner === this.name || tile.house.invited.includes(this.name)
  );
};

Player.prototype.isTileOccupied = function (tile) {
  /*
   * Function Player.isTileOccupied
   * Function evaluated for a tile whether it is occupied for the NPC or not
   */

  // If the tile is blocking then definitely
  if (tile.isBlockSolid()) {
    return true;
  }

  // House tile but not owned
  if (tile.isHouseTile() && !this.ownsHouseTile(tile)) {
    this.sendCancelMessage("You do not own this house.");
    return true;
  }

  // The tile items contain a block solid (e.g., a wall)
  if (tile.hasItems() && tile.itemStack.isBlockSolid()) {
    return true;
  }

  // Occupied by other characters
  if (tile.isOccupiedCharacters()) {
    return true;
  }

  // Allow stepping up to 1 height level per move (stairs-like behavior up to 4)
  let currentTile = gameServer.world.getTileFromWorldPosition(this.position);
  let heightDiff = tile.countHeight() - (currentTile ? currentTile.countHeight() : 0);
  if (heightDiff > 1) {
    return true;
  }

  // Item stack trap: X+ movable items (without height) block the tile
  if (tile.hasItems()) {
    let movableCount = tile.itemStack.__items.filter(
      i => !i.hasHeight() && i.isMoveable()
    ).length;
    if (movableCount >= CONST.TRAP.BLOCK_HARD) {
      return true;
    }
  }

  return false;
};

Player.prototype.openContainer = function (id, name, baseContainer) {
  /*
   * Function Player.openContainer
   * Opens the base container and writes a packet to the player
   */

  baseContainer.addSpectator(this);

  this.write(new ContainerOpenPacket(id, name, baseContainer));
};

Player.prototype.closeContainer = function (baseContainer) {
  /*
   * Function Player.closeContainer
   * Closes the base container and writes a packet to the player
   */

  baseContainer.removeSpectator(this);

  this.write(new ContainerClosePacket(baseContainer.guid));
};

Player.prototype.isInCombat = function () {
  /*
   * Function Player.isInCombat
   * Return true if the player is currently engaged in combat
   */

  return this.combatLock.isLocked() || this.pzLock.isLocked();
};

Player.prototype.isOnline = function () {
  /*
   * Function Player.isOnline
   * Returns true if the player is online and connected to the gameworld
   */

  // Check with the world
  return gameServer.world.creatureHandler.isPlayerOnline(this);
};

Player.prototype.isMoving = function () {
  /*
   * Function Player.isMoving
   * Returns true if the creature is moving and does not have the move action available
   */

  return this.movementHandler.isMoving();
};

Player.prototype.canUseHangable = function (thing) {
  /*
   * Function Player.canNotUseHangable
   * Delegates to the internal function
   */

  return (
    (thing.isHorizontal() && this.position.y >= thing.getPosition().y) ||
    (thing.isVertical() && this.position.x >= thing.getPosition().x)
  );
};

Player.prototype.decreaseHealth = function (source, amount) {
  /*
   * Function Player.decreaseHealth
   * Decreases the health of the player
   * If Magic Shield (utamo vita) is active, damage goes to mana first
   */

  // Prevent damage if dead
  if (this.isDead) {
    return;
  }

  // Track last damage source for PvP death detection
  this.__lastDamageSource = source;

  // Damage breaks invisibility
  const Condition = requireModule("combat/condition");
  if (this.hasCondition(Condition.prototype.INVISIBLE)) {
    this.removeCondition(Condition.prototype.INVISIBLE);
  }

  // Put the target player in combat
  this.combatLock.activate();

  // Check if Magic Shield (utamo vita) is active
  if (this.hasCondition(Condition.prototype.MAGIC_SHIELD)) {
    let currentMana = this.getProperty(CONST.PROPERTIES.MANA);

    if (currentMana > 0) {
      // Calculate how much damage goes to mana vs health
      let manaAbsorbed = Math.min(amount, currentMana);
      let remainingDamage = amount - manaAbsorbed;

      // Decrease mana by the absorbed amount
      this.incrementProperty(CONST.PROPERTIES.MANA, -manaAbsorbed);

      // Send mana damage in blue color
      this.broadcast(new EmotePacket(this, String(manaAbsorbed), CONST.COLOR.LIGHTBLUE));

      // Send message about mana damage
      this.write(new ChannelWritePacket(
        CONST.CHANNEL.DEFAULT,
        "",
        "You lose " + manaAbsorbed + " mana" + (source && source.isPlayer && !source.isPlayer() ? " due to an attack by " + (source.getProperty(CONST.PROPERTIES.NAME) || "creature").toLowerCase() : "") + ".",
        CONST.COLOR.WHITE
      ));

      // If mana runs out, remove the Magic Shield condition
      if (this.getProperty(CONST.PROPERTIES.MANA) === 0) {
        this.removeCondition(Condition.prototype.MAGIC_SHIELD);
        this.sendCancelMessage("Your magic shield has been depleted.");
      }

      // If there's remaining damage after mana is depleted, apply it to health
      if (remainingDamage > 0) {
        this.incrementProperty(CONST.PROPERTIES.HEALTH, -remainingDamage);
        this.broadcast(new EmotePacket(this, String(remainingDamage), CONST.COLOR.RED));

        this.write(new ChannelWritePacket(
          CONST.CHANNEL.DEFAULT,
          "",
          "You lose " + remainingDamage + " hitpoints.",
          CONST.COLOR.WHITE
        ));
      }

      // Check for death after remaining damage
      if (this.isZeroHealth()) {
        if (this.isDead) {
          return;
        }
        return this.handleDeath();
      }

      return;
    } else {
      // No mana left, remove magic shield
      this.removeCondition(Condition.prototype.MAGIC_SHIELD);
      this.sendCancelMessage("Your magic shield has been depleted.");
    }
  }

  // Normal damage to health (no magic shield or mana depleted)
  this.incrementProperty(CONST.PROPERTIES.HEALTH, -amount);

  // Send damage color to the player
  this.broadcast(new EmotePacket(this, String(amount), CONST.COLOR.RED));

  // Send combat message to chat: "You lose X hitpoints due to an attack by [monster name]."
  if (source && source.isPlayer && !source.isPlayer()) {
    let sourceName = source.getProperty(CONST.PROPERTIES.NAME) || "creature";
    // Send to Default channel (console) - channel id 0
    this.write(new ChannelWritePacket(
      CONST.CHANNEL.DEFAULT,
      "",
      "You lose " + amount + " hitpoints due to an attack by " + sourceName.toLowerCase() + ".",
      CONST.COLOR.WHITE
    ));
  } else if (source === null) {
    // Environmental damage
    this.write(new ChannelWritePacket(
      CONST.CHANNEL.DEFAULT,
      "",
      "You lose " + amount + " hitpoints.",
      CONST.COLOR.WHITE
    ));
  }

  // Zero health means death
  if (this.isZeroHealth()) {
    if (this.isDead) {
      return;
    }
    return this.handleDeath();
  }
};

Player.prototype.getCorpse = function () {
  /*
   * Function Player.getCorpse
   * Returns either the male or female corpse
   */

  const CORPSE_MALE = 3058;
  const CORPSE_FEMALE = 3065;

  return this.getProperty(CONST.PROPERTIES.SEX) === CONST.SEX.MALE
    ? CORPSE_MALE
    : CORPSE_MALE;
};

Player.prototype.handleDeath = function () {
  /*
   * Function Player.handleDeath
   * Called when the player dies because of zero health
   * Deducts experience, shows death screen, clears combat lock for respawn
   */

  // Prevent multiple calls
  if (this.isDead) {
    return;
  }

  this.isDead = true;

  // Clear all conditions immediately (prevents tick interference between death and save)
  this.conditions.cleanup();

  // Explicitly set HP/MANA to 0 for clean save state
  this.setProperty(CONST.PROPERTIES.HEALTH, 0);
  this.setProperty(CONST.PROPERTIES.MANA, 0);

  // Detect PvP death and handle skull/frags
  let wasPvPDeath = this.__lastDamageSource && this.__lastDamageSource.isPlayer && this.__lastDamageSource.isPlayer();
  let killer = wasPvPDeath ? this.__lastDamageSource : null;

  if (wasPvPDeath && killer) {
    let skullManager = gameServer.world.skullManager;
    skullManager.onPlayerKill(killer, this);
  }

  // Deduct experience based on configurable percentage, reduced by blessings
  let losePercent = CONFIG.DEATH.LOSE_PERCENT || 10;

  // PvP death: double XP loss (configurable)
  if (wasPvPDeath) {
    losePercent *= 2;
  }

  let currentExp = this.skills.getSkillValue(CONST.PROPERTIES.EXPERIENCE);

  let blessingCount = this.getBlessingCount();
  let reduction = this.isPremium()
    ? CONFIG.BLESSINGS.XP_REDUCTION_PROMO[blessingCount]
    : CONFIG.BLESSINGS.XP_REDUCTION[blessingCount];
  let effectiveLoss = Math.max(0, losePercent * (1 - reduction / 100));
  let expLoss = Math.floor(currentExp * (effectiveLoss / 100));

  this.skills.incrementSkill(CONST.PROPERTIES.EXPERIENCE, -expLoss);

  // Recalculate max properties (HP, Mana, Cap) based on new level
  this.skills.setMaximumProperties();

  // Send updated max properties and level to client
  const { CreaturePropertyPacket } = requireModule("network/protocol");
  this.write(new CreaturePropertyPacket(this.getId(), CONST.PROPERTIES.HEALTH_MAX, this.getProperty(CONST.PROPERTIES.HEALTH_MAX)));
  this.write(new CreaturePropertyPacket(this.getId(), CONST.PROPERTIES.MANA_MAX, this.getProperty(CONST.PROPERTIES.MANA_MAX)));
  this.write(new CreaturePropertyPacket(this.getId(), CONST.PROPERTIES.CAPACITY_MAX, this.getProperty(CONST.PROPERTIES.CAPACITY_MAX)));

  let newLevel = this.skills.getSkillLevel(CONST.PROPERTIES.EXPERIENCE);
  this.write(new CreaturePropertyPacket(this.getId(), 30, newLevel));

  let skillTypes = [
    CONST.PROPERTIES.SWORD, CONST.PROPERTIES.CLUB, CONST.PROPERTIES.AXE,
    CONST.PROPERTIES.FIST, CONST.PROPERTIES.DISTANCE, CONST.PROPERTIES.SHIELDING
  ];
  for (let st of skillTypes) {
    let skillVal = this.skills.getSkillValue(st);
    if (skillVal > 0) {
      let skillLoss = Math.floor(skillVal * (effectiveLoss / 100));
      if (skillLoss > 0) {
        this.skills.incrementSkill(st, -skillLoss);
      }
    }
  }

  console.log(`[DEATH] ${this.getProperty(CONST.PROPERTIES.NAME)} lost ${expLoss} experience (${effectiveLoss}%) [blessings: ${blessingCount}] and is now level ${newLevel}`);

  // Record death in database
  try {
    const AccountDatabase = requireModule("auth/account-database");
    let db = new AccountDatabase();
    let killerName = "unknown";
    let killedByType = "monster";
    if (this.__lastDamageSource) {
      killerName = this.__lastDamageSource.getProperty(CONST.PROPERTIES.NAME) || "unknown";
      if (this.__lastDamageSource.isPlayer && this.__lastDamageSource.isPlayer()) {
        killedByType = "player";
      }
    }
    db.recordDeath(
      this.getProperty(CONST.PROPERTIES.NAME),
      killerName,
      newLevel,
      killedByType
    );
  } catch (e) {
    console.error("[DEATH] Failed to record death:", e);
  }

  // Send death message screen to client (like Tibia's "You are dead" modal)
  // 0x28 (Death Window) should trigger the modal natively without disconnect
  const { DeathPacket, CancelMessagePacket, CreatureForgetPacket } = requireModule("network/protocol");
  this.write(new DeathPacket());
  this.write(new CancelMessagePacket("You are dead."));

  // Broadcast CreatureForgetPacket to all spectators to make the player "disappear"
  // This removes the player sprite from the screen without changing outfit
  // We also write directly to the player since broadcast may not include self
  let forgetPacket = new CreatureForgetPacket(this.getId());
  this.write(forgetPacket);
  this.broadcast(forgetPacket);

  // Explicitly force nearby monsters to drop target immediately to prevent lingering attacks
  let chunk = gameServer.world.getChunkFromWorldPosition(this.getPosition());
  if (chunk) {
    let dropTarget = (monster) => {
      if (monster.hasTarget() && monster.getTarget() === this) {
        monster.setTarget(null);
      }
    };
    chunk.monsters.forEach(dropTarget);
    chunk.neighbours.forEach(neighbour => neighbour.monsters.forEach(dropTarget));
  }

  // Create the player corpse at the death location
  let corpse = gameServer.database.createThing(this.getCorpse());

  if (corpse !== null) {
    gameServer.world.addTopThing(this.getPosition(), corpse);
    gameServer.world.addSplash(2016, this.getPosition(), corpse.getFluidType());
  }

  // Check for Amulet of Loss (ID 2173) in necklace slot — protects backpack
  let amulet = this.containerManager.equipment.peekIndex(CONST.EQUIPMENT.NECKLACE);
  let hasAmulet = amulet !== null && amulet.id === 2173;

  // Red/Black/Cheater skull: drop ALL items regardless of AoL
  let skullManager = wasPvPDeath ? gameServer.world.skullManager : null;
  let isRedOrBlack = skullManager &&
    (skullManager.getSkull(this) === CONST.SKULL.RED ||
     skullManager.getSkull(this) === CONST.SKULL.BLACK ||
     skullManager.getSkull(this) === CONST.SKULL.CHEATER);

  if (isRedOrBlack) {
    // Drop ALL equipment slots (everything)
    let allSlots = [
      CONST.EQUIPMENT.HELMET, CONST.EQUIPMENT.ARMOR, CONST.EQUIPMENT.LEGS,
      CONST.EQUIPMENT.BOOTS, CONST.EQUIPMENT.RIGHT, CONST.EQUIPMENT.LEFT,
      CONST.EQUIPMENT.NECKLACE, CONST.EQUIPMENT.RING, CONST.EQUIPMENT.QUIVER,
      CONST.EQUIPMENT.BACKPACK
    ];
    for (let slot of allSlots) {
      let item = this.containerManager.equipment.peekIndex(slot);
      if (item !== null) {
        this.containerManager.equipment.removeIndex(slot, 1);
        gameServer.world.addTopThing(this.getPosition(), item);
      }
    }
  } else if (hasAmulet) {
    this.containerManager.equipment.removeIndex(CONST.EQUIPMENT.NECKLACE, 1);
    const { CancelMessagePacket } = requireModule("network/protocol");
    this.write(new CancelMessagePacket("Your amulet of loss crumbles to dust, protecting your belongings."));
  } else {
    let backpack = this.containerManager.equipment.peekIndex(CONST.EQUIPMENT.BACKPACK);
    if (backpack !== null) {
      this.containerManager.equipment.removeIndex(CONST.EQUIPMENT.BACKPACK, 1);
      gameServer.world.addTopThing(this.getPosition(), backpack);
    }
  }

  // Clear the last damage source to prevent stale source bleeding after death
  this.__lastDamageSource = null;

  // Clear combat lock so the player can click OK on death window to logout
  this.combatLock.unlock();

  // Clear PZ lock so the socket close handler can save immediately
  // Without this, isInCombat() returns true (PZ lock up to 60s), __removePlayer gets delayed,
  // and the client reconnects during the delay → attachController cancels the save → death state lost
  this.pzLock.unlock();

  // Mark that player should respawn at temple on next login
  this.__spawnAtTemple = true;

  // Clear bed spawn on death
  this.__bedPosition = null;
  this.__bedDirection = null;
};

Player.prototype.consumeAmmunition = function () {
  /*
   * Function Player.consumeAmmunition
   * Consumes a single piece of ammunition
   */

  return this.containerManager.equipment.removeIndex(CONST.EQUIPMENT.QUIVER, 1);
};

Player.prototype.isAmmunitionEquipped = function () {
  /*
   * Function Player.isAmmunitionEquipped
   * Returns true if the player has ammunition available
   */

  return this.containerManager.equipment.isAmmunitionEquipped();
};

Player.prototype.isDistanceWeaponEquipped = function () {
  /*
   * Function Player.isDistanceWeaponEquipped
   * Returns true if the player has a distance weapon equipped
   */

  return this.containerManager.equipment.isDistanceWeaponEquipped();
};

Player.prototype.getRange = function () {
  /*
   * Function Player.getRange
   * Returns the attack range of the equipped distance weapon
   */

  let result = this.containerManager.equipment.getWeapon();
  if (result === null) {
    return 1;
  }
  return result.weapon.getRange();
};

Player.prototype.sendCancelMessage = function (message) {
  /*
   * Function Player.sendCancelMessage
   * Writes a cancel message to the player
   */

  this.write(new CancelMessagePacket(message));
};

Player.prototype.syncProperties = function () {
  /*
   * Function Player.syncProperties
   * Synchronizes all player properties before saving
   */


  // Update maximum properties based on level first
  this.skills.setMaximumProperties();

  // Ensure health and mana don't exceed maximums
  let currentHealth = this.getProperty(CONST.PROPERTIES.HEALTH);
  let maxHealth = this.getProperty(CONST.PROPERTIES.HEALTH_MAX);
  if (currentHealth > maxHealth) {
    this.setProperty(CONST.PROPERTIES.HEALTH, maxHealth);
  }

  let currentMana = this.getProperty(CONST.PROPERTIES.MANA);
  let maxMana = this.getProperty(CONST.PROPERTIES.MANA_MAX);
  if (currentMana > maxMana) {
    this.setProperty(CONST.PROPERTIES.MANA, maxMana);
  }

  // Update capacity based on current items
  if (this.containerManager) {
    let totalWeight = this.containerManager.equipment.getTotalWeight();
    let maxCapacity = this.getProperty(CONST.PROPERTIES.CAPACITY_MAX);
    let maxCapacityUnits = maxCapacity * 100;
    let currentCapacityUnits = Math.max(0, maxCapacityUnits - totalWeight);
    this.setProperty(
      CONST.PROPERTIES.CAPACITY,
      Math.floor(currentCapacityUnits / 100)
    );
  }

};

Player.prototype.cleanup = function () {
  /*
   * Public Function Player.cleanup
   * Cleans up player references and events after socket close
   */

  console.log("Player %s logged out.".format(this.getProperty(CONST.PROPERTIES.NAME)));

  // Sync all properties before cleanup
  this.syncProperties();

  // Leave all channels
  this.channelManager.cleanup();

  // Close all containers
  this.containerManager.cleanup();

  // Cancel events scheduled by the condition manager
  this.conditions.cleanup();

  // Cancel events scheduled by the combat lock
  this.combatLock.cleanup();

  // Idle events
  this.idleHandler.cleanup();

  // Disconnect all connected sockets
  this.socketHandler.disconnect();

  // Remaining actions
  this.actionHandler.cleanup();

  // Emit the logout event for the player
  this.emit("logout");
};

Player.prototype.toJSON = function () {
  /*
   * Function Player.toJSON
   * Serializes the player to JSON
   */

  // Sync properties before saving
  this.syncProperties();

  // Get current properties
  let currentProperties = {
    name: this.getProperty(CONST.PROPERTIES.NAME),
    health: this.getProperty(CONST.PROPERTIES.HEALTH),
    healthMax: this.getProperty(CONST.PROPERTIES.HEALTH_MAX),
    mana: this.getProperty(CONST.PROPERTIES.MANA),
    manaMax: this.getProperty(CONST.PROPERTIES.MANA_MAX),
    capacity: this.getProperty(CONST.PROPERTIES.CAPACITY),
    capacityMax: this.getProperty(CONST.PROPERTIES.CAPACITY_MAX),
    speed: this.getProperty(CONST.PROPERTIES.SPEED),
    attack: this.getProperty(CONST.PROPERTIES.ATTACK),
    defense: this.getProperty(CONST.PROPERTIES.DEFENSE),
    attackSpeed: this.getProperty(CONST.PROPERTIES.ATTACK_SPEED),
    direction: this.getProperty(CONST.PROPERTIES.DIRECTION),
    outfit: this.getProperty(CONST.PROPERTIES.OUTFIT),
    role: this.getProperty(CONST.PROPERTIES.ROLE),
    vocation: this.getProperty(CONST.PROPERTIES.VOCATION),
    sex: this.getProperty(CONST.PROPERTIES.SEX),
    availableOutfits: this.getProperty(CONST.PROPERTIES.OUTFITS),
  };


  return new Object({
    position: this.__spawnAtTemple ? this.templePosition : this.position,
    templePosition: this.templePosition,
    properties: currentProperties,
    skills: this.skills.toJSON(),
    spellbook: this.spellbook.toJSON(),
    containers: this.containerManager.toJSON(),
    friends: this.friendlist.toJSON(),
    ignored: this.ignorelist.toJSON(),
    storage: this.storage,
    premiumPoints: this.premiumPoints,
    premiumExpiry: this.premiumExpiry,
    bedPosition: this.__bedPosition,
    bedDirection: this.__bedDirection,
    lastVisit: Date.now(),
  });
};

Player.prototype.disconnect = function () {
  this.socketHandler.disconnect();
};

Player.prototype.write = function (packet) {
  /*
   * Function Player.write
   * Delegates write to the websocket connection to write a packet
   */

  this.socketHandler.write(packet);
};

Player.prototype.getEquipmentAttribute = function (attribute) {
  /*
   * Function Player.getEquipmentAttribute
   * Returns an attribute from the the players' equipment
   */

  return this.containerManager.equipment.getAttributeState(attribute);
};

Player.prototype.getSpeed = function () {
  /*
   * Function Player.getSpeed
   * Returns the speed of the player
   * Tibia formula: Base Speed = 109 + Level
   */

  if (this.customSpeed) {
    return this.customSpeed;
  }

  // Get the player level
  let level = this.skills.getSkillLevel(CONST.PROPERTIES.EXPERIENCE) || 1;

  // Tibia speed formula: Vocation base speed (220) + 2 per level
  let baseSpeed = 220 + (2 * (level - 1));

  // Add speed bonuses from equipment (boots of haste, etc.)
  // Guard: containerManager may not exist during player initialization
  let equipmentSpeed = 0;
  if (this.containerManager && this.containerManager.equipment) {
    equipmentSpeed = this.getEquipmentAttribute("speed") || 0;
  }
  baseSpeed += equipmentSpeed;

  // Apply haste condition multipliers (strong haste overrides regular haste)
  const Condition = requireModule("combat/condition");
  if (this.hasCondition(Condition.prototype.STRONG_HASTE)) {
    baseSpeed = Math.floor(baseSpeed * 1.7 - 56);
  } else if (this.hasCondition(Condition.prototype.HASTE)) {
    baseSpeed = Math.floor(baseSpeed * 1.3 - 24);
  }

  // Apply paralyze condition - reduces speed to 40% of base
  if (this.hasCondition(Condition.prototype.PARALYZE)) {
    baseSpeed = Math.floor(baseSpeed * 0.4);
  }

  return Math.max(baseSpeed, 10); // Minimum speed of 10
};

Player.prototype.getStepDuration = function (friction) {
  let speed = this.getSpeed();
  if (friction === null || friction === undefined) friction = 100;

  let stepDurationMs = (friction * 1000) / speed;

  return Math.ceil(stepDurationMs / CONFIG.SERVER.MS_TICK_INTERVAL);
};

Player.prototype.getSkillLevel = function (skillType) {
  let baseLevel = this.skills.getSkillLevel(skillType);
  if (!this.containerManager || !this.containerManager.equipment) return baseLevel;
  let ring = this.containerManager.equipment.peekIndex(CONST.EQUIPMENT.RING);
  if (!ring) return baseLevel;
  let bonusAttr = {
    [CONST.PROPERTIES.SWORD]: "skillSword",
    [CONST.PROPERTIES.CLUB]: "skillClub",
    [CONST.PROPERTIES.AXE]: "skillAxe",
    [CONST.PROPERTIES.FIST]: "skillFist",
    [CONST.PROPERTIES.DISTANCE]: "skillDist",
    [CONST.PROPERTIES.SHIELDING]: "skillShielding"
  }[skillType];
  if (bonusAttr) {
    let bonus = ring.getAttribute(bonusAttr);
    if (bonus) baseLevel += parseInt(bonus);
  }
  return baseLevel;
};

Player.prototype.__sendAdjustedSkill = function (skillType) {
  const { CreaturePropertyPacket } = requireModule("network/protocol");
  let basePoints = this.skills.getSkillValue(skillType);
  let sendPoints = basePoints;
  if (this.containerManager && this.containerManager.equipment) {
    let ring = this.containerManager.equipment.peekIndex(CONST.EQUIPMENT.RING);
    if (ring) {
      let bonusAttr = {
        [CONST.PROPERTIES.SWORD]: "skillSword",
        [CONST.PROPERTIES.CLUB]: "skillClub",
        [CONST.PROPERTIES.AXE]: "skillAxe",
        [CONST.PROPERTIES.FIST]: "skillFist",
        [CONST.PROPERTIES.DISTANCE]: "skillDist",
        [CONST.PROPERTIES.SHIELDING]: "skillShielding"
      }[skillType];
      let attrVal = ring.getAttribute(bonusAttr);
      if (bonusAttr && attrVal) {
        let baseLevel = this.skills.getSkillLevel(skillType);
        let effectiveLevel = baseLevel + parseInt(attrVal);
        if (effectiveLevel > baseLevel) {
          let skill = this.skills.__getSkill(skillType);
          if (skill) {
            let vocation = this.getVocation();
            sendPoints = Math.ceil(skill.getRequiredSkillPoints(effectiveLevel, vocation));
          }
        }
      }
    }
  }
  this.write(new CreaturePropertyPacket(this.getId(), skillType, sendPoints));
};

Player.prototype.__resendAllRingSkills = function () {
  var types = [
    CONST.PROPERTIES.FIST, CONST.PROPERTIES.CLUB, CONST.PROPERTIES.SWORD,
    CONST.PROPERTIES.AXE, CONST.PROPERTIES.DISTANCE, CONST.PROPERTIES.SHIELDING
  ];
  types.forEach(function (type) {
    this.__sendAdjustedSkill(type);
  }, this);
};

Player.prototype.getMaxWeaponDamage = function (attackValue, weaponSkillType) {

  if (CONFIG.COMBAT && CONFIG.COMBAT.USE_CLASSIC_FORMULAS) {
    let attackSkill = this.getSkillLevel(weaponSkillType);
    return CombatFormulas.getMaxWeaponDamageClassic(attackSkill, attackValue);
  }

  let attackSkill = this.getSkillLevel(weaponSkillType);
  let attackFactor = CombatFormulas.getAttackFactor(this.fightMode);

  let maxDamage = CombatFormulas.getMaxWeaponDamage(
    this.getLevel(),
    attackSkill,
    attackValue,
    attackFactor
  );

  let vocationName = this.getVocationName();
  let mult = CombatFormulas.VOCATION_MULTIPLIERS[vocationName] || CombatFormulas.VOCATION_MULTIPLIERS.none;
  maxDamage = Math.round(maxDamage * mult.meleeDamage);

  return maxDamage;

};

Player.prototype.getBaseDamage = function () {

  let level = this.skills.getSkillLevel(CONST.PROPERTIES.EXPERIENCE);

  return Math.floor(level / 5);

};

Player.prototype._getWeaponAttack = function () {
  let slots = [CONST.EQUIPMENT.LEFT, CONST.EQUIPMENT.RIGHT];
  for (let i = 0; i < slots.length; i++) {
    let item = this.containerManager.equipment.peekIndex(slots[i]);
    if (item === null) continue;
    let wt = item.getPrototype().properties.weaponType;
    if (wt === "sword" || wt === "club" || wt === "axe" || wt === "distance") {
      let attack = item.getAttribute("attack");
      return (attack !== null && attack !== undefined) ? attack : 0;
    }
  }
  return 7;

};

Player.prototype.calculateDamage = function (target) {

  if (this.isDistanceWeaponEquipped()) {
    let weaponAttack = this._getWeaponAttack();
    let ammoAttack = 0;
    let result = this.containerManager.equipment.getWeapon();
    if (result && result.weapon.getAttribute("ammoAction") !== "move") {
      let ammo = this.containerManager.equipment.peekIndex(CONST.EQUIPMENT.QUIVER);
      if (ammo) {
        ammoAttack = ammo.getAttribute("attack") || 0;
      }
    }
    return CombatFormulas.getRangeDamage(this, weaponAttack, ammoAttack, target);
  }

  let attackValue = this._getWeaponAttack();
  let weaponType = this.containerManager.equipment.getWeaponType();
  let maxDamage = this.getMaxWeaponDamage(attackValue, weaponType);

  return Number.prototype.random(0, Math.max(1, maxDamage));

};

Player.prototype.calculateDefense = function () {

  let defense = CombatFormulas.getPlayerDefense(this);
  return Number.prototype.random(0, Math.max(1, defense));

};

Player.prototype.calculateArmorReduction = function () {

  let totalArmor = CombatFormulas.getPlayerArmor(this);

  if (CONFIG.COMBAT && CONFIG.COMBAT.USE_CLASSIC_FORMULAS) {
    return totalArmor;
  }

  if (totalArmor > 3) {
    return Math.floor(Math.random() * (totalArmor - Math.floor(totalArmor / 2) + 1)) + Math.floor(totalArmor / 2);
  }

  if (totalArmor > 0) {
    return 1;
  }

  return 0;

};

Player.prototype.setFightMode = function (mode) {
  /*
   * Function Player.setFightMode
   * Sets the combat fight mode (OFFENSIVE, BALANCED, DEFENSIVE)
   */

  // Validate the mode
  if (mode < CONST.FIGHT_MODE.OFFENSIVE || mode > CONST.FIGHT_MODE.DEFENSIVE) {
    return;
  }

  this.fightMode = mode;

};

Player.prototype.setChaseMode = function (mode) {
  /*
   * Function Player.setChaseMode
   * Sets the chase mode (STAND, CHASE)
   */

  // Validate the mode
  if (mode < CONST.CHASE_MODE.STAND || mode > CONST.CHASE_MODE.CHASE) {
    return;
  }

  this.chaseMode = mode;

};

Player.prototype.purchase = function (offer, count) {
  /*
   * Function Player.purchase
   * Function to purchase an item from an NPC
   */

  let quantity = count || 1;

  // Price is equivalent to the count times price
  if (!this.payWithResource(2148, offer.price * quantity)) {
    return this.sendCancelMessage("You do not have enough gold.");
  }

  for (let i = 0; i < quantity; i++) {
    let thing = process.gameServer.database.createThing(offer.id);

    if (offer.actionId) {
      thing.setActionId(offer.actionId);
    }

    if (thing.isStackable()) {
      thing.setCount(count);
      if (!this.containerManager.equipment.canPushItem(thing)) {
        return this.sendCancelMessage(
          "You do not have enough available space or capacity."
        );
      }
      this.containerManager.equipment.pushItem(thing);
      break;
    }

    if (thing.isFluidContainer() && offer.count) {
      thing.setCount(offer.count);
    }

    if (!this.containerManager.equipment.canPushItem(thing)) {
      return this.sendCancelMessage(
        "You do not have enough available space or capacity."
      );
    }

    this.containerManager.equipment.pushItem(thing);
  }

  return true;
};

Player.prototype.getCapacity = function () {
  /*
   * Function Player.getCapacity
   * Returns the available capacity for the player
   */

  return this.getProperty(CONST.PROPERTIES.CAPACITY);
};

Player.prototype.hasSufficientCapacity = function (thing) {
  /*
   * Function Player.hasSufficientCapacity
   * Returns true if the player has sufficient capacity to carry the thing
   */

  // Get capacity in oz
  let capacity = this.getCapacity();

  // Get weight - in Tibia, weight is stored in 1/100 oz units (e.g., 750 = 7.50 oz)
  // So we need to convert to oz by dividing by 100
  let weightInUnits = thing.getWeight();
  let weightInOz = weightInUnits / 100;


  return capacity >= weightInOz;
};

Player.prototype.payWithResource = function (currencyId, price) {
  /*
   * Function Player.payWithResource
   * Pays a particular price in gold coins
   */

  return this.containerManager.equipment.payWithResource(currencyId, price);
};

Player.prototype.sell = function (offer, count) {
  /*
   * Function Player.sell
   * Sells an item to the NPC
   */

  let itemId = offer.id;
  let price = offer.price * count;
  let equipment = this.containerManager.equipment;
  let backpack = equipment.peekIndex(CONST.EQUIPMENT.BACKPACK);

  if (backpack === null) {
    return this.sendCancelMessage("You do not have this item.");
  }

  // Find and remove the item from the backpack recursively
  let removed = equipment.__removeResourceRecursive(backpack, itemId, count);

  if (removed !== 0) {
    return this.sendCancelMessage("You do not have this item.");
  }

  // Give gold to the player
  equipment.__addChange(backpack, price);

  return true;
};

Player.prototype.handleBuyOffer = function (packet) {
  /*
   * Function Player.handleBuyOffer
   * Opens trade window with a friendly NPC
   */

  let creature = gameServer.world.creatureHandler.getCreatureFromId(packet.id);

  // The creature does not exist
  if (creature === null) {
    return;
  }

  // Trading only with NPCs
  if (creature.constructor.name !== "NPC") {
    return;
  }

  if (!creature.isWithinHearingRange(this)) {
    return;
  }

  // Get the current offer
  let offer = creature.conversationHandler.tradeHandler.getTradeItem(
    packet.index
  );

  // Try to make the purchase
  if (this.purchase(offer, packet.count)) {
    creature.speechHandler.internalCreatureSay(
      "Here you go!",
      CONST.COLOR.YELLOW
    );
    creature.conversationHandler.tradeHandler.refreshTradeWindow(this);
  }
};

Player.prototype.handleSellOffer = function (packet) {
  /*
   * Function Player.handleSellOffer
   * Handles a player selling an item to an NPC
   */

  let creature = gameServer.world.creatureHandler.getCreatureFromId(packet.id);

  if (creature === null) {
    return;
  }

  if (creature.constructor.name !== "NPC") {
    return;
  }

  if (!creature.isWithinHearingRange(this)) {
    return;
  }

  let offer = creature.conversationHandler.tradeHandler.getTradeItem(
    packet.index
  );

  if (this.sell(offer, packet.count)) {
    creature.speechHandler.internalCreatureSay(
      "Thank you!",
      CONST.COLOR.YELLOW
    );
    creature.conversationHandler.tradeHandler.refreshTradeWindow(this);
  }
};

Player.prototype.handleBlessingBuy = function (blessingIndex, currency) {
  let keys = CONFIG.BLESSINGS.STORAGE_KEYS;
  if (blessingIndex < 0 || blessingIndex >= keys.length) return;

  let blessId = keys[blessingIndex];
  let { CancelMessagePacket, BlessingUpdatePacket } = requireModule("network/protocol");

  let isPrem = this.isPremium();

  if (!isPrem) {
    this.write(new CancelMessagePacket("Only premium players may purchase blessings."));
    this.write(new BlessingUpdatePacket(this.getBlessingBitmask(), isPrem));
    return;
  }

  if (this.hasBlessing(blessId)) {
    this.write(new CancelMessagePacket("You already possess this blessing."));
    this.write(new BlessingUpdatePacket(this.getBlessingBitmask(), isPrem));
    return;
  }

  let price = this.getBlessingPrice();
  let ppPrice = Math.max(1, Math.floor(price / 2000));

  if (currency === 1) {
    if (this.premiumPoints < ppPrice) {
      this.write(new CancelMessagePacket("You do not have enough Premium Points."));
      this.write(new BlessingUpdatePacket(this.getBlessingBitmask(), isPrem));
      return;
    }
    this.premiumPoints -= ppPrice;
  } else {
    if (!this.payWithResource(2148, price)) {
      this.write(new CancelMessagePacket("You do not have enough gold."));
      this.write(new BlessingUpdatePacket(this.getBlessingBitmask(), isPrem));
      return;
    }
  }

  this.addBlessing(blessId);
  this.write(new BlessingUpdatePacket(this.getBlessingBitmask(), isPrem));
}

Player.prototype.handleOracleSelection = function (packet) {
  let creature = gameServer.world.creatureHandler.getCreatureFromId(packet.npcId);
  if (!creature || creature.constructor.name !== "NPC") return;
  if (!creature.isWithinHearingRange(this)) return;

  let pos;
  switch (packet.townId) {
    case 1: pos = new Position(32369, 32241, 7); break;
    case 2: pos = new Position(32360, 31782, 7); break;
    case 5: pos = new Position(33217, 31814, 8); break;
    case 7: pos = new Position(32957, 32076, 7); break;
    case 8: pos = new Position(33213, 32454, 1); break;
    default: return;
  }

  this.setProperty(CONST.PROPERTIES.VOCATION, packet.vocationId);
  this.templePosition = pos;
  creature.speechHandler.internalCreatureSay("SO BE IT!", CONST.COLOR.YELLOW);
  gameServer.world.creatureHandler.teleportCreature(this, pos);
  creature.conversationHandler.abort();
};

Player.prototype.__handleCreatureKill = function (creature) {
  /*
   * Function Player.__handleCreatureKill
   * Callback fired when the player participates in a creature kill
   */
  //this.questlog.kill(creature);
};

Player.prototype.changeCapacity = function (value) {
  /*
   * Function Player.changeCapacity
   * Changes the available capacity of a player by a value
   * Note: value is in 1/100 oz units (from item weights)
   */

  // Guard: check if CAPACITY property exists
  let currentCapacity = this.getProperty(CONST.PROPERTIES.CAPACITY);
  if (currentCapacity === null) {
    // Property doesn't exist yet, skip during initialization
    return;
  }

  // Convert value from 1/100 oz to oz for capacity change
  // Use Math.trunc() instead of Math.floor() for symmetric truncation
  // Math.floor(-7.5) = -8, Math.floor(7.5) = 7 (asymmetric!)
  // Math.trunc(-7.5) = -7, Math.trunc(7.5) = 7 (symmetric!)
  let valueInOz = Math.trunc(value / 100);

  // Calculate new capacity, ensuring it doesn't go below 0 or exceed uint32 max
  let newCapacity = Math.min(0xFFFFFFFF, Math.max(0, currentCapacity + valueInOz));

  this.setProperty(CONST.PROPERTIES.CAPACITY, newCapacity);
};

Player.prototype.__updateCurrentCapacity = function () {
  /*
   * Function Player.__updateCurrentCapacity
   * Updates current capacity based on equipped items weight
   */

  if (!this.containerManager) {
    return;
  }

  // Note: Tibia stores weight in 1/100 oz units (e.g., 1800 = 18.00 oz)
  // Capacity is also in 1/100 oz units, so no division needed
  let totalWeight = this.containerManager.equipment.getTotalWeight();
  let maxCapacity = this.getProperty(CONST.PROPERTIES.CAPACITY_MAX);

  // Convert maxCapacity to same units (multiply by 100) since it's stored in oz
  let maxCapacityUnits = maxCapacity * 100;
  let currentCapacity = Math.max(0, maxCapacityUnits - totalWeight);

  // Convert back to oz for display, clamp to uint32 max
  let currentCapacityOz = Math.min(0xFFFFFFFF, Math.floor(currentCapacity / 100));

  this.setProperty(CONST.PROPERTIES.CAPACITY, currentCapacityOz);
};

Player.prototype.changeSlowness = function (speed) {
  this.speed = this.speed + speed;
  this.write(
    new CreaturePropertyPacket(this.getId(), CONST.PROPERTIES.SPEED, this.speed)
  );
};

Player.prototype.checkSkillAdvance = function (isBloodHit) {
  /*
   * Function Player.checkSkillAdvance
   * Advances the skill of the player based on the weapon used
   * Uses CONFIG.SKILLS for multipliers
   */

  const SkillMultipliers = requireModule("utils/skill-multipliers");

  let weaponType = this.containerManager.equipment.getWeaponType();
  let isDistance = weaponType === CONST.PROPERTIES.DISTANCE;
  let skillType = isDistance ? "DISTANCE" : "MELEE";
  let skillConfig = SkillMultipliers.getSkillConfig(skillType);

  // Get config values with defaults
  let basePoints = skillConfig.BASE_POINTS_PER_HIT || 1;
  let bloodBonus = skillConfig.BLOOD_HIT_BONUS || 2;
  let hitPoints = isBloodHit ? (basePoints * bloodBonus) : basePoints;

  // Get vocation multiplier and calculate total
  let vocationName = this.getVocationName().toUpperCase();
  let totalPoints = SkillMultipliers.calculateSkillPoints(hitPoints, vocationName, skillType);

  this.skills.incrementSkill(weaponType, totalPoints);
};

Player.prototype.checkDefensiveSkillAdvance = function () {
  /*
   * Function Player.checkDefensiveSkillAdvance
   * Advances the shielding skill if a shield is used
   * Uses CONFIG.SKILLS for multipliers
   */

  if (this.containerManager.equipment.isShieldEquipped()) {
    const SkillMultipliers = requireModule("utils/skill-multipliers");

    let skillConfig = SkillMultipliers.getSkillConfig("SHIELDING");
    let basePoints = skillConfig.BASE_POINTS_PER_BLOCK || 1;

    // Get vocation multiplier and calculate total
    let vocationName = this.getVocationName().toUpperCase();
    let totalPoints = SkillMultipliers.calculateSkillPoints(basePoints, vocationName, "SHIELDING");

    this.skills.incrementSkill(CONST.PROPERTIES.SHIELDING, totalPoints);
  }
};

Player.prototype.getVocationName = function () {
  /*
   * Function Player.getVocationName
   * Returns the string name of the vocation
   */

  let vocationId = this.getProperty(CONST.PROPERTIES.VOCATION);
  switch (vocationId) {
    case CONST.VOCATION.KNIGHT:
    case CONST.VOCATION.ELITE_KNIGHT:
      return "knight";
    case CONST.VOCATION.PALADIN:
    case CONST.VOCATION.ROYAL_PALADIN:
      return "paladin";
    case CONST.VOCATION.SORCERER:
    case CONST.VOCATION.MASTER_SORCERER:
      return "sorcerer";
    case CONST.VOCATION.DRUID:
    case CONST.VOCATION.ELDER_DRUID:
      return "druid";
    case CONST.VOCATION.ADMIN:
      return "admin";
    default:
      return "none";
  }
};

Player.prototype.decreaseMana = function (amount) {
  /*
   * Function Player.decreaseMana
   * Decreases the mana of the player
   */

  let currentMana = this.getProperty(CONST.PROPERTIES.MANA);
  let newMana = Math.max(0, currentMana - amount);

  // Update property
  this.setProperty(CONST.PROPERTIES.MANA, newMana);

  // Send update packet to client
  this.write(new CreaturePropertyPacket(this.getId(), CONST.PROPERTIES.MANA, newMana));
};

Player.prototype.getSummons = function () {

  return this.summons;

};

Player.prototype.addSummon = function (monster) {

  this.summons.push(monster);

};

Player.prototype.removeSummon = function (monster) {

  let idx = this.summons.indexOf(monster);

  if (idx !== -1) {
    this.summons.splice(idx, 1);
  }

};

Player.prototype.getSummonCount = function () {

  return this.summons.length;

};

module.exports = Player;
