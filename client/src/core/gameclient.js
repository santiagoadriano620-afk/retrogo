const GameClient = function () {

  /*
   * Class GameClient
   * Main container for the HTML5 RetroGo Game Client
   *
   * API:
   *
   * Function reset - resets the gameclient for a new connection
   * Function connect(host, port) - Connects the gameclient to a remote gameserver
   * Function disconnect() - Disconnects from the game server
   * Function send() - Writes a packet to the gameserver
   * Function isSelf(creature) - Returns true if the passed creature is the player
   * Function setServerData(packet) - Sets important server data to the client (e.g., world size & tick interval)
   * Function getTickInterval() - Returns the configured tick interval
   *
   */

  this.SERVER_VERSION = "740";
  this.CLIENT_VERSION = "0.0.1"

  // These are the required gameclient resources: sprites and data files that need to be selected by the user
  this.spriteBuffer = new SpriteBuffer(32);
  this.dataObjects = new ObjectBuffer();

  // Shared creature outfit atlas cache: appearanceHash → SpriteBuffer
  this.creatureAtlasCache = new Map();

  // Create a keyboard and mouse input handlers
  this.keyboard = new Keyboard();
  this.mouse = new Mouse();
  this.touch = new Touch();

  // Create a networking interface for communication with the server
  this.networkManager = new NetworkManager();

  // Class for the graphical user interface
  this.interface = new Interface();

  // This is the event scheduler that handles all scheduled events
  this.eventQueue = new EventQueue();

  // Create the gameloop with a callback function that is executed every frame
  this.gameLoop = new GameLoop(this.__loop.bind(this));

  // A reference to the player itself: null before login
  this.player = null;

  // The database that stores the minimap and game files
  this.database = new Database();

  // Set some state
  this.__tickInterval = 0;
  this.serverVersion = null;

  // Per-frame phase timing accumulator (reset every 60 frames by debugger)
  this.__frameTimings = { eventQueue: 0, sound: 0, keyboard: 0, render: 0, total: 0, count: 0 };

  // Stutter detection: rolling window of frame times and stutter event log
  this.__frameTimes = [];
  this.__stutterLog = [];
  this.__stutterLogMax = 30;

  // Load item definitions
  this.itemDefinitions = {};
  fetch("./items/definitions.json").then(response => {
    if (response.status !== 200) throw new Error("Failed to load definitions.json: HTTP " + response.status);
    return response.json();
  }).then(data => {
    this.itemDefinitions = data;
  }).catch(err => {
    console.error("[GAME] Failed to load item definitions:", err);
  });

  document.getElementById("client-version").innerHTML = this.CLIENT_VERSION;

}

GameClient.prototype.setServerData = function (packet) {

  /*
   * Function GameClient.setServerData
   * Handles event when connected to the gameserver
   */

  let serverData = packet.readServerData();

  // The server suggested client version must match the local version
  if (serverData.clientVersion !== this.spriteBuffer.getVersion() || serverData.clientVersion !== this.dataObjects.getVersion()) {
    gameClient.disconnect();
    packet.discard();
    localStorage.removeItem("Tibia.spr");
    localStorage.removeItem("Tibia.dat");
    return gameClient.interface.modalManager.open("floater-connecting", "Server version (%s) mismatch with client sprite (%s) or object (%s) data. Cache cleared. Please reload the page.".format(serverData.clientVersion, this.spriteBuffer.getVersion(), this.dataObjects.getVersion()));
  }

  // Enables features for specific versions
  this.interface.enableVersionFeatures(serverData.clientVersion);

  // Update the clock speed
  Clock.prototype.CLOCK_SPEED = serverData.clock;

  // Update the client & server version
  this.__setServerVersion(serverData.version);
  this.__setClientVersion(serverData.clientVersion);

  // Update the chunk properties
  Chunk.prototype.WIDTH = serverData.chunk.width;
  Chunk.prototype.HEIGHT = serverData.chunk.height;
  Chunk.prototype.DEPTH = serverData.chunk.depth;

  // Create the game world based on the passed properties
  this.world = new World(serverData.width, serverData.height, serverData.depth);

  // Create the renderer responsible for drawing the game screen
  this.renderer = new Renderer();

  // Set the number of miliseconds tick for the gameserver
  this.__setTickInterval(serverData.tick);

  document.getElementById("anti-aliasing").dispatchEvent(new Event('change'));

}

GameClient.prototype.getFrame = function () {

  /*
   * Function GameClient.getFrame
   * Returns the current frame of the game client (always incremented)
   */

  return this.renderer.debugger.__nFrames;

}

GameClient.prototype.isRunning = function () {

  /*
   * Function GameClient.isRunning
   * Returns true is the game loop is running
   */

  return this.gameLoop.isRunning();

}

GameClient.prototype.getTickInterval = function () {

  /*
   * Function GameClient.getTickInterval
   * Returns the set tick interval
   */

  return this.__tickInterval;

}

