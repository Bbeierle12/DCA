"""The player's running state (money, energy, where they are). Saved by dca.save."""

from __future__ import annotations

from dataclasses import dataclass, field

STARTING_MONEY = 100  # pounds, as in the prototype
STARTING_ENERGY = 100.0  # percent


@dataclass
class GameState:
    money: int = STARTING_MONEY
    energy: float = STARTING_ENERGY
    # Blender coordinates of the player's feet and facing; None until placed in the world.
    position: tuple[float, float, float] | None = None
    yaw: float = 0.0
    camera: dict = field(default_factory=dict)  # orbit yaw/pitch/distance
