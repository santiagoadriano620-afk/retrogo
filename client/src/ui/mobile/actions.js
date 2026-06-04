MobileFullscreen.prototype.__createActionButtons = function () {
  if (this.__actionBtnsEl || !window.gameClient || !window.gameClient.player) return;

  var self = this;
  var container = document.createElement('div');
  container.id = 'mobile-action-btns';
  container.style.display = 'flex';

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

      container.appendChild(btn);
    })(buttons[i]);
  }

  document.body.appendChild(container);
  this.__actionBtnsEl = container;

  if (!localStorage.getItem('retrogo_actionBtns_pos')) {
    container.style.left = Math.round((window.innerWidth - 160) / 2) + 'px';
    container.style.bottom = '56px';
    container.style.transform = 'none';
  }

  this.__enableLockableDrag(container, 'actionBtns', { onDragStart: function () {}, onDragEnd: function () {} });
};

MobileFullscreen.prototype.__destroyActionButtons = function () {
  if (!this.__actionBtnsEl) return;
  this.__saveModuleState(this.__actionBtnsEl, 'actionBtns');
  if (this.__chatInputEl) {
    this.__chatInputEl.remove();
    this.__chatInputEl = null;
  }
  this.__actionBtnsEl.remove();
  this.__actionBtnsEl = null;
  this.__lookMode = false;
};

MobileFullscreen.prototype.__handleLookTap = function () {
  this.__lookMode = !this.__lookMode;
  if (!this.__actionBtnsEl) return;
  var lookBtn = this.__actionBtnsEl.querySelector('.action-btn.eye');
  if (lookBtn) lookBtn.classList.toggle('active', this.__lookMode);
};

MobileFullscreen.prototype.__handleAttackTap = function () {
  if (!window.gameClient || !window.gameClient.player) return;
  var player = window.gameClient.player;
  if (player.__target) {
    player.setTarget(null);
    if (window.gameClient.send) window.gameClient.send(new TargetPacket(0));
  }
};

MobileFullscreen.prototype.__handleBackpackTap = function () {
  if (!window.gameClient || !window.gameClient.player || !window.gameClient.mouse) return;
  gameClient.mouse.use({ which: gameClient.player.equipment, index: 6 });
};

MobileFullscreen.prototype.__handleChatTap = function () {
  if (!window.gameClient || !window.gameClient.player) return;

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
    if (window.gameClient && window.gameClient.send) {
      window.gameClient.send(new ChannelMessagePacket(0, 1, msg));
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
