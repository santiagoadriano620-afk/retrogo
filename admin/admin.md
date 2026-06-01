# TibiaJS Admin Panel — Technical Reference

## Architecture

```
admin/
├── client/                    # React (Vite) frontend — SPA
│   ├── src/
│   │   ├── api/client.js      # API helper — wraps fetch with credentials
│   │   ├── App.jsx            # Root — login gate + page routing
│   │   ├── components/
│   │   │   ├── Layout.jsx     # Sidebar + content area
│   │   │   └── Terminal.jsx   # Socket.IO live terminal (ANSI-stripped)
│   │   └── pages/
│   │       ├── Login.jsx
│   │       ├── Dashboard.jsx
│   │       ├── Players.jsx     # Paginated player list
│   │       ├── PlayerDetail.jsx # Info/Skills/Inventory/Depot/Actions
│   │       ├── SearchItem.jsx  # Global item search across all players
│   │       └── ServerControl.jsx # Start/stop/restart + terminal
│   └── dist/                   # Build output (served by Express)
└── server/
    ├── index.js                # Express entry point (port 3000)
    ├── lib/
    │   ├── database.js         # SQLite queries + skill formulae
    │   ├── game-bridge.js      # HTTP client to engine admin API (port 2224)
    │   ├── items.js            # items.xml parser (id → name)
    │   ├── process-manager.js  # Spawn/kill start.js child process
    │   └── sprite-extractor.js # Tibia.dat/.spr parser + PNG generator
    ├── middleware/auth.js      # Session auth middleware
    ├── routes/
    │   ├── auth.js             # POST /login, /logout, GET /check
    │   ├── dashboard.js        # Engine status + DB counts
    │   ├── players.js          # Player CRUD, depot, ban, item search
    │   ├── server.js           # Start/stop/save/broadcast/shutdown
    │   └── sprites.js          # GET /:id → item sprite PNG
    └── sprites/                # Cached sprite PNGs (auto-generated)
```

## Ports

| Service | Port | Purpose |
|---------|------|---------|
| Admin panel | 3000 | Express HTTP + Socket.IO |
| Login server | 8000 | Auth + serves web client |
| Game engine WS | 2223 | WebSocket game protocol |
| Engine admin API | 2224 | Localhost, Bearer token |

## Auth Flow

1. Login page → `POST /api/admin/login` with account/password
2. Server validates against `accounts` table (bcrypt hash)
3. Express session created (cookie `connect.sid`)
4. `requireAdmin` middleware checks `req.session.accountId`
5. Logout destroys session

Admin account: account `371903`, requires `group_id >= 3`.

## API Endpoints

All under `/api/admin/`. Most require session auth (exception: `/sprites`).

### Auth
- `POST /login` — `{ account, password }` → `{ success }`
- `POST /logout` — destroy session
- `GET /check` → `{ authenticated, account }`

### Dashboard
- `GET /dashboard` → `{ server: { online, uptime, playersOnline }, database: { totalCharacters, totalAccounts } }`

### Players
- `GET /players?search=&vocation=&page=&limit=` — paginated list (parses JSON `data` blob to extract level/skills)
- `GET /players/online` — from engine admin API
- `GET /players/:name` — full player data with item names injected recursively
- `GET /players/:name/depot` — flattened depot + inventory with item names
- `GET /players/search-item?itemId=X` — scans ALL players' `data` JSON recursively
- `PUT /players/:name/level` — set level (clamped 1–1000)
- `PUT /players/:name/skills` — set skill levels (clamped 0–200, validated)
- `PUT /players/:name/property` — set single property
- `DELETE /players/:name/kick` — kick from engine
- `PUT /players/:name/ban` — `{ days, reason }`, writes to `bans` table
- `PUT /players/:name/unban` — sets `active = 0`

### Server
- `GET /server/status` → `{ running, pid }`
- `POST /server/start` — spawns `node start.js` via process-manager
- `POST /server/stop` — sends SIGINT
- `POST /server/restart` — stop + start
- `POST /server/save` — engine admin API
- `POST /server/shutdown` — engine admin API
- `POST /server/broadcast` — `{ message }` → engine admin API

