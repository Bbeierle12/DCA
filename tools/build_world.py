"""Builds London into the current scene from `data/london_streets.glb` (B3).

Called by `tools/build_game.py`. Works in plain bpy 5.0.1 for tests; UPBGE-only physics settings
are applied only when `object.game` exists. Each object also records its role in custom
properties (`dca_kind`, `dca_physics`) so tests can check intent without UPBGE.

Kinds:
  ground   the 800 m grass plane (static, walkable)
  surface  roads, pavements and kerbs: everything whose top is below SURFACE_TOP (static)
  prop     lamp posts, benches, trees, phone boxes ... (static)
  decor    glowing lenses, unlit lamp heads, translucent paint and glass (no collision)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
STREETS_GLB = ROOT / "data" / "london_streets.glb"
SURFACE_TOP = 0.4  # metres; kerbs are 0.3 m in the prototype data
SKY = (0.53, 0.81, 0.92)  # prototype COLORS.SKY #87ceeb (sRGB, close enough as linear for now)
COLLECTIONS = {"ground": "Ground", "surface": "Surfaces", "prop": "Props", "decor": "Decor"}
PHYSICS = {"ground": "STATIC", "surface": "STATIC", "prop": "STATIC", "decor": "NO_COLLISION"}


@dataclass
class WorldStats:
    objects: int = 0
    faces: int = 0
    materials: int = 0
    kinds: dict = field(default_factory=dict)
    lo: tuple = (0.0, 0.0, 0.0)
    hi: tuple = (0.0, 0.0, 0.0)


def world_bounds(objects) -> tuple[Vector, Vector]:
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for obj in objects:
        for corner in obj.bound_box:
            w = obj.matrix_world @ Vector(corner)
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    return lo, hi


def import_streets(glb: Path = STREETS_GLB) -> list[bpy.types.Object]:
    before = set(bpy.data.objects)
    result = bpy.ops.import_scene.gltf(filepath=str(glb))
    if result != {"FINISHED"}:
        raise RuntimeError(f"glTF import failed: {result}")
    return [o for o in bpy.data.objects if o not in before and o.type == "MESH"]


def classify(obj: bpy.types.Object) -> str:
    if obj.get("dca") == "ground":
        return "ground"
    mat = obj.data.materials[0] if obj.data.materials else None
    name = mat.name if mat else ""
    if any(tag in name for tag in ("_glow", "_unlit", "_alpha")):
        return "decor"
    _, hi = world_bounds([obj])
    return "surface" if hi.z <= SURFACE_TOP else "prop"


def collection(scene: bpy.types.Scene, name: str, parent: bpy.types.Collection) -> bpy.types.Collection:
    coll = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if coll.name not in parent.children:
        parent.children.link(coll)
    return coll


def apply_physics(obj: bpy.types.Object, kind: str) -> None:
    obj["dca_kind"] = kind
    obj["dca_physics"] = PHYSICS[kind]
    game = getattr(obj, "game", None)
    if game is None:
        return
    game.physics_type = PHYSICS[kind]
    if PHYSICS[kind] == "STATIC":
        game.use_collision_bounds = False  # exact triangle mesh, so kerbs and steps are real


def tune_material(mat: bpy.types.Material) -> None:
    """Matte street look: no specular sheen on roads and paving."""
    if not mat.node_tree:
        return
    for node in mat.node_tree.nodes:
        if node.bl_idname == "ShaderNodeBsdfPrincipled":
            node.inputs["Metallic"].default_value = 0.0
            node.inputs["Roughness"].default_value = 1.0
            # "Specular IOR Level" since Blender 4.0, "Specular" before (UPBGE 0.36 is 3.6).
            spec = node.inputs.get("Specular IOR Level") or node.inputs.get("Specular")
            if spec is not None:
                spec.default_value = 0.2


def material_problems(mat: bpy.types.Material) -> list[str]:
    """Empty when the material renders in EEVEE: nodes, a linked output, textures with data."""
    problems = []
    if not mat.node_tree:
        return [f"{mat.name}: no node tree"]
    outputs = [n for n in mat.node_tree.nodes if n.bl_idname == "ShaderNodeOutputMaterial"]
    if not any(n.inputs["Surface"].is_linked for n in outputs):
        problems.append(f"{mat.name}: output surface not linked")
    for node in mat.node_tree.nodes:
        if node.bl_idname == "ShaderNodeTexImage":
            img = node.image
            if img is None:
                problems.append(f"{mat.name}: image node without image")
            elif img.packed_file is None and not Path(bpy.path.abspath(img.filepath)).exists():
                problems.append(f"{mat.name}: image {img.name} is neither packed nor on disk")
            elif not img.has_data and img.size[0] == 0:
                problems.append(f"{mat.name}: image {img.name} has no pixels")
    return problems


def add_sky(scene: bpy.types.Scene) -> None:
    world = bpy.data.worlds.get("Sky") or bpy.data.worlds.new("Sky")
    if world.node_tree is None:
        world.use_nodes = True  # older bpy; Blender 5 worlds always have nodes
    bg = next(n for n in world.node_tree.nodes if n.bl_idname == "ShaderNodeBackground")
    bg.inputs["Color"].default_value = (*SKY, 1.0)
    bg.inputs["Strength"].default_value = 1.0
    scene.world = world


def build_world(scene: bpy.types.Scene, glb: Path = STREETS_GLB) -> WorldStats:
    objects = import_streets(glb)
    root = collection(scene, "World", scene.collection)
    stats = WorldStats(objects=len(objects))
    for obj in objects:
        kind = classify(obj)
        stats.kinds[kind] = stats.kinds.get(kind, 0) + 1
        target = collection(scene, COLLECTIONS[kind], root)
        for coll in list(obj.users_collection):
            coll.objects.unlink(obj)
        target.objects.link(obj)
        apply_physics(obj, kind)
        stats.faces += len(obj.data.polygons)
        if kind == "ground":
            obj.name = "Ground"
    materials = {m for o in objects for m in o.data.materials if m}
    for mat in materials:
        tune_material(mat)
    stats.materials = len(materials)
    lo, hi = world_bounds(objects)
    stats.lo, stats.hi = tuple(lo), tuple(hi)
    add_sky(scene)
    return stats
