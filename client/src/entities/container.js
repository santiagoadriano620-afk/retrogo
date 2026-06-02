const Container = function (properties) {

  /*
   * Class Container
   * Wrapper for a container on the DOM
   */

  // Inherits from container with count zero
  Item.call(this, properties.id, 0);

  // The number of slots in the container and its identifier
  this.__containerId = properties.cid;
  this.size = properties.items.length;

  // Create the slots for items to be added
  this.slots = new Array();

}

Container.prototype = Object.create(Item.prototype);
Container.prototype.constructor = Container;

Container.prototype.createDOM = function (title, items, itemId) {

  /*
   * Function Container.createDOM
   * Creates the DOM for the container
   */

  let element = this.createElement(this.__containerId);
  this.window = new InteractiveWindow(element);
  gameClient.interface.windowManager.register(this.window);

  let rightStack = gameClient.interface.windowManager.getStack("right");
  let extraStack = gameClient.interface.windowManager.getStack("extra");
  let extraWrapper = extraStack ? extraStack.parentElement : null;

  // Measure FULL height of this container
  let ROWS = Math.ceil(this.size / 4);
  let FULL = 56 + ROWS * 34 + (ROWS - 1) * 1;

  // Helper: sum actual offsetHeights of existing containers in a stack
  function totalUsedInStack(stack) {
    let total = 0;
    Array.from(stack.children).filter(function (el) {
      return el.hasAttribute("containerIndex");
    }).forEach(function (el) {
      total += el.offsetHeight;
    });
    return total;
  }

  // Helper: available height inside a stack
  function getStackCapacity(stack) {
    let rect = stack.getBoundingClientRect();
    return Math.max(0, window.visualViewport.height - rect.top);
  }

  // Try right column first (with tolerance for flex-shrink compression)
  let rightCapacity = getStackCapacity(rightStack);
  if (totalUsedInStack(rightStack) + FULL <= rightCapacity + 60) {
    this.window.addTo(rightStack);
    Container._addContent(this, element, title, items, itemId);
    return;
  }

  // Try extra column
  if (extraStack) {
    let extraCapacity = getStackCapacity(extraStack);
    if (totalUsedInStack(extraStack) + FULL <= extraCapacity) {
      this.window.addTo(extraStack);
      extraWrapper.classList.add("has-windows");
      Container._addContent(this, element, title, items, itemId);
      return;
    }

    // Replace last container in extra column
    let extraChildren = Array.from(extraStack.children).filter(function (el) {
      return el.hasAttribute("containerIndex");
    });
    if (extraChildren.length > 0) {
      let last = extraChildren[extraChildren.length - 1];
      let lastIndex = Number(last.getAttribute("containerIndex"));
      let lastContainer = gameClient.player.getContainer(lastIndex);
      if (lastContainer) {
        gameClient.player.__openedContainers.forEach(function (parent) {
          parent.slots.forEach(function (slot) {
            if (slot.item && slot.item.__openContainerId === lastContainer.__containerId) {
              slot.item.__openContainerId = undefined;
            }
          });
        });
        if (gameClient.player.equipment) {
          gameClient.player.equipment.slots.forEach(function (slot) {
            if (slot.item && slot.item.__openContainerId === lastContainer.__containerId) {
              slot.item.__openContainerId = undefined;
            }
          });
        }
        gameClient.player.__openedContainers.delete(lastContainer);
        lastContainer.window.remove();
        gameClient.player.__openedContainers.forEach(function (c) {
          c.__updateContainerIndicators();
        });
        let hasVisible = Array.from(extraStack.children).some(function (child) {
          return child.style.display !== "none" && child.style.display !== "";
        });
        if (!hasVisible) {
          extraWrapper.classList.remove("has-windows");
        }
      }
    }
    this.window.addTo(extraStack);
    extraWrapper.classList.add("has-windows");
    Container._addContent(this, element, title, items, itemId);
    return;
  }

  // Fallback to right column
  this.window.addTo(rightStack);
  Container._addContent(this, element, title, items, itemId);

}

Container._addContent = function (self, element, title, items, itemId) {

  // Attach a listener to the window close event to inform the server of container close
  self.window.on("close", self.close.bind(self));
  self.window.on("back", self.handleBack.bind(self));
  self.window.state.title = title.capitalize();

  // Replace the generic bag icon with the actual item sprite
  if (itemId && typeof gameClient !== "undefined" && gameClient.spriteBuffer) {
    try {
      let item = new Item(itemId, 1);
      let frameGroup = item.getFrameGroup(FrameGroup.prototype.NONE);
      if (frameGroup) {
        let frame = item.getFrame();
        let pattern = item.getPattern();
        let index = frameGroup.getSpriteIndex(frame, pattern.x, pattern.y, pattern.z, 0, 0, 0);
        let sprite = frameGroup.getSprite(index);
        if (sprite && sprite.src) {
          let iconEl = element.querySelector(".window-icon");
          if (iconEl) {
            let canvas = document.createElement("canvas");
            canvas.width = 12;
            canvas.height = 12;
            canvas.style.cssText = "width:12px;height:12px;vertical-align:middle;margin:1px 4px 0 3px;display:inline-block";
            iconEl.parentNode.replaceChild(canvas, iconEl);
            let ctx = canvas.getContext("2d");
            ctx.drawImage(
              sprite.src,
              32 * sprite.position.x, 32 * sprite.position.y, 32, 32,
              0, 0, 12, 12
            );
          }
        }
      }
    } catch (e) {
      console.warn("[Container] Failed to draw item sprite icon:", e);
    }
  }

  // Show back button if there are other containers open
  if (gameClient.player.__openedContainers.size > 0) {
    let backBtn = element.querySelector('.container-btn[action="back"]');
    if (backBtn) backBtn.classList.add("visible");
  }

  // Adds the slots to the existing window body
  self.createBodyContent(self.size);

  // Add the items to the slots
  self.addItems(items);

}

