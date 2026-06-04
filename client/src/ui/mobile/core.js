var mobileFS = null;

MobileFullscreen = function () {
  this.isMobile = this.__detectMobile();
  this.active = false;
  this.button = null;
  this.dpad = null;
  this.dpadWrapper = null;
  this.dpadTouchId = null;
  this.dpadDirection = null;
  this.dpadKey = null;
  this.DPAD_SIZE = 120;
  this.DPAD_DEAD_ZONE = 18;
  this.__lastTapTime = 0;
  this.__lastTapX = 0;
  this.__lastTapY = 0;
  this.__lockStates = {};
  this.__actionbarEl = null;
  this.__actionbarSlots = [null, null, null, null, null, null, null, null];
  this.__actionbarCanvases = [];
  this.__actionbarHighlight = -1;
  this.__tapSlotIndex = -1;
  this.__actionBtnsEl = null;
  this.__lookMode = false;
  this.__chatInputEl = null;

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

MobileFullscreen.prototype.__saveModuleState = function (element, moduleName) {
  try {
    var posKey = 'retrogo_' + moduleName + '_pos';
    var lockKey = 'retrogo_' + moduleName + '_lock';
    localStorage.setItem(posKey, JSON.stringify({
      x: element.offsetLeft,
      y: element.offsetTop
    }));
    localStorage.setItem(lockKey, JSON.stringify(this.__lockStates[moduleName]));
  } catch(e) {}
};

MobileFullscreen.prototype.__enableLockableDrag = function (element, moduleName, opts) {
  var self = this;
  var drag = null;
  var posKey = 'retrogo_' + moduleName + '_pos';
  var lockKey = 'retrogo_' + moduleName + '_lock';

  try {
    var saved = localStorage.getItem(posKey);
    if (saved) {
      var p = JSON.parse(saved);
      element.style.left = p.x + 'px';
      element.style.top = p.y + 'px';
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    }
  } catch(e) {}

  var locked = true;
  try {
    var savedLock = localStorage.getItem(lockKey);
    if (savedLock !== null) locked = JSON.parse(savedLock);
  } catch(e) {}
  self.__lockStates[moduleName] = locked;

  var icon = document.createElement('div');
  icon.className = 'module-lock-icon' + (locked ? ' locked' : ' unlocked');
  element.appendChild(icon);

  var iconClicked = false;

  function toggleLock() {
    if (iconClicked) return;
    iconClicked = true;
    locked = !locked;
    self.__lockStates[moduleName] = locked;
    icon.className = 'module-lock-icon' + (locked ? ' locked' : ' unlocked');
    self.__saveModuleState(element, moduleName);
    setTimeout(function () { iconClicked = false; }, 200);
  }

  icon.addEventListener('touchstart', function (e) {
    e.stopPropagation();
    e.preventDefault();
    toggleLock();
  }, { passive: false });

  icon.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleLock();
  });

  element.addEventListener('touchstart', function (e) {
    if (locked) return;
    var t = e.changedTouches[0];
    drag = {
      startX: t.clientX, startY: t.clientY,
      startLeft: element.offsetLeft, startTop: element.offsetTop
    };
    if (opts && opts.onDragStart) opts.onDragStart();
    e.preventDefault();
  });

  element.addEventListener('touchmove', function (e) {
    if (!drag) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - drag.startX;
    var dy = t.clientY - drag.startY;
    element.style.left = (drag.startLeft + dx) + 'px';
    element.style.top = (drag.startTop + dy) + 'px';
    element.style.right = 'auto';
    element.style.bottom = 'auto';
    e.preventDefault();
  });

  element.addEventListener('touchend', function () {
    if (drag) {
      self.__saveModuleState(element, moduleName);
      if (opts && opts.onDragEnd) opts.onDragEnd();
      drag = null;
    }
  });

  element.addEventListener('touchcancel', function () {
    drag = null;
  });
};

MobileFullscreen.prototype.__isFullscreenActive = function () {
  return this.active || !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
};
