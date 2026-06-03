// Helper: check if an item has FLAG_HAS_HEIGHT (bit 8) in its OTB flags
function __itemHasHeight(item) {
  let def = gameClient.itemDefinitions[item.id];
  return def && (def.flags & 8) !== 0;
}

// Multi-tile boundary detection
function __itemHasAlwaysOnTop(item) {
  let fg = item.getFrameGroup(FrameGroup.prototype.NONE);
  if (!fg || (fg.width === 1 && fg.height === 1)) return false;
  let def = gameClient.itemDefinitions[item.id];
  if (def && def.group === 1) return false;
  if (item.hasFlag(PropBitFlag.prototype.flags.DatFlagGroundBorder) &&
      item.hasFlag(PropBitFlag.prototype.flags.DatFlagNotWalkable) &&
      item.hasFlag(PropBitFlag.prototype.flags.DatFlagBlockProjectile)) return false;
  return true;
}

// Helper: check if item matches a server item ID
function __isServerItem(item, serverId) {
  let def = gameClient.itemDefinitions[item.id];
  return def && def.id === serverId;
}

const Renderer = function () {

  this.screen = new Canvas("screen", Interface.prototype.SCREEN_WIDTH_MIN, Interface.prototype.SCREEN_HEIGHT_MIN);

  this.lightscreen = new LightCanvas(null, Interface.prototype.SCREEN_WIDTH_MIN, Interface.prototype.SCREEN_HEIGHT_MIN);

  this.weatherCanvas = new WeatherCanvas(this.screen);

  this.outlineCanvas = new OutlineCanvas(null, 130, 130);

  this.minimap = new Minimap(gameClient.world.width, gameClient.world.height);

  this.debugger = new Debugger();

  this.__start = performance.now();
  this.__nMiliseconds = 0;
  this.totalDrawTime = 0;
  this.drawCalls = 0;
  this.numberOfTiles = 0;

  this.__creatureRenderQueue = [];
  this.__batchingCreatures = false;

  this.__renderOtherFrame = 0;

  this.__scratchPos = new Position(0, 0, 0);

  this.__renderLayers = [[], [], [], [], []];

  this.__scratchElevation = [];

  this.__OVERLAY_IDS = new Set([1215, 1216, 1218]);
  this.__BOUNDARY_IDS = new Set([1211, 1385]);
  this.__COVER_IDS = new Set([873,874,875,876,877,878,903,904,905,906,907,908,909,910,911,912,913,914,915,916,917,921,922,923,1217,1387]);

  this.__renderBreakdown = { tiles: 0, creatures: 0, flush: 0, rest: 0, rebuild: 0, tileObj: 0, creatureSort: 0, deferred: 0, anim: 0, distAnim: 0, combat: 0, weather: 0, light: 0 };
  this.__scratchPos2 = new Position(0, 0, 0);

  this.__combatRects = [];

  this.__npcIconQueue = [];

  this.__tileCache = new Array();

  this.__tileCacheSlots = [];
  for (let i = 0; i < 9; i++) {
    this.__tileCacheSlots.push({ tiles: [], z: 0 });
  }

  this.__lastCacheX = -1;
  this.__lastCacheY = -1;
  this.__lastCacheZ = -1;

  this.__backgroundCaches = new Array(16);
  for (let i = 0; i < 16; i++) {
    this.__backgroundCaches[i] = new Canvas(null, Interface.prototype.SCREEN_WIDTH_MIN, Interface.prototype.SCREEN_HEIGHT_MIN);
  }

  this.__tileCacheNeedsRebuild = false;

  this.__skipNextLightFrame = false;

  this.__createAnimationLayers();

  this.skullImages = {};
  let skullNames = {
    1: "skull_yellow.png",
    2: "skull_green.png",
    3: "skull_white.png",
    4: "skull_red.png",
    5: "skull_black.png",
    6: "skull_orange.png",
    8: "pink_skull.png"
  };
  for (let id in skullNames) {
    let img = new Image();
    img.src = "./images/game/skulls/" + skullNames[id];
    this.skullImages[id] = img;
  }

  this.shieldImages = {};
  let shieldNames = {
    1: "shield_yellow_shared.png",
    2: "shield_yellow_not_shared.png",
    3: "shield_blue_shared.png",
    4: "shield_blue_not_shared.png",
    5: "invited_party_member.png",
    6: "party_request.png"
  };
  for (let id in shieldNames) {
    let img = new Image();
    img.src = "./images/game/states/" + shieldNames[id];
    this.shieldImages[id] = img;
  }

  this.npcTradeIcon = new Image();
  this.npcTradeIcon.src = "./images/game/balloons/icon_trade.png";

  this.npcBankIcon = new Image();
  this.npcBankIcon.src = "./images/game/balloons/icon_tradequest.png";

  this.typingIcon = new Image();
  this.typingIcon.src = "./images/game/balloons/icon_chat.png";

  this.npcTravelIcon = new Image();
  this.npcTravelIcon.src = "./images/game/balloons/icon_traveler.png";

  this.npcSpellIcon = new Image();
  this.npcSpellIcon.src = "./images/game/balloons/icon_spell.png";

}

