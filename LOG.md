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

## 2026-10-01 - P1.8 Performance pass
- `services/world/StaticBatcher.ts` merges static meshes per 200 m chunk x material key
  (lit/unlit, transparency, side, emissive, shadow flags, texture image). Colours -> vertex
  colours; texture matrix baked into UVs. Ground meshes (camera occluders) are kept as-is.
  `WorldBuilder.build(scene, { batch: true })`; tests that count props build unbatched.
- TextureFactory caches one canvas per look and returns clones (shared image, own repeat).
  Road noise no longer varies per segment length; furnishing strip noise is now seeded.
- Point lights removed (`maxPointLights: 0`). Sun shadow box 80 m, follows the player,
  snapped to 1 m.
- Budget e2e (`e2e/budget.spec.ts`) turns a full circle at spawn, Oxford Circus, Trafalgar
  Square and Piccadilly Circus and writes `test-results/metrics.json`:
  spawn 59 calls / 38.5k tris; Oxford Circus 61 / 42.5k; Trafalgar 65 / 41.4k;
  Piccadilly 55 / 42.2k; 2 lights everywhere. (Baseline Oxford Circus: 2,968 / 75.9k / 18.)
- Pre-existing visual oddity seen in screenshots before and after: a dark stepped shape near
  junction edges (likely overlapping coplanar junction fill or shadow acne). Not caused by
  batching. Worth a look when junctions get rebuilt from the kit.

## 2026-10-01 - P1.9 Build-time Tailwind
- Tailwind v4 via `@tailwindcss/vite`; page CSS in `index.css`. `scripts/size.mjs` also fails
  if dist/index.html loads a script from another origin. Menu/creator screenshots identical;
  v4's red-600 is slightly more saturated (UNSTUCK button) - accepted.

## 2026-10-01 - Phase 1 exit
- Proven: verify green (24 unit files / 170 tests, 15 e2e), spawn 59 draw calls, bundle
  232 KB gzip, ThreeGame.ts 300 lines, coverage thresholds 71/71/87/91.
- Next: Phase 2 (Rapier character controller, greybox walk-in shop). P2.2 prefers Blender via
  MCP on Brandon's PC; if it's offline, generate the greybox in code and note it.

## 2026-10-01 - Plan v2: UPBGE build
- Brandon: "This isn't going on my Pixel. This is a Blender build." He chose Blender as the
  engine (UPBGE). Plan v1's Pixel target was my assumption, never his; withdrawn (D8).
- PLAN.md rewritten for UPBGE 0.50 (built on Blender 5.0.1): phases A toolchain, B London in
  Blender, C player, D walk-in buildings, E economy, F Rust co-op, G ship. Completion goal now
  measured by a UPBGE scenario harness and fps on Brandon's PC (AMD Radeon integrated).
- Verified: his PC runs Blender 5.2.2 LTS (Store install) with the Blender MCP extension; no
  UPBGE. `bpy==5.0.1` is on PyPI for Python 3.11, matching UPBGE 0.50's Blender base, so
  scene-building code can be tested in the cloud sandbox. GitHub release downloads are blocked
  by the sandbox egress policy (403), so UPBGE itself only runs on Brandon's PC.
- The web prototype stays as the source of street data/geometry (D9).

## 2026-10-01 - Phase A (A1-A5)
- A1: UPBGE 0.50 Windows .7z downloaded on Brandon's PC (via his network; the sandbox's GitHub
  release downloads are blocked) and unpacked with Windows' bsdtar into `.upbge/`. Pinned in
  `tools/upbge.json` with SHA-256. blenderplayer passes args after `-` to sys.argv.
- A2: prototype moved to `web/`; its verify still passes there.
- A3: Python 3.11 project; `.venv` with bpy 5.0.1 in the sandbox and on the PC (uv;
  `uv python install` printed a link error but the interpreter works).
- A4: harness + boot + smoke scenario + `scripts/upbge_run.py`. Two UPBGE 0.50 gotchas:
  `wm.read_factory_settings` inside a UPBGE script crashes (logic-node add-on re-register), and
  every logic-brick operator crashes in background mode. Fix: clear the scene by hand, and
  append the Game driver empty from `tools/templates/game_driver.blend` (made once with the UI).
- Smoke on Brandon's PC (Ryzen 3 4300U, Radeon integrated, ground + sun only, uncapped):
  1920x1080 avg 65.0 / 1%-low 16.1 fps; 1600x900 79.7 / 22.8; 1280x720 111.7 / 35.7.
  First-ever run spent 23 s compiling shaders; later runs warm up in ~5 s. Raised D10.
