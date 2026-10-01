"""The headless Blender (bpy 5.0.1, same base as UPBGE 0.50) works and uses metres."""

import bpy


def test_bpy_matches_upbge_base():
    assert bpy.app.version[:2] == (5, 0)


def test_metric_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    assert scene.unit_settings.system == "METRIC"
    assert scene.unit_settings.scale_length == 1.0
    mesh = bpy.data.meshes.new("cube")
    obj = bpy.data.objects.new("cube", mesh)
    scene.collection.objects.link(obj)
    obj.dimensions  # noqa: B018 - touching dimensions must not raise on an empty mesh
    assert obj.name in scene.objects
