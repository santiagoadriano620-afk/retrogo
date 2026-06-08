"use strict";

const EventEmitter = requireModule("core/eventemitter");
const FocusHandler = requireModule("npc/npc-focus-handler");
const TradingHandler = requireModule("npc/npc-trade-handler");
const Position = requireModule("utils/position");

var __spellDefinitions = null;
var __spellKeywordMap = null;

function __ensureSpellDefinitions() {
  if (__spellDefinitions !== null) return;
  __spellDefinitions = requireData("spells", "definitions.json");
  __spellKeywordMap = {};
  for (var id in __spellDefinitions) {
    var spell = __spellDefinitions[id];
    var name = spell.name.toLowerCase();
    __spellKeywordMap[name] = parseInt(id);
    var words = name.split(/\s+/);
    for (var w = 0; w < words.length; w++) {
      if (words[w].length > 1 && !__spellKeywordMap[words[w]]) {
        __spellKeywordMap[words[w]] = parseInt(id);
      }
    }
  }
}

const ConversationHandler = function (npc, conversation) {

  /*
   * Class ConversationHandler
   * Code that handles NPC interaction with players
   *
   * Public API:
   *
   * @ConversationHandler.getFocus() - return the focus of the conversation
   * @ConversationHandler.respond(message, color) - NPC responds to a query and extend the idle timer
   * @ConversationHandler.say(message, color) - NPC says something without extending the idle timer
   * @ConversationHandler.emote(message, color) - Sends an emote message to the NPC
   * @ConversationHandler.enterAlert(player) - Call to fire the alert event
   * @ConversationHandler.hasSeen(player) - Returns true if the NPC has seen the player
   * @ConversationHandler.isInConversation(player) - returns true if the NPC is in a conversation (with a player)
   * @ConversationHandler.handleResponse(player, keyword) - internal function that handles response for particular keywords
   * @ConversationHandler.getTalkStateHandler() - returns the talk state handler
   * @ConversationHandler.getFocusHandler() - returns the focus handler
   * @ConversationHandler.setBaseState(baseState) - sets the base state in a conversation scripts
   * @ConversationHandler.setTalkState(baseState) - sets a new talk state in the conversation scripts
   * @ConversationHandler.getHearingRange() - returns the hearing range of the NPC conversation handler
   *
   */

  // Inherits for events
  EventEmitter.call(this);

  // Save a reference to the parent NPC class
  this.npc = npc;

  // Weak set of players that have been spotted before (enter events)
  this.__seenCreatures = new WeakSet();

  // Sensible defaults
  this.conversation = new Object({
    "hearingRange": 5,
    "trade": new Object({ "items": new Array() }),
    "keywords": new Object(),
    "farewells": new Array(),
    "greetings": new Array(),
    "sayings": new Object({
      "texts": new Array(),
      "rate": 300,
      "chance": 1.0
    }),
    "script": null
  });

  // Overwrite
  Object.assign(this.conversation, conversation);

  // Handler for trades
  this.tradeHandler = new TradingHandler(npc, this.conversation.trade);

  // Handler for focus on player
  this.__focusHandler = new FocusHandler(this);
  this.__focusHandler.on("focusIdle", this.__resetEmitter.bind(this, "idle"));
  this.__focusHandler.on("focusLogout", this.__resetEmitter.bind(this, "exit"));
  this.__focusHandler.on("focusMove", this.__handleFocusMove.bind(this));

  // If there is a script we must attach it to the NPC
  this.__loadScript(conversation.script);

}

// Set the prototype and constructor
ConversationHandler.prototype = Object.create(EventEmitter.prototype);
ConversationHandler.prototype.constructor = ConversationHandler;

ConversationHandler.prototype.getHearingRange = function () {

  /*
   * Function ConversationHandler.getHearingRange
   * Returns the hearing range of the conversation handler
   */

  return this.conversation.hearingRange;

}

ConversationHandler.prototype.__handleFocusMove = function () {

  /*
   * Function ConversationHandler.__handleFocusMove
   * Callback that is fired when the focus moves around 
   */

  let focus = this.getFocus();

  // Always face the focus
  this.npc.faceCreature(focus);

  // If the focus moves outside of range
  if (!this.npc.isWithinHearingRange(focus)) {
    return this.__resetEmitter("exit");
  }

}

ConversationHandler.prototype.getFocus = function () {

  /*
   * Function FocusHandler.getFocus
   * Returns the current focus of the conversation
   */

  return this.__focusHandler.getFocus();

}

