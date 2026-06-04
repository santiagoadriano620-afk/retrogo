const WindowManager = function () {

  /*
   * Function WindowManager
   * Manages all windows (e.g. skills, battle list)
   *
   * API:
   *
   * Function closeAll - Closes all the opened windows in e.g., a client reset
   * Function getStack - Returns the particular stack (left or right) DOM element
   * Function getWindow - Returns a reference to a window with a particular name
   *
   */

  this.windows = new Object({
    "battle-window": new BattleWindow(document.getElementById("battle-window")),
    "skill-window": new SkillWindow(document.getElementById("skill-window")),
    "friend-window": new FriendWindow(document.getElementById("friend-window")),
    "quest-tracker-window": new QuestTrackerWindow(document.getElementById("quest-tracker-window")),
    "party-window": new PartyWindow(document.getElementById("party-window")),
  });

  this.stacks = document.getElementsByClassName("column");
  this.__attachStackEventListeners(this.stacks);

  // Default add to right column
  this.getWindow("battle-window").addTo(this.getStack("right"));
  this.getWindow("skill-window").addTo(this.getStack("right"));
  this.getWindow("friend-window").addTo(this.getStack("right"));
  this.getWindow("quest-tracker-window").addTo(this.getStack("right"));
  this.getWindow("party-window").addTo(this.getStack("right"));


  // State object of the mouse
  this.state = new State();
  this.state.add("currentDragElement", null),
    this.state.add("currentMouseElement", null),
    this.state.add("mouseDownTarget", null);
  this.state.add("currentDragElementOffset", null);

  // Callback one mouse move
  document.addEventListener("mousemove", this.__handleMove.bind(this));
  document.addEventListener("mouseup", this.__handleMouseUp.bind(this));

  // Add the event listeners for dragging and mouse down/up events
  Object.values(this.windows).forEach(this.register.bind(this), this);

}

WindowManager.prototype.register = function (gameWindow) {

  this.__addListeners(gameWindow);

}

WindowManager.prototype.getWindow = function (name) {

  /*
   * Function WindowManager.getWindow
   * Returns the window for a particular name
   */

  // Does not exist
  if (!this.windows.hasOwnProperty(name)) {
    return null;
  }

  return this.windows[name];

}

WindowManager.prototype.__addListeners = function (gameWindow) {

  /*
   * Function WindowManager.addListeners
   * Returns the window for a particular name
   */

  // Add event listeners to the particular element
  gameWindow.__element.addEventListener("dragstart", this.__handleDragStart.bind(this));
  gameWindow.__element.addEventListener("dragend", this.__handleDragEnd.bind(this));
  gameWindow.__element.addEventListener("mousedown", this.__handleMouseDown.bind(this, gameWindow));

  // Direct resize handler on the footer
  let footer = gameWindow.__element.querySelector(".footer");
  if (footer) {
    let resizeData = null;
    footer.addEventListener("mousedown", function (event) {
      if (event.button !== 0) return;
      event.preventDefault();
      let el = gameWindow.__element;
      let body = el.querySelector(".body");
      let startY = event.clientY;
      let startH = el.offsetHeight;
      let rect = el.getBoundingClientRect();
      let maxH = window.visualViewport.height - rect.top - 4;
      // Containers: never taller than the last slot
      if (el.hasAttribute("containerIndex") && body) {
        let naturalH = body.scrollHeight + 26;
        maxH = Math.min(maxH, naturalH);
      }
      resizeData = { el, startY, startH, maxH };
    });
    document.addEventListener("mousemove", function handleMove(event) {
      if (!resizeData) return;
      let newH = resizeData.startH + (event.clientY - resizeData.startY);
      resizeData.el.style.height = Math.max(80, Math.min(newH, resizeData.maxH)) + "px";
    });
    document.addEventListener("mouseup", function handleUp() {
      resizeData = null;
    });
  }

}

WindowManager.prototype.closeAll = function () {

  /*
   * Function WindowManager.closeAll
   * Closes all the opened windows
   */

  // Close all the windows
  Object.values(this.windows).forEach(gameWindow => gameWindow.close());

}

WindowManager.prototype.getStack = function (stack) {

  /*
   * Function WindowManager.getStack
   * Returns the stack that belongs either left or right
   */

  switch (stack) {
    case "right":
      return this.stacks[1];
    case "extra":
      return this.stacks[0];
    default:
      return console.error("Unknown stack requested.");
  }

}

WindowManager.prototype.getFreeStack = function (requiredHeight) {

  /*
   * Function WindowManager.getFreeStack
   * Returns the best stack to open a window, preferring right side.
   * Falls back to extra, then left if no space.
   */

  if (requiredHeight === undefined) {
    requiredHeight = 0;
  }

  // Check stacks in order: right → extra → left
  let stacksToCheck = ["right", "extra"];

  for (let i = 0; i < stacksToCheck.length; i++) {
    let stack = this.getStack(stacksToCheck[i]);
    if (!stack) continue;

    let visibleHeight = this.__getVisibleStackHeight(stack);

    // Get the parent container to compute available height
    let parent = stack.parentElement;
    let parentHeight = parent ? parent.clientHeight : window.visualViewport.height;

    // Subtract siblings' height (elements inside parent that are not the stack)
    let siblingsHeight = 0;
    if (parent) {
      Array.from(parent.children).forEach(function (sibling) {
        if (sibling !== stack) {
          siblingsHeight += sibling.offsetHeight;
        }
      });
    }

    let limit = parentHeight - siblingsHeight;

    if (visibleHeight + requiredHeight <= limit) {
      return stack;
    }
  }

  // Fallback: extra stack is always available
  return this.getStack("extra");

}

