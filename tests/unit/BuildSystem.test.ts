import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { BuildSystem, BUILD_COST } from '../../services/game/BuildSystem';
import { ZoneType } from '../../services/world/WorldConfigV2';
import { BUILD_TILE, STOREY_HEIGHT } from '../../constants';

// Open land for x < 100, road beyond
const zones = { getZone: (x: number) => (x < 100 ? ZoneType.OPEN_LANDSCAPE : ZoneType.CARRIAGEWAY) };

function setup() {
  const scene = new THREE.Scene();
  const occluders: THREE.Object3D[] = [];
  const build = new BuildSystem(scene, zones, occluders);
  return { scene, occluders, build };
}

describe('BuildSystem', () => {
  it('allows building on open land only', () => {
    const { build } = setup();
    expect(build.canBuildAt(10, 10)).toBe(true);
    expect(build.canBuildAt(120, 10)).toBe(false);
    expect(build.canBuildAt(-10, 10)).toBe(false);
    expect(build.canBuildNear(97, 10)).toBe(true);
    expect(build.canBuildNear(130, 10)).toBe(false);
  });

  it('plans placements, occupancy, deletes and affordability', () => {
    const { build } = setup();
    expect(build.plan(120, 0, 'wood', 0, 100, 'me')).toEqual({ kind: 'error', message: "Can't build on roads or pavements!" });
    expect(build.plan(10, 10, 'wood', 0, BUILD_COST - 1, 'me').kind).toBe('error');
    const place = build.plan(10, 10, 'wood', 0, 100, 'me');
    expect(place).toEqual({ kind: 'place', block: { x: 10, y: 10, z: 0, type: 'wood', builder: 'me' }, cost: BUILD_COST });
    build.addBlock({ x: 10, y: 10, z: 0, type: 'wood', builder: 'me', id: 'w1' });
    expect(build.plan(10, 10, 'stone', 0, 100, 'me')).toEqual({ kind: 'error', message: 'Space Occupied!' });
    expect(build.plan(10, 10, 'floor', 0, 100, 'me').kind).toBe('place'); // floor can sit under a wall
    expect(build.plan(10, 10, 'delete', 0, 0, 'me')).toEqual({ kind: 'remove', id: 'w1' });
    expect(build.plan(12, 10, 'delete', 0, 0, 'me')).toEqual({ kind: 'error', message: 'Nothing here!' });
  });

  it('collides only with solid blocks on the same storey', () => {
    const { build } = setup();
    build.addBlock({ x: 10, y: 10, z: 0, type: 'stone', builder: 'me', id: 's1' });
    build.addBlock({ x: 20, y: 10, z: 0, type: 'flower', builder: 'me', id: 'f1' });
    expect(build.collides(11, 11, 0.6, 0.6, 0)).toBe(true);
    expect(build.collides(11, 11, 0.6, 0.6, 1)).toBe(false);
    expect(build.collides(21, 11, 0.6, 0.6, 0)).toBe(false);
    expect(build.collides(13, 11, 0.6, 0.6, 0)).toBe(false);
  });

  it('knows when an upper-storey footprint is supported', () => {
    const { build } = setup();
    build.addBlock({ x: 10, y: 10, z: 1, type: 'floor', builder: 'me', id: 'fl' });
    build.addBlock({ x: 20, y: 10, z: 1, type: 'stairs', builder: 'me', id: 'st' });
    expect(build.supported(11, 11, 0.3, 0.3, 1)).toBe(true);
    expect(build.supported(21, 11, 0.3, 0.3, 1)).toBe(true);
    expect(build.supported(31, 11, 0.3, 0.3, 1)).toBe(false);
    expect(build.stairsAt(21, 11, 1)?.id).toBe('st');
    expect(build.stairsAt(21, 11, 0)).toBeUndefined();
  });

  it('adds and removes meshes and keeps the occluder list in sync', () => {
    const { scene, occluders, build } = setup();
    const before = scene.children.length;
    build.addBlock({ x: 10, y: 10, z: 0, type: 'wood', builder: 'me', id: 'w1' });
    build.addBlock({ x: 10, y: 10, z: 0, type: 'floor', builder: 'me', id: 'f1' });
    build.addBlock({ x: 10, y: 10, z: 0, type: 'wood', builder: 'me', id: 'w1' }); // duplicate id ignored
    build.addBlock({ x: 30, y: 10, z: 0, type: 'bed', builder: 'me' }); // no id ignored
    expect(scene.children.length).toBe(before + 2);
    expect(occluders.length).toBe(2);
    const wall = occluders[0] as THREE.Mesh;
    expect(wall.position.y).toBeCloseTo(STOREY_HEIGHT / 2);
    expect(wall.position.x).toBeCloseTo(10 + BUILD_TILE / 2);
    build.removeBlock('w1');
    build.removeBlock('missing');
    expect(occluders.length).toBe(1);
    expect(build.blocks.map(b => b.id)).toEqual(['f1']);
    build.dispose();
    expect(build.blocks).toEqual([]);
  });

  it('aims the cursor at the storey plane and snaps to cells', () => {
    const { build } = setup();
    const ray = new THREE.Ray(new THREE.Vector3(13.3, 10, 7.9), new THREE.Vector3(0, -1, 0));
    build.aimCursor(ray, 1);
    expect(build.cursor.x).toBeCloseTo(13.3);
    expect(build.cursorCell()).toEqual({ x: 12, y: 6 });
    build.updateHighlight(true, 1);
    expect(build.highlight.visible).toBe(true);
    expect(build.highlight.position.y).toBeCloseTo(STOREY_HEIGHT * 1.5);
    build.updateHighlight(false, 0);
    expect(build.highlight.visible).toBe(false);
  });
});
