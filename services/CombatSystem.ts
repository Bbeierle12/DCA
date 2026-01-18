import * as THREE from 'three';
import { COMBAT_ATTACKS, COMBAT_CONFIG, AttackDefinition } from '../constants';

export interface CombatState {
    health: number;
    maxHealth: number;
    isAttacking: boolean;
    attackType: 'punch' | 'kick' | 'weapon' | null;
    attackStartTime: number;
    invincibleFrames: number;
    weapon: string | null;
    lastHitBy: string | null;
    knockbackVelocity: { x: number; z: number };
    isDead: boolean;
    respawnTimer: number;
}

// Re-export AttackDefinition as AttackData for backward compatibility
export type AttackData = AttackDefinition;

export function createCombatState(): CombatState {
    return {
        health: COMBAT_CONFIG.MAX_HEALTH,
        maxHealth: COMBAT_CONFIG.MAX_HEALTH,
        isAttacking: false,
        attackType: null,
        attackStartTime: 0,
        invincibleFrames: 0,
        weapon: null,
        lastHitBy: null,
        knockbackVelocity: { x: 0, z: 0 },
        isDead: false,
        respawnTimer: 0
    };
}

export function startAttack(state: CombatState, type: 'punch' | 'kick' | 'weapon', currentTime: number): boolean {
    if (state.isAttacking || state.isDead) return false;

    // Can't use weapon attack without a weapon
    if (type === 'weapon' && !state.weapon) {
        return false;
    }

    state.isAttacking = true;
    state.attackType = type;
    state.attackStartTime = currentTime;
    return true;
}

export function updateCombat(state: CombatState, deltaTime: number, currentTime: number): void {
    // Update attack state
    if (state.isAttacking && state.attackType) {
        const attack = getAttackData(state.attackType, state.weapon);
        const elapsed = currentTime - state.attackStartTime;

        if (elapsed >= attack.duration) {
            state.isAttacking = false;
            state.attackType = null;
        }
    }

    // Update invincibility
    if (state.invincibleFrames > 0) {
        state.invincibleFrames -= deltaTime;
    }

    // Note: Knockback decay is now handled in ThreeGame.ts with proper time-based decay

    // Update respawn timer
    if (state.isDead) {
        state.respawnTimer -= deltaTime;
        if (state.respawnTimer <= 0) {
            respawn(state);
        }
    }
}

export function getAttackData(type: 'punch' | 'kick' | 'weapon', weapon: string | null): AttackData {
    if (type === 'weapon' && weapon) {
        const weaponData = COMBAT_ATTACKS.weapons[weapon];
        if (weaponData) return weaponData;
    }

    return COMBAT_ATTACKS[type];
}

export function isInHitWindow(state: CombatState, currentTime: number): boolean {
    if (!state.isAttacking || !state.attackType) return false;

    const attack = getAttackData(state.attackType, state.weapon);
    const elapsed = currentTime - state.attackStartTime;
    const progress = elapsed / attack.duration;

    return progress >= attack.hitStart && progress <= attack.hitEnd;
}

export function checkHit(
    attackerPos: THREE.Vector3,
    attackerRotation: number, // Y rotation in radians
    targetPos: THREE.Vector3,
    attackType: 'punch' | 'kick' | 'weapon',
    attackerWeapon: string | null
): boolean {
    const attack = getAttackData(attackType, attackerWeapon);

    // Calculate direction attacker is facing
    const attackDir = new THREE.Vector3(
        -Math.sin(attackerRotation),
        0,
        -Math.cos(attackerRotation)
    );

    // Vector from attacker to target
    const toTarget = new THREE.Vector3().subVectors(targetPos, attackerPos);
    toTarget.y = 0; // Ignore height difference for hit detection

    // Check distance
    const distance = toTarget.length();
    if (distance > attack.range) return false;

    // Check angle (attack has ~120 degree cone in front)
    toTarget.normalize();
    const dot = attackDir.dot(toTarget);
    const angleThreshold = Math.cos(Math.PI / 3); // 60 degrees either side = 120 degree cone

    return dot > angleThreshold;
}

export function applyDamage(
    targetState: CombatState,
    damage: number,
    knockbackDir: { x: number; z: number },
    knockbackForce: number,
    attackerId: string
): { killed: boolean; damageDealt: number } {
    // Check invincibility
    if (targetState.invincibleFrames > 0 || targetState.isDead) {
        return { killed: false, damageDealt: 0 };
    }

    // Apply damage
    const actualDamage = Math.min(damage, targetState.health);
    targetState.health -= actualDamage;
    targetState.lastHitBy = attackerId;

    // Apply knockback
    const length = Math.sqrt(knockbackDir.x * knockbackDir.x + knockbackDir.z * knockbackDir.z);
    if (length > 0) {
        targetState.knockbackVelocity.x = (knockbackDir.x / length) * knockbackForce;
        targetState.knockbackVelocity.z = (knockbackDir.z / length) * knockbackForce;
    }

    // Grant invincibility frames
    targetState.invincibleFrames = COMBAT_CONFIG.INVINCIBILITY_DURATION;

    // Check death
    if (targetState.health <= 0) {
        targetState.health = 0;
        targetState.isDead = true;
        targetState.respawnTimer = COMBAT_CONFIG.RESPAWN_TIME;
        return { killed: true, damageDealt: actualDamage };
    }

    return { killed: false, damageDealt: actualDamage };
}

export function respawn(state: CombatState): void {
    state.health = state.maxHealth;
    state.isDead = false;
    state.respawnTimer = 0;
    state.knockbackVelocity = { x: 0, z: 0 };
    state.invincibleFrames = COMBAT_CONFIG.RESPAWN_INVINCIBILITY;
    state.isAttacking = false;
    state.attackType = null;
    state.lastHitBy = null;
}

export function equipWeapon(state: CombatState, weapon: string | null): void {
    state.weapon = weapon;
}

export function dropWeapon(state: CombatState): string | null {
    const weapon = state.weapon;
    state.weapon = null;
    return weapon;
}

export function canAttack(state: CombatState): boolean {
    return !state.isAttacking && !state.isDead;
}

export function getHealthPercentage(state: CombatState): number {
    return (state.health / state.maxHealth) * 100;
}
