"""Performance goal (completion goal 3, D10) and the camera path the harness measures along."""

from __future__ import annotations

import math

from dca.units import from_prototype

WINDOW = (1280, 720)
GOAL_AVG_FPS = 60.0
GOAL_LOW1_FPS = 45.0
SPOT_SECONDS = 10.0
CAMERA_HEIGHT = 2.5  # third-person eye height over the ground, metres
PITCH = math.radians(83)  # Blender camera: 0 looks straight down, 90 deg looks level

# Busy places on the map (prototype x, z). Measured from the nearest pavement, where a player
# would stand (the junction centres are carriageway or a monument on a roundabout island).
LANDMARKS = {
    "oxford_circus": (430.0, 260.0),
    "piccadilly_circus": (430.0, 390.0),
    "trafalgar_square": (530.0, 490.0),
}


def key_spots(world) -> list[tuple[str, float, float]]:
    """Measurement spots in Blender x, y: the spawn pavement plus pavements at the landmarks.

    `world` is a `dca.world.World` (anything with `spawn_point()` and `pavement_near(x, y)`).
    """
    spots = [("spawn", *map(float, world.spawn_point()))]
    for name, xz in LANDMARKS.items():
        spots.append((name, *map(float, world.pavement_near(*from_prototype(*xz)))))
    return spots


def spin_pose(x: float, y: float, ground_z: float, t: float):
    """Camera location and Euler rotation turning one full circle as t goes 0 -> 1."""
    location = (x, y, ground_z + CAMERA_HEIGHT)
    rotation = (PITCH, 0.0, 2.0 * math.pi * t)
    return location, rotation


def meets_goal(stats: dict) -> bool:
    return stats["frames"] > 0 and stats["avg_fps"] >= GOAL_AVG_FPS and stats["low1_fps"] >= GOAL_LOW1_FPS
