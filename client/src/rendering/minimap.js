const Minimap = function () {

  /*
   * Class Minimap
   * Creates an off-screen canvas that holds the full minimap
   */

  this.minimap = new Canvas("minimap", 160, 160);
  this.__applyCanvasSize(160, 160);

  // There are 16 minimap layers (8 above and 8 below ground)
  this.nLayers = 16;

  // Minimap state of the current zoom level and what layer is being renderer
  this.__zoomLevel = 0;
  this.__renderLayer = 7; // Default to surface level (Z=7)

  this.__imageBuffers = new Array();
  this.__currentIndex = null;

  // Current center of the minimap relative to the player character
  this.center = new Position(0, 0, 0);

  // Mark/pin system
  this.__marks = [];
  this.__pendingMarkEvent = null;
  this.__editingMarkId = null;
  this.__selectedMarkId = null;

  // Drag state for left-click pan
  this.__isDragging = false;
  this.__dragStartX = 0;
  this.__dragStartY = 0;
  this.__lastMouseX = 0;
  this.__lastMouseY = 0;
  this.__dragThreshold = 3;

  // Fixed size
  this.__width = 160;
  this.__height = 160;

  // Preload flag images (1 to 19)
  this.__flagImages = [];
  this.__preloadFlags();

  // Load saved marks
  this.__loadMarks();

  // Big minimap overlay (double-click to open)
  this.__bigOverlay = document.getElementById("big-minimap-overlay");
  this.__bigCanvas = document.getElementById("big-minimap-canvas");
  this.__bigIsOpen = false;
  this.__bigIsDragging = false;
  this.__bigLastMouseX = 0;
  this.__bigLastMouseY = 0;
  this.__lastClickTime = 0;

  this.addEventListeners();

  // Auto-save minimap chunks every 30 seconds
  this.__autosaveInterval = setInterval(this.save.bind(this), 30000);

  // Save chunks before page unload (tab close / refresh)
  window.addEventListener("beforeunload", this.save.bind(this));

}

Minimap.prototype.openLargeMap = function () {

  gameClient.interface.modalManager.open("map-modal");

}

Minimap.prototype.cache = function () {

  /*
   * Function Minimap.cache
   * Caches the required minimap chunks
   */

  let position = gameClient.player.getPosition();

  let halfW = this.__width / 2;
  let halfH = this.__height / 2;

  // Bounding rectangle for the minimap
  let upperWest = new Position(position.x - halfW, position.y - halfH, this.__renderLayer);
  let upper = new Position(position.x, position.y - halfH, this.__renderLayer);
  let upperEast = new Position(position.x + halfW, position.y - halfH, this.__renderLayer);
  let east = new Position(position.x + halfW, position.y, this.__renderLayer);
  let lowerEast = new Position(position.x + halfW, position.y + halfH, this.__renderLayer);
  let lower = new Position(position.x, position.y + halfH, this.__renderLayer);
  let lowerWest = new Position(position.x - halfW, position.y + halfH, this.__renderLayer);
  let west = new Position(position.x - halfW, position.y, this.__renderLayer);

  // Preemptively load the chunks
  gameClient.database.preloadCallback([position, upperWest, upper, upperEast, east, lowerEast, lower, lowerWest, west], this.chunkUpdate.bind(this));

}

Minimap.prototype.chunkUpdate = function (chunks) {

  /*
   * Function Minimap.chunkUpdate
   * Callback fired when a chunk needs to be updated
   */

  this.update(chunks);
  this.render(chunks);

}

