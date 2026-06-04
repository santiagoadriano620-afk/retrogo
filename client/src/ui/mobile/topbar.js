MobileFullscreen.prototype.__createTopbar = function () {
  if (this.__topbarEl || !window.gameClient || !window.gameClient.player) return;
  var self = this;
  var wrapper = document.getElementById('canvas-id');
  if (!wrapper) return;

  if (getComputedStyle(wrapper).position === 'static') {
    wrapper.style.position = 'relative';
  }

  var topbar = document.createElement('div');
  topbar.id = 'mobile-topbar';
  topbar.style.cssText =
    'position:absolute;left:0;right:0;top:0;height:14px;' +
    'z-index:100;display:flex;align-items:center;justify-content:space-between;' +
    'pointer-events:none;background:rgba(10,10,15,0.55);';

  var left = document.createElement('div');
  left.style.cssText = 'display:flex;align-items:center;gap:2px;padding-left:3px;flex-shrink:0;';

  var hpBar = document.createElement('div');
  hpBar.style.cssText = 'width:48px;height:8px;position:relative;' +
    'background-image:url("/images/game/healthmana/hitpoints_manapoints_bar_border.png");' +
    'background-size:100% 100%;';
  var hpFill = document.createElement('div');
  hpFill.className = 'mobile-hp-fill';
  hpFill.style.cssText = 'width:100%;height:100%;' +
    'background-image:url("/images/game/healthmana/hitpoints_bar_filled.png");' +
    'background-size:100% 100%;';
  hpBar.appendChild(hpFill);
  left.appendChild(hpBar);
  var hpVal = document.createElement('span');
  hpVal.className = 'mobile-hp-value';
  hpVal.style.cssText = 'color:#e06060;font-size:8px;font-weight:bold;width:18px;text-align:right;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;';
  hpVal.textContent = '0';
  left.appendChild(hpVal);

  var mpBar = document.createElement('div');
  mpBar.style.cssText = 'width:48px;height:8px;position:relative;margin-left:2px;' +
    'background-image:url("/images/game/healthmana/hitpoints_manapoints_bar_border.png");' +
    'background-size:100% 100%;';
  var mpFill = document.createElement('div');
  mpFill.className = 'mobile-mp-fill';
  mpFill.style.cssText = 'width:100%;height:100%;' +
    'background-image:url("/images/game/healthmana/mana_bar_filled.png");' +
    'background-size:100% 100%;';
  mpBar.appendChild(mpFill);
  left.appendChild(mpBar);
  var mpVal = document.createElement('span');
  mpVal.className = 'mobile-mp-value';
  mpVal.style.cssText = 'color:#6060e0;font-size:8px;font-weight:bold;width:18px;text-align:right;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;';
  mpVal.textContent = '0';
  left.appendChild(mpVal);

  topbar.appendChild(left);

  var right = document.createElement('div');
  right.style.cssText = 'display:flex;align-items:center;gap:3px;padding-right:3px;';
  var fpsEl = document.createElement('span');
  fpsEl.className = 'topbar-fps';
  fpsEl.style.cssText = 'color:#aaa;font-size:7px;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;';
  fpsEl.textContent = 'FPS:0';
  var pingEl = document.createElement('span');
  pingEl.className = 'topbar-ping';
  pingEl.style.cssText = 'color:#aaa;font-size:7px;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;';
  pingEl.textContent = 'Ping:0ms';
  right.appendChild(fpsEl);
  right.appendChild(pingEl);

  topbar.appendChild(right);
  wrapper.appendChild(topbar);
  this.__topbarEl = topbar;

  var windowIds = ['skill-window', 'battle-window', 'friend-window', 'party-window', 'quest-tracker-window'];
  this.__windowOrigParents = {};
  windowIds.forEach(function (id) {
    var el = document.getElementById(id);
    if (el && el.parentNode) {
      self.__windowOrigParents[id] = el.parentNode;
      document.body.appendChild(el);
    }
  });

  var intf = window.gameClient && window.gameClient.interface;
  var wm = intf && intf.windowManager;
  if (wm && !wm.__mobileFS_overridden) {
    this.__origGetFreeStack = wm.getFreeStack;
    this.__origGetStack = wm.getStack.bind(wm);
    wm.__mobileFS_overridden = true;
    wm.getFreeStack = function () { return document.body; };
    var self3 = this;
    wm.getStack = function (name) {
      if (name === 'right' || name === 'extra') return document.body;
      return self3.__origGetStack(name);
    };
  }

  function setupWindowDrag(win) {
    if (!win || win.__dragSetup) return;
    win.__dragSetup = true;
    var header = win.querySelector('.header');
    if (!header) return;
    header.style.touchAction = 'none';
    header.addEventListener('touchstart', function (e) {
      if (e.target.closest('button')) return;
      var touch = e.changedTouches[0];
      var rect = win.getBoundingClientRect();
      self.__winDrag = {
        el: win,
        startX: touch.clientX, startY: touch.clientY,
        startLeft: rect.left, startTop: rect.top
      };
      e.preventDefault();
    });
  }

  self.__winDrag = null;
  try {
    var savedPos = JSON.parse(localStorage.getItem('retrogo_window_positions') || '{}');
    windowIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (savedPos[id]) {
        el.style.left = savedPos[id].x + 'px';
        el.style.top = savedPos[id].y + 'px';
        el.style.right = 'auto';
      }
      setupWindowDrag(el);
    });
  } catch(e) {}

  self.__containerObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        if (n.nodeType === 1) {
          if (n.matches && n.matches('.window[containerIndex]')) {
            setupWindowDrag(n);
          }
          if (n.querySelectorAll) {
            n.querySelectorAll('.window[containerIndex]').forEach(setupWindowDrag);
          }
        }
      });
    });
  });
  self.__containerObserver.observe(document.body, { childList: true, subtree: true });

  self.__winDragMove = function (e) {
    if (!self.__winDrag) return;
    var touch = e.changedTouches[0];
    var dx = touch.clientX - self.__winDrag.startX;
    var dy = touch.clientY - self.__winDrag.startY;
    if (self.__winDrag.el) {
      self.__winDrag.el.style.left = (self.__winDrag.startLeft + dx) + 'px';
      self.__winDrag.el.style.top = (self.__winDrag.startTop + dy) + 'px';
      self.__winDrag.el.style.right = 'auto';
      e.preventDefault();
    }
  };

  self.__winDragEnd = function () {
    if (!self.__winDrag) return;
    try {
      var saved = JSON.parse(localStorage.getItem('retrogo_window_positions') || '{}');
      if (self.__winDrag.el) {
        var key = self.__winDrag.el.id || self.__winDrag.el.getAttribute('containerIndex') || 'win';
        saved[key] = { x: self.__winDrag.el.offsetLeft, y: self.__winDrag.el.offsetTop };
        localStorage.setItem('retrogo_window_positions', JSON.stringify(saved));
      }
    } catch(ex) {}
    self.__winDrag = null;
  };

  document.addEventListener('touchmove', self.__winDragMove, { passive: false });
  document.addEventListener('touchend', self.__winDragEnd);

  if (Player.prototype.__updateMobileStatusBars !== this.__origUpdateBars) {
    this.__origUpdateBars = Player.prototype.__updateMobileStatusBars;
  }
  Player.prototype.__updateMobileStatusBars = function () {
    var tb = document.getElementById('mobile-topbar');
    if (!tb) return;
    var hf = tb.querySelector('.mobile-hp-fill');
    var hv = tb.querySelector('.mobile-hp-value');
    var mf = tb.querySelector('.mobile-mp-fill');
    var mv = tb.querySelector('.mobile-mp-value');
    if (hf) hf.style.width = ((this.state.health / this.state.maxHealth) * 100).clamp(0, 100) + '%';
    if (hv) hv.textContent = this.state.health || 0;
    if (mf) mf.style.width = ((this.state.mana / this.state.maxMana) * 100).clamp(0, 100) + '%';
    if (mv) mv.textContent = this.state.mana || 0;
  };

  this.__topbarTimer = setInterval(function () {
    var tb = document.getElementById('mobile-topbar');
    if (!tb) return;
    var fps = tb.querySelector('.topbar-fps');
    var ping = tb.querySelector('.topbar-ping');
    if (fps && window.gameClient && window.gameClient.renderer && window.gameClient.renderer.debugger) {
      fps.textContent = 'FPS:' + (window.gameClient.renderer.debugger.__averageFPS || '0');
    }
    if (ping && window.gameClient && window.gameClient.networkManager) {
      ping.textContent = 'Ping:' + (Math.round(window.gameClient.networkManager.state.latency) || 0) + 'ms';
    }
  }, 1000);

  if (window.gameClient && window.gameClient.player) {
    window.gameClient.player.__updateMobileStatusBars();
  }
};

