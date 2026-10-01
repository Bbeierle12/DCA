# DCA Plan (v2: UPBGE build)

STATUS: IN_PROGRESS

This file is the loop's single source of truth. Every iteration reads it, does exactly one
task, proves it with the verify gate, checks the box with evidence, and commits. See
`LOOP.md` for the iteration protocol and `CLAUDE.md` for commands and conventions.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done (evidence in parentheses) · `[!]` blocked (reason)

## Vision (v1 "Walk-in London")

A one-or-two-player game built in Blender and run with UPBGE (Blender's game engine fork),
played on Brandon's Windows PC with keyboard and mouse. A living West End street map where
you earn money (courier jobs, then rent and shop income), buy plots and buildings, build and
furnish them with a Blender-made kit, and walk into any building.

## Completion goal (Definition of Done)

The loop sets `STATUS: READY_FOR_PLAY_CHECK` when **all** of 1-6 hold on a clean checkout.
Brandon then runs check 7 and sets `STATUS: COMPLETE`.

1. **Gates green:** `python scripts/verify.py` passes (pytest: logic, data and the bpy world
   build), and on Brandon's PC `python scripts/verify.py --upbge` also passes every UPBGE
   scenario. `cargo test --workspace` in `server/` passes.
2. **Scale is real:** 1 Blender unit = 1 m. Player 1.75 m +/- 0.05; door openings >= 1.1 m wide
   and >= 2.2 m tall; storey height 3.0 m. Each asserted by an automated test.
3. **Performance on Brandon's PC** (AMD Radeon integrated graphics, 1280x720, windowed,
   UPBGE 0.50; D10): average >= 60 fps and 1%-low >= 45 fps at spawn, Oxford Circus and inside
   the shop, measured by the scenario harness over 10 s at each spot.
4. **Gameplay, scripted end to end** (UPBGE scenario harness, no human input):
   - a. A new game spawns the player on a pavement; the HUD shows a real place name.
   - b. Holding forward for 2 s moves the player 6 m +/- 10% (walk speed 3 m/s).
   - c. Walk through the food shop's door, buy food: energy refills, money drops by the price.
   - d. Climb the stairs to the upper floor (player z >= 2.9 m) and walk back out to the street.
   - e. Take a courier job and deliver it: money rises by exactly the quoted fare.
   - f. Buy a for-sale building, place >= 3 kit pieces in it, quit and relaunch: all persists.
   - g. A second game instance joins via a room code on the Rust server; each sees the other
     move; a piece placed by P1 appears for P2 within 500 ms; after a server restart the world
     is still there.
5. **Camera is never inside geometry** during the scenario in 4c-4d (checked every frame).
6. **Ships as a runtime:** the exported `DCA.exe` (Save As Game Engine Runtime) starts and
   passes the smoke scenario.
7. **Play check (Brandon, human gate):** he plays it on his PC and it feels right.

## Decisions

- **D1 Where the game rules live** (money, plots, build validation, save format). OPEN.
  Recommended default: a pure Python package `dca/` that UPBGE imports and pytest tests
  directly. Alternative: a Rust core loaded into UPBGE's bundled Python via PyO3 (shared with
  the server, but fragile to build against Blender's Python). If still open when E1 is next,
  the loop uses the default and notes it here.
- **D2 Two-player mode** (co-op shared world vs. friendly rivals). OPEN. Default: shared
  world, separate wallets. Blocks nothing before F4.
- **D3 What "DCA" stands for.** OPEN (check the first prompt in AI Studio). Blocks nothing.
- **D4 Combat.** DECIDED 2026-10-01: not part of v1.
- **D5 Multiplayer transport.** DECIDED: Rust server, no Firebase. 1-2 players.
- **D6 Buildings are enterable.** DECIDED: every building can be entered; interiors are
  assembled on demand from the kit; furnished interiors for shops and owned buildings.
- **D7 Engine.** DECIDED 2026-10-01: Blender is the engine. UPBGE 0.50 (stable, released
  2026-01-06, built on Blender 5.0.1). Pinned; upgrading is a decision, not a task.
- **D8 Platform.** DECIDED 2026-10-01: Brandon's Windows PC, keyboard and mouse. Phones are not
  a target.
- **D10 Goal 3 resolution vs. Brandon's hardware.** DECIDED 2026-10-01 (Brandon): 1280x720 at
  >= 60 fps avg / >= 45 1%-low. Context: the PC is a Ryzen 3 4300U with integrated Radeon
  graphics; an almost empty scene measured avg 65 / 1%-low 16 fps at 1920x1080, 80 / 23 at
  1600x900 and 112 / 36 at 1280x720. The game window and the harness run at 1280x720.
