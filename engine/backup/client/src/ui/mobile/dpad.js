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

MobileFullscreen.prototype.__createDpad = function () {
  var wrapper = document.createElement('div');
  wrapper.id = 'mobile-dpad-wrapper';
  var el = document.createElement('div');
  el.id = 'mobile-dpad';
  el.innerHTML =
    '<span class="dpad-arrow up">&#9650;</span>' +
    '<span class="dpad-arrow down">&#9660;</span>' +
    '<span class="dpad-arrow left">&#9664;</span>' +
    '<span class="dpad-arrow right">&#9654;</span>' +
    '<div class="dpad-ball"></div>';
  wrapper.appendChild(el);
  document.body.appendChild(wrapper);
  this.dpad = el;
  this.dpadWrapper = wrapper;

  var self = this;
  var diagBtn = document.createElement('div');
  diagBtn.className = 'dpad-diagonal-btn';
  diagBtn.innerHTML =
    '<span class="ddi nw">&#8598;</span>' +
    '<span class="ddi ne">&#8599;</span>' +
    '<span class="ddi sw">&#8601;</span>' +
    '<span class="ddi se">&#8600;</span>';
  diagBtn.classList.toggle('on', this.__dpadDiagonalMode);
  wrapper.appendChild(diagBtn);

  function toggleDiag(e) {
    e.stopPropagation();
    e.preventDefault();
    self.__dpadDiagonalMode = !self.__dpadDiagonalMode;
    diagBtn.classList.toggle('on', self.__dpadDiagonalMode);
    try { localStorage.setItem('retrogo_dpad_diagonal', JSON.stringify(self.__dpadDiagonalMode)); } catch(e2) {}
  }

  diagBtn.addEventListener('touchstart', toggleDiag, { passive: false });
  diagBtn.addEventListener('click', toggleDiag);

  this.__bindDpadEvents(el);
  this.__enableLockableDrag(wrapper, 'dpad', { onDragStart: function () {}, onDragEnd: function () {} });
};

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
    if (self.__lockStates.dpad === false) return;
    e.preventDefault();
    var t = e.changedTouches[0];
    handleStart(t.clientX, t.clientY, t.identifier);
  });

  el.addEventListener('touchmove', function (e) {
    if (self.__lockStates.dpad === false) return;
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
    if (self.__lockStates.dpad === false) return;
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === self.dpadTouchId) {
        handleEnd();
        break;
      }
    }
  });

  el.addEventListener('touchcancel', function (e) {
    if (self.__lockStates.dpad === false) return;
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

  var maxBallOffset = 18;
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

  var finalDir = sector.dir;

  // If diagonal mode is off, snap diagonals to nearest cardinal
  if (!this.__dpadDiagonalMode) {
    var dirVal = finalDir;
    if (dirVal === CONST.DIRECTION.NORTHEAST) {
      finalDir = (Math.abs(dx) >= Math.abs(dy)) ? CONST.DIRECTION.EAST : CONST.DIRECTION.NORTH;
    } else if (dirVal === CONST.DIRECTION.SOUTHEAST) {
      finalDir = (Math.abs(dx) >= Math.abs(dy)) ? CONST.DIRECTION.EAST : CONST.DIRECTION.SOUTH;
    } else if (dirVal === CONST.DIRECTION.SOUTHWEST) {
      finalDir = (Math.abs(dx) >= Math.abs(dy)) ? CONST.DIRECTION.WEST : CONST.DIRECTION.SOUTH;
    } else if (dirVal === CONST.DIRECTION.NORTHWEST) {
      finalDir = (Math.abs(dx) >= Math.abs(dy)) ? CONST.DIRECTION.WEST : CONST.DIRECTION.NORTH;
    }
  }

  this.dpadDirection = finalDir;
  this.__dpadUpdateBall(angleRad, dist);
  // Activate the arrow indicator for the original sector (visual only)
  if (sector.arrow) {
    var arrowEl = this.dpad.querySelector('.dpad-arrow.' + sector.arrow);
    if (arrowEl) arrowEl.classList.add('active');
  }

  if (this.dpadKey !== null && DPAD_GET_KEY(finalDir) !== this.dpadKey) {
    this.__dpadReleaseKey();
  }
  if (this.dpadKey === null) {
    this.__dpadPressKey(finalDir);
  }
};

MobileFullscreen.prototype.__updateDpadVisibility = function () {
  if (!this.dpadWrapper) return;
  var show = this.active && window.gameClient && window.gameClient.player;
  this.dpadWrapper.classList.toggle('visible', show);
};

MobileFullscreen.prototype.__hideDpad = function () {
  if (!this.dpadWrapper) return;
  this.dpadWrapper.classList.remove('visible');
  this.dpadTouchId = null;
  this.dpadDirection = null;
  this.__dpadResetBall();
  var arrows = this.dpad.querySelectorAll('.dpad-arrow');
  for (var i = 0; i < arrows.length; i++) arrows[i].classList.remove('active');
};
