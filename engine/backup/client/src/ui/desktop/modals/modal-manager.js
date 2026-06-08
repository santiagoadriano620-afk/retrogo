const ModalManager = function () {

  /*
   * Class ModalManager
   * Manager for all modal __modals that can be opened
   */

  // The currently opened modal
  this.__openedModal = null;

  this.__modals = new Object();

  // Cache for lazy-loaded script promises
  this.__loadedScripts = new Object();

  // Register all the following modals
  this.register(OutfitModal, "outfit-modal");
  this.register(MoveItemModal, "move-item-modal");
  this.register(ChatModal, "chat-modal");
  this.register(Modal, "settings-modal");
  this.register(EnterNameModal, "enter-name-modal");
  this.register(ConfirmModal, "confirm-modal");
  this.register(TextModal, "floater-connecting");
  this.register(Modal, "settings-box");
  this.register(Modal, "floater-enter");
  this.register(CharacterSelectModal, "floater-characters");
  this.register(CreateAccountModal, "floater-create");
  this.register(ReadableModal, "readable-modal");
  this.register(OfferModal, "offer-modal");
  this.register(MapModal, "map-modal");
  this.register(SpellbookModal, "spellbook-modal");
  this.register(DeathModal, "death-modal");
  this.register(WindowQuestLog, "quest-log-modal");
  this.register(HotkeyModal, "hotkey-modal");
  this.register(Modal, "minimap-mark-modal");
  this.register(OracleModal, "oracle-modal");
  this.register(BlessingModal, "blessing-modal");
  this.register(GuildModal, "guild-modal");
  this.register(HouseModal, "house-modal");
  this.register(HouseManageModal, "house-manage-modal");
  this.register(TradeModal, "trade-modal");
  this.register(IgnoreListModal, "ignore-list-modal");
  this.register(ShopModal, "shop-modal");
  this.register(PaymentModal, "payment-modal");
  this.register(MarketModal, "market-modal");

  this.__addEventListeners();

}

ModalManager.prototype.__loadScript = function (src) {
  if (this.__loadedScripts.hasOwnProperty(src)) {
    return this.__loadedScripts[src];
  }
  let self = this;
  let promise = new Promise(function (resolve, reject) {
    let script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = function () {
      console.error("Failed to load script:", src);
      reject(new Error("Failed to load " + src));
    };
    document.body.appendChild(script);
  });
  this.__loadedScripts[src] = promise;
  return promise;
};

ModalManager.prototype.__addEventListeners = function () {

  /*
   * Function ModalManager.__addEventListeners
   * Adds event listeners to the modals
   */

  // Listener for clicking open modal buttons
  let channelsBtn = document.getElementById("channels-button");
  if(channelsBtn) {
    channelsBtn.addEventListener("click", this.open.bind(this, "chat-modal"));
  }
  document.getElementById("openSettings").addEventListener("click", this.open.bind(this, "settings-modal"));
  document.getElementById("openHotkey").addEventListener("click", this.open.bind(this, "hotkey-modal"));

  // Main login window buttons
  document.getElementById("login-info").addEventListener("click", this.open.bind(this, "floater-enter"));
  document.getElementById("create-account").addEventListener("click", this.open.bind(this, "floater-create"));

  // Lazy-loaded modals: load script on first click, then register and open
  document.getElementById("highscore-btn").addEventListener("click", function () {
    this.__loadScript("src/ui/desktop/modals/modal-highscore.js").then(function () {
      if (!this.__modals.hasOwnProperty("floater-highscore")) {
        this.register(HighscoreModal, "floater-highscore");
      }
      this.open("floater-highscore");
    }.bind(this));
  }.bind(this));

  document.getElementById("bans-btn").addEventListener("click", function () {
    this.__loadScript("src/ui/desktop/modals/modal-bans.js").then(function () {
      if (!this.__modals.hasOwnProperty("floater-bans")) {
        this.register(BansModal, "floater-bans");
      }
      this.open("floater-bans");
    }.bind(this));
  }.bind(this));

  document.getElementById("deaths-btn").addEventListener("click", function () {
    this.__loadScript("src/ui/desktop/modals/modal-deaths.js").then(function () {
      if (!this.__modals.hasOwnProperty("floater-deaths")) {
        this.register(DeathsModal, "floater-deaths");
      }
      this.open("floater-deaths");
    }.bind(this));
  }.bind(this));

  // Blessing button
  document.getElementById("blessing-btn").addEventListener("click", this.open.bind(this, "blessing-modal"));

  // Guild button
  let guildBtn = document.getElementById("guild-btn");
  if (guildBtn) {
    guildBtn.addEventListener("click", this.open.bind(this, "guild-modal"));
  }

  // Add event listeners to the header elements of the modals
  Array.from(document.querySelectorAll(".modal-header")).forEach(header => {
    header.addEventListener("mousedown", this.__handleHeaderMouseDown);
    header.addEventListener("touchstart", this.__handleHeaderTouchStart, { passive: false });
  });

}

