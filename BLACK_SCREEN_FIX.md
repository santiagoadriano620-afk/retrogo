# Black Screen After Tab Return - FIX APPLIED

## Problem
After minimizing the browser tab and returning, the game displayed a black screen with an infinite `requestAnimationFrame` loop instead of rendering correctly.

Console error:
```
[render] BLACK SCREEN — pos=(32082,32193,7) chunks=49 tileCacheFloors=8 canvas=(1080x482) rebuild=false
```

## Root Cause
During tab return, the v2 desync fix was attempting to rebuild rendering caches, but several defensive checks were missing:

1. **Invalid cache index access** - `__backgroundCaches[z]` could be undefined if `z` > 15
2. **Null player access** - calling `gameClient.player.getPosition()` when player might be null
3. **Unhandled exceptions** - `player.canSee()` could throw without try-catch
4. **Null creature states** - `activeCreatures` could be undefined during reset

## Solution Applied

### Files Modified

#### 1. `client/src/rendering/renderer-world.js`
- Added bounds check in `__rebuildBackgroundCaches`: `if (!cacheCanvas || z < 0 || z >= 16) continue;`
- Added bounds check in drawImage loop: same guard prevents accessing undefined cache
- Wrapped `player.canSee()` in try-catch in `__getFloorTilesTiles`

#### 2. `client/src/ui/desktop/interface.js`
- Added `if (gameClient.renderer && gameClient.player)` check before `updateTileCache()`
- Added `if (gameClient.world && gameClient.player)` check before `__refreshNeighboursLarge()`
- Applied to both full-reset (>2s hidden) and brief-hide branches

#### 3. `client/src/core/gameclient.js`
- Changed `__pendingTabReturn` guard from `&& this.player` to `&& this.player && this.world && this.renderer`

#### 4. `client/src/core/world.js`
- Added `if (!this.activeCreatures) return;` guard in `__resetCreatureStates`
- Added `if (!creature) return;` check in creature iteration

## Testing
✓ Minimize tab for 3+ seconds
✓ Return to tab - should show game normally, NOT black screen
✓ Console should NOT show errors or warnings about invalid cache indices (in normal operation)
✓ Normal gameplay continues smoothly after tab return

## Related Documentation
See `AGENTS.md` → "Black screen fix on tab return" section for full technical details.
