# NPC Spell Purchase System — Implementation Summary

## Problema Original

NPCs que vendem magias (32 no total) precisavam ensinar spells quando o jogador compra, mas o sistema original não tinha suporte para:

1. **Gating implícito** — NPCs usam um mesmo tópico de confirmação (topic 3 ou 1) com várias entries de keyword "yes", onde a primeira que matchava SEMPRE ganhava (já que nenhuma tinha condições, exceto gold)
2. **Spell ID mapping** — Não havia um campo para mapear keyword de magia → spellId. O engine não sabia qual spell o jogador estava comprando
3. **Teach automático** — O engine não ensinava o spell automaticamente ao cobrar o ouro; precisava de script externo (SpellTeacher)

---

## Abordagem 1 (descartada): SpellTeacher Script

Inicialmente tentamos modificar os NPCs para usar um script `SpellTeacher.js` que:
- Subscribia no evento de foco do NPC
- Detectava entrada em tópicos de confirmação
- Executava ação de teach quando `deleteMoney` acontecia

**Problemas:**
- Modificava scripts de todos os 32 NPCs (mudança invasiva)
- Dependia de script externo acoplado ao NPC
- Difícil de manter e depurar

**Decisão: Abortado.** Toda lógica deveria ficar na engine, não nos NPCs.

---

## Abordagem 2 (atual): Engine-Only + Dados nos NPCs

### Princípios

1. **Não alterar diálogo original** — Nenhuma keyword, response, topic, entry, ou script original foi modificado
2. **Dados são adicionados, não alterados** — Campos como `keywordTopicSpellIds`, `keywordTopicMagicLevels`, `keywordTopicPrices` são NOVOS campos no JSON, não substituem nada existente
3. **Engine faz o gating** — `npc-conversation-handler.js` interpreta a estrutura existente dos NPCs e aplica a lógica de compra automaticamente

### Arquivo Principal

`engine/src/npc/npc-conversation-handler.js` (~1165 linhas)

---

## Mudanças na Engine

### 1. Spell Definitions (module-level)

```js
var __spellDefinitions = null;
var __spellKeywordMap = null;

function __ensureSpellDefinitions() {
  if (__spellDefinitions !== null) return;
  __spellDefinitions = requireData("spells", "definitions.json");
  __spellKeywordMap = {};
  for (var id in __spellDefinitions) {
    var spell = __spellDefinitions[id];
    var name = spell.name.toLowerCase();
    __spellKeywordMap[name] = parseInt(id);
    var words = name.split(/\s+/);
    for (var w = 0; w < words.length; w++) {
      if (words[w].length > 1 && !__spellKeywordMap[words[w]]) {
        __spellKeywordMap[words[w]] = parseInt(id);
      }
    }
  }
}
```

Carrega `definitions.json` dos spells e constrói um mapa nome → spellId para auto-inference.

### 2. `handleResponse` — Auto-Inference & Topic State

No bloco de transição de keyword → tópico (linhas ~289-352):

```js
// Set topic state spell ID from NPC data
if (keywordTopicSpellIds && keywordTopicSpellIds[matchedKeyword] !== undefined) {
  this.getFocusHandler().getTopicState().type = keywordTopicSpellIds[matchedKeyword];
}

// Fallback: auto-infer spell ID from keyword name
if (!this.getFocusHandler().getTopicState().type) {
  var inferredId = __inferSpellFromKeyword(matchedKeyword);
  if (inferredId !== null) {
    this.getFocusHandler().getTopicState().type = inferredId;
  }
}

// Set magic level from NPC data
if (keywordTopicMagicLevels && keywordTopicMagicLevels[matchedKeyword] !== undefined) {
  this.getFocusHandler().getTopicState().amount = keywordTopicMagicLevels[matchedKeyword];
}

// Fallback: spell definition level
if (!this.getFocusHandler().getTopicState().amount && type > 0) {
  var spellDef = __getSpellDefinition(type);
  if (spellDef) this.getFocusHandler().getTopicState().amount = spellDef.level || 0;
}
```

### 3. `handleResponse` — Auto-Evaluate (key change for user's fix)

Após setar todo o state, se `topicState.type > 0`:

```js
if (ts.type > 0) {
  // Check keyword response for vocation gating
  var kwResp = this.conversation.keywords[matchedKeyword];
  if (typeof kwResp === 'string' && kwResp.match(/only for/i)) {
    this.respond(kwResp);
    this.getFocusHandler().setCurrentTopic(null);
    return;
  }
  return this.__handleTopic(player, "yes", keywordNextTopics[matchedKeyword]);
}
```

Isso substitui o comportamento anterior de apenas responder com o texto da keyword (ex: "Magic Rope") e esperar "yes". Agora o engine avalia o tópico de confirmação imediatamente com mensagem "yes", em vez de esperar o jogador digitar "yes".

**Exceção:** Keywords cuja resposta contém "only for" (ex: "This spell is only for knights.") preservam o comportamento original — respondem a mensagem de vocação e limpam o tópico.

### 4. `__handleTopic` — Gating em Ordem Fixa (4 fases)

Substituiu o two-pass anterior (condições primeiro, depois sem condições + gating implícito):

