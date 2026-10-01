# DCA - working notes for agents

A game built in Blender and run with UPBGE 0.50 (Blender 5.0.1 base), played on Brandon's
Windows PC. Plan and loop: `PLAN.md`, `LOOP.md`, `LOG.md`. Brandon directs architecture; check
`PLAN.md` Decisions before choosing.

## Layout

- `dca/` - pure Python game logic (no `bge`, no `bpy`). Unit-tested; imported at runtime.
- `game/` - UPBGE runtime code (may import `bge`): `boot.py` is called every frame by the
  `Game` empty's Always sensor; `harness.py` + `scenarios/` run scripted tests.
- `tools/` - bpy build scripts. `build_game.py` writes `build/dca.blend` and copies `dca/` and
  `game/` next to it. They must also run in plain `bpy==5.0.1` (guard UPBGE-only RNA).
  `templates/game_driver.blend` holds the logic bricks (made by `make_driver_template.py`
  with the UI, because logic operators crash UPBGE in background mode).
- `data/` - map data exported from the prototype. `web/` - the retired three.js prototype
  (source of street data/geometry only). `tests/` - pytest.
- `tools/upbge.json` - pinned UPBGE download and its path (`.upbge/`, gitignored).

## Commands

- Setup: `uv venv --python 3.11 .venv` then `uv pip install -e ".[dev]"` (includes bpy 5.0.1).
- `python scripts/verify.py` - ruff + pytest. The loop's gate everywhere.
- `python scripts/verify.py --upbge` - also builds in UPBGE headless and runs every scenario
  with `blenderplayer` (Brandon's PC only; a game window opens for each scenario).
- `python scripts/upbge_run.py build | scenario NAME | all`.
- Web prototype: `cd web && npm run verify` (only if you touch `web/`).

## Conventions

- Units: 1 Blender unit = 1 metre, z up. Prototype (x, z) maps to Blender (x, -y)
  (`dca.units.from_prototype`).
- Rules and maths go in `dca/` with tests; `game/` stays a thin layer over `bge`.
- A scenario is a generator `run(ctx)`; one `yield` = one frame. Use `ctx.measure(...)` around
  anything you time; warm-up (shader compile) is reported separately.
- Keep files under ~400 lines.
- Do not commit `build/`, `.upbge/`, `.venv/`, caches.
- Commit messages: `<task id>: <summary>`, blank line, body, then
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (adjust to the model in use).
