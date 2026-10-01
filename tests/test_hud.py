from dca import hud
from dca.state import STARTING_ENERGY, STARTING_MONEY, GameState
from dca.world import World, data


def test_money_and_energy_text():
    assert hud.money_text(100) == "£100"
    assert hud.money_text(1250000) == "£1,250,000"
    assert hud.money_text(-5) == "-£5"
    assert hud.energy_text(99.6) == "Energy 100%"
    assert hud.energy_text(-3) == "Energy 0%"


def test_new_game_hud():
    state = GameState()
    assert (state.money, state.energy) == (STARTING_MONEY, STARTING_ENERGY) == (100, 100.0)
    text = hud.hud_text(state, "Oxford Circus", hud.prompt_for(0.0))
    assert text.money == "£100" and text.energy == "Energy 100%"
    assert text.place == "Oxford Circus" and "WASD" in text.prompt


def test_prompt_rules():
    assert hud.prompt_for(hud.HINT_SECONDS + 1) == ""
    assert hud.prompt_for(1.0, "E: buy food (£5)") == "E: buy food (£5)"


def test_spawn_place_is_a_real_name():
    london = data.london()
    names = {j.name for j in london.junctions if j.name} | {d.name for d in london.districts}
    names |= {r.name.split(" (")[0] for r in london.roads}
    world = World()
    assert world.place_at(*world.spawn_point()) in names
