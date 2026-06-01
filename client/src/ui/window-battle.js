const BattleWindow = function (element) {

  /*
   * Class BattleWindow
   * Makes an element with the window class interactive
   *
   * API:
   *  - generateContent(content): Generates the body content for the window based on the friend list array
   */

  InteractiveWindow.call(this, element);

  // Multi-toggle filter state (true = show this category)
  this.__filters = {
    players: false,
    npcs: false,
    monsters: false,
    skulls: true,
    party: false
  };

  var self = this;
  element.querySelectorAll(".battle-icon-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      self.toggleFilter(this.getAttribute("data-filter"));
    });
  });

}

// Set the prototype and constructor
BattleWindow.prototype = Object.create(InteractiveWindow.prototype);
BattleWindow.prototype.constructor = BattleWindow;

BattleWindow.prototype.toggleFilter = function(category) {
  this.__filters[category] = !this.__filters[category];
  var self = this;
  this.__element.querySelectorAll(".battle-icon-btn").forEach(function(btn) {
    if (btn.getAttribute("data-filter") === category) {
      if (self.__filters[category]) {
        btn.classList.add("checked");
      } else {
        btn.classList.remove("checked");
      }
    }
  });
  this.__applyFilter();
}

BattleWindow.prototype.__isPartyMember = function(creature) {
  var player = gameClient.player;
  if (!player || !player.__partyMembers) return false;
  return player.__partyMembers.some(function(m) { return m.id === creature.id; });
}

BattleWindow.prototype.__showCreature = function(creature) {
  if (creature.type === 0) {
    if (!this.__filters.players) return false;
    if (!this.__filters.party && this.__isPartyMember(creature)) return false;
    if (!this.__filters.skulls && creature.skull === CONST.SKULL.NONE) return false;
    return true;
  }
  if (creature.type === 1) return this.__filters.monsters;
  if (creature.type === 2) return this.__filters.npcs;
  return true;
}

BattleWindow.prototype.__applyFilter = function() {
  var body = this.getBody();
  var self = this;
  Array.from(body.children).forEach(function(el) {
    if (el.classList.contains("battle-filter")) return;
    var creatureId = Number(el.getAttribute("id"));
    var creature = gameClient.world.getCreature(creatureId);
    if (!creature) return;
    el.style.display = self.__showCreature(creature) ? "flex" : "none";
  });
}

BattleWindow.prototype.removeCreature = function (id) {

  let element = this.getBody().querySelector('[id="%s"]'.format(id));

  if (element === null) {
    return;
  }

  element.remove();

}

BattleWindow.prototype.setTarget = function (creature) {

  Array.from(this.getBody().children).forEach(function (x) {

    if (x.classList.contains("battle-filter")) return;

    let nameSpan = x.querySelector(".battle-window-target-title");
    if (nameSpan) {
      nameSpan.style.color = "";
    }

    if (creature !== null && Number(x.getAttribute('id')) === creature.id) {
      nameSpan.style.color = "#CC4444";
    }

  });

}

BattleWindow.prototype.refresh = function () {
  let body = this.getBody();
  let player = gameClient.player;
  if (!player) return;

  let active = gameClient.world.activeCreatures;
  let entryIds = new Set();
  Array.from(body.children).forEach(function (el) {
    if (el.classList.contains("battle-filter")) return;
    entryIds.add(el.getAttribute("id"));
  });

  Object.values(active).forEach(function (creature) {
    if (gameClient.isSelf(creature)) return;
    if (entryIds.has(String(creature.id))) {
      this.updateCreature(creature);
    } else {
      this.addCreature(creature);
    }
  }, this);

  let activeIds = new Set(Object.keys(active));
  Array.from(body.children).forEach(function (el) {
    if (el.classList.contains("battle-filter")) return;
    if (!activeIds.has(el.getAttribute("id"))) {
      el.remove();
    }
  });
}

BattleWindow.prototype.updateCreature = function (creature) {

  let element = this.getBody().querySelector('[id="%s"]'.format(creature.id));

  if (!element) {
    return;
  }

  // FOV Check: Only show creatures actually visible on the game canvas
  let player = gameClient.player;
  if (player && !gameClient.isSelf(creature)) {
    let cp = creature.getPosition();
    let pp = player.getPosition();
    if (cp.z !== pp.z) {
      element.remove();
      return;
    }
    let screenX = 14 + (cp.x + (cp.z % 8)) - (pp.x + (pp.z % 8));
    let screenY = 7 + (cp.y + (cp.z % 8)) - (pp.y + (pp.z % 8));
    if (screenX < 0 || screenX >= 34 || screenY < 0 || screenY >= 15) {
      element.remove();
      return;
    }
  }

  // Check filter before showing
  if (!this.__showCreature(creature)) {
    element.style.display = "none";
    return;
  }

  element.style.display = "flex";

  let nameSpan = element.querySelector(".battle-window-target-title");
  nameSpan.innerHTML = creature.name;

  // Health Bar (no text, just bar)
  let hpPercent = Math.min(100, Math.max(0, (creature.state.health / (creature.maxHealth || 1)) * 100));
  let hpBar = element.querySelector('.battle-window-target-stats-bar');
  hpBar.style.width = hpPercent + "%";
  hpBar.className = 'battle-window-target-stats-bar';
  if (hpPercent <= 20) {
    hpBar.classList.add('health-low');
  } else if (hpPercent <= 50) {
    hpBar.classList.add('health-mid');
  } else {
    hpBar.classList.add('health');
  }

  // Draw creature sprite (catches up if outfit wasn't ready on first add)
  let cvs = element.querySelector(".battle-window-target-canvas canvas");
  if (cvs) {
    let canvas = new Canvas(cvs, 32, 32);
    this.__drawCreatureSprite(canvas, creature);
  }

}

