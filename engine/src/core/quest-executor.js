"use strict";

const Position = requireModule("utils/position");

const QuestExecutor = function () { }

QuestExecutor.prototype.handleLeverQuest = function (player, tile, item, questAction) {
  const turningOn = item.id === 1945;
  const effects = turningOn ? (questAction.effects || []) : (questAction.effectsAlt || []);

  if (turningOn) {
    if (!this.evaluateConditions(questAction.conditions || [], player, tile, item)) {
      return false;
    }
  }

  this.executeEffects(effects, player, tile, item);
  return true;
}

QuestExecutor.prototype.handleMoveEventOnTile = function (tile, creature, eventType) {
  if (eventType !== "onAddItem" && (!creature || !creature.isPlayer())) {
    // Allow monsters if the quest action explicitly permits it
    const questAction = tile.actionId && gameServer.questDataLoader.getByActionId(tile.actionId);
    if (!questAction || !questAction.allowMonsters) return;
  }

  if (tile.actionId) {
    const questAction = gameServer.questDataLoader.getByActionId(tile.actionId);
    if (questAction && this.__isMoveEventType(questAction)) {
      this.__executeMoveEvent(questAction, creature, tile, eventType, null);
    }
  }

  const items = tile.getItems();
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (!item.actionId) continue;
    const questAction = gameServer.questDataLoader.getByActionId(item.actionId);
    if (questAction && this.__isMoveEventType(questAction)) {
      this.__executeMoveEvent(questAction, creature, tile, eventType, item);
    }
  }
}

QuestExecutor.prototype.__isMoveEventType = function (action) {
  const moveTypes = ["moveEvent", "bridge", "home", "tile", "exit", "entrance", "portal", "wall", "reward", "switch", "seal", "basin"];
  return moveTypes.includes(action.type);
}

QuestExecutor.prototype.isLeverType = function (action) {
  const leverTypes = ["lever", "bridge", "puzzle", "elevator", "switch", "entrance", "portal"];
  return leverTypes.includes(action.type) && (action.itemIds && action.itemIds.length > 0);
}

QuestExecutor.prototype.__executeMoveEvent = function (action, creature, tile, eventType, item) {
  // Skip if this action doesn't handle the requested event type
  const events = action.events || [];
  if (!events.includes(eventType)) return;

  const conditions = action.conditions || [];
  if (!this.evaluateConditions(conditions, creature, tile, item)) return;

  if (creature && action.vocationIds) {
    const vId = creature.getVocation();
    if (!action.vocationIds.includes(vId)) {
      return;
    }
  }

  if (creature && creature.isPlayer() && action.tiles) {
    const tileDef = action.tiles.find(t =>
      t.pos.x === tile.position.x &&
      t.pos.y === tile.position.y &&
      t.pos.z === tile.position.z
    );
    if (tileDef) {
      if (tileDef.vocationIds && !tileDef.vocationIds.includes(creature.getVocation())) {
        if (creature.sendCancelMessage) {
          creature.sendCancelMessage("You are not worthy to step here.");
        }
        return;
      }
      if (tileDef.itemCondition) {
        const cPos = new Position(tileDef.itemCondition.pos.x, tileDef.itemCondition.pos.y, tileDef.itemCondition.pos.z);
        const cTile = gameServer.world.getTileFromWorldPosition(cPos);
        if (!cTile || !cTile.getItems().some(it => it.id === tileDef.itemCondition.itemId)) {
          if (creature.sendCancelMessage) {
            creature.sendCancelMessage("You must place your offering first.");
          }
          return;
        }
      }
    }
  }

  if (action.itemCondition) {
    const condPos = new Position(action.itemCondition.pos.x, action.itemCondition.pos.y, action.itemCondition.pos.z);
    const condTile = gameServer.world.getTileFromWorldPosition(condPos);
    if (!condTile) return;
    const condItems = condTile.getItems();
    if (!condItems.some(it => it.id === action.itemCondition.itemId)) {
      return;
    }
  }

  const effects = eventType === "onStepOut"
    ? (action.effectsOnStepOut || action.effectsAlt || [])
    : (eventType === "onAddItem" ? (action.effectsAddItem || [])
       : (action.effectsOnStepIn || action.effects || []));

  if (effects.length > 0) {
    this.executeEffects(effects, creature, tile, item);
  }

  if (creature && action.storage && creature.isPlayer()) {
    creature.setStorage(action.storage.key, action.storage.value);
  }

  if (eventType === "onStepIn" && creature && action.teleport && creature.isPlayer()) {
    let teleport = action.teleport;
    if (action.vocationIds && action.teleportAlt) {
      const vId = creature.getVocation();
      if (!action.vocationIds.includes(vId)) {
        teleport = action.teleportAlt;
      }
    }
    const toPos = this.__resolveTeleport(teleport, tile);
    if (toPos) {
      gameServer.world.creatureHandler.teleportCreature(creature, toPos);
      if (action.magicEffect !== undefined) {
        gameServer.world.sendMagicEffect(creature.position, action.magicEffect);
      }
      if (action.town) {
        creature.templePosition = toPos;
        if (creature.sendCancelMessage) {
          creature.sendCancelMessage("You became a citizen of " + action.town + "!");
        }
      }
    }
  }
}

