var mobileFS = null;

MobileFullscreen = function () {
  this.isMobile = this.__detectMobile();
  this.active = false;
  this.button = null;
  this.dpad = null;
  this.dpadTouchId = null;
  this.dpadDirection = null;
  this.dpadKey = null;
  this.DPAD_SIZE = 120;
  this.DPAD_DEAD_ZONE = 18;
  this.__lastTapTime = 0;
  this.__lastTapX = 0;
  this.__lastTapY = 0;
  this.__repositioning = null;

  if (this.isMobile) {
    this.__injectStyles();
    this.__createButton();
    this.__createDpad();
    this.__bindEvents();
    this.__checkOrientation();
    this.__overrideMethods();
    this.__bindCanvasTouch();
    this.__bindSlotTouch();
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
    '  user-select: none; touch-action: none;}' +
    '#mobile-dpad {' +
    '  display: none; position: fixed; bottom: 42px; left: 32px;' +
    '  z-index: 2147483646; touch-action: none;' +
    '  width: 120px; height: 120px; border-radius: 50%;' +
    '  background: transparent;' +
    '  border: 2px solid rgba(255,255,255,0.25);' +
    '  user-select: none; -webkit-user-select: none;' +
    '}' +
    '#mobile-dpad.visible { display: block; }' +
    '#mobile-dpad .dpad-arrow {' +
    '  position: absolute; font-size: 20px;' +
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
    '  width: 28px; height: 28px; border-radius: 50%;' +
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
    '@keyframes mob-rep-blink {' +
    '  0%, 100% { border-color: rgba(160,160,160,0.8); }' +
    '  50% { border-color: rgba(160,160,160,0.1); }' +
    '}' +
    '#mobile-equipment.reposition-mode, #mobile-dpad.reposition-mode {' +
    '  border: 2px dashed rgba(160,160,160,0.8);' +
    '  animation: mob-rep-blink 0.6s ease-in-out infinite;' +
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

MobileFullscreen.prototype.__createDpad = function () {
  var el = document.createElement('div');
  el.id = 'mobile-dpad';
  el.innerHTML =
    '<span class="dpad-arrow up">&#9650;</span>' +
    '<span class="dpad-arrow down">&#9660;</span>' +
    '<span class="dpad-arrow left">&#9664;</span>' +
    '<span class="dpad-arrow right">&#9654;</span>' +
    '<div class="dpad-ball"></div>';
  document.body.appendChild(el);
  this.dpad = el;
  this.__bindDpadEvents(el);
  this.__enableRepositionDrag(el, 'retrogo_dpad_pos', {
    onStart: function () { el.style.transition = 'border-color 0s'; },
    onEnd: function () {}
  });
};

var DPAD_KEY_MAP = null;

function DPAD_GET_KEY(dir) {
  if (!DPAD_KEY_MAP) {
    DPAD_KEY_MAP = {};
    DPAD_KEY_MAP[CONST.DIRECTION.NORTH] = 38;
    DPAD_KEY_MAP[CONST.DIRECTION.SOUTH] = 40;
    DPAD_KEY_MAP[CONST.DIRECTION.EAST]  = 39;
    DPAD_KEY_MAP[CONST.DIRECTION.WEST]  = 37;
    DPAD_KEY_MAP[CONST.DIRECTION.NORTHEAST] = 69;
    DPAD_KEY_MAP[CONST.DIRECTION.NORTHWEST] = 81;
    DPAD_KEY_MAP[CONST.DIRECTION.SOUTHEAST] = 67;
    DPAD_KEY_MAP[CONST.DIRECTION.SOUTHWEST] = 90;
  }
  return DPAD_KEY_MAP[dir];
}

MobileFullscreen.prototype.__directionFromAngle = function (angleDeg) {
  var sectors = [
    { min: -22.5, max: 22.5, dir: CONST.DIRECTION.EAST, arrow: 'right' },
    { min: 22.5, max: 67.5, dir: CONST.DIRECTION.SOUTHEAST, arrow: null },
    { min: 67.5, max: 112.5, dir: CONST.DIRECTION.SOUTH, arrow: 'down' },
    { min: 112.5, max: 157.5, dir: CONST.DIRECTION.SOUTHWEST, arrow: null },
    { min: 157.5, max: 180, dir: CONST.DIRECTION.WEST, arrow: 'left' },
    { min: -180, max: -157.5, dir: CONST.DIRECTION.WEST, arrow: 'left' },
    { min: -157.5, max: -112.5, dir: CONST.DIRECTION.NORTHWEST, arrow: null },
    { min: -112.5, max: -67.5, dir: CONST.DIRECTION.NORTH, arrow: 'up' },
    { min: -67.5, max: -22.5, dir: CONST.DIRECTION.NORTHEAST, arrow: null }
  ];
  for (var i = 0; i < sectors.length; i++) {
    if (angleDeg >= sectors[i].min && angleDeg < sectors[i].max) {
      return sectors[i];
    }
  }
  return null;
};

MobileFullscreen.prototype.__getKeyboard = function () {
  if (window.gameClient && window.gameClient.keyboard) {
    return window.gameClient.keyboard;
  }
  return null;
};

MobileFullscreen.prototype.__dpadReleaseKey = function () {
  var kb = this.__getKeyboard();
  if (this.dpadKey !== null) {
    if (kb) kb.__activeKeys.delete(this.dpadKey);
    this.dpadKey = null;
  }
};

MobileFullscreen.prototype.__dpadPressKey = function (dir) {
  var key = DPAD_GET_KEY(dir);
  if (key === undefined) return;
  var kb = this.__getKeyboard();
  if (kb) kb.__activeKeys.add(key);
  this.dpadKey = key;
};

MobileFullscreen.prototype.__bindDpadEvents = function (el) {
  var self = this;

  var getCenter = function () {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  var handleStart = function (clientX, clientY, touchId) {
    if (self.dpadTouchId !== null) return;
    self.dpadTouchId = touchId;
    self.__dpadProcessMove(clientX, clientY, getCenter());
  };

  var handleEnd = function () {
    self.__dpadReleaseKey();
    self.dpadTouchId = null;
    self.dpadDirection = null;
    self.__dpadResetBall();
    var arrows = el.querySelectorAll('.dpad-arrow');
    for (var i = 0; i < arrows.length; i++) arrows[i].classList.remove('active');
  };

  el.addEventListener('touchstart', function (e) {
    if (self.__repositioning === el) return;
    e.preventDefault();
    var t = e.changedTouches[0];
    handleStart(t.clientX, t.clientY, t.identifier);
  });

  el.addEventListener('touchmove', function (e) {
    if (self.__repositioning === el) return;
    e.preventDefault();
    if (self.dpadTouchId === null) return;
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === self.dpadTouchId) {
        self.__dpadProcessMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY, getCenter());
        break;
      }
    }
  });

  el.addEventListener('touchend', function (e) {
    if (self.__repositioning === el) return;
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === self.dpadTouchId) {
        handleEnd();
        break;
      }
    }
  });

  el.addEventListener('touchcancel', function (e) {
    if (self.__repositioning === el) return;
    handleEnd();
  });

  el.addEventListener('mousedown', function (e) {
    handleStart(e.clientX, e.clientY, -1);
  });

  document.addEventListener('mouseup', function (e) {
    if (self.dpadTouchId === -1) handleEnd();
  });

  el.addEventListener('mousemove', function (e) {
    if (self.dpadTouchId === -1) {
      self.__dpadProcessMove(e.clientX, e.clientY, getCenter());
    }
  });
};

