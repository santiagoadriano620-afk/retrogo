"use strict";

const path = require("path");
const Position = requireModule("utils/position");
const NPC = requireModule("npc/npc");
const { ServerMessagePacket, CreaturePropertyPacket } = requireModule("network/protocol");

const CommandHandler = function () { };

CommandHandler.__placeItem = function (player, thing) {
  let equipment = player.containerManager.equipment;

  // Try equipment (inventory) slots first — find empty slot matching item type
  for (let slot = 0; slot < 10; slot++) {
    if (equipment.peekIndex(slot) === null && equipment.__isRightType(thing, slot)) {
      if (equipment.addThing(thing, slot)) {
        return true;
      }
    }
  }

  // Then try backpack (skip containers to avoid nesting)
  if (!thing.isContainer()) {
    let backpack = equipment.peekIndex(CONST.EQUIPMENT.BACKPACK);
    if (backpack && backpack.container) {
      if (backpack.addThingSmart(thing)) {
        return true;
      }
    }
  }

  // Fall back to dropping on the ground
  gameServer.world.addTopThing(player.getPosition(), thing);
  return true;
};

CommandHandler.prototype.WAYPOINTS = new Object({
  rookgaard: new Position(32097, 32219, 7),
  thais: new Position(32369, 32241, 7),
  carlin: new Position(32360, 31782, 7),
  "ab'dendriel": new Position(32732, 31634, 7),
  venore: new Position(32957, 32076, 7),
  poh: new Position(32816, 32260, 9),
  "gm-island": new Position(32316, 31942, 7),
  senja: new Position(32125, 31667, 7),
  dracona: new Position(32804, 31586, 14),
  "orc-fortress": new Position(32882, 31772, 8),
  edron: new Position(33217, 31814, 8),
  kazordoon: new Position(32649, 31925, 11),
  ankrahmun: new Position(33194, 32853, 8),
  darashia: new Position(33213, 32454, 1),
  darama: new Position(33213, 32454, 13),
  cormaya: new Position(33301, 31968, 7),
  fibula: new Position(32174, 32437, 7),
  "white-flower": new Position(32346, 32362, 8),
  "femur-hills": new Position(32536, 31837, 10),
  "ghost-ship": new Position(33321, 32181, 7),
  mintwallin: new Position(32456, 32100, 1),
  cyclopolis: new Position(33251, 31695, 7),
  annihilator: new Position(33221, 31671, 1),
});

CommandHandler.prototype.handleCommandWaypoint = function (player, waypoint) {
  /*
   * CommandHandler.handleCommandWaypoint
   * Executes the waypoint command
   */

  if (!this.WAYPOINTS.hasOwnProperty(waypoint)) {
    return player.sendCancelMessage("This waypoint does not exist.");
  }

  return gameServer.world.creatureHandler.teleportCreature(
    player,
    this.WAYPOINTS[waypoint]
  );
};

