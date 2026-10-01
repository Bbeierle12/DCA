"""What the HUD says (C4). Pure text; game/hud.py draws it."""

from __future__ import annotations

from dataclasses import dataclass

from dca.state import GameState

CONTROLS_HINT = "WASD walk   Shift run   Mouse look   Wheel zoom   Esc quit"
HINT_SECONDS = 12.0


@dataclass(frozen=True)
class HudText:
    money: str
    energy: str
    place: str
    prompt: str


def money_text(pounds: int) -> str:
    sign = "-" if pounds < 0 else ""
    return f"{sign}£{abs(pounds):,}"


def energy_text(energy: float) -> str:
    return f"Energy {max(0, min(100, round(energy)))}%"


def hud_text(state: GameState, place: str, prompt: str = "") -> HudText:
    return HudText(money_text(state.money), energy_text(state.energy), place, prompt)


def prompt_for(seconds_played: float, interaction: str = "") -> str:
    """An interaction prompt wins; otherwise the controls hint for the first few seconds."""
    if interaction:
        return interaction
    return CONTROLS_HINT if seconds_played < HINT_SECONDS else ""
