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
