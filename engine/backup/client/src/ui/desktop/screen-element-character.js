const CharacterElement = function (creature) {
  /*
   * Class CharacterElement
   * Container for a character element that floats above creatures
   */

  // Inherit from screen element
  ScreenElement.call(this, "character-element-prototype");

  this.__creature = creature;

  // Update settings
  this.setName(creature.name);
};

CharacterElement.prototype = Object.create(ScreenElement.prototype);
CharacterElement.prototype.constructor = CharacterElement;

CharacterElement.prototype.setDefault = function () {
  /*
   * Class CharacterElement.setDefault
   * Sets the default colors of the healthbar
   */

  let isPlayer = this.__creature === gameClient.player;
  let isNPC = this.__creature.type === CONST.TYPES.NPC;
  let isAdmin = this.__creature && this.__creature.name === "Admin";

  this.setHealthFraction(this.__creature.getHealthFraction());
  this.setManaColor(Interface.prototype.COLORS.BLUE);

  let manaNode = this.element.querySelector(".value-mana");
  if (manaNode && manaNode.parentElement) {
    manaNode.parentElement.style.display = isPlayer && !isAdmin ? "" : "none";
  }

  let healthNode = this.element.querySelector(".value-health");
  if (healthNode && healthNode.parentElement) {
    healthNode.parentElement.style.display = isAdmin || isNPC ? "none" : "";
  }

  if (isPlayer && typeof this.__creature.getManaFraction === "function") {
    this.setManaFraction(this.__creature.getManaFraction());
  }
};

CharacterElement.prototype.setGrey = function () {
  /*
   * Class CharacterElement.setGrey
   * Sets the fraction of the mana bar width
   */

  this.setHealthColor(Interface.prototype.COLORS.LIGHTGREY);
  this.setManaColor(Interface.prototype.COLORS.LIGHTGREY);
};

CharacterElement.prototype.setHealthFraction = function (fraction) {
  /*
   * Class CharacterElement.setHealthFraction
   * Sets the fraction of the mana bar width
   */

  // Admin has no HP bar
  if (this.__creature && this.__creature.name === "Admin") {
    let healthBar = this.element.querySelector(".value-health");
    if (healthBar) {
      healthBar.style.width = "0%";
      healthBar.style.display = "none";
    }
    let healthBarParent = healthBar ? healthBar.parentElement : null;
    if (healthBarParent) {
      healthBarParent.style.display = "none";
    }
    return;
  }

  // Set the color of the health bar too
  let color =
    fraction > 0.5
      ? Interface.prototype.COLORS.LIGHTGREEN
      : fraction > 0.25
        ? Interface.prototype.COLORS.ORANGE
        : fraction > 0.1
          ? Interface.prototype.COLORS.RED
          : Interface.prototype.COLORS.DARKRED;

  // Fetch the healthbar from the element
  let healthBar = this.element.querySelector(".value-health");

  // Set styling
  healthBar.style.width = fraction.toPercentage() + "%";

  // Add actual health values
  let currentHealth = Math.round(this.__creature.state.health);
  let maxHealth = Math.round(this.__creature.state.maxHealth);
  healthBar.setAttribute("title", `${currentHealth}/${maxHealth}`);

  this.setHealthColor(color);
};

CharacterElement.prototype.setHealthColor = function (color) {
  this.element.querySelector(".value-health").style.backgroundColor =
    Interface.prototype.getHexColor(color);

  this.setNameColor(color);
};

CharacterElement.prototype.setManaColor = function (color) {
  this.element.querySelector(".value-mana").style.backgroundColor =
    Interface.prototype.getHexColor(color);
};

CharacterElement.prototype.setManaFraction = function (fraction) {
  /*
   * Class CharacterElement.setManaFraction
   * Sets the fraction of the mana bar width
   */

  this.element.querySelector(".value-mana").style.width =
    fraction.toPercentage() + "%";
};

CharacterElement.prototype.setNameColor = function (color) {
  /*
   * Function CharacterElement.setNameColor
   * Sets the color of the name plate of the character element
   * Accepts either a numeric index into WEBCOLORS or a hex string (e.g. "#CC4444")
   */

  if (this.__creature && this.__creature.name === "Admin") {
    return;
  }

  this.element.querySelector(".player-name").style.color =
    typeof color === "number" ? Interface.prototype.getHexColor(color) : color;
};

CharacterElement.prototype.setName = function (name) {
  /*
   * Class CharacterElement.setName
   * Sets the name plate of the character element, supporting guild name prefix
   */

  let guildSpan = this.element.querySelector(".guild-name");
  let playerSpan = this.element.querySelector(".player-name");
  let parts = name.split("\n");
  let isAdmin = name === "Admin";
  if (parts.length > 1) {
    guildSpan.innerHTML = parts[0];
    playerSpan.innerHTML = isAdmin ? "[Admin] " + parts[1] : parts[1];
    guildSpan.style.display = "block";
  } else {
    guildSpan.innerHTML = "";
    guildSpan.style.display = "none";
    playerSpan.innerHTML = isAdmin ? "[Admin]" : name;
  }
  if (isAdmin) {
    playerSpan.style.color = "#FF2222";
    playerSpan.classList.add("admin-name");
  } else {
    playerSpan.classList.remove("admin-name");
  }
};

CharacterElement.prototype.setTextPosition = function () {
  /*
   * Function CharacterElement.setTextPosition
   * Sets the text position of the character element
   */

  let isPlayer = this.__creature === gameClient.player;

  // Use the same position calculation for both desktop and mobile
  // This includes movement interpolation for smooth animation
  let screenPosition = gameClient.renderer.getCreatureScreenPosition(this.__creature);

  /*
   * FIX: Snap to internal pixel grid to match renderer
   * The renderer rounds coordinates to the nearest integer pixel (32x)
   * The DOM uses floating point, causing sub-pixel jitter when scaled
   * We must snap the DOM position to the same "virtual pixels" as the sprite
   */
  screenPosition.x = Math.round(screenPosition.x * 32) / 32;
  screenPosition.y = Math.round(screenPosition.y * 32) / 32;

  let offset = this.__getAbsoluteOffset(screenPosition);
  let scale = gameClient.interface.getSpriteScalingVector();

  // Center the nameplate horizontally
  offset.left += scale.x / 2;

  // Player sprite shifted horizontally; compensate nickname/HP bar to match
  if (isPlayer) {
    offset.left -= scale.x * 0.25;
  }

  offset.top -= (scale.y * 0.25);

  // Adjust NPC nameplate: more to the left and higher up
  if (this.__creature.type === CONST.TYPES.NPC) {
    offset.left -= scale.x * 0.3;
    offset.top -= scale.y * 0.4;
  }

  // Player sprite shifted 16px up within tile; compensate nameplate/HP bar
  if (isPlayer) {
    offset.top -= scale.y * 0.4;
  }

  this.element.style.transition = "";

  // Delegate to the generic move function
  this.__updateTextPosition(offset);
};
