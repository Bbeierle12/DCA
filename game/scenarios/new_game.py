"""Completion goal 4a: a new game spawns the player on a pavement and the HUD shows a real place
name (read back from the HUD's text), with the starting money and energy."""

from game import input as game_input
from game import main


def run(ctx):
    game_input.override = {}
    game_input.camera = None
    yield from ctx.wait_frames(20)
    game = main.instance()
    p = game.player.position
    zone = game.world.zone_at(p.x, p.y)
    ctx.check("spawned on a pavement", zone == "clear_walk", zone)
    london = game.world.london
    names = {j.name for j in london.junctions if j.name} | {d.name for d in london.districts}
    names |= {r.name.split(" (")[0] for r in london.roads}
    text = game.hud.text
    ctx.metric("hud", dict(money=text.money, energy=text.energy, place=text.place, prompt=text.prompt))
    ctx.check("HUD shows a real place name", text.place in names, text.place)
    ctx.check("HUD shows the starting money", text.money == "£100", text.money)
    ctx.check("HUD shows full energy", text.energy == "Energy 100%", text.energy)
    ctx.check("HUD shows the controls at the start", "WASD" in text.prompt, text.prompt)
    ctx.check("HUD is being drawn", game.hud.drawn > 5, game.hud.drawn)
    yield from ctx.screenshot("hud")