MobileFullscreen.prototype.__dpadUpdateBall = function (angleRad, dist) {
  var ball = this.dpad.querySelector('.dpad-ball');
  if (!ball) return;

  var maxBallOffset = 28;
  var maxTouchDist = this.DPAD_SIZE * 0.45;
  var clamped = Math.min(dist, maxTouchDist);
  var ratio = maxTouchDist > 0 ? clamped / maxTouchDist : 0;
  var ballDist = ratio * maxBallOffset;

  if (ballDist < 1) {
    ball.classList.add('returning');
    ball.style.transform = 'translate(-50%, -50%)';
  } else {
    ball.classList.remove('returning');
    var bx = Math.cos(angleRad) * ballDist;
    var by = Math.sin(angleRad) * ballDist;
    ball.style.transform = 'translate(calc(-50% + ' + bx.toFixed(1) + 'px), calc(-50% + ' + by.toFixed(1) + 'px))';
  }
};

MobileFullscreen.prototype.__dpadResetBall = function () {
  var ball = this.dpad.querySelector('.dpad-ball');
  if (!ball) return;
  ball.classList.add('returning');
  ball.style.transform = 'translate(-50%, -50%)';
};

MobileFullscreen.prototype.__dpadProcessMove = function (clientX, clientY, center) {
  var dx = clientX - center.x;
  var dy = clientY - center.y;
  var dist = Math.sqrt(dx * dx + dy * dy);

  var arrows = this.dpad.querySelectorAll('.dpad-arrow');
  for (var i = 0; i < arrows.length; i++) arrows[i].classList.remove('active');

  if (dist < this.DPAD_DEAD_ZONE) {
    this.__dpadReleaseKey();
    this.dpadDirection = null;
    this.__dpadResetBall();
    return;
  }

  var angleRad = Math.atan2(dy, dx);
  var angleDeg = angleRad * (180 / Math.PI);
  var sector = this.__directionFromAngle(angleDeg);
  if (!sector) return;

  this.dpadDirection = sector.dir;
  this.__dpadUpdateBall(angleRad, dist);
  if (sector.arrow) {
    var arrowEl = this.dpad.querySelector('.dpad-arrow.' + sector.arrow);
    if (arrowEl) arrowEl.classList.add('active');
  }

  // Release old key before pressing new one, to avoid stale keys
  if (this.dpadKey !== null && DPAD_GET_KEY(sector.dir) !== this.dpadKey) {
    this.__dpadReleaseKey();
  }
  if (this.dpadKey === null) {
    this.__dpadPressKey(sector.dir);
  }
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
  } else {
    document.body.classList.remove('mobile-fullscreen');
    this.__dpadReleaseKey();
    if (this.dpad) this.__saveRepositionPosition(this.dpad, 'retrogo_dpad_pos');
    this.__hideDpad();
    this.__destroyMobileSlots();
    this.__restoreCanvas();
    if (window.gameClient && window.gameClient.interface) {
      window.gameClient.interface.handleResize();
    }
  }

  this.__checkOrientation();
};