Minimap.prototype.addEventListeners = function () {

  /*
   * Function Minimap.addEventListeners
   * Adds event listeners to the minimap
   */

  // Buttons to change the minimap zoom level state
  document.getElementById("minimap-zoom-up").addEventListener("click", this.changeZoomLevel.bind(this, 1));
  document.getElementById("minimap-zoom-down").addEventListener("click", this.changeZoomLevel.bind(this, -1));
  document.getElementById("minimap-zoom-el").addEventListener("click", this.changeLevel.bind(this, 1));
  document.getElementById("minimap-zoom-dl").addEventListener("click", this.changeLevel.bind(this, -1));

  // Listeners to the full canvas
  this.minimap.canvas.addEventListener("wheel", this.scroll.bind(this));

  // Left-click drag to pan the minimap
  this.minimap.canvas.addEventListener("mousedown", this.__handleMouseDown.bind(this));
  document.addEventListener("mousemove", this.__handleMouseMove.bind(this));
  document.addEventListener("mouseup", this.__handleMouseUp.bind(this));

  // Right-click shows context menu (Add Mark / Walk To)
  this.minimap.canvas.addEventListener("contextmenu", this.__handleContextMenu.bind(this));

  // Big minimap overlay events
  if (this.__bigCanvas) {
    this.__bigCanvas.addEventListener("mousedown", this.__handleBigMouseDown.bind(this));
    this.__bigCanvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }

  // Big minimap zoom and floor controls
  document.getElementById("big-minimap-zoom-up").addEventListener("click", this.changeZoomLevel.bind(this, 1));
  document.getElementById("big-minimap-zoom-down").addEventListener("click", this.changeZoomLevel.bind(this, -1));
  document.getElementById("big-minimap-zoom-el").addEventListener("click", this.changeLevel.bind(this, 1));
  document.getElementById("big-minimap-zoom-dl").addEventListener("click", this.changeLevel.bind(this, -1));
  document.getElementById("big-minimap-close").addEventListener("click", this.closeBigView.bind(this));

}

Minimap.prototype.setCenter = function () {

  /*
   * Function Minimap.setCenter
   * Resets the center of the minimap
   */

  this.center = new Position(0, 0, 0);

  this.setRenderLayer(gameClient.player.getPosition().z);

}

Minimap.prototype.openBigView = function () {

  /*
   * Function Minimap.openBigView
   * Opens the big minimap overlay centered on the screen
   */

  if (!this.__bigOverlay || !this.__bigCanvas) return;
  this.__bigOverlay.style.display = "flex";
  this.__bigIsOpen = true;
  this.__renderBigView();

}

Minimap.prototype.closeBigView = function () {

  /*
   * Function Minimap.closeBigView
   * Closes the big minimap overlay
   */

  if (!this.__bigOverlay) return;
  this.__bigOverlay.style.display = "none";
  this.__bigIsOpen = false;
  this.__bigIsDragging = false;

}

Minimap.prototype.__renderBigView = function () {

  /*
   * Function Minimap.__renderBigView
   * Renders the minimap content to the big canvas
   */

  if (!this.__bigIsOpen || !this.__bigCanvas) return;
  let ctx = this.__bigCanvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, this.__bigCanvas.width, this.__bigCanvas.height);
  ctx.drawImage(this.minimap.canvas, 0, 0, this.__bigCanvas.width, this.__bigCanvas.height);

}

Minimap.prototype.__handleBigMouseDown = function (event) {

  /*
   * Function Minimap.__handleBigMouseDown
   * Starts a drag on the big minimap
   */

  if (event.button !== 0) return;
  event.preventDefault();

  let rect = this.__bigCanvas.getBoundingClientRect();
  this.__bigIsDragging = true;
  this.__bigLastMouseX = event.clientX - rect.left;
  this.__bigLastMouseY = event.clientY - rect.top;

}

Minimap.prototype.scroll = function (event) {

  /*
   * Function Minimap.scroll
   * Scrolls the minimap with the scroll wheel
   */

  // Check the direction of the scrollwheel
  if (event.deltaY < 0) {
    this.changeZoomLevel(1);
  } else {
    this.changeZoomLevel(-1);
  }

}

