import { StickFigureGroup } from './StickFigure';

export type AnimationState =
    | 'idle'
    | 'walking'
    | 'running'
    | 'attack_punch'
    | 'attack_kick'
    | 'attack_weapon'
    | 'hit_react'
    | 'death';

export interface AnimatorState {
    currentState: AnimationState;
    time: number;
    attackProgress: number; // 0-1 for attack animations
    isAttacking: boolean;
    hitReactTime: number;
}

const ANIMATION_SPEEDS = {
    idle: 1.5,
    walking: 6,
    running: 10,
    attack_punch: 15,
    attack_kick: 12,
    attack_weapon: 10,
    hit_react: 8,
    death: 2
};

const ATTACK_DURATIONS = {
    punch: 0.3,    // seconds
    kick: 0.4,
    weapon: 0.5
};

export function createAnimatorState(): AnimatorState {
    return {
        currentState: 'idle',
        time: 0,
        attackProgress: 0,
        isAttacking: false,
        hitReactTime: 0
    };
}

export function updateAnimation(
    figure: StickFigureGroup,
    state: AnimatorState,
    deltaTime: number,
    isMoving: boolean,
    isRunning: boolean
): void {
    state.time += deltaTime;
    const parts = figure.parts;

    // Determine base state if not attacking or hit reacting
    if (!state.isAttacking && state.hitReactTime <= 0) {
        if (isMoving) {
            state.currentState = isRunning ? 'running' : 'walking';
        } else {
            state.currentState = 'idle';
        }
    }

    // Update hit react timer
    if (state.hitReactTime > 0) {
        state.hitReactTime -= deltaTime;
        state.currentState = 'hit_react';
    }

    // Get animation speed
    const speed = ANIMATION_SPEEDS[state.currentState];
    const t = state.time * speed;

    // Reset rotations
    resetPose(parts);

    switch (state.currentState) {
        case 'idle':
            animateIdle(parts, t);
            break;
        case 'walking':
            animateWalking(parts, t);
            break;
        case 'running':
            animateRunning(parts, t);
            break;
        case 'attack_punch':
            animatePunch(parts, state.attackProgress);
            break;
        case 'attack_kick':
            animateKick(parts, state.attackProgress);
            break;
        case 'attack_weapon':
            animateWeaponSwing(parts, state.attackProgress);
            break;
        case 'hit_react':
            animateHitReact(parts, state.hitReactTime);
            break;
        case 'death':
            animateDeath(parts, t);
            break;
    }

    // Update attack progress
    if (state.isAttacking) {
        const duration = state.currentState === 'attack_punch' ? ATTACK_DURATIONS.punch :
                        state.currentState === 'attack_kick' ? ATTACK_DURATIONS.kick :
                        ATTACK_DURATIONS.weapon;

        state.attackProgress += deltaTime / duration;

        if (state.attackProgress >= 1) {
            state.isAttacking = false;
            state.attackProgress = 0;
            state.currentState = 'idle';
        }
    }
}

function resetPose(parts: StickFigureGroup['parts']): void {
    parts.leftArmPivot.rotation.set(0, 0, 0);
    parts.rightArmPivot.rotation.set(0, 0, 0);
    parts.leftLegPivot.rotation.set(0, 0, 0);
    parts.rightLegPivot.rotation.set(0, 0, 0);
    parts.leftElbowPivot.rotation.set(0, 0, 0);
    parts.rightElbowPivot.rotation.set(0, 0, 0);
    parts.leftKneePivot.rotation.set(0, 0, 0);
    parts.rightKneePivot.rotation.set(0, 0, 0);
    parts.torso.rotation.set(0, 0, 0);
    parts.head.rotation.set(0, 0, 0);
}

function animateIdle(parts: StickFigureGroup['parts'], t: number): void {
    // Subtle breathing/sway
    const breathe = Math.sin(t) * 0.02;
    parts.torso.position.y = 7 + breathe;
    parts.head.position.y = 11 + breathe * 1.5;

    // Arms at rest, slightly bent
    parts.leftArmPivot.rotation.z = 0.1;
    parts.rightArmPivot.rotation.z = -0.1;
    parts.leftElbowPivot.rotation.x = -0.2;
    parts.rightElbowPivot.rotation.x = -0.2;

    // Subtle arm sway
    parts.leftArmPivot.rotation.x = Math.sin(t) * 0.03;
    parts.rightArmPivot.rotation.x = Math.sin(t + 0.5) * 0.03;
}

