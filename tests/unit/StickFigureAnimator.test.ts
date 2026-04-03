import { describe, it, expect } from 'vitest';
import {
  createAnimatorState,
  triggerAttack,
  triggerHitReact,
  getAttackHitFrame,
} from '../../services/StickFigureAnimator';

describe('StickFigureAnimator', () => {
  describe('createAnimatorState', () => {
    it('returns default idle state', () => {
      const state = createAnimatorState();
      expect(state.currentState).toBe('idle');
      expect(state.time).toBe(0);
      expect(state.attackProgress).toBe(0);
      expect(state.isAttacking).toBe(false);
      expect(state.hitReactTime).toBe(0);
    });
  });

  describe('triggerAttack', () => {
    it('triggers a punch attack', () => {
      const state = createAnimatorState();
      const result = triggerAttack(state, 'punch');
      expect(result).toBe(true);
      expect(state.isAttacking).toBe(true);
      expect(state.attackProgress).toBe(0);
      expect(state.currentState).toBe('attack_punch');
    });

    it('triggers a kick attack', () => {
      const state = createAnimatorState();
      const result = triggerAttack(state, 'kick');
      expect(result).toBe(true);
      expect(state.currentState).toBe('attack_kick');
    });

    it('triggers a weapon attack', () => {
      const state = createAnimatorState();
      const result = triggerAttack(state, 'weapon');
      expect(result).toBe(true);
      expect(state.currentState).toBe('attack_weapon');
    });

    it('prevents attack while already attacking', () => {
      const state = createAnimatorState();
      triggerAttack(state, 'punch');
      const result = triggerAttack(state, 'kick');
      expect(result).toBe(false);
      expect(state.currentState).toBe('attack_punch');
    });
  });

  describe('triggerHitReact', () => {
    it('sets hit react state', () => {
      const state = createAnimatorState();
      triggerHitReact(state);
      expect(state.hitReactTime).toBe(0.3);
      expect(state.currentState).toBe('hit_react');
    });

    it('can trigger hit react during attack', () => {
      const state = createAnimatorState();
      triggerAttack(state, 'punch');
      triggerHitReact(state);
      expect(state.currentState).toBe('hit_react');
      // Attack should still be active (not interrupted)
      expect(state.isAttacking).toBe(true);
    });
  });

  describe('getAttackHitFrame', () => {
    it('returns false when not attacking', () => {
      const state = createAnimatorState();
      expect(getAttackHitFrame(state)).toBe(false);
    });

    it('returns true at punch hit frame', () => {
      const state = createAnimatorState();
      triggerAttack(state, 'punch');
      state.attackProgress = 0.5; // Within 0.45-0.55
      expect(getAttackHitFrame(state)).toBe(true);
    });

    it('returns false at punch wind-up', () => {
      const state = createAnimatorState();
      triggerAttack(state, 'punch');
      state.attackProgress = 0.1;
      expect(getAttackHitFrame(state)).toBe(false);
    });

    it('returns true at kick hit frame', () => {
      const state = createAnimatorState();
      triggerAttack(state, 'kick');
      state.attackProgress = 0.5; // Within 0.4-0.6
      expect(getAttackHitFrame(state)).toBe(true);
    });

    it('returns true at weapon hit frame', () => {
      const state = createAnimatorState();
      triggerAttack(state, 'weapon');
      state.attackProgress = 0.5; // Within 0.45-0.55
      expect(getAttackHitFrame(state)).toBe(true);
    });

    it('returns false after punch hit window', () => {
      const state = createAnimatorState();
      triggerAttack(state, 'punch');
      state.attackProgress = 0.9;
      expect(getAttackHitFrame(state)).toBe(false);
    });
  });
});
