"""World units. 1 Blender unit = 1 metre; z is up. The map spans x, y in [0, WORLD_SIZE].

The web prototype used three.js axes (y up, z south). Blender is z-up, so prototype (x, z)
ground coordinates map to Blender (x, -y): north stays "up" on the map when viewed from above.
"""

WORLD_SIZE = 800.0
BUILD_TILE = 2.0
STOREY_HEIGHT = 3.0
PLAYER_HEIGHT = 1.75

WALK_SPEED = 3.0  # completion goal 4b; a brisk game pace (Wolfram|Alpha: typical walk 1.1 m/s)
RUN_SPEED = 6.0

# Character physics (C1). Kerbs are 0.125 m (UK-typical 100-125 mm upstand; the prototype's
# 0.3 m was lowered so the 0.25 m step height clears them).
STEP_HEIGHT = 0.25
KERB_HEIGHT = 0.125
MAX_SLOPE_DEG = 45.0
GRAVITY = 9.80665  # standard gravity, m/s^2
JUMP_HEIGHT = 0.4
JUMP_SPEED = (2 * GRAVITY * JUMP_HEIGHT) ** 0.5  # v = sqrt(2 g h) = 2.801 m/s (Wolfram|Alpha)


def from_prototype(x: float, z: float) -> tuple[float, float]:
    """Prototype ground point (x east, z south) -> Blender ground point (x east, y north)."""
    return x, -z


def to_prototype(x: float, y: float) -> tuple[float, float]:
    """Blender ground point -> prototype ground point (inverse of from_prototype)."""
    return x, -y

# Collision groups (UPBGE: 16 bits). The world is group 1; the player is group 2, so rays cast
# with WORLD_MASK (ground probes, the camera's pull-in) see the streets but not the player.
WORLD_GROUP = 0x0001
PLAYER_GROUP = 0x0002
WORLD_MASK = WORLD_GROUP