Minimap.prototype.__handleMouseDown = function (event) {

  if (event.button !== 0) {
    return;
  }

  // Double-click detection: two clicks within 300ms opens big view
  let now = Date.now();
  if (now - this.__lastClickTime < 300) {
    this.__lastClickTime = 0;
    event.preventDefault();
    this.openBigView();
    return;
  }
  this.__lastClickTime = now;

  let can = this.minimap.canvas;
  let rect = can.getBoundingClientRect();
  let mouseX = event.clientX - rect.left;
  let mouseY = event.clientY - rect.top;

  this.__isDragging = false;
  this.__dragStartX = mouseX;
  this.__dragStartY = mouseY;
  this.__lastMouseX = mouseX;
  this.__lastMouseY = mouseY;

}

Minimap.prototype.__handleMouseMove = function (event) {

  if (event.buttons !== 1) {
    return;
  }

  // Handle big minimap drag separately
  if (this.__bigIsDragging) {
    let rect = this.__bigCanvas.getBoundingClientRect();
    let mouseX = event.clientX - rect.left;
    let mouseY = event.clientY - rect.top;
    let zoomFactor = Math.pow(2, this.__zoomLevel);
    this.center.x -= (mouseX - this.__bigLastMouseX) / zoomFactor;
    this.center.y -= (mouseY - this.__bigLastMouseY) / zoomFactor;
    this.__bigLastMouseX = mouseX;
    this.__bigLastMouseY = mouseY;
    this.cache();
    return;
  }

  let can = this.minimap.canvas;
  let rect = can.getBoundingClientRect();
  let mouseX = event.clientX - rect.left;
  let mouseY = event.clientY - rect.top;

  if (!this.__isDragging && (mouseX < 0 || mouseX > rect.width || mouseY < 0 || mouseY > rect.height)) {
    return;
  }

  if (!this.__isDragging) {
    let dx = mouseX - this.__dragStartX;
    let dy = mouseY - this.__dragStartY;
    if (Math.sqrt(dx * dx + dy * dy) > this.__dragThreshold) {
      this.__isDragging = true;
      this.__lastMouseX = mouseX;
      this.__lastMouseY = mouseY;
    }
    return;
  }

  let zoomFactor = Math.pow(2, this.__zoomLevel);
  let deltaX = (mouseX - this.__lastMouseX) / zoomFactor;
  let deltaY = (mouseY - this.__lastMouseY) / zoomFactor;

  this.center.x -= deltaX;
  this.center.y -= deltaY;

  this.__lastMouseX = mouseX;
  this.__lastMouseY = mouseY;

  this.cache();

}

Minimap.prototype.__handleMouseUp = function (event) {

  if (event.button !== 0) {
    return;
  }

  this.__isDragging = false;
  this.__bigIsDragging = false;

}

Minimap.prototype.__handleContextMenu = function (event) {

  event.preventDefault();
  event.stopPropagation();

  gameClient.interface.menuManager.close();

  this.__contextMenuEvent = event;

  // Check if clicking on an existing mark
  let mark = this.__getMarkAtEvent(event);
  if (mark !== null) {
    this.__selectedMarkId = mark.id;
    gameClient.interface.menuManager.open("minimap-pin-menu", event);
    return;
  }

  // Show the minimap context menu
  gameClient.interface.menuManager.open("minimap-menu", event);

}

Minimap.prototype.__getWorldPositionFromEvent = function (event) {

  let can = this.minimap.canvas;

  let rect = can.getBoundingClientRect();
  let mouseX = (event.clientX - rect.left) * (can.width / rect.width);
  let mouseY = (event.clientY - rect.top) * (can.height / rect.height);

  let zoomFactor = Math.pow(2, this.__zoomLevel);
  let clickOffsetX = (mouseX - can.width / 2) / zoomFactor;
  let clickOffsetY = (mouseY - can.height / 2) / zoomFactor;

  return {
    x: Math.floor(gameClient.player.getPosition().x + this.center.x + clickOffsetX),
    y: Math.floor(gameClient.player.getPosition().y + this.center.y + clickOffsetY),
    z: this.__renderLayer
  };

}

