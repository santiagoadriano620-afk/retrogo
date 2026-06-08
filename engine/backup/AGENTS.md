# AGENTS — RetroGO Mobile Touch & D-Pad

## What was done

### Fullscreen mobile layout
- Detects mobile via UA + touch + screen size (OR logic)
- Floating "Jogar" button appears in landscape
- On tap: `requestFullscreen()` + locks orientation to landscape
- Canvas set to **480×480 square** (15 tiles × 32px), centered in viewport
- Desktop layout elements hidden via CSS (`body.mobile-fullscreen`)
- `getResolutionScale` overridden to scale the 480×480 canvas to fill the screen
- `handleResize` + `applyZoom` overridden to prevent desktop layout interference

### Rendering centering (mobile)
- `playerTileOffsetX/Y = 7.5` (15/2) on mobile
- Uniform tile culling: `cullMargin = 14` (all sides), `bgCullMargin = 16`
- Background cache shift: `__bgCacheShiftX/Y = 1` (32px) + `context.translate(32,32)`
- Background cache canvases recreated at **1080×640**
- `getWorldCoordinates` uses `Math.floor(x/sx + px - ox)` with dynamic `o.x/y` for fractional offset
- `setScale` transform origin uses dynamic `playerTileOffsetX/Y`
- `__getFloorTilesTiles` uses dynamic cull margins
- Nickname positioning (`__getAbsoluteOffset`) has separate mobile-FS path (no viewport offset added)
- `__canvasOffsetX/Y` cached for screen element positioning

### Hotbar removal
- Entire `.hotbar` HTML + CSS removed (3 copies of hotbar.css emptied)
- `hotbar-manager.js`, `menu-hotbar.js`, `modal-hotbar-text.js` replaced with empty stubs
- All references in launcher.js, interface.js, menu-manager.js, modal-manager.js, modal-spellbook.js, renderer.js, mouse.js, spellbook.js removed
- `keyboard.js` F1-F12 now route directly to `__handleHotkey`

### D-Pad (mobile fullscreen)
- Self-contained in `mobile-fullscreen.js`
- **Arcade joystick style**: 120px circle, transparent background, white border ring, silver ball center (28px)
- **Ball follows touch**: proportional offset (max 28px) based on touch distance from center, returns smoothly on release (`.returning` transition 0.15s)
- **8-direction angle detection** via `Math.atan2`, 18px dead zone
- **Smooth movement**: key codes added to `Keyboard.__activeKeys` (not interval-based `handleMoveKey`)
  - Cardinal directions: arrow keys (37-40)
  - Diagonals: Q(81), E(69), Z(90), C(67)
- Auto-repeat handled by existing `Keyboard.handleInput()` at ~60fps + movement buffer
- D-pad only visible when `gameClient.player` exists (player entered world) + fullscreen active
- 1-second interval checks for player appearance

### Canvas touch (attack + use)
- `touchstart` listener on `#canvas-id` (only when `active + gameClient.player`)
- **Single tap on creature** → `gameClient.world.targetMonster()` (toggle target)
  - Checks center tile + 4 cardinal neighbors (~1.5 SQM hitbox)
  - `preventDefault()` cancels the walk
- **Double tap on non-creature** → `gameClient.mouse.use()` (same as right-click use)
  - 300ms / 30px threshold
- Cancel attack only by: creature leaving sight, level change, or tap again to untarget

### Equipment slots on mobile (JS panel)
- Created `__createMobileSlots()`: builds `#mobile-equipment` fixed panel (right side) with 10 slot elements across 3 columns (left: shoulder/left/ring+conditions, center: head/armor/legs/boots, right: backpack/right/quiver+capacity)
- `setElement()` rebinds each `Slot` to the mobile DOM element + calls `render()` to draw item sprite on canvas
- Desktop slot CSS backgrounds injected via `#mobile-equipment [slotIndex=N]` selectors — matches `Equipment.equipSlot()`/`removeItem()` dynamic `style.backgroundImage` changes
- Original desktop elements stored in `__originalSlotEls[]`, restored on `__destroyMobileSlots()`
- Conditions display and capacity display moved from desktop oogwrap into mobile panel, restored on destroy
- Canvas in each slot positioned at `top:0;left:0` for proper item overlay