BattleWindow.prototype.__drawCreatureSprite = function (canvas, creature) {

  let frames = creature.getCharacterFrames();
  if (!frames || !frames.characterGroup) return;

  let posY = Math.max(0, frames.characterGroup.height - 1);

  canvas.clear();
  canvas.__drawCharacter(
    gameClient.getCreatureSpriteBuffer(creature),
    creature.outfit,
    new Position(0, posY),
    frames.characterGroup,
    frames.characterFrame,
    CONST.DIRECTION.SOUTH,
    0,
    32,
    0
  );

}

BattleWindow.prototype.addCreature = function (creature) {

  let existing = this.getBody().querySelector('[id="%s"]'.format(creature.id));
  if (existing) {
    return this.updateCreature(creature);
  }

  let node = document.getElementById("battle-window-target").cloneNode(true);
  node.style.display = "flex";
  node.setAttribute("id", creature.id);

  let cvs = node.querySelector(".battle-window-target-canvas canvas");
  let canvas = new Canvas(cvs, 32, 32);

  this.__drawCreatureSprite(canvas, creature);

  let nameSpan = node.querySelector(".battle-window-target-title");
  nameSpan.innerHTML = creature.name;

  this.getBody().appendChild(node);

  // Apply filter to the new entry
  if (!this.__showCreature(creature)) {
    node.style.display = "none";
  }

  // Update the stats immediately
  this.updateCreature(creature);

  // Apply target color if this creature is the current target
  if (gameClient.player && gameClient.player.isCreatureTarget(creature)) {
    nameSpan.style.color = "#CC4444";
  }

  function blockMobileMouse(event) {
    if (gameClient.touch && gameClient.touch.isMobileMode) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }

  node.addEventListener("mousedown", blockMobileMouse);
  node.addEventListener("mouseup", blockMobileMouse);

  node.addEventListener("click", function (event) {
    if (gameClient.touch && gameClient.touch.isMobileMode) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }

    if (gameClient.mouse.__multiUseObject !== null) {
      let creatureId = Number(this.id);
      gameClient.send(new ItemUseOnCreaturePacket(gameClient.mouse.__multiUseObject, creatureId));
      gameClient.mouse.__multiUseObject = null;
      gameClient.mouse.setCursor("auto");
      return;
    }

    let creature = gameClient.world.getCreature(this.id);
    if (gameClient.player.isCreatureTarget(creature)) {
      gameClient.player.setTarget(null);
      gameClient.send(new TargetPacket(0));
    } else if (creature.type === 0 && creature !== gameClient.player) {
      // Player target — require safe fight to be ON
      if (gameClient.interface.fightModeSelector && gameClient.interface.fightModeSelector.isSafeFight()) {
        gameClient.player.setTarget(creature);
        gameClient.send(new TargetPacket(this.id));
      } else {
        gameClient.interface.setCancelMessage("You may not attack this player, turn safe fight on.");
      }
    } else {
      gameClient.player.setTarget(creature);
      gameClient.send(new TargetPacket(this.id));
    }
  });

  let touchStartX = 0;
  let touchStartY = 0;

  node.addEventListener("touchstart", function (event) {
    if (gameClient.touch && gameClient.touch.isMobileMode) {
      let touch = event.changedTouches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    }
  }, { passive: true });

  node.addEventListener("touchend", function (event) {
    if (gameClient.touch && gameClient.touch.isMobileMode) {
      let touch = event.changedTouches[0];
      let dx = Math.abs(touch.clientX - touchStartX);
      let dy = Math.abs(touch.clientY - touchStartY);

      if (dx < 10 && dy < 10) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        let id = Number(this.id);
        let creature = gameClient.world.getCreature(id);

        if (creature) {
          if (gameClient.player.isCreatureTarget(creature)) {
            gameClient.player.setTarget(null);
            gameClient.send(new TargetPacket(0));
          } else {
            gameClient.player.setTarget(creature);
            gameClient.send(new TargetPacket(id));
          }
        }
      }
    }
  });

}
