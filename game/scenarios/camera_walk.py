"""C3 / completion goal 5: walking down the street while the camera orbits all the way round
at full zoom-out and swings from looking up to looking down, the camera never ends up inside
geometry or behind something solid, and the pull-in actually happens."""

import math

from game import input as game_input
from game import main

SECONDS = 10.0


def run(ctx):
    game_input.override = {}
    game_input.camera = {"yaw": -math.pi / 2, "pitch": math.radians(15), "distance": 8.0}
    yield from ctx.wait_frames(30)
    game = main.instance()
    rig = game.camera
    ctx.check("camera rig active", rig is not None and game.camera_follow)
    stats = {"frames": 0, "pulled": 0, "blocked": 0, "inside": 0, "closest": 99.0}

    def step(t):
        yaw = -math.pi / 2 + 2 * math.pi * t  # one full orbit
        pitch = math.radians(25 + 40 * math.sin(4 * math.pi * t))  # -15 .. 65 deg, twice
        game_input.camera = {"yaw": yaw, "pitch": pitch, "distance": 8.0}
        # walk east whatever the camera does: world (1, 0) in camera-relative terms
        game_input.override = {"forward": -math.sin(yaw), "right": math.cos(yaw)}
        if stats["frames"]:  # check the frame that was just placed
            stats["pulled"] += rig.pulled
            stats["blocked"] += not rig.line_of_sight_clear()
            stats["inside"] += rig.inside_geometry()
            stats["closest"] = min(stats["closest"], (rig.cam.worldPosition - rig.pivot).length)
        stats["frames"] += 1

    start = game.player.position
    yield from ctx.measure(seconds=SECONDS, label="camera_walk", each_frame=step)
    game_input.override = {}
    moved = game.player.position.x - start.x
    stats["closest"] = round(stats["closest"], 3)
    ctx.metric("camera", stats)
    ctx.check("walked east along the street (> 20 m)", moved > 20, round(moved, 1))
    ctx.check("camera never behind something solid", stats["blocked"] == 0, stats)
    ctx.check("camera never inside geometry", stats["inside"] == 0, stats)
    ctx.check("pull-in happened (something got in the way)", stats["pulled"] > 0, stats["pulled"])
