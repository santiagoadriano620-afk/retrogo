MobileFullscreen.prototype.__createTopbar = function () {
  if (this.__topbarEl || !gameClient || !gameClient.player) return;
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

  var intf = gameClient && gameClient.interface;
  var wm = intf && intf.windowManager;
  if (wm && !wm.__mobileFS_overridden) {
    wm.__mobileFS_overridden = true;

    // Keep windows from being moved back to hidden .oogwrap
    self.__origGetFreeStack = wm.getFreeStack;
    self.__origGetStack = wm.getStack.bind(wm);
    wm.getFreeStack = function () { return document.body; };
    wm.getStack = function (name) {
      if (name === 'right' || name === 'extra') return document.body;
      return self.__origGetStack(name);
    };

    // Wrap Container.createDOM to skip stack capacity (no extraWrapper crash)
    self.__origContainerCreateDOM = Container.prototype.createDOM;
    Container.prototype.createDOM = function (title, items, itemId) {
      var element = document.createElement('div');
      element.className = 'window';
      element.style.cssText = 'display:flex;flex-direction:column;width:155px;';
      element.setAttribute('containerIndex', this.__containerId);
      var header = document.createElement('div');
      header.className = 'header';
      header.style.cssText = 'display:flex;align-items:center;gap:2px;height:20px;flex-shrink:0;';
      var icon = document.createElement('span');
      icon.className = 'window-icon bag';
      icon.style.cssText = 'width:12px;height:12px;flex:0 0 auto;';
      header.appendChild(icon);
      var titleEl = document.createElement('span');
      titleEl.className = 'title';
      titleEl.style.cssText = 'flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;pointer-events:auto;';
      header.appendChild(titleEl);
      ['back','minimize','close'].forEach(function (a) {
        var btn = document.createElement('button');
        btn.className = 'container-btn';
        btn.setAttribute('action', a);
        btn.textContent = a === 'back' ? '\u25C0' : a === 'minimize' ? '_' : 'X';
        btn.style.cssText = 'flex:0 0 auto;background:none;border:none;color:#ccc;cursor:pointer;font-size:10px;padding:0 4px;';
        header.appendChild(btn);
      });
      element.appendChild(header);
      var body = document.createElement('div');
      body.className = 'body';
      body.style.cssText = 'display:flex;flex-wrap:wrap;gap:1px;padding:2px;overflow-y:auto;flex:1;';
      element.appendChild(body);
      var footer = document.createElement('div');
      footer.className = 'footer';
      footer.style.cssText = 'height:4px;flex-shrink:0;';
      element.appendChild(footer);
      this.window = new InteractiveWindow(element);
      gameClient.interface.windowManager.register(this.window);
      document.body.appendChild(element);
      Container._addContent(this, element, title, items, itemId);
    };
  }

  function setupWindowDrag(win) {
    if (!win || win.__dragSetup) return;
    win.__dragSetup = true;
    var header = win.querySelector('.header');
    if (!header) return;
    header.style.touchAction = 'none';
    header.style.pointerEvents = 'auto';
    header.addEventListener('touchstart', function (e) {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      var touch = e.changedTouches[0];
      var startX = touch.clientX;
      var startY = touch.clientY;
      var startLeft = win.getBoundingClientRect().left;
      var startTop = win.getBoundingClientRect().top;
      function onMove(ev) {
        var t = ev.changedTouches[0];
        win.style.left = (startLeft + t.clientX - startX) + 'px';
        win.style.top = (startTop + t.clientY - startY) + 'px';
        win.style.right = 'auto';
        ev.preventDefault();
      }
      function onEnd(ev) {
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        document.removeEventListener('touchcancel', onEnd);
        try {
          var saved = JSON.parse(localStorage.getItem('retrogo_window_positions') || '{}');
          var key = win.id || win.getAttribute('containerIndex') || 'win';
          saved[key] = { x: win.offsetLeft, y: win.offsetTop };
          localStorage.setItem('retrogo_window_positions', JSON.stringify(saved));
        } catch(ex) {}
      }
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
      document.addEventListener('touchcancel', onEnd);
      e.preventDefault();
    });

    // Footer resize via touch
    var footer = win.querySelector('.footer');
    if (footer) {
      footer.style.touchAction = 'none';
      var resize = null;
      footer.addEventListener('touchstart', function (e) {
        resize = null;
        var body = win.querySelector('.body');
        var touch = e.changedTouches[0];
        var startY = touch.clientY;
        var startH = win.offsetHeight;
        var rect = win.getBoundingClientRect();
        var maxH = (window.visualViewport ? window.visualViewport.height : window.innerHeight) - rect.top - 4;
        if (win.hasAttribute('containerIndex') && body) {
          var naturalH = body.scrollHeight + 26;
          if (naturalH < maxH) maxH = naturalH;
        }
        resize = { el: win, startY: startY, startH: startH, maxH: maxH };
        e.preventDefault();
      });
      footer.addEventListener('touchmove', function (e) {
        if (!resize) return;
        var touch = e.changedTouches[0];
        var newH = resize.startH + (touch.clientY - resize.startY);
        resize.el.style.height = Math.max(80, Math.min(newH, resize.maxH)) + 'px';
        e.preventDefault();
      });
      footer.addEventListener('touchend', function () {
        resize = null;
      });
      footer.addEventListener('touchcancel', function () {
        resize = null;
      });
    }
  }

  // Override minimize/restore for mobile: preserve width, clear forced heights
  this.__origSetElementHidden = InteractiveWindow.prototype.setElementHidden;
  this.__origSetElementVisible = InteractiveWindow.prototype.setElementVisible;
  InteractiveWindow.prototype.setElementHidden = function () {
    // Freeze current width so window doesn't shrink when body is hidden
    this.__element.style.width = this.__element.offsetWidth + 'px';
    this.getBody().style.display = 'none';
    var f = this.getElement('.footer');
    if (f) f.style.display = 'none';
    this.__element.style.minHeight = this.HIDDEN_HEIGHT + 'px';
  };
  InteractiveWindow.prototype.setElementVisible = function () {
    this.getBody().style.display = 'flex';
    // Clear forced heights but keep the frozen width to prevent expansion
    this.getBody().style.height = '';
    this.__element.style.minHeight = '';
    var f = this.getElement('.footer');
    if (f) f.style.display = '';
  };

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

  // Mobile VIP: add "+" button to friend-window header, double-tap to remove
  (function () {
    var fw = document.getElementById('friend-window');
    if (!fw || fw.querySelector('.mobile-vip-add')) return;
    var header = fw.querySelector('.header');
    if (!header) return;
    var addBtn = document.createElement('button');
    addBtn.className = 'mobile-vip-add';
    addBtn.textContent = '+';
    addBtn.title = 'Add VIP';
    addBtn.style.cssText = 'font-size:16px;font-weight:bold;line-height:16px;padding:0 5px;';
    // Insert before the close button
    var closeBtn = header.querySelector('button[action="close"]');
    if (closeBtn) {
      header.insertBefore(addBtn, closeBtn);
    } else {
      header.appendChild(addBtn);
    }
    addBtn.addEventListener('click', function () {
      var name = prompt('Enter character name to add to VIP:');
      if (name && name.trim()) {
        name = name.trim();
        if (name === gameClient.player.name) {
          return gameClient.interface.setCancelMessage('You cannot add yourself to the VIP list.');
        }
        if (gameClient.player.friendlist.has(name)) {
          return gameClient.interface.setCancelMessage('This player is already in your VIP list.');
        }
        gameClient.send(new FriendAddPacket(name));
      }
    });
    // Override double-click on friend entries to remove instead of private chat
    var body = fw.querySelector('.body');
    if (body) {
      body.addEventListener('dblclick', function (e) {
        var entry = e.target.closest('.friend-entry');
        if (!entry) return;
        e.preventDefault();
        e.stopPropagation();
        var friend = entry.getAttribute('friend');
        if (friend && confirm('Remove ' + friend + ' from VIP?')) {
          gameClient.send(new FriendRemovePacket(friend));
          gameClient.player.friendlist.remove(friend);
        }
      });
    }
  })();

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
    if (fps && gameClient && gameClient.renderer && gameClient.renderer.debugger) {
      fps.textContent = 'FPS:' + (gameClient.renderer.debugger.__averageFPS || '0');
    }
    if (ping && gameClient && gameClient.networkManager) {
      ping.textContent = 'Ping:' + (Math.round(gameClient.networkManager.state.latency) || 0) + 'ms';
    }
  }, 1000);

  if (gameClient && gameClient.player) {
    gameClient.player.__updateMobileStatusBars();
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
  var intf = gameClient && gameClient.interface;
  var wm = intf && intf.windowManager;
  if (wm && wm.__mobileFS_overridden) {
    if (this.__origGetFreeStack) {
      wm.getFreeStack = this.__origGetFreeStack;
      wm.getStack = this.__origGetStack;
      this.__origGetFreeStack = null;
      this.__origGetStack = null;
    }
    if (this.__origContainerCreateDOM) {
      Container.prototype.createDOM = this.__origContainerCreateDOM;
      this.__origContainerCreateDOM = null;
    }
    wm.__mobileFS_overridden = false;
  }
  if (this.__origUpdateBars) {
    Player.prototype.__updateMobileStatusBars = this.__origUpdateBars;
    this.__origUpdateBars = null;
  }
  if (this.__origSetElementHidden) {
    InteractiveWindow.prototype.setElementHidden = this.__origSetElementHidden;
    this.__origSetElementHidden = null;
  }
  if (this.__origSetElementVisible) {
    InteractiveWindow.prototype.setElementVisible = this.__origSetElementVisible;
    this.__origSetElementVisible = null;
  }
  if (this.__containerObserver) {
    this.__containerObserver.disconnect();
    this.__containerObserver = null;
  }
  this.__dragWindow = null;
};
