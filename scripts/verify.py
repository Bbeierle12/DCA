"""The DCA verify gate.

    python scripts/verify.py           lint + pytest (logic, data, bpy world build)
    python scripts/verify.py --upbge   also build the .blend in UPBGE and run every scenario
                                       (needs UPBGE from tools/upbge.json, i.e. Brandon's PC)
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


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
    run("tests", [py, "-m", "pytest"])
    if args.upbge:
        run("upbge", [py, str(ROOT / "scripts" / "upbge_run.py"), "all"])
    print("\nverify OK")


if __name__ == "__main__":
    main()
