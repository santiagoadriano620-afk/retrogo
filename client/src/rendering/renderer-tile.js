Renderer.prototype.__renderTileObjects = function (tile, sx, sy, skipLight) {

  let position;
  if (sx !== undefined) {
    this.__scratchPos2.x = sx;
    this.__scratchPos2.y = sy;
    position = this.__scratchPos2;
  } else {
    let p = gameClient.player;
    let pp = p.getPosition();
    let pz = pp.z % 8;
    let tp = tile.getPosition();
    let tz = tp.z % 8;
    this.__scratchPos2.x = this.playerTileOffsetX + p.getMoveOffset().x + (tp.x + tz) - (pp.x + pz);
    this.__scratchPos2.y = this.playerTileOffsetY + p.getMoveOffset().y + (tp.y + tz) - (pp.y + pz);
    position = this.__scratchPos2;
  }

  if (position.x < this.playerTileOffsetX - 15 || position.x > this.playerTileOffsetX + 18 || position.y < this.playerTileOffsetY - 8 || position.y > this.playerTileOffsetY + 8) {
    return;
  }

  if (!skipLight && tile.id !== 0 && gameClient.player.isUnderground() && tile.isLight()) {
    this.__renderLight(tile, position, tile);
  }

  let items = tile.items;
  let itemsLength = items.length;
  let playerUnderground = gameClient.player.isUnderground();
  let OVR = this.__OVERLAY_IDS;
  let BND = this.__BOUNDARY_IDS;
  let COV = this.__COVER_IDS;
  let getLayer = Renderer.prototype.__getItemLayer;

  let L = this.__renderLayers;
  L[0].length = 0;
  L[1].length = 0;
  L[2].length = 0;
  L[3].length = 0;
  L[4].length = 0;

  let elev = this.__scratchElevation;
  if (elev.length < itemsLength) elev.length = itemsLength;

  let accElevation = tile.__renderElevation;
  let hasBoundaryItem = false;
  let hasCoverItem = false;
  let hasOverlayItem = false;
  for (let i = 0; i < itemsLength; i++) {
    elev[i] = accElevation;
    let item = items[i];
    let isOvr = OVR.has(item.id);
    let isCov = COV.has(item.id);
    if (isCov) hasCoverItem = true;
    if (isOvr) hasOverlayItem = true;

    let isBnd = false;
    if (!isOvr && !isCov) {
      if (item.id === 1385 && this.__isPlayerOnTile(tile)) {
        L[getLayer(item)].push(i);
      } else {
        isBnd = this.__isBoundaryItem(item, BND);
        if (isBnd) {
          hasBoundaryItem = true;
        } else {
          L[getLayer(item)].push(i);
        }
      }
    }

    if (isOvr || isCov) continue;
    let def = gameClient.itemDefinitions[item.id];
    if (isBnd && !item.hasFlag(PropBitFlag.prototype.flags.DatFlagOnTop) && !item.isElevation()) continue;
    if (def && def.properties && def.properties.type === "door" && !(def.flags & 8)) continue;
    if (def && item.hasFlag(PropBitFlag.prototype.flags.DatFlagOnTop) && !(def.flags & 8) && !item.isElevation()) continue;
    if (item.isElevation()) {
      let e = item.getDataObject().properties.elevation / 32;
      accElevation = Math.min(24 / 32, accElevation + e);
    } else if (item.hasFlag(PropBitFlag.prototype.flags.DatFlagOnTop) && accElevation < 24 / 32) {
      accElevation = Math.min(24 / 32, accElevation + 6 / 32);
    } else if (def && (def.flags & 8) !== 0 && accElevation < 24 / 32) {
      accElevation = Math.min(24 / 32, accElevation + 6 / 32);
    }
  }
  tile.setElevation(accElevation);
  tile.__needsNoDefer = hasBoundaryItem || hasCoverItem || hasOverlayItem;
  let needsFlush = hasBoundaryItem || hasCoverItem || hasOverlayItem;

  if (needsFlush) this.__flushCreatureBatch();

  let isEntrance = tile.isEntrance();

  for (let layer = 0; layer < 5; layer++) {
    let bucket = L[layer];
    for (let k = 0; k < bucket.length; k++) {
      let i = bucket[k];
      let item = items[i];

      let isOnTop = item.hasFlag(PropBitFlag.prototype.flags.DatFlagOnTop);
      if (isOnTop) {
        this.__scratchPos.x = position.x;
        this.__scratchPos.y = position.y;
      } else {
        this.__scratchPos.x = position.x - elev[i];
        this.__scratchPos.y = position.y - elev[i];
      }
      this.__adjustItemPosSecondPass(item);
    if (isEntrance || tile.houseState === 1 || tile.houseState === 2) {
      let def = gameClient.itemDefinitions[item.id];
      if (def && def.properties && def.properties.type === "door") {
            if (tile.houseState === 1) this.screen.__glSetColor(0, 1, 0, 1);
        else if (tile.houseState === 2) this.screen.__glSetColor(1, 0, 0, 1);
        else if (isEntrance)            this.screen.__glSetColor(1, 0.843, 0, 1);
      }
    }
    this.screen.drawSprite(item, this.__scratchPos, 32);
    if (isEntrance || tile.houseState === 1 || tile.houseState === 2) {
      let def = gameClient.itemDefinitions[item.id];
      if (def && def.properties && def.properties.type === "door") {
        this.screen.__glSetColor(1, 1, 1, 1);
      }
    }
    if (!skipLight && playerUnderground && item.isLight()) {
      this.__renderLight(tile, this.__scratchPos, item);
    }
  }
  }

  if (tile.__needsNoDefer) this.__flushCreatureBatch();

  this.__renderDeferred(tile);

  if ((hasBoundaryItem || hasCoverItem || hasOverlayItem) && tile.monsters && tile.monsters.size > 0) {
    let wasBatching = this.__batchingCreatures;
    this.__batchingCreatures = false;
    for (let creature of tile.monsters) {
      this.__renderCreature(tile, creature, false);
    }
    this.__batchingCreatures = wasBatching;
    tile.__preRenderedCreatures = true;
  }

  if (hasBoundaryItem || hasCoverItem || hasOverlayItem) this.__flushCreatureBatch();

  for (let i = 0; i < itemsLength; i++) {
    let item = items[i];
    if (item.id === 1385 && this.__isPlayerOnTile(tile)) continue;
    if (!OVR.has(item.id) && !this.__isBoundaryItem(item, BND) && !COV.has(item.id)) continue;
    let isOnTop = item.hasFlag(PropBitFlag.prototype.flags.DatFlagOnTop);
    if (isOnTop) {
      this.__scratchPos.x = position.x;
      this.__scratchPos.y = position.y;
    } else {
      this.__scratchPos.x = position.x - elev[i];
      this.__scratchPos.y = position.y - elev[i];
    }
    this.__adjustItemPosThirdPass(item);
    if (isEntrance || tile.houseState === 1 || tile.houseState === 2) {
      let def = gameClient.itemDefinitions[item.id];
      if (def && def.properties && def.properties.type === "door") {
            if (tile.houseState === 1) this.screen.__glSetColor(0, 1, 0, 1);
        else if (tile.houseState === 2) this.screen.__glSetColor(1, 0, 0, 1);
        else if (isEntrance)            this.screen.__glSetColor(1, 0.843, 0, 1);
      }
    }
    this.screen.drawSprite(item, this.__scratchPos, 32);
    if (isEntrance || tile.houseState === 1 || tile.houseState === 2) {
      let def = gameClient.itemDefinitions[item.id];
      if (def && def.properties && def.properties.type === "door") {
        this.screen.__glSetColor(1, 1, 1, 1);
      }
    }
    if (!skipLight && playerUnderground && item.isLight()) {
      this.__renderLight(tile, this.__scratchPos, item);
    }
  }

}