### Sprites (no auth required)
- `GET /sprites/:id` — returns PNG for item ID (cached in `admin/server/sprites/`)

### MC Check (multi-client detection)
- `GET /mccheck/scan` — scans all accounts + online players, groups by IP, detects VPN/datacenter IPs, returns clusters

  **Data sources:**
  - `accounts.ip` (registration IP) + `accounts.last_ip` (added by migration, auto-populated on engine-side login)
  - Engine admin API `/api/status` — live player IPs (via `bridge.getStatus()`)
  - ip-api.com (free, no key, 45 req/min) — IP reputation (proxy/hosting detection, cached 1h)

  **Flags:**
  - `vpn` — IP is a known VPN/datacenter (ip-api.com `proxy:true` or `hosting:true`)
  - `shared_online` — 2+ players online from same IP right now
  - `shared_reg` — 2+ accounts registered from same IP (only 1 currently online)

  **Response:**
  ```json
  {
    "clusters": [ { "ip", "flag", "isp", "org", "country", "city", "online": [], "missingAccounts": [], "accounts": [] } ],
    "engineError": "Unauthorized (CONNECTION_REFUSED)" | null,
    "summary": { "totalClusters", "vpnDetected", "sharedOnlineIps", "sharedRegIps", "totalOnline" }
  }
  ```

  `engineError` is populated when `bridge.getStatus()` returns an error (e.g., engine offline, unauthorized) — the frontend shows a red warning banner.

  **DB columns** (auto-migrated on admin panel startup via `database.js:migrate()`):
  - `accounts.last_ip TEXT` — last login IP
  - `accounts.last_login INTEGER` — timestamp of last login

  **Engine setup required** for `last_ip` tracking: See `engine/src/network/websocket-server.js __acceptCharacterConnection` — calls `accountDatabase.setLastIp(accountId, ip, callback)` after successful login. (Currently only uses `accounts.ip` reg IP if engine side not updated.)

## Database

`D:\GitHub\tibiajs\data\database\tibia.db` (SQLite)

Key tables:
- `accounts` — `id`, `hash` (bcrypt), `name`, `group_id`, `ip` (registration IP), `last_ip` (last login IP, added via migration), `last_login` (timestamp), `premium_expiry`
- `characters` — `id`, `account_id`, `name`, `data` (JSON blob), `created_at`, `updated_at`
- `bans` — `id`, `character_name`, `reason`, `days`, `banned_by`, `expires_at`, `active`

### characters.data JSON structure

```json
{
  "properties": {
    "name": "God",
    "health": 150, "healthMax": 150,
    "mana": 0, "manaMax": 0,
    "capacity": 400, "capacityMax": 400,
    "speed": 220, "vocation": 0, "sex": 1,
    "outfit": { ... }
  },
  "skills": {
    "magic": 0, "fist": 10, "club": 10, "sword": 10,
    "axe": 10, "distance": 10, "shielding": 10, "fishing": 10,
    "experience": 0
  },
  "containers": {
    "equipment": [ /* 10 slots — see below */ ],
    "depot": [ /* 20 depot pages */ ],
    "inbox": [ /* inbox items */ ]
  }
}
```

### Equipment slots (0–9)

| Index | Slot | 
|-------|------|
| 0 | Head |
| 1 | Amulet |
| 2 | Backpack (Container) |
| 3 | Armor |
| 4 | Right Hand |
| 5 | Left Hand |
| 6 | Legs |
| 7 | Boots |
| 8 | Ring |
| 9 | Ammo |

Each slot = `{ id, count, items?: [...] }` or `null`. Backpacks/containers have `items` array.

### Depot structure

`containers.depot[0..19]`, each is:
- `{ id, items: [30 slots] }` — depot page with items array
- `{ id, content: "string" }` — house deed/message
- `null` — empty slot

