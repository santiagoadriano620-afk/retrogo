# Balde Bug — Resumo

## Problema Original

Usar um balde vazio (id=2005) da **mochila** num water tile fazia o balde **sumir**. O servidor completava o fill (`__handleFill: done`) mas o cliente nunca via o balde cheio na mochila.

## Causa Raiz

`Thing.prototype.replace` (`engine/src/entities/thing.js:531`) usava `remove()` + `addThing()`:

```
this.remove()          → Container.deleteThing → BaseContainer.__remove → **desloca** itens p/ esquerda
parent.addThing(thing, removedIndex) → slot ocupado pelo item deslocado → getMaximumAddCount retorna 0 → addThing falha silenciosamente
```

O balde velho sumia do container mas o balde cheio **nunca entrava** → sumia.

## Fix: replace in-place para containers

`thing.js:replace` agora tem **dois paths**:

```javascript
if (parent.container === undefined) {
  // Tile: remove + add (sem shift)
  let removedIndex = this.remove();
  parent.addThing(thing, removedIndex);
} else {
  // Container/Equipment: substitui in-place
  let baseContainer = parent.container;
  let index = baseContainer.__slots.indexOf(this);
  if (index !== -1) {
    baseContainer.__slots[index] = null;  // nula slot sem shift
    this.__parent = null;
    baseContainer.__informSpectators(
      new ContainerRemovePacket(baseContainer.guid, index, 0)
    );
    if (typeof parent.__updateParentWeightRecursion === "function") {
      parent.__updateParentWeightRecursion(-this.getWeight());
    }
    parent.addThing(thing, index);  // addThing no slot vazio → funciona
  }
}
```

## Arquivos Alterados

| Arquivo | O que mudou |
|---|---|
| `engine/src/entities/thing.js` | `replace()` com path in-place p/ containers |
| `client/src/entities/tile.js` | Removeu debug logs temporários |
| `client/src/network/packet-handler.js` | Removeu log CALLED incondicional |
| `engine/src/utils/fluidcontainer.js` | Protegeu `getTopItem()` p/ não crashar quando tile é Container |
| `engine/src/containers/container-manager.js` | (não mexido — mas ver se Container.openBy/addSpectator está sendo chamado) |
| `client/src/input/mouse.js` | Corrigido `tile.position` → `tile.getPosition()` (bug anterior) |

## Debug Logs Mantidos (úteis)

**Cliente** (ativam só p/ id=2005):
- `handleContainerItemRemove: slot=X item was bucket` — balde removido do container
- `handleContainerAddItem: itemId=2005 count=X slot=Y slot before=Z` — balde adicionado
- `handleContainerAddItem: slot after=2005 count=1` — confirmação pós-add

**Servidor**:
- `handleUseWith: id=X count=Y isEmpty=Z` — início do use-with
- `__handleFill: matched water by name` — água detectada
- `__handleFill: replacing item, new count=1` — replace executado
- `__handleFill: done` — fill completo

## Como Testar

1. Logar no jogo
2. Abrir mochila (backpack)
3. Clicar direito no balde vazio → "Use"
4. Clicar num water tile
5. Verificar servidor: `__handleFill: done`
6. Verificar cliente: balde cheio (`count=1`) aparece na mochila
7. Usar balde cheio de novo no chão → deve esvaziar (`count=0`)

## Próximos Passos

- [ ] Testar transferência entre fluid containers (balde ↔ trough)
- [ ] Verificar se `Container.openBy` está sendo chamado (ou se só `Player.openContainer` que já addSpectator)
- [ ] Remover debug logs do `__handleFill` depois de estável
- [ ] Verificar `BaseContainer.__remove` shift + `__informSpectatorsFull` p/ `addThingSmart` (shift de itens pode causar duplicação visual em alguns cenários)
