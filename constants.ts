export const TILE_SIZE = 40;
export const WORLD_SCALE = 0.2;
export const MAP_WIDTH = 100;
export const MAP_HEIGHT = 100;

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
};

export const PET_COSTS: Record<string, number> = {
  dog: 10,
  cat: 10,
  horse: 25,
  none: 0
};

export const SPAWN_POINT = { x: 200, y: 200 };

// Player Physics
export const PLAYER_PHYSICS = {
    // Movement speeds (units per second)
    WALK_SPEED: 120,
    RUN_SPEED: 200,

    // Acceleration (units per second squared)
    ACCELERATION: 800,
    DECELERATION: 900,

    // Stop velocity threshold when no input
    STOP_THRESHOLD: 4,

    // Movement speed multiplier while attacking
    ATTACK_SPEED_MULTIPLIER: 0.35,

    // Render smoothing constant (higher = snappier)
    RENDER_SMOOTHING: 12,

    // Collision bounds (in world units)
    COLLISION_WIDTH: 24,
    COLLISION_HEIGHT: 32,

    // Max step size to prevent tunneling at low FPS
    MAX_STEP: 20,
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

// Weapon pickup spawn locations (in world coordinates, Home Lot area)
export const WEAPON_SPAWNS = [
    { x: 400, y: 700, type: 'bat' },
    { x: 600, y: 800, type: 'sword' },
    { x: 800, y: 750, type: 'axe' },
    { x: 500, y: 900, type: 'bat' },
    { x: 700, y: 850, type: 'sword' },
];