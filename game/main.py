"""The running game: one Game per session, ticked every frame by game.boot after the harness."""

from __future__ import annotations

import atexit
import os
import time

import bge

from dca import movement
from game import input as game_input

_instance = None
# Frame limiter, fps (0 = uncapped; override with --cap N). Streets on Brandon's PC (C3 sweep,
# variable time step): uncapped 77-80 fps avg with 1%-lows of 34-58 run to run; capped at 75 the
# 1%-lows were 47-53 in both runs, with no frame over 22 ms in the second.
FRAME_CAP = 75.0
# Scenario runs never touch the real save: a scenario that tests saving names a slot (a folder
# under <results>/saves) before its first yield, i.e. before the game starts; others get none.
SAVE_SLOT: str | None = None


def save_store(options: dict):
    from dca.save import SaveStore

    if "scenario" not in options:
        return SaveStore()  # the player's own save in app data
    if SAVE_SLOT is None:
        return None
    return SaveStore(os.path.join(options.get("results", "results"), "saves", SAVE_SLOT))


def clock() -> float:
    get = getattr(bge.logic, "getClockTime", None)
    return get() if get else time.perf_counter()


def camera_yaw(camera) -> float:
    """Yaw of the camera's view direction projected on the ground (camera looks down its -z)."""
    view = camera.worldOrientation.col[2] * -1.0
    return movement.yaw_of(view.x, view.y)


class Game:
    def __init__(self, scene, options: dict | None = None):
        from dca.save import Autosave
        from dca.state import GameState
        from dca.world import World
        from game.camera import CameraRig
        from game.hud import Hud
        from game.player import PlayerController

        self.scene = scene
        # UPBGE 0.36's player starts on its own "__default__cam__" even though the file's
        # scene camera is "Camera" (seen 2026-10-01), so pick ours explicitly.
        if "Camera" in scene.objects:
            scene.active_camera = scene.objects["Camera"]
        self.player = PlayerController(scene) if "Player" in scene.objects else None
        self.camera = CameraRig(scene, self.player) if self.player and "Camera" in scene.objects else None
        self.camera_follow = True
        self.world = World()
        self.store = save_store(options or {})
        loaded = self.store.load() if self.store else None
        self.loaded = loaded is not None
        self.state = loaded or GameState()
        self.restore()
        self.autosave = Autosave(self.store) if self.store else None
        self.quitting = False
        atexit.register(self.save_now)  # fallback if the window is closed some other way
        self.hud = Hud(scene)
        self.played = 0.0
        self.cap = float((options or {}).get("cap", FRAME_CAP))
        self.last = clock()
        self.frame_mark = time.perf_counter()

    def update(self) -> None:
        # The engine's clock, so movement uses exactly the time this frame's physics step covers.
        now = clock()
        dt, self.last = max(0.0, min(now - self.last, 0.1)), now
        if self.player is None:
            return
        if game_input.quit_requested():
            self.quit()
            return
        if self.camera:
            self.camera.read_input()
            yaw = self.camera.yaw
        else:
            yaw = camera_yaw(self.scene.active_camera)
        self.player.update(game_input.read_intent(), yaw, dt)
        if self.camera and self.camera_follow:
            self.camera.place()
        self.played += dt
        if self.autosave:
            self.autosave.tick(dt, self.snapshot)
        self.update_hud()
        self.pace()

    # ---- saving

    def snapshot(self):
        p = self.player.position
        self.state.position = (p.x, p.y, self.player.feet_z)
        self.state.yaw = self.player.yaw
        if self.camera:
            o = self.camera.orbit
            self.state.camera = {"yaw": o.yaw, "pitch": o.pitch, "distance": o.distance}
        return self.state

    def restore(self) -> None:
        if self.player is None or self.state.position is None:
            return
        self.player.teleport(self.state.position, self.state.yaw)
        if self.camera:
            for key, value in self.state.camera.items():
                setattr(self.camera.orbit, key, value)

    def save_now(self) -> bool:
        return bool(self.autosave and self.player) and self.autosave.now(self.snapshot())

    def quit(self) -> None:
        """Esc: save, then end the game."""
        if not self.quitting:
            self.quitting = True
            self.save_now()
            bge.logic.endGame()

    def update_hud(self, interaction: str = "") -> None:
        from dca.hud import hud_text, prompt_for

        p = self.player.position
        place = self.world.place_at(p.x, p.y)
        self.hud.set(hud_text(self.state, place, prompt_for(self.played, interaction)))

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
