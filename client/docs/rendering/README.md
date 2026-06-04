# Rendering System — Overview

The rendering pipeline draws the game world on a `<canvas>` element using WebGL
(with Canvas 2D fallback). This document describes the architecture, coordinate
system, culling, caching layers, and all modifications made for mobile support.

## Files

| File | Role |
|---|---|
| `src/rendering/renderer.js` | Renderer constructor — owns all state, creates canvases, defines offsets and culling margins |
| `src/rendering/renderer-world.js` | World rendering — tile collection, background cache rebuild, `__renderWorld` loop |
| `src/rendering/renderer-tile.js` | Per-tile rendering — item layers, boundary/cover/overlay objects |
| `src/rendering/renderer-creature.js` | Creature rendering — players, monsters, NPCs |
| `src/rendering/canvas.js` | Low-level Canvas abstraction — GL quad draw, sprite drawing, coordinate mapping |
| `src/rendering/screen-element.js` | DOM overlay elements — nicknames, speech bubbles, floating text |
| `src/rendering/effects.js` | Visual effects rendering |
| `src/ui/mobile-fullscreen.js` | Mobile detection, fullscreen, canvas resize, mobile-specific overrides |

## Canvas

- **Main canvas** (`#screen`): WebGL canvas, initially `1080 × 482` (desktop).
  On mobile it is resized to a square `480 × 480` via `screen.width/height`
  assignment (not CSS sizing).
- **BG cache canvases**: 16 Canvas 2D offscreen canvases (one per floor z-level),
  created at `SCREEN_WIDTH_MIN × SCREEN_HEIGHT_MIN` (1080 × 482). Cached non-animated
  ground tiles are drawn here at 32 px per tile, then composited into the main
  canvas each frame as a single `drawImage` call.

## Coordinate System

### Tile positions (world → screen)

```
screenX = playerTileOffsetX + moveOffset.x + (tile.x + tile.z) - (player.x + player.z)
screenY = playerTileOffsetY + moveOffset.y + (tile.y + tile.z) - (player.y + player.z)
```

- `playerTileOffsetX/Y`: center of the visible area in tile units (`7.5` on mobile, `14/7` on desktop).
- `moveOffset`: fractional tile offset during movement animation (`-1..0` or `0..1`, from `creature.js:363-394`).

### Pixel conversion

```
destX = (32 * screenX + 0.5) | 0
destY = (32 * screenY + 0.5) | 0
```

The `+0.5` rounds to nearest pixel (equivalent to `Math.round`).

### World coordinates from click (inverse)

In `canvas.js:getWorldCoordinates`:
```
tileX = Math.floor(x / scaling.x + playerTileOffsetX - offset.x)
tileY = Math.floor(y / scaling.y + playerTileOffsetY - offset.y)
```

`offset.x/y` = `playerTileOffsetX/Y` from the renderer.

## Culling

### Foreground culling (`__cullMargin*`)

Applied in `__renderWorld` (renderer-world.js:168-171):
```
__cullLeft   = playerTileOffsetX - __cullMarginLeft
__cullRight  = playerTileOffsetX + __cullMarginRight
__cullTop    = playerTileOffsetY - __cullMarginTop
__cullBottom = playerTileOffsetY + __cullMarginBottom
```

Tiles with `screenX/Y` outside this range are skipped entirely (no items, no
creatures, no deferred rendering).

### Background cache culling (`__bgCullMargin*`)

Used in two places:
1. **Tile collection** (`__getFloorTilesTiles`, renderer-world.js:64-101): collects
   tiles from the world chunks into the tile cache. The range is dynamic:
   ```
   CULLING_LEFT   = -(bgCullMarginLeft  + Math.max(moveOffset.x, 0))
   CULLING_RIGHT  =  bgCullMarginRight  + Math.max(-moveOffset.x, 0)
   CULLING_TOP    = -(bgCullMarginTop   + Math.max(moveOffset.y, 0))
   CULLING_BOTTOM =  bgCullMarginBottom + Math.max(-moveOffset.y, 0)
   ```
   The `Math.max(moveOffset, 0)` / `Math.max(-moveOffset, 0)` adds 1 extra tile
   on the leading movement side.

2. **Background cache rebuild** (`__rebuildBackgroundCaches`, renderer-world.js:48-49):
   filters the collected tiles by the static bg cache range.

### Values

| Context | `playerTileOffset` | `cullMargin` | `bgCullMargin` |
|---|---|---|---|
| **Desktop** | X=14, Y=7 | L=12 R=16 T=7 B=7 | L=16 R=22 T=9 B=11 |
| **Mobile FS** | **7.5** (both) | **14** (all sides) | **16** (all sides) |

## Background Cache

The background cache (`__backgroundCaches[z]`) is an offscreen 2D canvas per
floor level. It pre-renders non-animated ground tiles so they don't need to be
redrawn each frame.

### What goes into the cache

In `__rebuildBackgroundCaches` (renderer-world.js:19-62):
- Iterates all tiles in the tile cache for this floor.
- Skips `tile.id === 0` (air) and `tile.isAnimated()`.
- Computes screen position WITHOUT moveOffset.
- Culls by `__bgCullMargin*`.
- Draws via `cacheCanvas.drawSprite(tile, pos, 64)`.

