"""Looks at the player from the front and side, standing and mid-stride, and saves screenshots
(build/results/portrait_*.png) so a person can judge the figure and its animation."""

import math

from mathutils import Euler, Vector

from game import input as game_input
from game import main


def aim(cam, eye, target):
    direction = Vector(target) - Vector(eye)
    cam.worldPosition = eye
    cam.worldOrientation = direction.to_track_quat("-Z", "Y").to_matrix()


def run(ctx):
    game_input.override = {}
    game_input.camera_yaw = -math.pi / 2
    yield from ctx.wait_frames(30)
    player = main.instance().player
    cam = ctx.scene.active_camera
    p = player.position
    chest = (p.x, p.y, p.z + 0.4)
    facing = Euler((0, 0, player.yaw)).to_matrix() @ Vector((0, 1, 0))
    side = Euler((0, 0, player.yaw)).to_matrix() @ Vector((1, 0, 0))

    aim(cam, Vector(chest) + facing * 3.2 + Vector((0, 0, 0.2)), chest)
    yield from ctx.wait_frames(10)
    yield from ctx.screenshot("front_idle")
    aim(cam, Vector(chest) + side * 3.2 + Vector((0, 0, 0.2)), chest)
    yield from ctx.wait_frames(5)
    yield from ctx.screenshot("side_idle")

    game_input.override = {"forward": 1.0}
    for i in range(4):
        yield from ctx.wait_frames(7)
        p = player.position
        chest = (p.x, p.y, p.z + 0.4)
        side = Euler((0, 0, player.yaw)).to_matrix() @ Vector((1, 0, 0))
        aim(cam, Vector(chest) + side * 3.2 + Vector((0, 0, 0.2)), chest)
        yield
        yield from ctx.screenshot(f"side_walk_{i}")
    game_input.override = {}
    ctx.check("took 6 screenshots", len(ctx.shots) == 6, len(ctx.shots))