ConversationHandler.prototype.respond = function (message, color) {

  /*
   * Function ConversationHandler.respond
   * Function to call to respond to a player query and extend the idle duration
   */

  // Extend the idle duration
  if (this.isInConversation()) {
    this.getFocusHandler().extendFocus(message.length * 4);
  }

  this.say(message, color);

}

ConversationHandler.prototype.emote = function (message, color) {

  /*
   * Function ConversationHandler.emote
   * Emotes a message above the NPC
   */

  this.npc.emote(message, color);

}

ConversationHandler.prototype.privateSay = function (player, message, color) {

  /*
   * Function ConversationHandler.privateSay
   * Says a message to only a single player
   */

  this.npc.privateSay(player, message, color);

}

ConversationHandler.prototype.say = function (message, color) {

  /*
   * Function ConversationHandler.say
   * Function to call to say something without extending the idle duration
   */

  // Delegate to the parent NPC's speech handler to say the text (default to LIGHTGREEN)
  this.npc.speechHandler.internalCreatureSay(message, color || CONST.COLOR.YELLOW);

}

ConversationHandler.prototype.hasSayings = function () {

  /*
   * Function ConversationHandler.hasSayings
   * Returns true if the NPC has sayings
   */

  return this.getSayings().texts.length > 0;

}

ConversationHandler.prototype.getSayings = function () {

  /*
   * Function ConversationHandler.getSayings
   * Returns the configured sayings of the NPC
   */

  return this.conversation.sayings;

}

ConversationHandler.prototype.enterAlert = function (creature) {

  /*
   * Function ConversationHandler.enterAlert
   * Alerts the NPC that a creature has entered the range
   */

  this.__seenCreatures.add(creature);

  this.emit("enter", creature);

}

ConversationHandler.prototype.hasSeen = function (creature) {

  /*
   * Function ConversationHandler.hasSeen
   * Returns true if the NPC has already seen the creature
   */

  return this.__seenCreatures.has(creature);

}

ConversationHandler.prototype.isInConversation = function (player) {

  /*
   * Function ConversationHandler.isInConversation
   * Returns true if the NPC is occupied in a conversation
   */

  return this.getFocusHandler().isInConversation(player);

}

