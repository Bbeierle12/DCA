import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createCombatState,
  startAttack,
  updateCombat,
  isInHitWindow,
  checkHit,
  applyDamage,
  getAttackData,
  equipWeapon,
  dropWeapon,
  canAttack,
  getHealthPercentage,
  respawn
} from '../../services/CombatSystem';
import { COMBAT_CONFIG, COMBAT_ATTACKS } from '../../constants';

describe('CombatSystem', () => {
  describe('createCombatState', () => {
    it('returns default combat state', () => {
      const state = createCombatState();
      expect(state.health).toBe(COMBAT_CONFIG.MAX_HEALTH);
      expect(state.maxHealth).toBe(COMBAT_CONFIG.MAX_HEALTH);
      expect(state.isAttacking).toBe(false);
      expect(state.attackType).toBeNull();
      expect(state.weapon).toBeNull();
      expect(state.isDead).toBe(false);
      expect(state.invincibleFrames).toBe(0);
      expect(state.knockbackVelocity).toEqual({ x: 0, z: 0 });
    });
  });

  describe('startAttack', () => {
    it('starts a punch attack', () => {
      const state = createCombatState();
      const result = startAttack(state, 'punch', 1000);
      expect(result).toBe(true);
      expect(state.isAttacking).toBe(true);
      expect(state.attackType).toBe('punch');
      expect(state.attackStartTime).toBe(1000);
    });

    it('starts a kick attack', () => {
      const state = createCombatState();
      const result = startAttack(state, 'kick', 500);
      expect(result).toBe(true);
      expect(state.attackType).toBe('kick');
    });

    it('prevents attack while already attacking', () => {
      const state = createCombatState();
      startAttack(state, 'punch', 1000);
      const result = startAttack(state, 'kick', 1001);
      expect(result).toBe(false);
      expect(state.attackType).toBe('punch');
    });

    it('prevents attack while dead', () => {
      const state = createCombatState();
      state.isDead = true;
      const result = startAttack(state, 'punch', 1000);
      expect(result).toBe(false);
    });

    it('prevents weapon attack without a weapon', () => {
      const state = createCombatState();
      const result = startAttack(state, 'weapon', 1000);
      expect(result).toBe(false);
      expect(state.isAttacking).toBe(false);
    });

    it('allows weapon attack with a weapon equipped', () => {
      const state = createCombatState();
      state.weapon = 'sword';
      const result = startAttack(state, 'weapon', 1000);
      expect(result).toBe(true);
      expect(state.attackType).toBe('weapon');
    });
  });

  describe('updateCombat', () => {
    it('ends attack after duration expires', () => {
      const state = createCombatState();
      startAttack(state, 'punch', 0);
      updateCombat(state, 0.016, COMBAT_ATTACKS.punch.duration + 0.01);
      expect(state.isAttacking).toBe(false);
      expect(state.attackType).toBeNull();
    });

    it('keeps attack active before duration ends', () => {
      const state = createCombatState();
      startAttack(state, 'punch', 0);
      updateCombat(state, 0.016, COMBAT_ATTACKS.punch.duration * 0.5);
      expect(state.isAttacking).toBe(true);
    });

    it('decrements invincibility frames', () => {
      const state = createCombatState();
      state.invincibleFrames = 0.5;
      updateCombat(state, 0.1, 0);
      expect(state.invincibleFrames).toBe(0.4);
    });

    it('respawns after respawn timer expires', () => {
      const state = createCombatState();
      state.isDead = true;
      state.health = 0;
      state.respawnTimer = 0.5;
      updateCombat(state, 0.6, 0);
      expect(state.isDead).toBe(false);
      expect(state.health).toBe(COMBAT_CONFIG.MAX_HEALTH);
    });
  });

  describe('getAttackData', () => {
    it('returns punch data', () => {
      const data = getAttackData('punch', null);
      expect(data).toEqual(COMBAT_ATTACKS.punch);
    });

    it('returns kick data', () => {
      const data = getAttackData('kick', null);
      expect(data).toEqual(COMBAT_ATTACKS.kick);
    });

    it('returns specific weapon data for sword', () => {
      const data = getAttackData('weapon', 'sword');
      expect(data).toEqual(COMBAT_ATTACKS.weapons.sword);
    });

    it('returns specific weapon data for axe', () => {
      const data = getAttackData('weapon', 'axe');
      expect(data).toEqual(COMBAT_ATTACKS.weapons.axe);
    });

    it('falls back to generic weapon data for unknown weapon', () => {
      const data = getAttackData('weapon', 'unknown_weapon');
      expect(data).toEqual(COMBAT_ATTACKS.weapon);
    });

    it('falls back to generic weapon data when weapon is null', () => {
      const data = getAttackData('weapon', null);
      expect(data).toEqual(COMBAT_ATTACKS.weapon);
    });
  });

  describe('isInHitWindow', () => {
    it('returns false when not attacking', () => {
      const state = createCombatState();
      expect(isInHitWindow(state, 0)).toBe(false);
    });

    it('returns true during hit window of punch', () => {
      const state = createCombatState();
      startAttack(state, 'punch', 0);
      const midHit = COMBAT_ATTACKS.punch.duration * (COMBAT_ATTACKS.punch.hitStart + COMBAT_ATTACKS.punch.hitEnd) / 2;
      expect(isInHitWindow(state, midHit)).toBe(true);
    });

    it('returns false before hit window', () => {
      const state = createCombatState();
      startAttack(state, 'punch', 0);
      expect(isInHitWindow(state, 0)).toBe(false);
    });

    it('returns false after hit window', () => {
      const state = createCombatState();
      startAttack(state, 'punch', 0);
      const afterHit = COMBAT_ATTACKS.punch.duration * 0.99;
      expect(isInHitWindow(state, afterHit)).toBe(false);
    });
  });

  describe('checkHit', () => {
    it('hits target in range and in front', () => {
      const attacker = new THREE.Vector3(0, 0, 0);
      const target = new THREE.Vector3(0, 0, -2);
      // Facing -Z (rotation 0)
      expect(checkHit(attacker, 0, target, 'punch', null)).toBe(true);
    });

    it('misses target behind attacker', () => {
      const attacker = new THREE.Vector3(0, 0, 0);
      const target = new THREE.Vector3(0, 0, 2);
      // Facing -Z (rotation 0)
      expect(checkHit(attacker, 0, target, 'punch', null)).toBe(false);
    });

    it('misses target out of range', () => {
      const attacker = new THREE.Vector3(0, 0, 0);
      const target = new THREE.Vector3(0, 0, -100);
      expect(checkHit(attacker, 0, target, 'punch', null)).toBe(false);
    });

    it('uses weapon range when weapon type is specified', () => {
      const attacker = new THREE.Vector3(0, 0, 0);
      // Just beyond punch range but within axe range
      const target = new THREE.Vector3(0, 0, -4.5);
      expect(checkHit(attacker, 0, target, 'punch', null)).toBe(false);
      expect(checkHit(attacker, 0, target, 'weapon', 'axe')).toBe(true);
    });

    it('hits target at the edge of the cone', () => {
      const attacker = new THREE.Vector3(0, 0, 0);
      // 45 degrees off center (within 60 degree cone)
      const target = new THREE.Vector3(2, 0, -2);
      expect(checkHit(attacker, 0, target, 'punch', null)).toBe(true);
    });
  });

  describe('applyDamage', () => {
    it('applies damage and knockback', () => {
      const state = createCombatState();
      const result = applyDamage(state, 10, { x: 1, z: 0 }, 5, 'attacker1');
      expect(result.damageDealt).toBe(10);
      expect(result.killed).toBe(false);
      expect(state.health).toBe(90);
      expect(state.knockbackVelocity.x).toBe(5);
      expect(state.lastHitBy).toBe('attacker1');
      expect(state.invincibleFrames).toBe(COMBAT_CONFIG.INVINCIBILITY_DURATION);
    });

    it('kills target at 0 health', () => {
      const state = createCombatState();
      state.health = 10;
      const result = applyDamage(state, 20, { x: 0, z: 1 }, 3, 'attacker1');
      expect(result.killed).toBe(true);
      expect(result.damageDealt).toBe(10);
      expect(state.health).toBe(0);
      expect(state.isDead).toBe(true);
      expect(state.respawnTimer).toBe(COMBAT_CONFIG.RESPAWN_TIME);
    });

    it('does not apply damage during invincibility', () => {
      const state = createCombatState();
      state.invincibleFrames = 0.5;
      const result = applyDamage(state, 50, { x: 1, z: 0 }, 5, 'attacker1');
      expect(result.damageDealt).toBe(0);
      expect(state.health).toBe(COMBAT_CONFIG.MAX_HEALTH);
    });

    it('does not apply damage to dead target', () => {
      const state = createCombatState();
      state.isDead = true;
      const result = applyDamage(state, 50, { x: 1, z: 0 }, 5, 'attacker1');
      expect(result.damageDealt).toBe(0);
    });
  });

  describe('respawn', () => {
    it('restores full health and clears combat state', () => {
      const state = createCombatState();
      state.health = 0;
      state.isDead = true;
      state.weapon = 'sword';
      state.isAttacking = true;
      state.knockbackVelocity = { x: 5, z: 3 };
      respawn(state);
      expect(state.health).toBe(COMBAT_CONFIG.MAX_HEALTH);
      expect(state.isDead).toBe(false);
      expect(state.isAttacking).toBe(false);
      expect(state.knockbackVelocity).toEqual({ x: 0, z: 0 });
      expect(state.invincibleFrames).toBe(COMBAT_CONFIG.RESPAWN_INVINCIBILITY);
    });
  });

  describe('equipWeapon / dropWeapon', () => {
    it('equips a weapon', () => {
      const state = createCombatState();
      equipWeapon(state, 'bat');
      expect(state.weapon).toBe('bat');
    });

    it('drops current weapon', () => {
      const state = createCombatState();
      state.weapon = 'sword';
      const dropped = dropWeapon(state);
      expect(dropped).toBe('sword');
      expect(state.weapon).toBeNull();
    });

    it('returns null when no weapon to drop', () => {
      const state = createCombatState();
      const dropped = dropWeapon(state);
      expect(dropped).toBeNull();
    });
  });

  describe('canAttack', () => {
    it('returns true for idle state', () => {
      const state = createCombatState();
      expect(canAttack(state)).toBe(true);
    });

    it('returns false while attacking', () => {
      const state = createCombatState();
      state.isAttacking = true;
      expect(canAttack(state)).toBe(false);
    });

    it('returns false while dead', () => {
      const state = createCombatState();
      state.isDead = true;
      expect(canAttack(state)).toBe(false);
    });
  });

  describe('getHealthPercentage', () => {
    it('returns 100 at full health', () => {
      const state = createCombatState();
      expect(getHealthPercentage(state)).toBe(100);
    });

    it('returns 50 at half health', () => {
      const state = createCombatState();
      state.health = state.maxHealth / 2;
      expect(getHealthPercentage(state)).toBe(50);
    });

    it('returns 0 at no health', () => {
      const state = createCombatState();
      state.health = 0;
      expect(getHealthPercentage(state)).toBe(0);
    });
  });
});
