# Performance Debugging & Troubleshooting Guide

## Quick Verification Checklist

### ✅ Step 1: Confirm Changes Applied
Run this in browser console after page load:

```javascript
// Check if optimization code is present
let renderer = gameClient.renderer;
let animFuncStr = renderer.__renderAnimation.toString();

if (animFuncStr.includes("maxDist > 14") && animFuncStr.includes("OPTIMIZED")) {
  console.log("✓ Effect distance culling: ACTIVE");
} else {
  console.log("✗ Effect distance culling: NOT FOUND - optimization may not be loaded!");
}

if (renderer.__renderCreatureAnimationsAbove.toString().includes("maxDist > 20")) {
  console.log("✓ Creature animation culling: ACTIVE");
} else {
  console.log("✗ Creature animation culling: NOT FOUND");
}
```

### ✅ Step 2: Baseline Measurement
Go to a **high-creature area** (100+ creatures) and run:

```javascript
// Reset counters
gameClient.renderer.drawCalls = 0;
gameClient.renderer.totalDrawTime = 0;

// Wait 10 seconds...
// Then check:
const avgDrawCalls = gameClient.renderer.drawCalls / 100; // 100 * 100ms samples
const avgDrawTime = gameClient.renderer.totalDrawTime / 100;

console.log("Average Draw Calls per frame:", Math.round(avgDrawCalls));
console.log("Average Draw Time:", Math.round(avgDrawTime) + "µs");
```

**Expected after optimization**:
- Draw Calls: 2500-3500 (down from 4800+)
- Draw Time: 11000-13000µs (down from 14000+)

### ✅ Step 3: FPS Monitoring
```javascript
(function monitorFps() {
  let lastTime = performance.now();
  let frames = 0;
  let fpsReadings = [];
  
  function measure() {
    frames++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
      const fps = Math.round(frames * 1000 / (now - lastTime));
      fpsReadings.push(fps);
      console.log("Current FPS:", fps);
      
      if (fpsReadings.length >= 5) {
        const avgFps = (fpsReadings.reduce((a,b) => a+b) / fpsReadings.length).toFixed(1);
        const minFps = Math.min(...fpsReadings);
        console.log(`Average FPS (5 samples): ${avgFps}`);
        console.log(`Minimum FPS: ${minFps}`);
        return;
      }
      
      frames = 0;
      lastTime = now;
    }
    
    requestAnimationFrame(measure);
  }
  
  measure();
})();
```

**Expected**: FPS should be 40-50 in crowded areas (up from 33)

---

## Troubleshooting

### Issue: No improvement after optimization
**Possible causes**:

1. **Changes not loaded**
   ```javascript
   // Verify using the checklist above
   renderer.__renderAnimation.toString().includes("maxDist > 14")
   ```
   
2. **Cached old version**
   - Clear browser cache (Ctrl+Shift+Delete)
   - Force refresh (Ctrl+F5)
   - Close DevTools and reopen

3. **Optimization already active**
   - Check if you're using a build/bundled version
   - Changes in source might not affect bundled client
   
**Solution**: 
- Rebuild the client if using bundled version:
  ```bash
  # In engine folder:
  npm run build
  # or
  node scripts/build-client.js
  ```

### Issue: Performance worse than before
**Possible causes**:

1. **Threshold too aggressive** (14 tiles might be too close)
   - Many effects are happening but appear cut off

2. **Other rendering bottleneck**
   - Not all performance issues are effects-related
   
**Solution**:
```javascript
// Temporarily disable distance culling to test:
// Edit in renderer.js: comment out the distance check
// if (maxDist > 14) return; // <-- comment this

// Then test if performance improves/worsens
```

### Issue: Visual artifacts (effects disappearing suddenly)
**Possible causes**:

1. **Distance threshold too close** (14 tiles is reasonable but may vary)
2. **Player position tracking issue**

**Solution**:
```javascript
// Try increasing distance threshold:
// Change from: if (maxDist > 14) return;
// To: if (maxDist > 16) return; or if (maxDist > 18) return;
```

---

## Detailed Performance Analysis

### Using Chrome DevTools Performance Tab

1. **Open DevTools**: F12 → Performance
2. **Record** a 15-second session in a crowded area
3. **Look for**:
   - Main thread time (should be lower)
   - Rendering time (should be lower)
   - Frame drops (fewer red frames)

**Expected improvements**:
- Main thread work reduced by 15-25%
- Frame rate more consistent
- Fewer frame drops

### Identifying Remaining Bottlenecks

If still not meeting target (40+ fps):

```javascript
// Profile animation rendering specifically
performance.mark('animations-start');

// ... animation rendering happens here ...
// (This will be called during normal rendering)

performance.mark('animations-end');
performance.measure('animation-render', 'animations-start', 'animations-end');

const measure = performance.getEntriesByName('animation-render')[0];
console.log("Animation rendering time:", measure.duration.toFixed(2) + "ms");
```

