import { describe, it, expect } from 'vitest';
import {
  WORLD_SIZE, BUILD_TILE, STOREY_HEIGHT, PLAYER_HEIGHT,
  COLORS, PET_COSTS, SPAWN_TARGET,
  PLAYER_PHYSICS, COMBAT_CONFIG, COMBAT_ATTACKS, WEAPON_SPAWNS
} from '../../constants';

describe('Constants', () => {
  describe('world dimensions (metres)', () => {
    it('spans 800 m and divides evenly into build tiles', () => {
      expect(WORLD_SIZE).toBe(800);
      expect(BUILD_TILE).toBe(2);
      expect(WORLD_SIZE % BUILD_TILE).toBe(0);
    });

    it('uses real storey and player heights', () => {
      expect(STOREY_HEIGHT).toBe(3);
      expect(PLAYER_HEIGHT).toBe(1.75);
    });
  });

  describe('COLORS', () => {
    it('has all required color keys', () => {
      const requiredKeys = ['WOOD', 'STONE', 'FLOOR', 'FLOWER', 'TABLE', 'BED', 'STAIRS', 'SKY', 'GROUND', 'ROAD'];
      for (const key of requiredKeys) {
        expect(COLORS).toHaveProperty(key);
        expect(typeof (COLORS as Record<string, number>)[key]).toBe('number');
      }
    });
  });

  describe('PET_COSTS', () => {
    it('has costs for all pet types', () => {
      expect(PET_COSTS.dog).toBeGreaterThan(0);
      expect(PET_COSTS.cat).toBeGreaterThan(0);
      expect(PET_COSTS.horse).toBeGreaterThan(0);
      expect(PET_COSTS.none).toBe(0);
    });

    it('horse is most expensive', () => {
      expect(PET_COSTS.horse).toBeGreaterThan(PET_COSTS.dog);
      expect(PET_COSTS.horse).toBeGreaterThan(PET_COSTS.cat);
    });
  });

  describe('SPAWN_TARGET', () => {
    it('lies inside the world', () => {
      expect(SPAWN_TARGET.x).toBeGreaterThan(0);
      expect(SPAWN_TARGET.x).toBeLessThan(WORLD_SIZE);
      expect(SPAWN_TARGET.z).toBeGreaterThan(0);
      expect(SPAWN_TARGET.z).toBeLessThan(WORLD_SIZE);
    });
  });

  describe('PLAYER_PHYSICS', () => {
    it('run speed is faster than walk speed', () => {
      expect(PLAYER_PHYSICS.RUN_SPEED).toBeGreaterThan(PLAYER_PHYSICS.WALK_SPEED);
      // Human-scale speeds in m/s
      expect(PLAYER_PHYSICS.WALK_SPEED).toBe(3);
      expect(PLAYER_PHYSICS.RUN_SPEED).toBe(6);
    });

    it('attack speed multiplier slows movement', () => {
      expect(PLAYER_PHYSICS.ATTACK_SPEED_MULTIPLIER).toBeGreaterThan(0);
      expect(PLAYER_PHYSICS.ATTACK_SPEED_MULTIPLIER).toBeLessThan(1);
    });

    it('has valid collision bounds', () => {
      expect(PLAYER_PHYSICS.COLLISION_WIDTH).toBeGreaterThan(0);
      expect(PLAYER_PHYSICS.COLLISION_HEIGHT).toBeGreaterThan(0);
    });
  });

  describe('COMBAT_CONFIG', () => {
    it('has valid health config', () => {
      expect(COMBAT_CONFIG.MAX_HEALTH).toBeGreaterThan(0);
    });

    it('has valid timing configs', () => {
      expect(COMBAT_CONFIG.INVINCIBILITY_DURATION).toBeGreaterThan(0);
      expect(COMBAT_CONFIG.RESPAWN_TIME).toBeGreaterThan(0);
      expect(COMBAT_CONFIG.RESPAWN_INVINCIBILITY).toBeGreaterThan(COMBAT_CONFIG.INVINCIBILITY_DURATION);
    });

    it('knockback decays', () => {
      expect(COMBAT_CONFIG.KNOCKBACK_DECAY).toBeGreaterThan(0);
      expect(COMBAT_CONFIG.KNOCKBACK_DECAY).toBeLessThan(1);
    });
  });

  describe('COMBAT_ATTACKS', () => {
    it('kick does more damage than punch', () => {
      expect(COMBAT_ATTACKS.kick.damage).toBeGreaterThan(COMBAT_ATTACKS.punch.damage);
    });

    it('all attacks have valid hit windows within duration', () => {
      for (const key of ['punch', 'kick', 'weapon'] as const) {
        const attack = COMBAT_ATTACKS[key];
        expect(attack.hitStart).toBeGreaterThanOrEqual(0);
        expect(attack.hitEnd).toBeLessThanOrEqual(1);
        expect(attack.hitStart).toBeLessThan(attack.hitEnd);
        expect(attack.duration).toBeGreaterThan(0);
        expect(attack.range).toBeGreaterThan(0);
      }
    });

    it('weapon-specific attacks exist for all types', () => {
      expect(COMBAT_ATTACKS.weapons).toHaveProperty('bat');
      expect(COMBAT_ATTACKS.weapons).toHaveProperty('sword');
      expect(COMBAT_ATTACKS.weapons).toHaveProperty('axe');
    });

    it('axe does the most weapon damage', () => {
      expect(COMBAT_ATTACKS.weapons.axe.damage).toBeGreaterThan(COMBAT_ATTACKS.weapons.sword.damage);
      expect(COMBAT_ATTACKS.weapons.sword.damage).toBeGreaterThan(COMBAT_ATTACKS.weapons.bat.damage);
    });
  });

  describe('WEAPON_SPAWNS', () => {
    it('has weapon spawn points', () => {
      expect(WEAPON_SPAWNS.length).toBeGreaterThan(0);
    });

    it('all spawns have valid types', () => {
      const validTypes = ['bat', 'sword', 'axe'];
      for (const spawn of WEAPON_SPAWNS) {
        expect(validTypes).toContain(spawn.type);
        expect(spawn.x).toBeGreaterThan(0);
        expect(spawn.y).toBeGreaterThan(0);
      }
    });
  });
});
