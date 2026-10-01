"""Completion goal 4b (and C1/C2): the player stands on the pavement, and holding forward for
2 s moves 6 m +/- 10% at walk speed; holding forward + run moves twice as far per second."""

import math

from dca import units
from game import input as game_input
from game import main


def horizontal(a, b) -> float:
    return math.hypot(b.x - a.x, b.y - a.y)


def hold(ctx, seconds, **intent):
    game_input.override = intent
    seen = set()
    end_frames = []

    def note(_t):
        p = main.instance().player
        seen.add(p.anim[0] if p.anim else None)
        end_frames.append(1)

    yield from ctx.measure(seconds=seconds, each_frame=note)
    game_input.override = {}
    return seen


def run(ctx):
    game_input.override = {}
    game_input.camera_yaw = -math.pi / 2  # look east, along Oxford Street's pavement
    yield from ctx.wait_frames(60)
    player = main.instance().player
    ctx.check("player exists", player is not None)
    ctx.check("standing on the ground", player.on_ground)
    ctx.check("feet on the pavement (0.135 m +/- 0.05)", abs(player.feet_z - 0.135) <= 0.05,
              round(player.feet_z, 3))
    ctx.check("idle while standing", player.anim and player.anim[0] == "idle", player.anim)

    start = player.position
    seen = yield from hold(ctx, 2.0, forward=1.0)
    yield from ctx.wait_frames(10)
    walked = horizontal(start, player.position)
    ctx.metric("walk_2s_m", round(walked, 3))
    ctx.check("2 s of forward walks 6 m +/- 10%", 5.4 <= walked <= 6.6, round(walked, 3))
    ctx.check("walk animation played", "walk" in seen, sorted(map(str, seen)))
    ctx.check("walked east", player.position.x - start.x > 5.0, round(player.position.x - start.x, 2))
    ctx.check("back to idle", player.anim[0] == "idle", player.anim)

    start = player.position
    seen = yield from hold(ctx, 1.0, forward=1.0, run=True)
    yield from ctx.wait_frames(10)
    ran = horizontal(start, player.position)
    ctx.metric("run_1s_m", round(ran, 3))
    ctx.check("1 s of running covers 6 m +/- 10%", 5.4 <= ran <= 6.6, round(ran, 3))
    ctx.check("run animation played", "run" in seen, sorted(map(str, seen)))
    ctx.metric("walk_speed", units.WALK_SPEED)
