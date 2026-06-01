# Performance Migration: Stutter Elimination

## Overview

Eliminated stuttering (micro-travadas) in the Tibia HTML5 client, particularly in crowded areas with 50-157+ entities, summons, and spell effects. Frame-time spikes dropped from 96ms to sub-16ms steady state.

## Phase 1 — Stutter Detection & Per-Frame Instrumentation

### Problem
Unable to identify what caused frame-time spikes — render, input, or event queue.

### Solution
Added per-frame instrumentation to `gameClient.__loop` that breaks down each frame into 4 phases:

```
Queue  (t0→t1):  this.eventQueue.tick()
Sound  (t1→t2):  this.interface.soundManager.tick()
Input  (t2→t3):  this.keyboard.handleInput()
Render (t3→t4):  this.renderer.render()
```

Plus render sub-breakdown via `__renderBreakdown`:
- `T_tile`: tile iteration + per-tile object/creature rendering
- `T_crea`: creature batch sorting and rendering
- `T_flsh`: first `screen.flush()`
- `T_rest`: weather, underground lighting, second flush, deferred battle list refresh

Stutter entries (max 30) are logged when `frameTime > 20ms` or `frameTime > median * 2`. Exposed via `gameClient.getStutterDump()`.

### Files Changed
- `client/src/core/gameclient.js:378-506` — `__loop()` instrumentation, `getStutterDump()`
- `client/src/rendering/renderer.js:42-44` — `totalDrawTime`, `numberOfTiles` fields

### Data Before
```
Median: 3-5ms (most frames smooth)
Stutters: 20-96ms, alternating between Input (19-35ms) and Queue (20-56ms) spikes
```

---

## Phase 2 — Render Pipeline Optimization

### 2a. Tightened Culling Constants

**Problem:** `__getFloorTilesTiles` used generous culling bounds that collected more tiles than necessary:
- Left: -14, Right: 36, Top: -7, Bottom: 18

**Solution:** Tightened to match the superset of all visual consumers:
- Left: -16, Right: 22, Top: -9, Bottom: 11

This reduced visible tiles per floor from ~1050 to ~760.

**Files Changed:** `client/src/rendering/renderer.js` — `CULLING_*` constants in `__getFloorTilesTiles`

### 2b. Background Cache Expansion

**Problem:** `__backgroundCaches` was sized for 8 floors (z=0..7). When `getMaxFloor()` returns 0 (no obstruction above ground), the cache for z>7 was `undefined`.

**Solution:** Expanded array from 8 to 16 slots.

**Files Changed:** `client/src/rendering/renderer.js` — `__backgroundCaches = new Array(16)`

### 2c. Animation Layer Overflow Fix

**Problem:** Animation layers accessed as `__animationLayers[z]` where z can be ≥8 (below ground), causing `undefined` access.

**Solution:** Changed to `__animationLayers[z % 8]`.

**Files Changed:** `client/src/rendering/renderer.js` — all `__animationLayers[z]` accesses

---

## Phase 3 — Creature Batching

### 3a. Batching Implementation

**Problem:** Each creature was rendered individually, causing ~180 WebGL draw calls (texture binds) per frame for 180 entities. Each bind = 1 batch. Draw time was 30-50ms.

**Solution:** Collect all creatures per floor during tile iteration, sort by `outfit.getAppearanceHash()`, then render grouped. Same-outfit creatures (e.g., 10 monks) share one texture bind.

```
Pre-batching:  180+ batches for 180 entities
Post-batching: 13-25 batches for 180 entities (typical)
```

**Algorithm:**
1. Set `__batchingCreatures = true` at floor start
2. `__renderTileObjects` → `__renderCreature` pushes to `__creatureRenderQueue` instead of drawing
3. After tile loop: sort queue by outfit hash
4. Render groups: all same-hash creatures with one texture bind

**Files Changed:** `client/src/rendering/renderer.js:939-972` — `__renderCreature()` batching check, line 46-48 initializer

### 3b. Wall-Passing Bug & Fix

**Bug:** Monsters walking north/west appeared to pass through walls.

**Root Cause:** Tibia defers creatures moving north/west to the previous tile for correct z-ordering (renders them BEHIND the wall). The batching sort by outfit hash destroyed this deferral ordering — deferred creatures would render in arbitrary order, putting them in front of walls.

**Fix:** `__renderDeferred()` now temporarily disables batching so deferred creatures render immediately in natural tile order (behind walls):