ConversationHandler.prototype.handleResponse = function (player, message) {

  /*
   * Function ConversationHandler.handleResponse
   * Handles an incoming keyword from a particular player
   */

  // Check custom greeting patterns first (ADDRESS behavior)
  if (this.__matchGreetingPattern(player, message)) {
    return;
  }

  // Check for punishment keywords (always, regardless of conversation state)
  let matchedPunishment = this.__matchPunishmentKeyword(message);
  if (matchedPunishment !== null) {
    this.__applyPunishment(player, matchedPunishment);
  }

  // Accept incoming greetings from anyone
  if (this.__isGreeting(message)) {
    return this.__handleGreeting(player);
  }

  // The current player is not speaking 
  if (!this.isInConversation(player)) {
    return;
  }

  // Confirm the message is a goodbye
  if (this.__isGoodbye(message)) {
    return this.__resetEmitter("defocus");
  }

  // Check if currently in a topic-based conversation
  let currentTopic = this.getFocusHandler().getCurrentTopic();
  if (currentTopic !== null) {
    return this.__handleTopic(player, message, currentTopic);
  }

  // Match using default configured keywords (supports $ and * wildcards)
  let matchedKeyword = this.__matchDefaultKeyword(message);
  if (matchedKeyword !== null) {
    let response = this.conversation.keywords[matchedKeyword];
    // Check if this keyword transitions to a topic
    if (this.conversation.keywordNextTopics && this.conversation.keywordNextTopics[matchedKeyword] !== undefined) {
      this.getFocusHandler().setCurrentTopic(this.conversation.keywordNextTopics[matchedKeyword]);
      // Set topic state price if keyword has a specific price
      if (this.conversation.keywordTopicPrices && this.conversation.keywordTopicPrices[matchedKeyword] !== undefined) {
        let price = this.conversation.keywordTopicPrices[matchedKeyword];
        // Check if this topic sells a blessing (has setQuest with questId matching STORAGE_KEYS)
        let topicId = this.conversation.keywordNextTopics[matchedKeyword];
        if (topicId !== undefined && CONFIG.BLESSINGS) {
          let topic = this.conversation.topics[topicId];
          if (topic && topic.entries) {
            for (let entry of topic.entries) {
              if (entry.actions) {
                for (let action of entry.actions) {
                  if ((action.type === 'setQuest' && CONFIG.BLESSINGS.STORAGE_KEYS.indexOf(action.questId) !== -1) || action.type === 'buyBlessing') {
                    price = player.getBlessingPrice();
                    break;
                  }
                }
              }
            }
          }
        }
        this.getFocusHandler().getTopicState().price = price;
        // Replace %d placeholder in response with actual price
        if (typeof response === 'string' && response.indexOf('%d') !== -1) {
          response = response.replace(/%d/g, price);
        }
      }

      // Set topic state spell ID if keyword has a spell mapping
      if (this.conversation.keywordTopicSpellIds && this.conversation.keywordTopicSpellIds[matchedKeyword] !== undefined) {
        this.getFocusHandler().getTopicState().type = this.conversation.keywordTopicSpellIds[matchedKeyword];
      }

      // Fallback: auto-infer spell ID from keyword if not set
      if (!this.getFocusHandler().getTopicState().type) {
        var inferredId = __inferSpellFromKeyword(matchedKeyword);
        if (inferredId !== null) {
          this.getFocusHandler().getTopicState().type = inferredId;
        }
      }

      // Set topic state magic level requirement if keyword has a ml mapping
      if (this.conversation.keywordTopicMagicLevels && this.conversation.keywordTopicMagicLevels[matchedKeyword] !== undefined) {
        this.getFocusHandler().getTopicState().amount = this.conversation.keywordTopicMagicLevels[matchedKeyword];
      }

      // Fallback: set topic state magic level from spell definition level
      if (!this.getFocusHandler().getTopicState().amount && this.getFocusHandler().getTopicState().type > 0) {
        var spellDef = __getSpellDefinition(this.getFocusHandler().getTopicState().type);
        if (spellDef) {
          this.getFocusHandler().getTopicState().amount = spellDef.level || 0;
        }
      }
    }
    // Auto-evaluate topic if in spell purchase context
    var ts = this.getFocusHandler().getTopicState();
    if (ts.type > 0) {
      // Check keyword response for vocation gating — respond directly instead of auto-evaluating
      var kwResp = this.conversation.keywords[matchedKeyword];
      if (typeof kwResp === 'string' && kwResp.match(/only for/i)) {
        this.respond(kwResp);
        this.getFocusHandler().setCurrentTopic(null);
        return;
      }
      return this.__handleTopic(player, "yes", this.conversation.keywordNextTopics[matchedKeyword]);
    }
    this.respond(response);
    return;
  }

  // Delegate to the NPC script (base talk state)
  if (this.getTalkStateHandler().isDefaultState()) {
    this.getTalkStateHandler().handle(player, message);
    return;
  }

  // Non-default talk state: script handles it
  this.getTalkStateHandler().handle(player, message);

}

ConversationHandler.prototype.getTalkStateHandler = function () {

  /*
   * Function ConversationHandler.getTalkStateHandler
   * Returns the focus state talk state handler
   */

  return this.getFocusHandler().getTalkStateHandler();

}

ConversationHandler.prototype.getFocusHandler = function () {

  /*
   * Function ConversationHandler.getFocusHandler
   * Returns the focus handler
   */

  return this.__focusHandler;

}

ConversationHandler.prototype.setBaseState = function (baseState) {

  /*
   * Function ConversationHandler.setBaseState
   * Delegates to the talk state handler and sets a new configured base state from the cusstom script
   */

  this.getTalkStateHandler().setBaseState(baseState);

}

ConversationHandler.prototype.setTalkState = function (talkState, propertyState) {

  /*
   * Function ConversationHandler.setTalkState
   * Sets the current NPC talk state to a particular callback function that needs to be implemented
   */

  this.getTalkStateHandler().setTalkState(talkState, propertyState);

}

ConversationHandler.prototype.__loadScript = function (script) {

  /*
   * Function ConversationHandler.__loadScript
   * Loads the NPC script definitions from disk
   */

  // Does not exist (null or undefined)
  if (!script) {
    return;
  }

  // Call the script
  require(getDataFile("npcs", "definitions", "script", script)).call(this);

}

ConversationHandler.prototype.__keywordInMessage = function (message, kw) {

  /*
   * Function ConversationHandler.__keywordInMessage
   * Returns true if the keyword (with optional $ suffix) is present in the message
   */

  let lcMessage = message.toLowerCase();
  let lcKey = kw.toLowerCase();

  // $ suffix: exact word boundary match
  if (lcKey.endsWith('$')) {
    return lcMessage.split(/\s+/).includes(lcKey.slice(0, -1));
  }

  // Default: substring match
  return lcMessage.includes(lcKey);

}

