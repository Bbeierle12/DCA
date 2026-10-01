"""World units. 1 Blender unit = 1 metre; z is up. The map spans x, y in [0, WORLD_SIZE].

The web prototype used three.js axes (y up, z south). Blender is z-up, so prototype (x, z)
ground coordinates map to Blender (x, -y): north stays "up" on the map when viewed from above.
"""

WORLD_SIZE = 800.0
BUILD_TILE = 2.0
STOREY_HEIGHT = 3.0
PLAYER_HEIGHT = 1.75

WALK_SPEED = 3.0
RUN_SPEED = 6.0


def from_prototype(x: float, z: float) -> tuple[float, float]:
    """Prototype ground point (x east, z south) -> Blender ground point (x east, y north)."""
    return x, -z


def to_prototype(x: float, y: float) -> tuple[float, float]:
    """Blender ground point -> prototype ground point (inverse of from_prototype)."""
    return x, -y
