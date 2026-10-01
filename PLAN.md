# DCA Revival Plan

STATUS: IN_PROGRESS

This file is the loop's single source of truth. Every iteration reads it, does exactly one
task, proves it with `npm run verify` (plus `cargo test` once the server exists), checks the
box with evidence, and commits. See `LOOP.md` for the iteration protocol and `CLAUDE.md` for
commands and conventions.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done (evidence in parentheses) · `[!]` blocked (reason)

## Vision (v1 "Walk-in London")

A one-or-two-player web game on a living West End street map. You earn money (courier jobs,
then rent and shop income), buy plots and buildings, build and furnish them with a Blender-made
kit, and walk into any building. Built for Brandon's Pixel 10 Pro XL first.

## Completion goal (Definition of Done)

The loop sets `STATUS: READY_FOR_DEVICE_CHECK` when **all** of 1-6 hold on a clean checkout.
Brandon then runs check 7 and sets `STATUS: COMPLETE`.

1. **Gates green:** `npm run verify` (typecheck, unit + coverage thresholds, build, e2e) and
   `cargo test --workspace` in `server/` both pass.
2. **Scale is real:** 1 unit = 1 m. Player height 1.75 m ± 0.05; door openings >= 1.1 m wide and
   >= 2.2 m tall; storey height 3.0 m. Each asserted by an automated test.
3. **Performance budget** (read from `window.__dca.renderInfo()` at 1280x720, at spawn, at
   Oxford Circus and inside the shop): draw calls <= 300, triangles <= 400k, active lights <= 4,
   shader programs stable when entering/leaving buildings (no recompiles). Main JS bundle
   <= 350 KB gzip (assets excluded). Kit `.glb` files <= 2 MB total.
4. **Gameplay, scripted end to end (Playwright, headless):**
   - a. New game spawns on a pavement; the HUD shows a real place name from the map.
   - b. The player moves with the keyboard and with the on-screen joystick (touch emulation)
     from the very first frame.
   - c. Walk through the food shop's door, buy food: energy refills and money drops by the price.
   - d. Climb the stairs to the upper floor (player y >= 2.9 m) and walk back out to the street.
   - e. Take a courier job, deliver it: money rises by exactly the quoted fare.
   - f. Buy a for-sale building, place >= 3 kit pieces in it, reload the page: everything persists.
   - g. Second browser joins the first via a room code on the Rust server; each sees the other
     move; a piece placed by P1 appears for P2 within 500 ms; after a server restart the world
     is still there.
5. **Camera is never inside geometry** during the scripted walk in 4c-4d (checked every frame).
6. **No regressions:** no page errors or console errors during any e2e run; coverage thresholds
   only ratchet upward.
7. **Device check (Brandon, human gate):** on the Pixel in Chrome: no visible stutter at spawn,
   Oxford Circus or indoors; one-handed touch controls work; text is legible.

## Decisions

- **D1 Where the game rules live** (money, plots, build validation, save format). OPEN.
  Options: Rust core crate compiled to WASM and shared with the server, or TypeScript in the
  client with the server only relaying. Blocks P3.1 only. If still open when P3.1 is next,
  the loop marks P3.1 `[!]` and continues with Phase 4.
- **D2 Two-player mode** (co-op shared world vs. friendly rivals). OPEN. Default: shared
  world, separate wallets. Blocks nothing before P5.4.
- **D3 What "DCA" stands for.** OPEN (check the first prompt in AI Studio). Blocks nothing.
- **D4 Combat.** DECIDED 2026-10-01: parked behind a feature flag (off). Code and tests kept.
- **D5 Multiplayer transport.** DECIDED: Rust WebSocket server, no Firebase. 1-2 players.
- **D6 Buildings are enterable.** DECIDED: every building can be entered; interiors are
  assembled on demand from the kit; furnished interiors for shops and owned buildings.

## Baseline (2026-10-01, before the loop)

98 unit tests passing; 52% line coverage (thresholds not enforced); `ThreeGame.ts` 1,368 lines;
world = 4,491 meshes, 2,891 materials, 0 instanced, 16 point lights, 1,467 shadow casters;
bundle 1,296 KB / 339 KB gzip; player ~3.9 m tall; on-screen controls dead until a re-render.

---

## Phase 0 - Loop infrastructure

- [x] P0.1 (e7de46a) Repo hygiene: ignore and untrack `coverage/`, `test-results/`, `playwright-report/`;
  remove AI Studio leftovers (Gemini key `define` in `vite.config.ts`, `metadata.json`,
  README boilerplate); fix the type error in `tests/setup.ts`; add `typecheck` script.
  AC: `npx tsc --noEmit` exits 0; `git ls-files coverage` empty.
