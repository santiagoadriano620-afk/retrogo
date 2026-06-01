const TouchController = function () {
  this.joystick = { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, direction: null, moveInterval: null };
  this.actionMode = null;
  this.longPressTimer = null;
  this.longPressTriggered = false;
  this.lastTapTime = 0;
  this.lastTapTarget = null;
  this.isInitialized = false;
  this.__initialize();
};

TouchController.prototype.JOYSTICK_DEADZONE = 15;
TouchController.prototype.JOYSTICK_MOVE_INTERVAL = 150;
TouchController.prototype.LONG_PRESS_DURATION = 500;

TouchController.prototype.__initialize = function () {
  this.joystickZone = document.getElementById('mobile-joystick-zone');
  this.joystickKnob = document.getElementById('joystick-knob');
  this.virtualJoystick = document.getElementById('virtual-joystick');
  this.lookBtn = document.getElementById('mobile-look-btn');
  this.useBtn = document.getElementById('mobile-use-btn');
  this.attackBtn = document.getElementById('mobile-attack-btn');
  this.menuBtn = document.getElementById('mobile-menu-btn');
  this.inventoryBtn = document.getElementById('mobile-inventory-btn');
  this.equipmentBtn = document.getElementById('mobile-equipment-btn');
  this.chatBtn = document.getElementById('mobile-chat-btn');
  this.healthBar = document.getElementById('mobile-health-bar');
  this.healthText = document.getElementById('mobile-health-text');
  this.manaBar = document.getElementById('mobile-mana-bar');
  this.manaText = document.getElementById('mobile-mana-text');

  if (!this.joystickZone) { this.isInitialized = false; return; }
  this.isInitialized = true;

  this.joystickZone.addEventListener('touchstart', this.__handleJoystickStart.bind(this), { passive: false });
  this.joystickZone.addEventListener('touchmove', this.__handleJoystickMove.bind(this), { passive: false });
  this.joystickZone.addEventListener('touchend', this.__handleJoystickEnd.bind(this), { passive: false });
  this.joystickZone.addEventListener('touchcancel', this.__handleJoystickEnd.bind(this), { passive: false });

  if (this.lookBtn) this.lookBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.__setActionMode('look'); });
  if (this.useBtn) this.useBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.__setActionMode('use'); });
  if (this.attackBtn) this.attackBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.__toggleAttack(); });
  if (this.menuBtn) this.menuBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.__openMenu(); });
  if (this.inventoryBtn) this.inventoryBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.__openInventory(); });
  if (this.equipmentBtn) this.equipmentBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.__toggleEquipment(); });
  if (this.chatBtn) this.chatBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.__toggleChat(); });

  this.__bindHotbarSlots();
  this.__bindCanvasTouchEvents();
  this.__bindGlobalEvents();
  this.__bindContainerSlotDoubleTap();

  if (window.gameClient && window.gameClient.player) {
    const s = window.gameClient.player.state;
    this.updateStatusBars(s.health || 0, s.maxHealth || 1, s.mana || 0, s.maxMana || 1);
  }
};

TouchController.prototype.destroy = function () {
  if (this.joystick.moveInterval) { clearInterval(this.joystick.moveInterval); this.joystick.moveInterval = null; }
  this.actionMode = null;
  this.isInitialized = false;
};

TouchController.prototype.updateStatusBars = function (health, maxHealth, mana, maxMana) {
  if (!this.isInitialized) return;
  const hpPct = maxHealth > 0 ? Math.round((health / maxHealth) * 100) : 0;
  const mpPct = maxMana > 0 ? Math.round((mana / maxMana) * 100) : 0;
  if (this.healthBar) this.healthBar.style.width = hpPct + '%';
  if (this.healthText) this.healthText.textContent = health + ' / ' + maxHealth;
  if (this.manaBar) this.manaBar.style.width = mpPct + '%';
  if (this.manaText) this.manaText.textContent = mana + ' / ' + maxMana;
};

TouchController.prototype.__handleJoystickStart = function (e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = this.joystickZone.getBoundingClientRect();
  this.joystick.active = true;
  this.joystick.startX = rect.left + rect.width / 2;
  this.joystick.startY = rect.top + rect.height / 2;
  this.joystick.currentX = touch.clientX;
  this.joystick.currentY = touch.clientY;
  this.__updateJoystickKnob();
  this.__startMoveInterval();
};