Minimap.prototype.__getMarkCanvasPosition = function (mark) {

  let playerPos = gameClient.player;
  if (playerPos === null) {
    return null;
  }

  playerPos = playerPos.getPosition();

  if (mark.worldZ !== this.__renderLayer) {
    return null;
  }

  let can = this.minimap.canvas;

  let canvasX = can.width / 2 + (mark.worldX - playerPos.x - this.center.x);
  let canvasY = can.height / 2 + (mark.worldY - playerPos.y - this.center.y);

  return { x: canvasX, y: canvasY };

}

Minimap.prototype.__getMarkAtEvent = function (event) {

  let can = this.minimap.canvas;
  let rect = can.getBoundingClientRect();
  let mouseX = (event.clientX - rect.left) * (can.width / rect.width);
  let mouseY = (event.clientY - rect.top) * (can.height / rect.height);

  // Convert from post-zoom to pre-zoom canvas coordinates
  let zoomFactor = Math.pow(2, this.__zoomLevel);
  let preZoomX = (mouseX - can.width / 2) / zoomFactor + can.width / 2;
  let preZoomY = (mouseY - can.height / 2) / zoomFactor + can.height / 2;

  for (let i = this.__marks.length - 1; i >= 0; i--) {
    let mark = this.__marks[i];
    let pos = this.__getMarkCanvasPosition(mark);
    if (pos !== null) {
      let dx = preZoomX - pos.x;
      let dy = preZoomY - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < 12) {
        return mark;
      }
    }
  }

  return null;

}

Minimap.prototype.__preloadFlags = function () {

  for (let i = 1; i <= 19; i++) {
    let img = new Image();
    img.src = "/images/game/minimap/flag" + i + ".png";
    this.__flagImages.push(img);
  }

}

Minimap.prototype.__saveMarks = function () {

  try {
    localStorage.setItem("minimap-marks", JSON.stringify(this.__marks));
  } catch (e) {}

}

Minimap.prototype.__loadMarks = function () {

  try {
    let data = localStorage.getItem("minimap-marks");
    if (data !== null) {
      this.__marks = JSON.parse(data);
    }
  } catch (e) {
    this.__marks = [];
  }

}

Minimap.prototype.__addMark = function (worldX, worldY, worldZ, flagIndex, description) {

  let mark = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    flagIndex: flagIndex,
    description: description,
    worldX: worldX,
    worldY: worldY,
    worldZ: worldZ
  };

  this.__marks.push(mark);
  this.__saveMarks();
  this.cache();

}

Minimap.prototype.__updateMark = function (markId, flagIndex, description) {

  let mark = this.__marks.find(function (m) { return m.id === markId; });
  if (mark === undefined) {
    return;
  }

  mark.flagIndex = flagIndex;
  mark.description = description;

  this.__saveMarks();
  this.cache();

}

Minimap.prototype.__removeMark = function (markId) {

  this.__marks = this.__marks.filter(function (m) { return m.id !== markId; });
  this.__saveMarks();
  this.cache();

}

Minimap.prototype.__populateFlagGrid = function (selectedIndex) {

  let grid = document.getElementById("flag-selector-grid");
  if (grid === null) {
    return;
  }

  grid.innerHTML = "";

  for (let i = 1; i <= 19; i++) {
    let item = document.createElement("div");
    item.className = "flag-selector-item";
    if (i === selectedIndex) {
      item.className += " selected";
    }

    let img = document.createElement("img");
    img.src = "/images/game/minimap/flag" + i + ".png";
    img.alt = "Flag " + i;
    img.width = 32;
    img.height = 32;

    let label = document.createElement("span");
    label.className = "flag-label";
    label.textContent = i;

    item.appendChild(img);
    item.appendChild(label);

    item.addEventListener("click", function () {
      grid.querySelectorAll(".flag-selector-item").forEach(function (el) {
        el.classList.remove("selected");
      });
      item.classList.add("selected");
    });

    grid.appendChild(item);
  }

}

