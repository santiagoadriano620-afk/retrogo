const Interface = function () {
  /*
   * Class Interface
   * Wrapper for the entire game interface
   *
   * API:
   *
   * @setCancelMessage(message) - Sets a cancel message on the client that is automatically cleared
   * @getColor(int) - Returns the color that is mapped to a specific identifier
   * @getAccountDetails() - Returns the filled in account details (aCCount number, password)
   * @updateStatusBar() - Call to update the status bar with the available conditions
   *
   */

  // Global Boost state (epoch ms, 0 = inactive)
  this.__globalBoostExp = 0;
  this.__globalBoostLoot = 0;
  this.__globalBoostSkills = 0;
  this.__boostDisplayInterval = null;

  // Interface settings
  this.settings = new Settings();

  // Manager for chat channels
  this.channelManager = new ChannelManager();

  // Manager for fight mode selector (Full Attack, Balanced, Full Defense)
  this.fightModeSelector = new FightModeSelector();

  // Manager for notifications
  this.notificationManager = new NotificationManager();

  // The manager for modals (popup windows in the center of the screen)
  this.modalManager = new ModalManager();

  this.statusBar = new StatusBar();

  // The manager for windows (windows in the sidebars, particularly containers)
  this.windowManager = new WindowManager();

  // Manager for sound
  this.soundManager = new SoundManager(this.settings.isSoundEnabled());

  // Manager for voice chat
  this.voiceManager = new VoiceManager();

  // Manager for popup menus
  this.menuManager = new MenuManager();

  // Manager for the text window
  this.screenElementManager = new ScreenElementManager();

  // Tooltip manager
  this.tooltip = new Tooltip();

  // Enable all the listeners in the DOM
  this.__enableListeners();

  // Recalculate canvas size when entering or leaving fullscreen
  document.addEventListener("fullscreenchange", this.__handleResizeWindow.bind(this));
  document.addEventListener("webkitfullscreenchange", this.__handleResizeWindow.bind(this));
  document.addEventListener("mozfullscreenchange", this.__handleResizeWindow.bind(this));
  document.addEventListener("MSFullscreenChange", this.__handleResizeWindow.bind(this));

  // Quest Tracker Window (reference via WindowManager, set after construction)
  this.questTracker = this.windowManager.getWindow("quest-tracker-window");

  // Create the state variable for the interface and callbacks when the properties are changed
  this.state = new State();
  this.state.add("spritesLoaded", this.enableEnterGame.bind(this));
  this.state.add("dataLoaded", this.enableEnterGame.bind(this));

  document.getElementById("chat-input").disabled = true;

  // Zoom factor (1 = normal, >1 = zoom in, <1 = zoom out)
  this.zoomFactor = 1.2;

  // Camera zoom multiplier for gameplay (independent of UI zoom)
  this.cameraZoom = 1.35;
};
  Interface.prototype.SCREEN_WIDTH_MIN = 1080;

  Interface.prototype.SCREEN_HEIGHT_MIN = 482;

// These are the available indices of web colors by name (see below)
Interface.prototype.COLORS = new Object({
  BLACK: 0,
  BLUE: 5,
  LIGHTGREEN: 30,
  LIGHTBLUE: 35,
  MAYABLUE: 95,
  DARKRED: 108,
  LIGHTGREY: 129,
  SKYBLUE: 143,
  PURPLE: 155,
  RED: 180,
  ORANGE: 198,
  YELLOW: 210,
  WHITE: 215,
});