ConversationHandler.prototype.__matchGreetingPattern = function (player, message) {

  /*
   * Function ConversationHandler.__matchGreetingPattern
   * Checks if the player's message matches a configured greeting pattern (ADDRESS behavior)
   * Returns true if a pattern matched and was handled
   */

  if (!this.conversation.greetingPatterns || this.conversation.greetingPatterns.length === 0) {
    return false;
  }

  for (const pattern of this.conversation.greetingPatterns) {
    const allMatch = pattern.keywords.every(kw => this.__keywordInMessage(message, kw));
    if (!allMatch) continue;

    // Use the pattern's own response, or the first non-null response from another pattern
    // (so "hi" responds with the same custom message as "hello")
    let responseText = pattern.response;
    if (responseText === null) {
      for (const other of this.conversation.greetingPatterns) {
        if (other.response !== null) {
          responseText = other.response;
          break;
        }
      }
    }

    if (responseText !== null) {
      let res = responseText.replace(/%N/g, player.name);
      this.respond(res);
    }

    if (!pattern.idle && !this.isInConversation()) {
      this.__acceptConversation(player);
    }

    return true;
  }

  return false;

}

ConversationHandler.prototype.__handleTopic = function (player, message, topicNum) {

  /*
   * Function ConversationHandler.__handleTopic
   * Handles a player's message within a topic-based conversation
   */

  let topic = this.conversation.topics[topicNum];
  if (!topic || !topic.entries) {
    this.getFocusHandler().setCurrentTopic(null);
    return;
  }

  var topicState = this.getFocusHandler().getTopicState();

  // Phase 1: conditional entries (vocation, quest, premium, gold, pzblock, etc.)
  // Pure gold conditions are only skipped for spell topics (handled in Phase 2 ordering)
  for (let entry of topic.entries) {
    if (entry.isDefault) continue;
    if (!entry.conditions || entry.conditions.length === 0) continue;
    // Skip pure gold conditions for spell topics — handled in Phase 2 gating order below
    if (topicState.type > 0 && entry.conditions.every(c => c.type === 'gold')) continue;

    if (!entryHasKeywordMatch(entry, message)) continue;
    if (!this.__checkTopicConditions(player, entry.conditions)) continue;

    return executeEntry(this, player, entry);
  }

  // Phase 2: spell purchase gating in fixed priority order
  if (topicState.type > 0) {

    // 2a. Already known
    for (let entry of topic.entries) {
      if (entry.isDefault) continue;
      if (!entryHasKeywordMatch(entry, message)) continue;
      var resp = entry.response || "";
      if (resp.match(/(already|know)/i) && !resp.match(/(don|do not|not|need)/i)) {
        if (playerKnowsSpell(player, topicState.type)) {
          return executeEntry(this, player, entry);
        }
        break;
      }
    }

    // 2b. Magic level
    for (let entry of topic.entries) {
      if (entry.isDefault) continue;
      if (!entryHasKeywordMatch(entry, message)) continue;
      var resp = entry.response || "";
      if (resp.match(/%A|magic level/i)) {
        if (!playerMeetsMagicLevel(player, topicState.amount || 0)) {
          return executeEntry(this, player, entry);
        }
        break;
      }
    }

    // 2c. Gold (entries with gold conditions)
    for (let entry of topic.entries) {
      if (entry.isDefault) continue;
      if (!entry.conditions) continue;
      var goldCond = entry.conditions.find(c => c.type === 'gold');
      if (!goldCond) continue;
      if (!entryHasKeywordMatch(entry, message)) continue;
      if (!this.__checkTopicConditions(player, entry.conditions)) continue;
      return executeEntry(this, player, entry);
    }

    // 2d. Success (deleteMoney)
    for (let entry of topic.entries) {
      if (entry.isDefault) continue;
      if (!entryHasKeywordMatch(entry, message)) continue;
      if (entryHasAction(entry, "deleteMoney")) {
        return executeEntry(this, player, entry);
      }
    }
  }

  // Phase 3: remaining unconditional entries (fallback for non-spell topics)
  for (let entry of topic.entries) {
    if (entry.isDefault) continue;
    if (entry.conditions && entry.conditions.length > 0) continue;

    if (!entryHasKeywordMatch(entry, message)) continue;

    return executeEntry(this, player, entry);
  }

  // Phase 4: try default entry
  let defaultEntry = topic.entries.find(e => e.isDefault);
  if (defaultEntry) {
    if (defaultEntry.response) {
      this.respond(defaultEntry.response);
    }
    if (defaultEntry.nextTopic !== null && defaultEntry.nextTopic !== undefined) {
      this.getFocusHandler().setCurrentTopic(defaultEntry.nextTopic);
    } else {
      this.getFocusHandler().setCurrentTopic(null);
    }
    return;
  }

  // No default entry: clear topic
  this.getFocusHandler().setCurrentTopic(null);

}