- **D9 The three.js prototype** (Phases 0-1 of plan v1, `web/` after A2) is retired as a game.
  It stays only as the source of the London street data and geometry until a Python
  generator replaces it (backlog).

## What carries over from the web prototype (plan v1, 2026-10-01)

Metre scale and the 1.75 m player; the London street network (roads, junctions, landmark
names, districts) and its zone map; place names and pavement spawn logic; the versioned save
format with migrations; static batching (merge by material and chunk); the loop itself.
The v1 log entries stay in `LOG.md` as history.

## Key facts (verified 2026-10-01)

- Brandon's PC: Windows 11, AMD Radeon integrated graphics, OpenGL 4.6. Blender 5.2.2 LTS is
  installed (Microsoft Store) with the Blender MCP extension. UPBGE was not installed.
- UPBGE 0.50 is built on Blender 5.0.1, so the PyPI wheel `bpy==5.0.1` (Python 3.11) runs the
  same scene-building code headless anywhere, including the cloud sandbox. Game-only settings
  (`object.game.*`, components, logic) exist only inside UPBGE, so build scripts guard them.
- Character physics: `bge.constraints.getCharacter(obj)` -> `walkDirection`, `onGround`,
  `jump()`, `maxSlope`, `gravity`, `fallSpeed`. Step height is a physics-panel setting.
- Shipping: File > Export > Save As Game Engine Runtime (add-on) builds an `.exe` that needs
  its whole folder.

---

## Phase A - Toolchain

- [x] A1 (de159b1; probe printed Blender 5.0.1, Python 3.11.13) Install UPBGE 0.50 portable on Brandon's PC under `.upbge/` in the repo (gitignored);
  record path and version in `tools/upbge.json`. AC: `upbge -b --python-expr` prints the
  UPBGE version from a scripted check.
- [x] A2 (de159b1; web verify green from web/) Repo layout: move the three.js prototype to `web/` (its own `npm run verify` still
  passes there); add `dca/` (pure Python package), `game/` (UPBGE components), `tools/`
  (bpy build scripts), `data/` (exported map data), `tests/` (pytest). AC: tree matches;
  web verify green from `web/`.
- [x] A3 (106e61e) Python project: `pyproject.toml` (Python 3.11, pytest, ruff, `bpy==5.0.1` as a test
  dependency), `scripts/verify.py` running ruff + pytest. AC: verify green in the sandbox.