// Definitions of web safe colors used for text
Interface.prototype.WEBCOLORS = new Array(
  "#000000",
  "#000033",
  "#000066",
  "#000099",
  "#0000CC",
  "#0000FF",
  "#003300",
  "#003333",
  "#003366",
  "#003399",
  "#0033CC",
  "#0033FF",
  "#006600",
  "#006633",
  "#006666",
  "#006699",
  "#0066CC",
  "#0066FF",
  "#009900",
  "#009933",
  "#009966",
  "#009999",
  "#0099CC",
  "#0099FF",
  "#00CC00",
  "#00CC33",
  "#00CC66",
  "#00CC99",
  "#00CCCC",
  "#00CCFF",
  "#00FF00",
  "#00FF33",
  "#00FF66",
  "#00FF99",
  "#00FFCC",
  "#00FFFF",
  "#330000",
  "#330033",
  "#330066",
  "#330099",
  "#3300CC",
  "#3300FF",
  "#333300",
  "#333333",
  "#333366",
  "#333399",
  "#3333CC",
  "#3333FF",
  "#336600",
  "#336633",
  "#336666",
  "#336699",
  "#3366CC",
  "#3366FF",
  "#339900",
  "#339933",
  "#339966",
  "#339999",
  "#3399CC",
  "#3399FF",
  "#33CC00",
  "#33CC33",
  "#33CC66",
  "#33CC99",
  "#33CCCC",
  "#33CCFF",
  "#33FF00",
  "#33FF33",
  "#33FF66",
  "#33FF99",
  "#33FFCC",
  "#33FFFF",
  "#660000",
  "#660033",
  "#660066",
  "#660099",
  "#6600CC",
  "#6600FF",
  "#663300",
  "#663333",
  "#663366",
  "#663399",
  "#6633CC",
  "#6633FF",
  "#666600",
  "#666633",
  "#666666",
  "#666699",
  "#6666CC",
  "#6666FF",
  "#669900",
  "#669933",
  "#669966",
  "#669999",
  "#6699CC",
  "#6699FF",
  "#66CC00",
  "#66CC33",
  "#66CC66",
  "#66CC99",
  "#66CCCC",
  "#66CCFF",
  "#66FF00",
  "#66FF33",
  "#66FF66",
  "#66FF99",
  "#66FFCC",
  "#66FFFF",
  "#990000",
  "#990033",
  "#990066",
  "#990099",
  "#9900CC",
  "#9900FF",
  "#993300",
  "#993333",
  "#993366",
  "#993399",
  "#9933CC",
  "#9933FF",
  "#996600",
  "#996633",
  "#996666",
  "#996699",
  "#9966CC",
  "#9966FF",
  "#999900",
  "#999933",
  "#999966",
  "#999999",
  "#9999CC",
  "#9999FF",
  "#99CC00",
  "#99CC33",
  "#99CC66",
  "#99CC99",
  "#99CCCC",
  "#99CCFF",
  "#99FF00",
  "#99FF33",
  "#99FF66",
  "#99FF99",
  "#99FFCC",
  "#99FFFF",
  "#CC0000",
  "#CC0033",
  "#CC0066",
  "#CC0099",
  "#CC00CC",
  "#CC00FF",
  "#CC3300",
  "#CC3333",
  "#CC3366",
  "#CC3399",
  "#CC33CC",
  "#CC33FF",
  "#CC6600",
  "#CC6633",
  "#CC6666",
  "#CC6699",
  "#CC66CC",
  "#CC66FF",
  "#CC9900",
  "#CC9933",
  "#CC9966",
  "#CC9999",
  "#CC99CC",
  "#CC99FF",
  "#CCCC00",
  "#CCCC33",
  "#CCCC66",
  "#CCCC99",
  "#CCCCCC",
  "#CCCCFF",
  "#CCFF00",
  "#CCFF33",
  "#CCFF66",
  "#CCFF99",
  "#CCFFCC",
  "#CCFFFF",
  "#FF0000",
  "#FF0033",
  "#FF0066",
  "#FF0099",
  "#FF00CC",
  "#FF00FF",
  "#FF3300",
  "#FF3333",
  "#FF3366",
  "#FF3399",
  "#FF33CC",
  "#FF33FF",
  "#FF6600",
  "#FF6633",
  "#FF6666",
  "#FF6699",
  "#FF66CC",
  "#FF66FF",
  "#FF9900",
  "#FF9933",
  "#FF9966",
  "#FF9999",
  "#FF99CC",
  "#FF99FF",
  "#FFCC00",
  "#FFCC33",
  "#FFCC66",
  "#FFCC99",
  "#FFCCCC",
  "#FFCCFF",
  "#FFFF00",
  "#FFFF33",
  "#FFFF66",
  "#FFFF99",
  "#FFFFCC",
  "#FFFFFF"
);

