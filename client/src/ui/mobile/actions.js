MobileFullscreen.prototype.__createActionButtons = function () {
  if (this.__actionBtnsEl || !gameClient || !gameClient.player) return;

  var self = this;
  var isPremium = gameClient.player.isPremium;
  var hotkeyCount = isPremium ? 8 : 4;
  var rowsOf4 = Math.ceil(hotkeyCount / 4);

  var container = document.createElement('div');
  container.id = 'mobile-action-btns';
  container.style.cssText = 'display:flex;flex-direction:column;gap:2px;align-items:center;';

  // Load hotkey messages
  this.__hotkeyMessages = [];
  var saved = localStorage.getItem('retrogo_hotkey_msgs');
  var msgs = saved ? JSON.parse(saved) : [];
  // Pad to hotkeyCount
  for (var p = 0; p < hotkeyCount; p++) {
    this.__hotkeyMessages[p] = (msgs[p] !== undefined) ? msgs[p] : '';
  }

  function createHotkeyBtn(idx) {
    var btn = document.createElement('div');
    btn.className = 'action-btn hotkey-btn';
    btn.dataset.hkIdx = idx;

    var span = document.createElement('span');
    span.className = 'action-icon';
    span.textContent = self.__hotkeyMessages[idx] ? self.__hotkeyMessages[idx].charAt(0).toUpperCase() : '...';
    btn.appendChild(span);

    var label = document.createElement('span');
    label.className = 'hk-label';
    label.textContent = self.__hotkeyMessages[idx] || '...';
    btn.appendChild(label);

    var pressTimer = null;
    var longPressed = false;

    btn.addEventListener('touchstart', function (e) {
      if (self.__lockStates.actionBtns === false) return;
      e.preventDefault();
      longPressed = false;
      pressTimer = setTimeout(function () {
        longPressed = true;
        self.__openHotkeyEditor(idx);
      }, 500);
    }, { passive: false });

    btn.addEventListener('touchend', function (e) {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      if (self.__lockStates.actionBtns === false) return;
      if (!longPressed) {
        var msg = self.__hotkeyMessages[idx];
        if (msg) {
          if (gameClient && gameClient.send) {
            gameClient.send(new ChannelMessagePacket(0, 1, msg));
          }
        } else {
          self.__openHotkeyEditor(idx);
        }
      }
    });

    btn.addEventListener('touchmove', function () {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    });

    return btn;
  }

  // Create rows of 4 hotkey buttons
  for (var r = 0; r < rowsOf4; r++) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:2px;';
    for (var c = 0; c < 4; c++) {
      var idx = r * 4 + c;
      if (idx >= hotkeyCount) break;
      row.appendChild(createHotkeyBtn(idx));
    }
    container.appendChild(row);
  }

  // Action buttons row (Eye, Swords, Backpack, Chat)
  var actionRow = document.createElement('div');
  actionRow.style.cssText = 'display:flex;gap:2px;';

  var buttons = [
    { id: 'look-btn', cls: 'eye', icon: 'eye', handler: function () { self.__handleLookTap(); } },
    { id: 'attack-btn', cls: 'swords', icon: 'swords', handler: function () { self.__handleAttackTap(); } },
    { id: 'backpack-btn', cls: 'backpack', icon: 'backpack', handler: function () { self.__handleBackpackTap(); } },
    { id: 'chat-btn', cls: 'chat', icon: 'chat', handler: function () { self.__handleChatTap(); } }
  ];

  var emojiMap = { eye: '\u{1F441}', swords: '\u{2694}', backpack: '\u{1F392}', chat: '\u{1F4AC}' };

  for (var i = 0; i < buttons.length; i++) {
    (function (b) {
      var btn = document.createElement('div');
      btn.className = 'action-btn ' + b.cls;

      var span = document.createElement('span');
      span.className = 'action-icon';
      span.textContent = emojiMap[b.icon] || '?';
      btn.appendChild(span);

      btn.addEventListener('touchstart', function (e) {
        if (self.__lockStates.actionBtns === false) return;
        e.preventDefault();
        b.handler();
      }, { passive: false });

      actionRow.appendChild(btn);
    })(buttons[i]);
  }

  container.appendChild(actionRow);

  document.body.appendChild(container);
  this.__actionBtnsEl = container;

  if (!localStorage.getItem('retrogo_actionBtns_pos')) {
    container.style.left = Math.round((window.innerWidth - 160) / 2) + 'px';
    container.style.bottom = '56px';
    container.style.transform = 'none';
  }

  this.__enableLockableDrag(container, 'actionBtns', { onDragStart: function () {}, onDragEnd: function () {} });
};

