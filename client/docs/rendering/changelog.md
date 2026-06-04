# Rendering Changes — Changelog

All modifications to the rendering system for mobile fullscreen support.

---

## 1. Dynamic tile offsets (`renderer.js:27-28`)

**What**: Replaced hardcoded `14`/`7` in calculations throughout the 4 renderer
files with `this.playerTileOffsetX/Y`.

**Files affected**:
- `renderer.js`: Added properties to constructor (lines 27-28)
- `renderer-world.js`: Lines 46-47, 117-118, 195-196, 210-211
- `renderer-creature.js`: Lines 34-35
- `renderer-tile.js`: Lines 14-15, 19 (culling check)

**Why**: Mobile uses a 480×480 square canvas centered at 7.5 tiles from each
edge, while desktop uses 1080×482 with offsets 14/7.

---

## 2. Dynamic culling margins (`renderer.js:29-36`)

**What**: Replaced hardcoded culling boundary values with
`this.__cullMargin*/__bgCullMargin*` properties.

**Files affected**:
- `renderer.js`: Added properties to constructor (lines 29-36)
- `renderer-world.js`: Lines 48-49, 73-76, 168-171, 197, 213

**Why**: Mobile needs symmetric 8 (foreground) / 10 (bg cache) margins while
desktop uses asymmetric values.

---

## 3. Background cache shift (`renderer.js:37-38`)

**What**: Added `__bgCacheShiftX/Y` properties. When non-zero, the bg cache
content is offset by `shift*32` pixels via `context.translate()`, and the quad
position is offset by `-shift*32` to compensate.

**Files affected**:
- `renderer.js`: Lines 37-38 (default 0/0)
- `renderer-world.js`: Lines 34-38, 53-55 (translate/restore), line 181 (quad)
- `mobile-fullscreen.js`: Line 321 (`__bgCacheShiftX = 1`), line 322 (`= 0`)

**Why**: Fixes black gap on LEFT edge during RIGHT movement. Entering tiles at
world position -0.5 have `destX = -15` in the cache canvas — Canvas 2D clips at
pixel 0, so the right 17 px of the sprite goes missing. Shift +32 moves it to
`destX = 17`, fully visible.

**Limitation**: The 1080×482 bg cache canvas is wide enough for the horizontal
shift (29 tiles = 928 px < 1080), but NOT tall enough for a vertical shift
(29 tiles = 928 px >> 482). Setting `shiftY = 0` avoids clipping bottom content.

---

## 4. Click-to-world coordinate mapping (`canvas.js`)

**What**: Changed `getWorldCoordinates` to use `renderer.playerTileOffsetX/Y`
instead of hardcoded `-14`/`-7`. Also reordered `Math.floor` application.

**Before**:
```js
Math.floor(x / sx) + position.x - ox
```

**After**:
```js
Math.floor(x / sx + position.x - ox)
```

**File**: `canvas.js`

**Why**: The old formula only works when `playerTileOffset` is an integer.
With `7.5`, the fractional part was lost inside `Math.floor(x/sx)`, shifting
click-to-world targets by 0.5 tiles.

---

## 5. Scale origin (`canvas.js`)

**What**: `setScale()` uses dynamic `renderer.getPlayerTileOffset()` values
instead of `14 * 32` / `7 * 32`.

**File**: `canvas.js`

**Why**: Same as #1 — desktop vs mobile offsets differ.

---

## 6. `__getFloorTilesTiles` static culling removed (`renderer-world.js:73-76`)

**What**: Replaced hardcoded `-16/22/-9/11` with dynamic
`-(bgCullMargin + max(mo, 0))` / `bgCullMargin + max(-mo, 0)`.

**File**: `renderer-world.js`

**Why**: Desktop and mobile use different bgCullMargin values. The old
hardcoded values matched desktop only.

---

## 7. Nickname positioning (`screen-element.js`)

**What**: In the mobile fullscreen path, `__getAbsoluteOffset` no longer adds
`cox`/`coy` (canvas viewport offset). Nicknames are `position: absolute`
children of `#canvas-id`, which fills the entire viewport on mobile.