Minimap.prototype.__getSelectedFlagFromGrid = function () {

  let grid = document.getElementById("flag-selector-grid");
  if (grid === null) {
    return 1;
  }

  let selected = grid.querySelector(".flag-selector-item.selected");
  if (selected === null) {
    return 1;
  }

  let img = selected.querySelector("img");
  if (img === null) {
    return 1;
  }

  let src = img.getAttribute("src");
  let match = src.match(/flag(\d+)\.png/);
  if (match === null) {
    return 1;
  }

  return parseInt(match[1], 10);

}

Minimap.prototype.openAddMarkModal = function (event) {

  this.__pendingMarkEvent = event;
  this.__editingMarkId = null;

  this.__populateFlagGrid(1);
  document.getElementById("mark-description").value = "";

  document.getElementById("confirm-mark-btn").onclick = function () {

    let flagIndex = this.__getSelectedFlagFromGrid();
    let description = document.getElementById("mark-description").value.trim();

    if (this.__pendingMarkEvent !== null) {
      let pos = this.__getWorldPositionFromEvent(this.__pendingMarkEvent);
      this.__addMark(pos.x, pos.y, pos.z, flagIndex, description);
      this.__pendingMarkEvent = null;
    }

    gameClient.interface.modalManager.close();

  }.bind(this);

  gameClient.interface.modalManager.open("minimap-mark-modal");

}

Minimap.prototype.openEditMarkModal = function () {

  let mark = this.__marks.find(function (m) { return m.id === this.__selectedMarkId; }.bind(this));
  if (mark === undefined) {
    return;
  }

  this.__pendingMarkEvent = null;
  this.__editingMarkId = mark.id;

  this.__populateFlagGrid(mark.flagIndex);
  document.getElementById("mark-description").value = mark.description;

  document.getElementById("confirm-mark-btn").onclick = function () {

    let flagIndex = this.__getSelectedFlagFromGrid();
    let description = document.getElementById("mark-description").value.trim();

    if (this.__editingMarkId !== null) {
      this.__updateMark(this.__editingMarkId, flagIndex, description);
      this.__editingMarkId = null;
    }

    gameClient.interface.modalManager.close();

  }.bind(this);

  gameClient.interface.modalManager.open("minimap-mark-modal");

}

Minimap.prototype.removeSelectedMark = function () {

  if (this.__selectedMarkId !== null) {
    this.__removeMark(this.__selectedMarkId);
    this.__selectedMarkId = null;
  }

}

Minimap.prototype.__renderMarks = function () {

  let playerPos = gameClient.player;
  if (playerPos === null) {
    return;
  }

  playerPos = playerPos.getPosition();
  let ctx = this.minimap.context;
  let zoomFactor = Math.pow(2, this.__zoomLevel);

  ctx.save();

  ctx.globalCompositeOperation = "source-over";

  for (let i = 0; i < this.__marks.length; i++) {
    let mark = this.__marks[i];

    if (mark.worldZ !== this.__renderLayer) {
      continue;
    }

    let pos = this.__getMarkCanvasPosition(mark);
    if (pos === null) {
      continue;
    }

    // Apply zoom to mark position but keep flag size constant
    let zx = this.__width / 2 + (pos.x - this.__width / 2) * zoomFactor;
    let zy = this.__height / 2 + (pos.y - this.__height / 2) * zoomFactor;

    let flagImg = this.__flagImages[mark.flagIndex - 1];
    if (flagImg !== undefined) {
      let flagSize = 16;
      ctx.drawImage(flagImg, Math.round(zx - flagSize / 2), Math.round(zy - flagSize), flagSize, flagSize);
    }

    if (mark.description.length > 0) {
      let text = mark.description;
      if (text.length > 12) {
        text = text.slice(0, 12) + "..";
      }

      ctx.font = "16px monospace";
      ctx.textBaseline = "top";
      let textWidth = ctx.measureText(text).width;
      let textX = zx + 10;
      let textY = zy - 10;
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(textX - 1, textY - 1, textWidth + 2, 18);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, textX, textY);
    }
  }

  ctx.restore();

}

