const Player = function (data) {
  /*
   * Function Player
   * Container for the gameclient player character
   *
   * API:
   *
   *
   */

  // Ensure data exists with default values
  data = data || {};

  // Create default outfit structure
  const defaultOutfit = {
    id: 111,
    frameGroups: {
      north: 1,
      east: 2,
      south: 3,
      west: 4,
    },
    details: {
      head: 78,
      body: 69,
      legs: 58,
      feet: 76,
    },
    addonOne: false,
    addonTwo: false,
  };

  // Convert outfit instance to plain object and ensure valid values
  const serverOutfit = data.outfit
    ? {
      id: Number(data.outfit.id) || defaultOutfit.id,
      details: {
        head: Number(data.outfit.details?.head) || defaultOutfit.details.head,
        body: Number(data.outfit.details?.body) || defaultOutfit.details.body,
        legs: Number(data.outfit.details?.legs) || defaultOutfit.details.legs,
        feet: Number(data.outfit.details?.feet) || defaultOutfit.details.feet,
      },
      addonOne: Boolean(data.outfit.addonOne),
      addonTwo: Boolean(data.outfit.addonTwo),
    }
    : defaultOutfit;

  // Merge with frameGroups
  data.outfit = {
    ...serverOutfit,
    frameGroups: defaultOutfit.frameGroups,
  };

  // Inherit from creature
  Creature.call(this, data);

  this.type = 0;
  this.vocation = data.vocation || 0;
  this.setState(data);

  // Players have equipment
  this.equipment = new Equipment(data.equipment);
  this.spellbook = new Spellbook(data.spellbook);

  // Ignore list
  this.ignorelist = new Ignorelist();

  // Private state for the player
  this.__movementEvent = null;
  this.__movementBuffer = null;
  this.__openedContainers = new Set();

  // Can only work again if the server has confirmed
  this.__serverWalkConfirmation = true;

  // Container for the players friendlist
  this.friendlist = new Friendlist(data.friendlist);

  // Party state
  this.__partyMembers = null;
  this.__partyLeaderId = null;
  this.__partyId = null;
  this.__pendingPartyInvite = null;
};

Player.prototype = Object.create(Creature.prototype);
Player.prototype.constructor = Player;

Player.prototype.getStepDuration = function (tile) {
  const speed = this.speed || 220;
  let groundSpeed = tile?.getFriction() || 100;

  let stepDurationMs = (groundSpeed * 1000) / speed;

  return Math.max(1, Math.ceil(stepDurationMs / gameClient.getTickInterval()));
};

Player.prototype.getTile = function () {
  /*
   * Function Player.getTile
   * Returns the tile that the player is currently on
   */

  return gameClient.world.getTileFromWorldPosition(this.__position);
};

Player.prototype.getMaxFloor = function () {
  /*
   * Function Player.getMaxFloor
   * Returns the maximum visible floor for the player: used for rendering
   */

  return gameClient.world
    .getChunkFromWorldPosition(this.getPosition())
    .getFirstFloorFromBottom(this.getPosition());
};

Player.prototype.setCapacity = function (value) {
  /*
   * Function Player.setCapacity
   * Sets the capacity of the respective player
   */

  // Use the passed value, or fall back to state.capacity
  const currentCapacity = typeof value === "number" ? value : this.state.capacity;

   // Update the capacity display in the equipment panel
   let el = document.querySelector(".capacity-display");
   if (el) el.innerHTML = `Cap:<br>${currentCapacity}`;

};

Player.prototype.setState = function (data) {
  /*
   * Function Player.setState
   * Sets the player state from server data
   */

  // Initialize state if not exists
  if (!this.state) {
    this.state = {};
  }

  // Keep player state
  this.skills = new Skills(data.skills, this.vocation);
  this.outfits = data.outfits || [];

  // Add state handlers FIRST (before setting values)
  // This is required because State.add() initializes values to null
  if (typeof this.state.add === "function") {
    this.state.add("capacity", this.setCapacity.bind(this));
    this.state.add("armor", this.setLevelSkillValue.bind(this, "armor"));
    this.state.add("attack", this.setLevelSkillValue.bind(this, "attack"));
    this.state.add("speed", this.setLevelSkillValue.bind(this, "speed"));
  }

  this.isPremium = !!data.isPremium;
  this.blessingBitmask = data.blessingBitmask || 0;

  // Set state values using server data with appropriate fallbacks
  // These must be set AFTER add() calls, because add() initializes to null
  this.state.health = data.health || 150;
  this.state.maxHealth = data.maxHealth || 150;
  this.state.mana = typeof data.mana === "number" ? data.mana : 35;
  this.state.maxMana = typeof data.manaMax === "number" ? data.manaMax : 55;
  this.state.capacity = typeof data.capacity === "number" ? data.capacity : 400;
  this.state.maxCapacity = data.maxCapacity || 400;
  this.state.speed = typeof data.speed === "number" ? data.speed : 1000; // Default Tibia speed
  this.state.armor = data.armor || 0;
  this.state.attack = data.attack || 0;

  // Update the UI
  this.setHealthStatus();
  this.setManaStatus();
};