**If animation rendering is still high (>5ms)**:
- Effect pooling might help
- Consider effect LOD
- Or batch rendering

---

## Incremental Testing Approach

### Test 1: Distance Culling Only
```javascript
// Verify: only tile animations >14 tiles are culled
let tile = gameClient.world.getTileFromWorldPosition({x: 100, y: 100, z: 7});
// If you walk 20 tiles away, effects should stop rendering
```

### Test 2: Creature Animation Culling
```javascript
// Find a creature 25+ tiles away
let distantCreature = null;
Object.values(gameClient.world.activeCreatures).forEach(c => {
  let dist = Math.max(
    Math.abs(c.getPosition().x - gameClient.player.getPosition().x),
    Math.abs(c.getPosition().y - gameClient.player.getPosition().y)
  );
  if (dist > 22) distantCreature = c;
});

if (distantCreature) {
  console.log("Found creature at distance:", 
    Math.max(
      Math.abs(distantCreature.getPosition().x - gameClient.player.getPosition().x),
      Math.abs(distantCreature.getPosition().y - gameClient.player.getPosition().y)
    ));
  console.log("Its animations:", distantCreature.__animations.length);
  // Should still have animations, but they won't render
}
```

---

## Advanced Metrics Collection

```javascript
// Comprehensive 60-second performance report

class PerformanceMonitor {
  constructor() {
    this.samples = [];
    this.interval = null;
  }
  
  start() {
    this.samples = [];
    this.interval = setInterval(() => {
      this.samples.push({
        time: performance.now(),
        drawCalls: gameClient.renderer.drawCalls,
        drawTime: gameClient.renderer.totalDrawTime,
        entities: Object.keys(gameClient.world.activeCreatures).length
      });
    }, 100);
  }
  
  stop() {
    clearInterval(this.interval);
    return this.analyze();
  }
  
  analyze() {
    if (this.samples.length === 0) return null;
    
    const avgDrawCalls = this.samples.reduce((sum, s) => sum + s.drawCalls, 0) / this.samples.length;
    const avgDrawTime = this.samples.reduce((sum, s) => sum + s.drawTime, 0) / this.samples.length;
    const maxDrawCalls = Math.max(...this.samples.map(s => s.drawCalls));
    const minDrawCalls = Math.min(...this.samples.map(s => s.drawCalls));
    
    return {
      samples: this.samples.length,
      avgDrawCalls: Math.round(avgDrawCalls),
      avgDrawTime: Math.round(avgDrawTime) + "µs",
      maxDrawCalls: maxDrawCalls,
      minDrawCalls: minDrawCalls,
      avgEntities: Math.round(this.samples[this.samples.length-1].entities)
    };
  }
}

// Usage:
const monitor = new PerformanceMonitor();
monitor.start();
// ... play for 60 seconds ...
const results = monitor.stop();
console.table(results);
```

---

## Expected Metrics Comparison

### Before Optimization
```
Frame Rate: 33 fps
Draw Calls: ~4879
Draw Time: ~14253µs
Frame Time: ~30ms
Stutters: Frequent
```

### After Optimization (Realistic)
```
Frame Rate: 40-45 fps
Draw Calls: ~3200-3600
Draw Time: ~11000-12500µs
Frame Time: ~22-25ms
Stutters: Reduced significantly
```

### After All Optimizations (Best Case)
```
Frame Rate: 50-55 fps
Draw Calls: ~2000-2500
Draw Time: ~10000-11000µs
Frame Time: ~18-20ms
Stutters: Rare
```

---

## If More Optimization Needed

### Phase 2 Optimizations Ready to Deploy

1. **Effect Pooling** (3-5% GC improvement)
   - Reuse Animation objects
   - Reduces memory churn

2. **Effect LOD** (8-15% draw call reduction)
   - Skip rendering some distant effects
   - Use lower-quality animations far away

3. **Batch Rendering** (8-12% draw call reduction)
   - Group similar effects
   - Render in batches

### WebGL Migration (Biggest gain: 10-20x)
- Current: Canvas 2D (single-threaded)
- Target: WebGL (GPU-accelerated)
- Effort: Large (~2-3 days)
- Payoff: Enormous

See `EFFECT_OPTIMIZATION.md` for Phase 2 implementations.

---

## Support & Questions

**Debug Console Commands**:
```javascript
// Show all active metrics
gameClient.renderer.debugger.show();

// Check specific values
gameClient.renderer.drawCalls
gameClient.renderer.totalDrawTime
gameClient.world.activeCreatures.length

// Verify optimization is loaded
gameClient.renderer.__renderAnimation.toString().substring(0, 500)
```

**Performance Budget**:
- Rendering: 12-14ms (currently exceeding)
- Logic: 5-7ms
- Other: 2-3ms
- **Total target**: 16-17ms per frame (60fps)

