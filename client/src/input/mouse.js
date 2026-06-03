"use strict";

const Mouse = function () {

  /*
   * Class Mouse
   * Wrapper for all mouse interaction, events, and functions with the game client
   *
   * API:
   *
   * Mouse.getCurrentTileHover() - returns the current tile that is being hovered over or null
   * Mouse.sendItemUse(object) - Writes an item use request to the server.
   * Mouse.sendItemMove(object, object, count) - Writes an item move request to the server.
   * Mouse.setCursor(which) - updates the cursor type of the document
   *
   */

  // Listen to mouse up and down events to interact with the graphical user interface
  document.body.addEventListener("mousedown", this.__handleMouseDown.bind(this));
  document.body.addEventListener("mouseup", this.__handleMouseUp.bind(this));
  document.body.addEventListener("mousemove", this.__handleMouseMove.bind(this));
  document.body.addEventListener("dblclick", this.__handleMouseDoubleClick.bind(this));

  // Attach own context menu event
  document.body.addEventListener("contextmenu", this.__handleContextMenu.bind(this));

  // Keep state of where mouse went down and at what position
  this.__mouseDownObject = null;
  this.__currentMouseTile = null;
  this.__multiUseObject = null;

  // Track button states for both-buttons look shortcut
  this.__leftButtonDown = false;
  this.__rightButtonDown = false;
  this.__suppressNextContextMenu = false;

  // Right-click drag to move player
  this.__rightButtonPlayerDrag = false;
  this.__rightDragMoved = false;

  // Floating drag sprite (visual feedback while dragging items)
  this.__dragSprite = null;

}

Mouse.prototype.getCurrentTileHover = function () {

  /*
   * Function Mouse.getCurrentTileHover
   * Returns the current world tile that is being hovered over
   */

  return this.__currentMouseTile;

}

Mouse.prototype.sendItemMove = function (fromObject, toObject, count) {

  /*
   * Function Mouse.sendItemMove
   * Creates a packet to send an item to the server
   */

  // Stop if anything is missing
  if (fromObject === null || fromObject.which === null || toObject === null || toObject.which === null) {
    return;
  }

  gameClient.send(new ItemMovePacket(fromObject, toObject, count));

}

Mouse.prototype.setCursor = function (which) {

  /*
   * Function Mouse.setCursor
   * Updates the cursor style for the entire document
   */

  document.body.style.cursor = which;

}

Mouse.prototype.__renderDragSprite = function (object) {

  if (this.__dragSprite) {
    this.__clearDragSprite();
  }

  let item = object.which && object.which.peekItem(object.index);
  if (!item) return;

  let canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  canvas.style.position = "fixed";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "2147483647";
  canvas.style.imageRendering = "pixelated";

  let itemObj = new Item(item.id, item.count || 1);
  let frameGroup = itemObj.getFrameGroup(FrameGroup.prototype.NONE);
  if (frameGroup) {
    let frame = itemObj.getFrame();
    let pattern = itemObj.getPattern();
    let spriteIndex = frameGroup.getSpriteIndex(frame, pattern.x, pattern.y, pattern.z, 0, 0, 0);
    let spriteSrc = frameGroup.getSprite(spriteIndex);
    if (spriteSrc && spriteSrc.src) {
      let ctx = canvas.getContext("2d");
      ctx.drawImage(spriteSrc.src, 32 * spriteSrc.position.x, 32 * spriteSrc.position.y, 32, 32, 0, 0, 32, 32);
    }
  }

  document.body.appendChild(canvas);
  this.__dragSprite = canvas;

}

Mouse.prototype.__clearDragSprite = function () {

  if (this.__dragSprite) {
    this.__dragSprite.remove();
    this.__dragSprite = null;
  }

}

Mouse.prototype.__updateDragSpritePosition = function (event) {

  if (!this.__dragSprite) return;
  this.__dragSprite.style.left = (event.clientX - 16) + "px";
  this.__dragSprite.style.top = (event.clientY - 16) + "px";

}