Minimap.prototype.setRenderLayer = function (layer) {

  /*
   * Function Renderer.setRenderLayer
   * Sets the render layer
   */

  // Clamp the layer
  this.__renderLayer = Math.min(Math.max(0, layer), this.nLayers - 1);

  // Save chunks on the old layer before switching
  if (gameClient.player) {
    gameClient.database.sweepUnusedChunks(gameClient.player.getPosition());
  }

  this.cache();

}

Minimap.prototype.changeLevel = function (level) {

  /*
   * Function Renderer.changeLevel
   * Changes the level
   */

  this.__renderLayer += level;
  this.setRenderLayer(this.__renderLayer);

}

Minimap.prototype.getMinimapBuffer = function (position) {

  return gameClient.database.getChunk(gameClient.database.getChunkIdentifier(position));

}


Minimap.prototype.update = function (chunks) {

  /*
   * Function Renderer.updateMinimap
   * Updates the minimap canvas
   */


  // Get the image data from the minimap buffer
  gameClient.world.chunks.forEach(function (chunk) {

    // Get the currently occupied layer
    let tiles = chunk.getFloorTiles(gameClient.player.getPosition().z);

    tiles.forEach(function (tile) {

      // Missing tile
      if (tile === null) {
        return;
      }

      // Cannot be viewed
      if (!gameClient.player.canSee(tile)) {
        return;
      }

      let color = this.__getTileColor(tile);

      if (color === null) {
        return;
      }

      // Calculate the buffer & index
      let buffer = chunks[gameClient.database.getChunkIdentifier(tile.getPosition())];
      if (!buffer) return;
      let index = (tile.getPosition().x % 128) + ((tile.getPosition().y % 128) * 128);

      buffer.view[index] = this.colors[color];

    }, this);

  }, this);

}

Minimap.prototype.__getTileColor = function (tile) {

  /*
   * Function Minimap.__getTileColor
   * Returns the minimap color of a particular tile
   */

  // Perhaps check items
  let itemColors = tile.items.map(item => item.getMinimapColor()).filter(x => x !== null);

  // Return the color of the last item
  if (itemColors.length > 0) {
    return itemColors.last();
  }

  // Color of the tile then
  return tile.getMinimapColor();

}

Minimap.prototype.changeZoomLevel = function (value) {

  /*
   * Function Minimap.changeZoomLevel
   * Changes the state of the zoom level (clamped between 0 & 4) and renders the minimap
   */

  this.__zoomLevel += value;
  this.__zoomLevel = Math.min(Math.max(0, this.__zoomLevel), 4);

  this.cache();

}

Minimap.prototype.save = function () {

  gameClient.database.saveChunks();

}

