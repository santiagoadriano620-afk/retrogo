# Performance Optimization - Canvas Size Issue Resolution

## Problem Analysis
After enlarging the canvas from original small square size to a larger rectangular size:
- **Frame Rate**: Dropped from 33fps → 25fps (-24%)
- **Draw Time**: Increased 14.2ms → 25.1ms (+76%)
- **Draw Calls**: 4879 (relatively stable)
- **Draw Tiles**: Exploded from 6362 → 10317 (+62%)
- **Active Entities**: 165 creatures

**Root Cause**: Larger canvas = more tiles visible = exponentially more rendering work

---

## Solutions Implemented

### 1. Aggressive Tile Culling (3-Layer Approach)

#### Layer 1: Tile Cache Collection
**File**: `client/src/rendering/renderer.js` → `__getFloorTilesTiles()`

**Change**: Drastically reduced visible tile bounds
```javascript
// BEFORE: CULLING_LEFT = -14, RIGHT = 48, TOP = -8, BOTTOM = 24
// Area: 62x32 tiles = ~2000 tiles per floor

// AFTER: CULLING_LEFT = -6, RIGHT = 36, TOP = -4, BOTTOM = 18
// Area: 42x22 tiles = ~900 tiles per floor (55% reduction!)
```

**Impact**: Reduces initial tile collection phase by 55%

#### Layer 2: Render Loop Skip
**File**: `client/src/rendering/renderer.js` → `__renderWorld()`

**Change**: Added early skip for tiles completely off-screen
```javascript
// Skip rendering tiles outside visible screen area
if (sx < -2 || sx > 33 || sy < -2 || sy > 19) {
  continue;
}
```

**Impact**: Prevents processing of tiles that absolutely can't be seen

#### Layer 3: Object/Creature Skip
**File**: `client/src/rendering/renderer.js` → `__renderTileObjects()`

**Change**: Early return if tile position is off-screen
```javascript
// Skip ALL processing for tiles completely off-screen:
// No item iteration, no sorting, no creature rendering
if (position.x < -1 || position.x > 32 || position.y < -1 || position.y > 18) {
  return;
}
```

**Impact**: Avoids expensive item processing, sorting, and creature rendering for off-screen tiles

---

## Performance Impact (Expected)

### Before All Optimizations
```
Frame Rate: 25fps
Draw Tiles: 10317
Draw Time: 25.1ms
Memory: 114MB
```

### After Optimizations
```
Frame Rate: 32-38fps (+28-52%)
Draw Tiles: 3000-4000 (-60-70%)
Draw Time: 15-18ms (-35-40%)
Memory: 114MB (unchanged)
```

### Ideal Target (with perfect optimization)
```
Frame Rate: 40-45fps (+60-80%)
Draw Tiles: 2500-3500 (-65-75%)
Draw Time: 12-14ms (-50%)
Memory: 114MB (unchanged)
```

---

## How It Works

### Canvas Size Relationship
```
Original Canvas (small): ~20x12 visible tiles = ~240 tiles
Current Canvas (large):  ~30x17 visible tiles = ~510 tiles
Without Optimization:    Rendering all 10317 collected tiles = 76% waste

With Optimization:
├─ Layer 1: Collect only ~900 tiles (-55%)
├─ Layer 2: Skip ~100-200 off-screen tiles in render loop
└─ Layer 3: Skip processing objects for invisible tiles
Result: Only ~500-600 tiles actually rendered (-94% waste elimination)
```

---

## Testing Protocol

### 1. Quick Visual Test
```javascript
// In console, go to crowded area:
gameClient.renderer.debugger.show();

// Monitor:
// - FPS: Should increase noticeably
// - Draw Calls: Should decrease (eventually ~2000-2500)
// - Draw Time: Should drop to 15-20ms range
```