### Drag sprite on mobile touch
- Extended `__bindSlotTouch()` to call `mouse.__renderDragSprite()` + `mouse.__updateDragSpritePosition()` — creates a 32×32 floating canvas with the item sprite following the finger
- `e.preventDefault()` suppresses simulated mouse events during drag

### Drag from containers + ground to inventory
- New `__getSlotObjectFromEvent()`: detects drag source from any `.slot` (equipment OR container windows) using `[containerIndex]` + `getContainer()`
- New `__getGroundObjectFromEvent()`: detects drag source from canvas/tiles via `mouse.getWorldObject()`, checks `isMoveable()` on top tile item
- `getDropTarget()` in `handleTouchEnd` resolves drop target: canvas (ground), equipment/container slots, or container window background (auto-finds empty slot)

### Container toggle (tap to open/close)
- In `handleTouchEnd` when no drag occurred (<8px threshold): checks if source item `isContainer()` → calls `gameClient.mouse.use()` which sends `ItemUsePacket` (same as right-click use on desktop)

### Long-press reposition (equipment + D-pad)
- `__enableRepositionDrag()`: generic long-press → drag mechanism
- 3s hold on any slot → dashed gray blinking border on `#mobile-equipment` (CSS animation)
- 3s hold on D-pad → dashed gray blinking border on `#mobile-dpad`
- After release: frame stays blinking, element is in reposition mode
- Next touch + drag: moves element freely with `position:fixed` (`left`/`top`)
- Release: saves position to `localStorage` (`retrogo_equip_pos`, `retrogo_dpad_pos`)
- Reposition mode checked in all existing touch handlers to prevent interference (D-pad movement, item drag)
- Position saved on fullscreen exit

### Equipment panel cleanup on player logout
- `checkPlayer` interval: when `gameClient.player` becomes null while `__mobilePanel` exists, calls `__destroyMobileSlots()` to remove panel and rebind slots to desktop DOM

### Null-player safety
- `Keyboard.handleMoveKey()`: added `!gameClient.player` guard before `__serverWalkConfirmation`
- `MobileFullscreen.__dpadExecuteMove()`: added `gameClient.player` check in guard

### External access
- `EXTERNAL_HOST` / `LOCAL_HOST` in `.env`, `config.js`, `env-mapper.js`
- Login server auto-detects local vs external clients

### Action buttons module (4 quick-action buttons)
- New `#mobile-action-btns` positioned at bottom-center (horizontal row), above the actionbar
- 4 buttons (36×36px):
  - **Eye** — toggle look mode; next canvas tap calls `mouse.look(getWorldObject(event))`
  - **Crossed Swords** — cycles monsters by distance from player; sends `TargetPacket`; deselects when end reached
  - **Backpack** — calls `mouse.use({ which: equipment, index: 6 })` to open player's backpack
  - **Chat** — toggles a text input bar at bottom of screen; Enter/Send calls `ChannelMessagePacket(0, 1, msg)`
- Icons drawn on 28×28 canvases per button via `__drawActionIcon()` with pixel-art style (eye, crossed swords, backpack, chat bubble)
- Lock icon (same lock/drag pattern as dpad/equipment) — `__enableLockableDrag(container, 'actionBtns', ...)`
- Persistence: `localStorage['retrogo_actionBtns_pos']` + `retrogo_actionBtns_lock`
- **Create/destroy**: integrated into `__handleFullscreenChange` (enter/exit) and `checkPlayer` interval (player login/logout)

