"""Scenario names and their modules. Import-safe outside UPBGE (no bge here)."""

SCENARIOS: dict[str, str] = {
    "smoke": "game.scenarios.smoke",
    "streets": "game.scenarios.streets",
    "walk": "game.scenarios.walk",
    "portrait": "game.scenarios.portrait",
}