Items inside containers can be nested (backpack inside depot):
```json
{ "id": 1988, "count": 1, "items": [ { "id": 2148, "count": 5 }, null, ... ] }
```

## Skill Formulae

Skill levels are computed from "tries" (internal XP for each skill):

- Level: `(50/3) * (lvl³ - 6*lvl² + 17*lvl - 12)`
- Skills: `tries = skill * CONSTANT * VOCATION_MULTIPLIER` where:
  - magic uses offset 0, others offset 10
  - Base constants: magic=1600, fist=50, club=50, sword=50, axe=50, distance=25, shielding=100, fishing=20
  - Vocation multipliers vary by class (see `database.js`)

## Sprite System (v740)

Source files: `D:\GitHub\tibiajs\client\things/`

### Tibia.dat (40BF619C)
- Header: signature(4B) + itemCount(2B) + outfitCount(2B) + effectCount(2B) + distanceCount(2B)
- Items start at ID 100, up to `itemCount + outfitCount + effectCount + distanceCount`
- Each item: flags (until 0xFF) → dimensions → sprite IDs (16-bit)
- Flag remapping is version-specific (v740 mapping in `sprite-extractor.js:mapFlagV740`)
- For v740: groupCount=1 (not stored), type=0 (not stored), patternZ=1 (not stored)

### Tibia.spr (40B9EA86)
- Header: signature(4B) + spriteCount(2B)
- Address table: spriteID 1..N → 4-byte file offset (0 = null)
- Each sprite: 3B color key + 2B data size + RLE pixel data
- RLE pairs: transparentCount(2B) + coloredCount(2B) + RGB pixels
- v740: RGB 3-byte pixels (no alpha), 32×32 resolution

### sprite-extractor.js
- Singleton: loads `.dat` and `.spr` lazily on first request
- `parseDat()` → `{ itemId: firstSpriteId }` (3235 items)
- `parseSpr()` → `{ spriteId: fileAddress }` (6444 sprites)
- `decodeSprite()` → raw RGBA Uint8Array (32×32×4)
- `sharp` converts RGBA → PNG, cached in `admin/server/sprites/`

## Item Name Resolution

1. `items.xml` (`D:\GitHub\tibiajs\data\items\items.xml`) parsed by `items.js` → `Map<id, name>`
2. Backend injects names into player data via `injectItemNames()` — recursive walk of `char.data`
3. Depot endpoint uses `flattenItems()` which resolves names server-side
4. Frontend `ItemRow` displays `item.name || 'Unknown'`

## Global Item Search

`GET /players/search-item?itemId=2148`:
1. Queries ALL characters directly from DB
2. `searchItemInData()` recursively walks entire `data` JSON
3. Matches any object with `.id` or `.itemId` equal to target
4. Groups results by location label (Equipment: Legs, Depot[3], etc.)
5. Route defined BEFORE `/:name` to avoid Express param capture

## Game Bridge (Engine Communication)

`admin/server/lib/game-bridge.js` — HTTP client to the engine admin API at `127.0.0.1:2224`.

### ADMIN_SECRET auto-detection
The bridge needs the correct `Bearer` token to authenticate with the engine. Resolution order:
1. `process.env.ADMIN_SECRET` (explicit env var)
2. Reads `engine/.env` file and extracts `ADMIN_SECRET=...` (auto-discovery)
3. Falls back to `"changeme"`

This means the admin panel **does not need manual configuration** — it automatically picks up the secret from the engine's `.env` file. If you change the secret in `engine/.env`, restart the admin panel to re-read it.

### Available methods
- `getStatus()` → `GET /api/status` (players list with IPs)
- `getPlayers()` → `GET /api/players`
- `broadcast(message)` → `POST /api/broadcast`
- `saveAll()` → `POST /api/save`
- `shutdown()` → `POST /api/shutdown`
- `kickPlayer(name)` → `POST /api/kick`
- `updatePlayer(body)` → `POST /api/player`