### Equipment panel layout rework (mobile)
- Replaced the right-side button column (Skills/Battle/VIP/Quests/Options/Logout) with combat mode controls (fight + chase + safe fight)
- 6 action buttons moved BELOW the equipment slots, arranged as 2 rows of 3 buttons (Skills/Battle/VIP top, Quests/Options/Logout bottom)
- Combat modes column (4th column in equipment flex-row): 3 fight mode buttons (offensive/balanced/defensive), separator, 3 chase/follow buttons (stand/chase/safe fight)
- Each combat button uses the same icon images as desktop (`/images/game/combatmodes/*.png`)
- Active state sync via `__syncCombatVisState()` reads from `FightModeSelector` state → gold border + dark gold bg on active buttons
- Click handlers reuse `gameClient.interface.fightModeSelector.setFightMode/setChaseMode/toggleSafeFight()` (same desktop code path, sends FightModePacket/ChaseModePacket)
- Equipment panel `__enableLockableDrag` repositions entire panel (including combat modes + action buttons) when unlocked

## Files changed
- `client/src/ui/mobile/equipment.js` — new combat modes column, 2×3 action buttons below, __syncCombatVisState method
- `client/src/ui/mobile-fullscreen.js` — all mobile fullscreen, dpad, touch logic, equipment panel, long-press reposition, drag sprite, container toggle, action buttons module (4 buttons + canvas-drawn icons)
- `client/src/input/keyboard.js` — null-player guard in handleMoveKey
- Various hotbar files removed/stubbed (7+ files)
- `engine/.env`, `engine/config.js`, `engine/lib/env-mapper.js`, `engine/src/auth/login-server.js`
- `AGENTS.md` — this file