### Cache shift (mobile only)

To prevent a black gap on the LEFT edge when walking RIGHT (caused by entering
tiles being clipped at Canvas 2D pixel 0 in the cache), a 32 px content shift
is applied:

```js
// renderer-world.js:34-38
var shiftX = this.__bgCacheShiftX * 32;
if (shiftX && cacheCanvas.context) {
  cacheCanvas.context.translate(shiftX, 0);
}
```

When compositing onto the main canvas, the quad position compensates:

```js
// renderer-world.js:181
this.screen.drawImage(cacheCanvas, mo.x * 32 - this.__bgCacheShiftX * 32, mo.y * 32 - this.__bgCacheShiftY * 32);
```

The shift + quad cancel geometrically — tiles appear at the same viewport
positions — but the content shift ensures tiles at negative destX (which would
be clipped at Canvas 2D pixel 0) become fully visible in the cache.

### Why Y is also shifted (mobile only)

With `playerTileOffset = 7.5`, the first tile (`pp - 7`) starts at pixel 16,
leaving a 16 px gap on the TOP and LEFT edges at rest. This gap becomes visible
because the bg cache canvas (default 1080×482) clips tiles at dest < 0.

The fix is **twofold**:
1. Increase the bg cache canvas height from 482 to **576** (18 tiles × 32 px)
   so vertical content with the 32 px shift fits without clipping.
2. Set both `shiftX = 1` and `shiftY = 1` to translate content +32 px on both
   axes, making entering tiles at dest -15 become fully visible in the cache.

The 576 px height provides room for the 16-tile viewport range (512 px) plus
the 32 px shift (544 px total) with some safety margin.

| Property | Location | Desktop | Mobile |
|---|---|---|---|
| `__bgCacheShiftX` | mobile-fullscreen.js:321 | 0 | 1 |
| `__bgCacheShiftY` | mobile-fullscreen.js:322 | 0 | 1 |
| `__backgroundCaches[i]` size | renderer.js → mobile-fullscreen.js:325-332 | 1080×482 (constructor) | 1080×576 (recreated in `__adjustCanvas`) |

## Entry Edge Rendering

During movement, tiles that are "entering" the screen (previously offscreen)
are rendered in the foreground by `__renderTile()` to cover the gap before
the next background cache rebuild.

### Conditions (renderer-world.js:217-226)

```js
if (mo.x > 0 && sx < playerTileOffsetX - 12.5) onEntryEdge = true;  // DEAD CODE on mobile
if (mo.x < 0 && sx > playerTileOffsetX + 14)   onEntryEdge = true;  // DEAD CODE on mobile
if (mo.y > 0 && sy < playerTileOffsetY - 5.5)  onEntryEdge = true;  // active
if (mo.y < 0 && sy > playerTileOffsetY + 5)    onEntryEdge = true;  // active
```

The X conditions are outside the foreground culling range (cullLeft = -0.5,
cullRight = 15.5) and never trigger. The X dimension relies entirely on the
bg cache shift. The Y conditions ARE within range and handle vertical entry.

## Mobile-specific Overrides

All in `mobile-fullscreen.js`:

| Property | Desktop | Mobile | Why |
|---|---|---|---|
| `playerTileOffsetX` | 14 | 7.5 | Center 15-tile square canvas |
| `playerTileOffsetY` | 7 | 7.5 | Center 15-tile square canvas |
| `cullMargin*` | L=12 R=16 T=7 B=7 | 8 all | Minimum uniform margin |
| `bgCullMargin*` | L=16 R=22 T=9 B=11 | 10 all | 2 tiles over foreground for safety |
| `bgCacheShiftX` | 0 | 1 | Fix left gap on RIGHT movement |
| `bgCacheShiftY` | 0 | 0 | Avoid bottom gap (entry edge handles Y) |

## Performance

- **Tiles rendered per frame (mobile):**
  - Foreground culling at rest: 16 × 16 = 256 tiles max.
  - During movement: 17 × 17 = 289 tiles max (1 extra entering tile per axis).
  - Background cache: 21 × 21 = 441 tiles max at rest, ~484 during movement.

- **Background cache** is rebuilt only when `__tileCacheNeedsRebuild` is set
  (player changes floor or crosses a chunk boundary). Each frame it's drawn
  once via `drawImage` — cheap.

- **Culling granularity**: per-tile check in JS. The `__getFloorTilesTiles`
  pre-filters by world chunk, then by position range, then by `player.canSee`.

## Inherent Asymmetry

With `playerTileOffset = 7.5`, a 16 px gap exists on the LEFT edge at rest
because tile `pp.x - 7` starts at pixel 16 (position 0.5). This is fundamental
to the 15-tile canvas with a centered player — the gap falls on one side only
and cannot be eliminated without changing the tile offset to an integer (which
would shift the gap to 32 px instead).

The bg cache shift fixes a SECOND gap (black bar during RIGHT movement) caused
by Canvas 2D clipping entering tiles at destX < 0 in the cache. By shifting
content +32 px, entering tiles at position -0.5 move from destX -15 to destX
+17, fully inside the canvas.
