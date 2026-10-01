import * as THREE from 'three';
import { COLORS } from '../../constants';

export type ShadowQuality = 'low' | 'medium' | 'high';

export interface SceneParts {
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    sun: THREE.DirectionalLight;
}

/** Scene, renderer, sky, fog and lights. */
export function createScene(container: HTMLElement): SceneParts {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.SKY);
    scene.fog = new THREE.Fog(COLORS.SKY, 100, 700);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemi.position.set(0, 200, 0);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(100, 200, 100);
    sun.castShadow = true;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    return { scene, renderer, sun };
}

export function setShadowQuality(sun: THREE.DirectionalLight, quality: ShadowQuality) {
    const size = { low: 512, medium: 2048, high: 4096 }[quality] ?? 2048;
    sun.shadow.mapSize.set(size, size);
    sun.shadow.map?.dispose();
    (sun.shadow as { map: THREE.WebGLRenderTarget | null }).map = null;
}

export function setRenderDistance(scene: THREE.Scene, distance: number) {
    if (scene.fog instanceof THREE.Fog) scene.fog.far = Math.max(300, Math.min(1000, distance));
}
