MobileFullscreen.prototype.__detectMobile = function () {
  var touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  var ua = (navigator.userAgent || '').toLowerCase();
  var isMobileUA = /mobile|mobi|android|iphone|ipad|ipod|blackberry|iemobile|opera mini|palm|symbian|webos|playbook|windows phone/i.test(ua);
  var isSmallScreen = window.innerWidth <= 1024 || (window.screen && window.screen.width <= 1024);
  return touch || isMobileUA || isSmallScreen;
};

MobileFullscreen.prototype.__injectStyles = function () {
  var s = document.createElement('style');
  s.textContent =
    '#mobile-play-button {' +
    '  display: none; position: fixed; top: 50%; left: 50%;' +
    '  transform: translate(-50%, -50%); z-index: 2147483647;' +
    '  padding: 18px 56px; font-size: 26px; font-weight: bold;' +
    '  font-family: Verdana, sans-serif; color: #fff;' +
    '  background: linear-gradient(145deg, #4a90d9, #2a5fa8);' +
    '  border: 3px solid #6aafff; border-radius: 16px; cursor: pointer;' +
    '  text-shadow: 1px 1px 3px rgba(0,0,0,0.6);' +
    '  box-shadow: 0 6px 24px rgba(0,0,0,0.5);' +
    '  user-select: none; -webkit-user-select: none;' +
    '  touch-action: manipulation;' +
    '}' +
    '#mobile-play-button.visible { display: block; }' +
    '#mobile-play-button:active { transform: translate(-50%, -50%) scale(0.95); }' +
    'body.mobile-fullscreen #game-wrapper {' +
    '  position: fixed !important;' +
    '  top: 0 !important; left: 0 !important;' +
    '  width: 100vw !important; height: 100vh !important;' +
    '  min-width: 0 !important; min-height: 100vh !important;' +
    '  max-width: 100vw !important; max-height: 100vh !important;' +
    '  padding: 0 !important; margin: 0 !important;' +
    '  overflow: hidden !important; box-sizing: border-box !important;' +
    '}' +
    'body.mobile-fullscreen .lower,' +
    'body.mobile-fullscreen .lower::before,' +
    'body.mobile-fullscreen .lower::after { display: none !important; }' +
    'body.mobile-fullscreen .oogwrap,' +
    'body.mobile-fullscreen .oogwrap2,' +
    'body.mobile-fullscreen .oogwrap::before,' +
    'body.mobile-fullscreen .oogwrap::after,' +
    'body.mobile-fullscreen .oogwrap2::before,' +
    'body.mobile-fullscreen .oogwrap2::after { display: none !important; }' +
    'body.mobile-fullscreen #extra-column-wrapper { display: none !important; }' +
    'body.mobile-fullscreen #opencode-fs-vline { display: none !important; }' +
    'body.mobile-fullscreen .canvas-wrapper {' +
    '  transform: none !important; clip-path: none !important;' +
    '  min-width: unset !important; min-height: unset !important;' +
    '  max-width: unset !important; max-height: unset !important;' +
    '  margin: auto !important; position: relative !important;' +
    '  overflow: hidden !important; flex-shrink: 0;' +
    '  display: flex !important; align-items: center !important;' +
    '  justify-content: center !important;' +
    '}' +
    'body.mobile-fullscreen #game-wrapper .main .middle { display: none !important; }' +
    'body.mobile-fullscreen #game-wrapper .main .upper {' +
    '  flex: 1 !important; align-items: center !important;' +
    '  justify-content: center !important;' +
    '  padding-top: 0 !important;' +
    '  background: none !important;' +
    '}' +
    'body.mobile-fullscreen #game-wrapper .main { flex: 1 !important; }' +
    'body.mobile-fullscreen #screen {' +
    '  box-shadow: none !important;' +
    '  width: 100% !important; height: 100% !important;' +
    '}' +
    'body.mobile-fullscreen .modal-wrapper {' +
    '  width: 100vw !important; height: 100vh !important;' +
    '}' +
    'body.mobile-fullscreen #game-wrapper .lower * { display: none !important; }' +
    'body.mobile-fullscreen .chatbox-wrapper { display: none !important; }' +
    'body {-webkit-touch-callout: none; -webkit-user-select: none;' +
    '  user-select: none; touch-action: none;}' +
    '#mobile-dpad {' +
    '  display: none; position: fixed; bottom: 42px; left: 32px;' +
    '  z-index: 2147483646; touch-action: none;' +
    '  width: 75px; height: 75px; border-radius: 50%;' +
    '  background: transparent;' +
    '  border: 1px solid rgba(150,150,150,0.3);' +
    '  user-select: none; -webkit-user-select: none;' +
    '}' +
    '#mobile-dpad.visible { display: block; }' +
    '#mobile-dpad .dpad-arrow {' +
    '  position: absolute; font-size: 13px;' +
    '  color: rgba(255,255,255,0.5); font-weight: bold;' +
    '  pointer-events: none; transform: translate(-50%, -50%);' +
    '  transition: color 0.08s, text-shadow 0.08s;' +
    '}' +
    '#mobile-dpad .dpad-arrow.up    { top: 10%; left: 50%; }' +
    '#mobile-dpad .dpad-arrow.down  { top: 90%; left: 50%; }' +
    '#mobile-dpad .dpad-arrow.left  { top: 50%; left: 10%; }' +
    '#mobile-dpad .dpad-arrow.right { top: 50%; left: 90%; }' +
    '#mobile-dpad .dpad-arrow.active { color: rgba(100,180,255,0.9); text-shadow: 0 0 20px rgba(100,180,255,0.5); }' +
    '#mobile-dpad .dpad-ball {' +
    '  position: absolute; top: 50%; left: 50%;' +
    '  width: 18px; height: 18px; border-radius: 50%;' +
    '  background: radial-gradient(circle at 40% 35%, #e8e8f0, #8888a0);' +
    '  transform: translate(-50%, -50%);' +
    '  box-shadow: 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 4px rgba(255,255,255,0.5);' +
    '  pointer-events: none; z-index: 1;' +
    '  will-change: transform;' +
    '}' +
    '#mobile-dpad .dpad-ball.returning {' +
    '  transition: transform 0.15s ease-out;' +
    '}' +
    '#mobile-equipment [slotIndex="7"] { background-image: url("/images/game/inventory/neck.png"); }' +
    '#mobile-equipment [slotIndex="5"] { background-image: url("/images/game/inventory/left-hand.png"); }' +
    '#mobile-equipment [slotIndex="8"] { background-image: url("/images/game/inventory/finger.png"); }' +
    '#mobile-equipment [slotIndex="0"] { background-image: url("/images/game/inventory/head.png"); }' +
    '#mobile-equipment [slotIndex="1"] { background-image: url("/images/game/inventory/body.png"); }' +
    '#mobile-equipment [slotIndex="2"] { background-image: url("/images/game/inventory/legs.png"); }' +
    '#mobile-equipment [slotIndex="3"] { background-image: url("/images/game/inventory/feet.png"); }' +
    '#mobile-equipment [slotIndex="6"] { background-image: url("/images/game/inventory/back.png"); }' +
    '#mobile-equipment [slotIndex="4"] { background-image: url("/images/game/inventory/right-hand.png"); }' +
    '#mobile-equipment [slotIndex="9"] { background-image: url("/images/game/inventory/ammo.png"); }' +
    '#mobile-dpad-wrapper {' +
    '  display: none; position: fixed; bottom: 42px; left: 32px;' +
    '  z-index: 2147483646; width: 75px; height: 75px;' +
    '  border: 1px solid rgba(150,150,150,0.3); border-radius: 50%;' +
    '  touch-action: none; user-select: none; -webkit-user-select: none;' +
    '}' +
    '#mobile-dpad-wrapper.visible { display: block; }' +
    '#mobile-dpad-wrapper #mobile-dpad {' +
    '  display: block; width: 100%; height: 100%; position: static;' +
    '  transform: none; border: none;' +
    '}' +
    '.module-lock-icon {' +
    '  position: absolute; top: -14px; left: 2px;' +
    '  width: 16px; height: 16px; z-index: 10;' +
    '  cursor: pointer; pointer-events: auto; touch-action: manipulation;' +
    '  border-radius: 3px; -webkit-tap-highlight-color: transparent;' +
    '}' +
    '.module-lock-icon.locked { background: #888; border: 2px solid #666; }' +
    '.module-lock-icon.unlocked { background: transparent; border: 2px solid #888; }' +
    '.dpad-diagonal-btn {' +
    '  position: absolute; top: -14px; right: 2px;' +
    '  width: 16px; height: 16px; z-index: 10;' +
    '  cursor: pointer; pointer-events: auto; touch-action: manipulation;' +
    '  border-radius: 3px; -webkit-tap-highlight-color: transparent;' +
    '}' +
    '.dpad-diagonal-btn.on { background: #888; border: 2px solid #666; }' +
    '.dpad-diagonal-btn { background: transparent; border: 2px solid #888; }' +
    '.dpad-diagonal-btn .ddi {' +
    '  position: absolute; font-size: 6px; line-height: 1; color: #ddd;' +
    '  pointer-events: none;' +
    '}' +
    '.dpad-diagonal-btn .ddi.nw { top: 0; left: 1px; }' +
    '.dpad-diagonal-btn .ddi.ne { top: 0; right: 1px; }' +
    '.dpad-diagonal-btn .ddi.sw { bottom: 0; left: 1px; }' +
    '.dpad-diagonal-btn .ddi.se { bottom: 0; right: 1px; }' +
    '#actionbar {' +
    '  display: none; position: fixed; bottom: 10px;' +
    '  z-index: 2147483644;' +
    '  background: rgba(10,10,15,0.55); border: 1px solid rgba(150,150,150,0.3);' +
    '  border-radius: 4px; padding: 3px 4px;' +
    '  touch-action: none; user-select: none; -webkit-user-select: none;' +
    '}' +
    '#actionbar.visible { display: flex; }' +
    '#actionbar .actionbar-slot {' +
    '  width: 32px; height: 32px; position: relative;' +
    '  background: rgba(30,30,40,0.6); border: 1px solid rgba(120,120,140,0.35);' +
    '  border-radius: 2px; margin: 0 1px;' +
    '  touch-action: none;' +
    '}' +
    '#actionbar .actionbar-slot canvas {' +
    '  width: 32px; height: 32px; position: absolute;' +
    '  top: 0; left: 0; pointer-events: none;' +
    '}' +
    '#actionbar .actionbar-slot .count {' +
    '  color: #d3d3d3; font-size: 10px; font-weight: bold;' +
    '  position: absolute; bottom: 1px; right: 2px;' +
    '  pointer-events: none; z-index: 1;' +
    '  text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;' +
    '}' +
    '#actionbar .actionbar-slot.highlighted {' +
    '  border-color: #ffcc00; box-shadow: 0 0 8px rgba(255,204,0,0.6);' +
    '}' +
    '#actionbar .actionbar-slot.tapped {' +
    '  border-color: #aaddff; box-shadow: 0 0 10px rgba(170,221,255,0.7);' +
    '  background: rgba(50,60,80,0.8);' +
    '}' +
    'body.mobile-fullscreen #skill-window,' +
    'body.mobile-fullscreen #battle-window,' +
    'body.mobile-fullscreen #friend-window,' +
    'body.mobile-fullscreen #party-window,' +
    'body.mobile-fullscreen #quest-tracker-window {' +
    '  position: fixed !important; top: 50px; left: 6px; right: auto !important;' +
    '  z-index: 2147483646 !important;' +
    '  width: 140px !important; max-height: calc(100vh - 60px) !important;' +
    '}' +
    'body.mobile-fullscreen #skill-window .body,' +
    'body.mobile-fullscreen #battle-window .body,' +
    'body.mobile-fullscreen #friend-window .body,' +
    'body.mobile-fullscreen #party-window .body,' +
    'body.mobile-fullscreen #quest-tracker-window .body {' +
    '  overflow-y: auto !important;' +
    '}' +
    'body.mobile-fullscreen .window[containerIndex] {' +
    '  position: fixed !important; top: 50px; left: 6px; right: auto !important;' +
    '  z-index: 2147483646 !important;' +
    '  max-height: calc(100vh - 60px) !important;' +
    '}' +
    'body.mobile-fullscreen .window[containerIndex] .body {' +
    '  overflow-y: auto !important;' +
    '}' +
    'body.mobile-fullscreen #container-prototype {' +
    '  display: none !important;' +
    '}' +
    'body.mobile-fullscreen #fullscreen-button {' +
    '  display: none !important;' +
    '}' +
    '#mobile-action-btns {' +
'  display:none;position:fixed;bottom:56px;left:50%;' +
'  transform:translateX(-50%);' +
'  z-index:2147483644;' +
'  background:rgba(10,10,15,0.55);' +
'  border:1px solid rgba(150,150,150,0.3);' +
'  border-radius:4px;padding:2px;' +
'  flex-direction:column;gap:2px;align-items:center;' +
'  touch-action:none;user-select:none;-webkit-user-select:none;' +
'}' +
'#mobile-action-btns .action-btn {' +
'  width:36px;height:36px;position:relative;' +
'  background:rgba(30,30,40,0.6);' +
'  border:1px solid rgba(120,120,140,0.35);' +
'  border-radius:3px;touch-action:none;cursor:pointer;' +
'  display:flex;align-items:center;justify-content:center;' +
'}' +
'#mobile-action-btns .action-btn:active {' +
'  background:rgba(60,60,80,0.8);' +
'}' +
'#mobile-action-btns .action-btn.active {' +
'  border-color:#ffcc00;box-shadow:0 0 8px rgba(255,204,0,0.5);' +
'}' +
    '#mobile-action-btns .action-btn .action-icon {' +
    '  font-size:20px;line-height:28px;pointer-events:none;display:block;text-align:center;' +
    '}' +
    '#mobile-action-btns .hotkey-btn {' +
    '  width:36px;height:36px;flex-direction:column;padding:1px 0;gap:0;' +
    '}' +
    '#mobile-action-btns .hotkey-btn .action-icon {' +
    '  font-size:14px;line-height:16px;' +
    '}' +
    '#mobile-action-btns .hotkey-btn .hk-label {' +
    '  font-size:7px;line-height:9px;color:#aaa;overflow:hidden;' +
    '  text-overflow:ellipsis;max-width:32px;white-space:nowrap;' +
    '  pointer-events:none;display:block;text-align:center;' +
    '}';
  document.head.appendChild(s);
};