- [x] P0.2 (9f36841) Debug API `window.__dca` (always available, read-mostly): `player()` (position,
  velocity, floor), `renderInfo()` (calls, triangles, programs, lights, textures), `zone()`,
  `teleport(x, z)`, `money()`, `ready` flag. AC: e2e reads every field.
- [x] P0.3 (142cfb9) E2E harness: Playwright uses `PW_CHROMIUM_PATH` when set and software-GL flags;
  helpers `startGame(page)`, `holdKey`, `waitForReady`; console/page-error collector that
  fails the test. Smoke tests: menu, start game, canvas renders, keyboard moves the player.
  AC: `npm run e2e` green.
- [x] P0.4 (29e38fc; verify 95 s, threshold failure confirmed) `npm run verify` = typecheck + unit (coverage thresholds under
  `coverage.thresholds`, set to the current baseline) + build + e2e. Bundle-size check script
  prints gzip size. AC: verify green; a deliberately failing threshold fails it (checked once).
- [x] P0.5 (f0306ec; Oxford Circus 2,968 draw calls) Record baseline metrics with the new tools in `LOG.md` (draw calls at spawn etc.).

Exit: `npm run verify` green and fast enough for a loop (< 5 min). PROVEN 2026-10-01 (95 s).

## Phase 1 - Stabilise the client

- [x] P1.1 (bacabd0; bundle 331 -> 225 KB gzip) Remove Firebase: delete `services/firebase.ts` and the dependency; add a
  `NetClient` interface with a `LocalNet` implementation; local player id persisted; HUD badge
  shows "Solo" instead of a hard-coded "Online". AC: no `firebase` in source or package.json;
  bundle gzip drops; e2e green.
- [x] P1.2 (99ff41b) Input: keys by `KeyboardEvent.code`; clear keys on window blur; ignore keys while
  typing in inputs; on-screen controls get a live game reference (no null on first render);
  virtual joystick drives `setAnalogInput`; one-finger drag on the canvas rotates the camera.
  AC: unit test (W + Shift press/release never sticks); e2e joystick moves the player on the
  first frame with no other UI interaction.
- [x] P1.3 (2d4c0e8; player 1.75 m, spawn on clear_walk) Metre scale: all gameplay in metres; player 1.75 m; walk 3 m/s, run 6 m/s; build
  grid 2 m, storey 3 m; camera distances retuned; oversized props (bench, bin) to real size;
  spawn on a pavement near Oxford Circus. AC: unit test player height 1.75 +/- 0.05; e2e spawn
  zone is `clear_walk`.
- [ ] P1.4 Split `ThreeGame.ts` into `Input`, `PlayerController` (pure), `CameraRig`,
  `BuildSystem`, `RemotePlayers`, `Pickups`, `SceneSetup`; React reads game state through a
  small store/event bridge instead of per-frame polling. AC: `ThreeGame.ts` <= 300 lines;
  `PlayerController` unit tests (acceleration, walk/run top speed within 1%, diagonal
  normalisation, wall sliding).
- [ ] P1.5 Combat behind `FEATURES.combat = false`: no pickups, no attack buttons or combat
  HUD. AC: e2e asserts absence; combat unit tests still pass.
- [ ] P1.6 Real place names: HUD zone comes from the nearest named intersection or road in
  the world config; delete hard-coded zone rectangles and shop coordinates.
  AC: unit test (430, 260) -> "Oxford Circus"; e2e HUD name matches config.
- [ ] P1.7 Local save v1: versioned save (position, money, energy, blocks, appearance) with
  migration and corrupt-save fallback; autosave every 10 s and on page hide.
  AC: e2e move + place block + reload -> restored; unit tests for migration and corruption.
- [ ] P1.8 Performance pass: merge static world meshes by material per 100 m chunk, instance
  repeated props, shared material cache, small props stop casting shadows, shadow camera
  follows the player, point lights replaced with emissive lamp heads.
  AC: draw calls at spawn <= 300; triangles <= 400k; screenshot before/after in `LOG.md`.
- [ ] P1.9 Tailwind from CDN -> build-time Tailwind; no external scripts in `dist/index.html`.
  AC: UI screenshots unchanged by eye; verify green.

Exit: verify green; draw calls <= 300 at spawn; bundle <= 350 KB gzip; `ThreeGame.ts` <= 300
lines; coverage threshold raised to the new level.

## Phase 2 - Walk-in foundation

- [ ] P2.1 Rapier (`@dimforge/rapier3d-compat`) physics world; kinematic character
  controller (capsule 1.75 m, autostep 0.25 m, snap-to-ground 0.3 m, max slope 45 deg)
  replaces the AABB collision and the stair teleport. AC: tests: stops at a wall, climbs a
  0.18 m step, drops off a ledge.