MobileFullscreen.prototype.__updateDpadVisibility = function () {
  if (!this.dpad) return;
  var show = this.active && window.gameClient && window.gameClient.player;
  this.dpad.classList.toggle('visible', show);
};

MobileFullscreen.prototype.__hideDpad = function () {
  if (!this.dpad) return;
  this.dpad.classList.remove('visible');
  this.dpadTouchId = null;
  this.dpadDirection = null;
  this.__dpadResetBall();
  var arrows = this.dpad.querySelectorAll('.dpad-arrow');
  for (var i = 0; i < arrows.length; i++) arrows[i].classList.remove('active');
};

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

    var now = Date.now();
    var dt = now - self.__lastTapTime;
    var dx = touch.clientX - self.__lastTapX;
    var dy = touch.clientY - self.__lastTapY;
    self.__lastTapTime = now;
    self.__lastTapX = touch.clientX;
    self.__lastTapY = touch.clientY;

    var touchEvent = { clientX: touch.clientX, clientY: touch.clientY, target: e.target };
    var worldObj = gameClient.mouse.getWorldObject(touchEvent);
    if (!worldObj || !worldObj.which) return;

    var tile = worldObj.which;

    // Double tap on non-creature → use action
    if (dt < 300 && Math.sqrt(dx * dx + dy * dy) < 30) {
      if (tile && tile.monsters) {
        var monsterCount = 0;
        tile.monsters.forEach(function (c) { if (c.type !== 0) monsterCount++; });
        if (monsterCount === 0) {
          gameClient.mouse.use({ which: tile, index: 0xFF });
          e.preventDefault();
        }
      }
      return;
    }

    // Single tap → check for creatures with expanded hitbox
    if (!tile || !tile.monsters || !tile.__position) return;

    var creatureTile = tile;
    var hasMonster = false;
    var selfCheck = function (t) {
      var found = false;
      t.monsters.forEach(function (c) {
        if (!found && c.type !== 0 && c !== gameClient.player) found = true;
      });
      return found;
    };

    // Check center tile
    hasMonster = selfCheck(tile);

    // If none, check 4 cardinal neighbors (~1.5 SQM hitbox)
    if (!hasMonster) {
      var pos = tile.__position;
      var offsets = [
        { x: 0, y: -1 }, { x: 0, y: 1 },
        { x: -1, y: 0 }, { x: 1, y: 0 }
      ];
      for (var i = 0; i < offsets.length; i++) {
        var nPos = new Position(pos.x + offsets[i].x, pos.y + offsets[i].y, pos.z);
        var chunk = gameClient.world.getChunkFromWorldPosition(nPos);
        if (chunk) {
          var nTile = chunk.getFirstTileFromTop(nPos.projected());
          if (nTile && selfCheck(nTile)) {
            creatureTile = nTile;
            hasMonster = true;
            break;
          }
        }
      }
    }

    if (hasMonster) {
      gameClient.world.targetMonster(creatureTile.monsters);
      e.preventDefault();
    }
  });
};

