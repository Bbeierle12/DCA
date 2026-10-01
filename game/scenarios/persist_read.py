"""C5, part 2 of 2: a fresh launch loads what persist_write saved on quit."""

import json
import math

from game import input as game_input
from game import main
from game.scenarios.persist_write import SLOT, expected_path


def run(ctx):
    main.SAVE_SLOT = SLOT
    game_input.quit = False
    game_input.override = {}
    game_input.camera = None
    yield from ctx.wait_frames(20)
    game = main.instance()
    with open(expected_path(ctx), encoding="utf-8") as f:
        want = json.load(f)
    ctx.check("loaded a save", game.loaded)
    p = game.player.position
    gap = math.dist((p.x, p.y, game.player.feet_z), want["position"])
    ctx.check("player is where they quit (within 5 cm)", gap <= 0.05, round(gap, 3))
    ctx.check("facing restored", abs(game.player.yaw - want["yaw"]) < 1e-3)
    ctx.check("money restored", game.state.money == want["money"] == 123, game.state.money)
    ctx.check("camera restored", abs(game.camera.orbit.yaw - want["camera"]["yaw"]) < 1e-6
              and abs(game.camera.orbit.distance - 5.0) < 1e-6)
    ctx.check("standing on the ground after loading", game.player.on_ground)
    ctx.check("HUD shows the loaded money", game.hud.text.money == "£123", game.hud.text.money)
