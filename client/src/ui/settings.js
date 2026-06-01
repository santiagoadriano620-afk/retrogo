const Settings = function (element) {

  /*
   * Class Settings
   * Container for all the settings
   *
   * API:
   *
   * @Settings.isWeatherEnabled() - returns true when the weather is enabled
   * @Settings.isSoundEnabled() - returns true when sound is enabled
   * @Settings.saveState() - Saves state to local storage
   * @Settings.clear() - Clears state from local storage
   *
   */

  // Set the volume slider callback function
  document.getElementById("volume-slider").oninput = this.setVolume;
  document.getElementById("volume-slider-value").innerHTML = document.getElementById("volume-slider").value + "%";

  document.getElementById("anti-aliasing").addEventListener("change", this.__setAA);
  document.getElementById("fps-vsync").addEventListener("change", this.__setFPSMode.bind(this));
  document.getElementById("fps-limit").addEventListener("input", this.__setFPSMode.bind(this));
  document.getElementById("fullscreen-button").addEventListener("click", this.__toggleFullscreen);
  document.getElementById("show-fps").addEventListener("change", this.__toggle.bind(this));
  document.getElementById("show-ping").addEventListener("change", this.__toggle.bind(this));

  this.__init();

  // Apply state to the DOM to keep it in sync
  Object.keys(this.__state).forEach(this.__applyState.bind(this));

}

Settings.prototype.__toggleFullscreen = function () {
  gameClient.interface.requestFullScreen();
}

Settings.prototype.__setAA = function () {

  if (this.checked) {
    gameClient.renderer.screen.canvas.style.imageRendering = "auto";
  } else {
    gameClient.renderer.screen.canvas.style.imageRendering = "pixelated";
  }

}

Settings.prototype.__setFPSMode = function () {

  /*
   * Function Settings.__setFPSMode
   * Sets the FPS mode from VSync checkbox and FPS slider
   */

  let useVSync = document.getElementById("fps-vsync").checked;
  let fpsSlider = document.getElementById("fps-limit");
  let fps = parseInt(fpsSlider.value);

  // Update displayed FPS value
  document.getElementById("fps-limit-value").textContent = fps.toString();

  if (useVSync) {
    gameClient.gameLoop.setFPSMode(60);
    gameClient.gameLoop.__useVSync = true;
  } else {
    gameClient.gameLoop.setFPSMode(fps);
    gameClient.gameLoop.__useVSync = false;
  }

  // Save FPS mode to localStorage
  this.__saveConfig();

}

Settings.prototype.setVolume = function () {

  /*
   * Function Settings.setVolume
   * Sets the application master volume
   */

  // Update the value with a fraction
  gameClient.interface.soundManager.setMasterVolume(Number(this.value) / 100);
  document.getElementById("volume-slider-value").innerHTML = Number(this.value) + "%";

}

Settings.prototype.clear = function () {

  /*
   * Class Settings.clear
   * Clears local storage from the settings
   */

  localStorage.removeItem("settings");

}

Settings.prototype.isSoundEnabled = function () {

  /*
   * Class Settings.isSoundEnabled
   * Returns true if sound is enabled
   */

  return this.__state["enable-sound"];

}

Settings.prototype.isWeatherEnabled = function () {

  /*
   * Class Settings.isWeatherEnabled
   * Returns true if the weather is enabled
   */

  return this.__state["enable-weather"];

}

Settings.prototype.isLightingEnabled = function () {

  /*
   * Function Settings.isLightingEnabled
   * Lighting is always enabled
   */

  return true;

}

Settings.prototype.saveState = function () {

  /*
   * Function Settings.saveState
   * Saves the settings state to localstorage (should be called when the screen is closed)
   */

  localStorage.setItem("settings", JSON.stringify(this.__state));

}

Settings.prototype.__toggle = function (event) {

  /*
   * Function Settings.__toggle
   * Sets a setting to a new state that needs to be saved
   */

  // Set state to DOM
  switch (event.target.id) {
    case "enable-weather":
      this.__state[event.target.id] = event.target.checked;
      this.__applyWeather(event.target.checked);
      break;
    case "enable-sound":
      this.__state[event.target.id] = event.target.checked;
      gameClient.interface.soundManager.enableSound(event.target.checked);
      break;
    case "fps-vsync":
      this.__state[event.target.id] = event.target.checked;
      break;
    case "show-fps":
    case "show-ping":
      this.__state[event.target.id] = event.target.checked;
      break;
    case "fps-limit":
      this.__state[event.target.id] = event.target.value;
      break;
    default:
      return;
  }

  this.saveState();

}

Settings.prototype.__init = function () {

  /*
   * Function Settings.__init
   * Returns the settings state from local storage
   */

  // Fetch settings from storage
  let state = localStorage.getItem("settings");

  // No settings stored in local storage
  if (state === null) {
    return this.__state = this.__getCleanState();
  }

  // Load settings from
  this.__state = JSON.parse(state);
  this.__update();

}

Settings.prototype.__update = function () {

  /*
   * Function Settings.__update
   * Updates non-existant settings with what is inside the DOM
   */

  let cleanState = this.__getCleanState();

  // Add new settings
  Object.keys(cleanState).forEach(function (key) {
    if (!this.__state.hasOwnProperty(key)) {
      this.__state[key] = cleanState[key];
    }
  }, this);

  // Drop removed settings
  Object.keys(this.__state).forEach(function (key) {
    if (!cleanState.hasOwnProperty(key)) {
      delete this.__state[key];
    }
  }, this);

}

Settings.prototype.__getCleanState = function () {

  /*
   * Function Settings.__getCleanState
   * Returns the clean state by checking what is currently set in the DOM
   */

  return new Object({
    "enable-sound": document.getElementById("enable-sound").checked,
    "enable-weather": document.getElementById("enable-weather").checked,
    "show-fps": false,
    "show-ping": false,
    "fps-vsync": document.getElementById("fps-vsync").checked,
    "fps-limit": document.getElementById("fps-limit").value
  });

}

Settings.prototype.__applyState = function (id) {

  /*
   * Function Settings.__applyState
   * Adds event listeners to all the settings
   */

  let element = document.getElementById(id);

  if (!element) {
    return;
  }

  element.addEventListener("change", this.__toggle.bind(this));

  // Set DOM to state
  switch (id) {
    case "enable-weather":
      element.checked = this.__state[id];
      this.__applyWeather(this.__state[id]);
      break;
    case "enable-sound":
    case "show-fps":
    case "show-ping":
    case "fps-vsync":
      element.checked = this.__state[id];
      break;
    case "fps-limit":
      element.value = this.__state[id];
      document.getElementById("fps-limit-value").textContent = this.__state[id];
      break;
    default:
      return;
  }

}

Settings.prototype.__applyWeather = function (enabled) {
  if (typeof gameClient !== 'undefined' && gameClient && gameClient.renderer) {
    if (enabled) {
      gameClient.renderer.weatherCanvas.setWeather(0.8);
    } else {
      gameClient.renderer.weatherCanvas.setWeather(0);
      gameClient.renderer.weatherCanvas.__ambientAlpha = 0;
      gameClient.renderer.weatherCanvas.__ambientAlphaTarget = 0;
      gameClient.renderer.screen.setGlobalAlpha(1);
    }
  }
};

Settings.prototype.__saveConfig = function () {

  this.__state["fps-vsync"] = document.getElementById("fps-vsync").checked;
  this.__state["fps-limit"] = document.getElementById("fps-limit").value;
  this.saveState();

}