MobileFullscreen.prototype.__destroyTopbar = function () {
  if (this.__topbarTimer) {
    clearInterval(this.__topbarTimer);
    this.__topbarTimer = null;
  }
  if (this.__topbarEl) {
    this.__topbarEl.parentNode.removeChild(this.__topbarEl);
    this.__topbarEl = null;
  }
  if (this.__windowOrigParents) {
    Object.keys(this.__windowOrigParents).forEach(function (id) {
      var el = document.getElementById(id);
      var parent = this.__windowOrigParents[id];
      if (el && parent && parent !== document.body && el.parentNode !== parent) {
        parent.appendChild(el);
      }
    }, this);
    this.__windowOrigParents = null;
  }
  var intf = window.gameClient && window.gameClient.interface;
  var wm = intf && intf.windowManager;
  if (wm && wm.__mobileFS_overridden && this.__origGetFreeStack) {
    wm.getFreeStack = this.__origGetFreeStack;
    wm.getStack = this.__origGetStack;
    wm.__mobileFS_overridden = false;
    this.__origGetFreeStack = null;
    this.__origGetStack = null;
  }
  if (this.__origUpdateBars) {
    Player.prototype.__updateMobileStatusBars = this.__origUpdateBars;
    this.__origUpdateBars = null;
  }
  if (this.__winDragMove) {
    document.removeEventListener('touchmove', this.__winDragMove);
    document.removeEventListener('touchend', this.__winDragEnd);
    this.__winDragMove = null;
    this.__winDragEnd = null;
    this.__winDrag = null;
  }
  if (this.__containerObserver) {
    this.__containerObserver.disconnect();
    this.__containerObserver = null;
  }
};
