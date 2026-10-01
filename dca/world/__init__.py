"""The London map: data exported from the prototype (`data/*.json`) and lookups over it.

Map coordinates are the prototype's: x east, z south, metres, the map spans [0, 800].
Blender coordinates are (x, -z) (`dca.units.from_prototype`). `World` speaks Blender
coordinates; the submodules speak map coordinates.
"""

from __future__ import annotations

from dca.units import from_prototype, to_prototype
from dca.world import data
from dca.world.places import PlaceNamer
from dca.world.spawn import find_nearest_zone_point

CLEAR_WALK = "clear_walk"


class World:
    """Map lookups in Blender coordinates (x east, y north)."""

    def __init__(self, london: data.London | None = None, zones: data.ZoneGrid | None = None):
        self.london = london or data.london()
        self.zones = zones or data.zones()
        self._namer = PlaceNamer(self.london)

    def zone_at(self, x: float, y: float) -> str:
        return self.zones.zone_at(*to_prototype(x, y))

    def place_at(self, x: float, y: float) -> str:
        return self._namer.at(*to_prototype(x, y))

    def spawn_point(self) -> tuple[float, float]:
        """A pavement (clear walk) cell near the prototype's spawn target, in Blender x, y."""
        mx, mz = self.london.spawn_target
        found = find_nearest_zone_point(self.zones, mx, mz, CLEAR_WALK)
        if found is None:
            raise RuntimeError("no pavement near the spawn target")
        return from_prototype(*found)