- A5: CLAUDE.md, README and loop runners rewritten for the UPBGE stack.
- Moving code to the PC: commits travel as git bundles (`dca-<hash>.bundle` in
  `C:\Users\Bbeie\repos`), pulled into `C:\Users\Bbeie\repos\DCA` and pushed from there.

## 2026-10-01 - Phase A exit
- PC: `verify.py --upbge` OK at 5b5fc2b. Smoke this run: avg 80.2 / 1%-low 61.6 fps at 1080p,
  warm-up 2.7 s. Earlier run of the same build: 65 / 16. Expect run-to-run variance on this
  laptop chip (power/thermal state); judge performance over several runs, not one.
- Next: Phase B (London in Blender). B1-B4 run in the sandbox; B5 needs the PC and D10.

## 2026-10-01 - D10 decided

Brandon chose 1280x720 at >= 60 fps avg / >= 45 1%-low for goal 3. Completion goal 3 and D10
updated; `tools/build_game.py` now sets the game resolution to 1280x720 and
`scripts/upbge_run.py` opens the player window at 1280x720. verify OK (13 tests).

## 2026-10-01 - B1 map data export

- `web/scripts/export_map.ts` (`npm run export:map`, runs with vite-node) writes
  `data/london.json` (roads with lane layouts and kerbsides, 8 junctions of which 5 named,
  11 districts, spawn target, colours, counts), `data/zones.json` (400 x 400 cells of 2 m, one
  digit per cell, legend in the file) and `data/probes.json` (zone + place name at 2214 points,
  9 spawn searches) as golden answers for the Python port.
- `dca/world/data.py`: `load_london()`, `load_zones()`, `ZoneGrid.zone_at(x, z)` in map
  (prototype) coordinates; `DCA_DATA` overrides the folder. Build copies the two runtime files
  to `build/data/`.
- Found: the prototype's districts leave x 530-650, z 480-520 uncovered (its "West End"
  fallback); test documents it. Curb cells are rare (103) because curbs are 0.4 m wide and the
  grid samples cell centres; crosswalk is never painted.
- verify OK (21 tests). web verify green (170 unit, 15 e2e, 232 KB gzip); in the sandbox e2e
  needs `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`.

## 2026-10-01 - B2 street geometry export

- `npm run export:glb` (`web/scripts/export_glb.mjs`): Vite dev server + headless Chromium open
  `scripts/export_glb.html`, which builds the world with the game's `WorldBuilder` + static
  batcher, converts Lambert to rough non-metal standard materials (basic stays unlit),
  re-indexes geometry (389k -> 104k vertices), names objects `street_c<cx>_<cz>_m<i>` /
  `ground_0` with glTF extras (`dca`, `chunk`, `material`, `walkable`), and writes
  `data/london_streets.glb` (4.7 MB) plus `data/london_streets.json` stats.
- bpy imports it in ~0.8 s: 140 mesh objects, 23 materials, 10 canvas textures (64-128 px),
  130k faces; axes land as planned (x 0..800, y 0..-800). The importer wires Color Attribute
  -> Base Color for flat materials but not texture x vertex colour (fine: textured batches
  are white); B3 rebuilds materials anyway.
- Content is deterministic but bytes are not: images finish encoding in varying order, so
  bufferView order changes between runs. Don't use the file hash as a change detector.
- verify OK (26 tests). web verify green.

## 2026-10-01 - B3 world build (sandbox)

- `tools/build_world.py` imports the street glb into `World/{Ground,Surfaces,Props,Decor}`:
  1 ground, 70 surfaces (top <= 0.4 m), 43 props, 26 decor; 129.7k faces, 23 materials.
  Kind and physics go into custom properties (`dca_kind`, `dca_physics`) and, inside UPBGE,
  `object.game.physics_type` (static triangle mesh, or no collision for decor).
- `build_game.build()` now builds the world instead of the 100 m plane; reset also clears
  images and nested collections; sun energy 3; camera behind the spawn pavement, clip 1 km.
- Found for C1: the prototype's kerbs are 0.3 m high (pavement top 0.26-0.31 m) but C1 plans a
  0.25 m step height, so the player could not step onto the pavement. Either raise the step
  height to ~0.35 m or lower kerbs to a UK-typical 0.125 m when the geometry moves to Python.
