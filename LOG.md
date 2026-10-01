# DCA loop log

Newest entries at the bottom. Each entry: date, task id, change, verify result, metrics, notes.

## 2026-10-01 - plan
Wrote PLAN.md, LOOP.md, CLAUDE.md and the loop runners. Baseline metrics are in PLAN.md.

## 2026-10-01 - Phase 0 (P0.1-P0.5)
- P0.1: untracked coverage/test output, removed AI Studio leftovers, fixed the test-setup type
  error, coverage thresholds now enforced (lines 52 / statements 52 / functions 83 / branches 91).
  A deliberate 99% threshold failed the run, so enforcement is real.
- P0.2: `window.__dca` (ready, frames, player, renderInfo, zone, money, teleport). Player
  values are reported in metres even though gameplay still uses old units until P1.3.
- P0.3: Playwright uses `PW_CHROMIUM_PATH` + SwiftShader flags, one worker, 90 s timeout.
  Every test fails on page errors or console errors. Missing favicon was a console 404; fixed
  with an inline SVG favicon.
- P0.4: `npm run verify` = typecheck, unit + coverage, build, size budget (350 KB gzip), e2e.
  Green in 95 s.
- P0.5: measured with the real renderer (frustum culling on), 1280x720:
  spawn 74 calls / 1.4k tris (camera faces the corner forest);
  Oxford Circus 2,968 calls / 75.9k tris; Trafalgar Square 1,977 calls / 57.6k tris.
  18 lights (16 point + hemisphere + sun), 9 programs, 99 textures, 4,081 geometries, 4,523 meshes.
  Bundle 331 KB gzip. The budget (<= 300 calls) is about 10x away at Oxford Circus.
- Note for next iterations: SwiftShader runs ~2 fps, so e2e asserts on frame counts and
  positions, never on wall-clock speed. Use `waitForFrames`, not timeouts.

## 2026-10-01 - P1.1 Remove Firebase
- `NetClient` interface + `LocalNet` (persistent local id, block edits echoed back with ids).
  Player state publishes at 10 Hz by game clock instead of `Math.random() > 0.9` per frame.
  HUD badge reads Solo. Bundle 331 -> 225 KB gzip. Coverage threshold raised to 54%.

## 2026-10-01 - P1.2 Input
- `services/game/Input.ts`: keys by `KeyboardEvent.code`, cleared on blur/hidden, ignored in
  text fields, actions fire once per press. Shift = sprint. Joystick component (pointer events)
  replaces the D-pad; Controls take `getGame()` so they work before React re-renders.
  One-finger canvas drag orbits the camera. Mouse/wheel listeners moved from document to the
  canvas, so clicking UI no longer places blocks behind it.
- jsdom has no PointerEvent; tests/setup.ts polyfills it as a MouseEvent subclass.
- E2E uses CDP `Input.dispatchTouchEvent` (context `hasTouch: true`) for real touch input.

## 2026-10-01 - P1.3 Metre scale
- Constants now WORLD_SIZE 800, BUILD_TILE 2, STOREY_HEIGHT 3, PLAYER_HEIGHT 1.75,
  SPAWN_TARGET (450, 272). WorldConfig lost its unused tileSize/worldScale/mapWidth fields.
- Stick figure parts live in a `body` group scaled to 1.75 m, feet at y = 0 (unit-tested).
  Pets scaled 0.13; name tag at 2.15 m.
- playerData (x, y) is now the centre of a 0.6 m footprint in metres (y = world z).
- Building allowed only on OPEN_LANDSCAPE / PERIMETER zone cells; highlight turns red elsewhere.
  The old "Home Lot" rule is gone from building; the zone label itself is still the old
  rectangle code until P1.6.
- Combat ranges/knockback are still in their old values; combat is parked (D4). Revisit if
  combat returns.
- Screenshot check: player is human-sized next to Regent Street lanes and the bus lane.

## 2026-10-01 - P1.4 Split ThreeGame
- ThreeGame 1,427 -> 296 lines; systems in services/game/*. React reads `GameStore` via
  useSyncExternalStore; the game owns its rAF loop (`start()`), and reads React state through
  `getUi()` refs. Remote players now smooth every frame. Pickup respawn uses the game clock.
- Coverage thresholds raised to lines/statements 70, functions 86.
- Keep ThreeGame <= 300 lines: put new behaviour in a system module, not in the orchestrator.

## 2026-10-01 - P1.5 Combat parked
- `services/features.ts` (`FEATURES.combat`, default false; `?combat=1` turns it on).
  HUD/Controls take a `combat` prop. e2e asserts no combat UI and no pickups.

## 2026-10-01 - P1.6 Place names
- `services/world/Places.ts`: named junction (config `name`) > street within its pavement
  + 6 m > rectangle districts > "West End". Shop hotspots removed (back in P4.6), so the pet
  store and food are unreachable until then; energy is not used yet anyway.

## 2026-10-01 - P1.7 Local save
- `services/save/SaveGame.ts` (key `dca-save`, version 1, MIGRATIONS chain, corrupt saves
  moved to `dca-save-corrupt`). App autosaves every 10 s, on hidden/pagehide and on leaving
  PLAYING. Menu: Continue / New Game. Debug API gained `blocks()` and `save()`.
- In co-op (Phase 5) blocks must come from the server, so restore only applies blocks when
  `net.mode === 'solo'`.
