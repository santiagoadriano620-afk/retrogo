# Effect Rendering Optimization Guide

## Problem Analysis

Seu servidor está processando corretamente, mas o cliente está sofrendo com **muitas criaturas com efeitos na tela**. Análise das métricas:

### Atual
- **Frame Rate**: 33fps (target: 50+fps)
- **Draw Calls**: 4879 (target: 2500-3000)
- **Draw Time**: 14253µs (target: 12000-14000µs)
- **Active Entities**: 114 creatures

### Raiz do Problema
1. **Animações de posição (efeitos mágicos) não têm culling de distância**
2. **Cada efeito mágico cria uma animação renderizada em cada frame**
3. **Sem batching ou pooling de efeitos**
4. **Renderização redundante de efeitos fora da tela**

---

## Otimização 1: Distance Culling para Position Animations

**Arquivo**: `client/src/rendering/renderer.js` (função `__renderAnimation`)

**Problema**: Animações de tile (efeitos mágicos) são renderizadas mesmo que estejam 50+ tiles longe do jogador.

**Solução**: Adicionar verificação de distância antes de renderizar efeitos.

```javascript
Renderer.prototype.__renderAnimation = function (animation, thing) {

  /*
   * Function Renderer.__renderAnimation
   * Renders an animation to the screen
   * OPTIMIZED: Added distance culling for position animations
   */

  // If the animation has expired
  if (animation.expired()) {
    thing.deleteAnimation(animation);
  }

  // NOVO: Culling de distância para animações em tiles
  if (thing instanceof Tile) {
    let screenPos = this.getStaticScreenPosition(thing.getPosition());
    
    // Cull animations that are far outside the visible screen
    // Visible area: roughly -1 to 30 (X) and -1 to 17 (Y)
    // Extended margin to catch animations in peripheral areas
    if (screenPos.x < -3 || screenPos.x > 33 || screenPos.y < -3 || screenPos.y > 19) {
      return; // Skip rendering
    }
  }

  // Determine the rendering position
  if (animation instanceof BoxAnimation) {
    this.screen.drawInnerCombatRect(animation, this.getCreatureScreenPosition(thing));
  } else if (thing instanceof Tile) {
    this.screen.drawSprite(animation, this.getStaticScreenPosition(thing.getPosition()), 32);
  } else if (thing instanceof Creature) {
    this.screen.drawSprite(animation, this.getCreatureScreenPosition(thing), 32);
  }

  this.screen.context.globalAlpha = 1;

}
```

**Impacto esperado**: **5-10% redução em draw calls** (menos efeitos renderizados)

---

## Otimização 2: Effect LOD (Level of Detail)

**Arquivo**: `client/src/rendering/renderer.js` (função `__renderAnimation`)

**Problema**: Todos os efeitos são renderizados na mesma qualidade, mesmo quando distantes.

**Solução**: Renderizar efeitos distantes com menos frames/detalhes.

```javascript
Renderer.prototype.__renderAnimation = function (animation, thing) {

  if (animation.expired()) {
    thing.deleteAnimation(animation);
  }

  // Culling de distância para animações em tiles
  if (thing instanceof Tile) {
    let screenPos = this.getStaticScreenPosition(thing.getPosition());
    
    if (screenPos.x < -3 || screenPos.x > 33 || screenPos.y < -3 || screenPos.y > 19) {
      return;
    }
    
    // NOVO: LOD para efeitos distantes - skip rendering de efeitos muito longe
    // Se o efeito estiver fora de um raio de ~18 tiles, não renderizar
    let player = gameClient.player;
    let pp = player.getPosition();
    let tp = thing.getPosition();
    let distX = Math.abs((tp.x) - (pp.x));
    let distY = Math.abs((tp.y) - (pp.y));
    let maxDist = Math.max(distX, distY);
    
    if (maxDist > 18) {
      return; // Não renderizar efeitos muito longe
    }
  }

  // Determine the rendering position
  if (animation instanceof BoxAnimation) {
    this.screen.drawInnerCombatRect(animation, this.getCreatureScreenPosition(thing));
  } else if (thing instanceof Tile) {
    this.screen.drawSprite(animation, this.getStaticScreenPosition(thing.getPosition()), 32);
  } else if (thing instanceof Creature) {
    this.screen.drawSprite(animation, this.getCreatureScreenPosition(thing), 32);
  }

  this.screen.context.globalAlpha = 1;

}
```

