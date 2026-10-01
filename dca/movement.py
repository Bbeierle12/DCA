"""Player movement maths (C2): camera-relative direction, speed, turning and animation choice.

Angles: yaw 0 faces +y (north); positive yaw turns left (counter-clockwise seen from above),
the same sense as a Blender rotation about z. Velocities are metres per second in Blender x, y.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from dca import body
from dca.units import RUN_SPEED, WALK_SPEED

TURN_RATE = math.radians(720)  # how fast the body turns to face where it walks, rad/s
IDLE_BELOW = 0.1  # m/s


@dataclass(frozen=True)
class Intent:
    """What the player asks for this frame. forward/right in [-1, 1] (W/S and D/A)."""

    forward: float = 0.0
    right: float = 0.0
    run: bool = False
    jump: bool = False


def wrap(angle: float) -> float:
    """Angle in (-pi, pi]."""
    a = math.fmod(angle + math.pi, 2 * math.pi)
    if a <= 0:
        a += 2 * math.pi
    return a - math.pi


def forward_vector(yaw: float) -> tuple[float, float]:
    return -math.sin(yaw), math.cos(yaw)


def right_vector(yaw: float) -> tuple[float, float]:
    return math.cos(yaw), math.sin(yaw)


def yaw_of(x: float, y: float) -> float:
    """Yaw that faces along (x, y)."""
    return math.atan2(-x, y)


def desired_velocity(intent: Intent, camera_yaw: float) -> tuple[float, float]:
    """World velocity for the intent, relative to where the camera looks. Diagonals are not faster."""
    f = max(-1.0, min(1.0, intent.forward))
    r = max(-1.0, min(1.0, intent.right))
    fx, fy = forward_vector(camera_yaw)
    rx, ry = right_vector(camera_yaw)
    dx, dy = fx * f + rx * r, fy * f + ry * r
    n = math.hypot(dx, dy)
    if n == 0.0:
        return 0.0, 0.0
    if n > 1.0:
        dx, dy = dx / n, dy / n
    speed = RUN_SPEED if intent.run else WALK_SPEED
    return dx * speed, dy * speed


def turn_toward(current: float, target: float, max_step: float) -> float:
    """Turn from current toward target by at most max_step, the short way round."""
    diff = wrap(target - current)
    if abs(diff) <= max_step:
        return wrap(target)
    return wrap(current + math.copysign(max_step, diff))


def animation_for(speed: float) -> tuple[str, float]:
    """(action, playback multiplier) so feet cover the ground they appear to.

    One cycle covers body.STRIDE metres in frames/ACTION_FPS seconds at multiplier 1, so the
    multiplier is cycles-per-second times seconds-per-cycle.
    """
    if speed < IDLE_BELOW:
        return "idle", 1.0
    name = "walk" if speed < (WALK_SPEED + RUN_SPEED) / 2 else "run"
    frames = body.ACTIONS[name]["frames"]
    return name, (speed / body.STRIDE[name]) * frames / body.ACTION_FPS


def displacement(velocity: tuple[float, float], dt: float) -> tuple[float, float]:
    """UPBGE's character walkDirection is a displacement per physics step, not a velocity.

    With the variable time step (tools/build_game.configure_engine) there is one physics step per
    frame, lasting the frame's real time dt.
    """
    return velocity[0] * dt, velocity[1] * dt
