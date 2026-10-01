import * as THREE from 'three';

/**
 * window.__dca: a small, read-mostly API that tests (and humans in devtools) use to
 * observe the game without reading pixels. Units are metres; y is up.
 */
export interface DebugPlayerState {
    x: number;
    y: number;
    z: number;
    vx: number;
    vz: number;
    floor: number;
    facing: string;
}

export interface DebugRenderInfo {
    calls: number;
    triangles: number;
    programs: number;
    lights: number;
    textures: number;
    geometries: number;
    meshes: number;
}

export interface DebugCameraState {
    x: number;
    y: number;
    z: number;
    theta: number;
    phi: number;
}

export interface DebugApi {
    ready: boolean;
    camera: () => DebugCameraState;
    frames: () => number;
    player: () => DebugPlayerState;
    renderInfo: () => DebugRenderInfo;
    zone: () => string;
    money: () => number;
    teleport: (x: number, z: number) => void;
}

export interface DebugSource {
    frameCount: number;
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    getDebugPlayer(): DebugPlayerState;
    getDebugCamera(): DebugCameraState;
    getZoneName(): string;
    teleportTo(x: number, z: number): void;
}

declare global {
    interface Window {
        __dca?: DebugApi;
    }
}

export function countSceneObjects(scene: THREE.Scene): { lights: number; meshes: number } {
    let lights = 0;
    let meshes = 0;
    scene.traverseVisible(obj => {
        if ((obj as THREE.Light).isLight) lights++;
        if ((obj as THREE.Mesh).isMesh) meshes++;
    });
    return { lights, meshes };
}

export function createDebugApi(source: DebugSource, getMoney: () => number): DebugApi {
    return {
        get ready() {
            return source.frameCount > 0;
        },
        frames: () => source.frameCount,
        player: () => source.getDebugPlayer(),
        camera: () => source.getDebugCamera(),
        renderInfo: () => {
            const info = source.renderer.info;
            const counts = countSceneObjects(source.scene);
            return {
                calls: info.render.calls,
                triangles: info.render.triangles,
                programs: info.programs?.length ?? 0,
                lights: counts.lights,
                textures: info.memory.textures,
                geometries: info.memory.geometries,
                meshes: counts.meshes,
            };
        },
        zone: () => source.getZoneName(),
        money: getMoney,
        teleport: (x: number, z: number) => source.teleportTo(x, z),
    } as DebugApi;
}

export function installDebugApi(api: DebugApi): () => void {
    window.__dca = api;
    return () => {
        if (window.__dca === api) delete window.__dca;
    };
}
