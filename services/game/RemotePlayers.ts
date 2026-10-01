import * as THREE from 'three';
import { STOREY_HEIGHT } from '../../constants';
import { GameConfig, PlayerData } from '../../types';
import { attachWeapon, StickFigureGroup } from '../StickFigure';
import { AnimatorState, createAnimatorState, triggerAttack, updateAnimation } from '../StickFigureAnimator';
import { createCharacter, disposeObject } from './CharacterFactory';
import { facingToYaw, Facing } from './PlayerController';

interface Remote {
    mesh: StickFigureGroup;
    data: PlayerData;
    animator: AnimatorState;
    target: THREE.Vector3;
    moving: boolean;
}

/** Other players as last reported by the NetClient, smoothed every frame. */
export class RemotePlayers {
    private players = new Map<string, Remote>();
    private showOthers = true;

    constructor(private scene: THREE.Scene) {}

    apply(id: string, data: PlayerData) {
        let p = this.players.get(id);
        if (!p) {
            const mesh = createCharacter(data as GameConfig);
            mesh.position.set(data.x, (data.z || 0) * STOREY_HEIGHT, data.y);
            this.scene.add(mesh);
            p = { mesh, data, animator: createAnimatorState(), target: mesh.position.clone(), moving: false };
            this.players.set(id, p);
        } else if (p.data.skin !== data.skin || p.data.pet !== data.pet || p.data.shirt !== data.shirt
            || p.data.hair !== data.hair || p.data.pants !== data.pants || p.data.name !== data.name) {
            const mesh = createCharacter(data as GameConfig);
            mesh.position.copy(p.mesh.position);
            this.scene.remove(p.mesh);
            disposeObject(p.mesh);
            this.scene.add(mesh);
            p.mesh = mesh;
            p.animator = createAnimatorState();
        }

        p.moving = p.data.x !== data.x || p.data.y !== data.y;
        p.target.set(data.x, (data.z || 0) * STOREY_HEIGHT, data.y);
        p.mesh.rotation.y = facingToYaw((data.facing as Facing) ?? 'down');

        const oldWeapon = p.data.combat?.weapon || null;
        const newWeapon = data.combat?.weapon || null;
        if (oldWeapon !== newWeapon) attachWeapon(p.mesh, newWeapon);
        if (data.combat?.isAttacking && !p.data.combat?.isAttacking && data.combat.attackType) {
            triggerAttack(p.animator, data.combat.attackType as 'punch' | 'kick' | 'weapon');
        }
        p.data = data;
        p.mesh.visible = this.showOthers && !data.combat?.isDead;
    }

    /** Per-frame smoothing toward the last reported position and animation. */
    update(dt: number) {
        const k = 1 - Math.exp(-10 * dt);
        for (const p of this.players.values()) {
            p.mesh.position.lerp(p.target, k);
            const stillMoving = p.moving && p.mesh.position.distanceToSquared(p.target) > 0.0004;
            updateAnimation(p.mesh, p.animator, dt, stillMoving, false);
        }
    }

    setVisible(show: boolean) {
        this.showOthers = show;
        for (const p of this.players.values()) p.mesh.visible = show && !p.data.combat?.isDead;
    }

    meshes(): THREE.Object3D[] {
        return [...this.players.values()].map(p => p.mesh);
    }

    dispose() {
        for (const p of this.players.values()) {
            this.scene.remove(p.mesh);
            disposeObject(p.mesh);
        }
        this.players.clear();
    }
}
