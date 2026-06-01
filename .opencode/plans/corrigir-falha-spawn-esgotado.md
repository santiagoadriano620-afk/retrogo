# Corrigir "all radii exhausted" nos spawns

## Causa

Spawns com `amount` alto e `radius` pequeno (ex: `amount="6" radius="2"`) partilham a mesma área com outros spawns. Depois de colocados os primeiros, todos os tiles ficam ocupados (`tile.creatures.size > 0`), e mesmo expandindo o raio para `r+5`, a zona está totalmente preenchida por criaturas de spawns vizinhos.

## Solução

Adicionar 2 fallbacks ao `__findSpawnTile` em `engine/src/core/database.js`:

1. **Fallback 1** — tentar o centro exacto (`cx, cy, cz`), ignorando a verificação `creatures.size > 0`, mas ainda respeitando PZ/nologout
2. **Fallback 2** — espiral de `r=1` a `r=10` à volta do centro, ignorando `creatures.size > 0`, só verifica tile existe e não é PZ/nologout

### Alteração

No final do método `__findSpawnTile`, depois do último loop `for (let r = radius; r <= radius + 5; r++)`, substituir o `return null` por:

```js
  // Fallback 1: centro exacto (ignora creatures.size)
  let center = new Position(cx, cy, cz);
  let tile = gameServer.world.getTileFromWorldPosition(center);
  if (tile !== null && (!isMonster || (!tile.isProtectionZone() && !tile.isNoLogoutZone()))) {
    return center;
  }

  // Fallback 2: espiral até r=10 à volta (ignora creatures.size)
  for (let r = 1; r <= 10; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        let pos = new Position(cx + dx, cy + dy, cz);
        let t = gameServer.world.getTileFromWorldPosition(pos);
        if (t === null) continue;
        if (isMonster && (t.isProtectionZone() || t.isNoLogoutZone())) continue;
        return pos;
      }
    }
  }

  return null;
```

Isto garante que:
- ✅ Nenhum spawn fica de fora (excepto se todo o mapa à volta for PZ/void)
- ✅ Criaturas ainda são aleatórias dentro do raio original
- ✅ Só cai nos fallbacks quando está tudo ocupado
- ✅ O engine já suporta múltiplas criaturas no mesmo tile (só loga warning)