// Map to look up spells
Interface.prototype.SPELLS = new Map();
Interface.prototype.SPELLS.set(0, {
  name: "Cure Burning",
  description: "Cures Burning Condition",
  icon: { x: 0, y: 0 },
  words: "exana flam",
  vocations: ["sorcerer", "druid", "paladin", "knight"],
});
Interface.prototype.SPELLS.set(1, {
  name: "Explosion",
  description: "Causes an Explosion",
  icon: { x: 0, y: 4 },
  words: "exevo mas flam",
  vocations: ["sorcerer"],
});
Interface.prototype.SPELLS.set(2, {
  name: "Healing",
  description: "Heal Damage",
  icon: { x: 2, y: 0 },
  words: "exura",
  vocations: ["sorcerer", "druid", "paladin", "knight"],
});
Interface.prototype.SPELLS.set(3, {
  name: "Invisibilis",
  description: "Turn Invisible for 60s.",
  icon: { x: 10, y: 7 },
  words: "utana vid",
  vocations: ["sorcerer", "druid"],
});
Interface.prototype.SPELLS.set(4, {
  name: "Morph",
  description: "Morphs into a Creature",
  icon: { x: 9, y: 9 },
  words: "utevo res ina",
  vocations: ["sorcerer", "druid"],
});
Interface.prototype.SPELLS.set(5, {
  name: "Parva Lux",
  description: "Surround yourself by light",
  icon: { x: 8, y: 9 },
  words: "utevo lux",
  vocations: ["sorcerer", "druid", "paladin", "knight"],
});
Interface.prototype.SPELLS.set(6, {
  name: "Death Strike",
  description: "Strike with death",
  icon: { x: 1, y: 3 },
  words: "exori mort",
  vocations: ["sorcerer", "druid"],
});
Interface.prototype.SPELLS.set(7, {
  name: "Hearthstone",
  description: "Teleport yourself to the temple.",
  icon: { x: 3, y: 3 },
  words: "exani tera",
  vocations: ["sorcerer", "druid", "paladin", "knight"],
});
Interface.prototype.SPELLS.set(8, {
  name: "Velocitas",
  description: "Increases your movement speed",
  icon: { x: 4, y: 8 },
  words: "utani hur",
  vocations: ["sorcerer", "druid", "paladin", "knight"],
});
Interface.prototype.SPELLS.set(9, {
  name: "Levitate",
  description: "Move up or down a mountain",
  icon: { x: 4, y: 10 },
  words: "exani hur",
  vocations: ["sorcerer", "druid", "paladin", "knight"],
});
Interface.prototype.SPELLS.set(10, {
  name: "Intense Healing",
  description: "Heals more damage",
  icon: { x: 2, y: 1 },
  words: "exura gran",
  vocations: ["sorcerer", "druid", "paladin", "knight"],
});
Interface.prototype.SPELLS.set(11, {
  name: "Ultimate Healing",
  description: "Heals all damage",
  icon: { x: 2, y: 2 },
  words: "exura vita",
  vocations: ["sorcerer", "druid"],
});
Interface.prototype.SPELLS.set(12, {
  name: "Antidote",
  description: "Cures poison",
  icon: { x: 1, y: 0 },
  words: "exana pox",
  vocations: ["sorcerer", "druid", "paladin", "knight"],
});
Interface.prototype.SPELLS.set(13, {
  name: "Energy Strike",
  description: "Strike with energy",
  icon: { x: 5, y: 3 },
  words: "exori vis",
  vocations: ["sorcerer", "druid"],
});
Interface.prototype.SPELLS.set(14, {
  name: "Flame Strike",
  description: "Strike with fire",
  icon: { x: 1, y: 2 },
  words: "exori flam",
  vocations: ["sorcerer", "druid"],
});
Interface.prototype.SPELLS.set(15, {
  name: "Fire Wave",
  description: "Wave of fire",
  icon: { x: 2, y: 2 },
  words: "exevo flam hur",
  vocations: ["sorcerer"],
});
Interface.prototype.SPELLS.set(16, {
  name: "Energy Beam",
  description: "Beam of energy",
  icon: { x: 2, y: 4 },
  words: "exevo vis lux",
  vocations: ["sorcerer"],
});
Interface.prototype.SPELLS.set(17, {
  name: "Strong Haste",
  description: "Run even faster",
  icon: { x: 5, y: 8 },
  words: "utani gran hur",
  vocations: ["sorcerer", "druid"],
});
Interface.prototype.SPELLS.set(18, {
  name: "Magic Shield",
  description: "Protect yourself with mana",
  icon: { x: 3, y: 10 },
  words: "utamo vita",
  vocations: ["sorcerer", "druid"],
});
Interface.prototype.SPELLS.set(19, {
  name: "Great Light",
  description: "Greatly illuminates the area",
  icon: { x: 7, y: 9 },
  words: "utevo gran lux",
  vocations: ["sorcerer", "druid", "paladin", "knight"],
});
Interface.prototype.SPELLS.set(70, {
  name: "Aleta Sio",
  description: "Opens the house management panel.",
  icon: { x: 8, y: 10 },
  words: "aleta sio",
  vocations: ["sorcerer", "druid", "paladin", "knight"],
});

Interface.prototype.getSpell = function (id) {
  /*
   * Interface.getSpell
   * Returns client-side spell definitions for a spell with identifier id
   */

  if (!this.SPELLS.has(id)) {
    return new Object({
      name: "Unknown",
      description: "Unknown",
      icon: { x: 6, y: 10 },
    });
  }

  return this.SPELLS.get(id);
};