Mouse.prototype.getWorldObject = function (event) {

  /*
   * Function Mouse.getWorldObject
   * Returns an object from the world
   */

  // Objects taken from the world are always at the top position (0xFF)
  return new Object({
    "which": gameClient.renderer.screen.getWorldCoordinates(event),
    "index": 0xFF
  });

}

Mouse.prototype.look = function (object) {

  /*
   * Function Mouse.look
   * Wrapper function to call a look event
   */

  // Take a look at the item on the tile (or container)
  let item = object.which.peekItem(object.index);

  if (object.which.constructor.name === "Container" && item === null) {
    return;
  }

  gameClient.send(new ItemLookPacket(object));

}

Mouse.prototype.use = function (object) {

  /*
   * Function Mouse.use
   * Wrapper function to call a use event
   */

  // Fetch the item from the object
  let item = object.which.peekItem(object.index);

  if (object.which instanceof Tile) {

    // Only target actual monsters (type !== 0), not the player
    let monsterList = Array.from(object.which.monsters).filter(function (c) { return c.type !== 0; });
    if (monsterList.length > 0) {

      if (gameClient.player.isInProtectionZone()) {
        return gameClient.interface.setCancelMessage("You may not attack from within protection zone.");
      }

      if (gameClient.interface.fightModeSelector && gameClient.interface.fightModeSelector.isSafeFight()) {
        return gameClient.interface.setCancelMessage("Safe Fight is enabled.");
      }

      return gameClient.world.targetMonster(object.which.monsters);
    }
  }

  // No item is being used  
  if (item !== null) {
    if (item.isMultiUse()) {
      return this.__setMultiUseItem(object);
    }
  }

  // Track which slot initiated this use, for precise container open association
  if (item && item.isContainer()) {
    gameClient.__pendingContainerOpen = {
      parentContainer: object.which,
      slotIndex: object.index
    };
  } else {
    gameClient.__pendingContainerOpen = null;
  }

  gameClient.send(new ItemUsePacket(object));

}

Mouse.prototype.__getSlotObject = function (event) {

  let slotIndex, containerIndex;

  let slotEl = event.target.closest('.slot');
  if (slotEl) {
    slotIndex = Number(slotEl.getAttribute("slotIndex"));
    let windowEl = slotEl.closest('[containerIndex]');
    containerIndex = windowEl ? Number(windowEl.getAttribute("containerIndex")) : NaN;
  } else if (event.target.className === "body") {
    slotIndex = 0;
    containerIndex = Number(event.target.parentElement.getAttribute("containerIndex"));
  } else {
    slotIndex = Number(event.target.getAttribute("slotIndex"));
    containerIndex = Number(event.target.parentElement.parentElement.getAttribute("containerIndex"));
  }

  let container = gameClient.player.getContainer(containerIndex);

  return new Object({
    "which": container,
    "index": slotIndex
  });

}

Mouse.prototype.__bindMoveCallback = function (fromObject, toObject) {

  /*
   * Function Mouse.__bindMoveCallback
   * Binds a callback to the move event for an item. May require a confirmation
   */

  // Creature push: top of stack on a tile with creatures targets the creature
  if (fromObject.index === 0xFF && fromObject.which.constructor.name === "Tile") {
    let topCreature = fromObject.which.getTopCreature();
    if (topCreature !== null) {
      return this.sendItemMove(fromObject, toObject, 1);
    }
  }

  // Check whether there is actually an item being moved
  let item = fromObject.which.peekItem(fromObject.index);

  // Still write item move maybe there is a creature
  if (item === null) {
    return this.sendItemMove(fromObject, toObject, 1);
  }

  // The item cannot be moved
  if (!item.isMoveable()) {
    return;
  }

  if (item.isStackable() && gameClient.keyboard.isShiftDown()) {
    return this.sendItemMove(fromObject, toObject, 1);
  }

  if (item.isStackable() && gameClient.keyboard.isControlDown() && item.count > 1) {

    // Open the move stackable item 
    let properties = new Object({
      "fromObject": fromObject,
      "toObject": toObject,
      "item": item
    });

    // Open model to select the number of items to move
    return gameClient.interface.modalManager.open("move-item-modal", properties);

  }

  return this.sendItemMove(fromObject, toObject, item.count);

}

