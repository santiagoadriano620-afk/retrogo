var mobileFS = null;

MobileFullscreen = function () {
  this.isMobile = this.__detectMobile();
  this.active = false;
  this.button = null;

  if (this.isMobile) {
    this.__injectStyles();
    this.__createButton();
    this.__bindEvents();
    this.__checkOrientation();
    this.__overrideMethods();
  }

  mobileFS = this;
};

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
    '  user-select: none; touch-action: none;}';
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
  } else {
    document.body.classList.remove('mobile-fullscreen');
    this.__restoreCanvas();
    if (window.gameClient && window.gameClient.interface) {
      window.gameClient.interface.handleResize();
    }
  }

  this.__checkOrientation();
};

MobileFullscreen.prototype.__isFullscreenActive = function () {
  return this.active || !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
};

MobileFullscreen.prototype.__adjustCanvas = function () {
  if (!this.isMobile) return;
  if (!this.__isFullscreenActive()) return;

  var wrapper = document.getElementById('game-wrapper');
  var canvasId = document.getElementById('canvas-id');
  var screen = document.getElementById('screen');
  if (!wrapper || !canvasId || !screen) return;

  var wrapperDisplay = window.getComputedStyle(wrapper).display;
  if (wrapperDisplay === 'none') return;

  var upper = wrapper.querySelector('.upper');
  var mainElem = wrapper.querySelector('.main');

  var vw = window.innerWidth;
  var vh = window.innerHeight;

  // Square canvas: 15 tiles visible (7 each side + player)
  var TILE_COUNT = 15;
  var gameW = TILE_COUNT * 32;
  var gameH = TILE_COUNT * 32;
  var scale = Math.min(vw / gameW, vh / gameH);

  wrapper.style.zoom = '1';
  wrapper.style.display = 'flex';
  wrapper.style.position = 'fixed';
  wrapper.style.top = '0';
  wrapper.style.left = '0';
  wrapper.style.width = '100vw';
  wrapper.style.height = '100vh';
  wrapper.style.minWidth = '0';
  wrapper.style.minHeight = '100vh';
  wrapper.style.maxWidth = '100vw';
  wrapper.style.maxHeight = '100vh';
  wrapper.style.padding = '0';
  wrapper.style.margin = '0';
  wrapper.style.overflow = 'hidden';
  wrapper.style.boxSizing = 'border-box';

  if (mainElem) {
    mainElem.style.display = 'flex';
    mainElem.style.flex = '1';
    mainElem.style.flexDirection = 'column';
    mainElem.style.minWidth = '0';
    mainElem.style.minHeight = '0';
    mainElem.style.padding = '0';
    mainElem.style.margin = '0';
  }

  if (upper) {
    upper.style.display = 'flex';
    upper.style.flex = '1';
    upper.style.alignItems = 'center';
    upper.style.justifyContent = 'center';
    upper.style.padding = '0';
    upper.style.margin = '0';
    upper.style.background = 'none';
    upper.style.minWidth = '0';
    upper.style.minHeight = '0';
  }

  var cw = Math.round(gameW * scale);
  var ch = Math.round(gameH * scale);
  canvasId.style.width = cw + 'px';
  canvasId.style.height = ch + 'px';
  canvasId.style.minWidth = cw + 'px';
  canvasId.style.minHeight = ch + 'px';
  canvasId.style.maxWidth = cw + 'px';
  canvasId.style.maxHeight = ch + 'px';
  canvasId.style.transform = 'none';
  canvasId.style.clipPath = 'none';
  canvasId.style.margin = '0';
  canvasId.style.overflow = 'hidden';
  canvasId.style.display = 'flex';
  canvasId.style.alignItems = 'center';
  canvasId.style.justifyContent = 'center';
  canvasId.style.flexShrink = '0';

  screen.style.transform = 'none';
  screen.style.transformOrigin = '';
  screen.style.margin = '0';
  screen.style.width = '100%';
  screen.style.height = '100%';
  screen.width = gameW;
  screen.height = gameH;

  // Cache canvas viewport offset for screen element positioning
  this.__canvasOffsetX = Math.round((vw - cw) / 2);
  this.__canvasOffsetY = Math.round((vh - ch) / 2);

  if (gameClient && gameClient.renderer && gameClient.renderer.screen) {
    var renderer = gameClient.renderer;
    renderer.playerTileOffsetX = TILE_COUNT / 2;
    renderer.playerTileOffsetY = TILE_COUNT / 2;
    // Symmetric culling: 5 SQM extra on all sides
    renderer.__cullMarginLeft = TILE_COUNT / 2 + 5;
    renderer.__cullMarginRight = TILE_COUNT / 2 + 5;
    renderer.__cullMarginTop = TILE_COUNT / 2 + 5;
    renderer.__cullMarginBottom = TILE_COUNT / 2 + 5;
    // Bg cache: +2 extra tiles for scroll safety
    renderer.__bgCullMarginLeft = TILE_COUNT / 2 + 7;
    renderer.__bgCullMarginRight = TILE_COUNT / 2 + 7;
    renderer.__bgCullMarginTop = TILE_COUNT / 2 + 7;
    renderer.__bgCullMarginBottom = TILE_COUNT / 2 + 7;
    renderer.__tileCacheNeedsRebuild = true;

    renderer.screen.setScale(1);
    if (typeof renderer.screen.setDimensions === 'function') {
      renderer.screen.setDimensions(gameW, gameH);
    }
  }
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
    renderer.__tileCacheNeedsRebuild = true;
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
};

try {
  new MobileFullscreen();
  if (mobileFS && mobileFS.isMobile) {
    var checkVisible = function () { mobileFS.__checkOrientation(); };
    window.addEventListener('load', function () {
      setTimeout(checkVisible, 500);
      setTimeout(checkVisible, 1500);
    });
    setInterval(checkVisible, 3000);
  }
} catch(e) {
  console.warn("MobileFullscreen:", e);
}
