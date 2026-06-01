const TVLayout = {
  isActive: false,
  gamepadManager: null,
  focusManager: null,

  activate() {
    this.isActive = true;
    this.gamepadManager = new GamepadManager();
    this.gamepadManager.start();
    this.focusManager = new TVFocusManager();
    this.focusManager.init();
  },

  deactivate() {
    this.isActive = false;
    if (this.gamepadManager) {
      this.gamepadManager.stop();
      this.gamepadManager = null;
    }
    if (this.focusManager) {
      this.focusManager.destroy();
      this.focusManager = null;
    }
  },

  getScale() {
    const baseScale = (window.visualViewport.width - 350) / 1080;
    const hScale = (window.visualViewport.height - 188) / 482;
    return Math.max(1, Math.min(baseScale, hScale));
  },

  getScaledDimensions() {
    const s = this.getScale();
    return { width: 1080 * s, height: 482 * s, scale: s };
  }
};

const TVFocusManager = function () {
  this.focusableSelector = 'button, .slot, .window, .hotbar-item, .mobile-hotbar-slot, .mobile-action-btn, input, select';
  this.focusableElements = [];
  this.currentFocusIndex = -1;
  this.isActive = false;
};

TVFocusManager.prototype.init = function () {
  this.isActive = true;
  this.refresh();
  document.addEventListener('focusableChange', this.refresh.bind(this));
};

TVFocusManager.prototype.destroy = function () {
  this.isActive = false;
  document.removeEventListener('focusableChange', this.refresh.bind(this));
};

TVFocusManager.prototype.refresh = function () {
  if (!this.isActive) return;
  this.focusableElements = Array.from(document.querySelectorAll(this.focusableSelector))
    .filter(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    })
    .sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      if (Math.abs(rectA.top - rectB.top) < 10) return rectA.left - rectB.left;
      return rectA.top - rectB.top;
    });
};

TVFocusManager.prototype.focusNext = function () {
  if (this.focusableElements.length === 0) return;
  this.currentFocusIndex = (this.currentFocusIndex + 1) % this.focusableElements.length;
  this.focusableElements[this.currentFocusIndex].focus();
};

TVFocusManager.prototype.focusPrev = function () {
  if (this.focusableElements.length === 0) return;
  this.currentFocusIndex = (this.currentFocusIndex - 1 + this.focusableElements.length) % this.focusableElements.length;
  this.focusableElements[this.currentFocusIndex].focus();
};

TVFocusManager.prototype.focusUp = function () {
  if (this.focusableElements.length === 0 || this.currentFocusIndex < 0) return;
  const current = this.focusableElements[this.currentFocusIndex];
  const rect = current.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;

  const candidates = this.focusableElements
    .map((el, i) => ({ el, i, rect: el.getBoundingClientRect() }))
    .filter(({ rect: r }) => r.bottom <= rect.top && Math.abs((r.left + r.width / 2) - centerX) < 100);

  if (candidates.length === 0) return;
  const closest = candidates.reduce((a, b) => a.rect.bottom > b.rect.bottom ? a : b);
  this.currentFocusIndex = closest.i;
  closest.el.focus();
};

TVFocusManager.prototype.focusDown = function () {
  if (this.focusableElements.length === 0 || this.currentFocusIndex < 0) return;
  const current = this.focusableElements[this.currentFocusIndex];
  const rect = current.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;

  const candidates = this.focusableElements
    .map((el, i) => ({ el, i, rect: el.getBoundingClientRect() }))
    .filter(({ rect: r }) => r.top >= rect.bottom && Math.abs((r.left + r.width / 2) - centerX) < 100);

  if (candidates.length === 0) return;
  const closest = candidates.reduce((a, b) => a.rect.top < b.rect.top ? a : b);
  this.currentFocusIndex = closest.i;
  closest.el.focus();
};

TVFocusManager.prototype.focusLeft = function () {
  if (this.focusableElements.length === 0 || this.currentFocusIndex < 0) return;
  const current = this.focusableElements[this.currentFocusIndex];
  const rect = current.getBoundingClientRect();
  const centerY = rect.top + rect.height / 2;

  const candidates = this.focusableElements
    .map((el, i) => ({ el, i, rect: el.getBoundingClientRect() }))
    .filter(({ rect: r }) => r.right <= rect.left && Math.abs((r.top + r.height / 2) - centerY) < 50);

  if (candidates.length === 0) return;
  const closest = candidates.reduce((a, b) => a.rect.right > b.rect.right ? a : b);
  this.currentFocusIndex = closest.i;
  closest.el.focus();
};

TVFocusManager.prototype.focusRight = function () {
  if (this.focusableElements.length === 0 || this.currentFocusIndex < 0) return;
  const current = this.focusableElements[this.currentFocusIndex];
  const rect = current.getBoundingClientRect();
  const centerY = rect.top + rect.height / 2;

  const candidates = this.focusableElements
    .map((el, i) => ({ el, i, rect: el.getBoundingClientRect() }))
    .filter(({ rect: r }) => r.left >= rect.right && Math.abs((r.top + r.height / 2) - centerY) < 50);

  if (candidates.length === 0) return;
  const closest = candidates.reduce((a, b) => a.rect.left < b.rect.left ? a : b);
  this.currentFocusIndex = closest.i;
  closest.el.focus();
};

TVFocusManager.prototype.activate = function () {
  if (this.focusableElements.length > 0) {
    this.currentFocusIndex = 0;
    this.focusableElements[0].focus();
  }
};

TVFocusManager.prototype.confirm = function () {
  if (this.currentFocusIndex >= 0 && this.currentFocusIndex < this.focusableElements.length) {
    const el = this.focusableElements[this.currentFocusIndex];
    el.click();
  }
};

TVFocusManager.prototype.back = function () {
  const closeBtns = document.querySelectorAll('[action="cancel"], .close-button, .close-button-transparent');
  for (const btn of closeBtns) {
    if (btn.offsetParent !== null) { btn.click(); return; }
  }
  if (document.getElementById('logout-button') && document.getElementById('logout-button').offsetParent !== null) {
    document.getElementById('logout-button').click();
  }
};