### Debugging
If the dashboard or MC Check shows "Unauthorized", the bridge is sending the wrong secret. Check:
1. `engine/.env` has `ADMIN_SECRET=...`
2. Admin panel is restarted after secret change
3. The regex in `loadAdminSecret()` expects `ADMIN_SECRET=<value>` at line start (no spaces)

## Process Manager

`process-manager.js` spawns `node start.js` as a child process:
- Captures stdout/stderr → emits via Socket.IO `terminal` event
- Tracks PID, running state
- `stop()` sends SIGINT, waits for graceful shutdown
- `restart()` = stop + start
- Admin panel and server process are independent — panel stays up if server crashes

## Frontend Notes

- No framework router (simple state-based navigation via `setPage`)
- `PlayerDetail` is shown directly (not via `PAGES` map) because it needs `playerName` param
- Socket.IO for live terminal (connects on mount, disconnects on unmount)
- Items use `<img src="/api/admin/sprites/ID">` with `imageRendering: pixelated`
- On error, sprite falls back to "?" placeholder
- Auto-refresh removed from all pages (manual refresh buttons only)

## Common Issues

### "Unable to verify the first certificate"
The server tries to fetch `https://www.vestauth.com` on startup — disable `REQUIRE_VAULT` or set `VAULT_DISABLE_REMOTE=true` in `.env`.

### Server crash on player login
Check for corrupt skill/experience values in `characters.data`. The `skills` object should contain reasonable numbers (fits in u32). Run:
```sql
UPDATE characters SET data = json_set(data, '$.skills.magic', 0) WHERE name = 'God';
```

### Sprite not found for item ID
Items without .dat entries (e.g., quest-only items > totalCount) render as dark placeholder. Items with spriteId=0 also show placeholder.

### ANSI terminal codes
Removed client-side via regex: `line.message.replace(/\x1b\[[0-9;]*m/g, '')`

### MC Check / Dashboard shows "Unauthorized" or 0 online
The engine admin API secret doesn't match between engine and admin panel. The bridge auto-detects from `engine/.env`, but if that file is missing or unreadable, it falls back to `"changeme"`. Fix:
1. Verify `engine/.env` contains `ADMIN_SECRET=<hex>`
2. Restart the admin panel so `game-bridge.js` re-reads the file
3. Test: `curl http://127.0.0.1:2224/api/status -H "Authorization: Bearer <secret>"`

### MC Check "Engine offline / erro de conexão"
Port 2224 is not responding. The engine process (start.js) may have crashed or was killed. Go to Servidor → Start to restart it. Note: killing the admin panel process also kills the engine (child process with `detached: false`).

## File Paths Reference

| Path | Purpose |
|------|---------|
| `admin/server/index.js` | Express entry (port 3000) |
| `admin/server/lib/items.js` | items.xml parser |
| `admin/server/lib/database.js` | SQLite + skill formulae |
| `admin/server/lib/game-bridge.js` | Engine admin API client (auto-detects ADMIN_SECRET) |
| `admin/server/lib/process-manager.js` | Child process spawner |
| `admin/server/lib/sprite-extractor.js` | .dat/.spr → PNG pipeline |
| `admin/server/routes/players.js` | All player-related endpoints |
| `admin/server/routes/mccheck.js` | MC Check scan endpoint + IP reputation via ip-api.com |
| `admin/server/sprites/*.png` | Cached item sprites |
| `admin/client/src/pages/SearchItem.jsx` | Global item search UI |
| `admin/client/src/pages/McCheck.jsx` | Multi-client detection UI (scan button + clusters) |
| `admin/client/src/pages/PlayerDetail.jsx` | Player inventory/depot/actions |
| `engine/src/admin/admin-api-server.js` | Engine-side admin API |
| `client/things/Tibia.dat` | Item definitions (v740) |
| `client/things/Tibia.spr` | Sprite data (v740) |
| `data/items/items.xml` | Item ID → name mapping |
| `data/database/tibia.db` | Game database (SQLite) |