Interface.prototype.updateSpells = function (sid) {
  /*
   * Interface.updateSpells
   * Updates information on spells that was returned from server
   */

  gameClient.player.spellbook.addSpell(sid);
};

Interface.prototype.enableVersionFeatures = function (version) {
  /*
   * Interface.enableVersionFeatures
   * Enables or disables version-specific features
   */

};

Interface.prototype.getHexColor = function (index) {
  /*
   * Function Interface.getHexColor
   * Returns the color from an identifier
   */

  // If invalid return white
  if (index < 0 || index >= this.WEBCOLORS.length) {
    return "#FFFFFF";
  }

  // Otherwise return the index
  return this.WEBCOLORS[index];
};

Interface.prototype.getAccountDetails = function () {
  /*
   * Function Interface.getACCountDetails
   * Returns the aCCount details from the DOM
   */

  return new Object({
    account: document.getElementById("user-username").value.trim(),
    password: document.getElementById("user-password").value.trim(),
  });
};

Interface.prototype.enterGame = function () {
  /*
   * Function Interface.enterGame
   * Callback fired when the enter game button is clicked
   */

  // Block if the assets are not yet loaded
  if (!this.areAssetsLoaded()) {
    return alert("The Tibia.spr and Tibia.dat must be loaded first.");
  }

  // Save or clear credentials based on checkbox
  let saveCheck = document.getElementById("save-password");
  if (saveCheck && saveCheck.checked) {
    let user = document.getElementById("user-username");
    let pwd = document.getElementById("user-password");
    if (user) localStorage.setItem("__savedUsername", user.value);
    if (pwd) localStorage.setItem("__savedPassword", pwd.value);
  } else {
    localStorage.removeItem("__savedUsername");
    localStorage.removeItem("__savedPassword");
  }

  // Fetch credentials and get character list
  let { account, password } = this.getAccountDetails();

  fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account: account, password: password })
  }).then(function (response) {

    switch (response.status) {
      case 200: return response.json();
      case 401: throw new Error("The account number or password is incorrect.");
      case 500: throw new Error("The server experienced an internal error.");
      case 503: throw new Error("Login server unavailable.");
      default: throw new Error("Login failed (HTTP " + response.status + ")");
    }

  }).then(function (data) {

    // Show character selection modal
    this.modalManager.open("floater-characters", {
      characters: data.characters,
      token: data.token,
      host: data.host,
      xorKey: data.xorKey,
      account: account,
      password: password,
      premiumExpiry: data.premiumExpiry || 0,
      refCode: data.refCode,
      refStats: data.refStats,
      refLevelRequired: data.refLevelRequired,
      refRewardPoints: data.refRewardPoints
    });

  }.bind(this)).catch(function (error) {
    this.modalManager.open("floater-connecting", error.message || String(error));
  }.bind(this));

};

Interface.prototype.reset = function () {
  /*
   * Function Interface.reset
   * Resets the entire game interface to a clean state
   */

  // Clean up the interface
  this.screenElementManager.clear();

  this.windowManager.closeAll();

  // Show the game interface instead of the login box
  this.hideGameInterface();
};

Interface.prototype.enableEnterGame = function () {
  /*
   * Function Interface.enableEnterGame
   * Enables the enter game button if the sprites and data files are loaded
   */

  // Both are loaded: allow the character to enter the game
  if (this.areAssetsLoaded()) {
    document.getElementById("enter-game").removeAttribute("disabled");
  }
};

Interface.prototype.areAssetsLoaded = function () {
  /*
   * Function Interface.areAssetsLoaded
   * Returns true if both the assets (sprites & objects) are loaded
   */

  return this.state.spritesLoaded && this.state.dataLoaded;
};

Interface.prototype.showModal = function (id) {
  /*
   * Function Interface.showModal
   * Delegates call to the modal manager to show a modal window with a particular identifier
   */

  this.modalManager.open(id);
};

Interface.prototype.toggleWindow = function (which) {
  /*
   * Function InterfaceManager.toggleWindow
   * Opens or closes an interface window
   */

  this.windowManager.getWindow(which).toggle();
};

Interface.prototype.setCancelMessage = function (message) {
  /*
   * Function Interface.setCancelMessage
   * Delegates to the notification manager to set a cancel message
   */

  this.notificationManager.setCancelMessage(message);
};

Interface.prototype.hideGameInterface = function () {
  /*
   * Function Interface.hideGameInterface
   * Hides the game interface and shows the login interface
   */

  // Sets the login screen to hidden and opens the game interface
  document.getElementById("login-wrapper").style.display = "flex";
  document.getElementById("game-wrapper").style.display = "none";

  window.onresize();
};

