"""Third-person orbit camera maths (C3): orbit, zoom, and pulling in when something is in the way.

Same yaw convention as dca.movement (0 faces +y, positive turns left). Pitch is how far the view
looks down from level, in radians. The camera sits behind the pivot (a point at eye height
above the player's feet) along the view direction.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

PIVOT_HEIGHT = 1.6  # eye height for a 1.75 m person (~0.93 of stature)
MIN_DISTANCE, MAX_DISTANCE = 1.5, 8.0
MIN_PITCH, MAX_PITCH = math.radians(-20), math.radians(70)
MOUSE_RADIANS_PER_PIXEL = 0.004
ZOOM_STEP = 0.85  # one wheel notch scales the distance by this
NEAR_MARGIN = 0.25  # stop this far in front of whatever blocks the view
CLOSEST = 0.3  # never closer to the pivot than this
LENS_MM = 28.0  # 65.5 deg horizontal, 39.8 deg vertical at 16:9 (Wolfram Language)


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


@dataclass
class Orbit:
    yaw: float = 0.0
    pitch: float = math.radians(15)
    distance: float = 4.5

    def turn(self, dx_pixels: float, dy_pixels: float) -> None:
        """Mouse right turns the view right; mouse down looks further down."""
        self.yaw -= dx_pixels * MOUSE_RADIANS_PER_PIXEL
        self.yaw = math.atan2(math.sin(self.yaw), math.cos(self.yaw))
        self.pitch = clamp(self.pitch + dy_pixels * MOUSE_RADIANS_PER_PIXEL, MIN_PITCH, MAX_PITCH)

    def zoom(self, notches: float) -> None:
        """Positive notches (wheel up) move closer."""
        self.distance = clamp(self.distance * ZOOM_STEP**notches, MIN_DISTANCE, MAX_DISTANCE)

    def view_direction(self) -> tuple[float, float, float]:
        c = math.cos(self.pitch)
        return -math.sin(self.yaw) * c, math.cos(self.yaw) * c, -math.sin(self.pitch)

    def rotation(self) -> tuple[float, float, float]:
        """Euler XYZ for a Blender camera (which looks down its -z) facing view_direction."""
        return math.pi / 2 - self.pitch, 0.0, self.yaw


def pivot(feet: tuple[float, float, float]) -> tuple[float, float, float]:
    return feet[0], feet[1], feet[2] + PIVOT_HEIGHT


def desired_position(orbit: Orbit, pivot_point) -> tuple[float, float, float]:
    d = orbit.view_direction()
    return tuple(p - di * orbit.distance for p, di in zip(pivot_point, d, strict=True))


def pulled_in(pivot_point, desired, hit_point) -> tuple[float, float, float]:
    """Where the camera goes when a ray from the pivot toward `desired` hits `hit_point`."""
    if hit_point is None:
        return tuple(desired)
    full = math.dist(pivot_point, desired)
    blocked = math.dist(pivot_point, hit_point)
    keep = clamp(blocked - NEAR_MARGIN, CLOSEST, full) / full if full > 0 else 0.0
    return tuple(p + (d - p) * keep for p, d in zip(pivot_point, desired, strict=True))
