"""Frame-time statistics for the scenario harness (pure, unit-tested)."""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class FrameStats:
    frames: int
    avg_fps: float
    low1_fps: float
    worst_ms: float

    def as_dict(self) -> dict:
        return asdict(self)


def frame_stats(frame_seconds: list[float]) -> FrameStats:
    """Average fps and 1%-low fps (mean fps over the slowest 1% of frames, at least one frame)."""
    times = [t for t in frame_seconds if t > 0]
    if not times:
        return FrameStats(0, 0.0, 0.0, 0.0)
    total = sum(times)
    avg = len(times) / total
    slow = sorted(times, reverse=True)[: max(1, len(times) // 100)]
    low1 = len(slow) / sum(slow)
    return FrameStats(len(times), round(avg, 2), round(low1, 2), round(max(times) * 1000, 2))


def spikes(frame_seconds: list[float], budget_s: float = 1 / 45, top: int = 8) -> dict:
    """Where the slow frames are: median, how many miss the budget, and the worst ones (index, ms)."""
    times = [t for t in frame_seconds if t > 0]
    if not times:
        return {"median_ms": 0.0, "over_budget": 0, "worst": []}
    ordered = sorted(times)
    median = ordered[len(ordered) // 2]
    worst = sorted(enumerate(frame_seconds), key=lambda it: it[1], reverse=True)[:top]
    return {
        "median_ms": round(median * 1000, 2),
        "over_budget": sum(1 for t in times if t > budget_s),
        "worst": [[i, round(t * 1000, 1)] for i, t in worst],
    }