Player.prototype.setLevelSkillValue = function (which, value) {
  /*
   * Function Player.setLevelSkillValue
   * Returns the percentage required to level up
   */

  gameClient.interface.windowManager
    .getWindow("skill-window")
    .setSkillValue(which, value);
};

Player.prototype.setBarStatus = function (bar) {
  /*
   * Function Player.setBarStatus
   * Sets the mana status to the DOM
   */

  let currentValue, maxValue;

  if (bar.id === "health-bar") {
    currentValue = this.state.health;
    maxValue = this.state.maxHealth;
  } else if (bar.id === "mana-bar") {
    currentValue = this.state.mana;
    maxValue = this.state.maxMana;
  }

  // Ensure we have valid values
  currentValue = currentValue || 0;
  maxValue = maxValue || 1;

  // Calculate percentage for the bar width
  let percentage = ((currentValue / maxValue) * 100).clamp(0, 100);

  bar.firstElementChild.style.width = percentage + "%";
  let valueEl = document.getElementById(bar.id === "health-bar" ? "health-value" : "mana-value");
  if (valueEl) {
    valueEl.innerHTML = currentValue;
  }
};

Player.prototype.getManaFraction = function () {
  /*
   * Function Player.getManaFraction
   * Returns the mana fraction of a player (0 to 1)
   */

  let mana = this.state.mana || 0;
  let maxMana = this.state.maxMana || 1;
  return (mana / maxMana).clamp(0, 1);
};

Player.prototype.setManaStatus = function () {
  /*
   * Function Player.setManaStatus
   * Sets the mana status to the DOM
   */

  this.setBarStatus(document.getElementById("mana-bar"));

  // Update mobile status bars
  this.__updateMobileStatusBars();
};

Player.prototype.setHealthStatus = function () {
  /*
   * Function Player.setHealthStatus
   * Sets the health status to the DOM where required
   */

  // The health bar on the side
  this.setBarStatus(document.getElementById("health-bar"));

  // Gamescreen
  this.characterElement.setDefault();

  // Update mobile status bars
  this.__updateMobileStatusBars();
};

Player.prototype.__updateMobileStatusBars = function () {};

Player.prototype.setAmbientSound = function () {
  /*
   * Player.setAmbientSound
   * Sets the ambient soundtrack
   */

  if (this.isUnderground()) {
    gameClient.interface.soundManager.setAmbientTrace("cave");
    gameClient.interface.soundManager.setVolume("rain", 0);
  } else {
    gameClient.interface.soundManager.setAmbientTrace("forest");

    if (gameClient.renderer.weatherCanvas.isRaining()) {
      gameClient.interface.soundManager.setVolume("rain", 1);
    }
  }
};

Player.prototype.isUnderground = function () {
  /*
   * Function Player.isUnderground
   * Returns true if  the player is underground
   */

  return this.getPosition().z > 7;
};

Player.prototype.queueMovement = function (fn) {
  /*
   * Function Player.queueMovement
   * Queues a movement callback to execute when the server confirms the current step.
   * Accepts a function to allow both keyboard key codes and D-pad directions.
   */

  if (this.__movementQueue.length < this.__movementQueueMax) {
    this.__movementQueue.push(fn);
  }
};

Player.prototype.confirmClientWalk = function () {
  /*
   * Function Player.confirmClientWalk
   * Confirms the client-side walk-ahead. Processes queued movements immediately.
   */

  if (this.__serverWalkConfirmation) {
    gameClient.renderer.updateTileCache();
  }

  this.__serverWalkConfirmation = true;

  // Process next queued movement immediately
  if (this.__movementQueue.length > 0 && !this.isMoving()) {
    let fn = this.__movementQueue.shift();
    fn();
  }
};

Player.prototype.isCreatureTarget = function (creature) {
  /*
   * Function Player.isCreatureTarget
   * Returns true is the creature is the current target
   */

  return this.__target === creature;
};

Player.prototype.addExperience = function (experience) {
  /*
   * Function Player.addExperience
   * Adds experience points to the player
   */

  return;
};

Player.prototype.isInProtectionZone = function () {
  return this.getTile().isProtectionZone();
};

Player.prototype.setTarget = function (creature) {
  /*
   * Function Player.setTarget
   * Sets target and updates name color above creature's head
   */

  // Restore previous target's name color to health-based
  if (this.__target && this.__target.characterElement) {
    this.__target.characterElement.setHealthFraction(this.__target.getHealthFraction());
  }

  this.__target = creature;

  gameClient.interface.windowManager
    .getWindow("battle-window")
    .setTarget(creature);
};

