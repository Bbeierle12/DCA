"""The headless Blender (the bpy wheel of UPBGE's Blender line) works and uses metres."""

import json
from pathlib import Path

import bpy

UPBGE = json.loads((Path(__file__).resolve().parents[1] / "tools" / "upbge.json").read_text())


def test_bpy_matches_upbge_base():
    major, minor = (int(v) for v in UPBGE["blender"].split(".")[:2])
    assert bpy.app.version[:2] == (major, minor)


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
