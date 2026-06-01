const Debugger = function() {

  /*
   * Class Debugger
   * Container for debugging information visible when pressing F8
   *
   * API:
   *
   * @Debugger.renderStatistics - renders the statistics to the screen
   * @Debugger.toggleStatistics - toggles visibility of statistics on/off
   * @Debugger.UPDATE_INTERVAL - constant that determines how often the statistics are updated (unit is frames)
   *
   */

   // Debugger state
  this.__showStatistics = false;
  this.__nFrames = 0;
  this.__averageFPS = 0;
  this.__averageEvictions = 0;
  this.__averageDrawCalls = 0;
  this.__averageDrawTime = 0;
  this.__averageFlushes = 0;
  this.__averageBatchQuads = 0;
  this.__averageTexUploads = 0;
  this.__nSeconds = performance.now();

  // Per-phase timing averages (updated every UPDATE_INTERVAL frames)
  this.__avgTimingEventQueue = 0;
  this.__avgTimingSound = 0;
  this.__avgTimingKeyboard = 0;
  this.__avgTimingRender = 0;
  this.__avgTimingTotal = 0;

  // Information on the GPU
  this.__GPU = this.__getGPUInformation();

}

// How often the statistics are updated
Debugger.prototype.UPDATE_INTERVAL = 60;

Debugger.prototype.isActive = function() {

  /*
   * Function Debugger.isActive
   * Returns true if the debugger is active
   */

  return this.__showStatistics;

}

Debugger.prototype.renderStatistics = function() {

  if(!this.isActive()) return;

  this.__nFrames++;

  // Refresh averages every 60 frames
  if (this.__shouldUpdate()) {
    this.__updateAverageStatistics();
  }

  // Throttle DOM update to every 3 frames (~35fps) to avoid browser reflow spikes
  if (this.__nFrames % 3 === 0) {
    this.__renderStatistics();
  }

}

Debugger.prototype.__renderStatistics = function() {

  let gc = gameClient;
  let ft = gc.__frameTimes;
  let log = gc.__stutterLog;
  let ftLen = ft.length;
  let last = ftLen > 0 ? ft[ftLen - 1] : 0;
  let recent = ft.slice(-30);
  let maxR = recent.length > 0 ? Math.max(...recent) : 0;
  let avgR = recent.length > 0 ? recent.reduce(function(a, v) { return a + v; }, 0) / recent.length : 0;
  let stut = 0;
  for (let i = 0; i < ftLen; i++) { if (ft[i] > 16.67) stut++; }
  let recentStut = 0;
  for (let i = 0; i < recent.length; i++) { if (recent[i] > 16.67) recentStut++; }
  let barLen = Math.min(20, Math.round(last / 2));
  let bar = new Array(barLen + 1).join("█");
  let lastStut = log.length > 0 ? log[log.length - 1] : null;
  let lastC = lastStut ? lastStut.cause : "-";

  // Build last 3 stutter entries
  let stutLines = [];
  let stStart = Math.max(0, log.length - 3);
  for (let j = log.length - 1; j >= stStart; j--) {
    let s = log[j];
    let phases = s.phases;
    let maxP = "R", maxV = parseFloat(phases.render);
    let qv = parseFloat(phases.queue);
    if (qv > maxV) { maxV = qv; maxP = "Q"; }
    let sv = parseFloat(phases.sound);
    if (sv > maxV) { maxV = sv; maxP = "S"; }
    stutLines.push("%s %sms %s".format(s.cause, s.total, maxP));
  }

  let el = document.getElementById("debug-statistics");
  if (!el) return;
  el.innerHTML = new Array(
    "═══ STUTTER (tempo real) ═══",
    "Frame: %sms%s | Avg30: %s | Max30: %s | >16ms: %s(%s)".format(
      last.toFixed(1), last > 16.67 ? " ⚠" : "",
      avgR.toFixed(1), maxR.toFixed(1), stut, recentStut),
    "▒ %s | Total: %s | Ultimo: %s".format(bar, log.length, lastC),
    stutLines.length > 0 ? "═══ ULTIMOS ═══" : "",
    stutLines.join(" | "),
    "",
    // === VERSION ===
    "═══ STATS ═══",
    "%s v%s | %s v%s".format(
      "Server", gc.serverVersion || "-",
      "Client", gc.clientVersion || "-"),
    "Tick: %sms | Frame: %s | FPS: %s".format(
      gc.getTickInterval(),
      gc.eventQueue.getFrame(),
      this.__averageFPS),
    "",
    // === WEBGL RENDER ===
    "═══ WEBGL ═══",
    "Batches: %s | Uploads: %s | Evict: %s/s".format(
      this.__averageFlushes, this.__averageTexUploads, this.__averageEvictions),
    "Draw Time: %sµs | Tiles: %s".format(
      this.__averageDrawTime, gc.renderer.numberOfTiles),
    "",
    // === FRAME TIMING ===
    "═══ TIMING (µs) ═══",
    "Queue: %s | Sound: %s | Input: %s | Render: %s".format(
      this.__avgTimingEventQueue, this.__avgTimingSound,
      this.__avgTimingKeyboard, this.__avgTimingRender),
    "",
    // === NETWORK ===
    "═══ NETWORK ═══",
    "Latency: %sms | Entities: %s".format(
      Math.round(gc.networkManager.state.latency),
      Object.keys(gc.world.activeCreatures).length),
    "",
    // === MEMORY ===
    "═══ MEMORY ═══",
    "Sprites: %sMB | Heap: %s | GPU: %s".format(
      Math.round(1E-6 * gc.spriteBuffer.size * gc.spriteBuffer.size * 4 * 32 * 32),
      this.__getMemoryUsage(), this.__GPU),
    "",
    // === PLAYER ===
    "═══ PLAYER ═══",
    "ID: %s | Pos: %s".format(gc.player.id, gc.player.getPosition().toString()),
    "Containers: %s | Moving: %s".format(
      gc.player.__openedContainers.size, gc.player.isMoving()),
    "Tile Elev: %s | Dir: %s".format(
      (gc.player.getTile() ? gc.player.getTile().__renderElevation.toFixed(4) : "?"),
      gc.player.getLookDirection())
  ).join("<br>");

}