Mouse.prototype.__handleCanvasMouseUp = function (event) {

  /*
   * Function Mouse.__handleCanvasMouseUp
   * Callback fired when the mouse is released from the canvas
   */

  // Right-click drag from player to adjacent tile: move character
  if (event.button === 2 && this.__rightButtonPlayerDrag) {
    this.__rightButtonPlayerDrag = false;

    let toObject = this.getWorldObject(event);

    if (toObject && toObject.which && toObject.which.constructor.name === "Tile") {
      let playerPos = gameClient.player.getPosition();
      let targetPos = toObject.which.getPosition();

      if (playerPos.besides(targetPos) && !playerPos.equals(targetPos)) {
        let direction = playerPos.getLookDirection(targetPos);
        if (direction !== null) {
          this.__rightDragMoved = true;
          gameClient.keyboard.handleMoveKey(direction);
        }
      }
    }

    return;
  }

  // No active element
  if (this.__mouseDownObject === null || this.__mouseDownObject.which === null) {
    return;
  }

  // If we are using an item already
  if (this.__multiUseObject !== null) {
    return this.__handleItemUseWith(this.__multiUseObject, this.__mouseDownObject);
  }

  // Get the world coordinates from the clicked canvas position
  let toObject = this.getWorldObject(event);

  // Started on game screen or canvas: we will do some client-side checks
  if (this.__mouseDownObject.which.constructor.name === "Tile") {

    // The down & up are the same: this is a click.
    if (this.__mouseDownObject.which === toObject.which) {
      return this.__handleMouseClick();
    }

    // The position where the item is used must be besides the player
    if (!this.__mouseDownObject.which.getPosition().besides(gameClient.player.getPosition())) {
      return gameClient.interface.setCancelMessage("You have to move closer.");
    }

  }

  // Write the move callback to the server
  return this.__bindMoveCallback(this.__mouseDownObject, toObject);

}