function animateWalking(parts: StickFigureGroup['parts'], t: number): void {
    const swing = 0.4;
    const armSwing = 0.35;

    // Leg swing
    parts.leftLegPivot.rotation.x = Math.sin(t) * swing;
    parts.rightLegPivot.rotation.x = Math.sin(t + Math.PI) * swing;

    // Knee bend (only when leg is back)
    const leftKneeBend = Math.max(0, -Math.sin(t)) * 0.4;
    const rightKneeBend = Math.max(0, -Math.sin(t + Math.PI)) * 0.4;
    parts.leftKneePivot.rotation.x = leftKneeBend;
    parts.rightKneePivot.rotation.x = rightKneeBend;

    // Arm swing (opposite to legs)
    parts.leftArmPivot.rotation.x = Math.sin(t + Math.PI) * armSwing;
    parts.rightArmPivot.rotation.x = Math.sin(t) * armSwing;
    parts.leftArmPivot.rotation.z = 0.15;
    parts.rightArmPivot.rotation.z = -0.15;

    // Slight elbow bend
    parts.leftElbowPivot.rotation.x = -0.3;
    parts.rightElbowPivot.rotation.x = -0.3;

    // Body bob
    parts.torso.position.y = 7 + Math.abs(Math.sin(t * 2)) * 0.15;
    parts.head.position.y = 11 + Math.abs(Math.sin(t * 2)) * 0.15;

    // Slight torso twist
    parts.torso.rotation.y = Math.sin(t) * 0.05;
}

function animateRunning(parts: StickFigureGroup['parts'], t: number): void {
    const swing = 0.7;
    const armSwing = 0.6;

    // Leg swing (larger amplitude)
    parts.leftLegPivot.rotation.x = Math.sin(t) * swing;
    parts.rightLegPivot.rotation.x = Math.sin(t + Math.PI) * swing;

    // Knee bend (more pronounced)
    const leftKneeBend = Math.max(0, -Math.sin(t)) * 0.7;
    const rightKneeBend = Math.max(0, -Math.sin(t + Math.PI)) * 0.7;
    parts.leftKneePivot.rotation.x = leftKneeBend;
    parts.rightKneePivot.rotation.x = rightKneeBend;

    // Arm swing (larger, bent elbows)
    parts.leftArmPivot.rotation.x = Math.sin(t + Math.PI) * armSwing;
    parts.rightArmPivot.rotation.x = Math.sin(t) * armSwing;
    parts.leftArmPivot.rotation.z = 0.2;
    parts.rightArmPivot.rotation.z = -0.2;

    // Bent elbows for running
    parts.leftElbowPivot.rotation.x = -0.8;
    parts.rightElbowPivot.rotation.x = -0.8;

    // More body bob
    parts.torso.position.y = 7 + Math.abs(Math.sin(t * 2)) * 0.25;
    parts.head.position.y = 11 + Math.abs(Math.sin(t * 2)) * 0.25;

    // Forward lean
    parts.torso.rotation.x = 0.1;

    // Torso twist
    parts.torso.rotation.y = Math.sin(t) * 0.1;
}

function animatePunch(parts: StickFigureGroup['parts'], progress: number): void {
    // Wind up -> Strike -> Return
    let armExtend: number;
    let bodyTwist: number;

    if (progress < 0.3) {
        // Wind up - pull back
        const p = progress / 0.3;
        armExtend = -0.5 * p;
        bodyTwist = -0.2 * p;
    } else if (progress < 0.6) {
        // Strike - punch forward
        const p = (progress - 0.3) / 0.3;
        armExtend = -0.5 + 2.0 * p;
        bodyTwist = -0.2 + 0.5 * p;
    } else {
        // Return
        const p = (progress - 0.6) / 0.4;
        armExtend = 1.5 * (1 - p);
        bodyTwist = 0.3 * (1 - p);
    }

    // Right arm punches
    parts.rightArmPivot.rotation.x = armExtend;
    parts.rightArmPivot.rotation.z = -0.3;
    parts.rightElbowPivot.rotation.x = progress < 0.6 ? -0.3 : -0.5 * (1 - (progress - 0.6) / 0.4);

    // Left arm stays back
    parts.leftArmPivot.rotation.x = -0.3;
    parts.leftArmPivot.rotation.z = 0.3;
    parts.leftElbowPivot.rotation.x = -0.5;

    // Body twist
    parts.torso.rotation.y = bodyTwist;

    // Stance
    parts.leftLegPivot.rotation.x = -0.2;
    parts.rightLegPivot.rotation.x = 0.2;
}

function animateKick(parts: StickFigureGroup['parts'], progress: number): void {
    let legExtend: number;
    let bodyLean: number;

    if (progress < 0.25) {
        // Wind up - lift knee
        const p = progress / 0.25;
        legExtend = -0.8 * p;
        bodyLean = -0.1 * p;
    } else if (progress < 0.5) {
        // Strike - extend leg
        const p = (progress - 0.25) / 0.25;
        legExtend = -0.8 + 1.8 * p;
        bodyLean = -0.1 - 0.15 * p;
    } else if (progress < 0.75) {
        // Hold
        legExtend = 1.0;
        bodyLean = -0.25;
    } else {
        // Return
        const p = (progress - 0.75) / 0.25;
        legExtend = 1.0 * (1 - p);
        bodyLean = -0.25 * (1 - p);
    }

    // Right leg kicks
    parts.rightLegPivot.rotation.x = legExtend;

    // Knee extends during kick
    if (progress >= 0.25 && progress < 0.75) {
        parts.rightKneePivot.rotation.x = 0;
    } else if (progress < 0.25) {
        parts.rightKneePivot.rotation.x = -(progress / 0.25) * 0.8;
    } else {
        parts.rightKneePivot.rotation.x = -0.8 * (1 - (progress - 0.75) / 0.25);
    }

    // Left leg support
    parts.leftLegPivot.rotation.x = -0.15;
    parts.leftKneePivot.rotation.x = 0.1;

    // Body lean back
    parts.torso.rotation.x = bodyLean;

    // Arms for balance
    parts.leftArmPivot.rotation.x = 0.3;
    parts.leftArmPivot.rotation.z = 0.4;
    parts.rightArmPivot.rotation.x = 0.3;
    parts.rightArmPivot.rotation.z = -0.4;
}