ConversationHandler.prototype.__handleGreeting = function (player) {

  /*
   * Function ConversationHandler.__handleGreeting
   * Sets current NPC focus on the player
   */

  // If the NPC is not already focused: obtain a new focus
  if (!this.isInConversation()) {
    return this.__acceptConversation(player);
  }

  // Already speaking to the player
  if (this.isInConversation(player)) {
    if (!this.conversation.script) {
      this.respond("Yes?");
    }
    return this.emit("regreet", this.getFocus());
  }

  // Already chatting with another player
  return this.emit("busy", this.getFocus(), player);

}

ConversationHandler.prototype.__acceptConversation = function (player) {

  /*
   * Function ConversationHandler.__acceptConversation
   * Accepts the current passed player as the NPCs focus
   */

  // Set the state
  this.getFocusHandler().setFocus(player);

  // Face the current focus
  this.npc.faceCreature(this.getFocus());

  // Default greeting for NPCs without scripts
  if (!this.conversation.script) {
    this.respond("Hello, %s!".format(player.name));
  }

  // Emit focus event that custom NPC scripts can subscribe to
  this.emit("focus", player);

}

ConversationHandler.prototype.abort = function () {

  /*
   * Function ConversationHandler.abort
   * Aborts the conversation (e.g., when entering a scene)
   */

  this.__resetEmitter("abort");

}

ConversationHandler.prototype.__resetEmitter = function (which) {

  /*
   * Function ConversationHandler.__resetEmitter
   * Wrapper for emitters that reset the full conversation (e.g., exit)
   */

  let player = this.getFocus();

  // Default responses for NPCs without scripts
  if (!this.conversation.script && player) {
    if (which === "defocus") {
      this.say("Goodbye, %s!".format(player.name));
    } else if (which === "exit") {
      this.say("Come back soon!");
    }
  }

  // Emit the right event
  this.emit(which, player);

  // Reset the focus and state
  this.getFocusHandler().reset();

  // Pause actions for a brief moment
  this.npc.pauseActions(50);

}

ConversationHandler.prototype.__applyPunishment = function (player, keyword) {

  /*
   * Function ConversationHandler.__applyPunishment
   * Applies punishment (damage + burning + effects) for bad words
   */

  if (!this.conversation.punishments) return;
  let p = this.conversation.punishments[keyword];
  if (!p) return;

  let npc = this.npc;
  let npcPos = npc.position;

  // Effect on self (NPC)
  if (p.effectSelf !== null) {
    gameServer.world.sendMagicEffect(npcPos, p.effectSelf);
  }

  // Effect on target (player)
  if (p.effectTarget !== null) {
    gameServer.world.sendMagicEffect(player.position, p.effectTarget);
  }

  // Exception: King's guards reduce player to 1 HP
  if (npc.name === "Harsky" || npc.name === "Stutch") {
    player.setProperty(CONST.PROPERTIES.HEALTH, 1);
    return;
  }

  // All other NPCs: fire field-style burning (20 initial + 10/tick × 7 ticks at 9s intervals)
  player.addCondition(CONST.CONDITION.BURNING, 7, 9000, null);

}