Mouse.prototype.__handleContextMenu = function (event) {

  /*
   * Function Mouse.__handleContextMenu
   * Callback fired when right mouse button is clicked to handle opening of the context menu's
   * The opened element varies on the DOM element that is being hovered over
   */

  // Stop default propagation
  event.preventDefault();

  // Was a right-click drag movement: suppress the context menu
  if (this.__rightDragMoved) {
    this.__rightDragMoved = false;
    this.__rightButtonDown = false;
    return;
  }

  // Track right button state
  this.__rightButtonDown = true;

  // Use-With cancellation: Right-click cancels the action
  if (this.__multiUseObject !== null) {
    this.__multiUseObject = null;
    this.setCursor("auto");
    return;
  }

  // Check if we should suppress this context menu (from Look action)
  if (this.__suppressNextContextMenu) {
    this.__suppressNextContextMenu = false;
    return;
  }

  // Close existing menu's
  gameClient.interface.menuManager.close();

  // Check if clicking on a container slot
  if (event.target.className.includes("slot") || event.target.className === "body") {
    return this.__handleSlotContextMenu(event);
  }

  // Delegate to the right handler
  if (event.target.id === "screen") {

    let tile = this.getWorldObject(event);

    // Attack monsters on right-click (unless safe fight is on)
    let monsters = tile !== null && tile.which.monsters && Array.from(tile.which.monsters).filter(function (c) { return c.type !== 0; });
    if (monsters && monsters.length > 0) {
      if (!gameClient.interface.fightModeSelector || !gameClient.interface.fightModeSelector.isSafeFight()) {
        return gameClient.world.targetMonster(tile.which.monsters);
      }
    }

    // Skip player attack on right-click when Ctrl is held (context menu mode)
    if (!event.ctrlKey) {
      let players = tile !== null && tile.which.monsters && Array.from(tile.which.monsters).filter(function (c) { return c.type === 0 && c !== gameClient.player; });
      if (players && players.length > 0) {
        if (gameClient.interface.fightModeSelector && gameClient.interface.fightModeSelector.isSafeFight()) {
          let playerTarget = players[0];
          if (gameClient.player.isCreatureTarget(playerTarget)) {
            gameClient.player.setTarget(null);
            gameClient.send(new TargetPacket(0));
            return;
          }
          gameClient.player.setTarget(playerTarget);
          gameClient.send(new TargetPacket(playerTarget.id));
          return;
        }
        return gameClient.interface.setCancelMessage("You may not attack this player, turn safe fight on.");
      }
    }

    // Use items directly on right-click
    // Open containers/corpses directly, use other items directly
    // Multi-use items enter multi-use mode directly (same as container slot behavior)
    if (tile !== null && tile.which.items.length > 0) {
      let topItem = tile.which.peekItem(0xFF);

      if (!topItem.isMultiUse()) {
        return this.use(tile);
      }

      // Multi-use items on right-click (without Ctrl) enter multi-use mode directly
      if (!event.ctrlKey) {
        return this.use(tile);
      }
    }

    // Only show context menu when Ctrl is held
    if (event.ctrlKey) {
      let menu = gameClient.interface.menuManager.getMenu("screen-menu");
      menu.element.querySelector("button[action=use]").innerHTML = "Use";
      if (tile !== null && tile.which.items.length > 0) {
        if (tile.which.peekItem(0xFF).isRotateable()) {
          menu.element.querySelector("button[action=use]").innerHTML = "Rotate";
        } else if (tile.which.peekItem(0xFF).isMultiUse()) {
          menu.element.querySelector("button[action=use]").innerHTML = "Use With";
        }
      }

      // Show "Change Outfit" when right-clicking on own player tile
      let changeOutfitBtn = menu.element.querySelector("button[action=change-outfit]");
      if (changeOutfitBtn) {
        if (tile !== null && gameClient.player !== null && tile.which) {
          let creature = tile.which.getTopCreature();
          if (creature === gameClient.player) {
            changeOutfitBtn.style.display = "block";
          } else {
            changeOutfitBtn.style.display = "none";
          }
        } else {
          changeOutfitBtn.style.display = "none";
        }
      }

      // Show "Start Market" only when right-clicking on self in protection zone
      let startMarketBtn = menu.element.querySelector("button[action=start-market]");
      if (startMarketBtn) {
        if (tile !== null && gameClient.player !== null && tile.which) {
          let creature = tile.which.getTopCreature();
          if (creature === gameClient.player) {
            let pz = gameClient.player.isInProtectionZone();
            startMarketBtn.style.display = pz ? "block" : "none";
          } else {
            startMarketBtn.style.display = "none";
          }
        } else {
          startMarketBtn.style.display = "none";
        }
      }

      // Show Attack button when right-clicking an attackable creature
      let attackBtn = menu.element.querySelector("button[action=attack]");
      if (attackBtn) {
        let creature = tile !== null && tile.which && tile.which.getTopCreature();
        if (creature && creature !== gameClient.player) {
          attackBtn.style.display = "block";
        } else {
          attackBtn.style.display = "none";
        }
      }

      // Show Trade/Accept Trade button when right-clicking another player
      let creature = tile !== null && tile.which && tile.which.getTopCreature();
      let tradeBtn = menu.element.querySelector("button[action=trade]");
      let acceptBtn = menu.element.querySelector("button[action=accept-trade]");
      let isPlayer = creature && creature.type === 0 && creature !== gameClient.player;
      if (isPlayer) {
        let tradeModal = gameClient.interface.modalManager.get("trade-modal");
        let hasPending = tradeModal && tradeModal.getRequesterName() === creature.getName();
        if (acceptBtn) acceptBtn.style.display = hasPending ? "block" : "none";
        if (tradeBtn) tradeBtn.style.display = hasPending ? "none" : "block";
      } else {
        if (acceptBtn) acceptBtn.style.display = "none";
        if (tradeBtn) tradeBtn.style.display = "none";
      }

      // Show Browse Market when right-clicking another player
      let marketBtn = menu.element.querySelector("button[action=browse-market]");
      if (marketBtn) {
        marketBtn.style.display = isPlayer ? "block" : "none";
      }

      // Update party context menu options
      let partyInviteBtn = menu.element.querySelector("button[action=party-invite]");
      let partyJoinBtn = menu.element.querySelector("button[action=party-join]");
      let partyLeaveBtn = menu.element.querySelector("button[action=party-leave]");
      let partyKickBtn = menu.element.querySelector("button[action=party-kick]");
      let partyPassBtn = menu.element.querySelector("button[action=party-pass]");

      if (partyInviteBtn) partyInviteBtn.style.display = "none";
      if (partyJoinBtn) partyJoinBtn.style.display = "none";
      if (partyLeaveBtn) partyLeaveBtn.style.display = "none";
      if (partyKickBtn) partyKickBtn.style.display = "none";
      if (partyPassBtn) partyPassBtn.style.display = "none";

      if (tile !== null && tile.which) {
        let creature = tile.which.getTopCreature();
        if (creature && creature !== gameClient.player) {
          if (gameClient.player && gameClient.player.__partyId) {
            if (partyLeaveBtn) partyLeaveBtn.style.display = "block";
            if (gameClient.player.__partyMembers) {
              let isLeader = gameClient.player.__partyLeaderId === gameClient.player.id;
              let isPartyMember = gameClient.player.__partyMembers.some(function(m) {
                return m.id === creature.id;
              });
              if (isLeader && isPartyMember) {
                if (partyKickBtn) partyKickBtn.style.display = "block";
                if (partyPassBtn) partyPassBtn.style.display = "block";
              }
            }
          } else {
            if (partyInviteBtn) partyInviteBtn.style.display = "block";
          }
        }

        if (gameClient.player && gameClient.player.__pendingPartyInvite) {
          if (creature && creature.getName && creature.getName() === gameClient.player.__pendingPartyInvite) {
            if (partyJoinBtn) partyJoinBtn.style.display = "block";
          }
        }
      }

      return gameClient.interface.menuManager.open("screen-menu", event);
    }

  }

  if (event.target.id === "chat-text-area" || event.target.className === "channel-empty") {
    return gameClient.interface.menuManager.open("chat-body-menu", event);
  }

  if (event.target.parentNode.id === "chat-text-area") {
    if (event.target.getAttribute("name") !== null) {
      return gameClient.interface.menuManager.open("chat-entry-menu", event);
    }
  }

  if (event.target.parentNode.className === "window") {
    if (event.target.parentNode.id === "friend-window") {
      return gameClient.interface.menuManager.open("friend-window-menu", event);
    }
  }

  if (event.target.className == "friend-entry") {
    return gameClient.interface.menuManager.open("friend-list-menu", event);
  }

  if (event.target.className.includes("chat-title")) {
    return gameClient.interface.menuManager.open("chat-header-menu", event);
  }

}