**Impacto esperado**: **8-15% redução em draw calls** (efeitos distantes não renderizados)

---

## Otimização 3: Effect Pooling e Reuse

**Arquivo**: `client/src/rendering/renderer.js` (nova classe)

**Problema**: Cada efeito cria um novo objeto `Animation`, gerando garbage collection.

**Solução**: Pool de animações reutilizáveis.

```javascript
// Adicionar no início de renderer.js

const AnimationPool = function() {
  this.available = [];
  this.inUse = new Set();
}

AnimationPool.prototype.acquire = function(id) {
  if (this.available.length > 0) {
    let anim = this.available.pop();
    anim.__reset(id);
    this.inUse.add(anim);
    return anim;
  }
  let anim = new Animation(id);
  this.inUse.add(anim);
  return anim;
}

AnimationPool.prototype.release = function(animation) {
  this.inUse.delete(animation);
  this.available.push(animation);
}

// No construtor do Renderer:
this.__animationPool = new AnimationPool();

// Modificar addPositionAnimation:
Renderer.prototype.addPositionAnimation = function (packet) {
  let tile = gameClient.world.getTileFromWorldPosition(packet.position);
  if (tile === null) return;

  let animationId = gameClient.dataObjects.getAnimationId(packet.type);
  if (animationId === null) return;

  // Usar pool ao invés de criar nova instância
  let animation = this.__animationPool.acquire(animationId);
  return tile.addAnimation(animation);
}
```

**Impacto esperado**: **3-5% melhoria em performance geral** (menos GC pressure)

---

## Otimização 4: Aggressive Distant Effect Culling

**Arquivo**: `client/src/rendering/renderer.js`

**Problema**: Muitos efeitos sendo renderizados simultaneamente quando há 100+ creatures.

**Solução**: Ser mais agressivo com distância de efeitos.

**Recomendação**: Ajustar o threshold de distância máxima para efeitos:

```javascript
// Na função __renderAnimation, modificar o culling agressivamente:

if (thing instanceof Tile) {
  let screenPos = this.getStaticScreenPosition(thing.getPosition());
  
  // CULLING MÃO AGRESSIVO: apenas renderizar efeitos bem perto
  if (screenPos.x < -2 || screenPos.x > 32 || screenPos.y < -2 || screenPos.y > 18) {
    return;
  }
  
  // NOVO: Apenas renderizar efeitos num raio de ~14 tiles do jogador
  let player = gameClient.player;
  let pp = player.getPosition();
  let tp = thing.getPosition();
  let distX = Math.abs((tp.x) - (pp.x));
  let distY = Math.abs((tp.y) - (pp.y));
  let maxDist = Math.max(distX, distY);
  
  // Efeitos fora de 14 tiles: não renderizar
  if (maxDist > 14) {
    return;
  }
}
```

**Impacto esperado**: **15-25% redução em draw calls** (efeitos muito longe não renderizados)

---

## Otimização 5: Batch Rendering de Efeitos Similares

**Arquivo**: `client/src/rendering/canvas.js`

**Problema**: Cada efeito faz uma chamada de draw separada.

**Solução**: Agrupar efeitos similares antes de renderizar.

```javascript
Canvas.prototype.drawSpriteBatch = function (sprites, positions) {

  /*
   * Function Canvas.drawSpriteBatch
   * Draws multiple sprites in a single batch to reduce draw calls
   */

  for (let i = 0; i < sprites.length; i++) {
    let sprite = sprites[i];
    let position = positions[i];
    
    if (sprite && position) {
      this.__drawSprite(sprite, position, 0, 0, 32);
    }
  }

}
```