Player.prototype.openContainer = function (container, pendingSlot) {
  /*
   * Function Player.openContainer
   * Opens a container — tag only the exact clicked slot, then update indicators
   */

  // Tag only the exact slot that was used to open this container
  if (pendingSlot) {
    let parent = pendingSlot.parentContainer;
    let slotIndex = pendingSlot.slotIndex;
    if (parent && parent.slots && parent.slots[slotIndex]) {
      let slot = parent.slots[slotIndex];
      if (slot.item && slot.item.isContainer()) {
        slot.item.__openContainerId = container.__containerId;
      }
    }
  }

  this.__openedContainers.add(container);

  // Update indicators on all open containers (including the new one)
  this.__openedContainers.forEach(function (c) {
    c.__updateContainerIndicators();
  });

  // Equipment (inventory) is not in __openedContainers — update its indicators too
  if (this.equipment) {
    this.equipment.__updateContainerIndicators();
  }
};

Player.prototype.getItem = function (containerId, slotId) {
  /*
   * Function Player.getItem
   * Returns the carried item from a container and slot index
   */

  let container = this.getContainer(containerId);

  if (container === null) {
    return null;
  }

  return container.getSlotItem(slotId);
};

Player.prototype.getContainer = function (id) {
  /*
   * Function Player.getContainer
   * Returns the container based on the identifier
   */

  // Container identifier 0 refers to the players own equipment
  if (id === 0x00) {
    return this.equipment;
  }

  // Linear direct search for the correct container
  let containers = Array.from(this.__openedContainers);

  for (let i = 0; i < containers.length; i++) {
    if (containers[i].__containerId === id) {
      return containers[i];
    }
  }

  return null;
};

Player.prototype.closeAllContainers = function () {
  /*
   * Function Player.closeAllContainers
   * Cleanup function to close all containers
   */

  this.__openedContainers.forEach(function (container) {
    this.removeContainer(container);
  }, this);
};

Player.prototype.removeContainer = function (container) {
  /*
   * Function Player.removeContainer
   * Removes a container from the DOM
   */

  // Clear reference from slot items in all open containers
  this.__openedContainers.forEach(function (parent) {
    parent.slots.forEach(function (slot) {
      if (slot.item && slot.item.__openContainerId === container.__containerId) {
        slot.item.__openContainerId = undefined;
      }
    });
  });

  // Also clear from equipment (inventory) slots — not in __openedContainers
  if (this.equipment) {
    this.equipment.slots.forEach(function (slot) {
      if (slot.item && slot.item.__openContainerId === container.__containerId) {
        slot.item.__openContainerId = undefined;
      }
    });
  }

  // Remove the reference from the player
  this.__openedContainers.delete(container);

  // Check if the container is in the extra stack
  let extraWrapper = document.getElementById("extra-column-wrapper");
  let extraStack = extraWrapper ? extraWrapper.querySelector(".column") : null;

  if (extraStack && container.window.__element.parentElement === extraStack) {
    // Collapse extra column if no more visible windows
    let hasVisible = Array.from(extraStack.children).some(function (child) {
      return child.style.display !== "none" && child.style.display !== "";
    });
    if (!hasVisible) {
      extraWrapper.classList.remove("has-windows");
    }
  }

  // Update indicators on all remaining open containers
  this.__openedContainers.forEach(function (c) {
    c.__updateContainerIndicators();
  });

  // Update equipment (inventory) indicators too
  if (this.equipment) {
    this.equipment.__updateContainerIndicators();
  }

  // Clean up the element from the DOM
  let parentStack = container.window.__element.parentElement;
  container.window.remove();

  // Squeeze remaining containers in the stack
  if (parentStack && parentStack.className === "column") {
    Container.squeezeFromBottom(parentStack);
  }
};

Player.prototype.closeContainer = function (container) {
  /*
   * Function Player.closeContainer
   * Closes the container and removes it from the graphical user interface
   */

  gameClient.send(new ContainerClosePacket(container.__containerId));
};

Player.prototype.setTurnBuffer = function (direction) {
  /*
   * Function Player.setTurnBuffer
   * Sets the direction of the player to a new direction
   */

  // If moving update the buffer to be updated when player stops moving
  if (this.isMoving()) {
    return (this.__lookDirectionBuffer = direction);
  }

  // Update the look direction
  this.__setLookDirection(direction);
};

Player.prototype.__setLookDirection = function (direction) {
  /*
   * Function Player.__setLookDirection
   * Sets the direction of the player to a new direction
   */

  this.__lookDirection = direction;
};