## Key Implementation Details
- `#mobile-equipment` uses CSS rule injection (`__injectStyles`) for per-slot background images via `[slotIndex]` attribute selectors, matching desktop `Equipment.equipSlot()`/`removeItem()` inline style changes
- Drag sprite uses `mouse.__renderDragSprite()` (desktop's existing method) — creates a `position:fixed;pointer-events:none` canvas with the item sprite, reused for equipment, containers, and ground drags
- Container toggle reuses `mouse.use()` which sets `__pendingContainerOpen` and sends `ItemUsePacket` — same code path as desktop right-click
- `localStorage` keys: `retrogo_equip_pos` (equipment panel), `retrogo_dpad_pos` (D-pad)
- CSS animation `mob-rep-blink` alternates border-color opacity for blinking dashed border

## Known issues
- VisualViewport not used for canvas sizing (reverted to `window.innerHeight`); bottom edge may cut off during fullscreen transition on some browsers
- Diagonal D-pad movement uses keyboard cooldown (`__diagonalMoveCooldown`) — same as desktop
- Ground drag and creature attack share the same touchstart on canvas; if a tile has both items and creatures, attack fires first (tap again to untarget)

## Testing
- Test on real mobile device: landscape fullscreen, dpad movement (all 8 dirs), single-tap creature attack, double-tap item use
- Test equipment panel: all 10 slots visible, conditions + capacity displays, item sprites render, drag items between slots/containers/ground
- Test container toggle: tap container item in slot → opens window, tap again → closes
- Test long-press reposition: hold slot/dpad 3s → blinking border → drag to reposition → persists across sessions
- Test logout: equipment panel disappears when returning to login screen
- Desktop: click-drag on dpad via mouse events

### Lock/unlock module reposition (lock icon)
- Replaced long-press (3s hold + blinking border) reposition with an always-visible lock icon in the top-left corner of each module
- Dpad wrapper (`#mobile-dpad-wrapper`) is a 130x130px `position:fixed` container with 1px gray border and rounded corners; the 120px dpad circle is centered inside via flexbox/absolute positioning
- Equipment panel (`#mobile-equipment`) also has 1px gray border + `border-radius: 3px` + lock icon
- Lock icon: 18x18px circle, gold `#d4a017` when locked 🔒, green `#5cd45c` when unlocked 🔓
- Click/touch on icon toggles between locked (gameplay normal) and unlocked (drag module freely)
- State (`retrogo_dpad_lock`, `retrogo_equip_lock`) saved to localStorage alongside position
- Dpad touch events block when unlocked (check `__lockStates.dpad === false`)
- Slot touch/drag blocks when equipment unlocked (check `__lockStates.equip === false`)
- `__enableLockableDrag` replaces `__enableRepositionDrag` — no 3s timer, immediate drag when unlocked
- `__saveModuleState` replaces `__saveRepositionPosition` — saves both position and lock state
- `__repositioning` and `self.__repositioning` references completely removed
- CSS: removed `@keyframes mob-rep-blink`, `#mobile-equipment.reposition-mode`, `#mobile-dpad.reposition-mode`

### Actionbar module (8 quick-use slots)
- New `#actionbar` fixed at bottom center of viewport, above the game canvas
- 8 slots (`.actionbar-slot`) in a horizontal row, 32×32px each with dark background and subtle border
- Lock icon (same pattern as dpad/equipment) — `__enableLockableDrag(bar, 'actionbar', ...)`
- **Drag items in**: drag from inventory/container/equipment onto an actionbar slot → stores reference (`{ which, index }`), item stays in original container
- **Tap to use**: single tap on a filled slot → calls `gameClient.mouse.use(data)` — works for any `use()`able item (potions, runes, ropes, etc.)
- **Multi-use / use-with**: if item is multi-use (rope, runa, etc.), `mouse.use()` sets `__multiUseObject` and enters crosshair mode; next canvas tap completes the use-with
- **Highlight**: when `__multiUseObject` matches an actionbar slot, that slot gets `.highlighted` class (golden border + glow) — removed automatically when use-with finishes or cancels
- **Drag out**: drag from actionbar back to inventory/ground/container → item moves normally via `sendItemMove()` + actionbar slot cleared
- **Persistence**: `localStorage['retrogo_actionbar_data']` stores 8 entries as `{ ci, si }` (container index + slot index, or `ci:-2` for equipment); stale references (item gone) show empty slot
- **Lock guards**: `__lockStates.actionbar` blocks both actionbar slot tap/drag and document-level slot drag when unlocked
- **Create/destroy**: integrated into `__handleFullscreenChange` (enter/exit) and `checkPlayer` interval (player login/logout)
- **Rendering**: uses global `Canvas` wrapper with `drawSprite(item, false, false)` on each slot's canvas; stack counts shown on stackable items

### Mobile window management (this session)
- **Container window created from scratch** — `Container.prototype.createDOM` overridden to build elements directly (no `prototype.cloneNode`), avoiding the hidden `.prototype` display issue
- **Named windows (skill, battle, VIP, party, quest) moved to `document.body`** — `wm.getFreeStack` returns `document.body`, `wm.getStack('right'/'extra')` returns `document.body`, other stacks fall through to original
- **Container window 4 slots per row** — width `155px` to accommodate border-image
- **Window drag simplified** — per-drag temporary document listeners via closure (touchstart → add `onMove`/`onEnd` on document, touchend → remove); `header.style.pointerEvents = 'auto'` ensures whole header is draggable including over text
- **Footer resize via touch** — resizes window height with `maxH` clamped to viewport or body scroll height
- **VIP + button** — `+` button inserted in `friend-window` header before close; prompts for name, sends `FriendAddPacket`; double-tap on friend entry calls `FriendRemovePacket` with confirm dialog
- **Debug logs cleaned** — removed `[DRAG]`, `[MOUSE]`, `[ACTIONS]` logs from drag.js, actions.js, topbar.js
- **Backpack action button toggles container** — calls `mouse.use({ which: equipment, index: 6 })` (same code path as tap on backpack slot)
- **`__dragSprite = null` in handleTouchStart** — defensive null check before rendering drag sprite
- **Window position persistence** — saves to `localStorage['retrogo_window_positions']` per window id/containerIndex; restored on topbar creation

### Lock icons use images instead of CSS colors
- `.module-lock-icon` CSS changed from `background: #888` / `background: transparent` to `background-image: url("/images/game/console/locked.png")` and `unlocked.png`
- Uses `background-size: contain; background-repeat: no-repeat; background-position: center; border: none`
- Keeps same 16x16 icon size and className toggling (`locked` / `unlocked`)

### Double-tap NPC with trade opens trade window (mobile)
- Added double-tap detection (300ms / 30px threshold) to canvas `touchstart` handler in `canvas.js`
- On double-tap: checks if tapped tile has an NPC with `hasTrade === true`
- If found: sends `"hi"` then after 200ms sends `"trade"` on default channel (same as typing it manually)
- Reuses `__lastTapTime/X/Y` properties from `core.js` (previously unused)

### Fire field decay with damage scaling
- **Problem**: Fire field rune (2301) created item 1487 (permanent, no decay) — fire lasted forever
- **Fix**: Rune scripts now create decaying items:
  - `firefield.js` rune → item **1492** (instead of 1487)
  - `fire-bomb.js` rune → item **1500** (instead of 1487)
  - `fire-wall-rune.js` rune → item **1492** (instead of 1487)
  - Monster `firefield` attack → item **1492** (instead of 1487)
- **Decay chain** (items 1492→1493→1494→0, 120s each = 6 min total):
  - Item 1492: `field: "fire_strong"` — 7 ticks BURNING (full damage)
  - Item 1493: `field: "fire_medium"` — 4 ticks BURNING (medium damage)
  - Item 1494: `field: "fire_weak"` — 2 ticks BURNING (low damage)
- **Fire bomb** (items 1500→1501→1502→0, 10s each = 30s total):
  - Same `fire_strong`/`fire_medium`/`fire_weak` field value scaling
- `item-stack.js`: `__applyFieldCondition` and `hasDamagingField` updated with mappings for fire_strong/medium/weak; all share fire immunity check
- Items 1487-1489 (permanent fire fields) still exist but are no longer created by runes/monsters
- Fire Elemental (`fire_elemental.json`): added `noCorpse: true`, `deathField: 1492`, `deathEffect: "fire"` — drops a decaying fire field instead of a corpse on death
- `monster.js`: added `this.deathEffect` property for custom death animation
- `world-creature-handler.js`: death effect now checks `creature.deathEffect` — uses `HITBYFIRE` for `"fire"`, default `POISONAREA` + slime splash otherwise

### Pre-render buffer expansion (mobile culling)
- **Problem**: Foreground culling margins matched viewport exactly (zero buffer). On movement, objects visibly rendered at screen edges.
- **`mobile/canvas.js`**: `cullMargin*` increased from `halfX/Y` (10/7) to **+4** (14/11); `bgCullMargin*` from `halfX/Y+2` (12/9) to **+6** (16/13)
- `bgCacheShiftX/Y` increased from 1 to **6** to prevent cache canvas clipping at pixel 0
- Background cache canvases enlarged from 768×608 to **1024×832**
- `Creature.prototype.canSee` limits expanded from 20/15 to **34/26** tiles
- **`renderer-world.js:219-222`**: Entry edge conditions switched from hardcoded values to dynamic `this.__cullLeft/Right/Top/Bottom`
- **`renderer-tile.js:19`**: Second object culling switched from hardcoded `15/18/8/8` to dynamic `this.__cullLeft/Right/Top/Bottom`
- **Result**: 4 tiles (~2s) foreground pre-render buffer, 6 tiles (~3s) background cache buffer — no visible pop-in on movement

### Engine performance & stability (`engine/tutorials/summary.md`)
- Draw time reduced from ~25,200 tile iterations/frame to ~5,000; frame rate 41→60-61 fps
- Weather transition: `"\t"`→`"off"` ternary fix in `weather-canvas.js`; weather toggle via `__applyWeather(enabled)` with guard
- Background cache rebuilt synchronously (no `setTimeout`)
- Real worker pool for pathfinding with `worker_threads` (N-1 workers)
- XOR key lost on character select flow fixed — `xorKey` passed through modal-characters → `connectWithToken`
- Definitions.json 404 fixed — path corrected to `./items/definitions.json`
- HMAC secret randomized (was hardcoded zeros); XOR encryption made optional via `ENCRYPTION.ENABLED`
- Default character creation only in dev mode (`SERVER.PRODUCTION=true` disables it)
- XSS sanitization on chat, private messages, books/labels
- Rate limiter: login 5 attempts/min/IP, game socket 20 packets/sec
- Generic error messages (401/500 with empty body)
- start.js rewritten with auto-restart (max 5), metrics monitoring, graceful shutdown
- Unused files moved to `engine/_unused/`; Drizzle/SQLite removed; logs moved to `engine/logs/`