function animateWeaponSwing(parts: StickFigureGroup['parts'], progress: number): void {
    let armSwing: number;
    let bodyTwist: number;

    if (progress < 0.3) {
        // Wind up - raise weapon
        const p = progress / 0.3;
        armSwing = -1.2 * p;
        bodyTwist = -0.3 * p;
    } else if (progress < 0.6) {
        // Swing down
        const p = (progress - 0.3) / 0.3;
        armSwing = -1.2 + 2.4 * p;
        bodyTwist = -0.3 + 0.6 * p;
    } else {
        // Follow through and return
        const p = (progress - 0.6) / 0.4;
        armSwing = 1.2 * (1 - p);
        bodyTwist = 0.3 * (1 - p);
    }

    // Right arm swings weapon
    parts.rightArmPivot.rotation.x = armSwing;
    parts.rightArmPivot.rotation.z = -0.2 + Math.sin(progress * Math.PI) * 0.3;
    parts.rightElbowPivot.rotation.x = -0.2;

    // Left arm follows
    parts.leftArmPivot.rotation.x = armSwing * 0.3;
    parts.leftArmPivot.rotation.z = 0.3;
    parts.leftElbowPivot.rotation.x = -0.4;

    // Body twist
    parts.torso.rotation.y = bodyTwist;

    // Stance
    parts.leftLegPivot.rotation.x = -0.15;
    parts.rightLegPivot.rotation.x = 0.15;
    parts.leftKneePivot.rotation.x = 0.1;
}

function animateHitReact(parts: StickFigureGroup['parts'], timeRemaining: number): void {
    const intensity = Math.min(1, timeRemaining * 4);

    // Stagger back
    parts.torso.rotation.x = -0.3 * intensity;
    parts.torso.position.y = 7 - 0.5 * intensity;

    // Arms fling
    parts.leftArmPivot.rotation.x = -0.5 * intensity;
    parts.leftArmPivot.rotation.z = 0.5 * intensity;
    parts.rightArmPivot.rotation.x = -0.5 * intensity;
    parts.rightArmPivot.rotation.z = -0.5 * intensity;

    // Head back
    parts.head.rotation.x = -0.3 * intensity;
    parts.head.position.y = 11 - 0.3 * intensity;

    // Legs buckle slightly
    parts.leftKneePivot.rotation.x = 0.2 * intensity;
    parts.rightKneePivot.rotation.x = 0.2 * intensity;
}

function animateDeath(parts: StickFigureGroup['parts'], t: number): void {
    const fallProgress = Math.min(1, t * 0.5);

    // Fall over
    parts.torso.rotation.x = -Math.PI / 2 * fallProgress;
    parts.torso.position.y = 7 - 4 * fallProgress;

    // Head follows
    parts.head.rotation.x = -0.5 * fallProgress;
    parts.head.position.y = 11 - 8 * fallProgress;

    // Arms and legs go limp
    parts.leftArmPivot.rotation.x = 0.5 * fallProgress;
    parts.rightArmPivot.rotation.x = 0.5 * fallProgress;
    parts.leftLegPivot.rotation.x = -0.3 * fallProgress;
    parts.rightLegPivot.rotation.x = -0.3 * fallProgress;
}

export function triggerAttack(state: AnimatorState, type: 'punch' | 'kick' | 'weapon'): boolean {
    if (state.isAttacking) return false;

    state.isAttacking = true;
    state.attackProgress = 0;
    state.currentState = type === 'punch' ? 'attack_punch' :
                         type === 'kick' ? 'attack_kick' : 'attack_weapon';
    return true;
}

export function triggerHitReact(state: AnimatorState): void {
    state.hitReactTime = 0.3; // 300ms hit reaction
    state.currentState = 'hit_react';
    // Don't interrupt attack, but play hit react
}

export function getAttackHitFrame(state: AnimatorState): boolean {
    // Return true when the attack is at its "hit" point
    if (!state.isAttacking) return false;

    if (state.currentState === 'attack_punch') {
        return state.attackProgress >= 0.45 && state.attackProgress <= 0.55;
    } else if (state.currentState === 'attack_kick') {
        return state.attackProgress >= 0.4 && state.attackProgress <= 0.6;
    } else if (state.currentState === 'attack_weapon') {
        return state.attackProgress >= 0.45 && state.attackProgress <= 0.55;
    }

    return false;
}
