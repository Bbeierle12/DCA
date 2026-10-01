import { describe, it, expect } from 'vitest';
import { createPlayerState, stepPlayer, facingToYaw } from '../../services/game/PlayerController';
import { PLAYER_PHYSICS, WORLD_SIZE } from '../../constants';

const open = () => false;
const dt = 1 / 60;

function run(seconds: number, fn: () => void) {
  for (let t = 0; t < seconds; t += dt) fn();
}

describe('PlayerController', () => {
  it('accelerates toward walking speed and reaches it within 1%', () => {
    const p = createPlayerState(100, 100);
    stepPlayer(p, { x: 1, y: 0, running: false }, dt, open);
    expect(p.vx).toBeCloseTo(PLAYER_PHYSICS.ACCELERATION * dt, 6);
    run(1, () => stepPlayer(p, { x: 1, y: 0, running: false }, dt, open));
    expect(Math.abs(p.vx - PLAYER_PHYSICS.WALK_SPEED) / PLAYER_PHYSICS.WALK_SPEED).toBeLessThan(0.01);
  });

  it('runs at run speed within 1%', () => {
    const p = createPlayerState(100, 100);
    run(1, () => stepPlayer(p, { x: 0, y: -1, running: true }, dt, open));
    expect(Math.abs(Math.abs(p.vy) - PLAYER_PHYSICS.RUN_SPEED) / PLAYER_PHYSICS.RUN_SPEED).toBeLessThan(0.01);
    expect(p.facing).toBe('up');
  });

  it('covers walking speed x time over distance', () => {
    const p = createPlayerState(100, 100);
    run(0.5, () => stepPlayer(p, { x: 1, y: 0, running: false }, dt, open)); // spin up
    const x0 = p.x;
    run(2, () => stepPlayer(p, { x: 1, y: 0, running: false }, dt, open));
    expect(p.x - x0).toBeGreaterThan(PLAYER_PHYSICS.WALK_SPEED * 2 * 0.98);
    expect(p.x - x0).toBeLessThan(PLAYER_PHYSICS.WALK_SPEED * 2 * 1.02);
  });

  it('normalises over-long input so diagonals are not faster', () => {
    const p = createPlayerState(100, 100);
    run(1, () => stepPlayer(p, { x: 1, y: 1, running: false }, dt, open));
    expect(Math.hypot(p.vx, p.vy)).toBeLessThanOrEqual(PLAYER_PHYSICS.WALK_SPEED * 1.0001);
  });

  it('decelerates to a full stop without input', () => {
    const p = createPlayerState(100, 100);
    run(1, () => stepPlayer(p, { x: 1, y: 0, running: true }, dt, open));
    run(1, () => stepPlayer(p, { x: 0, y: 0, running: false }, dt, open));
    expect(p.vx).toBe(0);
    expect(p.vy).toBe(0);
  });

  it('slides along a wall instead of sticking to it', () => {
    // Solid wall for x >= 105
    const wall = (x: number, _y: number, w: number) => x + w / 2 > 105;
    const p = createPlayerState(104, 100);
    let result = stepPlayer(p, { x: 1, y: -1, running: false }, dt, wall);
    run(1, () => { result = stepPlayer(p, { x: 1, y: -1, running: false }, dt, wall); });
    expect(p.x + PLAYER_PHYSICS.COLLISION_WIDTH / 2).toBeLessThanOrEqual(105);
    expect(p.y).toBeLessThan(99); // kept moving along the wall
    expect(result.blockedX).toBe(true);
    expect(result.blockedY).toBe(false);
  });

  it('rotates input into camera space', () => {
    const p = createPlayerState(100, 100);
    // Camera yawed 90 degrees: pushing "up" moves along -x
    run(0.5, () => stepPlayer(p, { x: 0, y: -1, running: false, cameraTheta: Math.PI / 2 }, dt, open));
    expect(p.vx).toBeLessThan(-1);
    expect(Math.abs(p.vy)).toBeLessThan(1e-6);
  });

  it('applies external velocity such as knockback and a speed multiplier', () => {
    const p = createPlayerState(100, 100);
    stepPlayer(p, { x: 0, y: 0, running: false }, 0.1, open, { x: 5, y: 0 });
    expect(p.x).toBeCloseTo(100.5, 5);
    const q = createPlayerState(100, 100);
    run(1, () => stepPlayer(q, { x: 1, y: 0, running: false, speedMultiplier: 0.5 }, dt, open));
    expect(q.vx).toBeCloseTo(PLAYER_PHYSICS.WALK_SPEED * 0.5, 3);
  });

  it('caps a single step to MAX_STEP at very low frame rates', () => {
    const p = createPlayerState(100, 100);
    stepPlayer(p, { x: 0, y: 0, running: false }, 1, open, { x: 100, y: 0 });
    expect(p.x - 100).toBeCloseTo(PLAYER_PHYSICS.MAX_STEP, 6);
  });

  it('stays inside the world', () => {
    const p = createPlayerState(0.5, WORLD_SIZE - 0.5);
    run(1, () => stepPlayer(p, { x: -1, y: 1, running: true }, dt, open));
    expect(p.x).toBeGreaterThanOrEqual(PLAYER_PHYSICS.COLLISION_WIDTH / 2);
    expect(p.y).toBeLessThanOrEqual(WORLD_SIZE - PLAYER_PHYSICS.COLLISION_HEIGHT / 2);
  });

  it('maps facing to yaw', () => {
    expect(facingToYaw('down')).toBe(0);
    expect(facingToYaw('up')).toBeCloseTo(Math.PI);
    expect(facingToYaw('left')).toBeCloseTo(Math.PI / 2);
    expect(facingToYaw('right')).toBeCloseTo(-Math.PI / 2);
  });
});
