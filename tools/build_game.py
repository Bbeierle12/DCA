"""Builds build/dca.blend: the scene UPBGE plays.

Run inside UPBGE (adds game logic):
    blender -b --factory-startup --python tools/build_game.py -- --out build/dca.blend
Run with plain bpy (tests):
    from tools import build_game; build_game.build(Path(...))

UPBGE-only settings (`object.game`, `scene.game_settings`) are applied only when present, so the
same script runs in the bpy 5.0.1 wheel for fast tests.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parent.parent
PACKAGES = ("dca", "game")


def is_upbge() -> bool:
    return hasattr(bpy.types.Object, "game") or "game" in bpy.types.Object.bl_rna.properties.keys()


def reset_scene() -> bpy.types.Scene:
    """Empties the current scene in place.

    Not read_factory_settings(): inside UPBGE that re-registers the logic-node add-on and
    crashes Blender (EXCEPTION_ACCESS_VIOLATION, seen 2026-10-01).
    """
    scene = bpy.context.scene
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for child in list(scene.collection.children):
        bpy.data.collections.remove(child)
    for datablocks in (bpy.data.meshes, bpy.data.lights, bpy.data.cameras, bpy.data.materials):
        for block in list(datablocks):
            datablocks.remove(block)
    scene.name = "London"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    return scene


def add_ground(scene: bpy.types.Scene, size: float = 100.0) -> bpy.types.Object:
    half = size / 2
    mesh = bpy.data.meshes.new("Ground")
    corners = [(-half, -half, 0), (half, -half, 0), (half, half, 0), (-half, half, 0)]
    mesh.from_pydata(corners, [], [(0, 1, 2, 3)])
    obj = bpy.data.objects.new("Ground", mesh)
    scene.collection.objects.link(obj)
    return obj


def add_sun_and_camera(scene: bpy.types.Scene) -> None:
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.rotation_euler = (0.8, 0.2, 0.6)
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    cam.location = (0.0, -12.0, 6.0)
    cam.rotation_euler = (1.1, 0.0, 0.0)
    scene.collection.objects.link(cam)
    scene.camera = cam


TEMPLATE = Path(__file__).resolve().parent / "templates" / "game_driver.blend"


def add_game_driver(scene: bpy.types.Scene) -> bpy.types.Object:
    """Appends the Game empty whose Always sensor runs game.boot.tick every frame.

    The logic bricks come from a template because UPBGE 0.50 crashes when logic operators run in
    background mode (see tools/make_driver_template.py).
    """
    with bpy.data.libraries.load(str(TEMPLATE), link=False) as (src, dst):
        dst.objects = ["Game"]
    driver = dst.objects[0]
    scene.collection.objects.link(driver)
    return driver


def configure_engine(scene: bpy.types.Scene) -> None:
    if not hasattr(scene, "game_settings"):
        return
    gs = scene.game_settings
    gs.resolution_x, gs.resolution_y = 1920, 1080
    # Uncapped so the harness measures what the PC can actually do; play builds may cap later.
    gs.use_frame_rate = False
    gs.vsync = "OFF"
    gs.exit_key = "ESC"


def copy_packages(out_dir: Path) -> None:
    """The player finds modules next to the .blend, so ship the Python packages with it."""
    for name in PACKAGES:
        dest = out_dir / name
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(ROOT / name, dest, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))


def build(out: Path) -> Path:
    out = out.resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    scene = reset_scene()
    add_ground(scene)
    add_sun_and_camera(scene)
    add_game_driver(scene)
    configure_engine(scene)
    bpy.ops.wm.save_as_mainfile(filepath=str(out), check_existing=False)
    copy_packages(out.parent)
    return out


def main(argv: list[str]) -> None:
    args = argv[argv.index("--") + 1 :] if "--" in argv else []
    out = Path(args[args.index("--out") + 1]) if "--out" in args else ROOT / "build" / "dca.blend"
    path = build(out)
    print(f"DCA_BUILD_OK {path} upbge={is_upbge()}")


if __name__ == "__main__":
    main(sys.argv)
