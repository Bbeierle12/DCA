"""Load `data/london.json` and `data/zones.json` (written by `web/scripts/export_map.ts`)."""

from __future__ import annotations

import json
import math
import os
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

SCHEMA = 1


def data_dir() -> Path:
    """`$DCA_DATA`, else `data/` beside the `dca` package (repo root, or the build folder)."""
    env = os.environ.get("DCA_DATA")
    return Path(env) if env else Path(__file__).resolve().parents[2] / "data"


def _read(name: str, folder: Path | None) -> dict:
    path = (folder or data_dir()) / name
    doc = json.loads(path.read_text(encoding="utf-8"))
    if doc.get("schema") != SCHEMA:
        raise ValueError(f"{path}: schema {doc.get('schema')!r}, expected {SCHEMA}")
    return doc


@dataclass(frozen=True)
class Kerbside:
    width: float
    clear_walk_width: float
    use: str
    marking: str


@dataclass(frozen=True)
class Road:
    id: str
    name: str
    type: str
    path: tuple[tuple[float, float], ...]
    carriageway_width: float
    curb_width: float
    curb_height: float
    furnishing_strip_width: float
    clear_walk_width: float
    one_way: bool
    lanes: tuple[tuple[str, str, float], ...]
    left: Kerbside
    right: Kerbside

    @property
    def half_width_to_building_line(self) -> float:
        """Centre line to the back of the pavement (as the prototype's place lookup uses it)."""
        return (
            self.carriageway_width / 2 + self.curb_width + self.furnishing_strip_width + self.clear_walk_width
        )

    def segments(self):
        return list(zip(self.path, self.path[1:], strict=False))


@dataclass(frozen=True)
class Junction:
    id: str
    name: str | None
    center: tuple[float, float]
    type: str
    radius: float
    inner_radius: float | None
    outer_radius: float | None
    road_ids: tuple[str, ...]


@dataclass(frozen=True)
class District:
    name: str
    x0: float
    z0: float
    x1: float
    z1: float

    def contains(self, x: float, z: float) -> bool:
        return self.x0 <= x < self.x1 and self.z0 <= z < self.z1


@dataclass(frozen=True)
class London:
    width: float
    height: float
    seed: int
    spawn_target: tuple[float, float]
    roads: tuple[Road, ...]
    junctions: tuple[Junction, ...]
    districts: tuple[District, ...]
    colors: dict
    counts: dict

    def road(self, road_id: str) -> Road:
        return next(r for r in self.roads if r.id == road_id)

    def junction(self, junction_id: str) -> Junction:
        return next(j for j in self.junctions if j.id == junction_id)


def _kerbside(doc: dict) -> Kerbside:
    return Kerbside(doc["width"], doc["clearWalkWidth"], doc["use"], doc["marking"])


def _road(doc: dict) -> Road:
    return Road(
        id=doc["id"],
        name=doc["name"],
        type=doc["type"],
        path=tuple((p["x"], p["z"]) for p in doc["path"]),
        carriageway_width=doc["carriagewayWidth"],
        curb_width=doc["curbWidth"],
        curb_height=doc["curbHeight"],
        furnishing_strip_width=doc["furnishingStripWidth"],
        clear_walk_width=doc["clearWalkWidth"],
        one_way=bool(doc.get("oneWay")),
        lanes=tuple((ln["kind"], ln["direction"], ln["width"]) for ln in doc["laneLayout"]),
        left=_kerbside(doc["leftKerbside"]),
        right=_kerbside(doc["rightKerbside"]),
    )


def _junction(doc: dict) -> Junction:
    return Junction(
        id=doc["id"],
        name=doc.get("name"),
        center=(doc["center"]["x"], doc["center"]["z"]),
        type=doc["type"],
        radius=doc["radius"],
        inner_radius=doc.get("roundaboutInnerRadius"),
        outer_radius=doc.get("roundaboutOuterRadius"),
        road_ids=tuple(a["roadId"] for a in doc["arms"]),
    )


def load_london(folder: Path | None = None) -> London:
    doc = _read("london.json", folder)
    return London(
        width=doc["worldWidth"],
        height=doc["worldHeight"],
        seed=doc["randomSeed"],
        spawn_target=(doc["spawnTarget"]["x"], doc["spawnTarget"]["z"]),
        roads=tuple(_road(r) for r in doc["roads"]),
        junctions=tuple(_junction(j) for j in doc["intersections"]),
        districts=tuple(District(d["name"], d["x0"], d["z0"], d["x1"], d["z1"]) for d in doc["districts"]),
        colors=dict(doc["colors"]),
        counts=dict(doc["counts"]),
    )


@dataclass(frozen=True)
class ZoneGrid:
    """The prototype's 2 m zone map: what kind of ground each cell is (pavement, road, ...)."""

    cell_size: float
    width: int
    height: int
    legend: tuple[str, ...]
    rows: tuple[str, ...]
    outside: str
    counts: dict

    def zone_at(self, x: float, z: float) -> str:
        """Zone at map point (x, z); outside the map is open landscape, like the prototype."""
        col = math.floor(x / self.cell_size)
        row = math.floor(z / self.cell_size)
        if col < 0 or col >= self.width or row < 0 or row >= self.height:
            return self.outside
        return self.legend[int(self.rows[row][col])]

    def tally(self) -> dict:
        counts = Counter()
        for line in self.rows:
            counts.update(line)
        return {zone: counts.get(str(code), 0) for code, zone in enumerate(self.legend)}


def load_zones(folder: Path | None = None) -> ZoneGrid:
    doc = _read("zones.json", folder)
    grid = ZoneGrid(
        cell_size=doc["cellSize"],
        width=doc["width"],
        height=doc["height"],
        legend=tuple(doc["legend"]),
        rows=tuple(doc["rows"]),
        outside=doc["outside"],
        counts=dict(doc["counts"]),
    )
    if len(grid.rows) != grid.height or any(len(r) != grid.width for r in grid.rows):
        raise ValueError("zones.json: rows do not match width x height")
    return grid


@lru_cache(maxsize=1)
def london() -> London:
    return load_london()


@lru_cache(maxsize=1)
def zones() -> ZoneGrid:
    return load_zones()
