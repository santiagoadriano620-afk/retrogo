# TibiaJS — Sumário de Melhorias

## 1. Performance

| Métrica | Antes | Depois |
|---------|-------|--------|
| Draw time | ~25.200 tile iterations/frame | ~5.000 tile iterations/frame |
| Frame rate | ~41 fps | 60–61 fps |
| Draw time (μs) | — | 3.830–7.338 μs (budget 16,6ms) |
| Weather transition | clareava e escurecia com fade | claro→escuro imediato, escuro→claro fade-out 60 frames |
| Rebuild cache de fundo | setTimeout() | síncrono (sem lag visual) |

### O que foi feito
- `weather-canvas.js:134`: corrigido `"\t"` → `"off"` (operador ternário quebrado)
- `settings.js`: weather toggle agora chama `weatherCanvas.setWeather(0.4/0)` via `__applyWeather(enabled)` com guarda `typeof gameClient !== 'undefined' && gameClient && gameClient.renderer`
- Cache de fundo reconstruído síncrono (sem `setTimeout`)
- Worker pool de pathfinding real com `worker_threads` (até N-1 workers em cores separados)

---

## 2. Estabilidade / Bugs Corrigidos

### 2.1 `gameClient is not defined` no Settings
**Causa:** `settings.js:253` chamava `gameClient.renderer...` antes de `window.gameClient` ser atribuído.

**Solução:** helper `__applyWeather(enabled)` com guarda.

### 2.2 Definitions.json 404
**Causa:** `gameclient.js:58` fazia fetch de `./definitions.json`, mas o arquivo foi movido para `client/items/`.

**Solução:** path corrigido para `./items/definitions.json`.

### 2.3 "Unknown packet" no login (XOR key perdida)
**Causa:** O `xorKey` retornado pelo login-server era passado para `__openSocket()` apenas no fluxo direto (`connect()`), mas **não** no fluxo com seletor de personagem (`connectWithToken` → character modal). O cliente recebia dados XOR-criptografados do servidor mas não descriptografava → opcode sempre errado → "unknown packet" em todo pacote.

**Solução:** 3 arquivos alterados:
- `interface.js:572` — `xorKey` agora incluso nas options do modal de personagens
- `modal-characters.js:87` — passa `xorKey` para `connectWithToken`
- `network-manager.js:545-554` — `connectWithToken` aceita 4º parâmetro `xorKey`

### 2.4 Remove [STACK] debug logs
7 `console.warn("[STACK] ...")` removidos de `tile.js` e `world-creature-handler.js`.

### 2.5 Mana fluid não restaura (NÃO RESOLVIDO)
`Creature.increaseMana` → `setProperty(MANA)` → `CreatureProperties.setProperty` **já** envia `CreaturePropertyPacket` via broadcast. O fluxo do servidor parece correto, mas o cliente não atualiza a barra de mana. Pendente de investigação.

---

## 3. Organização / Limpeza

| Ação | Detalhes |
|------|----------|
| **Unused movidos para `engine/_unused/`** | `client-server.js`, `client-server.py`, `Dockerfile`, `docker-compose.yml`, `postgres-compose.yml`, `nginx-system.conf`, `ipcclient.js`, `start.js`, `test.js`, `tutorials/` |
| **client-server.js restaurado** | Voltou para `engine/` |
| **start.js movido para raiz** | `ROOT = __dirname` (agora raiz do projeto), inicia engine + login automaticamente |
| **Drizzle/SQLite removido** | `drizzle/`, `drizzle.config.js`, `src/db/` — código morto, projeto nunca usou SQL |
| **Logs movidos para `engine/logs/`** | `server.log` e `packets.wal` |
| **engine/config.json** | `FILEPATH: "engine/logs/server.log"` |
| **network-manager.js:26** | `createWriteStream("engine/logs/packets.wal")` |
| **Conta `test123` removida** | Schema incompatível (`maxHealth`/`maxMana` vs `healthMax`/`manaMax`) |

---

## 4. Segurança

### 4.1 HMAC Secret aleatório
**Antes:** `"0000000000000000000000000000000000000000000000000000000000000000"` (hardcoded, qualquer um forjava tokens).

**Depois:** 64 hex chars gerado com `RandomNumberGenerator` — único por instalação.

### 4.2 XOR encryption opcional
Nova seção `ENCRYPTION.ENABLED` no `config.json`. Controla se o login-server gera e retorna chave XOR. Quando desligado, o servidor não XOR os pacotes. Útil quando WSS está ativo e a camada extra de ofuscação é redundante.

