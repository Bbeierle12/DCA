import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Pickups } from '../../services/game/Pickups';
import { CombatController } from '../../services/game/CombatController';
import { createAnimatorState } from '../../services/StickFigureAnimator';
import { createCharacter, createPetMesh, disposeObject } from '../../services/game/CharacterFactory';
import { WEAPON_SPAWNS } from '../../constants';

const cfg = { skin: '#ffccaa', hair: '#4a3021', eyes: '#000000', shirt: '#ff5555', pants: '#5555ff', name: 'Ada', pet: 'dog' };

describe('Pickups', () => {
  it('picks up nearby weapons once and respawns them on the game clock', () => {
    const scene = new THREE.Scene();
    const pickups = new Pickups(scene);
    const s = WEAPON_SPAWNS[0];
    expect(pickups.update(0.016, 1, s.x + 10, s.y, true)).toBeNull();
    expect(pickups.update(0.016, 1, s.x, s.y, false)).toBeNull();
    expect(pickups.update(0.016, 1, s.x, s.y, true)).toBe(s.type);
    expect(pickups.update(0.016, 2, s.x, s.y, true)).toBeNull();
    expect(pickups.update(0.016, 40, s.x, s.y, true)).toBe(s.type);
    pickups.dispose();
  });
});

describe('CombatController', () => {
  it('turns a weapon attack without a weapon into a punch and hits targets in front', () => {
    const combat = new CombatController();
    const anim = createAnimatorState();
    combat.attack('weapon', anim, 10);
    expect(combat.state.attackType).toBe('punch');
    const attacker = new THREE.Object3D();
    attacker.rotation.y = Math.PI; // facing +z
    const front = new THREE.Object3D();
    front.position.set(0, 0, 1);
    const behind = new THREE.Object3D();
    behind.position.set(0, 0, -1);
    const hits = combat.checkHits(10.15, attacker, [front, behind]);
    expect(hits.map(h => h.target)).toEqual([front]);
    expect(combat.checkHits(10.16, attacker, [front])).toEqual([]); // once per attack
  });

  it('equips, drops, decays knockback and reports respawn', () => {
    const combat = new CombatController();
    expect(combat.drop()).toBeNull();
    combat.equip('bat');
    expect(combat.drop()).toBe('bat');
    combat.state.knockbackVelocity = { x: 10, z: 0.2 };
    const kb = combat.knockback(1 / 60);
    expect(kb.x).toBeLessThan(10);
    expect(kb.y).toBe(0);
    combat.stopKnockback('x');
    expect(combat.state.knockbackVelocity.x).toBe(0);
    combat.state.isDead = true;
    combat.state.respawnTimer = 0.01;
    expect(combat.update(0.02, 1)).toBe(true);
  });
});

describe('Characters and places', () => {
  it('builds a tagged character with a pet and disposes it', () => {
    const fig = createCharacter(cfg);
    const meshes: THREE.Mesh[] = [];
    fig.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o); });
    expect(meshes.some(m => m.userData.hoverType === 'Pet')).toBe(true);
    expect(meshes.some(m => m.userData.hoverLabel === 'Ada')).toBe(true);
    expect(createPetMesh('horse').scale.x).toBeCloseTo(0.13);
    expect(() => disposeObject(fig)).not.toThrow();
  });

});