Mouse.prototype.__handleSlotContextMenu = function (event) {

  /*
   * Function Mouse.__handleSlotContextMenu
   * Handles right-click on container slots - always uses items directly
   */

  let slotObject = this.__getSlotObject(event);

  if (slotObject === null || slotObject.which === null) {
    return;
  }

  return this.use(slotObject);

}

Mouse.prototype.__handleItemUseWith = function (fromObject, toObject) {

  /*
   * Function Mouse.__handleItemUseWith
   * Handles a click on a container
   */

  let match = false;

  // Robust check: Compare containers by GUID or Tiles by Position
  if (fromObject.which && toObject.which && fromObject.index === toObject.index) {
    // Both are Containers
    if (fromObject.which.constructor.name === "Container" && toObject.which.constructor.name === "Container") {
      if (fromObject.which.guid === toObject.which.guid) {
        match = true;
      }
    }
    // Both are Tiles
    else if (fromObject.which.constructor.name === "Tile" && toObject.which.constructor.name === "Tile") {
      let p1 = fromObject.which.getPosition();
      let p2 = toObject.which.getPosition();
      if (p1.x === p2.x && p1.y === p2.y && p1.z === p2.z) {
        match = true;
      }
    }
  }

  // Toggle behavior: If targeting the same object (clicking the source again), cancel the action
  if (match) {
    this.__multiUseObject = null;
    this.setCursor("auto");
    return;
  }

  gameClient.send(new ItemUseWithPacket(fromObject, toObject));

  // Reset the multi-use items and cursor
  this.__multiUseObject = null;
  this.setCursor("auto");

}

