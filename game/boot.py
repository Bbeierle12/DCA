"""Per-frame entry point, wired by the build to an Always sensor on the `Game` empty.

Reads launch arguments passed after `-` to the player:
    blenderplayer dca.blend - --scenario smoke --results build/results
"""

from __future__ import annotations

import sys

_state: dict = {"harness": None, "started": False}


def parse_args(argv: list[str]) -> dict:
    args: dict = {}
    if "-" in argv:
        rest = argv[argv.index("-") + 1 :]
        for i, token in enumerate(rest):
            if token.startswith("--") and i + 1 < len(rest):
                args[token[2:]] = rest[i + 1]
    return args


def tick(cont):
    if not _state["started"]:
        _state["started"] = True
        args = parse_args(sys.argv)
        _state["args"] = args
        if "scenario" in args:
            from game.harness import Harness

            _state["harness"] = Harness(args["scenario"], args.get("results", "results"), args)
    harness = _state["harness"]
    if harness is not None:
        harness.tick()  # first, so a scenario's input for this frame is in place
    from game import main

    main.tick(_state.get("args"))