MobileFullscreen.prototype.__overrideMethods = function () {
  var self = this;

  if (typeof Interface !== 'undefined') {
    var origResScale = Interface.prototype.getResolutionScale;
    Interface.prototype.getResolutionScale = function () {
      if (self.isMobile && self.__isFullscreenActive()) {
        var screen = document.getElementById('screen');
        var iw = screen ? screen.width : this.SCREEN_WIDTH_MIN;
        var ih = screen ? screen.height : this.SCREEN_HEIGHT_MIN;
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        var scale = Math.min(vw / iw, vh / ih);
        return Math.max(scale / this.cameraZoom, 0.1);
      }
      return origResScale.call(this);
    };

    var origHandleResize = Interface.prototype.handleResize;
    Interface.prototype.handleResize = function () {
      if (self.isMobile && self.__isFullscreenActive()) {
        self.__adjustCanvas();
        return;
      }
      return origHandleResize.call(this);
    };

    var origApplyZoom = Interface.prototype.applyZoom;
    Interface.prototype.applyZoom = function () {
      if (self.isMobile && self.__isFullscreenActive()) {
        var el = document.getElementById('game-wrapper');
        if (el) el.style.zoom = '1';
        return;
      }
      return origApplyZoom.call(this);
    };
  }
};

MobileFullscreen.prototype.__createButton = function () {
  this.button = document.createElement('div');
  this.button.id = 'mobile-play-button';
  this.button.textContent = 'Jogar';
  document.body.appendChild(this.button);
};

