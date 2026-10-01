"""B2: the exported street geometry is small enough and loads in bpy at the right place."""

import json
from pathlib import Path

import bpy
import pytest
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
GLB = ROOT / "data" / "london_streets.glb"
STATS = json.loads((ROOT / "data" / "london_streets.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def imported():
    from tools.build_game import reset_scene

    reset_scene()
    assert bpy.ops.import_scene.gltf(filepath=str(GLB)) == {"FINISHED"}
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def test_file_budget():
    assert GLB.stat().st_size == STATS["bytes"]
    assert GLB.stat().st_size <= 15 * 1024 * 1024


def test_object_and_material_counts(imported):
    assert len(imported) == STATS["meshes"]
    used = {m.name for o in imported for m in o.data.materials if m}
    assert len(used) == STATS["materials"]
    assert all(name.startswith("street_m") for name in used)


def test_ground_is_tagged_walkable(imported):
    ground = [o for o in imported if o.get("dca") == "ground"]
    assert len(ground) == 1 and ground[0].get("walkable")


def test_streets_sit_on_the_800m_map_in_blender_axes(imported):
    lo = Vector((1e9, 1e9, 1e9))
    hi = -lo
    for o in imported:
        for corner in o.bound_box:
            w = o.matrix_world @ Vector(corner)
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    # Prototype (x, z) -> Blender (x, -z): x spans 0..800 east, y spans 0..-800 south.
    assert -15 <= lo.x <= 5 and 795 <= hi.x <= 815
    assert -815 <= lo.y <= -795 and -5 <= hi.y <= 15
    assert -2 <= lo.z and hi.z <= 40


def test_colour_comes_from_vertex_colours(imported):
    flat = [o for o in imported if o.get("dca") == "street" and "|none|" in o.get("material", "")]
    assert flat
    assert all(len(o.data.color_attributes) == 1 for o in flat)
