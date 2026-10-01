"""Builds the game in UPBGE and runs scenarios with the standalone player.

    python scripts/upbge_run.py build             build/dca.blend via UPBGE headless
    python scripts/upbge_run.py scenario smoke    run one scenario, print its result
    python scripts/upbge_run.py all               build, then every registered scenario

UPBGE's location comes from tools/upbge.json (relative to the repo root); set DCA_UPBGE=0.50 to
use tools/upbge-0.50.json instead.
"""

from __future__ import annotations

import json
import os
import platform
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
RESULTS = BUILD / "results"
WINDOW = ("1280", "720")
SCENARIO_TIMEOUT = 300


def upbge_config() -> Path:
    """tools/upbge.json, or tools/upbge-<v>.json when DCA_UPBGE=<v> (e.g. 0.50 to re-test D11)."""
    version = os.environ.get("DCA_UPBGE", "")
    return ROOT / "tools" / (f"upbge-{version}.json" if version else "upbge.json")


def upbge_paths() -> tuple[Path, Path]:
    cfg = json.loads(upbge_config().read_text())
    key = "windows" if platform.system() == "Windows" else platform.system().lower()
    if key not in cfg:
        sys.exit(f"tools/upbge.json has no entry for {key}; UPBGE runs on Brandon's PC")
    base = ROOT / cfg[key]["dir"]
    blender, player = base / cfg[key]["blender"], base / cfg[key]["player"]
    if not blender.exists():
        sys.exit(f"UPBGE not found at {blender}; see tools/upbge.json 'install'")
    return blender, player


def build() -> None:
    blender, _ = upbge_paths()
    cmd = [str(blender), "-b", "--factory-startup", "--python", str(ROOT / "tools" / "build_game.py"),
           "--", "--out", str(BUILD / "dca.blend")]
    out = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=600)
    ok_line = next((line for line in out.stdout.splitlines() if line.startswith("DCA_BUILD_OK")), None)
    if out.returncode != 0 or ok_line is None or "upbge=True" not in ok_line:
        print(out.stdout[-4000:], out.stderr[-4000:])
        sys.exit("UPBGE build failed")
    print(ok_line)


def scenario(name: str) -> bool:
    _, player = upbge_paths()
    result_file = RESULTS / f"{name}.json"
    result_file.unlink(missing_ok=True)
    cmd = [str(player), "-w", *WINDOW, str(BUILD / "dca.blend"),
           "-", "--scenario", name, "--results", str(RESULTS)]
    try:
        proc = subprocess.run(cmd, cwd=BUILD, capture_output=True, text=True, timeout=SCENARIO_TIMEOUT)
    except subprocess.TimeoutExpired:
        print(f"[FAIL] {name}: player did not exit within {SCENARIO_TIMEOUT} s")
        return False
    if not result_file.exists():
        print(f"[FAIL] {name}: no result file (player exit {proc.returncode})")
        print(proc.stdout[-3000:], proc.stderr[-3000:])
        return False
    result = json.loads(result_file.read_text())
    frames = result["frames"]
    status = "PASS" if result["passed"] else "FAIL"
    print(f"[{status}] {name}: {frames['frames']} frames, avg {frames['avg_fps']} fps, "
          f"1%-low {frames['low1_fps']} fps, worst {frames['worst_ms']} ms, "
          f"warm-up {result.get('warmup_seconds')} s")
    for check in result["checks"]:
        detail = f" ({check['detail']})" if check["detail"] else ""
        print(f"    {'ok ' if check['ok'] else 'BAD'} {check['label']}{detail}")
    if result["error"]:
        print("    error:", result["error"])
    return bool(result["passed"])


def main(argv: list[str]) -> None:
    if not argv:
        sys.exit(__doc__)
    sys.path.insert(0, str(ROOT))
    from game.scenarios.registry import SCENARIOS

    if argv[0] == "build":
        build()
    elif argv[0] == "scenario" and len(argv) > 1:
        sys.exit(0 if scenario(argv[1]) else 1)
    elif argv[0] == "all":
        build()
        results = [scenario(name) for name in SCENARIOS]
        sys.exit(0 if all(results) else 1)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