MobileFullscreen.prototype.__bindEvents = function () {
  var self = this;

  this.button.addEventListener('click', function () {
    self.__enterFullscreen();
  });

  window.addEventListener('orientationchange', function () {
    setTimeout(function () {
      self.__checkOrientation();
      if (self.active) { self.__adjustCanvas(); }
    }, 600);
  });

  window.addEventListener('resize', function () {
    self.__checkOrientation();
    if (self.active) {
      self.__adjustCanvas();
    }
  });

  document.addEventListener('fullscreenchange', self.__handleFullscreenChange.bind(self));
  document.addEventListener('webkitfullscreenchange', self.__handleFullscreenChange.bind(self));
  document.addEventListener('mozfullscreenchange', self.__handleFullscreenChange.bind(self));
  document.addEventListener('MSFullscreenChange', self.__handleFullscreenChange.bind(self));
};

MobileFullscreen.prototype.__checkOrientation = function () {
  var landscape = window.innerWidth > window.innerHeight;
  if (this.button) {
    this.button.classList.toggle('visible', landscape && !this.active);
  }
};

MobileFullscreen.prototype.__enterFullscreen = function () {
  this.button.classList.remove('visible');

  var el = document.documentElement;
  var request = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
  if (request) {
    request.call(el);
  }

  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(function () {});
    }
  } catch (e) {}
};