QuestExecutor.prototype.handleQuestItemUse = function (player, item, targetItem, targetTile) {
  const questAction = gameServer.questDataLoader.getByItemId(item.id);
  if (!questAction) return false;

  const branches = questAction.branches || [];
  for (const branch of branches) {
    if (this.evaluateConditions(branch.conditions || [], player, targetTile, targetItem)) {
      this.executeEffects(branch.effects || [], player, targetTile, item);
      return true;
    }
  }

  return false;
}

QuestExecutor.prototype.__resolveTeleport = function (teleport, tile) {
  if (teleport.to) {
    return new Position(teleport.to.x, teleport.to.y, teleport.to.z);
  }
  if (teleport.offsetX !== undefined || teleport.offsetY !== undefined) {
    return new Position(
      tile.position.x + (teleport.offsetX || 0),
      tile.position.y + (teleport.offsetY || 0),
      teleport.z !== undefined ? teleport.z : tile.position.z
    );
  }
  return null;
}

QuestExecutor.prototype.evaluateConditions = function (conditions, creature, tile, item) {
  for (const cond of conditions) {
    if (!this.__evaluateCondition(cond, creature, tile, item)) {
      return false;
    }
  }
  return true;
}

QuestExecutor.prototype.__evaluateCondition = function (cond, creature, tile, item) {
  switch (cond.type) {
    case "isPlayer":
      return creature.isPlayer();

    case "notPremium":
      return creature.isPlayer && !creature.isPremium();

    case "itemInPosition":
    case "itemAtPosition": {
      const pos = new Position(cond.pos.x, cond.pos.y, cond.pos.z);
      const targetTile = gameServer.world.getTileFromWorldPosition(pos);
      if (!targetTile) return false;
      const items = targetTile.getItems();
      return items.some(it => it.id === cond.itemId);
    }

    case "storage":
      if (!creature.isPlayer || !creature.isPlayer()) return false;
      const playerVal = creature.getStorage(cond.key);
      const comparison = cond.comparison || "==";
      return this.__compareValues(playerVal, cond.value, comparison);

    case "targetItem":
      return item && item.id === cond.itemId;

    case "position":
      return creature.position.x === cond.x &&
             creature.position.y === cond.y &&
             creature.position.z === cond.z;

    case "levelLessThan":
      return creature.isPlayer && creature.isPlayer() && creature.getLevel() < cond.value;

    case "levelGreaterThan":
      return creature.isPlayer && creature.isPlayer() && creature.getLevel() > cond.value;

    case "level": {
      if (!creature.isPlayer || !creature.isPlayer()) return false;
      const comparison = cond.comparison || "==";
      return this.__compareValues(creature.getLevel(), cond.value, comparison);
    }

    case "vocationId": {
      if (!creature.isPlayer || !creature.isPlayer()) return false;
      const ids = Array.isArray(cond.vocationIds) ? cond.vocationIds : [cond.vocationIds];
      return ids.includes(creature.getVocation());
    }

    case "actionId":
      return tile && tile.actionId === cond.value;

    case "tilePos":
      return tile && tile.position.x === cond.x && tile.position.y === cond.y && tile.position.z === cond.z;

    case "flagActive":
      if (!gameServer.questFlags) return false;
      const expires = gameServer.questFlags[cond.key];
      return expires && Date.now() < expires;

    default:
      return true;
  }
}

