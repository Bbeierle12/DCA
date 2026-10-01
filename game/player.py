"""The player at run time: feeds dca.movement into UPBGE's character controller and picks the
animation. Built by tools/build_player.py (capsule `Player`, armature `PlayerRig`)."""

from __future__ import annotations

import math

import bge
from mathutils import Euler

from dca import body, movement

ACTION_PREFIX = "player_"


class PlayerController:
    def __init__(self, scene):
        self.obj = scene.objects["Player"]
        self.rig = scene.objects["PlayerRig"]
        self.obj.visible = False  # the capsule is only a collision shape; the rig is the body
        self.char = bge.constraints.getCharacter(self.obj)
        self.yaw = self.obj.worldOrientation.to_euler().z
        self.anim: tuple[str, float] | None = None
        self.speed = 0.0
        self.play("idle", 1.0)

    @property
    def position(self):
        return self.obj.worldPosition.copy()

    @property
    def feet_z(self) -> float:
        return self.obj.worldPosition.z - body.HEIGHT / 2

    @property
    def on_ground(self) -> bool:
        return bool(self.char.onGround)

    def play(self, name: str, rate: float) -> None:
        key = (name, round(rate, 2))
        if key == self.anim:
            return
        self.anim = key
        frames = body.ACTIONS[name]["frames"]
        self.rig.playAction(ACTION_PREFIX + name, 0, frames, layer=0, priority=0, blendin=6,
                            play_mode=bge.logic.KX_ACTION_MODE_LOOP, speed=rate)

    def update(self, intent: movement.Intent, camera_yaw: float, dt: float) -> None:
        vx, vy = movement.desired_velocity(intent, camera_yaw)
        self.char.walkDirection = (*movement.displacement((vx, vy), dt), 0.0)
        self.speed = math.hypot(vx, vy)
        if self.speed > 0:
            self.yaw = movement.turn_toward(self.yaw, movement.yaw_of(vx, vy), movement.TURN_RATE * dt)
            self.obj.worldOrientation = Euler((0.0, 0.0, self.yaw)).to_matrix()
        if intent.jump and self.char.onGround:
            self.char.jump()
        self.play(*movement.animation_for(self.speed))
