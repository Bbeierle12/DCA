# DCA

A one-or-two-player game built in Blender and run with UPBGE: a living West End street map
where you earn money, buy plots and buildings, build and furnish them with a Blender-made kit,
and walk into any building.

## Run

```powershell
uv venv --python 3.10 .venv
uv pip install -e ".[dev]"
python scripts/verify.py            # lint + tests (logic, data, bpy build)
python scripts/upbge_run.py all     # build in UPBGE and run the scenarios (needs .upbge/)
```

UPBGE 0.36.1 goes in `.upbge/` (see `tools/upbge.json`).

## How work happens

Development runs as a loop: `PLAN.md` holds the completion goal and the task list, `LOOP.md`
is the per-iteration protocol, `LOG.md` records each iteration. `scripts/loop.ps1` runs Claude
Code headless through it on Windows. The original three.js prototype lives in `web/`.