```
Fase 1: Entradas condicionais NÃO-gold
  - Vocation, quest, premium, pzblock, spellLearned, magicLevel condition, etc.
  - EXCLUI condições do tipo 'gold' (tratadas na Fase 2c)

Fase 2: Spell purchase gating (só executa se topicState.type > 0)
  2a. Já conhece a magia
      - Busca entry cujo response contém "already"/"know" (excluindo negações)
      - Se playerKnowsSpell() → executa entry
      - Break (sai da busca) independente, impedindo que pule pro success
  2b. Magic level
      - Busca entry cujo response contém "%A" ou "magic level"
      - Se !playerMeetsMagicLevel() → executa entry
      - Break (sai da busca)
  2c. Gold
      - Busca entry com condição do tipo 'gold'
      - Se condition falha (não tem gold suficiente) → executa entry
      - Se passa → skip (vai pra 2d)
  2d. Sucesso (deleteMoney)
      - Executa entry com ação deleteMoney → paga + auto-teach

Fase 3: Entradas incondicionais restantes
  - Fallback para tópicos que NÃO são de compra de magia

Fase 4: Default entry (isDefault)
  - "I thought so." ou similar
```

### 5. `__executeTopicActions` — Auto-Teach no `deleteMoney`

```js
case 'deleteMoney':
  // ... pay gold ...
  // Auto-teach spell if in spell purchase context
  var tt = this.getFocusHandler().getTopicState().type;
  if (tt > 0 && player.spellbook) {
    player.spellbook.addAvailableSpell(tt);
    player.setStorage(2000 + tt, 1);
  }
  break;
```

### 6. `magicLevel` condition — Suporte a `min: -1`

```js
case 'magicLevel':
  let requiredMl = cond.min !== undefined
    ? (cond.min === -1 ? (topicState.amount || 0) : cond.min)
    : 0;
  if (playerMl < requiredMl) return false;
```

### 7. `__matchDefaultKeyword` — Message-contains-keyword

Adicionado check de substring no `__matchDefaultKeyword`:

```js
// Message contains keyword (standard Tibia substring match)
if (!lcKey.includes('*') && lcKeyword.includes(lcKey)) {
  return key;
}
```

Isso permite que "magic rope" (mensagem) match a keyword "magic" (key), que é o comportamento padrão do Tibia. Antes só funcionava se a key entire correspondesse exatamente à mensagem.

---

## Dados nos NPCs

### 32 NPCs de Spell Teaching

| Grupo | NPCs | Status |
|-------|------|--------|
| **A** (Pattern C) | puffels, gundralph, ursula, zoltan, elathriel, eroth, faluae, irea, maealil, shanar | `keywordTopicSpellIds` + `keywordTopicMagicLevels` + `keywordTopicPrices` populados |
| **B** (Pattern A/B) | rahkem, marvik, padreia, smiley, ustan, chatterbone, etzel, lea, muriel, myra, tothdral, dario, elane, helor, legola, duria, gregor, ormuhn, uso, asrak, razan, shalmar | Populados com IDs, magic levels (0), prices (level×200, min 200, max 5000) |

### Campos Adicionados

Cada NPC JSON (`data/npcs/definitions/`) recebeu:

```json
{
  "conversation": {
    "keywordTopicSpellIds": {
      "light": 5,
      "light healing": 2,
      "haste": 8,
      ...
    },
    "keywordTopicMagicLevels": {
      "light": 0,
      "light healing": 0,
      "haste": 0,
      ...
    },
    "keywordTopicPrices": {
      "light": 200,
      "light healing": 200,
      "haste": 600,
      ...
    },
    "keywordNextTopics": {
      "spell": 2,
      "light": 3,
      "light healing": 3,
      ...
    }
  }
}
```

Nenhum campo existente foi removido ou alterado. Todo o diálogo original (keywords, topics, responses, entries, conditions, actions, scripts) permanece intacto.

### Scripts

SpellTeacher removido de todos os scripts. Scripts originais restaurados do backup em `D:\GitHub\tibiajs\npcs\definitions\script\`.

---

## Ordem de Gating (Resultado Final)

Quando o jogador diz uma magia (ex: "haste"):

```
1. Keyword match "haste" → topicState.type = 8 (spellId)
2. Auto-evaluate tópico de confirmação com "yes"
3. Fase 1: Entradas condicionais não-gold (vocação, quest, etc.)
   → Se houver restrição de vocação no entry do tópico, verifica primeiro
4. Fase 2a: Já conhece?
   → Se player já tem o spell: "You already know this spell."
5. Fase 2b: Magic level suficiente?
   → Se não: "You must have magic level X to learn this spell."
6. Fase 2c: Gold suficiente?
   → Se não: "You do not have enough gold."
7. Fase 2d: Sucesso!
   → Cobra gold + ensina spell + "From now on you can cast this spell."
8. Fase 4: Default → "I thought so." (se nada matchou)
```

Para keywords com vocação explícita no response (ex: "berserk" → "only for knights"):
→ Responde diretamente o texto da keyword e cancela auto-evaluate.

---

## Arquivos Relevantes

- `engine/src/npc/npc-conversation-handler.js` — Toda a lógica da engine
- `data/npcs/definitions/` — 32 NPCs JSON com dados de spell adicionados
- `data/npcs/definitions/script/` — Scripts originais (SpellTeacher removido)
- `D:\GitHub\tibiajs\npcs\definitions\` — Backup dos JSONs originais