Container.prototype.createElement = function (index) {

  /*
   * Function Container.createElement
   * Creates a copy of the container prototype
   */

  // Copy over the container prototype from the DOM
  let element = document.getElementById("container-prototype").cloneNode(true);
  element.style.display = "flex";
  element.style.width = "152px";
  element.setAttribute("containerIndex", index);

  // Mobile: Position containers at the bottom of the screen
  if (gameClient.touch && gameClient.touch.isMobileMode) {
    var openContainers = document.querySelectorAll('.window[containerIndex]').length;
    var stackOffset = openContainers * 40;

    element.style.setProperty('position', 'fixed', 'important');
    element.style.setProperty('left', 'auto', 'important');
    element.style.setProperty('right', '5px', 'important');
    element.style.setProperty('top', 'auto', 'important');
    element.style.setProperty('bottom', (70 + stackOffset) + 'px', 'important');
    element.style.setProperty('max-height', '50vh', 'important');
    element.style.setProperty('transform', 'scale(0.75)', 'important');
  }

  return element;

}

Container.prototype.handleBack = function () {

  /*
   * Function Container.handleBack
   * Handles the back navigation to the parent container
   */

  // Close the current container (server will handle parent navigation if applicable)
  this.close();

}

Container.prototype.close = function () {

  /*
   * Function Container.close
   * Callback fired when the container is closed
   */

  // Dereference the container!
  gameClient.player.closeContainer(this);

}

Container.prototype.peekItem = function (index) {

  return this.getSlotItem(index);

}

Container.prototype.getSlot = function (index) {

  return this.slots[index];

}

Container.prototype.getSlotItem = function (index) {

  /*
   * Function Container.getSlot
   * Returns the slot from the container at an index
   */

  // The slot does not exist
  if (index < 0 || index >= this.slots.length) {
    return null;
  }

  return this.getSlot(index).item;

}

Container.prototype.createBodyContent = function (size) {

  /*
   * Function createBodyDOM
   * Creates the model for the body that contains slots
   */

  // Add all slots to the body of the window
  let body = this.window.getElement(".body");

  // Clear any leftover inline styles from old squeeze code
  body.style.maxHeight = "";
  body.style.height = "";
  body.style.minHeight = "";
  body.style.gap = "1px";

  // Create the requested number of slots in the backpack
  for (let i = 0; i < size; i++) {
    let slot = new Slot();
    slot.createDOM(i);
    // keyring icon removed
    this.slots.push(slot);
  }

  // Add all the slots to the parent body
  this.slots.forEach(function (slot) {
    body.appendChild(slot.element);
  });

}

Container.prototype.addItems = function (items) {

  /*
   * Function Container.addItems
   * Function to add an array of items to the container
   */

  items.forEach(this.addItem.bind(this));

}

Container.prototype.addItem = function (item, slot) {

  /*
   * Function Container.addItem
   * Adds a single item to the container at a particular slot
   */

  // Item is the nullptr: add nothing
  if (item === null) {
    return;
  }

  item.__parent = this;

  // Delegate
  this.__setItem(slot, item);

  // Render the container
  this.__render();

  // Update container open indicators
  this.__updateContainerIndicators();

}

Container.prototype.__setItem = function (slot, item) {

  /*
   * Function Container.setItem
   * Sets an item to an appropriate slot
   */

  this.slots[slot].setItem(item);

}

Container.prototype.clearSlot = function (slot) {

  /*
   * Function Container.clearSlot
   * Clears a particular slot in the container
   */

  this.__setItem(slot, null);
  this.slots[slot].element.className = "slot";
  this.getSlot(slot).render();
  this.__updateContainerIndicators();

}

Container.prototype.removeItem = function (slot, count) {

  /*
   * Function Container.removeItem
   * Removes an item (optional count) from the given slot in the container
   */

  // If the item is stackable we should account for the removed count
  if (!this.slots[slot].item.isStackable() || count === 0) {
    return this.clearSlot(slot);
  }

  // Subtract the count
  this.slots[slot].item.count -= count;

  // If the remaining count is zero the item has been fully depleted
  if (this.slots[slot].item.count === 0) {
    return this.clearSlot(slot);
  }

  this.getSlot(slot).render();
  this.__updateContainerIndicators();

}

Container.prototype.__updateContainerIndicators = function () {

  /*
   * Function Container.__updateContainerIndicators
   * Updates the open-container indicator on each slot
   */

  this.slots.forEach(function (slot) {
    let show = false;
    if (slot.item && slot.item.isContainer() && slot.item.__openContainerId !== undefined) {
      if (gameClient.player.getContainer(slot.item.__openContainerId)) {
        show = true;
      }
    }
    slot.setOpenContainerIndicator(show);
  });

}

Container.prototype.__renderAnimated = function () {

  this.slots.forEach(function (slot) {
    slot.__renderAnimated();
  });

}

Container.squeezeFromBottom = function (stack) {
  var items = Array.from(stack.children).filter(function (el) {
    return el.hasAttribute("containerIndex");
  });
  items.forEach(function (el) {
    stack.appendChild(el);
  });
};

Container.prototype.__render = function () {

  /*
   * Function Container.__render
   * Draws the container
   */

  this.slots.forEach(function (slot) {
    slot.render();
  });

}
