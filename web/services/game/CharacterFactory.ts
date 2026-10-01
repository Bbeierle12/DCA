import * as THREE from 'three';
import { GameConfig } from '../../types';
import { PLAYER_HEIGHT } from '../../constants';
import { createStickFigure, StickFigureGroup } from '../StickFigure';

/** Hover metadata read by the build-mode tooltip. */
export function tagMesh(mesh: THREE.Object3D, label: string, type: string) {
    mesh.userData.hoverLabel = label;
    mesh.userData.hoverType = type;
}

function nameTag(name: string): THREE.Sprite | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    canvas.width = 256;
    canvas.height = 64;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = 'white';
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(name, 128, 45);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
    sprite.position.y = PLAYER_HEIGHT + 0.4;
    sprite.scale.set(1.4, 0.35, 1);
    sprite.name = 'nameTag';
    return sprite;
}

export function createPetMesh(type: string): THREE.Group {
    const group = new THREE.Group();
    let color = 0x8B4513;
    let scale = 1;
    if (type === 'cat') { color = 0xFFA500; scale = 0.7; }
    if (type === 'horse') { color = 0xA0522D; scale = 1.5; }

    const mat = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(4 * scale, 3 * scale, 6 * scale), mat);
    body.position.y = 2 * scale;
    group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(2.5 * scale, 2.5 * scale, 2.5 * scale), mat);
    head.position.set(0, 4.5 * scale, 3 * scale);
    group.add(head);

    const label = type === 'horse' ? 'Horse' : (type === 'cat' ? 'Cat' : 'Dog');
    group.traverse(o => {
        if (o instanceof THREE.Mesh) tagMesh(o, label, 'Pet');
    });
    // Modelled in legacy units; 0.13 brings a dog to roughly knee height.
    group.scale.setScalar(0.13);
    return group;
}

/** A player character: stick figure + floating name tag + optional pet. */
export function createCharacter(cfg: GameConfig): StickFigureGroup {
    const figure = createStickFigure(cfg);
    const tag = nameTag(cfg.name);
    if (tag) figure.add(tag);
    if (cfg.pet && cfg.pet !== 'none') {
        const pet = createPetMesh(cfg.pet);
        pet.position.set(0.7, 0, 0.5);
        figure.add(pet);
    }
    figure.traverse(o => {
        if (o instanceof THREE.Mesh && !o.userData.hoverLabel) tagMesh(o, cfg.name, 'Citizen');
    });
    return figure;
}

/** Frees GPU resources owned by a character (geometries, materials, textures). */
export function disposeObject(root: THREE.Object3D) {
    root.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
        for (const m of mats) {
            const map = (m as THREE.MeshBasicMaterial).map;
            if (map) map.dispose();
            m.dispose();
        }
    });
}
