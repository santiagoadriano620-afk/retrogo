Renderer.prototype.__collectTilesOnly = function () {

  this.__tileCache.length = 0;
  this.numberOfTiles = 0;

  let max;
  try {
    max = gameClient.player.getMaxFloor();
  } catch (e) {
    console.error("[render] getMaxFloor() failed:", e);
    max = -1;
  }

  let slotIndex = 0;
  let depth = (typeof Chunk !== 'undefined' && Chunk.prototype.DEPTH) || 8;
  let floorsTileCount = {};
  
  for (let i = depth - 1; i > max; i--) {
    let slot = this.__tileCacheSlots[slotIndex++];
    slot.z = i;
    this.__getFloorTilesTiles(i, slot.tiles);
    this.__tileCache.push(slot);
    this.numberOfTiles = this.numberOfTiles + slot.tiles.length;
    floorsTileCount[i] = slot.tiles.length;
  }
  
  if (this.__tileCache.length === 0) {
    console.error("[render] __collectTilesOnly: collected 0 floors (depth=%d, max=%d), NO FLOORS COLLECTED!", depth, max);
  } else if (this.__tileCache.length === 1) {
    console.warn("[render] __collectTilesOnly: WARNING - only 1 floor collected! depth=%d, max=%d, tiles per floor: %o", depth, max, floorsTileCount);
  }

}