CommandHandler.prototype.handleCommandAddSkill = function (
  player,
  skill,
  amount
) {
  if (skill === "level") {
    try {
      // Obter exp atual do objeto skills
      const currentExp = player.skills.experience || 0;
      const currentLevel = Math.floor(currentExp / 100) + 1;
      const targetLevel = currentLevel + Number(amount);


      // Calcular exp necessária
      const Skill = requireModule("utils/skill");
      const skillInstance = new Skill();
      const targetExp = skillInstance.getExperience(targetLevel);
      const currentLevelExp = skillInstance.getExperience(currentLevel);
      const expRequired = targetExp - currentLevelExp;


      // Recalcular atributos baseados no novo level
      const newHealth = 150 + (targetLevel - 1) * 5;
      const newMana = 35 + (targetLevel - 1) * 5;
      const newCap = 400 + (targetLevel - 1) * 10;

      // Atualizar o player em tempo real usando as constantes corretas
      // Primeiro setamos o MAX, depois o atual
      player.setProperty(2, newHealth); // MAX_HEALTH primeiro
      player.setProperty(1, newHealth); // HEALTH depois
      player.setProperty(4, newMana); // MAX_MANA primeiro
      player.setProperty(3, newMana); // MANA depois
      player.setProperty(5, newCap); // CAPACITY

      // Atualizar os valores no objeto properties
      if (player.properties) {
        player.properties.health = newHealth;
        player.properties.maxHealth = newHealth;
        player.properties.mana = newMana;
        player.properties.maxMana = newMana;
        player.properties.capacity = newCap;
      }

      // Salvar no banco de dados
      if (player.socketHandler && player.socketHandler.account) {
        // Criar um objeto com os dados atualizados
        const characterData = {
          position: {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z,
          },
          skills: {
            magic: player.skills.magic || 0,
            fist: player.skills.fist || 10,
            club: player.skills.club || 10,
            sword: player.skills.sword || 10,
            axe: player.skills.axe || 10,
            distance: player.skills.distance || 10,
            shielding: player.skills.shielding || 10,
            fishing: player.skills.fishing || 10,
            experience: currentExp + expRequired,
          },
          properties: {
            name: player.properties.name,
            health: newHealth,
            mana: newMana,
            maxHealth: newHealth,
            maxMana: newMana,
            capacity: newCap,
            speed: player.properties.speed,
            defense: player.properties.defense,
            attack: player.properties.attack,
            attackSpeed: player.properties.attackSpeed,
            direction: player.properties.direction,
            outfit: player.properties.outfit,
            role: player.properties.role,
            vocation: player.properties.vocation,
            sex: player.properties.sex,
            availableOutfits: player.properties.availableOutfits,
          },
          lastVisit: Date.now(),
          containers: player.containers,
          spellbook: player.spellbook,
          friends: player.friends,
          templePosition: {
            x: player.templePosition.x,
            y: player.templePosition.y,
            z: player.templePosition.z,
          },
        };

        // Atualizar o player em memória
        player.skills = characterData.skills;
        player.properties = characterData.properties;

        // Send packets to update client UI immediately
        const newExp = currentExp + expRequired;
        player.write(new CreaturePropertyPacket(player.getId(), CONST.PROPERTIES.EXPERIENCE, newExp));
        player.write(new CreaturePropertyPacket(player.getId(), CONST.PROPERTIES.HEALTH_MAX, newHealth));
        player.write(new CreaturePropertyPacket(player.getId(), CONST.PROPERTIES.HEALTH, newHealth));
        player.write(new CreaturePropertyPacket(player.getId(), CONST.PROPERTIES.MANA_MAX, newMana));
        player.write(new CreaturePropertyPacket(player.getId(), CONST.PROPERTIES.MANA, newMana));
        player.write(new CreaturePropertyPacket(player.getId(), CONST.PROPERTIES.CAPACITY, newCap));
        player.write(new CreaturePropertyPacket(player.getId(), CONST.PROPERTIES.CAPACITY_MAX, newCap));

        const AccountDatabase = requireModule("auth/account-database");
        const db = new AccountDatabase();

        // Create a mock gameSocket object to use saveCharacter
        const mockGameSocket = {
          player: player,
          account: player.socketHandler.account
        };

        // Use the saveCharacter method
        db.saveCharacter(mockGameSocket, function (error) {
          if (error) {
            console.error("[AddSkill] Error saving to database:", error);
          } else {
            console.log("[AddSkill] Character saved successfully to database");
          }
        });
      }

      // Notificar o cliente sobre as mudanças
      return player.sendCancelMessage(
        `Added ${expRequired} exp (${amount} levels). New level: ${targetLevel}`
      );
    } catch (error) {
      console.error("[AddSkill] Error:", error);
      return gameServer.world.broadcastPacket(
        new ServerMessagePacket("An error occurred while adding experience.")
      );
    }
  }

  return gameServer.world.broadcastPacket(
    new ServerMessagePacket("Invalid skill type. Available: level")
  );
};

