import math

import pytest

from dca import perf
from dca.units import from_prototype
from dca.world import World


def test_goal_is_720p_60_45():
    assert perf.WINDOW == (1280, 720)
    assert (perf.GOAL_AVG_FPS, perf.GOAL_LOW1_FPS, perf.SPOT_SECONDS) == (60, 45, 10)


def test_key_spots_are_pavements_near_the_landmarks():
    world = World()
    spots = perf.key_spots(world)
    assert [s[0] for s in spots] == ["spawn", *perf.LANDMARKS]
    assert spots[0][1:] == world.spawn_point()
    for name, x, y in spots:
        assert world.zone_at(x, y) == "clear_walk", name
        if name in perf.LANDMARKS:
            lx, ly = from_prototype(*perf.LANDMARKS[name])
            assert math.hypot(x - lx, y - ly) < 40, name
    assert world.place_at(*spots[1][1:]) == "Oxford Circus"


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