WindowManager.prototype.__getVisibleStackHeight = function (stack) {

  let visibleHeight = 0;
  Array.from(stack.children).forEach(function (child) {
    if (child.style.display !== "none" && child.style.display !== "") {
      visibleHeight += child.offsetHeight;
    }
  });
  return visibleHeight;

}

WindowManager.prototype.__attachStackEventListeners = function (stacks) {

  /*
   * Function WindowManager.__attachStackEventListeners
   * Updates the skill value with a new provided value
   */

  // Attach drag/drop listeners to all column stacks
  Array.from(stacks).forEach(function (element) {
    element.addEventListener("dragover", this.__handleDragOver.bind(this));
    element.addEventListener("drop", this.__handleWindowDrop.bind(this));
  }, this);

}

WindowManager.prototype.__handleDragOver = function (event) {

  /*
   * Function WindowManager.__handleDragOver
   * Allows drop by preventing default browser behavior
   */

  event.preventDefault();

}

WindowManager.prototype.__handleMove = function (event) {

  /*
   * Function WindowManager.__handleMove
   * Callback fired when the mouse is moved
   */

  // There is currently no element being dragged
  if (this.state.currentMouseElement === null) {
    return;
  }

  let body = this.state.currentMouseElement.getBody();
  body.style.height = (event.clientY - body.offsetTop - 12) + "px";

}

WindowManager.prototype.__handleWindowDrop = function (event) {

  /*
   * Function WindowManager.__handleWindowDrop
   * Handles drop of a window in the window stack
   */

  event.preventDefault();

  // Get the target of the element being dropped on
  let element = event.target;

  if (this.state.currentDragElement === null) {
    return;
  }

  // Dropped in the stack element itself: append the element
  if (element.className === "column") {
    element.append(this.state.currentDragElement);
    this.__updateExtraColumnState();
    return;
  }

  // If dropped on the extra column wrapper, find the column inside
  if (element.id === "extra-column-wrapper") {
    let column = element.querySelector(".column");
    if (column) {
      column.append(this.state.currentDragElement);
      this.__updateExtraColumnState();
      return;
    }
  }

  // Run up the dropped area to get the window being swapped
  let iterations = 0;
  while (element.parentElement && element.parentElement.className !== "column") {
    element = element.parentElement;
    iterations++;
    if (iterations > 20) {
      break;
    }
  }

  // Nothing to do if the same element is being hovered on
  if (element === this.state.currentDragElement) {
    return;
  }

  // Commit to swapping the windows!
  if (element.previousSibling === this.state.currentDragElement) {
    element.parentNode.insertBefore(element, this.state.currentDragElement);
  } else {
    element.parentNode.insertBefore(this.state.currentDragElement, element);
  }

  this.__updateExtraColumnState();

}

WindowManager.prototype.__updateExtraColumnState = function () {

  let extraWrapper = document.getElementById("extra-column-wrapper");
  if (!extraWrapper) return;

  let extraStack = this.getStack("extra");
  let hasVisible = Array.from(extraStack.children).some(function (child) {
    return child.style.display !== "none" && child.style.display !== "";
  });

  if (hasVisible) {
    extraWrapper.classList.add("has-windows");
  } else {
    extraWrapper.classList.remove("has-windows");
  }

}

WindowManager.prototype.__handleDragEnd = function (event) {

  /*
   * Function WindowManager.handleDragEnd
   * Returns the window for a particular name
   */

  // Check if there is a current drag element (drag may have been cancelled)
  if (this.state.currentDragElement === null) {
    event.target.style.opacity = 1;
    return;
  }

  // Reset the opacity and current element
  this.state.currentDragElement.children[1].scrollTop = this.state.currentDragElementOffset;
  this.state.currentDragElement = null;
  this.state.currentDragElementOffset = null;

  event.target.style.opacity = 1;

  this.__updateExtraColumnState();

}

WindowManager.prototype.__handleMouseDown = function (gameWindow, event) {

  /*
   * Function Window.__handleMouseDown
   * Callback fired when mouse is pushed down
   */

  this.state.mouseDownTarget = event.target;

  if (event.target.className === "footer") {
    this.state.currentMouseElement = gameWindow;
  }

}

WindowManager.prototype.__handleDragStart = function (event) {

  /*
   * Function Window.__handleDragStart
   * Callback fired when the dragging is started
   */

  // Can only be dragged by the header of the window
  if (this.state.mouseDownTarget.className !== "header") {
    return event.preventDefault();
  }

  // Set the currently dragged element and opacity
  this.state.currentDragElement = event.target;
  this.state.currentDragElementOffset = event.target.children[1].scrollTop;

  // Drop the opacity to show being dragged
  event.target.style.opacity = 0.25;

}

WindowManager.prototype.__handleMouseUp = function (event) {

  /*
   * Function Window.__handleMouseUp
   * Callback fired when mouse is pushed up
   */

  this.state.currentMouseElement = null;

}