Renderer.prototype.render = function () {

  this.__increment();

  this.__renderWorld();

  this.__renderOther();

  this.debugger.renderStatistics();
  this.debugger.renderHUD();

}

Renderer.prototype.getTileCache = function () {

  return this.__tileCache;

}

Renderer.prototype.updateTileCache = function () {

  let pos = gameClient.player.getPosition();
  let moved = (pos.x !== this.__lastCacheX || pos.y !== this.__lastCacheY || pos.z !== this.__lastCacheZ);

  if (!moved) return;

  this.__lastCacheX = pos.x;
  this.__lastCacheY = pos.y;
  this.__lastCacheZ = pos.z;

  this.__collectTilesOnly();
  this.__tileCacheNeedsRebuild = true;

}

Renderer.prototype.takeScreenshot = function (event) {

  event.preventDefault();

  let element = document.createElement("a");
  element.download = "screenshot-%s.png".format(new Date().toISOString());

  Object.values(gameClient.world.activeCreatures).forEach(function (activeCreature) {

    let style = window.getComputedStyle(activeCreature.characterElement.element.querySelector("span"));
    let position = this.getCreatureScreenPosition(activeCreature);

    this.screen.renderText(
      activeCreature.name,
      32 * position.x,
      32 * position.y,
      style.color,
      style.font
    );

  }, this);

  gameClient.interface.screenElementManager.activeTextElements.forEach(function (element) {

    let style = window.getComputedStyle(element.element.querySelector("span"));
    let position = this.getStaticScreenPosition(element.__position);

    this.screen.renderText(
      element.__message,
      32 * position.x,
      32 * position.y,
      style.color,
      style.font
    );

  }, this);

  element.href = this.screen.toDataURL();
  element.click();
  element.remove();

}

Renderer.prototype.setAmbientColor = function (r, g, b, a) {

  this.lightscreen.setAmbientColor(r, g, b, a);

}

Renderer.prototype.setWeather = function (bool) {

  this.weatherCanvas.setWeather(bool);

}

Renderer.prototype.addDistanceAnimation = function (packet) {

  let animationId = gameClient.dataObjects.getDistanceAnimationId(packet.type);

  if (animationId === null) {
    return;
  }

  let animation = new DistanceAnimation(animationId, packet.from, packet.to);

  this.__animationLayers[packet.from.z % 8].add(animation);

}

Renderer.prototype.addPositionAnimation = function (packet) {

  let tile = gameClient.world.getTileFromWorldPosition(packet.position);

  if (tile === null) {
    return;
  }

  let animationId = gameClient.dataObjects.getAnimationId(packet.type);

  if (animationId === null) {
    return;
  }

  return tile.addAnimation(new Animation(animationId));

}

