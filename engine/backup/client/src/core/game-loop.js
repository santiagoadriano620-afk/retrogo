const GameLoop = function (frameCallback) {

  /*
   * Class GameLoop
   * Wrapper for the game loop that executes as fast as possible allowed by the client
   *
   * API:
   *
   * GameLoop.isRunning() - returns true if the game loop is running
   * GameLoop.init() - initializes the game loop
   * GameLoop.abort() - aborts the game loop
   * GameLoop.setFPSMode(mode) - sets the FPS mode (60, 120, or 0 for unlimited)
   *
   */

  // Callback fired every frame
  this.__frameCallback = frameCallback;

  // State
  this.__frame = 0;
  this.__running = false;
  this.__aborted = false;
  this.__initialized = null;

  // FPS control
  this.__targetFPS = 60;
  this.__lastFrameTime = 0;
  this.__frameInterval = 1000 / 60; // ms per frame for 60fps
  this.__useVSync = true;

}

GameLoop.prototype.getCurrentFrame = function () {

  return this.__frame;

}

GameLoop.prototype.isRunning = function () {

  return this.__running;

}

GameLoop.prototype.useVSync = function () {

  return this.__useVSync;

}

GameLoop.prototype.setFPSMode = function (targetFPS) {

  this.__targetFPS = parseInt(targetFPS);

  if (this.__targetFPS > 0) {
    this.__frameInterval = 1000 / this.__targetFPS;
  } else {
    this.__frameInterval = 0;
  }

}

GameLoop.prototype.getFPSMode = function () {

  return this.__targetFPS;

}

GameLoop.prototype.init = function () {

  if (this.isRunning()) {
    return;
  }

  this.__initialized = performance.now();
  this.__lastFrameTime = performance.now();

  this.__aborted = false;
  this.__running = true;

  this.__loop();

}

GameLoop.prototype.abort = function () {

  this.__aborted = true;
  this.__running = false;

}

GameLoop.prototype.__loop = function () {

  if (this.__aborted) {
    return;
  }

  let now = performance.now();
  let elapsed = now - this.__lastFrameTime;

  // VSync mode: use requestAnimationFrame
  if (this.__useVSync) {
    this.__frame++;
    this.__lastFrameTime = now;
    this.__frameCallback();
    requestAnimationFrame(this.__loop.bind(this));
    return;
  }

  // Capped FPS mode: only run if enough time has elapsed
  if (elapsed >= this.__frameInterval) {
    this.__frame++;
    this.__lastFrameTime = now - (elapsed % this.__frameInterval);
    this.__frameCallback();
  }

  // Use setTimeout for capped FPS modes
  setTimeout(this.__loop.bind(this), 0);

}