MobileFullscreen.prototype.__openHotkeyEditor = function (idx) {

  /*
   * Function MobileFullscreen.__openHotkeyEditor
   * Opens a small inline input near the hotkey button to edit its message
   */

  if (this.__hotkeyEditorEl) {
    this.__hotkeyEditorEl.remove();
    this.__hotkeyEditorEl = null;
  }

  var self = this;
  var btn = this.__actionBtnsEl.querySelector('.hotkey-btn[data-hk-idx="' + idx + '"]');
  if (!btn) return;

  var rect = btn.getBoundingClientRect();
  var el = document.createElement('div');
  el.id = 'hotkey-edit-' + idx;
  el.style.cssText = [
    'position:fixed',
    'z-index:2147483647',
    'background:rgba(10,10,15,0.95)',
    'border:1px solid rgba(200,180,50,0.6)',
    'border-radius:4px',
    'padding:3px 5px',
    'display:flex',
    'align-items:center',
    'gap:3px',
    'box-sizing:border-box'
  ].join(';');

  // Position centered on screen
  el.style.left = '50%';
  el.style.top = '50%';
  el.style.transform = 'translate(-50%, -50%)';
  el.style.width = '260px';

  var input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 255;
  input.value = self.__hotkeyMessages[idx] || '';
  input.placeholder = 'Type message...';
  input.style.cssText = [
    'flex:1',
    'height:24px',
    'background:rgba(30,30,40,0.85)',
    'border:1px solid rgba(120,120,140,0.4)',
    'border-radius:3px',
    'color:#d3d3d3',
    'font-size:12px',
    'padding:0 5px',
    'outline:none'
  ].join(';');

  function save() {
    var val = input.value.trim();
    if (val === '' && self.__hotkeyMessages[idx]) {
      // Allow clearing by saving empty
    }
    self.__hotkeyMessages[idx] = val;
    localStorage.setItem('retrogo_hotkey_msgs', JSON.stringify(self.__hotkeyMessages));
    self.__refreshHotkeyButton(idx);
    if (self.__hotkeyEditorEl) {
      self.__hotkeyEditorEl.remove();
      self.__hotkeyEditorEl = null;
    }
  }

  input.addEventListener('keydown', function (e) {
    if (e.keyCode === 13) save();
    if (e.keyCode === 27) {
      if (self.__hotkeyEditorEl) {
        self.__hotkeyEditorEl.remove();
        self.__hotkeyEditorEl = null;
      }
    }
  });

  var okBtn = document.createElement('button');
  okBtn.textContent = '\u2713';
  okBtn.style.cssText = 'width:24px;height:24px;background:#4a7a3a;border:1px solid #5a9a4a;border-radius:3px;color:#fff;font-size:13px;cursor:pointer;touch-action:manipulation;padding:0;line-height:24px;text-align:center;';
  okBtn.addEventListener('touchstart', function (e) { e.preventDefault(); save(); }, { passive: false });

  el.appendChild(input);
  el.appendChild(okBtn);
  document.body.appendChild(el);
  this.__hotkeyEditorEl = el;

  setTimeout(function () { input.focus(); input.select(); }, 100);
};

MobileFullscreen.prototype.__refreshHotkeyButton = function (idx) {

  /*
   * Function MobileFullscreen.__refreshHotkeyButton
   * Updates the displayed icon and label for a hotkey button
   */

  var btn = this.__actionBtnsEl.querySelector('.hotkey-btn[data-hk-idx="' + idx + '"]');
  if (!btn) return;

  var msg = this.__hotkeyMessages[idx] || '';
  var icon = btn.querySelector('.action-icon');
  var label = btn.querySelector('.hk-label');
  if (icon) icon.textContent = msg ? msg.charAt(0).toUpperCase() : '...';
  if (label) label.textContent = msg || '...';
};