Interface.prototype.showGameInterface = function () {
  /*
   * Function Interface.showGameInterface
   * Shows the game interface and hides the login interface
   */

  // Sets the login screen to hidden and opens the game interface
  document.getElementById("login-wrapper").style.display = "none";
  document.getElementById("game-wrapper").style.display = "flex";

  window.onresize();
};

Interface.prototype.loadAssetCallback = function (which, filename) {
  /*
   * Function Interface.loadAssetCallback
   * Callback fired when .dat or .spr files are loaded
   */

  if (which === "sprite") {
    this.state.spritesLoaded = true;
    document.getElementById("sprites-loaded").style.color = "green";
    document.getElementById("sprites-loaded").innerHTML =
      filename + " (" + gameClient.spriteBuffer.__version + ")";
  } else if (which === "data") {
    this.state.dataLoaded = true;
    document.getElementById("data-loaded").style.color = "green";
    document.getElementById("data-loaded").innerHTML =
      filename + " (" + gameClient.dataObjects.__version + ")";
  }
};

Interface.prototype.__fullscreenStyleId = "opencode-fs-style";
Interface.prototype.__fullscreenLineId = "opencode-fs-vline";

Interface.prototype.__applyFullscreenStyles = function () {
  let upper = document.querySelector("#game-wrapper .upper");
  if (upper) {
    upper.style.setProperty("background-image", "url('/images/game/ui/background.png')", "important");
    upper.style.setProperty("background-color", "transparent", "important");
    upper.style.setProperty("background-repeat", "repeat", "important");
    upper.style.setProperty("background-position", "0 0", "important");
    upper.style.setProperty("background-size", "auto", "important");
  }
  let cw = document.getElementById("canvas-id");
  if (cw) cw.style.setProperty("overflow", "hidden", "important");
  if (!document.getElementById(this.__fullscreenStyleId)) {
    let s = document.createElement("style");
    s.id = this.__fullscreenStyleId;
    s.textContent =
      "body.opencode-fullscreen .oogwrap {" +
      "  background-image: url('/images/game/ui/background.png') !important;" +
      "  background-color: transparent !important;" +
      "  background-repeat: repeat !important;" +
      "}" +
      "body.opencode-fullscreen .oogwrap::before { display: none !important; }" +
      "body.opencode-fullscreen .oogwrap::after { display: none !important; }" +
      "body.opencode-fullscreen .lower::after { display: none !important; }" +
      "body.opencode-fullscreen #canvas-id {" +
      "  min-width: unset !important;" +
      "  min-height: unset !important;" +
      "}";
    document.head.appendChild(s);
  }
  if (!document.getElementById(this.__fullscreenLineId)) {
    let line = document.createElement("div");
    line.id = this.__fullscreenLineId;
    line.style.cssText =
      "position:fixed;top:0px;bottom:0px;right:166px;width:1px;" +
      "background-image:url('/images/game/ui/vertical_line_bright.png');" +
      "background-repeat:repeat-y;z-index:9999999;pointer-events:none;";
    document.body.appendChild(line);
  }
};

Interface.prototype.__clearFullscreenStyles = function () {
  let upper = document.querySelector("#game-wrapper .upper");
  if (upper) {
    upper.style.removeProperty("background-image");
    upper.style.removeProperty("background-color");
    upper.style.removeProperty("background-repeat");
    upper.style.removeProperty("background-position");
    upper.style.removeProperty("background-size");
  }
  let cw = document.getElementById("canvas-id");
  if (cw) cw.style.removeProperty("overflow");
  let s = document.getElementById(this.__fullscreenStyleId);
  if (s) s.remove();
  let line = document.getElementById(this.__fullscreenLineId);
  if (line) line.remove();
};

Interface.prototype.requestFullScreen = function () {
  let wrapper = document.getElementById("canvas-id");
  let fsElement = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

  if (fsElement) {
    this.__clearFullscreenStyles();
    document.body.classList.remove("opencode-fullscreen");
    if (wrapper && wrapper.__savedTransform !== undefined) {
      wrapper.style.transform = wrapper.__savedTransform;
      wrapper.style.clipPath = wrapper.__savedClipPath;
    }
    let exitMethod = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
    if (exitMethod) exitMethod.call(document);
  } else {
    if (wrapper) {
      let cs = getComputedStyle(wrapper);
      wrapper.__savedTransform = cs.transform;
      wrapper.__savedClipPath = cs.clipPath;
      wrapper.style.transform = "none";
      wrapper.style.clipPath = "none";
    }
    let el = document.body;
    el.classList.add("opencode-fullscreen");
    this.__applyFullscreenStyles();
    let request = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (request) request.call(el);
  }
};





