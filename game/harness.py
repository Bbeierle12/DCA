"""Scenario harness: runs a scripted scenario inside UPBGE and writes a JSON result.

Started by game.boot when the player is launched with `- --scenario NAME --results DIR`.
A scenario is a generator `run(ctx)`; each `yield` advances one frame.
"""

from __future__ import annotations

import importlib
import json
import os
import time
import traceback

import bge

from dca.metrics import frame_stats
from game.scenarios.registry import SCENARIOS

MAX_SECONDS = 180.0


class ScenarioContext:
    def __init__(self, name: str):
        self.name = name
        self.frame = 0
        self.checks: list[dict] = []
        self.metrics: dict = {}
        self.frame_times: list[float] = []  # only while measuring
        self.measuring = False
        self.window: list[float] | None = None  # frame times of the current labelled window

    @property
    def scene(self):
        return bge.logic.getCurrentScene()

    def wait_frames(self, n: int):
        for _ in range(n):
            yield

    def wait_seconds(self, seconds: float):
        end = time.perf_counter() + seconds
        while time.perf_counter() < end:
            yield

    def measure(self, frames: int | None = None, seconds: float | None = None, label: str | None = None,
                each_frame=None):
        """Records frame times for a window (warm-up frames before it are excluded).

        With `label`, the window's own stats go to metrics[label]. `each_frame(t)` runs before
        every frame with t in [0, 1) through the window (e.g. to turn the camera).
        """
        self.measuring = True
        window: list[float] = []
        self.window = window if label else None
        if frames is not None:
            for i in range(frames):
                if each_frame:
                    each_frame(i / frames)
                yield
        if seconds is not None:
            start = time.perf_counter()
            while (now := time.perf_counter()) < start + seconds:
                if each_frame:
                    each_frame((now - start) / seconds)
                yield
        self.measuring = False
        self.window = None
        if label:
            self.metric(label, frame_stats(window).as_dict())

    def check(self, label: str, ok: bool, detail=None):
        self.checks.append({"label": label, "ok": bool(ok), "detail": detail})

    def metric(self, key: str, value):
        self.metrics[key] = value


class Harness:
    def __init__(self, name: str, results_dir: str):
        self.ctx = ScenarioContext(name)
        self.results_dir = results_dir
        self.started = time.perf_counter()
        self.last = None
        self.done = False
        self.error = None
        self.warmup = 0.0  # first 10 frames: shader compilation and loading
        module = SCENARIOS.get(name)
        if module is None:
            self.error = f"unknown scenario {name!r}"
            self.gen = None
        else:
            self.gen = importlib.import_module(module).run(self.ctx)

    def tick(self):
        if self.done:
            return
        now = time.perf_counter()
        if self.last is not None:
            dt = now - self.last
            if self.ctx.measuring:
                self.ctx.frame_times.append(dt)
                if self.ctx.window is not None:
                    self.ctx.window.append(dt)
            if self.ctx.frame <= 10:
                self.warmup += dt
        self.last = now
        self.ctx.frame += 1
        if self.gen is None:
            return self.finish()
        if now - self.started > MAX_SECONDS:
            self.error = f"timed out after {MAX_SECONDS:.0f} s"
            return self.finish()
        try:
            next(self.gen)
        except StopIteration:
            self.finish()
        except Exception:
            self.error = traceback.format_exc()
            self.finish()

    def finish(self):
        self.done = True
        ctx = self.ctx
        passed = self.error is None and all(c["ok"] for c in ctx.checks) and bool(ctx.checks)
        result = {
            "scenario": ctx.name,
            "passed": passed,
            "error": self.error,
            "checks": ctx.checks,
            "metrics": ctx.metrics,
            "frames": frame_stats(ctx.frame_times).as_dict(),
            "warmup_seconds": round(self.warmup, 2),
            "seconds": round(time.perf_counter() - self.started, 2),
        }
        os.makedirs(self.results_dir, exist_ok=True)
        with open(os.path.join(self.results_dir, f"{ctx.name}.json"), "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)
        bge.logic.endGame()