Renderer.prototype.__flushCreatureBatch = function () {

  if (this.__creatureRenderQueue.length === 0) return;
  let queue = this.__creatureRenderQueue;
  this.__batchingCreatures = false;
  queue.sort(function (a, b) {
    let ha = a.creature.outfit.getAppearanceHash();
    let hb = b.creature.outfit.getAppearanceHash();
    return ha < hb ? -1 : ha > hb ? 1 : 0;
  });
  for (let entry of queue) {
    this.__renderCreature(entry.tile, entry.creature, entry.deferred);
  }
  this.__creatureRenderQueue = [];
  this.__batchingCreatures = true;

}

Renderer.prototype.__isPlayerOnTile = function (tile) {
  let player = gameClient.player;
  if (!player) return false;
  let pp = player.getPosition();
  let tp = tile.getPosition();
  if (pp.x === tp.x && pp.y === tp.y && pp.z === tp.z) return true;
  if (player.isMoving()) {
    let dir = player.getLookDirection();
    let dx = 0, dy = 0;
    switch (dir) {
      case CONST.DIRECTION.NORTH: dy = -1; break;
      case CONST.DIRECTION.SOUTH: dy = 1; break;
      case CONST.DIRECTION.EAST: dx = 1; break;
      case CONST.DIRECTION.WEST: dx = -1; break;
      default: return false;
    }
    let destX = pp.x + dx, destY = pp.y + dy, destZ = pp.z;
    if (destX === tp.x && destY === tp.y && destZ === tp.z) return true;
  }
  return false;
};
