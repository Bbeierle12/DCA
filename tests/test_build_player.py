"""C1: the player is 1.75 m tall, carried by a character capsule, with idle/walk/run cycles."""

import bpy
import pytest
from mathutils import Vector

from dca import body, units
from tools import build_game, build_player


@pytest.fixture(scope="module")
def player():
    scene = build_game.reset_scene()
    capsule = build_player.build_player(scene, location=(10.0, 20.0, 0.135))
    bpy.context.view_layer.update()
    return scene, capsule


def segments(scene):
    return [o for o in scene.objects if o.name.startswith("player_") and o.type == "MESH"]


def bounds(objs):
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo, hi = Vector(map(min, lo, w)), Vector(map(max, hi, w))
    return lo, hi


def test_height_is_175(player):
    scene, _ = player
    lo, hi = bounds(segments(scene))
    assert hi.z - lo.z == pytest.approx(units.PLAYER_HEIGHT, abs=0.05)
    assert lo.z == pytest.approx(0.135, abs=0.01)  # feet on the pavement it was placed on
    assert (lo.x + hi.x) / 2 == pytest.approx(10.0, abs=0.05)


def test_capsule_matches_the_body(player):
    _, capsule = player
    assert tuple(round(d, 3) for d in capsule.dimensions) == (0.5, 0.5, 1.75)
    assert capsule.location.z == pytest.approx(0.135 + 1.75 / 2)
    assert capsule["dca_physics"] == "CHARACTER"
    assert capsule["dca_step_height"] == units.STEP_HEIGHT == 0.25
    assert capsule["dca_max_slope_deg"] == 45.0
    assert capsule["dca_jump_speed"] == pytest.approx(units.JUMP_SPEED)


def test_every_segment_rides_a_bone(player):
    scene, _ = player
    rig = scene.objects[build_player.RIG]
    parts = segments(scene)
    assert len(parts) == len(body.SEGMENTS)
    for part in parts:
        assert part.parent == rig and part.parent_type == "BONE"
        assert part.parent_bone in rig.data.bones


def test_actions_exist_and_loop(player):
    for name, spec in body.ACTIONS.items():
        act = bpy.data.actions[build_player.ACTION_PREFIX + name]
        assert act.use_fake_user
        assert act["dca_frames"] == spec["frames"]
        assert act.frame_range[1] == spec["frames"]
        assert all(any(m.type == "CYCLES" for m in c.modifiers) for c in act.fcurves)


@pytest.mark.parametrize("frame, leading", [(0, "l"), (12, "r"), (24, "l")])
def test_walk_cycle_alternates_feet(player, frame, leading):
    scene, _ = player
    rig = scene.objects[build_player.RIG]
    rig.animation_data.action = bpy.data.actions[build_player.ACTION_PREFIX + "walk"]
    scene.frame_set(frame)
    feet = {s: bounds([scene.objects[f"player_foot_{s}"]]) for s in "lr"}
    front = {s: feet[s][1].y for s in "lr"}  # the figure faces +y
    trailing = "r" if leading == "l" else "l"
    assert front[leading] > front[trailing] + 0.2
    rig.animation_data.action = bpy.data.actions[build_player.ACTION_PREFIX + "idle"]
    scene.frame_set(0)


def test_stride_rate_matches_speed():
    # one cycle covers STRIDE metres, so at walk speed the cycle repeats speed/stride times a second
    assert units.WALK_SPEED / body.STRIDE["walk"] == pytest.approx(1.875)
    assert units.RUN_SPEED / body.STRIDE["run"] == pytest.approx(2.0)
