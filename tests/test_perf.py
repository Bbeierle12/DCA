import math

import pytest

from dca import perf


def test_goal_is_720p_60_45():
    assert perf.WINDOW == (1280, 720)
    assert (perf.GOAL_AVG_FPS, perf.GOAL_LOW1_FPS, perf.SPOT_SECONDS) == (60, 45, 10)


def test_key_spots_are_blender_coordinates():
    spots = perf.key_spots((445.0, -271.0))
    assert spots[0] == ("spawn", 445.0, -271.0)
    assert ("oxford_circus", 430.0, -260.0) in spots
    assert len(spots) == 4


def test_spin_turns_a_full_circle_at_eye_height():
    loc0, rot0 = perf.spin_pose(1, 2, 0.3, 0.0)
    _, rot_half = perf.spin_pose(1, 2, 0.3, 0.5)
    assert loc0 == (1, 2, pytest.approx(2.8))
    assert rot0[2] == 0 and rot_half[2] == pytest.approx(math.pi)
    assert 0 < rot0[0] < math.pi / 2  # slightly below the horizon


def test_meets_goal():
    assert perf.meets_goal({"frames": 600, "avg_fps": 61.0, "low1_fps": 45.0})
    assert not perf.meets_goal({"frames": 600, "avg_fps": 59.9, "low1_fps": 50.0})
    assert not perf.meets_goal({"frames": 600, "avg_fps": 90.0, "low1_fps": 44.9})
    assert not perf.meets_goal({"frames": 0, "avg_fps": 0.0, "low1_fps": 0.0})
