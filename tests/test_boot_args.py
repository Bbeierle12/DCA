import importlib
import sys
import types


def load_boot():
    # game.boot imports nothing from bge at module level, so it loads anywhere.
    return importlib.import_module("game.boot")


def test_parses_arguments_after_dash():
    boot = load_boot()
    argv = ["blenderplayer", "-w", "1920", "1080", "dca.blend"]
    argv += ["-", "--scenario", "smoke", "--results", "out"]
    assert boot.parse_args(argv) == {"scenario": "smoke", "results": "out"}


def test_no_dash_means_normal_play():
    boot = load_boot()
    assert boot.parse_args(["blenderplayer", "dca.blend"]) == {}


def test_registry_is_import_safe_and_points_at_modules():
    from game.scenarios.registry import SCENARIOS

    assert "smoke" in SCENARIOS
    assert all(path.startswith("game.scenarios.") for path in SCENARIOS.values())
    assert isinstance(sys.modules.get("game.scenarios.registry"), types.ModuleType)
