"""B3: London built into the scene from the exported streets: extent, budget, materials, physics."""

from pathlib import Path

import bpy
import pytest
from mathutils import Vector

from dca.units import from_prototype
from tools import build_game, build_world

MAX_OBJECTS = 200  # world mesh objects; chunked batches keep draw calls low
MAX_FACES = 250_000


@pytest.fixture(scope="module")
def world():
    scene = build_game.reset_scene()
    stats = build_world.build_world(scene)
    meshes = [o for o in scene.objects if o.type == "MESH"]
    return scene, stats, meshes


def test_800m_extent(world):
    scene, stats, _ = world
    g_lo, g_hi = build_world.world_bounds([scene.objects["Ground"]])
    assert (round(g_hi.x - g_lo.x), round(g_hi.y - g_lo.y)) == (800, 800)
    lo, hi = Vector(stats.lo), Vector(stats.hi)
    assert -15 <= lo.x and hi.x <= 815 and -815 <= lo.y and hi.y <= 15
    assert hi.x - lo.x >= 800 and hi.y - lo.y >= 800


def test_object_budget(world):
    _, stats, meshes = world
    assert len(meshes) == stats.objects <= MAX_OBJECTS
    assert stats.faces <= MAX_FACES


def test_every_material_is_valid(world):
    _, _, meshes = world
    materials = {m for o in meshes for m in o.data.materials}
    assert None not in materials and len(materials) >= 20
    problems = [p for m in materials for p in build_world.material_problems(m)]
    assert problems == []


def test_objects_sorted_into_collections(world):
    scene, stats, meshes = world
    root = bpy.data.collections["World"]
    assert root.name in scene.collection.children
    assert {c.name for c in root.children} == set(build_world.COLLECTIONS.values())
    assert stats.kinds["ground"] == 1
    assert min(stats.kinds["surface"], stats.kinds["prop"], stats.kinds["decor"]) > 0
    for obj in meshes:
        assert obj.users_collection[0].name == build_world.COLLECTIONS[obj["dca_kind"]]


def test_walkable_surfaces_are_static_and_decor_is_not_solid(world):
    _, _, meshes = world
    for obj in meshes:
        kind = obj["dca_kind"]
        want = "NO_COLLISION" if kind == "decor" else "STATIC"
        assert obj["dca_physics"] == want, obj.name
        if kind == "surface":
            assert build_world.world_bounds([obj])[1].z <= build_world.SURFACE_TOP


@pytest.mark.parametrize("spot", [(450, 272), (430, 260), (430, 390), (530, 490), (600, 262)])
def test_something_solid_underfoot_at_key_spots(world, spot):
    scene, _, _ = world
    x, y = from_prototype(*spot)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    hit, location, _, _, obj, _ = scene.ray_cast(depsgraph, Vector((x, y, 1.0)), Vector((0, 0, -1)))
    assert hit, spot
    assert obj.get("dca_physics") == "STATIC", obj.name
    assert -0.2 <= location.z <= 0.35


def test_sky_is_set(world):
    scene, _, _ = world
    assert scene.world and scene.world.name == "Sky"


def test_saved_game_keeps_textures_packed(tmp_path: Path):
    out = build_game.build(tmp_path / "dca.blend")
    bpy.ops.wm.open_mainfile(filepath=str(out))
    images = [i for i in bpy.data.images if i.source == "FILE"]
    assert len(images) >= 10
    assert all(i.packed_file is not None for i in images)
