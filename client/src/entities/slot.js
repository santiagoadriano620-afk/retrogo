const Slot = function () {

  /*
   * Class Slot
   * Container for a slot that contains an item
   */

  // A slot must reference an item (or empty, nullptr)
  this.item = null;
  this.index = -1;

}

Slot.prototype.setElement = function (element) {

  /*
   * Function Slot.setElement
   * Sets the elements in the DOM
   */

  this.element = element;
  this.canvas = new Canvas(element.firstElementChild, 32, 32);
  this.__countElement = element.querySelector(".count");
  let idx = element.getAttribute("slotIndex");
  if (idx !== null) {
    this.index = parseInt(idx, 10);
  }

  // Add tooltip listeners
  element.addEventListener("mouseover", function () {
    if (this.item) {
      gameClient.interface.tooltip.show(this.item, this.element);
    }
  }.bind(this));

  element.addEventListener("mouseout", function () {
    gameClient.interface.tooltip.hide();
  }.bind(this));

}

Slot.prototype.createDOM = function (index) {

  /*
   * Function Slot.createDOM
   * Creates the interactable DOM elements for the slot
   */

  let element = document.getElementById("slot-prototype").cloneNode(true);
  element.setAttribute("slotIndex", index);
  element.removeAttribute("id");



  this.setElement(element);

}

Slot.prototype.setItem = function (item) {

  /*
   * Function Slot.setItem
   * Sets an item in the slot
   */

  this.item = item;

  // Update the class with the rarity color of the item
  this.element.className = "slot " + this.getRarityColor(item);

}

Slot.prototype.getRarityColor = function (item) {

  /*
   * Function Slot.getRarityColor
   * Returns the rarity color of the slot
   * TODO: Implement proper rarity system based on item properties
   */

  // Disabled - no rarity borders by default
  return "";

  // Uncomment below to enable rarity system based on item properties:
  // if (!item) return "";
  // let rarity = item.getDataObject()?.properties?.rarity;
  // switch(rarity) {
  //   case 1: return "uncommon";  // green
  //   case 2: return "rare";      // blue
  //   case 3: return "epic";      // purple
  //   case 4: return "legendary"; // orange
  //   default: return "";         // no border
  // }

}

Slot.prototype.__renderAnimated = function () {

  /*
   * Function Slot.__renderAnimated
   * Renders the slot when it is animated
   */

  // Skip when empty or not animated
  if (this.isEmpty()) {
    return;
  }

  this.render();

}

Slot.prototype.render = function () {

  /*
   * Function Slot.render
   * Renders the slot when it is animated
   */

  // Clear the slot
  this.canvas.clear();
  this.setCountString(null);

  // Skip when empty
  if (this.isEmpty()) {
    return;
  }

  // Draw the sprite to the slow canvas
  this.canvas.drawSprite(this.item, new Position(0, 0), 32, this.offsetX, this.offsetY);

  let props = null;
  let defs = gameClient.itemDefinitions;
  if (defs && defs[this.item.id]) {
    props = defs[this.item.id].properties;
  }

  // Priority 1: Show remaining duration (training weapon, ring, torch, etc.)
  // Check trainingTimers directly first — works even when definitions.json hasn't loaded yet (async race)
  if (this.index >= 0 && gameClient.interface.trainingTimers && gameClient.interface.trainingTimers[this.index] !== undefined) {
    let remaining = gameClient.interface.trainingTimers[this.index];
    if (remaining > 0) {
      let hours = Math.floor(remaining / 3600);
      let minutes = Math.floor((remaining % 3600) / 60);
      let text = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
      this.setCountString(text);
      return;
    }
  }

  // Priority 1b: Also check from definitions if no timer in trainingTimers
  if (props && (props.duration || props.showduration || props.trainingWeapon) && this.index >= 0) {
    this.setCountString("");
    return;
  }

  // Priority 2: Show charges (runes, charged items) - only when definition has showcharges or type=rune
  if (props && (props.showcharges || props.type === "rune") && this.item.getCount() > 0) {
    this.setCountString(this.item.getCount());
    return;
  }

  // Priority 3: Show stackable count
  if (this.item.isStackable() && this.item.getCount() > 1) {
    this.setCountString(this.item.getCount());
  }

}

Slot.prototype.setCountString = function (count) {

  /*
   * Function Slot.setCountString
   * Sets the count DOM element to the passed value
   */

  if (this.__countElement) {
    this.__countElement.innerHTML = count || "";
    this.__countElement.style.fontSize = "8px";
  }

}

Slot.prototype.setOpenContainerIndicator = function (visible) {

  /*
   * Function Slot.setOpenContainerIndicator
   * Shows or hides the open container indicator on the slot
   */

  if (!this.__indicator) {
    this.__indicator = document.createElement("div");
    this.__indicator.className = "container-indicator";
    this.element.appendChild(this.__indicator);
  }

  if (visible) {
    this.__indicator.innerHTML = "";
  }
  this.__indicator.style.display = visible ? "block" : "none";

}

Slot.prototype.isEmpty = function () {

  /*
   * Function Slot.isEmpty
   * Returns true if the slot is empty and does not contain an item
   */

  return this.item === null;

}