TouchController.prototype.__handleJoystickMove = function (e) {
  e.preventDefault();
  if (!this.joystick.active) return;
  this.joystick.currentX = e.touches[0].clientX;
  this.joystick.currentY = e.touches[0].clientY;
  this.__updateJoystickKnob();
};

TouchController.prototype.__handleJoystickEnd = function (e) {
  e.preventDefault();
  this.joystick.active = false;
  if (this.joystick.moveInterval) { clearInterval(this.joystick.moveInterval); this.joystick.moveInterval = null; }
  this.joystick.direction = null;
  if (this.joystickKnob) this.joystickKnob.style.transform = 'translate(0, 0)';
};

TouchController.prototype.__updateJoystickKnob = function () {
  const dx = this.joystick.currentX - this.joystick.startX;
  const dy = this.joystick.currentY - this.joystick.startY;
  const maxDist = this.joystickZone ? this.joystickZone.offsetWidth * 0.35 : 30;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const clampedDist = Math.min(dist, maxDist);
  const angle = Math.atan2(dy, dx);
  const knobX = Math.cos(angle) * clampedDist;
  const knobY = Math.sin(angle) * clampedDist;

  if (this.joystickKnob) this.joystickKnob.style.transform = 'translate(' + knobX + 'px, ' + knobY + 'px)';

  if (dist < this.JOYSTICK_DEADZONE) { this.joystick.direction = null; return; }
  if (Math.abs(dx) > Math.abs(dy)) this.joystick.direction = dx > 0 ? 'east' : 'west';
  else this.joystick.direction = dy > 0 ? 'south' : 'north';
};

TouchController.prototype.__startMoveInterval = function () {
  if (this.joystick.moveInterval) clearInterval(this.joystick.moveInterval);
  this.joystick.moveInterval = setInterval(this.__executeMove.bind(this), this.JOYSTICK_MOVE_INTERVAL);
};

TouchController.prototype.__executeMove = function () {
  if (!this.joystick.direction || !window.gameClient || !window.gameClient.player) return;
  window.gameClient.player.turnAndStep(this.joystick.direction);
};

TouchController.prototype.__setActionMode = function (mode) {
  this.actionMode = this.actionMode === mode ? null : mode;
  this.__clearActionButtonHighlights();
  if (this.actionMode) {
    const btn = this.actionMode === 'look' ? this.lookBtn : this.useBtn;
    if (btn) btn.style.filter = 'brightness(1.5)';
  }
};

TouchController.prototype.__clearActionButtonHighlights = function () {
  [this.lookBtn, this.useBtn].forEach(btn => { if (btn) btn.style.filter = ''; });
};

TouchController.prototype.__toggleAttack = function () {
  if (!window.gameClient || !window.gameClient.player) return;
  const target = window.gameClient.player.attackTarget;
  if (target) window.gameClient.player.stopAttack();
  else if (window.gameClient.interface && window.gameClient.interface.menuManager) {
    window.gameClient.interface.menuManager.openContextMenu('attack');
  }
};

TouchController.prototype.__openMenu = function () {
  if (window.gameClient && window.gameClient.interface) {
    window.gameClient.interface.modalManager.open('settings-modal');
  }
};

TouchController.prototype.__openInventory = function () {
  if (!window.gameClient || !window.gameClient.player) return;
  window.gameClient.player.openOwnBackpack();
};

TouchController.prototype.__toggleEquipment = function () {
  const wrapper = document.querySelector('.equipment.wrapper');
  if (wrapper) wrapper.classList.toggle('minimized');
};

TouchController.prototype.__toggleChat = function () {
  const lower = document.querySelector('#game-wrapper .lower');
  if (lower) lower.classList.toggle('mobile-chat-active');
};

TouchController.prototype.__bindHotbarSlots = function () {
  document.querySelectorAll('.mobile-hotbar-slot').forEach(function (slot) {
    slot.addEventListener('touchstart', function (e) {
      e.preventDefault();
      const slotIndex = parseInt(slot.dataset.slot);
      if (isNaN(slotIndex)) return;
      if (window.gameClient && window.gameClient.interface && window.gameClient.interface.hotbarManager) {
        window.gameClient.interface.hotbarManager.useSlot(slotIndex);
      }
    }, { passive: false });
  });
};