Minimap.prototype.render = function (chunks) {

  /*
   * Function GameClient.renderMinimap
   * Renders the minimap to the screen
   */

  this.minimap.context.imageSmoothingEnabled = false;
  this.minimap.clear();

  // Go the active minimap chunks
  Object.keys(chunks).forEach(function (id) {

    let chunk = chunks[id];

    if (chunk === null) {
      return;
    }

    let [x, y, z] = id.split(".").map(Number);

    if (z !== this.__renderLayer) {
      return;
    }

    // And paste it at the right position on the minimap canvas
    this.minimap.context.putImageData(chunk.imageData, x * 128 - gameClient.player.getPosition().x - this.center.x + this.__width / 2, y * 128 - gameClient.player.getPosition().y - this.center.y + this.__height / 2);

  }, this);

  // Only save the new shape
  this.minimap.context.globalCompositeOperation = "copy";

  // Recursively scale the canvas to the appropriate zoom level
  for (let i = 0; i < this.__zoomLevel; i++) {
    let w = this.__width;
    let h = this.__height;
    this.minimap.context.drawImage(this.minimap.canvas, 0, 0, w, h, -w/2, -h/2, w*2, h*2);
  }

  // Draw marks after zoom so they stay at fixed size
  this.minimap.context.globalCompositeOperation = "source-over";
  this.__renderMarks();

  // Update big minimap overlay if open
  if (this.__bigIsOpen) {
    this.__renderBigView();
  }

}



Minimap.prototype.__applyCanvasSize = function (newWidth, newHeight) {

  let can = this.minimap.canvas;
  can.width = newWidth;
  can.height = newHeight;
  this.minimap.context.imageSmoothingEnabled = false;
  let cssW = Math.round(newWidth * 106 / 160);
  let cssH = Math.round(newHeight * 106 / 160);
  can.style.width = cssW + "px";
  can.style.height = cssH + "px";
  can.style.imageRendering = "pixelated";

}

