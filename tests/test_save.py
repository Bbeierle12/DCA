"""C5: the versioned save (ported cases from the prototype's SaveGame.test.ts)."""

import json

from dca import save
from dca.state import GameState

BASE = GameState(money=80, energy=90.0, position=(450.5, -272.25, 0.135), yaw=-1.57,
                 camera={"yaw": -1.57, "pitch": 0.26, "distance": 4.5})


def test_round_trip_with_version_and_timestamp(tmp_path):
    store = save.SaveStore(tmp_path)
    assert store.load() is None
    assert store.save(BASE)
    raw = json.loads(store.path.read_text())
    assert raw["version"] == save.SAVE_VERSION and raw["savedAt"] > 0
    loaded = store.load()
    assert loaded == BASE
    store.clear()
    assert store.load() is None


def test_new_game_state_without_a_position_round_trips(tmp_path):
    store = save.SaveStore(tmp_path)
    assert store.save(GameState())
    assert store.load() == GameState()


def test_corrupt_json_is_set_aside(tmp_path):
    store = save.SaveStore(tmp_path)
    store.path.write_text("{not json")
    assert store.load() is None
    assert not store.path.exists()
    assert (tmp_path / save.CORRUPT_NAME).read_text() == "{not json"


def test_structurally_invalid_saves_are_rejected(tmp_path):
    store = save.SaveStore(tmp_path)
    bad = save.to_dict(BASE) | {"money": "lots"}
    store.path.write_text(json.dumps(bad))
    assert store.load() is None
    assert (tmp_path / save.CORRUPT_NAME).exists()
    half = save.to_dict(BASE)
    half["player"]["y"] = None
    assert not save.is_valid(half)


def test_unwritable_folder_fails_softly(tmp_path):
    blocker = tmp_path / "file"
    blocker.write_text("x")
    store = save.SaveStore(blocker / "sub")  # a folder under a file cannot exist
    assert store.save(BASE) is False
    assert store.load() is None
    store.clear()


def test_migrations_upgrade_step_by_step():
    v0 = {"savedAt": 5, "px": 1.0, "py": 2.0, "pennies": 1234, "energy": 50}

    def zero_to_one(o):
        return {"savedAt": o["savedAt"], "energy": o["energy"], "camera": {},
                "player": {"x": o["px"], "y": o["py"], "z": 0.0, "yaw": 0.0},
                "money": round(o["pennies"] / 100)}

    upgraded = save.migrate(v0, {0: zero_to_one})
    assert upgraded["version"] == save.SAVE_VERSION
    assert upgraded["money"] == 12 and upgraded["player"]["x"] == 1.0


def test_future_or_unmigratable_saves_are_refused():
    assert save.migrate(save.to_dict(BASE) | {"version": save.SAVE_VERSION + 1}) is None
    assert save.migrate({"savedAt": 1}, {}) is None
    assert save.parse(None) is None
    assert save.parse("42") == "corrupt"


def test_default_folder(monkeypatch, tmp_path):
    monkeypatch.setenv("DCA_SAVE_DIR", str(tmp_path))
    assert save.default_folder() == tmp_path
    monkeypatch.delenv("DCA_SAVE_DIR")
    monkeypatch.setattr(save.sys, "platform", "win32")
    monkeypatch.setenv("APPDATA", str(tmp_path / "Roaming"))
    assert save.default_folder() == tmp_path / "Roaming" / "DCA"


def test_autosave_every_ten_seconds(tmp_path):
    auto = save.Autosave(save.SaveStore(tmp_path), interval=10.0)
    saved = [auto.tick(1 / 60, lambda: BASE) for _ in range(60 * 25)]
    assert sum(saved) == 2 and auto.saves == 2
    assert auto.now(BASE) and auto.saves == 3
