const Keyboard = function () {
  /*
   * Class Keyboard
   * Container for keyboard interaction with the game and interface
   *
   * API:
   *
   * Keyboard.isShiftDown() - returns true if shift is pressed
   * Keyboard.isControlDown() - returns true if control is pressed
   * Keyboard.handleInput() - Called every frame to handle the keyboard input
   * Keyboard.handleCharacterMovement() - Handles moving of character
   * Keyboard.setInactive() - Sets the keyboard to inactive by clearing the active keys
   *
   */

  // Add two listeners to up & down: the state is saved and checked every frame
  document.addEventListener("keydown", this.__keyDown.bind(this));
  document.addEventListener("keyup", this.__keyUp.bind(this));

  // An object that contains the actively pressed keys
  this.__activeKeys = new Set();

  // Cooldown for diagonal movement (prevents double-step)
  this.__diagonalMoveCooldown = 0;
};

// Configured keys with actions
Keyboard.prototype.KEYS = new Object({
  TAB: 9,
  ENTER_KEY: 13,
  SHIFT_KEY: 16,
  CONTROL_KEY: 17,
  ESC: 27,
  SPACE_BAR: 32,
  KEYPAD_9: 33,
  KEYPAD_3: 34,
  KEYPAD_1: 35,
  KEYPAD_7: 36,
  LEFT_ARROW: 37,
  UP_ARROW: 38,
  RIGHT_ARROW: 39,
  DOWN_ARROW: 40,
  KEY_A: 65,
  KEY_D: 68,
  KEY_E: 69,
  KEY_L: 76,
  KEY_M: 77,
  KEY_S: 83,
  KEY_W: 87,
  KEY_Q: 81,
  KEY_Z: 90,
  KEY_C: 67,
  F1: 112,
  F2: 113,
  F3: 114,
  F4: 115,
  F5: 116,
  F6: 117,
  F7: 118,
  F8: 119,
  F9: 120,
  F10: 121,
  F11: 122,
  F12: 123,
});

Keyboard.prototype.setInactive = function () {
  /*
   * Function Keyboard.setInactive
   * Sets the keyboard to inactive by clearing all the active keys: e.g., when tabbing out holding down a movement key
   */

  return this.__activeKeys.clear();
};

Keyboard.prototype.isShiftDown = function () {
  /*
   * Function Keyboard.isShiftDown
   * Returns true when shift is pressed
   */

  return this.__activeKeys.has(this.KEYS.SHIFT_KEY);
};

Keyboard.prototype.isControlDown = function () {
  /*
   * Function Keyboard.isControlDown
   * Returns true when control is pressed
   */

  return this.__activeKeys.has(this.KEYS.CONTROL_KEY);
};

Keyboard.prototype.__isDiagonalKey = function (key) {
  /*
   * Function Keyboard.__isDiagonalKey
   * Returns true if the key is a diagonal movement key
   */

  return key === this.KEYS.KEYPAD_7 || key === this.KEYS.KEYPAD_9 ||
         key === this.KEYS.KEYPAD_1 || key === this.KEYS.KEYPAD_3 ||
         key === this.KEYS.KEY_Q || key === this.KEYS.KEY_E ||
         key === this.KEYS.KEY_Z || key === this.KEYS.KEY_C;
};

Keyboard.prototype.handleInput = function () {
  /*
   * Function Keyboard.handleInput
   * Handles keyboard input on a given frame
   */

  // Go over the active keys
  this.__activeKeys.forEach(function (key) {
    // Cancel pathfinding when any input is given
    gameClient.world.pathfinder.setPathfindCache(null);

    // Block all input when player is dead
    if (gameClient.player && gameClient.player.isDead) {
      return;
    }

    key = Number(key);

    // Block keyboard input when the character is moving or when the server has not confirmed movement
    if (gameClient.player.isMoving() || !gameClient.player.__serverWalkConfirmation) {
      let queuedKey = key;
      return gameClient.player.queueMovement(function () {
        gameClient.keyboard.handleCharacterMovement(queuedKey);
      });
    }

    // Shift is being held down: rotate
    if (this.isShiftDown()) {
      return this.__handleCharacterRotate(key);
    }

    // Otherwise move the character
    this.handleCharacterMovement(key);
  }, this);
};

