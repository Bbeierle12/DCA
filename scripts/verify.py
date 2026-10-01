"""The DCA verify gate.

    python scripts/verify.py           lint + pytest (logic, data, bpy world build)
    python scripts/verify.py --upbge   also build the .blend in UPBGE and run every scenario
                                       (needs UPBGE from tools/upbge.json, i.e. Brandon's PC)
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import platform
import subprocess
import sys
import sysconfig
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def upbge_blender() -> Path | None:
    """UPBGE's blender.exe from tools/upbge.json, if it is installed on this machine."""
    cfg = json.loads((ROOT / "tools" / "upbge.json").read_text())
    entry = cfg.get("windows" if platform.system() == "Windows" else platform.system().lower())
    if not entry:
        return None
    path = ROOT / entry["dir"] / entry["blender"]
    return path if path.exists() else None


def pytest_command(py: str) -> list[str]:
    """pytest in this venv when the bpy wheel is installed; otherwise inside UPBGE's own Blender.

    Brandon's PC cannot download the bpy 3.6 wheel (download.blender.org answers it with a
    Cloudflare challenge), so there the same tests run in UPBGE's Blender with this venv's
    packages (pytest) on the path. Both are Python 3.10 and the same Blender line.
    """
    if importlib.util.find_spec("bpy") is not None:
        return [py, "-m", "pytest"]
    blender = upbge_blender()
    if blender is None:
        sys.exit("verify: no bpy wheel and no UPBGE; install the [bpy] extra (see CLAUDE.md)")
    site = sysconfig.get_paths()["purelib"]
    expr = (
        "import sys; "
        f"sys.path[:0] = [{str(ROOT)!r}, {site!r}]; "
        "import pytest; "
        "sys.exit(pytest.main(['-p', 'no:cacheprovider']))"
    )
    return [str(blender), "-b", "--factory-startup", "--python-exit-code", "1", "--python-expr", expr]


def run(step: str, cmd: list[str]) -> None:
    print(f"\n== {step}: {' '.join(cmd)}", flush=True)
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode != 0:
        print(f"\nverify FAILED at: {step}")
        sys.exit(result.returncode)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--upbge", action="store_true", help="also run the UPBGE build and scenarios")
    args = parser.parse_args()

    py = sys.executable
    run("lint", [py, "-m", "ruff", "check", "."])
    run("tests", pytest_command(py))
    if args.upbge:
        run("upbge", [py, str(ROOT / "scripts" / "upbge_run.py"), "all"])
    print("\nverify OK")


if __name__ == "__main__":
    main()