- [ ] P2.2 Greybox walk-in shop `.glb` (prefer Blender via MCP or `tools/blender/*.py`; code
  fallback allowed): 8 x 10 m, 2 storeys at 3 m, front door 1.2 x 2.3 m, straight stair (rise
  0.18, run 0.28), counter, `COL_*` collision meshes, `DOOR_*` hinge empty, `INTERACT_*`
  empties. Loader turns `COL_*` into colliders and hides them. AC: loader unit test; e2e shop
  visible on Regent Street; asset <= 300 KB.
- [ ] P2.3 Doors: interact to open/close (hinge animation); collider follows.
  AC: e2e closed door blocks, open door lets the player through.
- [ ] P2.4 Indoor detection + cutaway camera: interior volumes; roof and floors above the
  player hide; walls between camera and player fade; indoor camera distance clamp.
  AC: per-frame camera-in-geometry check passes during the walk-in tour.
- [ ] P2.5 Interior light pool: fixed set of 2 lights moved into the current room; light count
  never changes at runtime. AC: `renderInfo().programs` identical after 3 enter/exit cycles.
- [ ] P2.6 E2E "walk-in tour": street -> door -> ground floor -> stairs -> upper floor
  (y >= 2.9) -> back outside. AC: passes 3 runs in a row.

Exit: P2.6 green; budgets hold inside the shop.

## Phase 3 - Economy core (needs D1)

- [ ] P3.1 Rules module (wallet, catalog, prices) in the D1 language, pure and unit-tested.
- [ ] P3.2 In-game clock (default 1 day = 20 real minutes) with a daily tick.
- [ ] P3.3 Plots along road frontages; price by road type (boulevard > main > secondary >
  lane) and distance to landmarks; for-sale signs.
- [ ] P3.4 Courier jobs: job board in shops, pickup -> drop-off, fare = base + per metre of
  street route, energy cost.
- [ ] P3.5 Energy and food: energy drains with jobs and running; food shop restores it.
- [ ] P3.6 Ownership: buy plots/buildings; daily rent and shop income from foot traffic
  (road type proxy); saved.
- [ ] P3.7 HUD: wallet, energy, clock, current job, buy dialog.

Exit: e2e economy loop (job -> earn -> buy -> place -> daily income -> reload persists);
rules module coverage >= 90%.

## Phase 4 - Blender kit v1 and the city

- [ ] P4.1 `docs/kit-spec.md`: 2 m grid, 3 m storey, 0.25 m walls, naming, one 2048 atlas,
  `extras` schema (`kind`, `footprint`, `snaps`, `catalogId`), `COL_`/`DOOR_`/`INTERACT_`
  conventions, export settings.
- [ ] P4.2 `tools/blender/build_kit.py`: generates the kit reproducibly with bpy (run through
  Blender CLI or the Blender MCP) -> `public/assets/kit_v1.glb`. Pieces: wall, wall_window,
  wall_door, floor, stairs, roof_flat, roof_pitched, shopfront, counter, shelf, bed, table,
  chair, lamp.
- [ ] P4.3 Kit loader + instancing registry; build system places kit pieces on the 2 m grid
  with snapping and rotation; collision from `COL_` meshes.
- [ ] P4.4 Facade generator: terraces (2-5 storeys) along frontages from the kit, each with a
  door; skips junctions, roundabouts and parks.
- [ ] P4.5 On-demand interiors: assembled within 25 m or on entry, released beyond 40 m, pooled.
- [ ] P4.6 Functional shops: food shop and pet shop interiors with counter interactions.
- [ ] P4.7 Street furniture from the kit (lamp, bench, bollard, bin, phone box, pillar box),
  instanced; procedural versions deleted.

Exit: budgets hold at Oxford Circus with frontages; e2e enters 3 random frontage buildings.

## Phase 5 - Rust co-op server

- [ ] P5.1 `server/` Cargo workspace: `dca-protocol` (serde; `ts-rs` generates
  `src/net/protocol.ts`), `dca-server` (axum WebSocket), `/health`.
- [ ] P5.2 Rooms with a 4-letter code, max 2 players, join/leave, presence.
- [ ] P5.3 Position relay at 15 Hz; client interpolation buffer (100 ms).
- [ ] P5.4 World edits: intents -> server sequence numbers -> broadcast; conflict test (needs D2).
- [ ] P5.5 Persistence in SQLite per room; load on start; autosave.
- [ ] P5.6 Client `WsNet` implementation with reconnect; host/join UI.
- [ ] P5.7 `docs/play-on-pixel.md`: running the server on the PC, `tailscale serve` for wss.

Exit: `cargo test` green; e2e 4g green.

## Backlog (after v1, not part of the completion goal)

Blender character rig with animations; pedestrians on pavements; day/night; landmarks
(Marble Arch, Trafalgar Square); audio; combat revival; Seven Dials.