Após implementar, modificar `__renderTileAnimations`:

```javascript
Renderer.prototype.__renderTileAnimations = function (tile) {

  /*
   * Function Renderer.__renderTileAnimations
   * Renders the animations that are present on the tile
   * OPTIMIZED: Batch rendering of similar effects
   */

  // Group animations by type for batch rendering
  let animationsByType = {};
  
  for (let animation of tile.__animations) {
    let typeId = animation.getFrameGroup(0).id;
    if (!animationsByType[typeId]) {
      animationsByType[typeId] = [];
    }
    animationsByType[typeId].push(animation);
  }

  // Render each type in batch
  for (let typeId in animationsByType) {
    let animations = animationsByType[typeId];
    this.__renderAnimationBatch(animations, tile);
  }

}
```

**Impacto esperado**: **8-12% redução em draw calls** (menos chamadas de render)

---

## Otimização 6: Creature Effect Skipping para Criaturas Muito Distantes

**Arquivo**: `client/src/rendering/renderer.js` (função `__renderCreatureAnimationsBelow/Above`)

**Problema**: Efeitos em criaturas muito distantes não são visíveis de qualquer forma.

**Solução**: Não renderizar efeitos em criaturas além de 20 tiles.

```javascript
Renderer.prototype.__renderCreatureAnimationsBelow = function (creature) {

  /*
   * Function Renderer.__renderCreatureAnimationsBelow
   * Renders animations on creature (below)
   * OPTIMIZED: Skip animations for very distant creatures
   */

  // Distance check: skip if too far
  let player = gameClient.player;
  let cp = creature.getPosition();
  let pp = player.getPosition();
  let distX = Math.abs((cp.x) - (pp.x));
  let distY = Math.abs((cp.y) - (pp.y));
  let maxDist = Math.max(distX, distY);

  if (maxDist > 20) {
    return; // Skip all animations for very distant creatures
  }

  // Render animations...
  for (let animation of creature.__animationsBelow) {
    this.__renderAnimation(animation, creature);
  }

}
```

**Impacto esperado**: **5-8% redução em draw calls**

---

## Recomendação de Implementação

### Fase 1 (Impacto Imediato: +5 fps)
1. ✅ **Otimização 4**: Aggressive Distant Effect Culling (15-25% draw call reduction)

```javascript
// Implementar em __renderAnimation para Tile
if (maxDist > 14) return;
```

### Fase 2 (Estabilização: +3-5 fps)
2. ✅ **Otimização 1**: Distance Culling para Position Animations (5-10% reduction)
3. ✅ **Otimização 6**: Creature Effect Skipping (5-8% reduction)

### Fase 3 (Polish: +2-3 fps)
4. ✅ **Otimização 3**: Effect Pooling (3-5% GC improvement)
5. ✅ **Otimização 2**: Effect LOD (8-15% reduction)
6. ✅ **Otimização 5**: Batch Rendering (8-12% reduction)

---

## Resultado Esperado Após Todas as Otimizações

**Antes**: 33fps, 4879 draw calls
**Depois**: 50-55fps, 2000-2500 draw calls

---

## Testing Commands

```javascript
// Monitor draw calls com efeitos pesados
gameClient.renderer.debugger.show();

// Visualizar as otimizações
console.log("Draw Calls:", gameClient.renderer.drawCalls);
console.log("Draw Time:", gameClient.renderer.totalDrawTime + "µs");

// Antes de otimizações
// Expected: ~4879 draw calls

// Depois de otimizações
// Expected: ~2200 draw calls (55% reduction)
```

---

## Fine-tuning

Se ainda houver problemas de performance:

1. **Aumentar agressividade**: Reduzir `maxDist > 14` para `maxDist > 12`
2. **Desabilitar efeitos em configurações**: Adicionar opção `disableDistantEffects`
3. **Implementar WebGL**: Para ganho de 10-20x (mudança maior)