- [x] A4 (00cf95b; smoke PASS on Brandon's PC: 65 fps avg at 1080p, empty scene) UPBGE scenario harness: `game/harness.py` component reads a scenario name from the
  command line, drives inputs, samples state and frame times each frame, writes
  `build/results/<scenario>.json`, then ends the game. `scripts/verify.py --upbge` builds the
  .blend in UPBGE headless and runs every scenario with the standalone player. AC: a smoke
  scenario (load, 120 frames, report fps) passes on Brandon's PC.
- [x] A5 Loop files for the new stack (LOOP.md, CLAUDE.md, `scripts/loop.ps1`).

Exit: `python scripts/verify.py` green in the sandbox and `--upbge` green on Brandon's PC.
PROVEN 2026-10-01 (sandbox 13 tests; PC `verify.py --upbge` OK, smoke avg 80 fps at 1080p).

## Phase B - London in Blender

- [x] B1 (3d240fb; 18 roads, 8 junctions, 11 districts, 400x400 zones; 2214/2214 zone probes match) Export map data from the prototype: `data/london.json` (roads, junctions with names,
  districts) and `data/zones.json` (2 m zone grid). AC: Python loader test round-trips counts.
- [x] B2 (94bdf18; 4.7 MB, 140 meshes, 23 materials, 104k verts; imports in bpy in 0.8 s) Export the generated street geometry as `data/london_streets.glb` (batched, vertex
  colours, shared textures) using headless Chromium. AC: file <= 15 MB; loads in bpy.
- [ ] B3 `tools/build_world.py` (bpy): import the streets, organise collections, EEVEE
  materials from vertex colours, static physics on walkable surfaces, save `build/dca.blend`.
  AC: bpy test checks 800 m extent, object budget, every material valid.
- [ ] B4 Port place names, pavement spawn and zone lookup to `dca/world/` with the same test
  cases as the prototype ((430, 260) -> "Oxford Circus", spawn on `clear_walk`).
- [ ] B5 Performance baseline in UPBGE at the 4 key spots (harness), then fix to completion
  goal 3 (join by material per chunk, instancing for props, LOD or culling if needed).

Exit: the world loads in UPBGE and meets goal 3 with an empty street.

## Phase C - Player

- [ ] C1 Player character from a bpy script: 1.75 m low-poly figure with an armature
  (idle, walk, run actions), character physics capsule, step height 0.25 m, max slope 45 deg.
  AC: bpy test height 1.75 +/- 0.05.
- [ ] C2 Controller component: WASD + Shift run, camera-relative movement, 3 / 6 m/s; the
  movement maths lives in `dca/` and is unit-tested. AC: scenario 4b.
- [ ] C3 Third-person camera: mouse orbit, wheel zoom, pull-in on collision.
  AC: scenario check camera-in-geometry passes on a street walk.
- [ ] C4 HUD overlay: money, energy, place name, prompts. AC: scenario 4a reads the HUD text.
- [ ] C5 Save/load (`dca/save.py`, versioned JSON with migrations, in the user's app-data
  folder); autosave every 10 s and on quit. AC: pytest + scenario quit/relaunch.

Exit: walk London at human scale at 60 fps with a working camera and save.

## Phase D - Walk-in buildings (Blender kit)

- [ ] D1 `docs/kit-spec.md`: 2 m grid, 3 m storey, 0.25 m walls, naming, one material atlas,
  custom properties (`kind`, `footprint`, `snaps`, `catalogId`), `COL_`/`DOOR_`/`INTERACT_`.
- [ ] D2 `tools/build_kit.py` (bpy) generates the kit reproducibly into `build/kit.blend`:
  wall, wall_window, wall_door, floor, stairs, roof_flat, roof_pitched, shopfront, counter,
  shelf, bed, table, chair, lamp. AC: bpy tests on dimensions (door 1.2 x 2.3 m etc.).
- [ ] D3 Greybox walk-in shop from the kit on Regent Street (8 x 10 m, 2 storeys, stairs).
- [ ] D4 Doors: interact to open/close with a hinge animation; collision follows.
- [ ] D5 Indoor cutaway camera: roofs and floors above the player hide, walls between camera
  and player fade. AC: goal 5 during scenario 4d.
- [ ] D6 Interior lighting: a fixed small light set moved into the current room.
- [ ] D7 Facades: terraces (2-5 storeys) along frontages built from the kit, each with a door.
- [ ] D8 On-demand interiors spawned near the player with UPBGE's fast AddObject (dupli base)
  and released beyond 40 m.

Exit: scenario 4d green; goal 3 holds at Oxford Circus with frontages and inside the shop.

## Phase E - Economy (needs D1)

- [ ] E1 Rules package: wallet, catalog, prices (pure, >= 90% coverage).
- [ ] E2 In-game clock (default 1 day = 20 real minutes) with a daily tick.
- [ ] E3 Plots along frontages priced by road type and distance to landmarks; for-sale signs.
- [ ] E4 Courier jobs: job board in shops, pickup -> drop-off, fare = base + per metre.
- [ ] E5 Energy and food; the food shop restores energy.
- [ ] E6 Ownership: buy plots/buildings; daily rent and shop income; saved.
- [ ] E7 In-game build mode: place kit pieces on the 2 m grid inside owned buildings.

Exit: scenarios 4c, 4e, 4f green.

## Phase F - Rust co-op server

- [ ] F1 `server/` Cargo workspace: `dca-protocol` (serde, JSON lines over TCP), `dca-server`
  (tokio), health check.
- [ ] F2 Rooms with a 4-letter code, max 2 players, join/leave.
- [ ] F3 UPBGE client: non-blocking socket component; position relay at 15 Hz with a 100 ms
  interpolation buffer for the other player.
- [ ] F4 World edits: intents -> server sequence numbers -> broadcast; conflict test (needs D2).
- [ ] F5 Persistence in SQLite per room; load on start; autosave.

Exit: `cargo test` green; scenario 4g green with two players on Brandon's PC.

## Phase G - Ship

- [ ] G1 Export `DCA.exe` with Save As Game Engine Runtime into `dist/DCA/`; the harness runs
  the smoke scenario against it. AC: goal 6.
- [ ] G2 Full goal 1-6 sweep; set `STATUS: READY_FOR_PLAY_CHECK`.

## Backlog (after v1)

Python port of the street generator (retire `web/` entirely); pedestrians; day/night;
landmarks (Marble Arch, Trafalgar Square); audio; Seven Dials; combat.

## History: plan v1 (web prototype)

Phase 0 (loop tooling) and Phase 1 (stabilise the three.js client) were completed on
2026-10-01 under plan v1 and are recorded in `LOG.md`. Plan v1 assumed a phone target; that
was wrong and is withdrawn (D8).