GameClient.prototype.getCreatureSpriteBuffer = function (creature) {

  let hash = creature.outfit.getAppearanceHash();
  let entry = this.creatureAtlasCache.get(hash);
  if (!entry) {
    let size = creature.outfit.getSpriteBufferSize(creature.outfit.getDataObject());
    entry = new SpriteBuffer(size);
    this.creatureAtlasCache.set(hash, entry);
  }
  return entry;

}

GameClient.prototype.setErrorModal = function (message) {

  /*
   * Function GameClient.setErrorModal
   * Function to reset the gameclient to the initial state ready for another server connection
   */

  this.interface.modalManager.open("floater-connecting", message);

}

GameClient.prototype.reset = function () {

  /*
   * Function GameClient.reset
   * Function to reset the gameclient to the initial state ready for another server connection
   */

  // Save settings
  this.renderer.minimap.save();
  this.interface.settings.saveState();

  // Abort the gameloop
  this.gameLoop.abort();

  // Clear the screen
  this.renderer.screen.clear();

  if (gameClient.player) {
    // Clear equipment visual state to prevent stale data on next login
    if (this.player.equipment) {
      this.player.equipment.slots.forEach(function (slot, index) {
        slot.setItem(null);
        slot.element.style.backgroundImage = "url('" + this.player.equipment.BACKGROUNDS[index] + "')";
        slot.render();
      }, this);
    }
    // Close all references to containers
    this.player.closeAllContainers();
    gameClient.player = null;
  }

  // Close all windows
  this.interface.reset();

  // Clear shared creature outfit atlas cache
  this.creatureAtlasCache.clear();

}

GameClient.prototype.connect = function (host, port) {

  /*
   * Function GameClient.connect
   * Delegates to the network manager to connect to the gameserver at host & port
   */

  if (this.networkManager.isConnected()) {
    return;
  }

  this.networkManager.connect();

}

GameClient.prototype.disconnect = function () {

  /*
   * Function GameClient.disconnect
   * Delegates to the network manager to disconnect the gameclient from the gameserver
   */

  this.networkManager.close();

}

GameClient.prototype.send = function (buffer) {

  /*
   * Public Function GameClient.send
   * Wrapping function to write a buffer to the network interface
   */

  this.networkManager.send(buffer);

}

GameClient.prototype.isSelf = function (creature) {

  /*
   * Function GameClient.isSelf
   * Returns true if the passed creature is the player
   */

  return this.player === creature;

}

GameClient.prototype.handleAcceptLogin = function (packet) {

  /*
   * Function GameClient.handleAcceptLogin
   * Handles incoming login registration: start the game client
   */

  // Show the game interface instead of the login box and close remaining modals
  this.interface.showGameInterface();
  this.interface.modalManager.close();

  // Create a new player with a particular server identifier
  this.player = new Player(packet);

  // Add the player to the game world
  this.world.createCreature(packet.id, this.player);
  this.renderer.updateTileCache();
  this.player.setAmbientSound();
  this.renderer.minimap.setRenderLayer(this.player.getPosition().z);

  // This triggers the start of the game loop
  this.gameLoop.init();

  // Apply deferred settings now that gameClient is fully initialized
  this.interface.settings.__setFPSMode();

  // Show performance statistics automatically for Admin
  if (this.player.name === "Admin") {
    this.renderer.debugger.__showStatistics = true;
  }

  // Store blessings bitmask, premium status, and update button
}

GameClient.prototype.isConnected = function () {

  return this.networkManager.isConnected();

}

GameClient.prototype.hasExtendedAnimations = function (id) {

  /*
   * Function GameClient.hasExtendedAnimations
   * Returns true if the data object has extended animations
   */

  return this.dataObjects.__version >= 1050;

}

GameClient.prototype.__setServerVersion = function (version) {


  /*
   * Function GameClient.__setServerVersion
   * Sets the server version to the passed value
   */

  this.serverVersion = version;

}

GameClient.prototype.__setClientVersion = function (version) {


  /*
   * Function GameClient.__setServerVersion
   * Sets the server version to the passed value
   */

  this.clientVersion = version;

}

GameClient.prototype.__setTickInterval = function (tick) {

  /*
   * Function GameClient.__setTickInterval
   * Sets the gameserver tick interval which is used to synchronize server and client events
   */

  this.__tickInterval = tick;

}

GameClient.prototype.__getBlessingCount = function () {
  if (!this.player) return 0;
  let mask = this.player.blessingBitmask || 0;
  let count = 0;
  for (let i = 0; i < 5; i++) {
    if (mask & (1 << i)) count++;
  }
  return count;
}

GameClient.prototype.__updateBlessingButton = function () {
  let btn = document.getElementById("blessing-btn");
  if (!btn) return;
  let count = this.__getBlessingCount();
  btn.classList.toggle("state-gold", count >= 1 && count < 5);
  btn.classList.toggle("state-green", count >= 5);
}

