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
