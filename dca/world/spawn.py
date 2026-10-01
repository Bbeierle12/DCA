"""Find a spot of a given zone type near a point (port of web/services/world/Spawn.ts)."""

from __future__ import annotations

import math
from typing import Protocol


class ZoneLookup(Protocol):
    def zone_at(self, x: float, z: float) -> str: ...


def find_nearest_zone_point(
    zones: ZoneLookup,
    x: float,
    z: float,
    zone: str,
    max_radius: float = 80.0,
    step: float = 0.5,
) -> tuple[float, float] | None:
    """Nearest point of `zone` to (x, z), searching outward in rings.

    Returns the centre of the matching 2 m cell (or the ring hit if the centre is a different
    zone), the start point if it already matches, or None if nothing within max_radius.
    """
    if zones.zone_at(x, z) == zone:
        return (x, z)
    r = step
    while r <= max_radius:
        samples = max(8, math.ceil((2 * math.pi * r) / step))
        for i in range(samples):
            a = (i / samples) * math.pi * 2
            px = x + math.cos(a) * r
            pz = z + math.sin(a) * r
            if zones.zone_at(px, pz) == zone:
                cx = math.floor(px / 2) * 2 + 1
                cz = math.floor(pz / 2) * 2 + 1
                return (cx, cz) if zones.zone_at(cx, cz) == zone else (px, pz)
        r += step
    return None