- B3 stays `[~]` until the UPBGE headless build and smoke scenario pass on Brandon's PC
  (glTF import inside UPBGE, `game.physics_type`, `use_collision_bounds`).
- verify OK (38 tests).

## 2026-10-01 - B4 places, spawn, zones in Python

- `dca/world/places.py` (`place_name_at`, `street_name`, `PlaceNamer`) and
  `dca/world/spawn.py` (`find_nearest_zone_point`) port the TypeScript in the same arithmetic
  order. `dca.world.World` wraps them in Blender coordinates: `place_at(430, -260)` is
  "Oxford Circus"; `spawn_point()` is on a clear-walk cell.
- Parity: all 2214 probe place names and all 10 spawn searches (2 of which find nothing within
  80 m, e.g. deep in Hyde Park) equal the TS answers. verify OK (50 tests).

## 2026-10-01 - B3 proven in UPBGE; B5 baseline blocked (D11)

- On Brandon's PC `verify.py --upbge`: UPBGE builds the world from the glb, smoke passes
  (avg 130 fps with the static camera), the streets scenario finds the world (140 objects), a
  pavement spawn via `dca.world` inside UPBGE, and physics ray casts hit the street surfaces.
  The first run stood the camera inside the Piccadilly/Trafalgar island monuments; spots are
  now the nearest pavements (ef9b9f1). Harness records UPBGE's frame profile per window.
- B5 sweep (streets scenario, camera turning 360 deg over 10 s at 4 spots, 1280x720 unless
  noted; avg fps range across spots, 1%-low range):
  - defaults: 38-43 avg, 6-33 low
  - fast GI off: 42-43; + shadow res 0.5 / sun 5 cm texels: 39-44; + flat things cast no
    shadow: 42-43; shadow steps/rays 1: 44-50; shadows off: 39-46; TAA off: 36-40
  - minimal (fast GI, shadows, TAA off): 44-50 avg, 11-36 low; Rasterizer 20.7 ms of 23 ms
  - minimal without props: 47-51; minimal with only the ground plane: 59 avg, 14-37 low,
    Rasterizer 16.2 ms
  - minimal at 960x540: 69-70 avg, 21-37 low (Rasterizer 12.5 ms); defaults at 960x540:
    66-76 avg, 9-37 low
  - `render.resolution_percentage = 50` has no effect in the player; `use_viewport_render`
    draws nothing useful in the standalone player (800+ fps, Rasterizer 0.03 ms).
- Conclusion: EEVEE in UPBGE 0.50 has a ~16 ms per-frame floor at 720p on this GPU when the
  view changes (static views are cheap because nothing re-renders, which is why A4's smoke
  numbers looked fine). Raised D11; B5 marked `[!]`. PC power plan: Balanced; GPU driver
  31.0.21925.1001 (2026-05-19). Other apps were running during the sweep (Claude, Blender).
- `dca.egg-info` is no longer tracked (build output).

## 2026-10-01 - D11 decided: UPBGE 0.36.1

- Brandon chose to test UPBGE 0.36.1 (Blender 3.6.2, legacy EEVEE, Python 3.10.12; sha512
  matched the release file). The build scripts needed two changes: the Principled "Specular"
  input name, and a driver template saved by Blender 3.6 (`game_driver_b3.blend`, made with
  `make_driver_template.py` in 0.36's UI). Everything else, glTF import included, worked as is.
- Streets scenario on 0.36.1 (1280x720, camera turning; avg / 1%-low per spot):
  - defaults, uncapped: 97-107 / 30-41 (0.50 was 38-43 / 6-33)
  - GC disabled: no change (not the hitch source)
  - soft shadows off, 512 cascades, TAA 1 ("lite"), uncapped: 119-145 / 27-49
  - lite + 75 cap: 74-75 / 37-50; lite + 90 cap: 88-89 / 43-52; lite + 120 cap: 116-117 / 43-61
  - Hitches are sporadic single frames of 20-90 ms at random points in the turn (1-5 per
    ~1000 frames); Docker, Chrome, Steam and CurseForge were running.
- Switched: `tools/upbge.json` is 0.36.1 (0.50 kept as `tools/upbge-0.50.json`,
  `DCA_UPBGE=0.50`); tests run on bpy 3.6.0 from download.blender.org/pypi with Python 3.10;
  the build sets lite EEVEE and a 90 fps cap. B5 back to `[~]`: next is the hitches.
- Sandbox: verify OK on bpy 3.6.0 (58 tests).
