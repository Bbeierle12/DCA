"""Builds the player (C1): a 1.75 m low-poly figure on an armature, carried by a capsule.

    Player       capsule-sized box (0.5 x 0.5 x 1.75 m), origin at its centre. UPBGE character
                 physics (capsule bounds, 0.25 m step, 45 deg slope); hidden at run time.
      PlayerRig  armature, feet at the capsule's bottom; idle / walk / run actions.
        segments box meshes, each parented to one bone (rigid, no skinning).

Body plan and cycles live in dca/body.py. Runs in plain bpy 3.6 for tests; UPBGE-only settings
(`object.game`) are applied when present and mirrored into custom properties.
"""

from __future__ import annotations

import math

import bpy
from mathutils import Matrix, Vector

from dca import body, units

PLAYER = "Player"
RIG = "PlayerRig"
COLLECTION = "Player"
ACTION_PREFIX = "player_"


def _material(name: str, rgb) -> bpy.types.Material:
    mat = bpy.data.materials.get(f"player_{name}") or bpy.data.materials.new(f"player_{name}")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.8
    mat.diffuse_color = (*rgb, 1.0)
    return mat


def _box(name: str, lo, hi) -> bpy.types.Mesh:
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    verts = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
             (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    return mesh


def _build_rig(coll: bpy.types.Collection) -> bpy.types.Object:
    arm = bpy.data.armatures.new(RIG)
    rig = bpy.data.objects.new(RIG, arm)
    coll.objects.link(rig)
    view_layer = bpy.context.view_layer
    view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for spec in body.BONES:
        eb = arm.edit_bones.new(spec.name)
        eb.head, eb.tail, eb.roll = Vector(spec.head), Vector(spec.tail), 0.0
        if spec.parent:
            eb.parent = arm.edit_bones[spec.parent]
            eb.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in rig.pose.bones:
        pb.rotation_mode = "XYZ"
    return rig


def _bone_parent_rest(rig: bpy.types.Object, bone_name: str) -> Matrix:
    """World matrix a bone-parented child is relative to: the bone's tail, at rest."""
    bone = rig.data.bones[bone_name]
    return rig.matrix_world @ bone.matrix_local @ Matrix.Translation((0.0, bone.length, 0.0))


def _build_segments(rig: bpy.types.Object, coll: bpy.types.Collection) -> list[bpy.types.Object]:
    mats = {name: _material(name, rgb) for name, rgb in body.MATERIALS.items()}
    parts = []
    for seg in body.SEGMENTS:
        mesh = _box(f"player_{seg.name}", seg.lo, seg.hi)
        mesh.materials.append(mats[seg.material])
        obj = bpy.data.objects.new(f"player_{seg.name}", mesh)
        coll.objects.link(obj)
        obj.parent = rig
        obj.parent_type = "BONE"
        obj.parent_bone = seg.bone
        obj.matrix_parent_inverse = _bone_parent_rest(rig, seg.bone).inverted()
        obj["dca_kind"] = "player"
        parts.append(obj)
    return parts


def forward_sign(rig: bpy.types.Object, bone_name: str) -> float:
    """+1 if a positive X rotation swings this bone's tail toward +y (the figure's front).

    Rotating the bone's Y axis about its X axis by +theta moves the tail along the bone's Z axis.
    """
    z_axis = rig.data.bones[bone_name].matrix_local.col[2].xyz
    return 1.0 if z_axis.y > 0 else -1.0


def _key(action, rig, bone, frame, degrees):
    path = f'pose.bones["{bone}"].rotation_euler'
    curve = action.fcurves.find(path, index=0) or action.fcurves.new(path, index=0, action_group=bone)
    value = math.radians(degrees) * forward_sign(rig, bone)
    curve.keyframe_points.insert(frame, value, options={"FAST"})


def _build_actions(rig: bpy.types.Object) -> dict[str, bpy.types.Action]:
    """Procedural cycles from dca.body.ACTIONS; positive angles swing forward (+y)."""
    actions = {}
    for name, a in body.ACTIONS.items():
        act = bpy.data.actions.get(ACTION_PREFIX + name) or bpy.data.actions.new(ACTION_PREFIX + name)
        act.use_fake_user = True  # UPBGE plays actions by name; keep them in the file
        n = a["frames"]
        if name == "idle":  # breathing and a slight arm sway
            for f, k in ((0, 0.0), (n // 2, 1.0), (n, 0.0)):
                _key(act, rig, "spine", f, a["lean"] * k)
                for side in "LR":
                    _key(act, rig, f"upper_arm.{side}", f, -a["arm"] * k)
                    _key(act, rig, f"forearm.{side}", f, a["forearm"])
                    _key(act, rig, f"thigh.{side}", f, 0.0)
                    _key(act, rig, f"shin.{side}", f, 0.0)
        else:  # stride: frame 0 left leg forward, n/2 right leg forward
            q = n // 4
            for f in range(0, n + 1, q):
                phase = math.cos(2 * math.pi * f / n)  # +1 at 0, -1 at n/2
                _key(act, rig, "thigh.L", f, a["thigh"] * phase)
                _key(act, rig, "thigh.R", f, -a["thigh"] * phase)
                _key(act, rig, "upper_arm.L", f, -a["arm"] * phase)
                _key(act, rig, "upper_arm.R", f, a["arm"] * phase)
                # knees bend most while the leg passes under the body (swing phase)
                left_swing = max(0.0, math.sin(2 * math.pi * f / n + math.pi))
                right_swing = max(0.0, math.sin(2 * math.pi * f / n))
                _key(act, rig, "shin.L", f, -a["shin"] * left_swing - 5)
                _key(act, rig, "shin.R", f, -a["shin"] * right_swing - 5)
                _key(act, rig, "forearm.L", f, a["forearm"])
                _key(act, rig, "forearm.R", f, a["forearm"])
                _key(act, rig, "spine", f, a["lean"])
        for curve in act.fcurves:
            curve.update()
            for mod in list(curve.modifiers):
                curve.modifiers.remove(mod)
            curve.modifiers.new("CYCLES")
        act["dca_frames"] = n
        actions[name] = act
    rig.animation_data_create()
    rig.animation_data.action = actions["idle"]
    return actions


def _capsule(coll: bpy.types.Collection) -> bpy.types.Object:
    r, h = body.CAPSULE_RADIUS, body.HEIGHT
    mesh = _box(PLAYER, (-r, -r, -h / 2), (r, r, h / 2))
    player = bpy.data.objects.new(PLAYER, mesh)
    coll.objects.link(player)
    player.display_type = "WIRE"
    player["dca_kind"] = "player"
    player["dca_physics"] = "CHARACTER"
    player["dca_step_height"] = units.STEP_HEIGHT
    player["dca_max_slope_deg"] = units.MAX_SLOPE_DEG
    player["dca_jump_speed"] = units.JUMP_SPEED
    game = getattr(player, "game", None)
    if game is not None:  # UPBGE: character controller on a capsule of exactly the box's size
        game.physics_type = "CHARACTER"
        game.use_collision_bounds = True
        game.collision_bounds_type = "CAPSULE"
        game.step_height = units.STEP_HEIGHT
        game.jump_speed = units.JUMP_SPEED
        if hasattr(game, "max_slope"):
            game.max_slope = math.radians(units.MAX_SLOPE_DEG)
    return player


def _no_collision(obj: bpy.types.Object) -> None:
    game = getattr(obj, "game", None)
    if game is not None:
        game.physics_type = "NO_COLLISION"


def build_player(scene: bpy.types.Scene, location=(0.0, 0.0, 0.0)) -> bpy.types.Object:
    """Adds the player with its feet at `location` (x, y, ground z). Returns the capsule."""
    coll = bpy.data.collections.get(COLLECTION) or bpy.data.collections.new(COLLECTION)
    if coll.name not in scene.collection.children:
        scene.collection.children.link(coll)
    rig = _build_rig(coll)
    parts = _build_segments(rig, coll)
    _build_actions(rig)
    player = _capsule(coll)
    rig.parent = player
    rig.matrix_parent_inverse = Matrix.Identity(4)
    rig.location = (0.0, 0.0, -body.HEIGHT / 2)  # feet at the capsule's bottom
    for obj in (rig, *parts):
        _no_collision(obj)
    x, y, z = location
    player.location = (x, y, z + body.HEIGHT / 2)
    return player
