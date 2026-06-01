# Spawn apenas no centro (sem busca de tile)

## 1. `engine/src/core/database.js` — Substituir `__findSpawnTile`

### Antes (todo o método, linhas ~558-614):

```js
Database.prototype.__findSpawnTile = function (cx, cy, cz, radius, isMonster) {

  let Position = require("../utils/position");

  for (let r = radius; r <= radius + 5; r++) {
    let tiles = [];
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        tiles.push({ dx, dy });
      }
    }

    for (let i = tiles.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      let tmp = tiles[i];
      tiles[i] = tiles[j];
      tiles[j] = tmp;
    }

    for (let t of tiles) {
      let pos = new Position(cx + t.dx, cy + t.dy, cz);
      let tile = gameServer.world.getTileFromWorldPosition(pos);
      if (tile === null) continue;
      if (tile.creatures && tile.creatures.size > 0) continue;
      if (isMonster && (tile.isProtectionZone() || tile.isNoLogoutZone())) continue;
      return pos;
    }
  }

  for (let r = radius + 6; r <= 50; r++) {
    let tiles = [];
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        tiles.push({ dx, dy });
      }
    }

    for (let i = tiles.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      let tmp = tiles[i];
      tiles[i] = tiles[j];
      tiles[j] = tmp;
    }

    for (let t of tiles) {
      let pos = new Position(cx + t.dx, cy + t.dy, cz);
      let tile = gameServer.world.getTileFromWorldPosition(pos);
      if (tile === null) continue;
      if (tile.creatures && tile.creatures.size > 0) continue;
      if (isMonster && (tile.isProtectionZone() || tile.isNoLogoutZone())) continue;
      return pos;
    }
  }

  return new Position(cx, cy, cz);

}
```

### Depois:

```js
Database.prototype.__findSpawnTile = function (cx, cy, cz, radius, isMonster) {
  let Position = require("../utils/position");
  return new Position(cx, cy, cz);
}
```

## 2. `engine/src/core/world-creature-handler.js` — Limpar `addCreatureSpawn`

Manter a lógica actual com force fallback, só remover o comentário desactualizado:

```js
CreatureHandler.prototype.addCreatureSpawn = function (creature, literal) {

  if (literal === null) {
    return;
  }

  let position = Position.prototype.fromLiteral(literal);

  creature.position = creature.spawnPosition = position;
  if (!this.addCreaturePosition(creature, position)) {
    if (!this.addCreaturePosition(creature, position, true)) {
      console.log("Could not force spawn %s at %s.".format(creature.getProperty(CONST.PROPERTIES.NAME), position));
    }
  }

}
```

(Já está assim, só confirmar que não tem o PZ check.)

## Notas

- O `__loadSpawnDefinitions` continua a chamar `__findSpawnTile` e `addCreatureSpawn` — não precisa de alterações
- As criaturas do mesmo spawn vão todas para o mesmo SQM, e o force mode do `addCreatureSpawn` garante que são colocadas mesmo que o tile já tenha criaturas
- O parâmetro `radius` continua a existir na função mas já não é usado (mantido para não quebrar interface)
