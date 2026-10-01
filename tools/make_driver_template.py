"""Creates tools/templates/game_driver*.blend: one empty named Game whose Always sensor (pulse on
every frame) runs the Python module controller game.boot.tick.

Logic-brick operators crash UPBGE 0.50 in background mode, so this one script runs with the UI:
    blender --factory-startup --python tools/make_driver_template.py
It is only needed again if the driver wiring changes; builds append the Game object from the
template in background mode.
"""

from pathlib import Path

import bpy

# Same rule as tools/build_game.template_for (this script runs inside UPBGE without the repo
# on sys.path): Blender 4+ writes game_driver.blend, Blender 3.x (UPBGE 0.36) game_driver_b3.blend.
_NAME = "game_driver.blend" if bpy.app.version >= (4, 0, 0) else "game_driver_b3.blend"
OUT = Path(__file__).resolve().parent / "templates" / _NAME


def find_area():
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type in {"VIEW_3D", "PROPERTIES", "OUTLINER", "TIMELINE", "DOPESHEET_EDITOR"}:
                return window, area
    raise RuntimeError("no UI area to host the logic editor")


def main():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    driver = bpy.data.objects.new("Game", None)
    bpy.context.scene.collection.objects.link(driver)
    bpy.context.view_layer.objects.active = driver
    driver.select_set(True)

    window, area = find_area()
    old_type = area.type
    area.type = "LOGIC_EDITOR"
    region = next(r for r in area.regions if r.type == "WINDOW")
    with bpy.context.temp_override(window=window, area=area, region=region, object=driver,
                                   active_object=driver):
        bpy.ops.logic.sensor_add(type="ALWAYS", object=driver.name)
        bpy.ops.logic.controller_add(type="PYTHON", object=driver.name)
    area.type = old_type

    sensor = driver.game.sensors[-1]
    sensor.use_pulse_true_level = True
    controller = driver.game.controllers[-1]
    controller.mode = "MODULE"
    controller.module = "game.boot.tick"
    sensor.link(controller)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT), check_existing=False)
    print("DCA_TEMPLATE_OK", OUT, len(driver.game.sensors), len(driver.game.controllers), flush=True)
    bpy.ops.wm.quit_blender()


# Run after the UI has finished starting up.
bpy.app.timers.register(main, first_interval=1.0)