ConversationHandler.prototype.__checkTopicConditions = function (player, conditions) {

  /*
   * Function ConversationHandler.__checkTopicConditions
   * Checks if all conditions for a topic entry are met
   */

  for (let cond of conditions) {
    switch (cond.type) {
      case 'gold':
        let totalGold = player.containerManager.equipment.getTotalGold();
        let topicState = this.getFocusHandler().getTopicState();
        let minGold = cond.min === -1 ? (topicState.price || 0) : (cond.min || 0);
        let maxGold = cond.max === -1 ? (topicState.price || 0) : (cond.max !== undefined ? cond.max : -1);
        if (minGold > 0 && totalGold < minGold) return false;
        if (maxGold >= 0 && totalGold >= maxGold) return false;
        break;

      case 'level':
        let playerLevel = player.getLevel();
        if (playerLevel < cond.max) return false;
        break;

      case 'vocation':
        let playerVoc = player.getVocation();
        let match = cond.vocations.some(v => {
          switch (v) {
            case 'knight': return playerVoc === CONST.VOCATION.KNIGHT || playerVoc === CONST.VOCATION.ELITE_KNIGHT;
            case 'paladin': return playerVoc === CONST.VOCATION.PALADIN || playerVoc === CONST.VOCATION.ROYAL_PALADIN;
            case 'sorcerer': return playerVoc === CONST.VOCATION.SORCERER || playerVoc === CONST.VOCATION.MASTER_SORCERER;
            case 'druid': return playerVoc === CONST.VOCATION.DRUID || playerVoc === CONST.VOCATION.ELDER_DRUID;
            default: return false;
          }
        });
        if (!match) return false;
        break;

      case 'premium':
        if (!CONFIG.GAME.travelOnlyPremium) break;
        if (!player.isPremium()) return false;
        break;

      case 'pzblock':
        // Player in protection zone or refresh zone cannot travel
        if (player.position && gameServer && gameServer.world) {
          let tile = gameServer.world.getTileFromWorldPosition(player.position);
          if (tile && tile.isProtectionZone()) {
            return false;
          }
        }
        break;

      case 'blessing':
        let blessKey = CONFIG.BLESSINGS.STORAGE_KEYS[cond.index];
        if (blessKey !== undefined) {
          let hasBless = player.getStorage(blessKey) !== -1;
          if (cond.state === true && !hasBless) return false;
          if (cond.state === false && hasBless) return false;
        }
        break;

      case 'questValue':
        let stored = player.getStorage(cond.questId);
        if (stored === -1) stored = 0;
        if (cond.minValue !== undefined && stored < cond.minValue) return false;
        if (cond.value !== undefined && stored !== cond.value) return false;
        break;

      case 'itemCount':
        let totalCount = player.containerManager.equipment.getItemCount(cond.itemId);
        let minCount = cond.min;
        if (cond.usePrice) {
          minCount = this.getFocusHandler().getTopicState().price || 0;
        } else if (minCount === -1) {
          minCount = this.getFocusHandler().getTopicState().amount || 0;
        }
        if (totalCount < minCount) return false;
        break;

      case 'magicLevel':
        let playerMl = player.skills ? player.skills.getSkillLevel(CONST.PROPERTIES.MAGIC) : 0;
        let requiredMl = cond.min !== undefined ? (cond.min === -1 ? (this.getFocusHandler().getTopicState().amount || 0) : cond.min) : 0;
        if (playerMl < requiredMl) return false;
        break;

      case 'spellLearned':
        let sid = cond.spellId !== undefined ? cond.spellId : (this.getFocusHandler().getTopicState().type || 0);
        if (sid > 0 && player.spellbook) {
          let hasSpell = player.spellbook.getAvailableSpells().has(sid);
          if (cond.state === false && hasSpell) return false;
          if (cond.state !== false && !hasSpell) return false;
        }
        break;
    }
  }

  return true;

}