Renderer.prototype.__rebuildBackgroundCaches = function () {

  let tileCache = this.getTileCache();
  let player = gameClient.player;
  let pp = player.getPosition();
  let pz = pp.z % (typeof Chunk !== 'undefined' && Chunk.prototype.DEPTH || 8);

  if (!tileCache || tileCache.length === 0) {
    console.error("[render] __rebuildBackgroundCaches: tileCache is EMPTY - cannot render! length=%d", tileCache ? tileCache.length : -1);
    // Emergency: try to rebuild immediately
    this.__collectTilesOnly();
    tileCache = this.getTileCache();
    if (tileCache.length === 0) {
      console.error("[render] __rebuildBackgroundCaches: Emergency rebuild FAILED - still empty!");
      return;
    }
    console.warn("[render] __rebuildBackgroundCaches: Emergency rebuild succeeded, now have %d floors", tileCache.length);
  }

  // Reset tile draw counters for this rebuild cycle
  this.__lastRebuildDrawnTiles = 0;
  this.__lastRebuildFailedFG = 0;

  for (let i = 0; i < tileCache.length; i++) {
    let floor = tileCache[i];
    let z = floor.z;
    let tiles = floor.tiles;
    let cacheCanvas = this.__backgroundCaches[z];

    // Guard: skip invalid cache indices (can happen during tab return if z is out of bounds)
    if (!cacheCanvas || z < 0 || z >= 16) {
      console.warn("[render] Skipping invalid cache index z=%d", z);
      continue;
    }
    
    // Validate canvas object has necessary properties
    if (!cacheCanvas.canvas || typeof cacheCanvas.clear !== 'function') {
      console.error("[render] Cache canvas object invalid for z=%d: canvas=%s, clear=%s", z, typeof cacheCanvas.canvas, typeof cacheCanvas.clear);
      continue;
    }

    try {
      cacheCanvas.clear();
    } catch (e) {
      console.error("[render] Cache clear failed for z=%d: %o", z, e);
      continue;
    }

    var shiftX = this.__bgCacheShiftX * 32;
    var shiftY = this.__bgCacheShiftY * 32;
    if ((shiftX || shiftY) && cacheCanvas.context) {
      cacheCanvas.context.save();
      cacheCanvas.context.translate(shiftX, shiftY);
    }

    for (let j = 0; j < tiles.length; j++) {
      let tile = tiles[j];
      if (tile.id === 0 || tile.isAnimated()) continue;
      let tp = tile.getPosition();
      let tz = tp.z % (typeof Chunk !== 'undefined' && Chunk.prototype.DEPTH || 8);
      this.__scratchPos.x = this.playerTileOffsetX + (tp.x + tz) - (pp.x + pz);
      this.__scratchPos.y = this.playerTileOffsetY + (tp.y + tz) - (pp.y + pz);
      if (this.__scratchPos.x < this.playerTileOffsetX - this.__bgCullMarginLeft || this.__scratchPos.x > this.playerTileOffsetX + this.__bgCullMarginRight) continue;
      if (this.__scratchPos.y < this.playerTileOffsetY - this.__bgCullMarginTop || this.__scratchPos.y > this.playerTileOffsetY + this.__bgCullMarginBottom) continue;
      try {
        let fg = tile.getFrameGroup(FrameGroup.prototype.NONE);
        if (!fg) {
          this.__lastRebuildFailedFG++;
          continue;
        }
        cacheCanvas.drawSprite(tile, this.__scratchPos, 64);
        this.__lastRebuildDrawnTiles++;
      } catch (e) {
        console.error("[render] Skipping bad sprite tile (%d,%d,%d): %o", tp.x, tp.y, tp.z, e);
      }
    }

    // Diagnostic: verify cache canvas has content
    if (i === 0) {
      try {
        let imgData = cacheCanvas.context.getImageData(448, 224, 1, 1);
        let hasContent = imgData.data[3] > 0;
        if (this.__lastRebuildDrawnTiles > 0 && !hasContent) {
          console.warn("[render] CACHE ANOMALY: z=%d drawn=%d failedFG=%d sample pixel (448,224) alpha=%d — cache transparent despite drawn tiles!", z, this.__lastRebuildDrawnTiles, this.__lastRebuildFailedFG, imgData.data[3]);
        } else if (this.__lastRebuildDrawnTiles === 0 && this.__lastRebuildFailedFG > 0) {
          let sampleTile = tiles[0];
          let sampleFG = sampleTile ? sampleTile.getFrameGroup(FrameGroup.prototype.NONE) : null;
          console.warn("[render] CACHE NO DRAWN: z=%d failedFG=%d sampleTile.id=%d sampleFG=%s — all tiles missing frame groups!", z, this.__lastRebuildFailedFG, sampleTile ? sampleTile.id : -1, !!sampleFG);
        } else if (this.__lastRebuildDrawnTiles === 0 && this.__lastRebuildFailedFG === 0) {
          let totalInFloor = tiles.length;
          let idZeroCount = 0, animatedCount = 0, culledCount = 0;
          for (let tj = 0; tj < tiles.length; tj++) {
            if (tiles[tj].id === 0) idZeroCount++;
            else if (tiles[tj].isAnimated()) animatedCount++;
          }
          console.warn("[render] CACHE EMPTY: z=%d tiles=%d id0=%d anim=%d — 0 tiles drawn on background cache", z, totalInFloor, idZeroCount, animatedCount);
        }
      } catch (e) {
        // getImageData can fail for CORS/security reasons
      }
    }

    if ((shiftX || shiftY) && cacheCanvas.context) {
      try {
        cacheCanvas.context.restore();
      } catch (e) {
        console.error("[render] Cache context.restore failed for z=%d: %o", z, e);
      }
    }

    if (this.screen && this.screen.isGL) {
      if (cacheCanvas.canvas) {
        cacheCanvas.canvas.__glTexGen = (cacheCanvas.canvas.__glTexGen || 0) + 1;
      }
    }
  }

}

Renderer.prototype.__getFloorTilesTiles = function (floor, outArray) {

  outArray.length = 0;
  let chunks = gameClient.world.chunks;
  let player = gameClient.player;
  let pp = player.getPosition();
  let pz = pp.z % (typeof Chunk !== 'undefined' && Chunk.prototype.DEPTH || 8);

  if (!chunks || chunks.length === 0) {
    console.error("[render] __getFloorTilesTiles floor=%d: NO CHUNKS in world!", floor);
    return outArray;
  }

  var mo = player.getMoveOffset();
  var CULLING_LEFT = -(this.__bgCullMarginLeft + Math.max(mo.x, 0));
  var CULLING_RIGHT = this.__bgCullMarginRight + Math.max(-mo.x, 0);
  var CULLING_TOP = -(this.__bgCullMarginTop + Math.max(mo.y, 0));
  var CULLING_BOTTOM = this.__bgCullMarginBottom + Math.max(-mo.y, 0);

  let tilesFound = 0;

  for (let i = 0; i < chunks.length; i++) {
    let floorTiles = chunks[i].getFloorTiles(floor);
    tilesFound += floorTiles.length;

    for (let j = 0; j < floorTiles.length; j++) {
      let tile = floorTiles[j];

      let tp = tile.getPosition();
      let tz = tp.z % (typeof Chunk !== 'undefined' && Chunk.prototype.DEPTH || 8);
      let sx = (tp.x + tz) - (pp.x + pz);
      let sy = (tp.y + tz) - (pp.y + pz);
      
      if (sx < CULLING_LEFT || sx > CULLING_RIGHT || sy < CULLING_TOP || sy > CULLING_BOTTOM) continue;

      try {
        if (!player.canSee(tile)) continue;
      } catch (e) {
        console.error("[render] canSee failed for tile (%d,%d,%d): %o", tp.x, tp.y, tp.z, e);
        continue;
      }

      if (tile.id === 0 && tile.items.length === 0 && (tile.neighbours || []).length === 1) continue;

      outArray.push(tile);
    }
  }

  if (tilesFound === 0 && floor >= 0) {
    console.warn("[render] __getFloorTilesTiles floor=%d: NO TILES FOUND in any chunk! chunks=%d", floor, chunks.length);
  }

  return outArray;

}

