"""B4: place names, pavement spawn and zone lookup match the prototype."""

import json
import math

import pytest

from dca.world import World, data
from dca.world.places import PlaceNamer, place_name_at, street_name
from dca.world.spawn import find_nearest_zone_point

PROBES = json.loads((data.data_dir() / "probes.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def london():
    return data.load_london()


@pytest.fixture(scope="module")
def zones():
    return data.load_zones()


# ---- the prototype's own test cases (web/tests/unit/Places.test.ts, Spawn.test.ts)


def test_names_the_big_junctions(london):
    assert place_name_at(london, 430, 260) == "Oxford Circus"
    assert place_name_at(london, 430, 390) == "Piccadilly Circus"
    assert place_name_at(london, 530, 490) == "Trafalgar Square"
    assert place_name_at(london, 240, 400) == "Hyde Park Corner"
    assert place_name_at(london, 240, 260) == "Marble Arch"


def test_names_the_street_without_direction_suffixes(london):
    assert place_name_at(london, 600, 262) == "Oxford Street"
    assert place_name_at(london, 430, 160) == "Regent Street"
    assert place_name_at(london, 240, 180) == "Park Lane"


def test_falls_back_to_districts(london):
    assert place_name_at(london, 100, 200) == "Hyde Park"
    assert place_name_at(london, 285, 330) == "Mayfair"
    assert place_name_at(london, 470, 330) == "Soho"
    assert place_name_at(london, 780, 780) == "Westminster"


def test_strips_bracketed_suffixes():
    assert street_name("Oxford Street (West)") == "Oxford Street"
    assert street_name("Piccadilly") == "Piccadilly"


def test_namer_caches_while_barely_moving(london):
    namer = PlaceNamer(london)
    assert namer.at(430, 260) == "Oxford Circus"
    assert namer.at(430.5, 260.5) == "Oxford Circus"
    assert namer.at(100, 200) == "Hyde Park"


class Stripe:
    """Pavement only in the band 10 <= z < 12."""

    def zone_at(self, x, z):
        return "clear_walk" if 10 <= z < 12 else "carriageway"


def test_spawn_returns_start_when_it_matches():
    assert find_nearest_zone_point(Stripe(), 3, 11, "clear_walk") == (3, 11)


def test_spawn_finds_nearest_matching_cell_centre():
    x, z = find_nearest_zone_point(Stripe(), 3, 5, "clear_walk")
    assert Stripe().zone_at(x, z) == "clear_walk"
    assert math.hypot(x - 3, z - 5) < 8


def test_spawn_gives_up_beyond_radius():
    assert find_nearest_zone_point(Stripe(), 3, 200, "clear_walk", 20) is None


def test_london_spawn_is_a_pavement_near_oxford_circus(london, zones):
    x, z = find_nearest_zone_point(zones, *london.spawn_target, "clear_walk")
    assert zones.zone_at(x, z) == "clear_walk"
    assert math.hypot(x - 430, z - 260) < 60


# ---- parity with the TypeScript answers exported to data/probes.json


def test_every_probe_place_name_matches(london):
    fields = PROBES["pointFields"]
    wrong = []
    for raw in PROBES["points"]:
        p = dict(zip(fields, raw, strict=True))
        got = place_name_at(london, p["x"], p["z"])
        if got != p["place"]:
            wrong.append((p["x"], p["z"], p["place"], got))
    assert len(PROBES["points"]) > 2000
    assert wrong == []


def test_every_probe_spawn_matches(zones):
    assert len(PROBES["spawns"]) >= 9
    for s in PROBES["spawns"]:
        got = find_nearest_zone_point(zones, s["x"], s["z"], s["type"])
        want = s["result"]
        if want is None:  # e.g. deep in Hyde Park: no pavement within 80 m
            assert got is None, s
        else:
            assert got == pytest.approx((want["x"], want["z"]), abs=1e-9), s
    assert sum(s["result"] is not None for s in PROBES["spawns"]) >= 7


# ---- the Blender-facing API


def test_world_speaks_blender_coordinates():
    world = World()
    assert world.place_at(430, -260) == "Oxford Circus"
    assert world.zone_at(430, -260) == data.zones().zone_at(430, 260)
    x, y = world.spawn_point()
    assert y < 0  # south of the map's north edge, in Blender axes
    assert world.zone_at(x, y) == "clear_walk"
    assert world.place_at(x, y) in {"Oxford Circus", "Oxford Street", "Regent Street"}