MobileFullscreen.prototype.__bindSlotTouch = function () {
  var self = this;
  this.__dragSource = null;
  this.__dragSprite = null;
  var dragThreshold = 8;

  var handleTouchStart = function (e) {
    if (self.__repositioning) return;
    if (!self.active || !gameClient || !gameClient.player) return;
    var slotEl = e.target.closest('.slot');
    if (!slotEl) return;
    var slotIndex = Number(slotEl.getAttribute('slotIndex'));
    var equipment = gameClient.player.equipment;
    if (!equipment || !equipment.slots || !equipment.slots[slotIndex]) return;
    var slot = equipment.slots[slotIndex];
    if (!slot || !slot.item) return;
    var touch = e.changedTouches[0];
    self.__dragSource = { which: equipment, index: slotIndex, startX: touch.clientX, startY: touch.clientY };
  };

  var handleTouchMove = function (e) {
    if (self.__repositioning) return;
    if (!self.__dragSource) return;
    if (!gameClient || !gameClient.mouse) return;
    var touch = e.changedTouches[0];
    var dx = touch.clientX - self.__dragSource.startX;
    var dy = touch.clientY - self.__dragSource.startY;
    if (dx * dx + dy * dy < dragThreshold * dragThreshold) return;

    if (!self.__dragSprite) {
      gameClient.mouse.__renderDragSprite({ which: self.__dragSource.which, index: self.__dragSource.index });
      self.__dragSprite = gameClient.mouse.__dragSprite;
    }
    gameClient.mouse.__updateDragSpritePosition(e);
    e.preventDefault();
  };

  var handleTouchEnd = function (e) {
    if (!self.__dragSource) { self.__dragSprite = null; return; }
    // Only process if drag actually started (threshold crossed)
    if (!self.__dragSprite) { self.__dragSource = null; return; }
    if (gameClient && gameClient.mouse) {
      var touch = e.changedTouches[0];
      var dropEl = document.elementFromPoint(touch.clientX, touch.clientY);
      var fromObject = { which: self.__dragSource.which, index: self.__dragSource.index };

      if (dropEl && dropEl.closest('#screen')) {
        // Drop on canvas → move to ground
        var worldObj = gameClient.mouse.getWorldObject({ clientX: touch.clientX, clientY: touch.clientY, target: dropEl.closest('#screen') });
        if (worldObj && worldObj.which) {
          gameClient.mouse.sendItemMove(fromObject, worldObj, 1);
        }
      } else if (dropEl) {
        var targetSlot = dropEl.closest('.slot');
        if (targetSlot) {
          var targetIndex = Number(targetSlot.getAttribute('slotIndex'));
          if (targetIndex !== self.__dragSource.index) {
            gameClient.mouse.sendItemMove(fromObject, { which: gameClient.player.equipment, index: targetIndex }, 1);
          }
        } else if (dropEl.closest('.container-window') || dropEl.closest('.column')) {
          // Dropped on a container window — find the actual slot
          var containerSlot = dropEl.closest('[slotIndex]');
          if (containerSlot && containerSlot.closest('.container-window')) {
            var cSlotIndex = Number(containerSlot.getAttribute('slotIndex'));
            var containerWindow = containerSlot.closest('[containerIndex]');
            if (containerWindow) {
              var containerIdx = Number(containerWindow.getAttribute('containerIndex'));
              var container = gameClient.player.getContainer(containerIdx);
              if (container) {
                gameClient.mouse.sendItemMove(fromObject, { which: container, index: cSlotIndex }, 1);
              }
            }
          }
        }
      }

      gameClient.mouse.__clearDragSprite();
    }

    self.__dragSprite = null;
    self.__dragSource = null;
  };

  // Bind to document for all slot touches
  document.addEventListener('touchstart', handleTouchStart, { passive: true });
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);
};

