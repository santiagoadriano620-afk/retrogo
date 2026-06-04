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

  var TILE_COUNT_X = 20;
  var TILE_COUNT_Y = 15;
  var gameW = TILE_COUNT_X * 32;
  var gameH = TILE_COUNT_Y * 32;
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
    var halfX = Math.floor(TILE_COUNT_X / 2);
    var halfY = Math.floor(TILE_COUNT_Y / 2);
    renderer.playerTileOffsetX = halfX;
    renderer.playerTileOffsetY = halfY;

    // Foreground culling: viewport + 4 tiles buffer on each side
    renderer.__cullMarginLeft   = halfX + 4;   // 14
    renderer.__cullMarginRight  = halfX + 4;   // 14
    renderer.__cullMarginTop    = halfY + 4;   // 11
    renderer.__cullMarginBottom = halfY + 4;   // 11

    // Background cache: viewport + 6 tiles margin on each side
    var bgMarginX = halfX + 6;   // 16
    var bgMarginY = halfY + 6;   // 13
    renderer.__bgCullMarginLeft   = bgMarginX;
    renderer.__bgCullMarginRight  = bgMarginX;
    renderer.__bgCullMarginTop    = bgMarginY;
    renderer.__bgCullMarginBottom = bgMarginY;
    renderer.__bgCacheShiftX = 6;
    renderer.__bgCacheShiftY = 6;
    renderer.__tileCacheNeedsRebuild = true;

    // Cache canvas: bgCull span = bgMargin*2 tiles on each axis
    var cacheW = bgMarginX * 2 * 32;  // 16*2*32 = 1024
    var cacheH = bgMarginY * 2 * 32;  // 13*2*32 = 832
    for (var i = 0; i < 16; i++) {
      renderer.__backgroundCaches[i] = new Canvas(null, cacheW, cacheH);
    }

    renderer.screen.setScale(1);
    if (typeof renderer.screen.setDimensions === 'function') {
      renderer.screen.setDimensions(gameW, gameH);
    }
  }

  // Override creature visibility to extended mobile viewport
  if (typeof Creature !== 'undefined' && !this.__origCanSee) {
    this.__origCanSee = Creature.prototype.canSee;
    var mobileLimitX = Math.ceil(TILE_COUNT_X) + halfX + 4;   // 20+14 = 34
    var mobileLimitY = Math.ceil(TILE_COUNT_Y) + halfY + 4;   // 15+11 = 26
    Creature.prototype.canSee = function (thing) {
      var projectedSelf = this.getPosition().projected();
      var projectedThing = thing.getPosition().projected();
      var dx = Math.abs(projectedSelf.x - projectedThing.x);
      var dy = Math.abs(projectedSelf.y - projectedThing.y);
      return (dx < mobileLimitX) && (dy < mobileLimitY);
    };
  }
};
