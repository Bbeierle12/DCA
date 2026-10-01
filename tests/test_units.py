from dca import units


def test_real_world_scale():
    assert units.PLAYER_HEIGHT == 1.75
    assert units.STOREY_HEIGHT == 3.0
    assert units.WORLD_SIZE % units.BUILD_TILE == 0
    assert units.RUN_SPEED > units.WALK_SPEED


def test_prototype_axis_round_trip():
    x, y = units.from_prototype(430.0, 260.0)
    assert (x, y) == (430.0, -260.0)
    assert units.to_prototype(x, y) == (430.0, 260.0)


def test_kerbs_are_steppable_and_jump_is_physical():
    import pytest

    assert units.KERB_HEIGHT < units.STEP_HEIGHT < 0.3
    # sqrt(2 * 9.80665 * 0.4), evaluated with Wolfram Language: 2.800949838893942
    assert units.JUMP_SPEED == pytest.approx(2.800949838893942, abs=1e-12)