Interface.prototype.isRaining = function () {
  /*
   * Function Interface.isRaining
   * Returns true if the game is raining
   */

  return gameClient.renderer.weatherCanvas.isRaining();
};
Interface.prototype.getSpriteScaling = function () {
  /*
   * Function Canvas.getSpriteScaling
   * Returns the sprite scaling: if the gamewindow is larger than default (480x352)
   * Mobile uses actual displayed canvas size, desktop uses resolution scale
   */

  return 32 * this.getResolutionScale();
};

Interface.prototype.getSpriteScalingVector = function () {
  /*
   * Function Interface.getSpriteScalingVector
   * Returns the sprite scaling in X and Y directions
   * Needed for mobile where the canvas might be stretched non-uniformly
   */

  let scale = 32 * this.getResolutionScale() * this.cameraZoom;
  return { x: scale, y: scale };
};



Interface.prototype.getResolutionScale = function () {
  let vw = window.visualViewport;
  if (this.__isFullscreen()) {
    let scaleX = (vw.width - 400) / this.SCREEN_WIDTH_MIN;
    let scaleY = (vw.height - 100) / this.SCREEN_HEIGHT_MIN;
    return Math.max(1, Math.min(scaleX, scaleY));
  }
  let scaleX = (vw.width - 350) / this.SCREEN_WIDTH_MIN;
  let scaleY = (vw.height - 188) / this.SCREEN_HEIGHT_MIN;
  return Math.max(1, Math.min(scaleX, scaleY));
};

Interface.prototype.__handleStackResize = function () {
  for (let stack of Array.from(document.getElementsByClassName("column"))) {
    if (!stack || stack.children.length === 0) continue;
    if (typeof Container.squeezeFromBottom === "function") {
      Container.squeezeFromBottom(stack);
    }
    let last = stack.children[stack.children.length - 1];
    if (last.hasAttribute("containerIndex")) {
      var bounding = last.getBoundingClientRect();
      if (bounding.bottom >= window.visualViewport.height) {
        gameClient.player
          .getContainer(Number(last.getAttribute("containerIndex")))
          .close();
      }
    }
  }
};

Interface.prototype.applyZoom = function () {
  var el = document.getElementById('game-wrapper');
  if (!el) return;
  var zoom = Math.max(1, this.getResolutionScale());
  el.style.zoom = zoom;
};

Interface.prototype.handleResize = function (event) {
  this.applyZoom();

  if (!gameClient.renderer) {
    return;
  }

  var baseScale = this.getResolutionScale();
  var finalScale = baseScale * this.cameraZoom;
  var canvasId = document.getElementById("canvas-id");
  var wrapper = document.getElementById("game-wrapper");
  var upperElem = wrapper ? wrapper.querySelector(".upper") : null;
  var hasZoom = wrapper && wrapper.style.zoom && parseFloat(wrapper.style.zoom) !== 1;
  if (!hasZoom) {
    gameClient.renderer.screen.setScale(finalScale);
    var unscaledWidth = this.SCREEN_WIDTH_MIN * baseScale;
    var unscaledHeight = this.SCREEN_HEIGHT_MIN * baseScale;
    this.setElementDimensions(canvasId, unscaledWidth, unscaledHeight);
  } else {
    gameClient.renderer.screen.setScale(this.cameraZoom);
    this.setElementDimensions(canvasId, this.SCREEN_WIDTH_MIN, this.SCREEN_HEIGHT_MIN);
  }

  canvasId.style.marginTop = "";
  canvasId.style.marginLeft = "";
  if (upperElem) {
    upperElem.style.alignItems = "";
    upperElem.style.paddingTop = "";
  }

  if (this.__isFullscreen()) {
    if (!hasZoom) {
      var unscaledWidth = this.SCREEN_WIDTH_MIN * baseScale;
      var unscaledHeight = this.SCREEN_HEIGHT_MIN * baseScale;
      this.setElementDimensions(canvasId, unscaledWidth - 45, unscaledHeight + 130);
      canvasId.style.marginTop = "0";
      canvasId.style.marginLeft = "-123px";
      if (upperElem) {
        upperElem.style.alignItems = "flex-start";
        upperElem.style.paddingTop = "5px";
      }
      var screen = document.getElementById("screen");
      if (screen) {
        screen.style.transform = "scale(%s) translateX(40px)".format(finalScale);
      }
    }
  }

  this.__handleStackResize();
};

