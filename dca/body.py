"""The player's body plan at 1.75 m: joint heights, bones and the low-poly box segments.

Long-bone lengths are Wolfram|Alpha's adult means (AnatomicalStructure "Length": femur 0.435,
tibia 0.373, humerus 0.292, radius 0.225 m) scaled from the 1.768 m mean adult male height
(HumanGrowthData) to 1.75 m. Head, shoulder and hip widths follow common anthropometric ratios.

Coordinates are the figure's own: feet on z = 0, facing +y (north when unrotated), so the
figure's right hand is at +x and its left ("*.L" bones, Blender's naming) at -x.
"""

from __future__ import annotations

from dataclasses import dataclass

HEIGHT = 1.75

FEMUR = 0.430
TIBIA = 0.369
HUMERUS = 0.289
RADIUS = 0.223
HAND = 0.19

ANKLE_Z = 0.08
KNEE_Z = ANKLE_Z + TIBIA  # 0.449
HIP_Z = KNEE_Z + FEMUR  # 0.879
SHOULDER_Z = 1.43
ELBOW_Z = SHOULDER_Z - HUMERUS  # 1.141
WRIST_Z = ELBOW_Z - RADIUS  # 0.918
CHIN_Z = 1.52

HIP_X = 0.09  # hip joint centres either side of the midline
SHOULDER_X = 0.21

# Collision capsule (C1): radius 0.25 m keeps a 0.5 m wide body, well inside 1.1 m doors.
CAPSULE_RADIUS = 0.25


@dataclass(frozen=True)
class Bone:
    name: str
    head: tuple[float, float, float]
    tail: tuple[float, float, float]
    parent: str | None


BONES = (
    Bone("hips", (0, 0, HIP_Z), (0, 0, 1.0), None),
    Bone("spine", (0, 0, 1.0), (0, 0, SHOULDER_Z), "hips"),
    Bone("head", (0, 0, 1.47), (0, 0, HEIGHT), "spine"),
    Bone("upper_arm.L", (-SHOULDER_X, 0, SHOULDER_Z), (-SHOULDER_X - 0.02, 0, ELBOW_Z), "spine"),
    Bone("forearm.L", (-SHOULDER_X - 0.02, 0, ELBOW_Z), (-SHOULDER_X - 0.03, 0, WRIST_Z), "upper_arm.L"),
    Bone("upper_arm.R", (SHOULDER_X, 0, SHOULDER_Z), (SHOULDER_X + 0.02, 0, ELBOW_Z), "spine"),
    Bone("forearm.R", (SHOULDER_X + 0.02, 0, ELBOW_Z), (SHOULDER_X + 0.03, 0, WRIST_Z), "upper_arm.R"),
    Bone("thigh.L", (-HIP_X, 0, HIP_Z), (-HIP_X, 0, KNEE_Z), "hips"),
    Bone("shin.L", (-HIP_X, 0, KNEE_Z), (-HIP_X, 0, ANKLE_Z), "thigh.L"),
    Bone("thigh.R", (HIP_X, 0, HIP_Z), (HIP_X, 0, KNEE_Z), "hips"),
    Bone("shin.R", (HIP_X, 0, KNEE_Z), (HIP_X, 0, ANKLE_Z), "thigh.R"),
)


@dataclass(frozen=True)
class Segment:
    """An axis-aligned box (min corner, max corner) carried by one bone."""

    name: str
    bone: str
    lo: tuple[float, float, float]
    hi: tuple[float, float, float]
    material: str


def _limb(name, bone, x, z_top, z_bottom, half, material):
    return Segment(name, bone, (x - half, -half, z_bottom), (x + half, half, z_top), material)


SEGMENTS = (
    Segment("pelvis", "hips", (-0.17, -0.10, 0.84), (0.17, 0.10, 1.0), "trousers"),
    Segment("torso", "spine", (-0.21, -0.11, 1.0), (0.21, 0.11, 1.47), "shirt"),
    Segment("neck", "head", (-0.05, -0.05, 1.47), (0.05, 0.05, CHIN_Z), "skin"),
    Segment("skull", "head", (-0.085, -0.095, CHIN_Z), (0.085, 0.095, HEIGHT), "skin"),
    _limb("upper_arm_l", "upper_arm.L", -SHOULDER_X - 0.01, SHOULDER_Z + 0.03, ELBOW_Z, 0.05, "shirt"),
    _limb("forearm_l", "forearm.L", -SHOULDER_X - 0.025, ELBOW_Z, WRIST_Z - HAND, 0.042, "skin"),
    _limb("upper_arm_r", "upper_arm.R", SHOULDER_X + 0.01, SHOULDER_Z + 0.03, ELBOW_Z, 0.05, "shirt"),
    _limb("forearm_r", "forearm.R", SHOULDER_X + 0.025, ELBOW_Z, WRIST_Z - HAND, 0.042, "skin"),
    _limb("thigh_l", "thigh.L", -HIP_X, HIP_Z, KNEE_Z, 0.075, "trousers"),
    _limb("shin_l", "shin.L", -HIP_X, KNEE_Z, ANKLE_Z, 0.055, "trousers"),
    Segment("foot_l", "shin.L", (-HIP_X - 0.05, -0.07, 0.0), (-HIP_X + 0.05, 0.19, ANKLE_Z), "shoes"),
    _limb("thigh_r", "thigh.R", HIP_X, HIP_Z, KNEE_Z, 0.075, "trousers"),
    _limb("shin_r", "shin.R", HIP_X, KNEE_Z, ANKLE_Z, 0.055, "trousers"),
    Segment("foot_r", "shin.R", (HIP_X - 0.05, -0.07, 0.0), (HIP_X + 0.05, 0.19, ANKLE_Z), "shoes"),
)

MATERIALS = {  # linear RGB
    "skin": (0.80, 0.55, 0.42),
    "shirt": (0.10, 0.25, 0.55),
    "trousers": (0.12, 0.12, 0.14),
    "shoes": (0.05, 0.04, 0.03),
}

# Animation cycles (frames at 24 fps): one stride (left step + right step) per cycle.
# Angles in degrees; positive swings a limb forward (+y). See tools/build_player.py.
ACTION_FPS = 24
ACTIONS = {
    "idle": {"frames": 48, "thigh": 0, "shin": 0, "arm": 3, "forearm": 6, "lean": 1.5},
    "walk": {"frames": 24, "thigh": 25, "shin": 35, "arm": 20, "forearm": 15, "lean": 3},
    "run": {"frames": 24, "thigh": 45, "shin": 80, "arm": 40, "forearm": 70, "lean": 10},
}
# Distance covered by one cycle (two steps). Walk: 0.8 m steps; run: 1.5 m steps.
STRIDE = {"walk": 1.6, "run": 3.0}