**File**: `screen-element.js`

**Why**: On desktop, the canvas has an offset within the game wrapper and
desktop fullscreen uses that offset. On mobile, the canvas IS the viewport.

---

## 8. Bg cache enlarged + both axes shifted (`mobile-fullscreen.js`)

**What**: Set `__bgCacheShiftY = 1` (was 0) and recreate the 16 bg cache
canvases at 1080×576 (was 1080×482, too short). The larger canvas accommodates
the 32 px vertical shift without clipping bottom content.

**Why**: With `playerTileOffset = 7.5`, tiles at position -0.5 (`pp - 8`) have
dest = -15 at the canvas edge. Without a Y shift, the TOP gap remains because
the Canvas 2D clips dest < 0. The 482 px height was insufficient for the 32 px
Y shift (16 tiles + 32 px = 544 px needed; 482 < 544 → bottom clipped). At
576 px, both the shifted content and the full viewport range fit.

**Performance**: 576 × 1080 = 622,080 px vs 482 × 1080 = 520,560 px per cache
canvas (~20% larger, 16 canvases = ~2 MB more total).

---

## 9. Culling margins tightened (`mobile-fullscreen.js`)

**What**: Foreground culling set to **10** tiles per side; background cache to **12**.
Previously reduced to 8/10, but that caused objects (items, creatures) to be
rendered only when they entered the viewport — visible delay on entering tiles.

At 10, objects start rendering 2.5 tiles off-screen (cullLeft = 7.5 - 10 = -2.5).
With 500 ms per tile movement, this gives ~1250 ms of pre-render time — enough
for objects to be ready before the tile scrolls into view.

**Total rendered area (at rest)**: 20 × 20 = 400 tiles foreground, 24 × 24 = 576 tiles in tile cache.

**Why**: The extra margin was unnecessary — only 1 tile of movement buffer is
needed (the entering tile during movement). The old values rendered ~625
foreground tiles when ~256 suffice.

### Margin derivation

| Type | Calculation | Value |
|---|---|---|
| Visible | `playerTileOffset = 7.5` | 15 tiles |
| Pre-render buffer | objects rendered this many tiles before entering viewport | 6.5 |
| **Foreground margin** | | **14** |
| BG cache | 2 tiles beyond foreground for safety | **16** |

---

## 10. BG cache height increased to 640 px (`mobile-fullscreen.js`)

With `bgCullMargin = 16` on all sides, the bg cache draws tiles from -8.5 to
23.5 (32 tiles = 1024 px range). After the 32 px shift and quad offset, the
viewport reads up to cache pixel 544 during UP movement. Height raised from
576 to **640** to safely accommodate the wider culling + shift.

---

## 11. Old touch/D-pad system removed

Deleted files:
- `data/layouts/mobile-tablet/` (entire directory, 7 files)
- `client/src/input/touch.js`

Removed references from 7 files (launcher.js, gameclient.js, manager.js,
base.css, tv/main.js, desktop/main.css × 2).

---

## 12. New modern D-pad added (`mobile-fullscreen.js`)

A touch-based virtual D-pad built directly into `mobile-fullscreen.js`:

- **Position**: bottom-left of screen, 150 × 150 px circle
- **Design**: semi-transparent dark radial gradient with white arrow indicators
- **Detection**: angle-based 8-direction (N, S, E, W, NE, NW, SE, SW)
- **Dead zone**: 18 px center radius prevents accidental moves
- **Auto-repeat**: immediate first step + 150 ms interval while holding
- **Integration**: calls `Keyboard.handleMoveKey(direction)` — the same API
  used by mouse drag and keyboard input
- **Lifecycle**: shown on fullscreen enter, hidden on exit, cleaned up on
  fullscreen change

Key properties:
- `DPAD_SIZE = 150` (px, visual diameter)
- `DPAD_DEAD_ZONE = 18` (px, center dead zone)
- `DPAD_INTERVAL_MS = 150` (ms between auto-repeat steps)