Mouse.prototype.__handleMouseClick = function () {

  /*
   * Function Mouse.__handleMouseClick
   * Handles the call when the mouse is clicked at one position
   */

  // Only send a click event when held down
  if (gameClient.keyboard.isControlDown()) {
    return this.use(this.__mouseDownObject);
  }

  // When shift is held
  if (gameClient.keyboard.isShiftDown()) {
    return this.look(this.__mouseDownObject);
  }

  if (this.__multiUseObject !== null) {
    return;
  }

  // Player has autowalk requested
  if (!gameClient.player.isMoving() && this.__mouseDownObject.which.constructor.name === "Tile") {
    return gameClient.world.pathfinder.findPath(gameClient.player.__position, gameClient.renderer.screen.getWorldCoordinates(event).__position);
  }

}

Mouse.prototype.__handleMouseDown = function (event) {

  /*
   * Function Mouse.__handleMouseDown
   * Handles the mouse down event
   */

  // Must be connected to the gameserver
  if (!gameClient.networkManager.isConnected()) {
    return;
  }

  // Block input when player is dead
  if (gameClient.player && gameClient.player.isDead) {
    return;
  }

  // Track left button state
  if (event.button === 0) {
    this.__leftButtonDown = true;
  }

  // Track right button for player drag movement
  if (event.button === 2) {
    this.__rightButtonDown = true;
    this.__rightDragMoved = false;

    if (!this.__leftButtonDown) {
      let tile = gameClient.renderer.screen.getWorldCoordinates(event);

      if (tile && tile.constructor.name === "Tile" &&
        tile.getPosition().equals(gameClient.player.getPosition())) {
        this.__rightButtonPlayerDrag = true;
      } else {
        this.__rightButtonPlayerDrag = false;
      }
    } else {
      this.__rightButtonPlayerDrag = false;
    }

    return;
  }

  // Only process left button for normal operations
  if (event.buttons !== 1) {
    return;
  }

  if (gameClient.interface.menuManager.isOpened() && event.target.tagName !== "BUTTON") {
    gameClient.interface.menuManager.close();
  }

  // Set the selected event
  this.__setSelectedObject(event);

  // Use-With cancellation: Click on void (canvas/slot not targeted) cancels the action
  if (this.__multiUseObject !== null && (this.__mouseDownObject === null || this.__mouseDownObject.which === null)) {
    this.__multiUseObject = null;
    this.setCursor("auto");
    return;
  }

  if (!gameClient.keyboard.isShiftDown() && !gameClient.keyboard.isControlDown()) {
    this.setCursor("default");
  }

}

Mouse.prototype.__handleMouseDoubleClick = function (event) {

  if (event.target.className === "chat-message") {

    let name = event.target.getAttribute("name");

    if (name !== null) {
      return gameClient.interface.channelManager.addPrivateChannel(name);
    }

  }

}