GameClient.prototype.__loop = function () {

  /*
   * Function GameClient.__loop
   * Main body of the internal game loop
   */

  let t0, t1, t2, t3, t4;
  t0 = performance.now();

  // Increment the frame counter and execute all scheduled events
  this.eventQueue.tick();
  t1 = performance.now();

  // Increment sound as well
  this.interface.soundManager.tick();
  t2 = performance.now();

  // Read the keyboard input
  this.keyboard.handleInput();
  t3 = performance.now();

  // Capture pre-render state for per-frame delta counters
  let batchesBefore = this.renderer.screen.__glFlushCount;
  let uploadsBefore = this.renderer.screen.__glTexUploads;
  let drawTimeBefore = this.renderer.totalDrawTime;

  // Request to render the frame
  this.renderer.render();
  t4 = performance.now();

  // Accumulate frame phase timings (reset by debugger every 60 frames)
  let ft = this.__frameTimings;
  ft.eventQueue += t1 - t0;
  ft.sound += t2 - t1;
  ft.keyboard += t3 - t2;
  ft.render += t4 - t3;
  ft.total += t4 - t0;
  ft.count++;

  // Per-frame timing and stutter detection
  let frameTime = t4 - t0;

  this.__frameTimes.push(frameTime);
  if (this.__frameTimes.length > 180) this.__frameTimes.shift();

  if (this.__frameTimes.length >= 10) {
    let sorted = [...this.__frameTimes].sort((a, b) => a - b);
    let median = sorted[Math.floor(sorted.length / 2)];

    let isStutter = frameTime > 16 || (median > 8 && frameTime > median * 1.5);

    if (isStutter) {
      let rbd = this.renderer.__renderBreakdown;
      let rTime = t4 - t3;
      let qTime = t1 - t0;
      let sTime = t2 - t1;
      let nUploads = this.renderer.screen.__glTexUploads - uploadsBefore;
      let nBatches = this.renderer.screen.__glFlushCount - batchesBefore;
      let cause = "unknown";
      if (rTime > 14) cause = "render";
      else if (qTime > 3) cause = "queue";
      else if (sTime > 3) cause = "sound";
      else if (nUploads > 3) cause = "sprite";
      else if (nBatches > 30) cause = "batches";
      let stutterEntry = {
        at: Date.now(),
        frame: this.renderer.debugger.__nFrames,
        total: frameTime.toFixed(2),
        phases: {
          queue: (qTime).toFixed(2),
          sound: (sTime).toFixed(2),
          input: (t3 - t2).toFixed(2),
          render: (rTime).toFixed(2),
        },
        median: median.toFixed(2),
        tiles: this.renderer.numberOfTiles || 0,
        entities: Object.keys(this.world.activeCreatures).length,
        batches: nBatches,
        uploads: nUploads,
        drawTime: (this.renderer.totalDrawTime - drawTimeBefore).toFixed(2),
        rTiles: rbd.tiles.toFixed(2),
        rCreatures: rbd.creatures.toFixed(2),
        rFlush: rbd.flush.toFixed(2),
        rRest: rbd.rest.toFixed(2),
        rRebuild: rbd.rebuild.toFixed(2),
        rTileObj: rbd.tileObj.toFixed(2),
        rCreatureSort: rbd.creatureSort.toFixed(2),
        rDeferred: rbd.deferred.toFixed(2),
        rAnim: rbd.anim.toFixed(2),
        rDistAnim: rbd.distAnim.toFixed(2),
        rCombat: rbd.combat.toFixed(2),
        rWeather: rbd.weather.toFixed(2),
        rLight: rbd.light.toFixed(2),
        cause: cause,
      };

      this.__stutterLog.push(stutterEntry);
      if (this.__stutterLog.length > this.__stutterLogMax) this.__stutterLog.shift();
    }
  }

}

GameClient.prototype.getStutterDump = function () {

  if (this.__stutterLog.length === 0) return "No stutters recorded.";

  let lines = [
    "=== STUTTER LOG (%s entries) ===".format(this.__stutterLog.length),
    "Frame  | Total  | Q  | S  | I  | R  | Median | Tiles | Ents | Batch | Up | Draw | T_tile | T_crea | T_flsh | T_rest",
    "-------|--------|----|----|----|----|--------|-------|------|-------|----|------|--------|--------|--------|-------",
  ];

  for (let s of this.__stutterLog) {
    lines.push("#%s | %sms | %s | %s | %s | %s | %sms | %s | %s | %s | %s | %s | %s | %s | %s | %s".format(
      s.frame.toString().padStart(5),
      s.total.padStart(6),
      s.phases.queue.padStart(3),
      s.phases.sound.padStart(3),
      s.phases.input.padStart(3),
      s.phases.render.padStart(3),
      s.median.padStart(5),
      s.tiles.toString().padStart(5),
      s.entities.toString().padStart(4),
      s.batches.toString().padStart(5),
      s.uploads.toString().padStart(3),
      s.drawTime.padStart(6),
      s.rTiles.padStart(6),
      s.rCreatures.padStart(6),
      s.rFlush.padStart(6),
      s.rRest.padStart(6),
    ));
  }

  return lines.join("\n");

}
