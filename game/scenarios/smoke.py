"""Smoke: the game loads and renders 120 frames; reports frame stats."""


def run(ctx):
    yield from ctx.wait_frames(120)
    ctx.check("rendered at least 120 frames", ctx.frame >= 120)
    ctx.metric("objects", len(ctx.scene.objects))