Mouse.prototype.__handleMouseMove = function (event) {

  /*
   * Function Mouse.__handleMouseMove
   * Callback fired when the mouse is moved over the screen
   */

  // Must be connected to the gameserver
  if (!gameClient.isRunning()) {
    return;
  }

  // Update with the current mouse position
  this.__currentMouseTile = gameClient.renderer.screen.getWorldCoordinates(event);

  // Update cursor as required
  this.__updateCursorMove(event.target);

  // Move the floating drag sprite to follow the cursor
  this.__updateDragSpritePosition(event);

}

Mouse.prototype.__updateCursorMove = function (target) {

  /*
   * Function Mouse.__updateCursorMove
   * Updates the cursor based on the currently passed target element
   */

  if (gameClient.keyboard.isShiftDown() || gameClient.keyboard.isControlDown()) {
    return window.getSelection().removeAllRanges();
  }

  // Block when using or dragging an item
  if (this.__multiUseObject !== null || this.__mouseDownObject !== null) {
    return window.getSelection().removeAllRanges();
  }

  // Hovering over a slot
  if (target.className.includes("slot")) {
    return this.setCursor("default");
  }

  let tile = this.getCurrentTileHover();

  // In gameworld but nothing there
  if (tile === null) {
    return this.setCursor("default");
  }

  // No items
  if (tile.items.length === 0) {
    return this.setCursor("default");
  }

  let item = tile.peekItem(0xFF);


  if (item.isPickupable() || item.isMoveable()) {
    return this.setCursor("default");
  }

  this.setCursor("default");

}

Mouse.prototype.__handleMouseUp = function (event) {

  /*
   * Function Mouse.__handleMouseUp
   * Handles the mouse up event and delegates to the appropriate subroutine
   */

  // Reset button tracking on mouseup
  if (event.button === 0) {
    this.__leftButtonDown = false;
  }
  if (event.button === 2) {
    this.__rightButtonDown = false;
  }

  // Must be connected to the gameserver
  if (!gameClient.networkManager.isConnected()) {
    return;
  }

  // Block input when player is dead
  // Clear floating drag sprite at start of every mouseup
  this.__clearDragSprite();

  if (gameClient.player && gameClient.player.isDead) {
    return;
  }

  // Game world window
  if (event.target === gameClient.renderer.screen.canvas) {
    this.__handleCanvasMouseUp(event);
  } else if (event.target.closest('#trade-modal') && this.__mouseDownObject && this.__mouseDownObject.which) {
    this.__handleTradeSlotDrop(event);
  } else if (event.target.closest('#market-modal') && this.__mouseDownObject && this.__mouseDownObject.which) {
    this.__handleMarketSlotDrop(event);
  } else if (event.target.closest('.slot') || event.target.className === "body") {
    this.__handleSlotMouseUp(event);
  } else if (this.__mouseDownObject && this.__mouseDownObject.which) {
    // Dropped an item onto the equipment panel background -> auto-store to first open container
    let dropInEquipment = event.target.closest(".wrapper.equipment");
    if (dropInEquipment) {
      // Check player adjacency when dragging from the ground
      if (this.__mouseDownObject.which.constructor.name === "Tile") {
        if (!this.__mouseDownObject.which.getPosition().besides(gameClient.player.getPosition())) {
          return;
        }
      }
      let containers = gameClient.player.__openedContainers;
      if (containers && containers.size > 0) {
        let firstContainer = containers.values().next().value;
        let toObject = new Object({
          "which": firstContainer,
          "index": 0xFF
        });
        this.__bindMoveCallback(this.__mouseDownObject, toObject);
      }
    }
  }

  // Reset the selected object (if any)
  this.__mouseDownObject = null;

  // Reset the cursor
  if (this.__multiUseObject === null) {
    this.setCursor("auto");
  }

}

