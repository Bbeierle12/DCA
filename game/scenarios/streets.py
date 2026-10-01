"""B5: the London streets load, are solid underfoot, and hold goal 3 at the key spots.

At each spot (the spawn and the pavements nearest Oxford Circus, Piccadilly Circus and Trafalgar
Square) the camera stands 2.5 m over the ground and turns a full circle over 10 s while frame
times are recorded.
"""

from collections import Counter

from mathutils import Euler

from dca import perf, units
from dca.world import World
from game import main


def kind_of(obj):
    blender = getattr(obj, "blenderObject", None)
    return blender.get("dca_kind") if blender is not None else None


def run(ctx):
    scene = ctx.scene
    yield from ctx.wait_frames(30)

    kinds = Counter(k for k in (kind_of(o) for o in scene.objects) if k)
    ctx.metric("world_kinds", dict(kinds))
    ctx.check("world loaded (>= 140 objects)", sum(kinds.values()) >= 140, dict(kinds))

    world = World()
    spawn = world.spawn_point()
    ctx.check("spawn is on a pavement", world.zone_at(*spawn) == "clear_walk", [round(v, 1) for v in spawn])
    ctx.metric("spawn_place", world.place_at(*spawn))

    cam = scene.active_camera
    ctx.check("measuring through the scene camera", cam.name == "Camera", cam.name)
    if main.instance() is not None:
        main.instance().camera_follow = False  # this scenario drives the camera itself
    probe = scene.objects["Game"]
    for label, x, y in perf.key_spots(world):
        hit, point, _ = probe.rayCast((x, y, -5.0), (x, y, 3.0), 0, "", 0, 0, 0, units.WORLD_MASK)
        detail = [kind_of(hit), hit.name, round(point[2], 2)] if hit is not None else None
        # Something solid at standing height (pavement top is 0.26-0.31 m; a low kerbside prop is
        # fine to stand on). Decor has no collision, so the ray never hits it.
        standable = hit is not None and -0.2 <= point[2] <= 0.5
        ctx.check(f"{label}: solid ground at standing height", standable, detail)
        ground_z = point[2] if hit is not None else 0.0

        def turn(t, x=x, y=y, ground_z=ground_z):
            location, rotation = perf.spin_pose(x, y, ground_z, t)
            cam.worldPosition = location
            cam.worldOrientation = Euler(rotation).to_matrix()

        turn(0.0)
        yield from ctx.wait_frames(20)
        yield from ctx.screenshot(label)  # what the measured view looks like
        yield from ctx.measure(seconds=perf.SPOT_SECONDS, label=label, each_frame=turn)
        stats = ctx.metrics[label]
        ctx.check(f"{label}: avg >= {perf.GOAL_AVG_FPS:.0f}, 1%-low >= {perf.GOAL_LOW1_FPS:.0f} fps",
                  perf.meets_goal(stats), f"avg {stats['avg_fps']}, 1%-low {stats['low1_fps']}")
