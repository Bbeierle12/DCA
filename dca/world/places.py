"""Human place names for the HUD (port of web/services/world/Places.ts).

A named junction if you're at one, otherwise the street you're on, otherwise the district,
otherwise "West End". Map coordinates (prototype x, z).
"""

from __future__ import annotations

import math
import re

from dca.world.data import London

JUNCTION_MARGIN = 8.0
STREET_MARGIN = 6.0
FALLBACK = "West End"
_SUFFIX = re.compile(r"\s*\([^)]*\)\s*$")


def street_name(name: str) -> str:
    """"Oxford Street (East)" -> "Oxford Street"."""
    return _SUFFIX.sub("", name)


def segment_distance(p0, p1, x: float, z: float) -> float:
    """Distance from (x, z) to segment p0-p1, computed in the same order as the prototype."""
    dx, dz = p1[0] - p0[0], p1[1] - p0[1]
    len2 = dx * dx + dz * dz
    if len2 == 0:
        ex, ez = p0[0] - x, p0[1] - z
        return math.sqrt(ex * ex + ez * ez)
    t = ((x - p0[0]) * dx + (z - p0[1]) * dz) / len2
    t = max(0.0, min(1.0, t))
    cx, cz = p0[0] + dx * t, p0[1] + dz * t
    ex, ez = cx - x, cz - z
    return math.sqrt(ex * ex + ez * ez)


def place_name_at(london: London, x: float, z: float) -> str:
    for j in london.junctions:
        if j.name and math.hypot(x - j.center[0], z - j.center[1]) <= j.radius + JUNCTION_MARGIN:
            return j.name

    best_name, best_gap = None, math.inf
    for road in london.roads:
        half = road.half_width_to_building_line
        for p0, p1 in road.segments():
            gap = segment_distance(p0, p1, x, z) - half
            if gap <= STREET_MARGIN and gap < best_gap:
                best_name, best_gap = street_name(road.name), gap
    if best_name is not None:
        return best_name

    for d in london.districts:
        if d.contains(x, z):
            return d.name
    return FALLBACK


class PlaceNamer:
    """Caches the last answer so per-frame calls are cheap while standing still."""

    def __init__(self, london: London):
        self.london = london
        self._x = math.nan
        self._z = math.nan
        self._last = ""

    def at(self, x: float, z: float) -> str:
        if abs(x - self._x) < 1 and abs(z - self._z) < 1:
            return self._last
        self._x, self._z = x, z
        self._last = place_name_at(self.london, x, z)
        return self._last