Keyboard.prototype.handleCharacterMovement = function (key) {
  /*
   * Function Keyboard.__handleCharacterRotate
   * Handles keyboard input to move the character
   */

  // Shorthand
  let position = gameClient.player.getPosition();

  // Write the correct identifier to the server and make the player pre-walk on the client side
  // Also includes the full keypad for diagonal walking
  switch (key) {
    case this.KEYS.KEYPAD_7:
    case this.KEYS.KEY_Q:
      if (Date.now() < this.__diagonalMoveCooldown) {
        return;
      }
      return this.__handleCharacterMovementWrapper(
        CONST.DIRECTION.NORTHWEST,
        position.northwest()
      );
    case this.KEYS.KEYPAD_9:
    case this.KEYS.KEY_E:
      if (Date.now() < this.__diagonalMoveCooldown) {
        return;
      }
      return this.__handleCharacterMovementWrapper(
        CONST.DIRECTION.NORTHEAST,
        position.northeast()
      );
    case this.KEYS.KEYPAD_1:
    case this.KEYS.KEY_Z:
      if (Date.now() < this.__diagonalMoveCooldown) {
        return;
      }
      return this.__handleCharacterMovementWrapper(
        CONST.DIRECTION.SOUTHWEST,
        position.southwest()
      );
    case this.KEYS.KEYPAD_3:
    case this.KEYS.KEY_C:
      if (Date.now() < this.__diagonalMoveCooldown) {
        return;
      }
      return this.__handleCharacterMovementWrapper(
        CONST.DIRECTION.SOUTHEAST,
        position.southeast()
      );
    case this.KEYS.LEFT_ARROW:
    case this.KEYS.KEY_A:
      return this.__handleCharacterMovementWrapper(
        CONST.DIRECTION.WEST,
        position.west()
      );
    case this.KEYS.UP_ARROW:
    case this.KEYS.KEY_W:
      return this.__handleCharacterMovementWrapper(
        CONST.DIRECTION.NORTH,
        position.north()
      );
    case this.KEYS.RIGHT_ARROW:
    case this.KEYS.KEY_D:
      return this.__handleCharacterMovementWrapper(
        CONST.DIRECTION.EAST,
        position.east()
      );
    case this.KEYS.DOWN_ARROW:
    case this.KEYS.KEY_S:
      return this.__handleCharacterMovementWrapper(
        CONST.DIRECTION.SOUTH,
        position.south()
      );
  }
};

Keyboard.prototype.__handleCharacterRotate = function (key) {
  /*
   * Function Keyboard.__handleCharacterRotate
   * Handles keyboard input to rotate the character
   */

  switch (key) {
    case this.KEYS.LEFT_ARROW:
    case this.KEYS.KEY_A:
      return this.__setTurn(CONST.DIRECTION.WEST);
    case this.KEYS.UP_ARROW:
    case this.KEYS.KEY_W:
      return this.__setTurn(CONST.DIRECTION.NORTH);
    case this.KEYS.RIGHT_ARROW:
    case this.KEYS.KEY_D:
      return this.__setTurn(CONST.DIRECTION.EAST);
    case this.KEYS.DOWN_ARROW:
    case this.KEYS.KEY_S:
      return this.__setTurn(CONST.DIRECTION.SOUTH);
  }
};

Keyboard.prototype.__handleCharacterMovementWrapper = function (
  direction,
  position
) {
  /*
   * Function Keyboard.__handleCharacterMovementWrapper
   * Wrapper for movement event to delegate
   */

  // Confirm the movement is possible at all: then send a packet to the server
  if (!gameClient.networkManager.packetHandler.handlePlayerMove(position)) {
    return;
  }

  // Close modals on movement
  gameClient.interface.modalManager.close();

  gameClient.send(new MovementPacket(direction));
};

