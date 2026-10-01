"""Versioned save file (C5), ported from the prototype's SaveGame.ts.

One JSON file per player in the user's app-data folder. Bump SAVE_VERSION and add a migrator to
MIGRATIONS whenever the shape changes; old saves upgrade step by step on load. Anything unreadable
is moved aside to save.corrupt.json (to inspect later) and the game starts fresh. Writes are
atomic (temporary file, then replace), so a crash mid-save never leaves half a file.
"""

from __future__ import annotations

import json
import math
import os
import sys
import time
from collections.abc import Callable
from pathlib import Path

from dca.state import GameState

SAVE_VERSION = 1
FILE_NAME = "save.json"
CORRUPT_NAME = "save.corrupt.json"

Migrator = Callable[[dict], dict]
# MIGRATIONS[n] upgrades a version-n save to version n + 1.
MIGRATIONS: dict[int, Migrator] = {}


def default_folder() -> Path:
    """%APPDATA%\\DCA on Windows, ~/.local/share/dca elsewhere; DCA_SAVE_DIR overrides."""
    env = os.environ.get("DCA_SAVE_DIR")
    if env:
        return Path(env)
    if sys.platform == "win32" and os.environ.get("APPDATA"):
        return Path(os.environ["APPDATA"]) / "DCA"
    return Path.home() / ".local" / "share" / "dca"


def _num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def to_dict(state: GameState) -> dict:
    x, y, z = state.position if state.position else (None, None, None)
    return {
        "version": SAVE_VERSION,
        "savedAt": time.time(),
        "player": {"x": x, "y": y, "z": z, "yaw": state.yaw},
        "money": state.money,
        "energy": state.energy,
        "camera": dict(state.camera),
    }


def is_valid(d) -> bool:
    if not isinstance(d, dict) or d.get("version") != SAVE_VERSION or not _num(d.get("savedAt")):
        return False
    if not isinstance(d.get("money"), int) or isinstance(d.get("money"), bool) or not _num(d.get("energy")):
        return False
    p = d.get("player")
    if not isinstance(p, dict) or not _num(p.get("yaw")):
        return False
    coords = [p.get(k) for k in ("x", "y", "z")]
    if not (all(c is None for c in coords) or all(_num(c) for c in coords)):
        return False
    cam = d.get("camera", {})
    return isinstance(cam, dict) and all(_num(v) for v in cam.values())


def from_dict(d: dict) -> GameState:
    p = d["player"]
    position = None if p["x"] is None else (float(p["x"]), float(p["y"]), float(p["z"]))
    return GameState(money=d["money"], energy=float(d["energy"]), position=position,
                     yaw=float(p["yaw"]), camera=dict(d.get("camera", {})))


def migrate(raw: dict, migrations: dict[int, Migrator] | None = None) -> dict | None:
    """Upgrades an older save to the current version, or None if impossible."""
    migrations = MIGRATIONS if migrations is None else migrations
    obj = dict(raw)
    version = obj.get("version", 0) if _num(obj.get("version", 0)) else 0
    if version > SAVE_VERSION:
        return None  # from a newer build; don't guess
    while version < SAVE_VERSION:
        step = migrations.get(version)
        if step is None:
            return None
        obj = step(obj)
        version += 1
        obj = {**obj, "version": version}
    return obj if is_valid(obj) else None


def parse(text: str | None, migrations: dict[int, Migrator] | None = None):
    """dict for a good save, None for no save, "corrupt" for anything unreadable."""
    if text is None:
        return None
    try:
        obj = json.loads(text)
    except ValueError:
        return "corrupt"
    if not isinstance(obj, dict):
        return "corrupt"
    return migrate(obj, migrations) or "corrupt"


class SaveStore:
    def __init__(self, folder: Path | str | None = None):
        self.folder = Path(folder) if folder is not None else default_folder()

    @property
    def path(self) -> Path:
        return self.folder / FILE_NAME

    def load(self) -> GameState | None:
        try:
            text = self.path.read_text(encoding="utf-8")
        except FileNotFoundError:
            return None
        except OSError:
            return None
        result = parse(text)
        if result == "corrupt":
            try:
                os.replace(self.path, self.folder / CORRUPT_NAME)
            except OSError:
                pass
            return None
        return from_dict(result) if result else None

    def save(self, state: GameState) -> bool:
        try:
            self.folder.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(to_dict(state), indent=1), encoding="utf-8")
            os.replace(tmp, self.path)
            return True
        except OSError:
            return False

    def clear(self) -> None:
        try:
            self.path.unlink()
        except OSError:
            pass


class Autosave:
    """Saves every `interval` seconds of play (and whenever asked, e.g. on quit)."""

    def __init__(self, store: SaveStore, interval: float = 10.0):
        self.store, self.interval, self.elapsed = store, interval, 0.0
        self.saves = 0

    def tick(self, dt: float, snapshot: Callable[[], GameState]) -> bool:
        self.elapsed += dt
        if self.elapsed < self.interval:
            return False
        self.elapsed = 0.0
        return self.now(snapshot())

    def now(self, state: GameState) -> bool:
        ok = self.store.save(state)
        self.saves += ok
        return ok
