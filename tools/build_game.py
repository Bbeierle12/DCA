"""Builds build/dca.blend: the scene UPBGE plays.

Run inside UPBGE (adds game logic):
    blender -b --factory-startup --python tools/build_game.py -- --out build/dca.blend
Run with plain bpy (tests):
    from tools import build_game; build_game.build(Path(...))

UPBGE-only settings (`object.game`, `scene.game_settings`) are applied only when present, so the
same script runs in the bpy 3.6.0 wheel for fast tests.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:  # UPBGE runs this file directly
    sys.path.insert(0, str(ROOT))

from mathutils import Vector  # noqa: E402

from dca.units import from_prototype  # noqa: E402
from dca.world import World  # noqa: E402
from tools.build_player import build_player  # noqa: E402
from tools.build_world import build_world  # noqa: E402

PACKAGES = ("dca", "game")
DATA_FILES = ("london.json", "zones.json")  # runtime map data; probes.json is for tests only


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
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)
    blocks = (bpy.data.meshes, bpy.data.lights, bpy.data.cameras, bpy.data.materials, bpy.data.images,
              bpy.data.armatures, bpy.data.actions)
    for datablocks in blocks:
        for block in list(datablocks):
            datablocks.remove(block)
    scene.name = "London"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    return scene


def ground_z(scene: bpy.types.Scene, x: float, y: float, top: float = 3.0) -> float:
    """Height of the first surface below (x, y, top) in the built scene (0 if nothing)."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    hit, location, *_ = scene.ray_cast(depsgraph, Vector((x, y, top)), Vector((0.0, 0.0, -1.0)))
    return location.z if hit else 0.0


def add_player(scene: bpy.types.Scene) -> bpy.types.Object:
    """The player stands on the spawn pavement (dca.world), feet on the surface found there."""
    x, y = World().spawn_point()
    return build_player(scene, location=(x, y, ground_z(scene, x, y)))


def add_sun_and_camera(scene: bpy.types.Scene) -> None:
    light = bpy.data.lights.new("Sun", "SUN")
    light.energy = 3.0
    sun = bpy.data.objects.new("Sun", light)
    sun.rotation_euler = (0.8, 0.2, 0.6)
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    # Behind the spawn pavement (prototype (450, 272)) looking north up Regent Street's side.
    x, y = from_prototype(450.0, 272.0)
    cam.location = (x, y - 14.0, 6.0)
    cam.rotation_euler = (1.25, 0.0, 0.0)
    cam.data.clip_end = 1000.0
    scene.collection.objects.link(cam)
    scene.camera = cam


def template_for(version: tuple) -> Path:
    """Driver template saved by the matching Blender line (a 5.0 file does not open in 3.6)."""
    name = "game_driver.blend" if tuple(version) >= (4, 0, 0) else "game_driver_b3.blend"
    return Path(__file__).resolve().parent / "templates" / name


TEMPLATE = template_for(bpy.app.version)


def add_game_driver(scene: bpy.types.Scene) -> bpy.types.Object:
    """Appends the Game empty whose Always sensor runs game.boot.tick every frame.

    The logic bricks come from a template because logic operators crash UPBGE in background mode
    (seen with 0.50 on 2026-10-01; see tools/make_driver_template.py).
    """
    with bpy.data.libraries.load(str(TEMPLATE), link=False) as (src, dst):
        dst.objects = ["Game"]
    driver = dst.objects[0]
    scene.collection.objects.link(driver)
    return driver


# D11/B5, measured on Brandon's PC (UPBGE 0.36.1, 1280x720, camera turning): soft shadows off,
# 512 px sun cascades and one TAA sample cut the median frame from 9.3 to 6.5 ms; a 90 fps cap
# leaves the iGPU headroom and gives fewer 22+ ms hitches than running uncapped.
EEVEE = {"use_soft_shadows": False, "shadow_cascade_size": "512", "taa_samples": 1}
FRAME_CAP = 90


def configure_render(scene: bpy.types.Scene) -> None:
    """Legacy EEVEE settings (Blender 3.x names; skipped where a setting does not exist).

    Actions play at the scene frame rate; dca.body.ACTION_FPS assumes 24.
    """
    scene.render.fps = 24
    for key, value in EEVEE.items():
        if hasattr(scene.eevee, key):
            setattr(scene.eevee, key, value)


def configure_engine(scene: bpy.types.Scene) -> None:
    if not hasattr(scene, "game_settings"):
        return
    gs = scene.game_settings
    gs.resolution_x, gs.resolution_y = 1280, 720
    gs.use_frame_rate = True
    gs.fps = FRAME_CAP  # also the logic and physics tic rate
    gs.physics_step_sub = 1  # one physics step per tic: dca.movement.per_step relies on it
    gs.vsync = "OFF"
    gs.exit_key = "ESC"


def copy_packages(out_dir: Path) -> None:
    """The player finds modules next to the .blend, so ship the packages and map data with it."""
    for name in PACKAGES:
        dest = out_dir / name
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(ROOT / name, dest, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    data_out = out_dir / "data"
    data_out.mkdir(exist_ok=True)
    for name in DATA_FILES:
        shutil.copy2(ROOT / "data" / name, data_out / name)


def build(out: Path) -> Path:
    out = out.resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    scene = reset_scene()
    build_world(scene)
    add_player(scene)
    add_sun_and_camera(scene)
    add_game_driver(scene)
    configure_render(scene)
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
