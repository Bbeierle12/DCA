import * as THREE from 'three';
import { WEAPON_SPAWNS } from '../../constants';
import { tagMesh, disposeObject } from './CharacterFactory';

interface Pickup {
    mesh: THREE.Group;
    type: string;
    x: number;
    y: number;
    takenUntil: number;
}

const RESPAWN_SECONDS = 30;

function createPickupMesh(type: string): THREE.Group {
    const group = new THREE.Group();
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.5, 16), new THREE.MeshLambertMaterial({ color: 0x444444 }));
    platform.castShadow = true;
    group.add(platform);
    const color = type === 'sword' ? 0xcccccc : type === 'axe' ? 0x888888 : 0x8B4513;
    const weapon = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 0.5), new THREE.MeshLambertMaterial({ color }));
    weapon.position.y = 3;
    weapon.rotation.z = 0.2;
    weapon.castShadow = true;
    group.add(weapon);
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.5, 0.2, 8, 32),
        new THREE.MeshBasicMaterial({ color: type === 'sword' ? 0x00ff00 : type === 'axe' ? 0xff0000 : 0xffff00, transparent: true, opacity: 0.6 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.5;
    group.add(ring);
    const name = type.charAt(0).toUpperCase() + type.slice(1);
    tagMesh(platform, `${name} Pickup`, 'Weapon');
    tagMesh(weapon, name, 'Weapon');
    group.scale.setScalar(0.25); // legacy-unit model -> about 1.5 m across
    return group;
}

/** Weapon pickups (combat feature). Respawn on the game clock, so nothing leaks on teardown. */
export class Pickups {
    private items: Pickup[] = [];

    constructor(private scene: THREE.Scene) {
        for (const spawn of WEAPON_SPAWNS) {
            const mesh = createPickupMesh(spawn.type);
            mesh.position.set(spawn.x, 0.5, spawn.y);
            scene.add(mesh);
            this.items.push({ mesh, type: spawn.type, x: spawn.x, y: spawn.y, takenUntil: 0 });
        }
    }

    /** Animates pickups and returns the type picked up this frame, if any. */
    update(dt: number, time: number, px: number, py: number, canPickUp: boolean): string | null {
        let picked: string | null = null;
        for (const item of this.items) {
            const available = time >= item.takenUntil;
            item.mesh.visible = available;
            if (!available) continue;
            item.mesh.position.y = 0.5 + Math.sin(time * 3) * 0.1;
            item.mesh.rotation.y += dt * 2;
            if (!picked && canPickUp && Math.hypot(px - item.x, py - item.y) < 1.5) {
                item.takenUntil = time + RESPAWN_SECONDS;
                item.mesh.visible = false;
                picked = item.type;
            }
        }
        return picked;
    }

    dispose() {
        for (const item of this.items) {
            this.scene.remove(item.mesh);
            disposeObject(item.mesh);
        }
        this.items = [];
    }
}
