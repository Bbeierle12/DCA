"""C5, part 1 of 2: play a little, change state, let autosave run, then quit with Esc's path.
persist_read (next scenario, a fresh launch) checks everything came back."""

import json
import math
import os

from dca.save import SaveStore
from game import input as game_input
from game import main

SLOT = "persist"


def expected_path(ctx):
    return os.path.join(ctx.results_dir, "persist_expected.json")


def run(ctx):
    main.SAVE_SLOT = SLOT  # before the first yield: the game is created after it
    SaveStore(os.path.join(ctx.results_dir, "saves", SLOT)).clear()
    game_input.quit = False
    game_input.override = {}
    game_input.camera = {"yaw": -math.pi / 2}
    yield from ctx.wait_frames(20)
    game = main.instance()
    ctx.check("a new game (no save yet)", not game.loaded)

    game_input.override = {"forward": 1.0}
    yield from ctx.wait_seconds(1.0)
    game_input.override = {}
    game_input.camera = {"yaw": -1.0, "pitch": 0.3, "distance": 5.0}
    game.state.money = 123  # stand-in for earning, until the economy exists (Phase E)
    yield from ctx.wait_seconds(10.5)
    ctx.check("autosaved after 10 s of play", game.autosave.saves >= 1, game.autosave.saves)

    state = game.snapshot()
    with open(expected_path(ctx), "w", encoding="utf-8") as f:
        json.dump({"position": state.position, "yaw": state.yaw, "money": state.money,
                   "camera": state.camera}, f)
    ctx.metric("saved_position", [round(v, 3) for v in state.position])
    ctx.check("moved off the spawn point before quitting", abs(state.position[0] - 450) > 2.0)
    game_input.quit = True  # main.tick runs after the harness finishes this frame: save + end