Interface.prototype.setElementDimensions = function (elem, width, height) {
  /*
   * function Interface.setElementDimensions
   * Callback fired when the browser window is resized: make sure to keep the aspect ratio
   */

  // Update the dimensions in pixels
  elem.style.width = "%spx".format(Math.round(width));
  elem.style.height = "%spx".format(Math.round(height));
};

Interface.prototype.closeClient = function (event) {
  /*
   * Function GameClient.closeClient
   * Callback fired when the client is closed.
   */

  // Make sure to save the minimap
  gameClient.renderer.minimap.save();

  // Save the state of the settings to localstorage
  this.settings.saveState();
};

Interface.prototype.sendLogout = function () {
  /*
   * Function Interface.sendLogout
   * Writes a logout request to the server
   */

  // Confirm and write logout packet when confirming
  this.modalManager.open("confirm-modal", function () {
    // Block no logout zones
    if (gameClient.player.getTile().isNoLogoutZone()) {
      return gameClient.interface.setCancelMessage("You may not logout here.");
    }

    gameClient.send(new LogoutPacket());
  });
};



Interface.prototype.__handleVisibiliyChange = function (event) {
  /*
   * Function Interface.handleVisibiliyChange
   * Callback fired when the window is hidden
   */

  // Must be connected to the gameserver
  if (!gameClient.networkManager.isConnected()) {
    return;
  }

  // Disable the keyboard when tabbing out: reset all active keys to prevent "hanging"
  gameClient.keyboard.setInactive();

  if (gameClient.renderer) {
    gameClient.renderer.__handleVisibiliyChange(event);
  }
};

Interface.prototype.__isFullscreen = function () {
  return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
};

Interface.prototype.__updateFullscreenButton = function () {
  let btn = document.getElementById("fullscreen-button");
  if (!btn) return;
  btn.textContent = this.__isFullscreen() ? "Exit Fullscreen" : "Enter Fullscreen";
};

Interface.prototype.__handleResizeWindow = function () {
  this.__updateFullscreenButton();
  if (this.__isFullscreen()) {
    document.body.classList.add("opencode-fullscreen");
    this.__applyFullscreenStyles();
  } else {
    document.body.classList.remove("opencode-fullscreen");
    this.__clearFullscreenStyles();
    let cw = document.getElementById("canvas-id");
    if (cw) {
      cw.style.transform = "";
      cw.style.clipPath = "";
    }
  }
  this.handleResize();
};

Interface.prototype.__closeClientConfirm = function (event) {
  /*
   * Function Interface.__closeClientConfirm
   * Asks the client to confirm the browser close when connected
   */

  // Request confirmation from the client
  if (gameClient.isConnected()) {
    return true;
  }

  return;
};