Minimap.prototype.colors = new Array(
  "0xFF000000", "0xFF330000", "0xFF660000", "0xFF990000",
  "0xFFCC0000", "0xFFFF0000", "0xFF003300", "0xFF333300",
  "0xFF663300", "0xFF993300", "0xFFCC3300", "0xFFFF3300",
  "0xFF006600", "0xFF336600", "0xFF666600", "0xFF996600",
  "0xFFCC6600", "0xFFFF6600", "0xFF009900", "0xFF339900",
  "0xFF669900", "0xFF999900", "0xFFCC9900", "0xFFFF9900",
  "0xFF00CC00", "0xFF33CC00", "0xFF66CC00", "0xFF99CC00",
  "0xFFCCCC00", "0xFFFFCC00", "0xFF00FF00", "0xFF33FF00",
  "0xFF66FF00", "0xFF99FF00", "0xFFCCFF00", "0xFFFFFF00",
  "0xFF000033", "0xFF330033", "0xFF660033", "0xFF990033",
  "0xFFCC0033", "0xFFFF0033", "0xFF003333", "0xFF333333",
  "0xFF663333", "0xFF993333", "0xFFCC3333", "0xFFFF3333",
  "0xFF006633", "0xFF336633", "0xFF666633", "0xFF996633",
  "0xFFCC6633", "0xFFFF6633", "0xFF009933", "0xFF339933",
  "0xFF669933", "0xFF999933", "0xFFCC9933", "0xFFFF9933",
  "0xFF00CC33", "0xFF33CC33", "0xFF66CC33", "0xFF99CC33",
  "0xFFCCCC33", "0xFFFFCC33", "0xFF00FF33", "0xFF33FF33",
  "0xFF66FF33", "0xFF99FF33", "0xFFCCFF33", "0xFFFFFF33",
  "0xFF000066", "0xFF330066", "0xFF660066", "0xFF990066",
  "0xFFCC0066", "0xFFFF0066", "0xFF003366", "0xFF333366",
  "0xFF663366", "0xFF993366", "0xFFCC3366", "0xFFFF3366",
  "0xFF006666", "0xFF336666", "0xFF666666", "0xFF996666",
  "0xFFCC6666", "0xFFFF6666", "0xFF009966", "0xFF339966",
  "0xFF669966", "0xFF999966", "0xFFCC9966", "0xFFFF9966",
  "0xFF00CC66", "0xFF33CC66", "0xFF66CC66", "0xFF99CC66",
  "0xFFCCCC66", "0xFFFFCC66", "0xFF00FF66", "0xFF33FF66",
  "0xFF66FF66", "0xFF99FF66", "0xFFCCFF66", "0xFFFFFF66",
  "0xFF000099", "0xFF330099", "0xFF660099", "0xFF990099",
  "0xFFCC0099", "0xFFFF0099", "0xFF003399", "0xFF333399",
  "0xFF663399", "0xFF993399", "0xFFCC3399", "0xFFFF3399",
  "0xFF006699", "0xFF336699", "0xFF666699", "0xFF996699",
  "0xFFCC6699", "0xFFFF6699", "0xFF009999", "0xFF339999",
  "0xFF669999", "0xFF999999", "0xFFCC9999", "0xFFFF9999",
  "0xFF00CC99", "0xFF33CC99", "0xFF66CC99", "0xFF99CC99",
  "0xFFCCCC99", "0xFFFFCC99", "0xFF00FF99", "0xFF33FF99",
  "0xFF66FF99", "0xFF99FF99", "0xFFCCFF99", "0xFFFFFF99",
  "0xFF0000CC", "0xFF3300CC", "0xFF6600CC", "0xFF9900CC",
  "0xFFCC00CC", "0xFFFF00CC", "0xFF0033CC", "0xFF3333CC",
  "0xFF6633CC", "0xFF9933CC", "0xFFCC33CC", "0xFFFF33CC",
  "0xFF0066CC", "0xFF3366CC", "0xFF6666CC", "0xFF9966CC",
  "0xFFCC66CC", "0xFFFF66CC", "0xFF0099CC", "0xFF3399CC",
  "0xFF6699CC", "0xFF9999CC", "0xFFCC99CC", "0xFFFF99CC",
  "0xFF00CCCC", "0xFF33CCCC", "0xFF66CCCC", "0xFF99CCCC",
  "0xFFCCCCCC", "0xFFFFCCCC", "0xFF00FFCC", "0xFF33FFCC",
  "0xFF66FFCC", "0xFF99FFCC", "0xFFCCFFCC", "0xFFFFFFCC",
  "0xFF0000FF", "0xFF3300FF", "0xFF6600FF", "0xFF9900FF",
  "0xFFCC00FF", "0xFFFF00FF", "0xFF0033FF", "0xFF3333FF",
  "0xFF6633FF", "0xFF9933FF", "0xFFCC33FF", "0xFFFF33FF",
  "0xFF0066FF", "0xFF3366FF", "0xFF6666FF", "0xFF9966FF",
  "0xFFCC66FF", "0xFFFF66FF", "0xFF0099FF", "0xFF3399FF",
  "0xFF6699FF", "0xFF9999FF", "0xFFCC99FF", "0xFFFF99FF",
  "0xFF00CCFF", "0xFF33CCFF", "0xFF66CCFF", "0xFF99CCFF",
  "0xFFCCCCFF", "0xFFFFCCFF", "0xFF00FFFF", "0xFF33FFFF",
  "0xFF66FFFF", "0xFF99FFFF", "0xFFCCFFFF", "0xFFFFFFFF",
  "0xFF000000", "0xFF000000", "0xFF000000", "0xFF000000",
  "0xFF000000", "0xFF000000", "0xFF000000", "0xFF000000",
  "0xFF000000", "0xFF000000", "0xFF000000", "0xFF000000",
  "0xFF000000", "0xFF000000", "0xFF000000", "0xFF000000",
  "0xFF000000", "0xFF000000", "0xFF000000", "0xFF000000",
  "0xFF000000", "0xFF000000", "0xFF000000", "0xFF000000",
  "0xFF000000", "0xFF000000", "0xFF000000", "0xFF000000",
  "0xFF000000", "0xFF000000", "0xFF000000", "0xFF000000",
  "0xFF000000", "0xFF000000", "0xFF000000", "0xFF000000",
  "0xFF000000", "0xFF000000", "0xFF000000", "0xFF000000"
).map(Number);