```js
// client/src/rendering/renderer.js:918-937
Renderer.prototype.__renderDeferred = function (tile) {
    if (tile.__deferredCreatures.size === 0) return;
    let wasBatching = this.__batchingCreatures;
    this.__batchingCreatures = false;  // ← render inline, not through batch queue
    for (let creature of tile.__deferredCreatures) {
        let creatureTile = gameClient.world.getTileFromWorldPosition(creature.__position);
        this.__renderCreature(creatureTile, creature, true);
    }
    this.__batchingCreatures = wasBatching;
    tile.__deferredCreatures.clear();
};
```

**Files Changed:**
- `client/src/rendering/renderer.js:918-937` — `__renderDeferred` batching bypass
- `client/src/rendering/renderer.js:969-972` — `__renderCreature` batching gate

---

## Phase 4 — Input & DOM Optimization

### 4a. Remove updateTileCache from Keyboard Handler

**Problem:** Every movement key press called `updateTileCache()` inside `keyboard.handleInput()`, which triggered `__collectTilesOnly()` (iterates all chunks × floors). This cost 10-15ms in the Input phase, causing visible input lag.

**Initial state (broken):**
```js
// client/src/input/keyboard.js:258-260
gameClient.renderer.updateTileCache();  // ← 10-15ms
```

**Fix:** Removed from keyboard handler and moved to start of `__renderWorld()`. `updateTileCache()` has an early-return check (`position changed?`), so it's a no-op on frames without movement.

**Files Changed:**
- `client/src/input/keyboard.js:258-260` — removed `updateTileCache()` call
- `client/src/rendering/renderer.js:451` — added `this.updateTileCache()` in `__renderWorld()`

### 4b. Deferred Battle List Refresh

**Problem:** `updateBattleListVisibility()` → `battleWindow.refresh()` iterated ALL 70-150+ DOM elements (creature entries) on EVERY player movement step. This cost 15-26ms and blocked the Input phase.

**Fix — three-pronged:**
1. **Set dirty flag only** in `__handleCreatureMove()` → no DOM during movement
2. **Process at end of `__renderWorld`** → DOM work after frame rendered, not during Input
3. **Throttled to 1 refresh/sec** + deferred via `setTimeout(0)` → non-blocking

**Files Changed:**
- `client/src/core/world.js:131-175` — `__handleCreatureMove()` sets `__battleListDirty = true` instead of calling refresh
- `client/src/core/world.js:117-130` — `updateBattleListVisibility()` returns immediately (actual refresh now done inline)
- `client/src/rendering/renderer.js:620-628` — deferred check in `__renderWorld()`: throttle 1000ms + `setTimeout`
- `client/src/core/world.js:28-30` — `__battleListDirty`, `__lastBattleRefresh` initializers

### Data After Input Fix

```
Before: Input = 19-35ms per movement
After:  Input = 0-4ms per movement
Before: T_rest = 0ms   (battle list refresh was untimed, hidden in Draw gap)
After:  T_rest = 0-26ms (now visible, happens every ~60 frames instead of every step)
```

---

## Phase 5 — Area Spell Blocking

### Problem
Wave/beam/area spells (fire wave, energy beam, ultimate explosion) ignored walls and mountains. Spells passed through solid obstacles.

### Root Cause
Spell definitions in `data/spells/definitions/attack/*.js` used `AREAS.resolveArea()` to get offsets, then sent effects/damage to ALL positions without checking for blocking tiles. Unlike projectile-based spells (runes, distance weapons) which use `Position.inLineOfSight()` to check `isBlockProjectile()`, area spells had no blocking check.

### Solution
Added `AREAS.filterBlocked()` in `area-definitions.js`:

```js
AREAS.filterBlocked = function (world, casterPosition, offsets) {
    return offsets.filter(function (off) {
        let pos = { x: casterPosition.x + off.x, y: casterPosition.y + off.y, z: casterPosition.z };
        let tile = world.getTileFromWorldPosition(pos);
        if (!tile) return false;
        // Block if tile itself blocks projectiles or is solid (mountains)
        if (tile.isBlockProjectile() || tile.isBlockSolid()) return false;
        // Block if line of sight interrupted (wall between caster and target)
        if (!casterPosition.inLineOfSight(pos)) return false;
        return true;
    });
};
```

Filter applied to all 8 area-definition spells:
- fire_wave, energy_wave, berserk, great_energy_beam, energy_beam
- ultimate_explosion, explosion, poison_storm

Single-target spells (flame_strike, force_strike, energy_strike, death_strike) already check the target tile directly and did not need changes.