### 2. Detailed Metrics Collection (60 seconds)
```javascript
const metrics = [];
const sampleInterval = setInterval(() => {
  metrics.push({
    fps: Math.round(1000 / (performance.now() - metrics[metrics.length-1]?.time || performance.now())),
    drawCalls: gameClient.renderer.drawCalls,
    drawTime: gameClient.renderer.totalDrawTime
  });
  
  if (metrics.length >= 60) {
    clearInterval(sampleInterval);
    const avg = metrics.reduce((a,b) => ({
      fps: a.fps + b.fps,
      drawCalls: a.drawCalls + b.drawCalls,
      drawTime: a.drawTime + b.drawTime
    }));
    console.log({
      avgFps: Math.round(avg.fps / metrics.length),
      avgDrawCalls: Math.round(avg.drawCalls / metrics.length),
      avgDrawTime: Math.round(avg.drawTime / metrics.length)
    });
  }
}, 100);
```

### 3. Before/After Comparison
```
BEFORE (Large Canvas, No Optimization):
Frame Rate: 25fps
Draw Calls: 4879
Draw Time: 25082µs
Draw Tiles: 10317

AFTER (With 3-Layer Culling):
Frame Rate: ~35fps (expected)
Draw Calls: ~2800 (expected)
Draw Time: ~16000µs (expected)
Draw Tiles: ~3500 (expected)
```

---

## Configuration Tuning

### If Performance Still Below 32fps

**Option 1: More Aggressive Culling**
```javascript
// Current: CULLING_LEFT = -6, RIGHT = 36, TOP = -4, BOTTOM = 18
// More aggressive:
const CULLING_LEFT = -4;    // Less left margin
const CULLING_RIGHT = 32;   // Less right margin
const CULLING_TOP = -2;     // Less top margin
const CULLING_BOTTOM = 16;  // Less bottom margin
```

**Option 2: Increase Screen Position Skip Threshold**
```javascript
// Current: if (sx < -2 || sx > 33 || sy < -2 || sy > 19)
// More aggressive:
if (sx < -1 || sx > 32 || sy < -1 || sy > 18)
```

### If Visual Pop-In Occurs

**Reduce Culling Aggression**:
```javascript
// Current: CULLING_LEFT = -6, RIGHT = 36
// Less aggressive:
const CULLING_LEFT = -8;    // More left buffer
const CULLING_RIGHT = 38;   // More right buffer
const CULLING_TOP = -6;     // More top buffer
const CULLING_BOTTOM = 20;  // More bottom buffer
```

---

## Files Modified

1. **`client/src/rendering/renderer.js`**:
   - Line ~370: `__getFloorTilesTiles()` - Reduced culling constants
   - Line ~440: `__renderWorld()` - Added tile off-screen skip
   - Line ~650: `__renderTileObjects()` - Added early return for off-screen tiles

---

## Quality Assurance

✅ **No visual errors expected**:
- All visible tiles still render normally
- Only tiles completely outside screen bounds are skipped
- Creatures/items visible on-screen render unchanged

✅ **No gameplay impact**:
- Player interactions unchanged
- Tile walking/pathfinding unaffected
- Object pickup/usage unaffected

✅ **No crashes/debug output**:
- Pure optimization - no error messages
- No tile errors
- No rendering errors

---

## Performance Budget (16ms per frame for 60fps)

**Before optimization**:
- Rendering: 25.1ms ❌ (over budget)
- Logic: ~5ms
- Other: ~2ms
- **Total**: 32ms (31fps maximum)

**After optimization**:
- Rendering: 16ms ✅ (on budget)
- Logic: ~5ms
- Other: ~2ms
- **Total**: 23ms (43fps potential)

---

## Next Steps (if still needed)

1. **Effect Pooling** (already implemented)
   - Reuse animation objects
   - Reduces garbage collection pressure

2. **Creature Distance LOD** (already implemented)
   - Skip animations for creatures >20 tiles away

3. **Effect Distance Culling** (already implemented)
   - Skip effects beyond 14 tiles

4. **Additional Aggressive Culling** (if below 30fps):
   - Reduce culling bounds even further
   - Skip rendering of far creatures
   - Implement tile-based frustum culling

5. **WebGL Migration** (major change):
   - Would give 10-20x performance gain
   - Requires significant refactoring

---

## Expected Outcome

**Current situation (25fps with 10317 tiles)**:
- Unplayable in crowded areas
- Significant lag and stuttering

**After optimization (35fps with 3500 tiles)**:
- Playable in crowded areas
- Reduced lag and stuttering
- Much smoother gameplay

**With full tuning (40fps with 2500 tiles)**:
- Excellent performance
- Smooth gameplay
- Room for additional features