MobileFullscreen.prototype.__createMobileSlots = function () {
  if (this.__mobilePanel || !gameClient || !gameClient.player) return;

  var equipment = gameClient.player.equipment;
  if (!equipment) return;

  this.__originalSlotEls = [];
  this.__originalConditionsParent = null;
  this.__originalCapacityParent = null;

  var panel = document.createElement('div');
  panel.id = 'mobile-equipment';
  panel.style.cssText = 'position:fixed;right:6px;top:6px;z-index:2147483645;display:flex;flex-direction:row;gap:2px;pointer-events:auto;';
  this.__mobilePanel = panel;

  var columns = [
    { slots: [7, 5, 8], ids: ['neck', 'left-hand', 'finger'], extra: [
      function () {
        var el = document.getElementById('conditions-display');
        if (el && el.parentNode) {
          this.__originalConditionsParent = el.parentNode;
          return el.parentNode.removeChild(el);
        }
        return null;
      }
    ]},
    { slots: [0, 1, 2, 3], ids: ['head', 'body', 'legs', 'feet'], extra: [] },
    { slots: [6, 4, 9], ids: ['back', 'right-hand', 'ammo'], extra: [
      function () {
        var el = document.querySelector('.capacity-display');
        if (el && el.parentNode) {
          this.__originalCapacityParent = el.parentNode;
          el.parentNode.removeChild(el);
        }
        return el;
      }
    ]}
  ];

  for (var c = 0; c < columns.length; c++) {
    var col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;gap:2px;';

    for (var s = 0; s < columns[c].slots.length; s++) {
      var slotIndex = columns[c].slots[s];
      var slotId = columns[c].ids[s];

      var slotEl = document.createElement('div');
      slotEl.className = 'slot';
      slotEl.setAttribute('slotIndex', slotIndex);
      slotEl.style.cssText = 'width:32px;height:32px;position:relative;touch-action:auto;';

      var canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      canvas.style.cssText = 'width:32px;height:32px;position:absolute;top:0;left:0;z-index:100;pointer-events:none;';
      slotEl.appendChild(canvas);

      var count = document.createElement('span');
      count.className = 'count';
      count.style.cssText = 'color:#d3d3d3;font-size:10px;font-weight:bold;position:absolute;bottom:2px;right:4px;pointer-events:none;z-index:100;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;touch-action:auto;';
      slotEl.appendChild(count);

      col.appendChild(slotEl);

      if (equipment.slots[slotIndex]) {
        this.__originalSlotEls[slotIndex] = equipment.slots[slotIndex].element;
        equipment.slots[slotIndex].setElement(slotEl);
        equipment.slots[slotIndex].render();
      }
    }

    // Append extra elements (conditions, capacity)
    for (var e = 0; e < columns[c].extra.length; e++) {
      var extraEl = columns[c].extra[e].call(this);
      if (extraEl) {
        col.appendChild(extraEl);
      }
    }

    panel.appendChild(col);
  }

  document.body.appendChild(panel);

  this.__enableRepositionDrag(panel, 'retrogo_equip_pos', {
    onStart: function () {},
    onEnd: function () {}
  });
};

