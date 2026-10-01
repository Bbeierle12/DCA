import * as THREE from 'three';
import { COMBAT_CONFIG } from '../../constants';
import {
    CombatState, createCombatState, updateCombat, startAttack, isInHitWindow, checkHit,
    getAttackData, equipWeapon, dropWeapon,
} from '../CombatSystem';
import { AnimatorState, triggerAttack } from '../StickFigureAnimator';

export type AttackType = 'punch' | 'kick' | 'weapon';

/** Wraps combat state for the local player: attacks, hit checks, weapons, knockback, respawn. */
export class CombatController {
    readonly state: CombatState = createCombatState();
    private hitChecked = false;

    attack(type: AttackType, animator: AnimatorState, time: number) {
        if (this.state.isDead) return;
        const t: AttackType = type === 'weapon' && !this.state.weapon ? 'punch' : type;
        if (startAttack(this.state, t, time)) triggerAttack(animator, t);
    }

    equip(weapon: string) {
        equipWeapon(this.state, weapon);
    }

    drop(): string | null {
        return this.state.weapon ? dropWeapon(this.state) : null;
    }

    /** Advances timers. Returns true on the frame the player respawns. */
    update(dt: number, time: number): boolean {
        const wasDead = this.state.isDead;
        updateCombat(this.state, dt, time);
        return wasDead && !this.state.isDead;
    }

    /** Knockback velocity after frame-rate independent decay. */
    knockback(dt: number): { x: number; y: number } {
        const kb = this.state.knockbackVelocity;
        const decay = Math.pow(COMBAT_CONFIG.KNOCKBACK_DECAY, dt * 60);
        kb.x *= decay;
        kb.z *= decay;
        if (Math.abs(kb.x) < 0.5) kb.x = 0;
        if (Math.abs(kb.z) < 0.5) kb.z = 0;
        return { x: kb.x, y: kb.z };
    }

    stopKnockback(axis: 'x' | 'y') {
        if (axis === 'x') this.state.knockbackVelocity.x = 0;
        else this.state.knockbackVelocity.z = 0;
    }

    /** Once per attack, during its hit window: which targets were hit and for how much. */
    checkHits(time: number, attacker: THREE.Object3D, targets: THREE.Object3D[]): { target: THREE.Object3D; damage: number }[] {
        const hits: { target: THREE.Object3D; damage: number }[] = [];
        if (isInHitWindow(this.state, time) && !this.hitChecked) {
            this.hitChecked = true;
            const type = this.state.attackType!;
            for (const target of targets) {
                if (checkHit(attacker.position, attacker.rotation.y, target.position, type, this.state.weapon)) {
                    hits.push({ target, damage: getAttackData(type, this.state.weapon).damage });
                }
            }
        }
        if (!this.state.isAttacking) this.hitChecked = false;
        return hits;
    }
}
