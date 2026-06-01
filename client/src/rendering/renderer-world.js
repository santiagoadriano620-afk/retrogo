Renderer.prototype.__collectTilesOnly = function () {

  this.__tileCache.length = 0;
  this.numberOfTiles = 0;

  let max = gameClient.player.getMaxFloor();
  let slotIndex = 0;

  for (let i = 7; i > max; i--) {
    let slot = this.__tileCacheSlots[slotIndex++];
    slot.z = i;
    this.__getFloorTilesTiles(i, slot.tiles);
    this.__tileCache.push(slot);
    this.numberOfTiles = this.numberOfTiles + slot.tiles.length;
  }

}

Renderer.prototype.__rebuildBackgroundCaches = function () {

  let tileCache = this.getTileCache();
  let player = gameClient.player;
  let pp = player.getPosition();
  let pz = pp.z % 8;

  for (let i = 0; i < tileCache.length; i++) {
    let floor = tileCache[i];
    let z = floor.z;
    let tiles = floor.tiles;
    let cacheCanvas = this.__backgroundCaches[z];

    cacheCanvas.clear();

    for (let j = 0; j < tiles.length; j++) {
      let tile = tiles[j];
      if (tile.id === 0 || tile.isAnimated()) continue;
      let tp = tile.getPosition();
      let tz = tp.z % 8;
      this.__scratchPos.x = 14 + (tp.x + tz) - (pp.x + pz);
      this.__scratchPos.y = 7 + (tp.y + tz) - (pp.y + pz);
      if (this.__scratchPos.x < -2 || this.__scratchPos.x > 36) continue;
      if (this.__scratchPos.y < -2 || this.__scratchPos.y > 18) continue;
      cacheCanvas.drawSprite(tile, this.__scratchPos, 64);
    }

    if (this.screen.isGL) {
      cacheCanvas.canvas.__glTexGen = (cacheCanvas.canvas.__glTexGen || 0) + 1;
    }
  }

}