Renderer.prototype.__renderTile = function (tile) {

  if (tile.id === 0) {
    return;
  }

  tile.setElevation(0);

  let player = gameClient.player;
  let pp = player.getPosition();
  let pz = pp.z % (typeof Chunk !== 'undefined' && Chunk.prototype.DEPTH || 8);
  let tp = tile.getPosition();
  let tz = tp.z % (typeof Chunk !== 'undefined' && Chunk.prototype.DEPTH || 8);

  this.__scratchPos.x = this.playerTileOffsetX + player.getMoveOffset().x + (tp.x + tz) - (pp.x + pz);
  this.__scratchPos.y = this.playerTileOffsetY + player.getMoveOffset().y + (tp.y + tz) - (pp.y + pz);

  this.screen.drawSprite(tile, this.__scratchPos, 64);

}

Renderer.prototype.__renderWorld = function () {

  let frameStart = performance.now();
  let bd = this.__renderBreakdown;

  // Sanity check: ensure screen is ready
  if (!this.screen) {
    console.error("[render] __renderWorld: this.screen is null/undefined");
    return;
  }
  if (!this.screen.canvas) {
    console.error("[render] __renderWorld: this.screen.canvas is null/undefined");
    return;
  }

  // Sanity-check player state before rendering — NaN/Infinity positions
  // corrupt tile culling and draw calls, producing a black screen.
  let pp = gameClient.player ? gameClient.player.getPosition() : null;
  if (!pp || !isFinite(pp.x) || !isFinite(pp.y) || !isFinite(pp.z)) {
    console.error("[render] Player position invalid (%s), resetting", pp);
    if (gameClient.player) {
      gameClient.player.setPosition(new Position(pp ? (isFinite(pp.x) ? pp.x : 0) : 0, pp ? (isFinite(pp.y) ? pp.y : 0) : 0, pp ? (isFinite(pp.z) ? pp.z : 7) : 7));
    }
  }

  if (pp && gameClient.world && !gameClient.world.isValidWorldPosition(pp)) {
    console.warn("[render] Player out of world bounds (%d,%d,%d), clamping", pp.x, pp.y, pp.z);
    let cx = Math.max(0, Math.min(pp.x, gameClient.world.width - 1));
    let cy = Math.max(0, Math.min(pp.y, gameClient.world.height - 1));
    let cz = Math.max(0, Math.min(pp.z, gameClient.world.depth - 1));
    gameClient.player.setPosition(new Position(cx, cy, cz));
  }

  // Check for WebGL context loss
  if (this.screen && this.screen.isGL && this.screen.glContextLost) {
    console.error("[render] WebGL context is lost — rendering cannot proceed");
    return;
  }

  let mo = gameClient.player ? gameClient.player.getMoveOffset() : null;
  if (mo && (!isFinite(mo.x) || !isFinite(mo.y))) {
    console.error("[render] Player moveOffset invalid (%s,%s), clearing", mo.x, mo.y);
    gameClient.player.__movementEvent = null;
  }
  bd.tiles = 0;
  bd.creatures = 0;
  bd.flush = 0;
  bd.rest = 0;
  bd.rebuild = 0;
  bd.tileObj = 0;
  bd.creatureSort = 0;
  bd.deferred = 0;
  bd.anim = 0;
  bd.distAnim = 0;
  bd.combat = 0;
  bd.weather = 0;
  bd.light = 0;

  let tileCache = this.getTileCache();
  this.updateTileCache();

  this.lightscreen.update();

  this.__npcIconQueue.length = 0;

  let t_rebuild = performance.now();
  if (this.__tileCacheNeedsRebuild) {
    try {
      this.__rebuildBackgroundCaches();
      this.__tileCacheNeedsRebuild = false;
    } catch (e) {
      console.error("[render] Background cache rebuild failed, will retry:", e);
    }
  }
  bd.rebuild = performance.now() - t_rebuild;

  this.screen.clear();

  let settings = gameClient.interface.settings;
  let weatherEnabled = settings.isWeatherEnabled();

  this.lightscreen.setup();

  let skipEquipmentLight = this.__skipNextLightFrame;
  this.__skipNextLightFrame = false;

  mo = gameClient.player.getMoveOffset();
  let atRest = (mo.x === 0 && mo.y === 0);
  this.__cullLeft = this.playerTileOffsetX - this.__cullMarginLeft;
  this.__cullRight = this.playerTileOffsetX + this.__cullMarginRight;
  this.__cullTop = this.playerTileOffsetY - this.__cullMarginTop;
  this.__cullBottom = this.playerTileOffsetY + this.__cullMarginBottom;

  let t0 = performance.now();
  let tCreatureAcc = 0;

  for (let i = 0; i < tileCache.length; i++) {
    let floor = tileCache[i];
    let z = floor.z;
    let tiles = floor.tiles;

    // Guard: skip invalid cache indices
    let cacheObj = this.__backgroundCaches[z];
    if (!cacheObj || z < 0 || z >= 16) {
      console.warn("[render] Skipping invalid cache index z=%d in drawImage", z);
      continue;
    }
    
    // Guard: validate canvas exists and is ready
    if (!cacheObj.canvas) {
      console.error("[render] Cache canvas undefined for z=%d (cache obj exists but canvas is null)", z);
      continue;
    }

    try {
      this.screen.drawImage(cacheObj.canvas, mo.x * 32 - this.__bgCacheShiftX * 32, mo.y * 32 - this.__bgCacheShiftY * 32);
    } catch (e) {
      console.error("[render] drawImage failed for cache z=%d: %o", z, e);
    }

    let pp = gameClient.player.getPosition();
    let pz = pp.z % (typeof Chunk !== 'undefined' && Chunk.prototype.DEPTH || 8);

    this.__batchingCreatures = true;
    this.__creatureRenderQueue = [];
    let animationTiles = [];

    for (let j = 0; j < tiles.length; j++) {
      let tile = tiles[j];
      if (tile.id === 0 || !tile.isAnimated()) continue;
      let tp = tile.getPosition();
      let tz = tp.z % (typeof Chunk !== 'undefined' && Chunk.prototype.DEPTH || 8);
      let ax = this.playerTileOffsetX + mo.x + (tp.x + tz) - (pp.x + pz);
      let ay = this.playerTileOffsetY + mo.y + (tp.y + tz) - (pp.y + pz);
      if (ax < this.__cullLeft || ax > this.__cullRight || ay < this.__cullTop || ay > this.__cullBottom) continue;
      this.__scratchPos.x = ax;
      this.__scratchPos.y = ay;
      try {
        this.screen.drawSprite(tile, this.__scratchPos, 32);
      } catch (e) {
        console.error("[render] Animated tile drawSprite threw: %o", e);
      }
    }

    for (let j = 0; j < tiles.length; j++) {
      let tile = tiles[j];
      tile.setElevation(0);
      tile.__preRenderedCreatures = false;

      let tp = tile.getPosition();
      let tz = tp.z % (typeof Chunk !== 'undefined' && Chunk.prototype.DEPTH || 8);
      let sx = this.playerTileOffsetX + mo.x + (tp.x + tz) - (pp.x + pz);
      let sy = this.playerTileOffsetY + mo.y + (tp.y + tz) - (pp.y + pz);

      if (sx < this.__cullLeft || sx > this.__cullRight || sy < this.__cullTop || sy > this.__cullBottom) {
        continue;
      }

      if (tile.id !== 0 && !atRest) {
        let onEntryEdge = false;
        if (mo.x > 0 && sx < this.__cullLeft) onEntryEdge = true;
        if (mo.x < 0 && sx > this.__cullRight) onEntryEdge = true;
        if (mo.y > 0 && sy < this.__cullTop) onEntryEdge = true;
        if (mo.y < 0 && sy > this.__cullBottom) onEntryEdge = true;
        if (onEntryEdge) {
          try {
            this.__renderTile(tile);
          } catch (e) {
            console.error("[render] __renderTile threw: %o", e);
          }
        }
      }

      try {
        this.__renderTileObjects(tile, sx, sy, skipEquipmentLight);
      } catch (e) {
        console.error("[render] __renderTileObjects threw for tile (%d,%d,%d): %o", tp.x, tp.y, tp.z, e);
      }

      if (!tile.__preRenderedCreatures && tile.monsters && tile.monsters.size > 0) {
        for (let creature of tile.monsters) {
          try {
            this.__renderCreature(tile, creature, false);
          } catch (e) {
            console.error("[render] __renderCreature threw for %s: %o", creature.name || "?", e);
          }
        }
      }

      if (tile.__animations && tile.__animations.size > 0) {
        animationTiles.push(tile);
      }
    }

    this.__batchingCreatures = false;

    if (this.__creatureRenderQueue.length > 0) {
      let tc0 = performance.now();
      this.__creatureRenderQueue.sort(function (a, b) {
        try {
          let ha = a.creature.outfit.getAppearanceHash();
          let hb = b.creature.outfit.getAppearanceHash();
          return ha < hb ? -1 : ha > hb ? 1 : 0;
        } catch (e) {
          return 0;
        }
      });
      bd.creatureSort = performance.now() - tc0;
      for (let entry of this.__creatureRenderQueue) {
        try {
          this.__renderCreature(entry.tile, entry.creature, entry.deferred);
        } catch (e) {
          console.error("[render] Batched creature render threw: %o", e);
        }
      }
      tCreatureAcc += performance.now() - tc0;
    }

    let t_deferred = performance.now();
    for (let j = 0; j < tiles.length; j++) {
      try {
        this.__renderDeferred(tiles[j]);
      } catch (e) {
        console.error("[render] Deferred render threw: %o", e);
      }
    }
    bd.deferred += performance.now() - t_deferred;

    let t_anim = performance.now();
    for (let tile of animationTiles) {
      try {
        this.__renderTileAnimations(tile);
      } catch (e) {
        console.error("[render] Animation render threw: %o", e);
      }
    }
    bd.anim += performance.now() - t_anim;

    let t_dist = performance.now();
    let animations = this.__animationLayers[z % (typeof Chunk !== 'undefined' && Chunk.prototype.DEPTH || 8)];
    for (let animation of animations) {
      try {
        this.__renderDistanceAnimation(animation, animations);
      } catch (e) {
        console.error("[render] Distance animation render threw: %o", e);
      }
    }
    bd.distAnim += performance.now() - t_dist;
  }

  bd.tiles = performance.now() - t0;
  bd.creatures = tCreatureAcc;
  bd.tileObj = bd.tiles - bd.deferred - bd.anim - bd.distAnim - bd.creatures;

  let t1 = performance.now();

  try {
    this.screen.flush();
  } catch (e) {
    console.error("[render] screen.flush() threw: %o", e);
  }

  // Per-frame compositing check for first 120 frames
  if (this.__compositeCheckCount === undefined) this.__compositeCheckCount = 0;
  if (this.__compositeCheckCount < 120 && this.screen.isGL) {
    this.__compositeCheckCount++;
    try {
      let gl = this.screen.gl;
      let cw = this.screen.canvas.width, ch = this.screen.canvas.height;
      // Sample a 3x3 grid (use RGB since alpha:false context always returns A=255)
      let samplePoints = [
        { x: Math.floor(cw/2), y: Math.floor(ch/2), label: "C" },
        { x: Math.floor(cw/2), y: 64, label: "CT" },
        { x: Math.floor(cw/2), y: ch - 64, label: "CB" },
        { x: 64, y: Math.floor(ch/2), label: "ML" },
        { x: cw - 64, y: Math.floor(ch/2), label: "MR" },
        { x: 64, y: 64, label: "TL" },
        { x: cw - 64, y: 64, label: "TR" },
        { x: 64, y: ch - 64, label: "BL" },
        { x: cw - 64, y: ch - 64, label: "BR" }
      ];
      let samples = [], allBlack = 0;
      for (let si = 0; si < samplePoints.length; si++) {
        let sp = samplePoints[si];
        let px = new Uint8Array(4);
        gl.readPixels(sp.x, sp.y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        let isBlack = px[0] === 0 && px[1] === 0 && px[2] === 0;
        if (isBlack) allBlack++;
        samples.push(sp.label + "=" + (isBlack ? "B" : "R" + px[0] + "G" + px[1] + "B" + px[2]));
      }
      if (this.__compositeCheckCount <= 3 || this.__compositeCheckCount % 30 === 0) {
        console.warn("[render] Screen samples frame=%d canvas=(%dx%d) black=%d/9 [%s]", this.__compositeCheckCount, cw, ch, allBlack, samples.join(" "));
      }
    } catch (e) {
      console.warn("[render] Per-frame check threw at count=" + this.__compositeCheckCount + ": " + (e.message || e));
    }
  }

  bd.flush += performance.now() - t1;

  let t2 = performance.now();

  try {
    for (let i = 0; i < this.__combatRects.length; i++) {
      let r = this.__combatRects[i];
      if (r.inner) {
        this.screen.drawInnerCombatRect({ color: r.color }, r);
      } else {
        this.screen.drawOuterCombatRect(r, r.color);
      }
    }
  } catch (e) {
    console.error("[render] Combat rect draw threw: %o", e);
  }
  this.__combatRects.length = 0;
  bd.combat = performance.now() - t2;

  try {
    this.screen.flush();
  } catch (e) {
    console.error("[render] screen.flush() threw: %o", e);
  }

  let t_weather = performance.now();
  if (weatherEnabled) {
    try {
      this.weatherCanvas.drawWeather();
    } catch (e) {
      console.error("[render] drawWeather threw: %o", e);
    }
  }
  bd.weather = performance.now() - t_weather;

  let t_light = performance.now();
  if (gameClient.player && gameClient.player.isUnderground()) {
    try {
      this.lightscreen.renderLightBubble(14, 7, 2.5, 210, null, 0.15);

      if (!skipEquipmentLight) {
        let eq = gameClient.player.equipment;
        if (eq) {
          let slots = eq.slots;
          for (let i = 0; i < slots.length; i++) {
            let item = slots[i].item;
            if (item && item.isLight()) {
              this.__renderLightThing({x: 14, y: 7}, item);
            }
          }
        }

        if (gameClient.player.hasCondition(ConditionManager.prototype.LIGHT)) {
          let spellLevel = gameClient.player.__lightLevel || 6;
          this.__renderLightThing({x: 14, y: 7}, { getDataObject: () => ({ properties: { light: { level: spellLevel, color: 210 } } }) });
        }
      }

      this.lightscreen.render();
      this.screen.drawImage(this.lightscreen.canvas, 0, 0);
    } catch (e) {
      console.error("[render] Light rendering threw: %o", e);
    }
  }
  bd.light = performance.now() - t_light;

  try {
    this.screen.flush();
  } catch (e) {
    console.error("[render] screen.flush() threw: %o", e);
  }

  try {
    this.__renderNpcIcons();
  } catch (e) {
    console.error("[render] __renderNpcIcons threw: %o", e);
  }

  try {
    this.screen.flush();
  } catch (e) {
    console.error("[render] screen.flush() threw: %o", e);
  }

  if (gameClient.world.__battleListDirty) {
    gameClient.world.__battleListDirty = false;
    let now = Date.now();
    if (now - gameClient.world.__lastBattleRefresh >= 1000) {
      gameClient.world.__lastBattleRefresh = now;
      setTimeout(function () {
        gameClient.world.updateBattleListVisibility();
      }, 0);
    }
  }

  let frameDuration = performance.now() - frameStart;
  bd.rest = frameDuration - (bd.rebuild + bd.tiles + bd.flush + bd.combat + bd.weather + bd.light);

  this.totalDrawTime = this.totalDrawTime + frameDuration;

  // Health check: sample centre pixel and check GL errors every ~60 frames
  this.__healthCheckCounter = (this.__healthCheckCounter || 0) + 1;
  if (this.__healthCheckCounter % 60 === 0 && this.screen.isGL && !this.screen.glContextLost) {
    try {
      let gl = this.screen.gl;

      // Check for silent GL errors that would cause black output
      let glErr = gl.getError();
      if (glErr !== gl.NO_ERROR) {
        console.error("[render] GL error 0x" + glErr.toString(16) + " detected — forcing cache rebuild");
        this.__lastCacheX = -1;
        this.__lastCacheY = -1;
        this.__lastCacheZ = -1;
        this.__tileCacheNeedsRebuild = true;
      } else {
        // Sample up to 5 key pixels (use RGB; skip points outside canvas)
        let cw = this.screen.canvas.width, ch = this.screen.canvas.height;
        let keyPoints = [
          { label: "center", glX: Math.floor(cw/2), glY: Math.floor(ch/2) },
          { label: "topLeft", glX: 64, glY: ch - 64 },
          { label: "topRight", glX: cw - 64, glY: ch - 64 },
          { label: "botLeft", glX: 64, glY: 64 },
          { label: "botRight", glX: cw - 64, glY: 64 },
          { label: "playerTile", glX: 448, glY: ch - 224 }
        ];
        let allBlack = true, sampleDetails = [];
        for (let pi = 0; pi < keyPoints.length; pi++) {
          let pt = keyPoints[pi];
          if (pt.glX < 0 || pt.glX >= cw || pt.glY < 0 || pt.glY >= ch) continue;
          let px = new Uint8Array(4);
          gl.readPixels(pt.glX, pt.glY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          let isBlack = px[0] === 0 && px[1] === 0 && px[2] === 0;
          if (!isBlack) allBlack = false;
          sampleDetails.push(pt.label + "=" + (isBlack ? "B" : "R"+px[0]+"G"+px[1]+"B"+px[2]));
        }
        if (allBlack && gameClient.player && !gameClient.player.isUnderground() && atRest) {
          let pp = gameClient.player.getPosition();
          let chunks = gameClient.world ? gameClient.world.chunks : null;
          let chunkCount = chunks ? chunks.length : 0;
          let tileCacheLen = this.__tileCache ? this.__tileCache.length : 0;

          // Sample a tile under the player
          let sampleTile = null;
          if (this.__tileCache && this.__tileCache.length > 0) {
            let groundFloor = this.__tileCache[this.__tileCache.length - 1];
            if (groundFloor && groundFloor.tiles && groundFloor.tiles.length > 0) {
              sampleTile = groundFloor.tiles[0];
            }
          }
          let sampleFrameGroup = sampleTile ? sampleTile.getFrameGroup(FrameGroup.prototype.NONE) : null;
          let sampleHasData = sampleTile ? !!sampleTile.getDataObject() : false;

          // Count non-zero tiles
          let nonZeroTiles = 0;
          if (this.__tileCache) {
            for (let fi = 0; fi < this.__tileCache.length; fi++) {
              let ft = this.__tileCache[fi].tiles;
              for (let ti = 0; ti < ft.length; ti++) {
                if (ft[ti].id !== 0) nonZeroTiles++;
              }
            }
          }

          let totalTiles = this.numberOfTiles;
          let floorBreakdown = (this.__tileCache || []).map(function(f) { return f.z + ":" + f.tiles.length; }).join(",");
          console.warn(
            "[render] BLACK SCREEN pixels=[%s] pos=(%d,%d,%d) mo=(%d,%d) chunks=%d tileCacheFloors=%d totalTiles=%d nonZeroTiles=%d sampleId=%d hasData=%s hasFrameGroup=%s canvas=(%dx%d) rebuild=%s drawn=%d failedFG=%d floors=[%s]",
            sampleDetails.join(" "),
            pp.x, pp.y, pp.z, mo.x, mo.y, chunkCount, tileCacheLen, totalTiles, nonZeroTiles,
            sampleTile ? sampleTile.id : -1, sampleHasData, !!sampleFrameGroup,
            this.screen.canvas.width, this.screen.canvas.height,
            this.__tileCacheNeedsRebuild,
            this.__lastRebuildDrawnTiles, this.__lastRebuildFailedFG,
            floorBreakdown
          );
          this.__lastCacheX = -1;
          this.__lastCacheY = -1;
          this.__lastCacheZ = -1;
          this.__tileCacheNeedsRebuild = true;
        }
      }
    } catch (e) {
      console.warn("[render] Health check readPixels failed — GL may be in bad state:", e);
      this.__lastCacheX = -1;
      this.__lastCacheY = -1;
      this.__lastCacheZ = -1;
      this.__tileCacheNeedsRebuild = true;
    }
  }

}