MobileFullscreen.prototype.__handleFullscreenChange = function () {
  var fs = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
  this.active = !!fs;

  if (this.active) {
    document.body.classList.add('mobile-fullscreen');
    this.__adjustCanvas();
    var self = this;
    setTimeout(function () { self.__adjustCanvas(); }, 300);
    setTimeout(function () { self.__adjustCanvas(); }, 800);
    this.__updateDpadVisibility();
    this.__createMobileSlots();
    this.__createActionbar();
    this.__createTopbar();
    this.__createActionButtons();
  } else {
    document.body.classList.remove('mobile-fullscreen');
    this.__dpadReleaseKey();
    if (this.dpadWrapper) this.__saveModuleState(this.dpadWrapper, 'dpad');
    this.__hideDpad();
    this.__destroyMobileSlots();
    this.__destroyActionbar();
    this.__destroyTopbar();
    this.__destroyActionButtons();
    this.__restoreCanvas();
    if (window.gameClient && window.gameClient.interface) {
      window.gameClient.interface.handleResize();
    }
  }

  this.__checkOrientation();
};

MobileFullscreen.prototype.__restoreCanvas = function () {
  var wrapper = document.getElementById('game-wrapper');
  var canvasId = document.getElementById('canvas-id');
  var screen = document.getElementById('screen');
  if (!wrapper || !canvasId || !screen) return;

  if (window.gameClient && window.gameClient.renderer) {
    var renderer = window.gameClient.renderer;
    renderer.playerTileOffsetX = 14;
    renderer.playerTileOffsetY = 7;
    renderer.__cullMarginLeft = 12;
    renderer.__cullMarginRight = 16;
    renderer.__cullMarginTop = 7;
    renderer.__cullMarginBottom = 7;
    renderer.__bgCullMarginLeft = 16;
    renderer.__bgCullMarginRight = 22;
    renderer.__bgCullMarginTop = 9;
    renderer.__bgCullMarginBottom = 11;
    renderer.__bgCacheShiftX = 0;
    renderer.__bgCacheShiftY = 0;
    renderer.__tileCacheNeedsRebuild = true;

    var ogW = Interface.prototype.SCREEN_WIDTH_MIN;
    var ogH = Interface.prototype.SCREEN_HEIGHT_MIN;
    for (var i = 0; i < 16; i++) {
      renderer.__backgroundCaches[i] = new Canvas(null, ogW, ogH);
    }
  }

  this.__canvasOffsetX = 0;
  this.__canvasOffsetY = 0;

  wrapper.style.zoom = '';
  wrapper.style.display = '';
  wrapper.style.position = '';
  wrapper.style.top = '';
  wrapper.style.left = '';
  wrapper.style.width = '';
  wrapper.style.height = '';
  wrapper.style.minWidth = '';
  wrapper.style.minHeight = '';
  wrapper.style.maxWidth = '';
  wrapper.style.maxHeight = '';
  wrapper.style.padding = '';
  wrapper.style.margin = '';
  wrapper.style.overflow = '';
  wrapper.style.boxSizing = '';

  var mainElem = wrapper.querySelector('.main');
  if (mainElem) {
    mainElem.style.display = '';
    mainElem.style.flex = '';
    mainElem.style.flexDirection = '';
    mainElem.style.minWidth = '';
    mainElem.style.minHeight = '';
    mainElem.style.padding = '';
    mainElem.style.margin = '';
  }

  var upper = wrapper.querySelector('.upper');
  if (upper) {
    upper.style.display = '';
    upper.style.flex = '';
    upper.style.alignItems = '';
    upper.style.justifyContent = '';
    upper.style.padding = '';
    upper.style.margin = '';
    upper.style.background = '';
    upper.style.minWidth = '';
    upper.style.minHeight = '';
  }

  canvasId.style.width = '';
  canvasId.style.height = '';
  canvasId.style.minWidth = '';
  canvasId.style.minHeight = '';
  canvasId.style.maxWidth = '';
  canvasId.style.maxHeight = '';
  canvasId.style.transform = '';
  canvasId.style.clipPath = '';
  canvasId.style.margin = '';
  canvasId.style.overflow = '';
  canvasId.style.display = '';
  canvasId.style.alignItems = '';
  canvasId.style.justifyContent = '';
  canvasId.style.flexShrink = '';

  screen.style.transform = '';
  screen.style.transformOrigin = '';
  screen.style.margin = '';
  screen.style.width = '';
  screen.style.height = '';

  // Restore original creature visibility
  if (this.__origCanSee && typeof Creature !== 'undefined') {
    Creature.prototype.canSee = this.__origCanSee;
    this.__origCanSee = null;
  }
};

