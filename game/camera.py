"""Third-person camera at run time (C3): mouse orbit, wheel zoom, pull-in on collision.

Maths in dca/camera.py. Rays use x-ray + the world mask so the player's own capsule never
blocks the view.
"""

from __future__ import annotations

import bge
from mathutils import Euler, Vector

from dca import body, units
from dca import camera as cm
from game import input as game_input

DIRECTIONS = [Vector(v) for v in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))]


class CameraRig:
    def __init__(self, scene, player):
        self.cam = scene.objects["Camera"]
        scene.active_camera = self.cam
        self.cam.lens = cm.LENS_MM
        self.player = player
        self.orbit = cm.Orbit(yaw=player.yaw)
        self.pulled = False
        self.pivot = Vector((0, 0, 0))
        self.mouse_ready = False
        bge.render.showMouse(False)

    @property
    def yaw(self) -> float:
        return self.orbit.yaw

    def read_input(self) -> None:
        override = game_input.camera
        if override is not None:
            for key in ("yaw", "pitch", "distance"):
                if key in override:
                    setattr(self.orbit, key, override[key])
            return
        mouse = bge.logic.mouse
        if self.mouse_ready:
            x, y = mouse.position
            self.orbit.turn((x - 0.5) * bge.render.getWindowWidth(), (y - 0.5) * bge.render.getWindowHeight())
        mouse.position = (0.5, 0.5)
        self.mouse_ready = True
        inputs = mouse.inputs
        up = inputs.get(bge.events.WHEELUPMOUSE)
        down = inputs.get(bge.events.WHEELDOWNMOUSE)
        notches = (1 if up and up.activated else 0) - (1 if down and down.activated else 0)
        if notches:
            self.orbit.zoom(notches)

    def place(self) -> None:
        feet = self.player.position
        feet.z -= body.HEIGHT / 2
        self.pivot = Vector(cm.pivot(tuple(feet)))
        want = Vector(cm.desired_position(self.orbit, tuple(self.pivot)))
        hit, point, _ = self.player.obj.rayCast(want, self.pivot, 0, "", 0, 1, 0, units.WORLD_MASK)
        self.pulled = hit is not None
        pos = cm.pulled_in(tuple(self.pivot), tuple(want), tuple(point) if hit else None)
        self.cam.worldPosition = pos
        self.cam.worldOrientation = Euler(self.orbit.rotation()).to_matrix()

    # ---- checks used by scenarios (completion goal 5)

    def line_of_sight_clear(self) -> bool:
        """Nothing solid between the pivot (the player's eyes) and the camera."""
        cam = self.cam.worldPosition
        hit, _, _ = self.player.obj.rayCast(cam, self.pivot, 0, "", 0, 1, 0, units.WORLD_MASK)
        return hit is None

    def inside_geometry(self, reach: float = 0.3) -> bool:
        """True if short rays from the camera hit something in (nearly) every direction."""
        cam = self.cam.worldPosition.copy()
        hits = 0
        for d in DIRECTIONS:
            hit, _, _ = self.player.obj.rayCast(cam + d * reach, cam, 0, "", 0, 1, 0, units.WORLD_MASK)
            hits += hit is not None
        return hits >= 5
