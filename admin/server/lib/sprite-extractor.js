"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SPR_FILE = path.join(__dirname, "..", "..", "..", "client", "things", "Tibia.spr");
const DAT_FILE = path.join(__dirname, "..", "..", "..", "client", "things", "Tibia.dat");
const CACHE_DIR = path.join(__dirname, "..", "sprites");

// ── v740 constants ──────────────────────────────────────────────────────────

const SPR_SIG = 0x41B9EA86;
const DAT_SIG = 0x41BF619C;
const SPRITE_SIZE = 32;

// v740 flag remapping (from object-buffer.js __mapVersionFlag for version 740)
function mapFlagV740(raw) {
  if (raw > 0 && raw <= 15) {
    if (raw === 5) return 7;  // MultiUse
    if (raw === 6) return 6;  // ForceUse
    return raw + 1;           // 1→2, 2→3, 3→4, 4→5, 7→8, …
  }
  switch (raw) {
    case 16: return 21;  // Light
    case 17: return 252; // FloorChange
    case 18: return 30;  // FullGround
    case 19: return 25;  // Elevation
    case 20: return 24;  // Displacement
    case 22: return 28;  // MinimapColor
    case 23: return 20;  // Rotateable
    case 24: return 26;  // LyingCorpse
    case 25: return 17;  // Hangable
    case 26: return 18;  // HookSouth
    case 27: return 19;  // HookEast
    case 28: return 27;  // AnimateAlways
    default: return raw;  // 0 → Ground(0), 0xFF → Last(255)
  }
}

// Number of extra data bytes for each mapped flag
function flagDataSize(mapped, version) {
  switch (mapped) {
    case 0:  return 2;  // Ground → speed (u16)
    case 8:  return 2;  // Writable
    case 9:  return 2;  // WritableOnce
    case 21: return 4;  // Light → level+color (2× u16)
    case 24: return version >= 755 ? 4 : 0; // Displacement
    case 25: return 2;  // Elevation
    case 28: return 2;  // MinimapColor
    case 29: return 2;  // LensHelp
    case 32: return 2;  // Cloth
    case 34: return 2;  // Usable
    case 33: return -1; // Market → variable size (special)
    default: return 0;
  }
}

// ── Minimal DAT parser (v740 only) ──────────────────────────────────────────

function parseDat() {
  const buf = fs.readFileSync(DAT_FILE);
  const sig = buf.readUInt32LE(0);
  if (sig !== DAT_SIG) {
    throw new Error("Unknown Tibia.dat signature: 0x" + sig.toString(16).toUpperCase());
  }
  const itemCount = buf.readUInt16LE(4);
  const outfitCount = buf.readUInt16LE(6);
  const effectCount = buf.readUInt16LE(8);
  const distanceCount = buf.readUInt16LE(10);
  const totalCount = itemCount + outfitCount + effectCount + distanceCount;
  const spriteIdSize = 2; // v740 uses 16-bit sprite IDs

  const items = {}; // itemId → firstSpriteId

  let off = 12; // skip 12-byte header

  for (let id = 100; id <= totalCount; id++) {
    // ── Read flags until 0xFF (ThingAttrLast) ──
    let groundSeen = false;
    while (off < buf.length) {
      const raw = buf.readUInt8(off++);
      if (raw === 0xFF) break;
      const mapped = mapFlagV740(raw);
      let size = flagDataSize(mapped, 740);
      // Ground (0) only consumes 2 bytes on first occurrence
      if (mapped === 0) {
        if (!groundSeen) { groundSeen = true; }
        else { size = 0; }
      }
      if (size === -1) {
        off += 6;
        const slen = buf.readUInt16LE(off);
        off += 2 + slen + 4;
      } else {
        off += size;
      }
    }

    // v740: groupCount is always 1, type is always 0 (not stored in file)
    // Directly read sprite dimensions
    const w = buf.readUInt8(off++);
    const h = buf.readUInt8(off++);
    if (w > 1 || h > 1) off++; // skip byte for big items

    const layers = buf.readUInt8(off++);
    const px = buf.readUInt8(off++);
    const py = buf.readUInt8(off++);
    // v740 < 755, patternZ = 1 (not stored in file)
    const pz = 1;
    const animLen = buf.readUInt8(off++);

    const numSprites = w * h * layers * px * py * pz * animLen;
    const maxPossible = Math.floor((buf.length - off) / spriteIdSize);
    const total = Math.min(numSprites, Math.max(maxPossible, 0));

    if (total > 0) {
      items[id] = buf.readUInt16LE(off);
    } else {
      items[id] = 0;
    }

    off += total * spriteIdSize;
    if (off > buf.length) break;
  }

  return items;
}