Interface.prototype.__enableListeners = function () {
  /*
   * Function Interface.__enableListeners
   * All configured event listeners for the DOM
   */

  // These are buttons that open windows
  document
    .getElementById("openSkills")
    .addEventListener("click", this.toggleWindow.bind(this, "skill-window"));
  document
    .getElementById("openBattle")
    .addEventListener("click", this.toggleWindow.bind(this, "battle-window"));
  document
    .getElementById("openQuests")
    .addEventListener("click", this.modalManager.open.bind(this.modalManager, "quest-log-modal"));
  document
    .getElementById("openVipList")
    .addEventListener("click", this.toggleWindow.bind(this, "friend-window"));
  this.windowManager.getWindow("friend-window").on("add-vip", function () {
    let modal = gameClient.interface.modalManager.open("enter-name-modal");
    if (modal) {
      modal.setConfirmCallback(function (name) {
        if (!name) return;
        if (name === gameClient.player.name) {
          return gameClient.interface.setCancelMessage("You cannot add yourself to the VIP list.");
        }
        if (gameClient.player.friendlist.has(name)) {
          return gameClient.interface.setCancelMessage("This player is already in your VIP list.");
        }
        gameClient.send(new FriendAddPacket(name));
      });
    }
  });

  document.getElementById("ignore-button").addEventListener("click", function () {
    if (!gameClient.player || !gameClient.player.isPremium) {
      return gameClient.interface.setCancelMessage("You need a premium account in order to filter your private messages.");
    }
    gameClient.interface.modalManager.open("ignore-list-modal");
  });

  // The logout button
  document
    .getElementById("logout-button")
    .addEventListener("click", this.sendLogout.bind(this));

  // Gifts button
  document.getElementById("gift-button").addEventListener("click", function () {
    gameClient.send(new OpenGiftContainerPacket());
  });

  // Shop button
  document.getElementById("shop-button").addEventListener("click", function () {
    gameClient.interface.modalManager.open("shop-modal");
    gameClient.send(new RequestPremiumBalancePacket());
  });

  // Equipment toggle minimize/maximize
  document
    .getElementById("equipment-toggle-btn")
    .addEventListener("click", function () {
      var wrapper = document.querySelector(".equipment.wrapper");
      wrapper.classList.toggle("minimized");
      this.classList.toggle("minimized");
      this.title = wrapper.classList.contains("minimized")
        ? "Maximizar Inventário"
        : "Minimizar Inventário";

    });

  var enterBtn = document.getElementById("enter-game");
  enterBtn.addEventListener("click", this.enterGame.bind(this));

  // Show button state periodically on debug panel
  this.__debugInterval = setInterval(function () {
    var btn = document.getElementById("enter-game");
    if (!btn) return;
    var state = "Enter Game: " + (btn.disabled ? "DISABLED" : "ENABLED");
    state += " | spritesLoaded=" + this.state.spritesLoaded + " dataLoaded=" + this.state.dataLoaded;
    state += " | assetsLoaded=" + this.areAssetsLoaded();
    if (gameClient && gameClient.networkManager) {
      state += " | connected=" + gameClient.networkManager.isConnected();
    }
    var panel = document.getElementById("load-debug");
    if (panel) panel.textContent = state;
  }.bind(this), 1000);

  // Enter key submits the login form
  let enterForm = document.querySelector("#floater-enter form");
  if (enterForm) {
    enterForm.addEventListener("submit", function(e) { e.preventDefault(); });
  }
  ["user-username", "user-password"].forEach(function(id) {
    document.getElementById(id).addEventListener("keydown", function(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        let btn = document.getElementById("enter-game");
        if (!btn.disabled) {
          btn.click();
        }
      }
    });
  });

  // Load saved credentials from localStorage
  let savedUser = localStorage.getItem("__savedUsername");
  let savedPwd = localStorage.getItem("__savedPassword");
  let userInput = document.getElementById("user-username");
  let pwdInput = document.getElementById("user-password");
  let saveCheck = document.getElementById("save-password");
  if ((savedUser || savedPwd) && saveCheck) {
    saveCheck.checked = true;
    if (savedUser && userInput) userInput.value = savedUser;
    if (savedPwd && pwdInput) pwdInput.value = savedPwd;
  }

  // Visibility change
  addEventListener("visibilitychange", this.__handleVisibiliyChange.bind(this));

  // Callback before the window is unloaded to close the client and terminate the client gracefully
  window.onbeforeunload = this.__closeClientConfirm.bind(this);
  window.addEventListener("pagehide", this.closeClient.bind(this));
  window.onresize = this.__handleResizeWindow.bind(this);

  window.addEventListener("layoutchange", this.applyZoom.bind(this));

  // Initial zoom on page load (deferred to ensure DOM is ready)
  setTimeout(this.applyZoom.bind(this), 0);
};

Interface.prototype.__updateBoostDisplay = function () {
  var panel = document.getElementById("boost-panel");
  if (!panel) return;
  var now = Date.now();
  var expActive = this.__globalBoostExp > now;
  var lootActive = this.__globalBoostLoot > now;
  var skillsActive = this.__globalBoostSkills > now;
  var expEl = document.getElementById("boost-exp");
  var lootEl = document.getElementById("boost-loot");
  var skillsEl = document.getElementById("boost-skills");

  if (expActive) {
    expEl.classList.remove("hidden");
    var rem = Math.max(0, Math.floor((this.__globalBoostExp - now) / 1000));
    var h = Math.floor(rem / 3600);
    var m = Math.floor((rem % 3600) / 60);
    var s = rem % 60;
    document.getElementById("boost-exp-timer").textContent =
      h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  } else {
    expEl.classList.add("hidden");
  }

  if (lootActive) {
    lootEl.classList.remove("hidden");
    var rem = Math.max(0, Math.floor((this.__globalBoostLoot - now) / 1000));
    var h = Math.floor(rem / 3600);
    var m = Math.floor((rem % 3600) / 60);
    var s = rem % 60;
    document.getElementById("boost-loot-timer").textContent =
      h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  } else {
    lootEl.classList.add("hidden");
  }

  if (skillsActive) {
    skillsEl.classList.remove("hidden");
    var rem = Math.max(0, Math.floor((this.__globalBoostSkills - now) / 1000));
    var h = Math.floor(rem / 3600);
    var m = Math.floor((rem % 3600) / 60);
    var s = rem % 60;
    document.getElementById("boost-skills-timer").textContent =
      h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  } else {
    skillsEl.classList.add("hidden");
  }

  panel.classList.toggle("hidden", !expActive && !lootActive && !skillsActive);
};
