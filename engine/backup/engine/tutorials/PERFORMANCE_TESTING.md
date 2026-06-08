# Performance Testing Guide

## Pre-Optimization Metrics (Baseline)

Seu baseline atual:
- Frame Rate: 41fps
- Draw Calls: 4094
- Draw Time: 17993µs (~18ms)
- Active Entities: 120
- Memory: 108MB

## Post-Optimization Measurement

### Quick Test (60 segundos)

1. **Abrir DevTools** (F12)
2. **Ir para Performance tab**
3. **Record uma sessão de 10-15 segundos com 100+ monstros na tela**
4. **Parar a gravação**
5. **Analisar:**
   - FPS médio
   - Frame rate consistência
   - Longest frame time

### Detailed Metrics Collection

```javascript
// Cole isso no console para coletar métricas detalhadas

const metrics = {
  startTime: performance.now(),
  frames: 0,
  drawCalls: [],
  drawTimes: [],
  fps: []
};

// Coletar dados por 30 segundos
const interval = setInterval(() => {
  const renderer = gameClient.renderer;
  metrics.frames++;
  metrics.drawCalls.push(renderer.drawCalls);
  metrics.drawTimes.push(renderer.totalDrawTime);
  
  const avgFps = metrics.frames / ((performance.now() - metrics.startTime) / 1000);
  metrics.fps.push(avgFps);
  
  renderer.drawCalls = 0;  // Reset
  renderer.totalDrawTime = 0;  // Reset
}, 100);

// Depois de 30 segundos, parar e analisar
setTimeout(() => {
  clearInterval(interval);
  
  const avgDrawCalls = metrics.drawCalls.reduce((a,b) => a+b) / metrics.drawCalls.length;
  const avgDrawTime = metrics.drawTimes.reduce((a,b) => a+b) / metrics.drawTimes.length;
  const avgFps = metrics.fps[metrics.fps.length-1];
  
  console.log('=== PERFORMANCE METRICS ===');
  console.log(`Average Draw Calls: ${Math.round(avgDrawCalls)}`);
  console.log(`Average Draw Time: ${Math.round(avgDrawTime)}µs (${(avgDrawTime/1000).toFixed(2)}ms)`);
  console.log(`Average FPS: ${avgFps.toFixed(1)}`);
  console.log(`Total Frames: ${metrics.frames}`);
}, 30000);
```

### Chrome DevTools Timeline Analysis

1. **Abrir DevTools → Performance tab**
2. **Click Record button**
3. **Jogar por 30 segundos com 100+ monstros visíveis**
4. **Stop recording**
5. **Analisar:**
   - Main Thread Time
   - Rendering Time
   - Script Execution Time
   - Frame Rate (FPS chart no topo)

**O que esperar após otimizações:**
- Frame rate chart mais estável
- Menos red frames (dropped frames)
- Rendering time reduzido de ~18ms para ~12-14ms

### FPS Monitoring

Adicione este código para monitorar FPS em tempo real:

```javascript
// Adicionar ao console
(function monitorFps() {
  let lastTime = performance.now();
  let frames = 0;
  let fpsValues = [];
  
  function measureFps() {
    frames++;
    const currentTime = performance.now();
    const delta = currentTime - lastTime;
    
    if (delta >= 1000) {
      const fps = Math.round(frames * 1000 / delta);
      fpsValues.push(fps);
      console.log(`FPS: ${fps}`);
      frames = 0;
      lastTime = currentTime;
    }
    
    requestAnimationFrame(measureFps);
  }
  
  measureFps();
  
  // Mostrar stats após 30 segundos
  setTimeout(() => {
    const avg = fpsValues.reduce((a,b) => a+b) / fpsValues.length;
    const min = Math.min(...fpsValues);
    const max = Math.max(...fpsValues);
    console.log(`\n=== 30-second FPS Stats ===`);
    console.log(`Average: ${avg.toFixed(1)}`);
    console.log(`Min: ${min}`);
    console.log(`Max: ${max}`);
  }, 30000);
})();
```

## Comparison Before & After

### Expected Results

**Antes:**
```
Frame Rate: 41fps
Draw Calls: 4094
Draw Time: 18ms
Frame Time: 24-25ms
Dropped Frames: Frequency alta
```

**Depois:**
```
Frame Rate: 50-55fps (+20-35%)
Draw Calls: 2500-3000 (-40%)
Draw Time: 12-14ms (-30%)
Frame Time: 18-20ms
Dropped Frames: Muito menos frequente
```

## Teste de Stress

Para testar o máximo de performance:

1. **Vá para uma zona com 150+ monstros/creatures**
2. **Rode para perto de um spawner grande**
3. **Tire screenshot da métrica do debug**
4. **Compare com antes**

Esperado: FPS mantém 40+fps mesmo com muitas entidades

## Se Performance Ainda Está Baixa

### Diagnóstico

1. **Verifique se as otimizações estão ativas:**
   ```javascript
   // No console
   console.log(gameClient.renderer.__getFloorTilesTiles.toString());
   // Verifique se CULLING_LEFT, etc. estão presentes
   ```

2. **Desabilite efeitos de iluminação:**
   ```javascript
   gameClient.interface.settings.setWeatherEnabled(false);
   // Também desabilite light rendering no settings
   ```

3. **Reduza Draw Distance mais agora:**
   - Editar CULLING_LEFT, RIGHT, TOP, BOTTOM para valores ainda menores
   - Reduzir `isDistant` threshold para 12-14

### Possíveis Causas de Baixa Performance

- Muitas animações de distância na tela
- Light rendering consumindo muita GPU
- Efeitos de weather ativos
- Chrome/Browser com outras abas abertas consumindo recursos

## Performance Targets

- **Target Frame Rate**: 60fps (mantendo no mínimo 50fps com 100+ monstros)
- **Target Draw Time**: 10-12ms
- **Target Draw Calls**: 2000-3000

Se mesmo após otimizações não atingir esses targets, considere:
1. Migrar para WebGL
2. Implementar sprite batching
3. Usar texture atlasing
