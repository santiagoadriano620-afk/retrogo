MobileFullscreen.prototype.__bindCanvasTouch = function () {
  var self = this;
  var canvas = document.getElementById('canvas-id');
  if (!canvas) return;

  canvas.addEventListener('touchstart', function (e) {
    if (!self.active) return;
    if (!gameClient || !gameClient.player) return;

    if (!gameClient.mouse || !gameClient.mouse.getWorldObject) return;

    var touch = e.changedTouches[0];
    if (!touch) return;

    if (self.__lookMode) {
      e.preventDefault();
      var lookEvent = { clientX: touch.clientX, clientY: touch.clientY, target: e.target };
      self.__handleCanvasLookTap(lookEvent);
      return;
    }
  });
};

MobileFullscreen.prototype.__handleCanvasLookTap = function (touchEvent) {
  if (!window.gameClient || !window.gameClient.mouse || !window.gameClient.mouse.look) {
    this.__lookMode = false;
    return;
  }
  var worldObj = gameClient.mouse.getWorldObject(touchEvent);
  if (worldObj && worldObj.which) {
    gameClient.mouse.look(worldObj);
  }
  this.__lookMode = false;
  if (this.__actionBtnsEl) {
    var lookBtn = this.__actionBtnsEl.querySelector('.action-btn.eye');
    if (lookBtn) lookBtn.classList.remove('active');
  }
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

  this.__canvasOffsetX = Math.round((vw - cw) / 2);
  this.__canvasOffsetY = Math.round((vh - ch) / 2);

  if (gameClient && gameClient.renderer && gameClient.renderer.screen) {
    var renderer = gameClient.renderer;
    renderer.playerTileOffsetX = TILE_COUNT / 2;
    renderer.playerTileOffsetY = TILE_COUNT / 2;
    renderer.__cullMarginLeft = 14;
    renderer.__cullMarginRight = 14;
    renderer.__cullMarginTop = 14;
    renderer.__cullMarginBottom = 14;
    renderer.__bgCullMarginLeft = 16;
    renderer.__bgCullMarginRight = 16;
    renderer.__bgCullMarginTop = 16;
    renderer.__bgCullMarginBottom = 16;
    renderer.__bgCacheShiftX = 1;
    renderer.__bgCacheShiftY = 1;
    renderer.__tileCacheNeedsRebuild = true;

    var bgW = 1080;
    var bgH = 640;
    for (var i = 0; i < 16; i++) {
      renderer.__backgroundCaches[i] = new Canvas(null, bgW, bgH);
    }

    renderer.screen.setScale(1);
    if (typeof renderer.screen.setDimensions === 'function') {
      renderer.screen.setDimensions(gameW, gameH);
    }
  }
};
