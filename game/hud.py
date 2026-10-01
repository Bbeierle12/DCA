"""Draws the HUD text (dca.hud) over the 3D view with blf, after each render (C4)."""

from __future__ import annotations

import bge
import blf
import gpu
from mathutils import Matrix

from dca.hud import HudText

FONT = 0  # Blender's built-in UI font


class Hud:
    def __init__(self, scene):
        self.text = HudText("", "", "", "")
        self.drawn = 0
        scene.post_draw.append(self.draw)

    def set(self, text: HudText) -> None:
        self.text = text

    def _line(self, s: str, x: float, y: float, size: int, width: float = 0.0, center=False) -> None:
        if not s:
            return
        blf.size(FONT, size)
        if center:
            x = (width - blf.dimensions(FONT, s)[0]) / 2
        blf.position(FONT, x, y, 0)
        blf.draw(FONT, s)

    def draw(self, *_args) -> None:
        w, h = bge.render.getWindowWidth(), bge.render.getWindowHeight()
        ortho = Matrix(((2 / w, 0, 0, -1), (0, 2 / h, 0, -1), (0, 0, -1, 0), (0, 0, 0, 1)))
        gpu.state.blend_set("ALPHA")
        blf.enable(FONT, blf.SHADOW)
        blf.shadow(FONT, 3, 0.0, 0.0, 0.0, 0.85)
        blf.shadow_offset(FONT, 2, -2)
        blf.color(FONT, 1.0, 1.0, 1.0, 1.0)
        with gpu.matrix.push_pop(), gpu.matrix.push_pop_projection():
            gpu.matrix.load_projection_matrix(ortho)
            gpu.matrix.load_identity()
            t = self.text
            self._line(t.money, 28, h - 52, 30)
            self._line(t.energy, 28, h - 88, 20)
            self._line(t.place, 0, h - 52, 28, w, center=True)
            self._line(t.prompt, 0, 40, 18, w, center=True)
        blf.disable(FONT, blf.SHADOW)
        gpu.state.blend_set("NONE")
        self.drawn += 1