Keyboard.prototype.handleMoveKey = function (direction) {
  /*
   * Function Keyboard.handleMoveKey
   * Handles movement by direction constant (used by touch controls)
   */

  // Block if player doesn't exist yet
  if (!gameClient.player) {
    return;
  }

  // Block all input when player is dead
  if (gameClient.player.isDead) {
    return;
  }

  // Must have confirmation from the server before moving
  if (!gameClient.player.__serverWalkConfirmation) {
    let queuedDir = direction;
    return gameClient.player.queueMovement(function () {
      gameClient.keyboard.__handleCharacterMovementWrapper(
        queuedDir,
        gameClient.player.getPosition().fromOpcode(queuedDir)
      );
    });
  }

  // Block when the character is moving
  if (gameClient.player.isMoving()) {
    let queuedDir = direction;
    return gameClient.player.queueMovement(function () {
      gameClient.keyboard.__handleCharacterMovementWrapper(
        queuedDir,
        gameClient.player.getPosition().fromOpcode(queuedDir)
      );
    });
  }

  // Get current position
  let position = gameClient.player.getPosition();

  // Determine next position based on direction
  let nextPosition;
  switch (direction) {
    case CONST.DIRECTION.NORTH:
      nextPosition = position.north();
      break;
    case CONST.DIRECTION.SOUTH:
      nextPosition = position.south();
      break;
    case CONST.DIRECTION.EAST:
      nextPosition = position.east();
      break;
    case CONST.DIRECTION.WEST:
      nextPosition = position.west();
      break;
    case CONST.DIRECTION.NORTHEAST:
      nextPosition = position.northeast();
      break;
    case CONST.DIRECTION.NORTHWEST:
      nextPosition = position.northwest();
      break;
    case CONST.DIRECTION.SOUTHEAST:
      nextPosition = position.southeast();
      break;
    case CONST.DIRECTION.SOUTHWEST:
      nextPosition = position.southwest();
      break;
    default:
      return;
  }

  // Cancel pathfinding
  gameClient.world.pathfinder.setPathfindCache(null);

  // Use the movement wrapper
  this.__handleCharacterMovementWrapper(direction, nextPosition);
};

Keyboard.prototype.__handleReturnKey = function () {
  /*
   * Function Keyboard.__handleReturnKey
   * Callback event fired when the return key is pressed
   */

  // If we are typing in a textarea (like book-text-area), allow Enter for newlines
  if (document.activeElement && document.activeElement.tagName === "TEXTAREA") {
    return; // Let the default behavior happen (insert newline)
  }

  // Enter when modal is opened: handle confirmation
  if (gameClient.interface.modalManager.isOpened()) {
    return gameClient.interface.modalManager.handleConfirm();
  }

  // If not focusing on the chat input element
  if (document.activeElement.id !== "chat-input") {
    return gameClient.interface.channelManager.toggleInputLock();
  }

  // If the input is empty: lock it
  if (document.activeElement.value === "") {
    return gameClient.interface.channelManager.toggleInputLock();
  }

  // Write the message to the server
  return gameClient.interface.channelManager.handleMessageSend();
};

Keyboard.prototype.__handleEscapeKey = function () {
  /*
   * Function Keyboard.__handleEscapeKey
   * Callback event fired when the return key is pressed
   */

  // Modal windows are closed by canceling
  if (gameClient.interface.modalManager.isOpened()) {
    return gameClient.interface.modalManager.close();
  }

  // Close opened menu windows
  if (gameClient.interface.menuManager.isOpened()) {
    return gameClient.interface.menuManager.close();
  }

  // If targeting a creature: cancel this too
  if (gameClient.player && gameClient.player.hasTarget()) {
    gameClient.player.setTarget(null);
    gameClient.send(new TargetPacket(0));
  }

  // Delete the local pathfinding cache
  gameClient.world.pathfinder.setPathfindCache(null);
};

Keyboard.prototype.__setTurn = function (direction) {
  /*
   * Function Keyboard.__setTurn
   * Turns the player and informs the server too
   */

  // Already facing this direction: do nothing
  if (gameClient.player.getLookDirection() === direction) {
    return;
  }

  gameClient.player.setTurnBuffer(direction);
  gameClient.send(new PlayerTurnPacket(direction));
};