MobileFullscreen.prototype.__destroyActionButtons = function () {
  if (!this.__actionBtnsEl) return;
  this.__saveModuleState(this.__actionBtnsEl, 'actionBtns');
  if (this.__chatInputEl) {
    this.__chatInputEl.remove();
    this.__chatInputEl = null;
  }
  if (this.__hotkeyEditorEl) {
    this.__hotkeyEditorEl.remove();
    this.__hotkeyEditorEl = null;
  }
  this.__actionBtnsEl.remove();
  this.__actionBtnsEl = null;
  this.__hotkeyMessages = null;
  this.__lookMode = false;
};

MobileFullscreen.prototype.__handleLookTap = function () {
  this.__lookMode = !this.__lookMode;
  if (!this.__actionBtnsEl) return;
  var lookBtn = this.__actionBtnsEl.querySelector('.action-btn.eye');
  if (lookBtn) lookBtn.classList.toggle('active', this.__lookMode);
};

MobileFullscreen.prototype.__handleAttackTap = function () {
  if (!gameClient || !gameClient.player) return;
  var player = gameClient.player;
  if (player.__target) {
    player.setTarget(null);
    if (gameClient.send) gameClient.send(new TargetPacket(0));
  }
};

MobileFullscreen.prototype.__handleBackpackTap = function () {
  if (!gameClient || !gameClient.player || !gameClient.mouse) return;
  var equip = gameClient.player.equipment;
  var slot = equip && equip.slots && equip.slots[6];
  var item = slot && slot.item;
  if (item && item.__openContainerId != null) {
    gameClient.player.__openedContainers.forEach(function (c) {
      if (c.__containerId === item.__openContainerId) {
        gameClient.player.removeContainer(c);
      }
    });
  } else {
    gameClient.mouse.use({ which: equip, index: 6 });
  }
};

MobileFullscreen.prototype.__handleChatTap = function () {
  if (!gameClient || !gameClient.player) return;

  if (this.__chatInputEl) {
    this.__chatInputEl.remove();
    this.__chatInputEl = null;
    return;
  }

  var canvas = document.getElementById('canvas-id');
  var cw = canvas ? canvas.offsetWidth : 480;
  var ox = this.__canvasOffsetX || Math.round((window.innerWidth - cw) / 2);
  var bottomY = this.__canvasOffsetY ? (this.__canvasOffsetY + canvas.offsetHeight) : (window.innerHeight - 100);

  var self = this;
  var el = document.createElement('div');
  el.id = 'mobile-chat-input';
  el.style.cssText = 'display:flex;position:fixed;z-index:2147483647;background:rgba(10,10,15,0.92);border:1px solid rgba(150,150,150,0.3);border-radius:3px;padding:4px 6px;align-items:center;gap:4px;box-sizing:border-box;';
  el.style.left = ox + 'px';
  el.style.width = cw + 'px';
  el.style.top = (bottomY - 44) + 'px';

  var input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 255;
  input.placeholder = 'Say...';
  input.style.cssText = 'flex:1;height:26px;background:rgba(30,30,40,0.85);border:1px solid rgba(120,120,140,0.4);border-radius:3px;color:#d3d3d3;font-size:13px;padding:0 6px;outline:none;';

  var sendBtn = document.createElement('button');
  sendBtn.textContent = 'Send';
  sendBtn.style.cssText = 'width:40px;height:26px;background:#4a7a3a;border:1px solid #5a9a4a;border-radius:3px;color:#fff;font-size:11px;font-weight:bold;cursor:pointer;touch-action:manipulation;';

  function sendMessage() {
    var msg = input.value.trim();
    if (msg === '') return;
    if (gameClient && gameClient.send) {
      gameClient.send(new ChannelMessagePacket(0, 1, msg));
    }
    input.value = '';
  }

  input.addEventListener('keydown', function (e) {
    if (e.keyCode === 13) sendMessage();
  });

  sendBtn.addEventListener('touchstart', function (e) { e.preventDefault(); sendMessage(); }, { passive: false });
  sendBtn.addEventListener('click', sendMessage);

  el.appendChild(input);
  el.appendChild(sendBtn);
  document.body.appendChild(el);
  this.__chatInputEl = el;

  this.__enableLockableDrag(el, 'chatInput', { onDragStart: function () {}, onDragEnd: function () {} });
  var lockIcon = el.querySelector('.module-lock-icon');
  if (lockIcon) {
    lockIcon.style.cssText = lockIcon.style.cssText +
      'left:auto !important;right:2px !important;top:-14px !important;';
  }

  setTimeout(function () { input.focus(); }, 150);
};
