import { PLAYER_PHYSICS, WORLD_SIZE } from '../../constants';

/**
 * Pure player movement: acceleration toward a target velocity, axis-separated collision
 * (so the player slides along walls), world bounds and facing. No three.js, no DOM.
 * Units: metres and seconds. (x, y) is the centre of the footprint; y is world z.
 */

export type Facing = 'up' | 'down' | 'left' | 'right';

export interface PlayerState {
    x: number;
    y: number;
    /** Storey index (0 = ground). */
    level: number;
    vx: number;
    vy: number;
    facing: Facing;
}

export interface MoveIntent {
    /** Input axis; vectors longer than 1 are normalised. y < 0 is forward/up the screen. */
    x: number;
    y: number;
    running: boolean;
    /** Scales the target speed (e.g. slowed while attacking). Default 1. */
    speedMultiplier?: number;
    /** When set, the input is rotated by the camera yaw so "up" means away from the camera. */
    cameraTheta?: number;
}

/** Extra velocity applied on top of walking (e.g. knockback), in m/s. */
export interface ExternalVelocity {
    x: number;
    y: number;
}

export type CollisionTest = (x: number, y: number, w: number, h: number) => boolean;

export interface StepResult {
    moving: boolean;
    blockedX: boolean;
    blockedY: boolean;
}

export function createPlayerState(x: number, y: number): PlayerState {
    return { x, y, level: 0, vx: 0, vy: 0, facing: 'down' };
}

function approach(current: number, target: number, maxChange: number): number {
    const diff = target - current;
    if (Math.abs(diff) <= maxChange) return target;
    return current + Math.sign(diff) * maxChange;
}

function facingFrom(x: number, y: number): Facing {
    if (Math.abs(y) > Math.abs(x)) return y < 0 ? 'up' : 'down';
    return x < 0 ? 'left' : 'right';
}

export function facingToYaw(facing: Facing): number {
    switch (facing) {
        case 'up': return Math.PI;
        case 'left': return Math.PI / 2;
        case 'right': return -Math.PI / 2;
        default: return 0;
    }
}

export function stepPlayer(
    state: PlayerState,
    intent: MoveIntent,
    dt: number,
    collides: CollisionTest,
    external: ExternalVelocity = { x: 0, y: 0 },
): StepResult {
    const P = PLAYER_PHYSICS;
    let ix = intent.x;
    let iy = intent.y;
    let len = Math.hypot(ix, iy);
    if (len > 1) {
        ix /= len;
        iy /= len;
        len = 1;
    }
    if (intent.cameraTheta !== undefined && len > 0) {
        const c = Math.cos(intent.cameraTheta);
        const s = Math.sin(intent.cameraTheta);
        const rx = ix * c + iy * s;
        const ry = -ix * s + iy * c;
        ix = rx;
        iy = ry;
    }

    const moving = len > 0;
    const speed = (intent.running ? P.RUN_SPEED : P.WALK_SPEED) * (intent.speedMultiplier ?? 1);
    const accel = moving ? P.ACCELERATION : P.DECELERATION;
    state.vx = approach(state.vx, ix * speed, accel * dt);
    state.vy = approach(state.vy, iy * speed, accel * dt);
    if (!moving) {
        if (Math.abs(state.vx) < P.STOP_THRESHOLD) state.vx = 0;
        if (Math.abs(state.vy) < P.STOP_THRESHOLD) state.vy = 0;
    }

    let dx = (state.vx + external.x) * dt;
    let dy = (state.vy + external.y) * dt;
    const step = Math.hypot(dx, dy);
    if (step > P.MAX_STEP) {
        dx *= P.MAX_STEP / step;
        dy *= P.MAX_STEP / step;
    }

    if (moving) {
        state.facing = facingFrom(ix, iy);
    } else {
        const fx = state.vx + external.x;
        const fy = state.vy + external.y;
        if (Math.abs(fx) > 0.01 || Math.abs(fy) > 0.01) state.facing = facingFrom(fx, fy);
    }

    // Axis-separated collision so blocked movement slides along walls
    const w = P.COLLISION_WIDTH;
    const h = P.COLLISION_HEIGHT;
    let blockedX = false;
    let blockedY = false;
    if (dx !== 0) {
        if (collides(state.x + dx, state.y, w, h)) {
            state.vx = 0;
            blockedX = true;
        } else {
            state.x += dx;
        }
    }
    if (dy !== 0) {
        if (collides(state.x, state.y + dy, w, h)) {
            state.vy = 0;
            blockedY = true;
        } else {
            state.y += dy;
        }
    }

    state.x = Math.max(w / 2, Math.min(WORLD_SIZE - w / 2, state.x));
    state.y = Math.max(h / 2, Math.min(WORLD_SIZE - h / 2, state.y));
    return { moving, blockedX, blockedY };
}
