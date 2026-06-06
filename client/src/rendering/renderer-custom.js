/*
 * File: renderer-custom.js
 * Item-specific rendering overrides: position offsets, boundary exclusions,
 * and layer overrides for individual item IDs.
 * Keeps renderer.js clean of game-specific item knowledge.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Item position adjustments (second pass — non-OVR/BND/COV items)
// ─────────────────────────────────────────────────────────────────────────────

Renderer.prototype.__adjustItemPosSecondPass = function (item) {

  if (item.id === 1634) {
    this.__scratchPos.x -= 0.125;
    this.__scratchPos.y -= 0.125 + 2 / 32;
  }
  if (__isServerItem(item, 1635)) {
    this.__scratchPos.x -= 8 / 32;
  }
  if (__isServerItem(item, 1622) || __isServerItem(item, 1623)) {
    this.__scratchPos.x -= 8 / 32;
    this.__scratchPos.y -= 8 / 32;
  }
  if (__isServerItem(item, 1786) || __isServerItem(item, 1787)) {
    this.__scratchPos.y += 7 / 32;
  }
  if (__isServerItem(item, 1634)) {
    this.__scratchPos.x -= 4 / 32;
    this.__scratchPos.y -= 4 / 32;
  }
  if (__isServerItem(item, 1636) || __isServerItem(item, 1638) || __isServerItem(item, 1640)) {
    this.__scratchPos.x -= 8 / 32;
    this.__scratchPos.y -= 8 / 32;
  }
  if (__isServerItem(item, 1635)) {
    this.__scratchPos.x -= 8 / 32;
  }

}

// ─────────────────────────────────────────────────────────────────────────────
// Item position adjustments (third pass — OVR / BND / COV items)
// ─────────────────────────────────────────────────────────────────────────────

Renderer.prototype.__adjustItemPosThirdPass = function (item) {

  if (__isServerItem(item, 1622) || __isServerItem(item, 1623)) {
    this.__scratchPos.x -= 8 / 32;
    this.__scratchPos.y -= 8 / 32;
  }
  if (__isServerItem(item, 1634)) {
    this.__scratchPos.x -= 4 / 32;
    this.__scratchPos.y -= 4 / 32;
  }
  if (__isServerItem(item, 1635)) {
    this.__scratchPos.x -= 8 / 32;
  }

}

// ─────────────────────────────────────────────────────────────────────────────
// Boundary item check — adds custom item-ID exclusions
// ─────────────────────────────────────────────────────────────────────────────

Renderer.prototype.__isBoundaryItem = function (item, ids) {

  if (ids.has(item.id)) return true;
  let def = gameClient.itemDefinitions[item.id];
  if (def && def.properties && def.properties.floorchange) return false;
  if (def && (def.id === 1786 || def.id === 1787 || def.id === 1620 || def.id === 1621 || def.id === 1617 || def.id === 1386)) return false;
  if (__itemHasAlwaysOnTop(item)) return true;
  return false;

}

// ─────────────────────────────────────────────────────────────────────────────
// Item layer override — forces certain OnTop items to layer 3
// ─────────────────────────────────────────────────────────────────────────────

var __origGetItemLayer = Renderer.prototype.__getItemLayer;

Renderer.prototype.__getItemLayer = function (item) {

  if (item.id === 919) return 4;
  if (item.hasFlag(PropBitFlag.prototype.flags.DatFlagOnTop)) {
    if (__isServerItem(item, 1786) || __isServerItem(item, 1787) || __isServerItem(item, 1620) || __isServerItem(item, 1621) || __isServerItem(item, 1617)) return 3;
  }
  return __origGetItemLayer.call(this, item);

}