QuestExecutor.prototype.__compareValues = function (a, b, comparison) {
  switch (comparison) {
    case "==": case "===": return a === b;
    case "!=": case "!==": return a !== b;
    case "<": return a < b;
    case "<=": return a <= b;
    case ">": return a > b;
    case ">=": return a >= b;
    default: return a == b;
  }
}

QuestExecutor.prototype.executeEffects = function (effects, creature, tile, item) {
  for (const effect of effects) {
    try {
      this.__executeEffect(effect, creature, tile, item);
    } catch (err) {
      console.error("[QuestExecutor] effect error: %s".format(err.message));
    }
  }
}

QuestExecutor.prototype.__executeEffect = function (effect, creature, tile, item) {
  switch (effect.type) {
    case "transformItem":
      this.__effectTransformItem(effect, tile, item);
      break;
    case "transformItemInPosition":
      this.__effectTransformItemInPosition(effect);
      break;
    case "removeItem":
      this.__effectRemoveItem(effect);
      break;
    case "createItem":
      this.__effectCreateItem(effect, creature);
      break;
    case "createTile":
      this.__effectCreateTile(effect);
      break;
    case "relocate":
      this.__effectRelocate(effect, creature);
      break;
    case "magicEffect":
      if (effect.pos) {
        const pos = new Position(effect.pos.x, effect.pos.y, effect.pos.z);
        gameServer.world.sendMagicEffect(pos, effect.effectId);
      } else if (effect.effectId !== undefined) {
        gameServer.world.sendMagicEffect(creature.position, effect.effectId);
      }
      break;
    case "createMonster":
      this.__effectCreateMonster(effect);
      break;
    case "storage":
      if (creature.isPlayer && creature.isPlayer()) {
        creature.setStorage(effect.key, effect.value);
      }
      break;
    case "setTown":
      if (creature.isPlayer && creature.isPlayer()) {
        creature.templePosition = creature.position;
        var townName = effect.town || effect.name || "a new city";
        if (creature.sendCancelMessage) {
          creature.sendCancelMessage("You became a citizen of " + townName + "!");
        }
      }
      break;
    case "sendMessage":
      if (creature.isPlayer && creature.isPlayer() && creature.sendCancelMessage) {
        creature.sendCancelMessage(effect.message || "");
      }
      break;
    case "setFlag":
      gameServer.questFlags = gameServer.questFlags || {};
      gameServer.questFlags[effect.key] = Date.now() + (effect.duration || 30000);
      break;
    case "monsterGoto":
      this.__effectMonsterGoto(effect);
      break;
  }
}

QuestExecutor.prototype.__effectMonsterGoto = function (effect) {
  if (!effect.monsterName || !effect.targetActionId || !effect.centerPos) return;

  const centerPos = new Position(effect.centerPos.x, effect.centerPos.y, effect.centerPos.z);
  const radius = effect.radius || 10;
  const targetName = effect.monsterName.toLowerCase();

  // Find the tile with the target actionId
  let targetPos = null;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const checkPos = new Position(centerPos.x + dx, centerPos.y + dy, centerPos.z);
      const tile = gameServer.world.getTileFromWorldPosition(checkPos);
      if (tile && tile.actionId === effect.targetActionId) {
        targetPos = tile.getPosition();
        break;
      }
    }
    if (targetPos) break;
  }
  if (!targetPos) return;

  // Find all monsters of the given name within the radius and set their goto position
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const checkPos = new Position(centerPos.x + dx, centerPos.y + dy, centerPos.z);
      const tile = gameServer.world.getTileFromWorldPosition(checkPos);
      if (!tile || tile.id === 0 || !tile.creatures) continue;

      for (const creature of tile.creatures) {
        if (creature.isMonster && creature.isMonster() &&
            creature.getProperty(CONST.PROPERTIES.NAME).toLowerCase() === targetName &&
            creature.behaviourHandler) {
          creature.behaviourHandler.setGotoPosition(targetPos);
        }
      }
    }
  }
}