Renderer.prototype.getStaticScreenPosition = function (position) {

  let player = gameClient.player;
  let p = player.getPosition();
  let pz = p.z % 8;
  let tz = position.z % 8;

  this.__scratchPos.x = 14 + player.getMoveOffset().x + (position.x + tz) - (p.x + pz);
  this.__scratchPos.y = 7 + player.getMoveOffset().y + (position.y + tz) - (p.y + pz);

  return this.__scratchPos;

}

Renderer.prototype.getCreatureScreenPosition = function (creature) {

  let player = gameClient.player;
  let cp = creature.getPosition();
  let pp = player.getPosition();
  let pz = pp.z % 8;
  let cz = cp.z % 8;
  let cmo = creature.getMoveOffset();

  this.__scratchPos2.x = 14 + player.getMoveOffset().x + (cp.x + cz) - (pp.x + pz) - cmo.x;
  this.__scratchPos2.y = 7 + player.getMoveOffset().y + (cp.y + cz) - (pp.y + pz) - cmo.y;

  return this.__scratchPos2;

}

Renderer.prototype.__increment = function () {

  this.__nMiliseconds = (performance.now() - this.__start);

}

Renderer.prototype.__renderOther = function () {

  this.__renderOtherFrame++;

  if (this.__renderOtherFrame % 2 !== 0) {
    return;
  }

  gameClient.player.equipment.render();
  gameClient.interface.modalManager.render();

  this.__renderContainers();

  gameClient.world.clock.updateClockDOM();

  gameClient.interface.screenElementManager.render();

  gameClient.interface.windowManager.getWindow("party-window").sync();

  gameClient.interface.__updateBoostDisplay();

}

Renderer.prototype.__renderContainers = function () {

  gameClient.player.__openedContainers.forEach(container => container.__renderAnimated());

}

// ─────────────────────────────────────────────────────────────────────────────
// Base overrides (replaced by renderer-custom.js for item-specific adjustments)
// ─────────────────────────────────────────────────────────────────────────────

Renderer.prototype.__isBoundaryItem = function (item, ids) {
  if (ids.has(item.id)) return true;
  let def = gameClient.itemDefinitions[item.id];
  if (def && def.properties && def.properties.floorchange) return false;
  if (__itemHasAlwaysOnTop(item)) return true;
  return false;
}

Renderer.prototype.__adjustItemPosSecondPass = function () {}
Renderer.prototype.__adjustItemPosThirdPass = function () {}

Renderer.prototype.__getItemLayer = function (item) {
  if (item.hasFlag(PropBitFlag.prototype.flags.DatFlagGround)) return 0;
  if (item.hasFlag(PropBitFlag.prototype.flags.DatFlagGroundBorder)) return 1;
  if (item.hasFlag(PropBitFlag.prototype.flags.DatFlagOnBottom)) return 2;
  if (item.hasFlag(PropBitFlag.prototype.flags.DatFlagOnTop)) {
    return 4;
  }
  return 3;
}

Renderer.prototype.__handleVisibiliyChange = function (event) {

  if (!document.hidden) {
    return;
  }

  Object.values(gameClient.world.activeCreatures).forEach(function (creature) {
    creature.__movementEvent = null;
  });

}

Renderer.prototype.__drawCastbar = function (creature) {

  let position = this.getCreatureScreenPosition(creature);
  position.y += 6 / 32;
  let fraction = creature.getCastFraction();
  let color = "white";

  if (fraction === 1) {
    creature.endCast();
  }

  if (creature.__spell.channel !== null) {
    fraction = 1 - fraction;
  }

  this.screen.drawBar(32, 4, position, fraction, color);

}

Renderer.prototype.__createAnimationLayers = function () {

  this.__animationLayers = new Array();

  for (let i = 0; i < 8; i++) {
    this.__animationLayers.push(new Set());
  }

}