Keyboard.prototype.__keyDown = function (event) {
  /*
   * Function Keyboard.__keyDown
   * Callback event fired when key is pressed
   */

  // Don't interfere with typing in input fields
  if (document.activeElement !== document.body && document.activeElement !== null) {
    let tag = document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") {
      if (event.keyCode === Keyboard.prototype.KEYS.UP_ARROW && document.activeElement.id === "chat-input") {
        event.preventDefault();
        gameClient.interface.channelManager.suggestPrevious();
        return;
      }
      if (event.keyCode !== Keyboard.prototype.KEYS.ENTER_KEY) {
        return;
      }
    }
  }

  // The key is not configured with an action: block the action
  if (!this.__isConfigured(event.keyCode)) {
    return;
  }

  // Immediately resolve
  if (event.keyCode === Keyboard.prototype.KEYS.ENTER_KEY) {
    return this.__handleReturnKey();
  }

  if (event.keyCode === Keyboard.prototype.KEYS.KEY_L) {
    if (this.isControlDown()) {
      return gameClient.interface.sendLogout();
    }
  }

  // Open large world map
  if (event.keyCode === Keyboard.prototype.KEYS.KEY_M) {
    if (this.isControlDown()) {
      event.preventDefault();
      gameClient.renderer.minimap.openLargeMap();
    }
  }

  // Shortcut for
  if (event.keyCode === Keyboard.prototype.KEYS.KEY_E) {
    if (this.isControlDown()) {
      event.preventDefault();
      gameClient.interface.channelManager.closeCurrentChannel();
    }
  }

  // Ctrl+Q to toggle Quest Log
  if (event.keyCode === Keyboard.prototype.KEYS.KEY_Q) {
    if (this.isControlDown()) {
      event.preventDefault();
      gameClient.interface.modalManager.open("quest-log-modal");
      return;
    }
  }

  // Update cursors
  if (event.keyCode === Keyboard.prototype.KEYS.SHIFT_KEY) {
    this.__activeKeys.add(event.keyCode);
    gameClient.mouse.setCursor("zoom-in");
  }

  if (event.keyCode === Keyboard.prototype.KEYS.CONTROL_KEY) {
    this.__activeKeys.add(event.keyCode);
    gameClient.mouse.setCursor("default");
  }

  // Escape key
  if (event.keyCode === Keyboard.prototype.KEYS.ESC) {
    return this.__handleEscapeKey();
  }

  if (event.keyCode >= this.KEYS.F1 && event.keyCode <= this.KEYS.F12) {
    event.preventDefault();
    return this.__handleHotkey(event.keyCode);
  }

  // Tab key for switching channels
  if (event.keyCode === Keyboard.prototype.KEYS.TAB) {
    if (gameClient.isConnected()) {
      event.preventDefault();
      return gameClient.interface.channelManager.handleChannelIncrement(1);
    }
  }

  // Other key inputs are blocked when the modal manager is opened
  if (gameClient.interface.modalManager.isOpened()) {
    return;
  }

  // Otherwise set the key activity to true
  this.__activeKeys.add(event.keyCode);
};

Keyboard.prototype.__handleKeyType = function (key) {
  /*
   * Function Keyboard.__handleKeyType
   * Handles the key type
   */

  // If shift is down repeat the previous message
  if (this.isShiftDown()) {
    if (key === Keyboard.prototype.KEYS.UP_ARROW) {
      gameClient.interface.channelManager.suggestPrevious();
    }
  }
};

Keyboard.prototype.__isConfigured = function (key) {
  /*
   * Function Keyboard.__isConfigured
   * Returns whether a key is supported by the client
   */

  // Check the object
  return Object.values(this.KEYS).includes(key);
};

Keyboard.prototype.__handleHotkey = function (keyCode) {
  /*
   * Function Keyboard.__handleHotkey
   * Checks hotkey configuration and executes the associated action
   */

  let raw = localStorage.getItem("hotkeys");
  if (!raw) return;

  let data;
  try { data = JSON.parse(raw); } catch(e) { return; }

  if (!data.configs || data.configs.length === 0) return;

  let config = data.configs[data.activeConfig || 0];
  if (!config || !config.bindings) return;

  let keyNames = {
    112: "F1", 113: "F2", 114: "F3", 115: "F4",
    116: "F5", 117: "F6", 118: "F7", 119: "F8",
    120: "F9", 121: "F10", 122: "F11", 123: "F12"
  };

  let keyName = keyNames[keyCode];
  if (!keyName) return;

  let binding = null;
  for (let i = 0; i < config.bindings.length; i++) {
    if (config.bindings[i].key === keyName) {
      binding = config.bindings[i];
      break;
    }
  }

  if (!binding || !binding.text) return;

  let autoSpeak = binding.auto || false;

  if (autoSpeak) {
    gameClient.send(new ChannelMessagePacket(CONST.CHANNEL.DEFAULT, 1, binding.text));
  } else {
    let chatInput = document.getElementById("chat-input");
    if (chatInput) {
      chatInput.value = binding.text;
      gameClient.interface.channelManager.toggleInputLock();
    }
  }
};

Keyboard.prototype.__keyUp = function (event) {
  /*
   * Function Keyboard.__keyUp
   * Callback event fired when key is released
   */

  // Not configured: return
  if (!this.__isConfigured(event.keyCode)) {
    return;
  }

  if (
    event.keyCode === Keyboard.prototype.KEYS.SHIFT_KEY ||
    event.keyCode === Keyboard.prototype.KEYS.CONTROL_KEY
  ) {
    if (gameClient.mouse.__multiUseObject === null) {
      gameClient.mouse.setCursor("auto");
    }
  }

  this.__activeKeys.delete(event.keyCode);
};