QuestExecutor.prototype.__effectTransformItem = function (effect, tile, item) {
  const from = effect.from;
  const to = effect.to;
  if (item && item.id === from) {
    const newItem = gameServer.database.createThing(to);
    if (newItem) {
      if (item.actionId) newItem.setActionId(item.actionId);
      if (effect.decay && item.duration !== undefined) {
        newItem.setDuration(item.getRemainingDuration());
      }
      item.replace(newItem);
    }
  }
}

QuestExecutor.prototype.__effectTransformItemInPosition = function (effect) {
  const pos = new Position(effect.pos.x, effect.pos.y, effect.pos.z);
  const targetTile = gameServer.world.getTileFromWorldPosition(pos);
  if (!targetTile) return;
  const items = targetTile.getItems();
  for (const it of items) {
    if (it.id === effect.from) {
      const newItem = gameServer.database.createThing(effect.to);
      if (newItem) {
        it.replace(newItem);
      }
      break;
    }
  }
}

QuestExecutor.prototype.__effectRemoveItem = function (effect) {
  const pos = new Position(effect.pos.x, effect.pos.y, effect.pos.z);
  const targetTile = gameServer.world.getTileFromWorldPosition(pos);
  if (!targetTile) return;
  const items = targetTile.getItems();
  for (const it of items) {
    if (it.id === effect.itemId) {
      it.delete();
      return;
    }
  }
}

QuestExecutor.prototype.__effectCreateItem = function (effect, creature) {
  let pos;
  if (effect.pos === "playerPosition" || (effect.pos && effect.pos.x === undefined && creature)) {
    pos = creature.position;
  } else if (effect.pos) {
    pos = new Position(effect.pos.x, effect.pos.y, effect.pos.z);
  } else {
    return;
  }
  const targetTile = gameServer.world.getTileFromWorldPosition(pos);
  if (!targetTile) return;
  const newItem = gameServer.database.createThing(effect.itemId);
  if (newItem) {
    if (effect.count && newItem.isStackable()) {
      newItem.setCount(Math.min(effect.count, 255));
    }
    targetTile.addTopThing(newItem);
  }
}

QuestExecutor.prototype.__effectCreateTile = function (effect) {
  const pos = new Position(effect.pos.x, effect.pos.y, effect.pos.z);
  const targetTile = gameServer.world.getTileFromWorldPosition(pos);
  if (!targetTile) return;
  if (effect.effectId !== undefined) {
    targetTile.replace(effect.effectId);
    const { ItemRemovePacket, ItemAddPacket } = requireModule("network/protocol");
    targetTile.broadcast(new ItemRemovePacket(pos, 0, 0));
    targetTile.broadcast(new ItemAddPacket(pos, { id: effect.effectId, count: 0 }, 0));
  }
}

QuestExecutor.prototype.__effectRelocate = function (effect, creature) {
  if (!effect.to) return;
  const toPos = new Position(effect.to.x, effect.to.y, effect.to.z);

  if (effect.from && effect.from.x !== undefined) {
    const fromPos = new Position(effect.from.x, effect.from.y, effect.from.z);
    const creatureHandler = gameServer.world.creatureHandler;
    creatureHandler.forEachCreature(function (cr) {
      if (cr.position && cr.position.equals(fromPos)) {
        creatureHandler.teleportCreature(cr, toPos);
      }
    });
  } else {
    gameServer.world.creatureHandler.teleportCreature(creature, toPos);
  }
}

QuestExecutor.prototype.__effectCreateMonster = function (effect) {
  if (!effect.name || !effect.pos) return;
  try {
    const Monster = requireModule("monster/monster");
    const monster = new Monster(effect.name);
    gameServer.world.creatureHandler.addCreatureSpawn(monster, effect.pos);
  } catch (err) {
    console.error("[QuestExecutor] createMonster: %s".format(err.message));
  }
}

module.exports = QuestExecutor;
