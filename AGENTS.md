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

### Null-player safety
- `Keyboard.handleMoveKey()`: added `!gameClient.player` guard before `__serverWalkConfirmation`
- `MobileFullscreen.__dpadExecuteMove()`: added `gameClient.player` check in guard

### External access
- `EXTERNAL_HOST` / `LOCAL_HOST` in `.env`, `config.js`, `env-mapper.js`
- Login server auto-detects local vs external clients

## Files changed
- `client/src/ui/mobile-fullscreen.js` — all mobile fullscreen, dpad, touch logic
- `client/src/input/keyboard.js` — null-player guard in handleMoveKey
- Various hotbar files removed/stubbed (7+ files)
- `engine/.env`, `engine/config.js`, `engine/lib/env-mapper.js`, `engine/src/auth/login-server.js`

## Known issues
- VisualViewport not used for canvas sizing (reverted to `window.innerHeight`); bottom edge may cut off during fullscreen transition on some browsers
- Diagonal D-pad movement uses keyboard cooldown (`__diagonalMoveCooldown`) — same as desktop

## Testing
- Test on real mobile device: landscape fullscreen, dpad movement (all 8 dirs), single-tap creature attack, double-tap item use
- Desktop: click-drag on dpad via mouse events
