"""The running game: one Game per session, ticked every frame by game.boot after the harness."""

from __future__ import annotations

import time

import bge

from dca import movement
from game import input as game_input

_instance = None
# Frame limiter, fps (0 = uncapped; override with --cap N). Streets on Brandon's PC (C3 sweep,
# variable time step): uncapped 77-80 fps avg with 1%-lows of 34-58 run to run; capped at 75 the
# 1%-lows were 47-53 in both runs, with no frame over 22 ms in the second.
FRAME_CAP = 75.0


def clock() -> float:
    get = getattr(bge.logic, "getClockTime", None)
    return get() if get else time.perf_counter()


def camera_yaw(camera) -> float:
    """Yaw of the camera's view direction projected on the ground (camera looks down its -z)."""
    view = camera.worldOrientation.col[2] * -1.0
    return movement.yaw_of(view.x, view.y)


class Game:
    def __init__(self, scene, options: dict | None = None):
        from game.camera import CameraRig
        from game.player import PlayerController

        self.scene = scene
        # UPBGE 0.36's player starts on its own "__default__cam__" even though the file's
        # scene camera is "Camera" (seen 2026-10-01), so pick ours explicitly.
        if "Camera" in scene.objects:
            scene.active_camera = scene.objects["Camera"]
        self.player = PlayerController(scene) if "Player" in scene.objects else None
        self.camera = CameraRig(scene, self.player) if self.player and "Camera" in scene.objects else None
        self.camera_follow = True
        self.cap = float((options or {}).get("cap", FRAME_CAP))
        self.last = clock()
        self.frame_mark = time.perf_counter()

    def update(self) -> None:
        # The engine's clock, so movement uses exactly the time this frame's physics step covers.
        now = clock()
        dt, self.last = max(0.0, min(now - self.last, 0.1)), now
        if self.player is None:
            return
        if self.camera:
            self.camera.read_input()
            yaw = self.camera.yaw
        else:
            yaw = camera_yaw(self.scene.active_camera)
        self.player.update(game_input.read_intent(), yaw, dt)
        if self.camera and self.camera_follow:
            self.camera.place()
        self.pace()

    def pace(self) -> None:
        """Frame limiter for the variable time step: wait out the rest of 1/cap seconds."""
        if self.cap <= 0:
            return
        target = self.frame_mark + 1.0 / self.cap
        now = time.perf_counter()
        if now >= target:
            self.frame_mark = now
            return
        if target - now > 0.002:
            time.sleep(target - now - 0.002)
        while time.perf_counter() < target:
            pass
        self.frame_mark = target


def instance() -> Game | None:
    return _instance


def tick(options: dict | None = None) -> None:
    global _instance
    if _instance is None:
        _instance = Game(bge.logic.getCurrentScene(), options)
    _instance.update()
