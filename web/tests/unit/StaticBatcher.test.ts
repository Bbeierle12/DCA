import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { batchStatic } from '../../services/world/StaticBatcher';
import { WorldBuilder } from '../../services/world/WorldBuilder';

function box(color: number, x: number, z: number, size = 1) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, size / 2, z);
  m.castShadow = true;
  return m;
}

function worldBounds(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root);
}

describe('batchStatic', () => {
  it('merges same-key meshes per chunk regardless of colour', () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    scene.add(group);
    for (let i = 0; i < 10; i++) group.add(box(i % 2 ? 0xff0000 : 0x00ff00, 10 + i * 3, 10, 2));
    for (let i = 0; i < 5; i++) scene.add(box(0x0000ff, 250 + i * 3, 10, 2));
    const before = worldBounds(scene);
    const stats = batchStatic(scene, { chunkSize: 200 });
    expect(stats.meshesIn).toBe(15);
    expect(stats.meshesOut).toBe(2); // one per chunk; colours live in vertex colours
    expect(stats.materials).toBe(1);
    const after = worldBounds(scene);
    expect(after.min.distanceTo(before.min)).toBeLessThan(1e-6);
    expect(after.max.distanceTo(before.max)).toBeLessThan(1e-6);
    expect(group.parent).toBeNull(); // emptied groups are pruned
  });

  it('bakes material colour into vertex colours', () => {
    const scene = new THREE.Scene();
    scene.add(box(0xff0000, 0, 0));
    batchStatic(scene);
    const mesh = scene.children[0] as THREE.Mesh;
    const color = mesh.geometry.getAttribute('color');
    const red = new THREE.Color(0xff0000);
    expect(color.getX(0)).toBeCloseTo(red.r);
    expect(color.getY(0)).toBeCloseTo(red.g);
    expect((mesh.material as THREE.MeshLambertMaterial).vertexColors).toBe(true);
  });

  it('keeps transparent, unlit, double-sided and textured meshes in separate groups', () => {
    const scene = new THREE.Scene();
    scene.add(box(0xffffff, 0, 0));
    const glass = box(0xffffff, 2, 0);
    (glass.material as THREE.Material).transparent = true;
    (glass.material as THREE.Material).opacity = 0.5;
    scene.add(glass);
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.5), new THREE.MeshBasicMaterial({ color: 0xffff00 })));
    const image = { width: 1, height: 1 };
    const texA = new THREE.Texture(image);
    texA.wrapS = texA.wrapT = THREE.RepeatWrapping;
    texA.repeat.set(4, 1);
    const texB = texA.clone();
    texB.repeat.set(2, 1);
    const plane = (tex: THREE.Texture, x: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ map: tex }));
      m.position.x = x;
      return m;
    };
    scene.add(plane(texA, 5), plane(texB, 8));
    const stats = batchStatic(scene);
    expect(stats.meshesOut).toBe(4); // opaque, transparent, unlit, one textured group for the shared image
    const textured = scene.children.find(c => ((c as THREE.Mesh).material as THREE.MeshLambertMaterial).map) as THREE.Mesh;
    const uv = textured.geometry.getAttribute('uv');
    let maxU = 0;
    for (let i = 0; i < uv.count; i++) maxU = Math.max(maxU, uv.getX(i));
    expect(maxU).toBeCloseTo(4); // repeat baked into UVs
  });

  it('leaves kept meshes alone and drops shadows from small props', () => {
    const scene = new THREE.Scene();
    const ground = box(0x00ff00, 0, 0, 50);
    const pebble = box(0x888888, 5, 5, 0.2);
    const tree = box(0x228822, 10, 10, 4);
    scene.add(ground, pebble, tree);
    const stats = batchStatic(scene, { keep: new Set([ground]), minShadowRadius: 1.5 });
    expect(scene.children).toContain(ground);
    expect(stats.skipped).toBe(1);
    const casters = scene.children.filter(c => c !== ground && (c as THREE.Mesh).castShadow);
    const nonCasters = scene.children.filter(c => c !== ground && !(c as THREE.Mesh).castShadow);
    expect(casters.length).toBe(1);
    expect(nonCasters.length).toBe(1);
  });

  it('cuts the London world from thousands of meshes to a few hundred at most', () => {
    const scene = new THREE.Scene();
    const result = new WorldBuilder().build(scene, { batch: true });
    expect(result.batch!.meshesIn).toBeGreaterThan(4000);
    expect(result.batch!.meshesOut).toBeLessThan(300);
    let lights = 0;
    scene.traverse(o => { if ((o as THREE.Light).isLight) lights++; });
    expect(lights).toBe(0); // no point lights left in the world
    for (const m of result.collidableMeshes) expect(m.parent).not.toBeNull();
  });
});
