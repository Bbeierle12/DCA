import math

import pytest

from dca import movement as m
from dca.units import RUN_SPEED, WALK_SPEED


def test_yaw_convention():
    assert m.forward_vector(0) == pytest.approx((0, 1))  # north
    assert m.forward_vector(math.pi / 2) == pytest.approx((-1, 0))  # left turn faces west
    assert m.right_vector(0) == pytest.approx((1, 0))
    for yaw in (0.3, -2.0, 3.0):
        assert m.yaw_of(*m.forward_vector(yaw)) == pytest.approx(yaw)


def test_forward_follows_the_camera():
    vx, vy = m.desired_velocity(m.Intent(forward=1), camera_yaw=-math.pi / 2)  # camera faces east
    assert (vx, vy) == pytest.approx((WALK_SPEED, 0), abs=1e-9)


def test_strafe_and_back():
    assert m.desired_velocity(m.Intent(right=1), 0) == pytest.approx((WALK_SPEED, 0), abs=1e-9)
    assert m.desired_velocity(m.Intent(forward=-1), 0) == pytest.approx((0, -WALK_SPEED), abs=1e-9)


def test_diagonal_is_not_faster_and_run_doubles():
    vx, vy = m.desired_velocity(m.Intent(forward=1, right=1), 0.7)
    assert math.hypot(vx, vy) == pytest.approx(WALK_SPEED)
    vx, vy = m.desired_velocity(m.Intent(forward=1, run=True), 0)
    assert math.hypot(vx, vy) == pytest.approx(RUN_SPEED) == 2 * WALK_SPEED


def test_no_input_no_motion():
    assert m.desired_velocity(m.Intent(), 1.0) == (0.0, 0.0)


def test_two_seconds_of_walking_is_six_metres():
    """Completion goal 4b: holding forward for 2 s moves 6 m."""
    vx, vy = m.desired_velocity(m.Intent(forward=1), 0.0)
    assert math.hypot(vx, vy) * 2.0 == pytest.approx(6.0)


def test_turn_takes_the_short_way():
    assert m.turn_toward(math.radians(170), math.radians(-170), math.radians(5)) == pytest.approx(
        math.radians(175))
    assert m.turn_toward(0.0, 0.1, 1.0) == pytest.approx(0.1)
    assert m.wrap(3 * math.pi) == pytest.approx(math.pi)
    assert m.wrap(-math.pi) == pytest.approx(math.pi)


def test_animation_choice_and_rate():
    assert m.animation_for(0.0) == ("idle", 1.0)
    name, rate = m.animation_for(WALK_SPEED)
    assert name == "walk" and rate == pytest.approx(3.0 / 1.6)  # 1.875 strides a second
    name, rate = m.animation_for(RUN_SPEED)
    assert name == "run" and rate == pytest.approx(2.0)


def test_walk_direction_is_this_steps_displacement():
    assert m.displacement((3.0, 0.0), dt=1 / 75) == pytest.approx((0.04, 0.0))
    # 2 s of frames at any rate adds up to 6 m
    steps = [m.displacement((0.0, 3.0), dt)[1] for dt in [1 / 75] * 75 + [1 / 60] * 60]
    assert sum(steps) == pytest.approx(6.0)
