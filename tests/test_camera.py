import math

import pytest

from dca import camera as c


def test_default_view_looks_ahead_and_down():
    o = c.Orbit(yaw=0.0, pitch=math.radians(15), distance=4.5)
    dx, dy, dz = o.view_direction()
    assert dx == pytest.approx(0) and dy > 0.9 and dz < 0
    assert math.hypot(dx, dy, dz) == pytest.approx(1.0)


def test_camera_sits_behind_and_above_the_pivot():
    o = c.Orbit(yaw=0.0, pitch=math.radians(15), distance=4.5)
    p = c.pivot((10.0, 20.0, 0.135))
    assert p == pytest.approx((10.0, 20.0, 1.735))
    x, y, z = c.desired_position(o, p)
    assert y == pytest.approx(20.0 - 4.5 * math.cos(math.radians(15)))
    assert z == pytest.approx(1.735 + 4.5 * math.sin(math.radians(15)))
    assert math.dist((x, y, z), p) == pytest.approx(4.5)


def test_rotation_matches_movement_yaw():
    from dca import movement

    o = c.Orbit(yaw=0.7, pitch=0.0)
    dx, dy, _ = o.view_direction()
    assert movement.yaw_of(dx, dy) == pytest.approx(0.7)
    rx, ry, rz = o.rotation()
    assert (rx, ry, rz) == pytest.approx((math.pi / 2, 0.0, 0.7))


def test_mouse_turns_and_clamps_pitch():
    o = c.Orbit(yaw=0.0, pitch=0.0)
    o.turn(100, 0)
    assert o.yaw == pytest.approx(-0.4)  # mouse right turns the view right (clockwise)
    o.turn(0, 10_000)
    assert o.pitch == c.MAX_PITCH
    o.turn(0, -10_000)
    assert o.pitch == c.MIN_PITCH


def test_zoom_is_bounded():
    o = c.Orbit(distance=4.5)
    o.zoom(1)
    assert o.distance == pytest.approx(4.5 * 0.85)
    o.zoom(50)
    assert o.distance == c.MIN_DISTANCE
    o.zoom(-50)
    assert o.distance == c.MAX_DISTANCE


def test_pull_in_stops_short_of_the_obstacle():
    p, want = (0.0, 0.0, 1.6), (0.0, -4.0, 1.6)
    assert c.pulled_in(p, want, None) == want
    got = c.pulled_in(p, want, (0.0, -2.0, 1.6))
    assert got == pytest.approx((0.0, -2.0 + c.NEAR_MARGIN, 1.6))
    close = c.pulled_in(p, want, (0.0, -0.1, 1.6))  # wall right behind the head
    assert math.dist(close, p) == pytest.approx(c.CLOSEST)


def test_lens_field_of_view():
    # 2 atan(18 / 28 mm) on a 36 mm sensor: 65.47 deg (Wolfram Language)
    assert math.degrees(2 * math.atan(18 / c.LENS_MM)) == pytest.approx(65.4705, abs=1e-3)