Renderer.prototype.__getFloorTilesTiles = function (floor, outArray) {

  outArray.length = 0;
  let chunks = gameClient.world.chunks;
  let player = gameClient.player;
  let pp = player.getPosition();
  let pz = pp.z % 8;

  const CULLING_LEFT = -16;
  const CULLING_RIGHT = 22;
  const CULLING_TOP = -9;
  const CULLING_BOTTOM = 11;

  for (let i = 0; i < chunks.length; i++) {
    let floorTiles = chunks[i].getFloorTiles(floor);

    for (let j = 0; j < floorTiles.length; j++) {
      let tile = floorTiles[j];

      let tp = tile.getPosition();
      let tz = tp.z % 8;
      let sx = (tp.x + tz) - (pp.x + pz);
      let sy = (tp.y + tz) - (pp.y + pz);
      
      if (sx < CULLING_LEFT || sx > CULLING_RIGHT || sy < CULLING_TOP || sy > CULLING_BOTTOM) continue;

      if (!player.canSee(tile)) continue;

      if (tile.id === 0 && tile.items.length === 0 && (tile.neighbours || []).length === 1) continue;

      outArray.push(tile);
    }
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
  let pz = pp.z % 8;
  let tp = tile.getPosition();
  let tz = tp.z % 8;

  this.__scratchPos.x = 14 + player.getMoveOffset().x + (tp.x + tz) - (pp.x + pz);
  this.__scratchPos.y = 7 + player.getMoveOffset().y + (tp.y + tz) - (pp.y + pz);

  this.screen.drawSprite(tile, this.__scratchPos, 64);

}

Renderer.prototype.__renderWorld = function () {

  let frameStart = performance.now();
  let bd = this.__renderBreakdown;
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
    this.__tileCacheNeedsRebuild = false;
    this.__rebuildBackgroundCaches();
  }
  bd.rebuild = performance.now() - t_rebuild;

  this.screen.clear();

  let settings = gameClient.interface.settings;
  let weatherEnabled = settings.isWeatherEnabled();

  this.lightscreen.setup();

  let skipEquipmentLight = this.__skipNextLightFrame;
  this.__skipNextLightFrame = false;

  let mo = gameClient.player.getMoveOffset();
  let atRest = (mo.x === 0 && mo.y === 0);

  let t0 = performance.now();
  let tCreatureAcc = 0;

  for (let i = 0; i < tileCache.length; i++) {
    let floor = tileCache[i];
    let z = floor.z;
    let tiles = floor.tiles;

    this.screen.drawImage(this.__backgroundCaches[z].canvas, mo.x * 32, mo.y * 32);

    let pp = gameClient.player.getPosition();
    let pz = pp.z % 8;

    this.__batchingCreatures = true;
    this.__creatureRenderQueue = [];
    let animationTiles = [];

    for (let j = 0; j < tiles.length; j++) {
      let tile = tiles[j];
      if (tile.id === 0 || !tile.isAnimated()) continue;
      let tp = tile.getPosition();
      let tz = tp.z % 8;
      let ax = 14 + mo.x + (tp.x + tz) - (pp.x + pz);
      let ay = 7 + mo.y + (tp.y + tz) - (pp.y + pz);
      if (ax < 2 || ax > 30 || ay < 0 || ay > 14) continue;
      this.__scratchPos.x = ax;
      this.__scratchPos.y = ay;
      this.screen.drawSprite(tile, this.__scratchPos, 32);
    }

    for (let j = 0; j < tiles.length; j++) {
      let tile = tiles[j];
      tile.setElevation(0);
      tile.__preRenderedCreatures = false;

      let tp = tile.getPosition();
      let tz = tp.z % 8;
      let sx = 14 + mo.x + (tp.x + tz) - (pp.x + pz);
      let sy = 7 + mo.y + (tp.y + tz) - (pp.y + pz);

      if (sx < 2 || sx > 30 || sy < 0 || sy > 14) {
        continue;
      }

      if (tile.id !== 0 && !atRest) {
        let onEntryEdge = false;
        if (mo.x > 0 && sx < 1.5) onEntryEdge = true;
        if (mo.x < 0 && sx > 28) onEntryEdge = true;
        if (mo.y > 0 && sy < 1.5) onEntryEdge = true;
        if (mo.y < 0 && sy > 12) onEntryEdge = true;
        if (onEntryEdge) {
          this.__renderTile(tile);
        }
      }

      this.__renderTileObjects(tile, sx, sy, skipEquipmentLight);

      if (!tile.__preRenderedCreatures && tile.monsters && tile.monsters.size > 0) {
        for (let creature of tile.monsters) {
          this.__renderCreature(tile, creature, false);
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
        let ha = a.creature.outfit.getAppearanceHash();
        let hb = b.creature.outfit.getAppearanceHash();
        return ha < hb ? -1 : ha > hb ? 1 : 0;
      });
      bd.creatureSort = performance.now() - tc0;
      for (let entry of this.__creatureRenderQueue) {
        this.__renderCreature(entry.tile, entry.creature, entry.deferred);
      }
      tCreatureAcc += performance.now() - tc0;
    }

    let t_deferred = performance.now();
    for (let j = 0; j < tiles.length; j++) {
      this.__renderDeferred(tiles[j]);
    }
    bd.deferred += performance.now() - t_deferred;

    let t_anim = performance.now();
    for (let tile of animationTiles) {
      this.__renderTileAnimations(tile);
    }
    bd.anim += performance.now() - t_anim;

    let t_dist = performance.now();
    let animations = this.__animationLayers[z % 8];
    for (let animation of animations) {
      this.__renderDistanceAnimation(animation, animations);
    }
    bd.distAnim += performance.now() - t_dist;
  }

  bd.tiles = performance.now() - t0;
  bd.creatures = tCreatureAcc;
  bd.tileObj = bd.tiles - bd.deferred - bd.anim - bd.distAnim - bd.creatures;

  let t1 = performance.now();

  this.screen.flush();

  bd.flush += performance.now() - t1;

  let t2 = performance.now();

  for (let i = 0; i < this.__combatRects.length; i++) {
    let r = this.__combatRects[i];
    if (r.inner) {
      this.screen.drawInnerCombatRect({ color: r.color }, r);
    } else {
      this.screen.drawOuterCombatRect(r, r.color);
    }
  }
  this.__combatRects.length = 0;
  bd.combat = performance.now() - t2;

  this.screen.flush();

  let t_weather = performance.now();
  if (weatherEnabled) {
    this.weatherCanvas.drawWeather();
  }
  bd.weather = performance.now() - t_weather;

  let t_light = performance.now();
  if (gameClient.player.isUnderground()) {
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
  }
  bd.light = performance.now() - t_light;

  this.screen.flush();

  this.__renderNpcIcons();

  this.screen.flush();

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

}
