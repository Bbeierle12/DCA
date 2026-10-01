"""B1: the exported map data loads and round-trips the counts the exporter wrote."""

import json

import pytest

from dca.world import data

ROAD_TYPES = {"boulevard", "main", "secondary", "lane"}


@pytest.fixture(scope="module")
def london():
    return data.load_london()


@pytest.fixture(scope="module")
def zones():
    return data.load_zones()


def test_counts_round_trip(london):
    assert len(london.roads) == london.counts["roads"] == 18
    assert len(london.junctions) == london.counts["intersections"] == 8
    assert sum(1 for j in london.junctions if j.name) == london.counts["namedIntersections"]
    assert len(london.districts) == london.counts["districts"]
    assert sum(len(r.path) for r in london.roads) == london.counts["roadPoints"]


def test_roads_are_well_formed(london):
    ids = [r.id for r in london.roads]
    assert len(ids) == len(set(ids))
    for road in london.roads:
        assert road.type in ROAD_TYPES
        assert len(road.path) >= 2
        assert road.carriageway_width == pytest.approx(sum(w for _, _, w in road.lanes))
        for x, z in road.path:
            assert 0 <= x <= london.width and 0 <= z <= london.height


def test_junctions_reference_real_roads(london):
    ids = {r.id for r in london.roads}
    for j in london.junctions:
        assert set(j.road_ids) <= ids, j.id
    names = {j.name for j in london.junctions if j.name}
    assert {"Oxford Circus", "Piccadilly Circus", "Trafalgar Square", "Hyde Park Corner"} <= names
    assert london.junction("oxford-circus").center == (430, 260)


def test_districts_cover_the_map_except_the_strand_gap(london):
    # The prototype leaves x 530-650, z 480-520 (south of Covent Garden, by the Strand) to its
    # "West End" fallback; everything else is in a district.
    for x in range(0, 800, 5):
        for z in range(0, 800, 5):
            inside = any(d.contains(x, z) for d in london.districts)
            in_gap = 530 <= x < 650 and 480 <= z < 520
            assert inside != in_gap, (x, z)


def test_zone_grid_counts_round_trip(zones):
    assert (zones.width, zones.height, zones.cell_size) == (400, 400, 2)
    assert zones.tally() == zones.counts
    assert sum(zones.counts.values()) == 400 * 400
    assert zones.counts["clear_walk"] > 1000


def test_zone_lookup_matches_the_prototype(zones):
    probes = json.loads((data.data_dir() / "probes.json").read_text(encoding="utf-8"))
    fields = probes["pointFields"]
    mismatches = []
    for raw in probes["points"]:
        p = dict(zip(fields, raw, strict=True))
        if zones.zone_at(p["x"], p["z"]) != p["zone"]:
            mismatches.append(p)
    assert len(probes["points"]) > 2000
    assert mismatches == []


def test_outside_the_map_is_open_landscape(zones):
    assert zones.zone_at(-5, 10) == "open_landscape"
    assert zones.zone_at(10, 800.5) == "open_landscape"


def test_data_dir_override(tmp_path, monkeypatch):
    monkeypatch.setenv("DCA_DATA", str(tmp_path))
    assert data.data_dir() == tmp_path
    (tmp_path / "london.json").write_text('{"schema": 99}', encoding="utf-8")
    with pytest.raises(ValueError, match="schema"):
        data.load_london()


def test_kerbs_are_uk_height_and_steppable(london):
    from dca.units import KERB_HEIGHT, STEP_HEIGHT

    assert {r.curb_height for r in london.roads} == {KERB_HEIGHT}
    assert KERB_HEIGHT < STEP_HEIGHT