ConversationHandler.prototype.__executeTopicActions = function (player, actions) {

  /*
   * Function ConversationHandler.__executeTopicActions
   * Executes a list of actions for a topic entry
   */

  for (let action of actions) {
    switch (action.type) {
      case 'deleteMoney':
        let amount = action.amount;
        if (amount === -1) {
          amount = this.getFocusHandler().getTopicState().price || 0;
        }
        player.containerManager.equipment.payWithResource(player.containerManager.equipment.CURRENCY.GOLD_COIN, amount);
        // Auto-teach spell if in spell purchase context
        var tt = this.getFocusHandler().getTopicState().type;
        if (tt > 0 && player.spellbook) {
          player.spellbook.addAvailableSpell(tt);
          player.setStorage(2000 + tt, 1);
        }
        break;

      case 'createItem':
        let itemId = action.id;
        if (itemId === -1) {
          itemId = this.getFocusHandler().getTopicState().type || 0;
        }
        if (itemId <= 0) break;
        let thing = process.gameServer.database.createThing(itemId);
        let backpack = player.containerManager.equipment.peekIndex(CONST.EQUIPMENT.BACKPACK);
        if (backpack && thing) {
          backpack.addFirstEmpty(thing);
        }
        break;

      case 'setQuest':
        // SetQuestValue(N)=T(M) or SetQuestValue(N,M)
        if (action.value !== undefined) {
          player.setStorage(action.questId, action.value);
        } else if (action.storageKey !== undefined) {
          player.setStorage(action.storageKey, action.questId);
        }
        break;

      case 'setPrice':
        this.getFocusHandler().getTopicState().price = action.amount;
        break;

      case 'setAmount':
        if (action.amount === -1) {
          this.getFocusHandler().getTopicState().amount = this.getFocusHandler().getTopicState().price || 0;
        } else {
          this.getFocusHandler().getTopicState().amount = action.amount;
        }
        break;

      case 'setType':
        this.getFocusHandler().getTopicState().type = action.id;
        break;

      case 'deleteItem':
        let deleteCount = action.count || 0;
        if (deleteCount <= 0) {
          deleteCount = this.getFocusHandler().getTopicState().amount || 1;
        }
        if (action.id > 0) {
          player.containerManager.equipment.removeItem(action.id, deleteCount);
        }
        break;

      case 'teleport':
        if (gameServer && gameServer.world && gameServer.world.creatureHandler) {
          let targetPos = new Position(action.x, action.y, action.z);
          gameServer.world.creatureHandler.teleportCreature(player, targetPos);
        }
        break;

      case 'createMoney':
        let amt = this.getFocusHandler().getTopicState().price || 0;
        if (amt <= 0) break;
        let coin = process.gameServer.database.createThing(2148);
        coin.setCount(amt);
        let bp = player.containerManager.equipment.peekIndex(CONST.EQUIPMENT.BACKPACK);
        if (bp && coin) {
          bp.addFirstEmpty(coin);
        }
        break;

      case 'buyBlessing':
        let blessingIdx = action.blessingIndex;
        if (blessingIdx !== undefined && blessingIdx >= 0 && blessingIdx < 5) {
          player.handleBlessingBuy(blessingIdx);
        }
        break;

      case 'teachSpell':
        let spellId = action.spellId !== undefined ? action.spellId : this.getFocusHandler().getTopicState().type;
        if (spellId > 0 && player.spellbook) {
          player.spellbook.addAvailableSpell(spellId);
          player.setStorage(2000 + spellId, 1);
        }
        break;
    }
  }

}

ConversationHandler.prototype.__isGoodbye = function (string) {

  /*
   * Function ConversationHandler.__isGoodbye
   * Returns whether a text is a goodbye message
   */

  return this.conversation.farewells.includes(string);

}

ConversationHandler.prototype.__isGreeting = function (string) {

  /*
   * Function ConversationHandler.__isGreeting
   * Returns whether a text is a greeting message
   */

  return this.conversation.greetings.includes(string);

}

ConversationHandler.prototype.__matchDefaultKeyword = function (keyword) {

  /*
   * Function ConversationHandler.__matchDefaultKeyword
   * Matches a keyword against the NPC's configured keywords.
   * Matching is case-insensitive.
   * Supports Tibia wildcard conventions:
   *   - "$" suffix: exact end-of-word anchor (e.g., "heal$" matches "heal")
   *   - "*keyword*": contains match
   *   - "keyword*": starts-with match
   *   - "*keyword": ends-with match
   * Returns the matching key or null if no match found.
   */

  // Must be in the base talk state to respond to key words
  if (!this.getTalkStateHandler().isDefaultState()) {
    return null;
  }

  let lcKeyword = keyword.toLowerCase();
  let keys = Object.keys(this.conversation.keywords);

  // 1. Case-insensitive exact match
  for (let key of keys) {
    if (key.toLowerCase() === lcKeyword) {
      return key;
    }
  }

  // 2. Try each key with wildcard handling (case-insensitive)
  for (let key of keys) {
    let lcKey = key.toLowerCase();

    // Strip trailing $ (Tibia end-of-word anchor) and compare
    if (lcKey.replace(/\$$/, '') === lcKeyword) {
      return key;
    }

    // *keyword* — contains
    let m = lcKey.match(/^\*(.+)\*$/);
    if (m && lcKeyword.includes(m[1])) {
      return key;
    }

    // keyword* — starts with
    m = lcKey.match(/^(.+)\*$/);
    if (m && lcKeyword.startsWith(m[1])) {
      return key;
    }

    // *keyword — ends with
    m = lcKey.match(/^\*(.+)$/);
    if (m && lcKeyword.endsWith(m[1])) {
      return key;
    }

    // Message contains keyword (standard Tibia substring match)
    if (!lcKey.includes('*') && lcKeyword.includes(lcKey)) {
      return key;
    }
  }

  return null;

}