// ── SPR reader ──────────────────────────────────────────────────────────────

function parseSpr() {
  const buf = fs.readFileSync(SPR_FILE);
  const sig = buf.readUInt32LE(0);
  if (sig !== SPR_SIG) {
    throw new Error("Unknown Tibia.spr signature: 0x" + sig.toString(16).toUpperCase());
  }
  const spriteCount = buf.readUInt16LE(4);

  const addresses = {};
  let off = 6;
  for (let i = 1; i < spriteCount; i++) {
    const addr = buf.readUInt32LE(off);
    if (addr !== 0) {
      addresses[i] = addr;
    }
    off += 4;
  }

  return { buf, addresses };
}

// Decode a single sprite from .spr buffer to raw RGBA (Uint8Array, 32×32×4)
function decodeSprite(sprBuf, address) {
  if (!address || address + 5 >= sprBuf.length) {
    return new Uint8Array(SPRITE_SIZE * SPRITE_SIZE * 4); // transparent
  }

  const spriteLength = sprBuf[address + 3] + (sprBuf[address + 4] << 8);
  const pixelData = Buffer.alloc(SPRITE_SIZE * SPRITE_SIZE * 4, 0);

  let srcOff = address + 5; // skip 3-byte color key + 2-byte size
  const end = address + 5 + spriteLength;
  let dstOff = 0;

  while (srcOff < end) {
    const transparent = sprBuf.readUInt16LE(srcOff);
    const colored = sprBuf.readUInt16LE(srcOff + 2);
    srcOff += 4;

    dstOff += transparent * 4; // skip transparent pixels

    for (let i = 0; i < colored; i++) {
      const r = sprBuf[srcOff++];
      const g = sprBuf[srcOff++];
      const b = sprBuf[srcOff++];
      pixelData[dstOff++] = r;
      pixelData[dstOff++] = g;
      pixelData[dstOff++] = b;
      pixelData[dstOff++] = 0xFF;
    }
  }

  return new Uint8Array(pixelData.buffer, pixelData.byteOffset, pixelData.byteLength);
}

// ── Main extractor ──────────────────────────────────────────────────────────

let datItems = null;
let sprData = null;

function ensureLoaded() {
  if (!datItems) { datItems = parseDat(); }
  if (!sprData) { sprData = parseSpr(); }
}

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCachePath(itemId) {
  return path.join(CACHE_DIR, itemId + ".png");
}

function getSpriteIdForItem(itemId) {
  ensureLoaded();
  return datItems[itemId] || null;
}

// Generate PNG for a given sprite ID
async function generateSpritePng(spriteId) {
  ensureLoaded();

  const address = sprData.addresses[spriteId];
  if (!address && spriteId !== 0) {
    return null;
  }

  const rawRgba = decodeSprite(sprData.buf, address || 0);
  const pngBuf = await sharp(rawRgba, {
    raw: { width: SPRITE_SIZE, height: SPRITE_SIZE, channels: 4 }
  }).png().toBuffer();

  return pngBuf;
}

// Get (or generate and cache) PNG for a given item ID
async function getItemSprite(itemId) {
  ensureLoaded();
  ensureCacheDir();

  const cachePath = getCachePath(itemId);

  // Return cached version if exists
  if (fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath);
  }

  const spriteId = getSpriteIdForItem(itemId);
  if (!spriteId) {
    // Generate a placeholder for unknown items
    const placeholder = await sharp({
      create: {
        width: SPRITE_SIZE, height: SPRITE_SIZE,
        channels: 4, background: { r: 30, g: 20, b: 50, alpha: 1 }
      }
    }).png().toBuffer();
    fs.writeFileSync(cachePath, placeholder);
    return placeholder;
  }

  const png = await generateSpritePng(spriteId);
  if (!png) {
    return null;
  }

  // Cache to disk
  fs.writeFileSync(cachePath, png);
  return png;
}

// Pre-generate all item sprites (can be called at startup)
async function pregenerateAll() {
  ensureLoaded();
  ensureCacheDir();

  let generated = 0;
  for (const itemId of Object.keys(datItems)) {
    const cachePath = getCachePath(itemId);
    if (fs.existsSync(cachePath)) continue;

    const spriteId = datItems[itemId];
    if (!spriteId) continue;

    const png = await generateSpritePng(spriteId);
    if (png) {
      fs.writeFileSync(cachePath, png);
      generated++;
    }
  }
  console.log("[sprite-extractor] Pre-generated " + generated + " sprite PNGs");
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = { getItemSprite, pregenerateAll, getSpriteIdForItem };
