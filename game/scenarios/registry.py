"""Scenario names and their modules. Import-safe outside UPBGE (no bge here)."""

SCENARIOS: dict[str, str] = {
    "smoke": "game.scenarios.smoke",
    "streets": "game.scenarios.streets",
    "walk": "game.scenarios.walk",
    "portrait": "game.scenarios.portrait",
    "camera_walk": "game.scenarios.camera_walk",
    "new_game": "game.scenarios.new_game",
    "persist_write": "game.scenarios.persist_write",  # must run before persist_read
    "persist_read": "game.scenarios.persist_read",
}