ConversationHandler.prototype.__matchPunishmentKeyword = function (keyword) {

  /*
   * Function ConversationHandler.__matchPunishmentKeyword
   * Matches a keyword against the NPC's punishment keywords (same wildcard logic as __matchDefaultKeyword)
   * Returns the matching key or null if no match found.
   */

  if (!this.conversation.punishments) return null;

  let lcKeyword = keyword.toLowerCase();
  let keys = Object.keys(this.conversation.punishments);

  // 1. Case-insensitive exact match
  for (let key of keys) {
    if (key.toLowerCase() === lcKeyword) {
      return key;
    }
  }

  // 2. Try each key with wildcard handling (case-insensitive)
  for (let key of keys) {
    let lcKey = key.toLowerCase();

    // Strip trailing $
    if (lcKey.replace(/\$$/, '') === lcKeyword) {
      return key;
    }

    // *keyword* — contains
    let m = lcKey.match(/^\*(.+)\*$/);
    if (m && lcKeyword.includes(m[1])) {
      return key;
    }

    // keyword* — starts with
    m = lcKey.match(/^(.+)\*$/);
    if (m && lcKeyword.startsWith(m[1])) {
      return key;
    }

    // *keyword — ends with
    m = lcKey.match(/^\*(.+)$/);
    if (m && lcKeyword.endsWith(m[1])) {
      return key;
    }

    // Message contains keyword (standard Tibia substring match)
    if (!lcKey.includes('*') && lcKeyword.includes(lcKey)) {
      return key;
    }
  }

  return null;

}

function __getSpellDefinition(spellId) {
  __ensureSpellDefinitions();
  return __spellDefinitions[spellId] || null;
}

function __inferSpellFromKeyword(keyword) {
  __ensureSpellDefinitions();
  var lcKeyword = keyword.toLowerCase().replace(/\$$/, '');
  // Exact match first
  if (__spellKeywordMap[lcKeyword] !== undefined) {
    return __spellKeywordMap[lcKeyword];
  }
  return null;
}

function playerKnowsSpell(player, spellId) {
  return player.spellbook && player.spellbook.getAvailableSpells().has(spellId);
}

function playerMeetsMagicLevel(player, requiredMl) {
  if (!requiredMl || requiredMl <= 0) return true;
  var playerMl = player.skills ? player.skills.getSkillLevel(CONST.PROPERTIES.MAGIC) : 0;
  return playerMl >= requiredMl;
}

function entryHasAction(entry, actionType) {
  return entry.actions && entry.actions.some(function (a) {
    return a.type === actionType;
  });
}

function entryHasKeywordMatch(entry, message) {

  if (entry.keywords.length === 0) return true;

  return entry.keywords.some(function (kw) {
    return keywordInSimpleMessage(message, kw);
  });

}

function keywordInSimpleMessage(message, keyword) {

  var lcMessage = message.toLowerCase();
  var lcKeyword = keyword.toLowerCase().replace(/\$$/, '');

  if (lcMessage === lcKeyword) return true;
  if (lcMessage.includes(lcKeyword)) return true;

  return false;

}

function executeEntry(handler, player, entry) {

  // Check if quest already completed (for quest-gating topics)
  if (entry.actions && entry.actions.some(a => a.type === 'setQuest')) {
    var questAction = entry.actions.find(a => a.type === 'setQuest');
    if (questAction && player.getStorage(questAction.storageKey) !== -1) {
      handler.respond("You already have this.");
      handler.getFocusHandler().setCurrentTopic(null);
      return;
    }
  }

  // Execute actions
  if (entry.actions && entry.actions.length > 0) {
    handler.__executeTopicActions(player, entry.actions);
  }

  // Respond (with %A and %P placeholder replacement from topic state)
  if (entry.response) {
    var res = entry.response;
    var ts = handler.getFocusHandler().getTopicState();
    if (ts.amount !== undefined) {
      res = res.replace(/%A/g, String(ts.amount));
    }
    if (ts.price !== undefined) {
      res = res.replace(/%P/g, String(ts.price));
    }
    handler.respond(res);
  }

  // Set next state
  if (entry.nextTopic !== null && entry.nextTopic !== undefined) {
    handler.getFocusHandler().setCurrentTopic(entry.nextTopic);
  } else if (entry.idle) {
    handler.getFocusHandler().setCurrentTopic(null);
  } else if (!entry.nextTopic && !entry.idle) {
    handler.getFocusHandler().setCurrentTopic(null);
  }

}

module.exports = ConversationHandler;