CommandHandler.prototype.handle = function (player, message) {

  // Only Admin can use commands
  if (player.getProperty(CONST.PROPERTIES.NAME) !== "Admin") {
    return player.sendCancelMessage("You do not have permission to use commands.");
  }

  message = message.split(" ");

  if (message[0] === "/property") {
    return player.setProperty(Number(message[1]), Number(message[2]));
  }

  if (message[0] === "/waypoint") {
    return this.handleCommandWaypoint(player, message[1]);
  }

  if (message[0] === "/teleport") {
    return gameServer.world.creatureHandler.teleportCreature(
      player,
      new Position(Number(message[1]), Number(message[2]), Number(message[3]))
    );
  }

  if (message[0] === "/broadcast") {
    return gameServer.world.broadcastPacket(
      new ServerMessagePacket(message[1])
    );
  }

  if (message[0] === "/m") {
    let arg = message.slice(1).join(" ");
    let id = Number(arg);

    // If not a number, search by name
    if (isNaN(id) || arg === "") {
      let result = gameServer.database.getMonsterByName(arg);
      if (result === null) {
        return player.sendCancelMessage("Monster not found: " + arg);
      }
      id = result.id;
    }

    let success = gameServer.world.creatureHandler.spawnCreature(
      id,
      player.getPosition(),
      player
    );

    if (success) {
      player.sendCancelMessage("Monster summoned.");
    }
  }

  if (message[0] === "/path") {
    let a = player.getPosition();
    let b = a.add(new Position(Number(message[1]), Number(message[2]), 0));
    let p = gameServer.world.findPath(player, a, b, 1);
    p.forEach(function (tile) {
      gameServer.world.sendMagicEffect(
        tile.getPosition(),
        CONST.EFFECT.MAGIC.TELEPORT
      );
    });
  }

  if (message[0] === "/addskill") {
    // Open the admin add-skill modal
    player.write(new (requireModule("network/protocol").AdminAddSkillModalPacket)());
    return;
  }

  // Create item command: /i [item_id_or_name] [count]
  if (message[0] === "/i") {
    let itemArg = message[1];
    let count = 1;
    let itemId = null;

    // Check if first argument is a number (ID)
    if (!isNaN(Number(itemArg))) {
      itemId = Number(itemArg);
      count = Number(message[2]) || 1;
    } else {
      // Try to find by name - join remaining args (except last if it's a number for count)
      let nameArgs = message.slice(1);

      // Check if last arg is a number (count)
      let lastArg = nameArgs[nameArgs.length - 1];
      if (nameArgs.length > 1 && !isNaN(Number(lastArg))) {
        count = Number(lastArg);
        nameArgs = nameArgs.slice(0, -1);
      }

      let itemName = nameArgs.join(" ");
      itemId = gameServer.database.getItemIdByName(itemName);

      if (itemId === null) {
        return player.sendCancelMessage("Item '" + itemName + "' not found. Usage: /i [id_or_name] [count]");
      }
    }

    // Validate item ID
    if (isNaN(itemId) || itemId <= 0) {
      return player.sendCancelMessage("Invalid item. Usage: /i [item_id_or_name] [count]");
    }

    // Create the item
    let thing = gameServer.database.createThing(itemId);

    if (thing === null) {
      return player.sendCancelMessage("Item with ID " + itemId + " does not exist.");
    }

    let itemName = thing.getPrototype().properties?.name || itemId;

    // For stackable items: set count and place once
    if (thing.isStackable()) {
      if (count > 1) {
        thing.setCount(Math.min(count, 100));
      }
      CommandHandler.__placeItem(player, thing);
      return player.sendCancelMessage("Created " + itemName + (count > 1 ? " x" + count : ""));
    }

    // For non-stackable items with count > 1: create and place multiple instances
    let placed = 0;
    for (let i = 0; i < count; i++) {
      let instance = i === 0 ? thing : gameServer.database.createThing(itemId);
      if (instance === null) continue;
      if (CommandHandler.__placeItem(player, instance)) {
        placed++;
      }
    }

    return player.sendCancelMessage("Created " + (placed > 1 ? placed + "x " : "") + itemName);
  }

  if (message[0] === "/goto") {
    let name = message.slice(1).join(" ").toLowerCase();

    // Find the creature
    let target = null;
    let targetName = "";
    let found = false;

    gameServer.world.creatureHandler.__creatureMap.forEach(function (creature) {
      if (found) return;

      // Get creature name using getProperty for consistency
      let creatureName = creature.getProperty(CONST.PROPERTIES.NAME);
      if (creatureName && creatureName.toLowerCase() === name) {
        target = creature;
        targetName = creatureName;
        found = true;
      }
    });

    if (target) {
      let tile = gameServer.world.findAvailableTile(player, target.getPosition());
      if (!tile) {
        return player.sendCancelMessage("No free tile near " + targetName + ".");
      }
      gameServer.world.creatureHandler.teleportCreature(player, tile.position);
      return player.sendCancelMessage("Teleported to " + targetName + ".");
    } else {
      return player.sendCancelMessage("Creature not found: " + name);
    }
  }

  // Spawn NPC command: /npc [npc_name]
  if (message[0] === "/npc") {
    let npcName = message.slice(1).join(" ").toLowerCase();

    if (!npcName) {
      return player.sendCancelMessage("Usage: /npc [npc_name]. Available: cipfried, aldee");
    }

    try {
      // Build path to NPC definition file using process.cwd()
      let npcFile = npcName + ".json";
      let npcPath = path.join(process.cwd(), "data", "npcs", "definitions", npcFile);


      // Clear cache to allow reloading
      if (require.cache[npcPath]) {
        delete require.cache[npcPath];
      }

      let data = require(npcPath);

      // Create and spawn NPC at player position
      let npc = new NPC(data);
      gameServer.world.creatureHandler.addCreatureSpawn(npc, player.getPosition());

      return player.sendCancelMessage("Spawned NPC: " + data.creatureStatistics.name);
    } catch (error) {
      return player.sendCancelMessage("NPC error: " + error.message);
    }
  }

  // Learn all spells command: /learnall
  if (message[0] === "/learnall") {
    // Add all spell IDs (0-19) to player's spellbook
    for (let sid = 0; sid <= 19; sid++) {
      if (!player.spellbook.getAvailableSpells().has(sid)) {
        player.spellbook.addAvailableSpell(sid);
      }
    }
    return player.sendCancelMessage("You have learned all spells (0-19)!");
  }

  // Reset character command: /reset
  if (message[0] === "/reset") {
    // Reset to level 1 stats
    player.skills.experience = 0;
    player.skills.magic = 0;
    player.skills.fist = 10;
    player.skills.club = 10;
    player.skills.sword = 10;
    player.skills.axe = 10;
    player.skills.distance = 10;
    player.skills.shielding = 10;
    player.skills.fishing = 10;

    // Reset properties to level 1 values
    player.setProperty(CONST.PROPERTIES.HEALTH, 150);
    player.setProperty(CONST.PROPERTIES.MAX_HEALTH, 150);
    player.setProperty(CONST.PROPERTIES.MANA, 35);
    player.setProperty(CONST.PROPERTIES.MAX_MANA, 35);
    player.setProperty(CONST.PROPERTIES.CAPACITY, 400);

    // Also update properties object if it exists
    if (player.properties) {
      player.properties.health = 150;
      player.properties.maxHealth = 150;
      player.properties.mana = 35;
      player.properties.maxMana = 35;
      player.properties.capacity = 400;
    }

    return player.sendCancelMessage("Character reset to Level 1! Experience: 0, HP: 150, Mana: 35");
  }

  // Test magic effect command: /z [effect_id]
  if (message[0] === "/z") {
    let effectId = Number(message[1]);

    if (isNaN(effectId) || effectId < 0) {
      return player.sendCancelMessage("Usage: /z [effect_id] - Shows magic effect at your position.");
    }

    gameServer.world.sendMagicEffect(player.getPosition(), effectId);
    return player.sendCancelMessage("Effect " + effectId + " displayed.");
  }

  // Test distance/missile effect command: /x [shoot_type_id]
  if (message[0] === "/x") {
    let shootType = Number(message[1]);

    if (isNaN(shootType) || shootType < 0) {
      return player.sendCancelMessage("Usage: /x [shoot_type_id] - Shoots missile from you.");
    }

    // Get target position (3 tiles in front of player based on direction)
    let from = player.getPosition();
    let direction = player.getProperty(CONST.PROPERTIES.DIRECTION) ?? 2; // Default south
    let dx = 0, dy = 0;

    switch (direction) {
      case 0: dy = -3; break; // North
      case 1: dx = 3; break;  // East
      case 2: dy = 3; break;  // South
      case 3: dx = -3; break; // West
    }

    let to = from.add(new Position(dx, dy, 0));
    gameServer.world.sendDistanceEffect(from, to, shootType);
    return player.sendCancelMessage("Missile " + shootType + " fired.");
  }

  // Bring creature command: /c [name]
  if (message[0] === "/c") {
    let name = message.slice(1).join(" ").toLowerCase();
    if (!name) {
      return player.sendCancelMessage("Usage: /c [player_or_npc_name]");
    }

    let target = null;
    let found = false;

    gameServer.world.creatureHandler.__creatureMap.forEach(function (creature) {
      if (found) return;
      let creatureName = creature.getProperty(CONST.PROPERTIES.NAME);
      if (creatureName && creatureName.toLowerCase() === name) {
        target = creature;
        found = true;
      }
    });

    if (target) {
      gameServer.world.creatureHandler.teleportCreature(target, player.getPosition());
      return player.sendCancelMessage(target.getProperty(CONST.PROPERTIES.NAME) + " summoned.");
    } else {
      return player.sendCancelMessage("Creature not found: " + name);
    }
  }

  // Teleport to temple command: /t
  if (message[0] === "/t") {
    gameServer.world.creatureHandler.teleportCreature(player, player.templePosition);
    return player.sendCancelMessage("Teleported to your temple.");
  }

  // Teleport to town command: /town [name]
  if (message[0] === "/town") {
    let town = message[1];
    if (!town) {
      return player.sendCancelMessage("Usage: /town [name]. Available: " + Object.keys(this.WAYPOINTS).join(", "));
    }

    town = town.toLowerCase();
    if (!this.WAYPOINTS.hasOwnProperty(town)) {
      return player.sendCancelMessage("Town not found: " + town);
    }

    gameServer.world.creatureHandler.teleportCreature(player, this.WAYPOINTS[town]);
    return player.sendCancelMessage("Teleported to " + town + ".");
  }

  // Remove top item command: /r
  if (message[0] === "/r") {
    let facePos = player.getFacePosition();
    let tile = gameServer.world.getTileFromWorldPosition(facePos);

    if (!tile || !tile.hasItems()) {
      return player.sendCancelMessage("Nothing to remove in front of you.");
    }

    let topItem = tile.itemStack.getTopItem();
    if (!topItem) {
      return player.sendCancelMessage("Tile is already clean.");
    }

    let index = tile.itemStack.__items.length - 1;
    tile.removeIndex(index, 1);
    return player.sendCancelMessage("Removed " + topItem.getPrototype().properties.name + ".");
  }

  // Remove all items command: /rr
  if (message[0] === "/rr") {
    let facePos = player.getFacePosition();
    let tile = gameServer.world.getTileFromWorldPosition(facePos);

    if (!tile || !tile.hasItems()) {
      return player.sendCancelMessage("Nothing to remove in front of you.");
    }

    let items = tile.itemStack.__items;
    let removed = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      tile.removeIndex(i, 1);
      removed++;
    }

    return player.sendCancelMessage("Removed " + removed + " items.");
  }

  // Teleport forward command: /a [tiles]
  if (message[0] === "/a") {
    let distance = Number(message[1]);
    if (isNaN(distance) || distance < 1) {
      return player.sendCancelMessage("Usage: /a [number_of_tiles]");
    }

    let from = player.getPosition();
    let direction = player.getProperty(CONST.PROPERTIES.DIRECTION) ?? 2;
    let dx = 0, dy = 0;

    switch (direction) {
      case 0: dy = -distance; break;
      case 1: dx = distance; break;
      case 2: dy = distance; break;
      case 3: dx = -distance; break;
    }

    let targetPos = from.add(new Position(dx, dy, 0));
    gameServer.world.creatureHandler.teleportCreature(player, targetPos);
    return player.sendCancelMessage("Teleported " + distance + " tiles forward.");
  }

  // Save command: /save
  if (message[0] === "/save") {
    gameServer.__saveAllPlayers();
    gameServer.__saveWorldState();
    return player.sendCancelMessage("World saved. Players and houses written to disk.");
  }

  // Anti-cheat control panel: /bot
  if (message[0] === "/bot") {
    const { BotPanelPacket } = requireModule("network/protocol");
    let suspects = gameServer.world.antiCheatManager.getSuspects();
    let cheaters = gameServer.world.antiCheatManager.getCheaters();
    player.write(new BotPanelPacket(suspects, cheaters));
    return player.sendCancelMessage("Opening anti-cheat control panel...");
  }

  // Ban control panel: /ban
  if (message[0] === "/ban") {
    const { BanPanelPacket } = requireModule("network/protocol");
    player.write(new BanPanelPacket());
    return player.sendCancelMessage("Opening ban control panel...");
  }

  // Reload quest files: /reloadquests
  if (message[0] === "/reloadquests") {
    gameServer.questDataLoader.reload();
    return player.sendCancelMessage("Quest files reloaded.");
  }
};

module.exports = CommandHandler;
