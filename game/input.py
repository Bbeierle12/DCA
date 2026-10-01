"""Player intent from the keyboard, unless a scenario has taken over (no human input in tests).

Scenarios set `override` (Intent fields as a dict) and `camera` ({"yaw", "pitch", "distance"},
any subset); None means "read the real keyboard / mouse".
"""

from __future__ import annotations

import bge

from dca.movement import Intent

override: dict | None = None
camera: dict | None = None


def _down(inputs, key) -> bool:
    event = inputs.get(key)
    return bool(event and event.active)


def read_intent() -> Intent:
    if override is not None:
        return Intent(**override)
    keys = bge.logic.keyboard.inputs
    ev = bge.events
    forward = float(_down(keys, ev.WKEY)) - float(_down(keys, ev.SKEY))
    right = float(_down(keys, ev.DKEY)) - float(_down(keys, ev.AKEY))
    run = _down(keys, ev.LEFTSHIFTKEY) or _down(keys, ev.RIGHTSHIFTKEY)
    jump = _down(keys, ev.SPACEKEY)
    return Intent(forward=forward, right=right, run=run, jump=jump)
