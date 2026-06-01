const GamepadManager = function () {
  this.gamepadIndex = null;
  this.running = false;
  this.rafId = null;
  this.prevButtons = {};
  this.focusManager = null;
  this.hintEl = null;
  this.hintTimeout = null;
};

GamepadManager.prototype.start = function () {
  this.running = true;
  this.focusManager = window.TVFocusManager ? new TVFocusManager() : null;
  if (this.focusManager) this.focusManager.init();

  window.addEventListener('gamepadconnected', this.__onConnect.bind(this));
  window.addEventListener('gamepaddisconnected', this.__onDisconnect.bind(this));

  this.hintEl = document.createElement('div');
  this.hintEl.className = 'tv-hint';
  this.hintEl.textContent = 'Use o direcional para navegar, A para confirmar, B para voltar';
  document.body.appendChild(this.hintEl);
  this.__showHint();

  this.__poll();
};

GamepadManager.prototype.stop = function () {
  this.running = false;
  if (this.rafId) cancelAnimationFrame(this.rafId);
  if (this.focusManager) this.focusManager.destroy();
  if (this.hintEl) this.hintEl.remove();
  window.removeEventListener('gamepadconnected', this.__onConnect.bind(this));
  window.removeEventListener('gamepaddisconnected', this.__onDisconnect.bind(this));
};

GamepadManager.prototype.__onConnect = function (e) {
  this.gamepadIndex = e.gamepad.index;
  this.__showHint('Controle conectado!');
};

GamepadManager.prototype.__onDisconnect = function () {
  this.gamepadIndex = null;
  this.__showHint('Controle desconectado.');
};

GamepadManager.prototype.__showHint = function (msg) {
  if (!this.hintEl) return;
  if (msg) this.hintEl.textContent = msg;
  this.hintEl.style.display = 'block';
  clearTimeout(this.hintTimeout);
  this.hintTimeout = setTimeout(() => { if (this.hintEl) this.hintEl.style.display = 'none'; }, 4000);
};

GamepadManager.prototype.__getConnectedGamepad = function () {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  if (this.gamepadIndex !== null && gamepads[this.gamepadIndex]) return gamepads[this.gamepadIndex];
  for (const gp of gamepads) {
    if (gp) { this.gamepadIndex = gp.index; return gp; }
  }
  return null;
};

GamepadManager.prototype.__poll = function () {
  if (!this.running) return;
  this.rafId = requestAnimationFrame(this.__poll.bind(this));

  const gp = this.__getConnectedGamepad();
  if (!gp || !this.focusManager) return;

  const buttons = gp.buttons.map(b => b.pressed);
  const axes = gp.axes;

  if (!this.prevButtons[gp.index]) this.prevButtons[gp.index] = buttons.slice();

  const prev = this.prevButtons[gp.index];

  if (buttons[12] && !prev[12]) this.focusManager.focusUp();
  if (buttons[13] && !prev[13]) this.focusManager.focusDown();
  if (buttons[14] && !prev[14]) this.focusManager.focusLeft();
  if (buttons[15] && !prev[15]) this.focusManager.focusRight();

  if (buttons[0] && !prev[0]) this.focusManager.confirm();
  if (buttons[1] && !prev[1]) this.focusManager.back();
  if (buttons[9] && !prev[9]) this.focusManager.back();

  if (buttons[8] && !prev[8]) this.focusManager.activate();

  if (Math.abs(axes[0]) > 0.5 || Math.abs(axes[1]) > 0.5) {
    if (!this.__lastAxisTime || Date.now() - this.__lastAxisTime > 250) {
      if (axes[1] < -0.5) this.focusManager.focusUp();
      else if (axes[1] > 0.5) this.focusManager.focusDown();
      else if (axes[0] < -0.5) this.focusManager.focusLeft();
      else if (axes[0] > 0.5) this.focusManager.focusRight();
      this.__lastAxisTime = Date.now();
    }
  }

  this.prevButtons[gp.index] = buttons.slice();
};
