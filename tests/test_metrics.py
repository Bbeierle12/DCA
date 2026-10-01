from dca.metrics import frame_stats


def test_steady_frames():
    stats = frame_stats([1 / 60] * 600)
    assert stats.frames == 600
    assert abs(stats.avg_fps - 60) < 0.01
    assert abs(stats.low1_fps - 60) < 0.01


def test_one_percent_low_catches_hitches():
    times = [1 / 60] * 990 + [1 / 20] * 10
    stats = frame_stats(times)
    assert stats.low1_fps == 20.0
    assert 55 < stats.avg_fps < 60
    assert stats.worst_ms == 50.0


def test_empty_and_zero_frames_are_ignored():
    assert frame_stats([]).frames == 0
    assert frame_stats([0.0, 0.0]).avg_fps == 0.0


def test_spikes_finds_the_slow_frames():
    from dca.metrics import spikes

    times = [0.01] * 100
    times[10] = 0.05
    times[60] = 0.03
    out = spikes(times)
    assert out["median_ms"] == 10.0
    assert out["over_budget"] == 2  # 1/45 s = 22.2 ms
    assert out["worst"][:2] == [[10, 50.0], [60, 30.0]]


def test_spikes_empty():
    from dca.metrics import spikes

    assert spikes([]) == {"median_ms": 0.0, "over_budget": 0, "worst": []}