ModalManager.prototype.__handleHeaderMouseDown = function (event) {

  /*
   * Function ModalManager.__handleHeaderMouseDown
   * Handles dragging of modal windows ("this" references the header element)
   */

  event.preventDefault();

  let __handleRelease = function (event) {

    /*
     * Function ModalManager.__handleHeaderMouseDown.__handleRelease
     * Handles mouse up event when a modal is being dragged
     */

    event.preventDefault();

    // Delete listeners when mouse is released (also self!)
    document.removeEventListener("mousemove", __handleDrag);
    document.removeEventListener("mouseup", __handleRelease);

  }

  let __handleDrag = function (event) {

    /*
     * Function ModalManager.__handleHeaderMouseDown.__handleDrag
     * Handles mouse up event when a modal is being dragged
     */

    event.preventDefault();

    let rect = gameClient.renderer.screen.canvas.getBoundingClientRect();

    let modalElement = this.parentElement;

    // Calculate the required offset
    let left = event.clientX - rect.left - 0.5 * modalElement.offsetWidth;
    let top = event.clientY - rect.top - 0.5 * this.offsetHeight;

    // Clamp to the game window
    left = left.clamp(0, rect.width - modalElement.offsetWidth);
    top = top.clamp(0, rect.height - modalElement.offsetHeight);

    // Set the position of the modal
    modalElement.style.left = "%spx".format(left);
    modalElement.style.top = "%spx".format(top);

  }.bind(this)

  // Attach two new listeners
  document.addEventListener("mousemove", __handleDrag);
  document.addEventListener("mouseup", __handleRelease);

}

ModalManager.prototype.__handleHeaderTouchStart = function (event) {

  event.preventDefault();

  var touch = event.touches[0];
  var self = this;

  var __handleRelease = function () {
    document.removeEventListener("touchmove", __handleDrag);
    document.removeEventListener("touchend", __handleRelease);
  };

  var __handleDrag = function (event) {
    event.preventDefault();

    var touch = event.touches[0];
    var rect = gameClient.renderer.screen.canvas.getBoundingClientRect();
    var modalElement = self.parentElement;

    var left = touch.clientX - rect.left - 0.5 * modalElement.offsetWidth;
    var top = touch.clientY - rect.top - 0.5 * self.offsetHeight;

    left = left.clamp(0, rect.width - modalElement.offsetWidth);
    top = top.clamp(0, rect.height - modalElement.offsetHeight);

    modalElement.style.left = "%spx".format(left);
    modalElement.style.top = "%spx".format(top);
  };

  document.addEventListener("touchmove", __handleDrag, { passive: false });
  document.addEventListener("touchend", __handleRelease);

};

ModalManager.prototype.register = function (Class, id) {

  /*
   * Function ModalManager.register
   * Registers a new modal with the manager
   */

  // Prevent double registering of modals
  if (this.__modals.hasOwnProperty(id)) {
    return console.error("A modal with identifier " + id + " already exists.");
  }

  // Apply the class with the proper identifier
  this.__modals[id] = new Class(id);

}

ModalManager.prototype.handleConfirm = function () {

  /*
   * Function ModalManager.handleConfirm
   * Generic confirm function to trigger confirm in any modal
   */

  if (!this.isOpened()) {
    return;
  }

  if (this.__openedModal.handleConfirm()) {
    this.close();
  }

}

ModalManager.prototype.close = function () {

  /*
   * Function ModalManager.close
   * Closes the currently opened modal
   */

  if (!this.isOpened()) {
    return;
  }

  // Hide the current modal
  this.__openedModal.element.style.display = "none";
  this.__openedModal = null;

  // Remove focus from any focused element and return it to the gamescreen
  if (document.activeElement) {
    document.activeElement.blur();
  }

}

ModalManager.prototype.render = function () {

  /*
   * Function ModalManager.render
   * Delegates call to the modal window to render
   */

  // Nothing is opened
  if (!this.isOpened()) {
    return;
  }

  this.__openedModal.handleRender();

}

ModalManager.prototype.get = function (id) {

  /*
   * Function ModalManager.get
   * Returns the window with the passed identifier
   */

  // The requested modal does not exist
  if (!this.__modals.hasOwnProperty(id)) {
    return null;
  }

  return this.__modals[id];

}

ModalManager.prototype.isOpened = function () {

  /*
   * Function ModalManager.isOpened
   * Returns true if any of the modals is active
   */

  return this.__openedModal !== null;

}

ModalManager.prototype.open = function (id, options) {

  /*
   * Function ModalManager.open
   * Opens modal with the requested identifier and passes options
   */

  // Does not exist
  if (!this.__modals.hasOwnProperty(id)) {
    return null;
  }

  // Already opened: close the previous modal
  if (this.isOpened()) {
    this.close();
  }

  this.__openedModal = this.get(id);
  this.__openedModal.show();
  this.__openedModal.handleOpen(options);

  return this.__openedModal;

}