MobileFullscreen.prototype.__destroyMobileSlots = function () {
  if (!this.__mobilePanel) return;

  this.__saveRepositionPosition(this.__mobilePanel, 'retrogo_equip_pos');

  if (gameClient && gameClient.player && gameClient.player.equipment && this.__originalSlotEls) {
    for (var i = 0; i < this.__originalSlotEls.length; i++) {
      if (this.__originalSlotEls[i] && gameClient.player.equipment.slots[i]) {
        gameClient.player.equipment.slots[i].setElement(this.__originalSlotEls[i]);
        gameClient.player.equipment.slots[i].render();
      }
    }
  }

  // Restore conditions-display to original parent
  var conditionsEl = document.getElementById('conditions-display');
  if (conditionsEl && this.__originalConditionsParent) {
    this.__originalConditionsParent.appendChild(conditionsEl);
  }

  // Restore capacity-display to original parent
  var capacityEl = document.querySelector('.capacity-display');
  if (capacityEl && this.__originalCapacityParent) {
    this.__originalCapacityParent.appendChild(capacityEl);
  }

  this.__mobilePanel.remove();
  this.__mobilePanel = null;
  this.__originalSlotEls = null;
  this.__originalConditionsParent = null;
  this.__originalCapacityParent = null;
};

MobileFullscreen.prototype.__saveRepositionPosition = function (element, storageKey) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      x: element.offsetLeft,
      y: element.offsetTop
    }));
  } catch(e) {}
};

MobileFullscreen.prototype.__enableRepositionDrag = function (element, storageKey, opts) {
  var self = this;
  var timer = null;
  var drag = null;

  try {
    var saved = localStorage.getItem(storageKey);
    if (saved) {
      var p = JSON.parse(saved);
      element.style.left = p.x + 'px';
      element.style.top = p.y + 'px';
      element.style.right = '';
      element.style.bottom = '';
    }
  } catch(e) {}

  function cancelTimer() { if (timer) { clearTimeout(timer); timer = null; } }
  function exitMode() {
    self.__repositioning = null;
    element.classList.remove('reposition-mode');
    if (opts && opts.onEnd) opts.onEnd(element);
  }

  element.addEventListener('touchstart', function (e) {
    if (self.__repositioning === element) {
      var t = e.changedTouches[0];
      drag = {
        startX: t.clientX, startY: t.clientY,
        startLeft: element.offsetLeft, startTop: element.offsetTop
      };
      element.style.transition = 'none';
      e.preventDefault();
      return;
    }
    if (self.__repositioning) return;

    timer = setTimeout(function () {
      timer = null;
      self.__repositioning = element;
      element.classList.add('reposition-mode');
      if (opts && opts.onStart) opts.onStart(element);
    }, 3000);
  }, { passive: true });

  element.addEventListener('touchmove', function (e) {
    if (self.__repositioning !== element) { cancelTimer(); return; }
    if (!drag) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - drag.startX;
    var dy = t.clientY - drag.startY;
    element.style.left = (drag.startLeft + dx) + 'px';
    element.style.top = (drag.startTop + dy) + 'px';
    e.preventDefault();
  }, { passive: false });

  element.addEventListener('touchend', function () {
    if (drag) {
      self.__saveRepositionPosition(element, storageKey);
      drag = null;
      exitMode();
      return;
    }
    cancelTimer();
  });

  element.addEventListener('touchcancel', function () {
    cancelTimer();
    drag = null;
    exitMode();
  });
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
    // Uniform culling: 6.5 tiles pre-render outside each viewport edge
    renderer.__cullMarginLeft = 14;
    renderer.__cullMarginRight = 14;
    renderer.__cullMarginTop = 14;
    renderer.__cullMarginBottom = 14;
    // Bg cache: 2 more tiles than foreground for scroll safety
    renderer.__bgCullMarginLeft = 16;
    renderer.__bgCullMarginRight = 16;
    renderer.__bgCullMarginTop = 16;
    renderer.__bgCullMarginBottom = 16;
    renderer.__bgCacheShiftX = 1;
    renderer.__bgCacheShiftY = 1;
    renderer.__tileCacheNeedsRebuild = true;

    // Recreate bg cache canvases large enough for the 32px shift + wide culling.
    // 640 = 20 tiles × 32px — gives room for bgCullMargin=16 with shiftY=1.
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

    // Restore original bg cache canvas size
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
};

try {
  new MobileFullscreen();
  if (mobileFS && mobileFS.isMobile) {
    var checkVisible = function () { mobileFS.__checkOrientation(); };
    var checkPlayer = function () {
      mobileFS.__updateDpadVisibility();
      if (mobileFS.active && gameClient && gameClient.player) {
        mobileFS.__createMobileSlots();
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
