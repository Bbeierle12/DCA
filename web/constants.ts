// Units: 1 three.js unit = 1 metre, y up. The map spans x and z in [0, WORLD_SIZE].
export const WORLD_SIZE = 800;
/** Build grid cell edge, metres. */
export const BUILD_TILE = 2;
/** Floor-to-floor height, metres. */
export const STOREY_HEIGHT = 3;
/** Player standing height, metres. */
export const PLAYER_HEIGHT = 1.75;

export const COLORS = {
  WOOD: 0x8B4513,
  STONE: 0x808080,
  FLOOR: 0xD2B48C,
  FLOWER: 0x90EE90,
  TABLE: 0xA0522D,
  BED: 0xADD8E6,
  STAIRS: 0xaa8866,
  SKY: 0x87CEEB,
  GROUND: 0x4CA64C,
  ROAD: 0x555555,
  // Environment
  SIDEWALK: 0xBBBBBB,
  METAL: 0x333333,
  LAMP_GLOW: 0xFFFF99,
  DOOR: 0x4A2F1A,
  DOOR_KNOB: 0xFFD700,
  FOUNDATION: 0x666666,
  FENCE: 0x8B7355,
  HYDRANT: 0xe74c3c,
  TRASH_CAN: 0x555555,
  PINE_GREEN: 0x1B6B1B,
  BUSH_GREEN: 0x32CD32,
  OAK_GREEN: 0x228B22,
};

export const STREETLIGHT_SPACING = 40;

export const PET_COSTS: Record<string, number> = {
  dog: 10,
  cat: 10,
  horse: 25,
  none: 0
};

/** Where new players appear: the nearest pavement to this point (Oxford Street by Oxford Circus). */
export const SPAWN_TARGET = { x: 450, z: 272 };

// Player Physics (metres, seconds)
export const PLAYER_PHYSICS = {
    // Movement speeds (m/s)
    WALK_SPEED: 3,
    RUN_SPEED: 6,

    // Acceleration (m/s^2)
    ACCELERATION: 20,
    DECELERATION: 25,

    // Stop velocity threshold when no input (m/s)
    STOP_THRESHOLD: 0.1,

    // Movement speed multiplier while attacking
    ATTACK_SPEED_MULTIPLIER: 0.35,

    // Render smoothing constant (higher = snappier)
    RENDER_SMOOTHING: 12,

    // Collision footprint, centred on the player (m)
    COLLISION_WIDTH: 0.6,
    COLLISION_HEIGHT: 0.6,

    // Max displacement per frame to prevent tunnelling at low FPS (m)
    MAX_STEP: 0.75,
};

// Combat Configuration
export const COMBAT_CONFIG = {
    MAX_HEALTH: 100,
    INVINCIBILITY_DURATION: 0.5, // seconds after being hit
    RESPAWN_TIME: 3, // seconds
    RESPAWN_INVINCIBILITY: 2, // seconds of invincibility after respawn
    KNOCKBACK_DECAY: 0.85, // velocity multiplier per frame
};

// Attack type definition
export interface AttackDefinition {
    damage: number;
    range: number;
    knockback: number;
    duration: number;
    hitStart: number;
    hitEnd: number;
}

// Attack definitions: damage, range (in world units), knockback force, duration (seconds)
export const COMBAT_ATTACKS: {
    punch: AttackDefinition;
    kick: AttackDefinition;
    weapon: AttackDefinition;
    weapons: Record<string, AttackDefinition>;
} = {
    punch: {
        damage: 10,
        range: 4,
        knockback: 3,
        duration: 0.3,
        hitStart: 0.4,
        hitEnd: 0.6
    },
    kick: {
        damage: 15,
        range: 5,
        knockback: 5,
        duration: 0.4,
        hitStart: 0.35,
        hitEnd: 0.6
    },
    weapon: {
        damage: 20,
        range: 6,
        knockback: 6,
        duration: 0.5,
        hitStart: 0.4,
        hitEnd: 0.6
    },
    weapons: {
        bat: {
            damage: 20,
            range: 5.5,
            knockback: 7,
            duration: 0.45,
            hitStart: 0.4,
            hitEnd: 0.6
        },
        sword: {
            damage: 25,
            range: 6,
            knockback: 5,
            duration: 0.4,
            hitStart: 0.35,
            hitEnd: 0.55
        },
        axe: {
            damage: 35,
            range: 5,
            knockback: 10,
            duration: 0.6,
            hitStart: 0.45,
            hitEnd: 0.6
        }
    }
};

// Weapon pickup spawn locations (metres; x east, y = world z south). Combat is parked (D4).
export const WEAPON_SPAWNS = [
    { x: 80, y: 140, type: 'bat' },
    { x: 120, y: 160, type: 'sword' },
    { x: 160, y: 150, type: 'axe' },
    { x: 100, y: 180, type: 'bat' },
    { x: 140, y: 170, type: 'sword' },
];