try {
  new MobileFullscreen();
  if (mobileFS && mobileFS.isMobile) {
    var checkVisible = function () { mobileFS.__checkOrientation(); };
    var checkPlayer = function () {
      mobileFS.__updateDpadVisibility();
      if (mobileFS.active && gameClient && gameClient.player) {
        mobileFS.__createMobileSlots();
        mobileFS.__createActionbar();
        mobileFS.__syncActionbarSlots();
        mobileFS.__updateActionbarHighlight();
        mobileFS.__createTopbar();
        mobileFS.__createActionButtons();

        // Auto-deselect target if creature left visible area or changed floor
        var p = gameClient.player;
        if (p.__target) {
          var target = p.__target;
          var clearTarget = false;
          var pPos = p.__position;
          var tPos = target.__position;

          if (!tPos || !pPos) {
            clearTarget = true;
          } else if (tPos.z !== pPos.z) {
            clearTarget = true;
          } else if (Math.max(Math.abs(tPos.x - pPos.x), Math.abs(tPos.y - pPos.y)) > (gameClient.renderer ? gameClient.renderer.playerTileOffsetX : 10)) {
            clearTarget = true;
          } else if (!gameClient.world.activeCreatures[target.id]) {
            clearTarget = true;
          }

          if (clearTarget) {
            p.setTarget(null);
            if (gameClient.send) gameClient.send(new TargetPacket(0));
          }
        }
      } else {
        if (mobileFS.__mobilePanel) mobileFS.__destroyMobileSlots();
        if (mobileFS.__actionbarEl) mobileFS.__destroyActionbar();
        if (mobileFS.__topbarEl) mobileFS.__destroyTopbar();
        if (mobileFS.__actionBtnsEl) mobileFS.__destroyActionButtons();
      }
    };
    window.addEventListener('load', function () {
      setTimeout(checkVisible, 500);
      setTimeout(checkVisible, 1500);
    });
    setInterval(checkVisible, 3000);
    setInterval(checkPlayer, 1000);
  }
} catch(e) {
  console.warn("MobileFullscreen:", e);
}
