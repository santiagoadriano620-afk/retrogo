module.exports.setup = function (conversationHandler, spells) {

  var talkStateHandler = conversationHandler.getTalkStateHandler();
  var originalBase = talkStateHandler.__baseTalkState;

  conversationHandler.setBaseState(function (state, player, message) {

    var lcMessage = message.toLowerCase();

    for (var entry of spells) {
      var spellId = entry[0];
      var spellData = entry[1];

      var match = spellData.names.some(function (name) {
        return lcMessage.includes(name.toLowerCase());
      });
      if (!match) continue;

      if (!checkVocation(conversationHandler, player, spellData)) return;
      if (!checkMagicLevel(conversationHandler, player, spellData)) return;
      if (checkAlreadyLearned(conversationHandler, player, spellId)) return;
      if (!checkGold(conversationHandler, player, spellData)) return;

      purchaseSpell(conversationHandler, player, spellId, spellData);
      return;
    }

    if (originalBase !== Function.prototype) {
      originalBase.call(conversationHandler, state, player, message);
    }

  });

};

function checkVocation(conversationHandler, player, spellData) {

  var vocations = spellData.vocations;

  if (!vocations || vocations.length === 0 || vocations[0] === "all") {
    return true;
  }

  var playerVoc = player.getVocation();

  var match = vocations.some(function (v) {
    switch (v) {
      case "knight":   return playerVoc === CONST.VOCATION.KNIGHT || playerVoc === CONST.VOCATION.ELITE_KNIGHT;
      case "paladin":  return playerVoc === CONST.VOCATION.PALADIN || playerVoc === CONST.VOCATION.ROYAL_PALADIN;
      case "sorcerer": return playerVoc === CONST.VOCATION.SORCERER || playerVoc === CONST.VOCATION.MASTER_SORCERER;
      case "druid":    return playerVoc === CONST.VOCATION.DRUID || playerVoc === CONST.VOCATION.ELDER_DRUID;
      default:         return false;
    }
  });

  if (!match) {
    conversationHandler.respond("Your vocation cannot learn this spell.");
    return false;
  }

  return true;

}

function checkMagicLevel(conversationHandler, player, spellData) {

  if (!spellData.minMl || spellData.minMl <= 0) {
    return true;
  }

  var playerMl = player.skills ? player.skills.getSkillLevel(CONST.PROPERTIES.MAGIC) : 0;

  if (playerMl < spellData.minMl) {
    conversationHandler.respond("You must have magic level " + spellData.minMl + " or better to learn this spell.");
    return false;
  }

  return true;

}

function checkAlreadyLearned(conversationHandler, player, spellId) {

  if (!player.spellbook) {
    return false;
  }

  if (player.spellbook.getAvailableSpells().has(spellId)) {
    conversationHandler.respond("You already know how to cast this spell.");
    return true;
  }

  return false;

}

function checkGold(conversationHandler, player, spellData) {

  var totalGold = player.containerManager.equipment.getTotalGold();

  if (totalGold < spellData.price) {
    conversationHandler.respond("You do not have enough gold.");
    return false;
  }

  return true;

}

function purchaseSpell(conversationHandler, player, spellId, spellData) {

  player.containerManager.equipment.payWithResource(
    player.containerManager.equipment.CURRENCY.GOLD_COIN,
    spellData.price
  );

  player.spellbook.addAvailableSpell(spellId);

  player.setStorage(2000 + spellId, 1);

  conversationHandler.respond("From now on you can cast this spell.");
  conversationHandler.respond("Look in your spellbook for the pronunciation of this spell.");

}
