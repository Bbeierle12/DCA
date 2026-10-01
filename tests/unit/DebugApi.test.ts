import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createDebugApi, installDebugApi, countSceneObjects, DebugSource } from '../../services/debug/DebugApi';

function fakeSource(): DebugSource & { teleported: [number, number] | null } {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  scene.add(new THREE.PointLight());
  const hidden = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  hidden.visible = false;
  scene.add(hidden);
  const renderer = {
    info: {
      render: { calls: 12, triangles: 345 },
      memory: { textures: 3, geometries: 7 },
      programs: [{}, {}],
    },
  } as unknown as THREE.WebGLRenderer;
  const src = {
    frameCount: 0,
    renderer,
    scene,
    teleported: null as [number, number] | null,
    getDebugPlayer: () => ({ x: 1, y: 0, z: 2, vx: 0, vz: 0, floor: 0, facing: 'down' }),
    getZoneName: () => 'Oxford Circus',
    teleportTo(x: number, z: number) { this.teleported = [x, z]; },
  };
  return src;
}

describe('DebugApi', () => {
  it('reports readiness from the frame count', () => {
    const src = fakeSource();
    const api = createDebugApi(src, () => 50);
    expect(api.ready).toBe(false);
    src.frameCount = 3;
    expect(api.ready).toBe(true);
    expect(api.frames()).toBe(3);
  });

  it('exposes render info, player, zone, money and teleport', () => {
    const src = fakeSource();
    const api = createDebugApi(src, () => 50);
    expect(api.renderInfo()).toEqual({
      calls: 12, triangles: 345, programs: 2, lights: 1, textures: 3, geometries: 7, meshes: 1,
    });
    expect(api.player().z).toBe(2);
    expect(api.zone()).toBe('Oxford Circus');
    expect(api.money()).toBe(50);
    api.teleport(4, 5);
    expect(src.teleported).toEqual([4, 5]);
  });

  it('counts only visible objects', () => {
    const { scene } = fakeSource();
    expect(countSceneObjects(scene)).toEqual({ lights: 1, meshes: 1 });
  });

  it('installs on window and uninstalls cleanly', () => {
    const api = createDebugApi(fakeSource(), () => 0);
    const uninstall = installDebugApi(api);
    expect(window.__dca).toBe(api);
    uninstall();
    expect(window.__dca).toBeUndefined();
  });
});
