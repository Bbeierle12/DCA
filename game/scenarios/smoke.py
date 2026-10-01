"""Smoke: the game loads, warms up, then renders a measured stretch of frames."""


def run(ctx):
    yield from ctx.wait_frames(60)  # warm-up: shader compilation happens here
    yield from ctx.measure(frames=120)
    ctx.check("rendered 180 frames", ctx.frame >= 180, ctx.frame)
    ctx.check("measured 120 frames", len(ctx.frame_times) >= 119, len(ctx.frame_times))
    ctx.metric("objects", len(ctx.scene.objects))
    ctx.check("our camera is active", ctx.scene.active_camera.name == "Camera", ctx.scene.active_camera.name)
