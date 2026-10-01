"""The game build script works in plain bpy 5.0.1 (UPBGE's base) and produces a loadable file."""

from pathlib import Path

import bpy

from tools import build_game


def test_build_writes_blend_and_ships_packages(tmp_path: Path):
    out = build_game.build(tmp_path / "dca.blend")
    assert out.exists()
    assert (tmp_path / "dca" / "units.py").exists()
    assert (tmp_path / "game" / "boot.py").exists()
    assert (tmp_path / "data" / "london.json").exists()
    assert (tmp_path / "data" / "zones.json").exists()
    assert not list(tmp_path.rglob("__pycache__"))

    bpy.ops.wm.open_mainfile(filepath=str(out))
    scene = bpy.context.scene
    assert scene.unit_settings.system == "METRIC"
    assert {"Ground", "Sun", "Camera", "Game"} <= set(scene.objects.keys())
    assert scene.camera.name == "Camera"
    assert round(scene.objects["Ground"].dimensions.x) == 800


def test_build_replaces_whatever_was_in_the_scene(tmp_path: Path):
    bpy.ops.wm.read_factory_settings(use_empty=False)  # default cube, camera, light
    assert "Cube" in bpy.data.objects
    build_game.build(tmp_path / "dca.blend")
    assert "Cube" not in bpy.context.scene.objects


def test_driver_comes_from_the_template():
    assert build_game.TEMPLATE.exists()
    assert build_game.TEMPLATE.stat().st_size > 10_000


def test_template_follows_the_blender_line():
    assert build_game.template_for((5, 0, 1)).name == "game_driver.blend"
    assert build_game.template_for((3, 6, 2)).name == "game_driver_b3.blend"