Debugger.prototype.toggleStatistics = function() {

  /*
   * Function Debugger.toggleStatistics
   * Toggles visibility of debugging statistics on/off
   */

  // Update the state
  this.__showStatistics = !this.__showStatistics;

  // Not active: hide the statistics
  if(!this.isActive()) {
    return document.getElementById("debug-statistics").innerHTML = "";
  } else {
    return this.__renderStatistics();
  }

}

Debugger.prototype.__getGPUInformation = function() {

  /*
   * Function Debugger.__getGPUInformation
   * Returns the GPU information if available
   */

  let webgl = document.createElement("canvas").getContext("webgl");

  if (!webgl) return "WebGL unavailable";

  return webgl.getParameter(webgl.RENDERER);

}

Debugger.prototype.__updateAverageStatistics = function() {

  /*
   * Function Debugger.__updateAverageStatistics
   * Updates the state variables of the debugger
   */

   // Time elapsed since the previous update
   let elapsed = performance.now() - this.__nSeconds;

   // Calculate average statistics over the interval
   let screen = gameClient.renderer.screen;
   this.__averageEvictions = ((1E3 * gameClient.spriteBuffer.nEvictions) / elapsed).toFixed(0);
   this.__averageFPS = (1E3 * this.UPDATE_INTERVAL / elapsed).toFixed(0);
   this.__averageDrawCalls = (gameClient.renderer.drawCalls / this.UPDATE_INTERVAL).toFixed(1);
   this.__averageDrawTime = (1E3 * gameClient.renderer.totalDrawTime / this.UPDATE_INTERVAL).toFixed(0);
   this.__averageFlushes = (screen.__glFlushCount / this.UPDATE_INTERVAL).toFixed(1);
   this.__averageBatchQuads = screen.__glBatchQuads > 0 ? (screen.__glBatchQuads / Math.max(1, screen.__glFlushCount)).toFixed(0) : "0";
   this.__averageTexUploads = (screen.__glTexUploads / this.UPDATE_INTERVAL).toFixed(1);

   // Calculate per-phase averages from accumulated frame timings
   let ft = gameClient.__frameTimings;
   let fc = ft.count || 1;
   this.__avgTimingEventQueue = (ft.eventQueue / fc * 1E3).toFixed(0);
   this.__avgTimingSound = (ft.sound / fc * 1E3).toFixed(0);
   this.__avgTimingKeyboard = (ft.keyboard / fc * 1E3).toFixed(0);
   this.__avgTimingRender = (ft.render / fc * 1E3).toFixed(0);
   this.__avgTimingTotal = (ft.total / fc * 1E3).toFixed(0);

   this.__nSeconds = performance.now();

   gameClient.networkManager.getLatency();

   // Reset
   gameClient.renderer.drawCalls = 0;
   gameClient.spriteBuffer.nEvictions = 0;
   gameClient.renderer.totalDrawTime = 0;
   screen.__glFlushCount = 0;
   screen.__glBatchQuads = 0;
   screen.__glTexUploads = 0;
   ft.eventQueue = 0;
   ft.sound = 0;
   ft.keyboard = 0;
   ft.render = 0;
   ft.total = 0;
   ft.count = 0;

}

Debugger.prototype.__shouldUpdate = function() {

  /*
   * Function Debugger.__shouldUpdate
   * Returns true if the debugger should update on this frame (1 / 60)
   */

  return this.__nFrames % this.UPDATE_INTERVAL === 0;

}

Debugger.prototype.renderHUD = function() {

  let el = document.getElementById("hud-statistics");
  if (!el) {
    el = document.createElement("div");
    el.id = "hud-statistics";
    document.body.appendChild(el);
  }

  let showFPS = gameClient.interface.settings.__state["show-fps"];
  let showPing = gameClient.interface.settings.__state["show-ping"];

  if (!showFPS && !showPing) {
    el.style.display = "none";
    return;
  }

  el.style.display = "block";

  let parts = [];
  if (showFPS) {
    parts.push("FPS: " + this.__averageFPS);
  }
  if (showPing) {
    parts.push("Ping: " + Math.round(gameClient.networkManager.state.latency) + "ms");
  }

  el.innerHTML = parts.join("<br>");

}

Debugger.prototype.__getMemoryUsage = function() {

  /*
   * Function Debugger.getMemoryUsage
   * Returns the number of bytes used in memory (MB) - may not be supported by a browser
   */

  try {
    return (1E-6 * performance.memory.totalJSHeapSize).toFixed(0) + "MB";
  } catch(exception) {
    return "Metric Not Available";
  }

}