Mouse.prototype.__handleSlotMouseUp = function (event) {

  /*
   * Function Mouse.__handleSlotMouseUp
   * Handles the mouse up event on a slot
   */

  // In multi-use mode (crosshair cursor), treat slot click as "use with" instead of move
  if (this.__multiUseObject !== null) {
    let toObject = this.__getSlotObject(event);
    return this.__handleItemUseWith(this.__multiUseObject, toObject);
  }

  if (this.__mouseDownObject === null || this.__mouseDownObject.which === null) {
    return;
  }

  let toObject = this.__getSlotObject(event);

  // Moving from the world: check player adjacency
  if (this.__mouseDownObject.which.constructor.name === "Tile") {

    // The position where the item is used must be besides the player
    if (!this.__mouseDownObject.which.getPosition().besides(gameClient.player.getPosition())) {
      return;
    }

  }

  // Move from container: check if it the same slot? Then it is a click not a move!
  if (this.__mouseDownObject.which instanceof Container) {

    // Source and destination are identical: do nothing
    if (this.__mouseDownObject.which === toObject.which && this.__mouseDownObject.index === toObject.index) {
      return this.__handleMouseClick();
    }

  }

  return this.__bindMoveCallback(this.__mouseDownObject, toObject);

}

Mouse.prototype.__handleTradeSlotDrop = function (event) {

  if (!this.__mouseDownObject || !this.__mouseDownObject.which) return;
  if (this.__mouseDownObject.which.constructor.name === "Tile") return;

  if (!event.target.closest('#trade-your-slots')) return;

  let fromObj = this.__mouseDownObject;
  let container = fromObj.which;
  let slotIndex = fromObj.index;

  let item = container.getSlotItem(slotIndex);
  if (!item) return;

  if (item.isStackable() && item.getCount() > 1) {
    let tradeModal = gameClient.interface.modalManager.get("trade-modal");
    if (tradeModal) {
      tradeModal.__showCountSelector(container.__containerId, slotIndex, item.getCount(), item.id);
    }
    return;
  }

  gameClient.send(new TradeAddItemPacketClient(container.__containerId, slotIndex, 1));

}

Mouse.prototype.__handleMarketSlotDrop = function (event) {

  if (!this.__mouseDownObject || !this.__mouseDownObject.which) return;
  if (this.__mouseDownObject.which.constructor.name === "Tile") return;

  let fromObj = this.__mouseDownObject;
  let container = fromObj.which;
  let slotIndex = fromObj.index;

  if (container.constructor.name === "Equipment") {
    gameClient.interface.setCancelMessage("You cannot drag items from your equipment.");
    return;
  }

  let item = container.getSlotItem(slotIndex);
  if (!item) return;
  if (item.isContainer && item.isContainer()) {
    gameClient.interface.setCancelMessage("You cannot sell containers.");
    return;
  }

  let marketModal = gameClient.interface.modalManager.get("market-modal");
  if (!marketModal) return;

  let total = marketModal.__countTotalItems(item.id);
  if (total > 1) {
    marketModal.__showCountSelector(total, function (count) {
      marketModal.__addDraggedItem({ id: item.id, count: count });
    });
  } else {
    marketModal.__addDraggedItem(item);
  }

}

Mouse.prototype.__setMultiUseItem = function (object) {

  /*
   * Function Mouse.__setMultiUseItem
   * Saves a reference to the item that is being moved or used
   */

  // Update the cursor
  this.setCursor("move");
  this.__multiUseObject = object;

}

Mouse.prototype.__setSelectedObject = function (event) {

  /*
   * Function Mouse.__setSelectedObject
   * Gets the selected objects and sets it to the variable
   */

  // The clicked element is the screen or a slot
  if (event.target === gameClient.renderer.screen.canvas) {
    this.__mouseDownObject = this.getWorldObject(event);
    if (this.__mouseDownObject && this.__mouseDownObject.which) {
      this.__renderDragSprite(this.__mouseDownObject);
    }
  } else if (event.target.closest('.slot')) {
    this.__mouseDownObject = this.__getSlotObject(event);
    if (this.__mouseDownObject && this.__mouseDownObject.which) {
      this.__renderDragSprite(this.__mouseDownObject);
    }
  }

}