Arquivos alterados: `config.json`, `login-server.js`, `auth-service.js`.

### 4.3 Default character apenas em dev
`account-database.js` agora checa `CONFIG.SERVER.PRODUCTION` — se true, **não** cria a conta God automaticamente.

### 4.4 Sanitização XSS
- `packet-handler.js:handlePlayerSay` — chat público: limpa `<>"&`, limita 256 chars
- `channel-manager.js:handleSendPrivateMessage` — mensagem privada: mesma sanitização
- `packet-handler.js:writeText` — livros/labels: limpa `<>`, limita 2048 chars

### 4.5 Rate Limiter
**Login server (HTTP):** já existia — 5 tentativas/min/IP.

**Game socket (WS):** já existia em `gamesocket.js:328-334` — 20 pacotes/segundo. Se exceder, fecha a conexão.

### 4.6 Mensagens de erro genéricas
Login-server retorna 401/500 com corpo vazio — não vaza detalhes de implementação.

---

## 5. Monitoramento (start.js)

Reescrito com:

| Funcionalidade | Detalhes |
|---|---|
| **Auto-restart** | Se um serviço morre com código ≠ 0 (exceto SIGTERM), reinicia até 5× com delay 1s. Loga uptime e causa |
| **Métricas sob demanda** | A cada 30s coleta: players, memória RSS, CPU (Linux). **Só imprime se algo mudou** (>100KB RSS, >1% CPU, player count alterado) |
| **Shutdown gracioso** | Flag `shuttingDown` previne restart loop. Force exit após 3s |

---

## 6. Próximos Passos / O que pode ser melhorado

### 6.1 Cluster mode para game engine
O `client-server.js` já usa `cluster`. O engine.js poderia fazer o mesmo — 1 worker por core, balanceamento de players. Daria para escalar horizontalmente no mesmo servidor.

### 6.2 Resolver mana fluid
Pendente desde o início. Investigar se o cliente ignora `CreaturePropertyPacket` com property `MANA` (12), ou se o valor chega mas o UI não re-renderiza.

### 6.3 Backup automático dos accounts
`data/accounts/` contém JSONs dos jogadores. Um cron/script de backup periódico evitaria perda de dados. Fácil de adicionar no `start.js`.

### 6.4 Health check externo
O `start.js` removeu o health check por TCP (causava falso positivo). Em produção com systemd, o `Type=notify` ou watchdog do systemd faz isso melhor.

### 6.5 Melhorias no login (produção)
- HMAC secret via env var (`process.env.HMAC_SECRET`) em vez de config.json
- Desligar XOR quando `ENCRYPTION.ENABLED=false`
- `SERVER.PRODUCTION=true` desliga conta God

### 6.6 Log rotation
Atualmente `server.log` e `packets.wal` crescem indefinidamente. Usar `logrotate` no Linux ou `circular-buffer` no Node.

### 6.7 Painel admin via HTTP
Endpoint simples em uma porta separada (ex.: 8080) mostrando status dos serviços, players online, métricas em tempo real. Útil para monitoramento sem acessar SSH.

---

## 7. Arquivos Modificados (referência rápida)

```
config.json                          ← HMAC secret, ENCRYPTION, PRODUCTION
start.js                             ← reescrito (monitoramento, auto-restart)
engine/
├── client-server.js                 ← restaurado
├── config.json                      ← FILEPATH dos logs
├── lib/worker-pool.js               ← real worker_threads (já existia)
├── lib/workers/pathfinder-worker.js  ← real worker file (já existia)
└── src/
    ├── auth/
    │   ├── account-database.js      ← default char só em dev
    │   ├── auth-service.js          ← XOR opcional
    │   └── login-server.js          ← XOR opcional
    ├── channels/
    │   └── channel-manager.js       ← sanitização XSS
    ├── entities/
    │   └── tile.js                  ← removeu [STACK] debugs
    ├── network/
    │   ├── gamesocket.js            ← rate limit (já existia)
    │   └── network-manager.js       ← log path
    └── core/
        └── world-creature-handler.js ← removeu [STACK] debugs
client/src/
├── core/
│   ├── gameclient.js                ← path definitions.json
│   └── database.js                  ← loadConstants (já funcionava)
├── network/
│   └── network-manager.js           ← xorKey em connectWithToken
├── ui/
│   ├── interface.js                 ← xorKey no modal de personagens
│   ├── settings.js                  ← weather guard
│   └── modals/
│       └── modal-characters.js      ← xorKey para connectWithToken
```