### Files Changed
- `engine/src/combat/area-definitions.js:261-287` — `AREAS.filterBlocked()`
- `data/spells/definitions/attack/fire_wave.js`
- `data/spells/definitions/attack/energy_wave.js`
- `data/spells/definitions/attack/berserk.js`
- `data/spells/definitions/attack/great_energy_beam.js`
- `data/spells/definitions/attack/energy_beam.js`
- `data/spells/definitions/attack/ultimate_explosion.js`
- `data/spells/definitions/attack/explosion.js`
- `data/spells/definitions/attack/poison_storm.js`

---

## Phase 6 — Render Sub-Timer Instrumentation

### Problem
After Input was fixed, Draw (render world) still showed 20-35ms with only 3-7ms accounted by `T_tile`. The gap of 15-21ms was invisible.

### Instrumentation
Added sub-timers in `__renderWorld` for each setup phase:
- `updateTileCache()` (Cah) — collects tiles when player moves
- `lightscreen.update()` (Lgt) — ambient color interpolation
- `__rebuildBackgroundCaches()` (Rbl) — redraws background canvases
- `screen.clear()` (Clr) — WebGL clear
- `settings.isWeatherEnabled()` (Wth) — DOM settings access
- `lightscreen.setup()` (LCv) — canvas clearRect for light overlay

### Findings
| Phase | Time | Found |
|-------|------|-------|
| Cah | 4-14ms | `__collectTilesOnly()` on player movement |
| Rbl | 3-9ms | Background canvas redraw after movement |
| T_rest (battle list) | 15-26ms | `battleWindow.refresh()` iterating 75+ DOM elements |
| Lgt/Clr/LCv/Wth | 0ms | Irrelevant — removed from final code |

The gap was the battle list refresh, which was executing outside any sub-timer.

### Cleanup
All setup* sub-timers removed from final code. Only `T_tile`, `T_crea`, `T_flsh`, `T_rest` retained for ongoing diagnostics.

---

## Final Performance

### Before (Worst Frame)
```
Total: 96.80ms | Q:  0.00 | I: 35.00 | R: 61.80 | Draw: 53.60
Batches: 180+   | Ents: 78 | Tiles: 4026
```

### After (Typical Frame Without Movement)
```
Total:  3-5ms   | Q: <0.1  | I: <0.1  | R:  3-5 | Draw:  3-5
Batches: 25-40  | Ents: 65-157 | Tiles: 2428-4851
```

### After (Movement Frame)
```
Total: 20-25ms  | Q:  0-4  | I:  0-4  | R: 20-25 | Draw: 19-24
Batches: 25-50  | Cah: 4-14ms | Rbl: 3-9ms | T_rest: 0ms (deferred)
```

### Key Metrics
- **Input phase**: 35ms → 0-4ms (battle list removed + updateTileCache moved)
- **Draw calls**: 180+ → 25-50 (creature batching by outfit hash)
- **DOM refresh**: every movement step → every 1000ms via setTimeout (battle list throttled)
- **Spell wall blocking**: none → per-tile + line-of-sight check (8 spells)
- **Game feel**: unplayable stuttering → smooth movement, monsters respect walls

---

## Complete File Change Log

| File | Lines Changed | Purpose |
|------|--------------|---------|
| `client/src/core/gameclient.js` | 44, 61-62, 378-506 | Stutter detection, `__loop()`, `getStutterDump()` |
| `client/src/rendering/renderer.js` | 40-61, 444-634, 918-972 | Batching, culling, cache, deferral, sub-timers |
| `client/src/input/keyboard.js` | 258-260 | Removed `updateTileCache()` from input handler |
| `client/src/core/world.js` | 28-30, 131-175, 201-215 | Battle list deferral (dirty flag + throttled refresh) |
| `client/src/ui/window-battle.js` | (unchanged) | Refresh called less frequently |
| `engine/src/combat/area-definitions.js` | 261-287 | `AREAS.filterBlocked()` |
| `data/spells/definitions/attack/*.js` | 8 files | Added `filterBlocked()` to area spells |

## Technical Debt & Notes

- The `__renderBreakdown` object accumulates per-frame timing data used exclusively by the stutter detection system. It resets each frame.
- Creature batching uses a single `__creatureRenderQueue` array that is reused across floors. This is safe because each floor's processing is synchronous.
- The `filterBlocked` function in area-definitions.js checks both `isBlockProjectile()` (walls) and `isBlockSolid()` (mountains/structures). The `inLineOfSight` check uses the engine's existing `Geometry.prototype.interpolate` to detect intermediate blocking tiles.
- Deferred battle list refresh uses `setTimeout(0)` to push DOM work to the macrotask queue, avoiding microtask starvation during the render phase.