TouchController.prototype.__bindCanvasTouchEvents = function () {
  const canvas = document.getElementById('screen');
  if (!canvas) return;
  canvas.addEventListener('touchstart', this.__handleCanvasTouchStart.bind(this), { passive: false });
  canvas.addEventListener('touchend', this.__handleCanvasTouchEnd.bind(this), { passive: false });
  canvas.addEventListener('touchmove', this.__handleCanvasTouchMove.bind(this), { passive: false });
};

TouchController.prototype.__handleCanvasTouchStart = function (e) {
  if (!window.gameClient || !window.gameClient.networkManager || !window.gameClient.networkManager.isConnected()) return;
  e.preventDefault();
  const touch = e.changedTouches[0];
  const pos = this.__getCanvasPosition(touch);

  if (this.actionMode === 'look') {
    window.gameClient.networkManager.sendLookAt(pos);
    this.actionMode = null;
    this.__clearActionButtonHighlights();
    return;
  }
  if (this.actionMode === 'use') {
    window.gameClient.networkManager.sendUse(pos);
    this.actionMode = null;
    this.__clearActionButtonHighlights();
    return;
  }

  this.longPressTriggered = false;
  this.longPressTimer = setTimeout(function () {
    this.longPressTriggered = true;
    if (window.gameClient.interface && window.gameClient.interface.menuManager) {
      window.gameClient.interface.menuManager.openContextMenu(pos);
    }
  }.bind(this), this.LONG_PRESS_DURATION);
};

TouchController.prototype.__handleCanvasTouchEnd = function (e) {
  if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }
  if (this.longPressTriggered) { this.longPressTriggered = false; return; }
  if (!window.gameClient || !window.gameClient.networkManager || !window.gameClient.networkManager.isConnected()) return;

  const touch = e.changedTouches[0];
  const pos = this.__getCanvasPosition(touch);

  const now = Date.now();
  if (now - this.lastTapTime < 300 && this.lastTapTarget && this.__positionsEqual(this.lastTapTarget, pos)) {
    window.gameClient.networkManager.sendDoubleClick(pos);
    this.lastTapTime = 0;
    this.lastTapTarget = null;
    return;
  }
  this.lastTapTime = now;
  this.lastTapTarget = pos;
  window.gameClient.networkManager.sendClick(pos);
};

TouchController.prototype.__handleCanvasTouchMove = function (e) {
  if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }
  e.preventDefault();
};

TouchController.prototype.__getCanvasPosition = function (touch) {
  const canvas = document.getElementById('screen');
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const x = (touch.clientX - rect.left) / rect.width;
  const y = (touch.clientY - rect.top) / rect.height;
  return { x: Math.round(x * canvas.width), y: Math.round(y * canvas.height) };
};

TouchController.prototype.__positionsEqual = function (a, b) {
  return a && b && a.x === b.x && a.y === b.y;
};

TouchController.prototype.__bindGlobalEvents = function () {
  document.querySelectorAll('.slot').forEach(function (slot) {
    slot.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
  });
};

TouchController.prototype.__bindContainerSlotDoubleTap = function () {
  let lastSlotTap = null;
  document.addEventListener('touchstart', function (e) {
    const slot = e.target.closest('.slot');
    if (!slot || slot.closest('.equipment')) return;
    const now = Date.now();
    if (lastSlotTap && now - lastSlotTap.time < 300 && lastSlotTap.slot === slot) {
      const containerIndex = slot.closest('[containerIndex]');
      if (containerIndex) {
        const idx = parseInt(containerIndex.getAttribute('containerIndex'));
        const slotIndex = parseInt(slot.getAttribute('slotIndex'));
        if (!isNaN(idx) && !isNaN(slotIndex) && window.gameClient && window.gameClient.player) {
          window.gameClient.player.moveContainerItemToBackpack(idx, slotIndex);
        }
      }
      lastSlotTap = null;
      return;
    }
    lastSlotTap = { slot: slot, time: now };
  }, { passive: true });
};
