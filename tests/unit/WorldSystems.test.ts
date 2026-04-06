import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COLORS } from '../../constants';
import { WorldBuilder } from '../../services/world/WorldBuilder';
import { IntersectionBuilderV2 } from '../../services/world/IntersectionBuilderV2';
import { PathRoadBuilder } from '../../services/world/PathRoadBuilder';
import { TextureFactory } from '../../services/world/TextureFactory';
import {
  WorldConfig,
  createLondonWorldConfig,
  getLaneLayout,
} from '../../services/world/WorldConfigV2';

function collectLabels(scene: THREE.Scene, label: string): THREE.Object3D[] {
  const matches: THREE.Object3D[] = [];
  scene.traverse((obj) => {
    if (obj.userData.hoverLabel === label) {
      matches.push(obj);
    }
  });
  return matches;
}

function collectPositions(scene: THREE.Scene, labels: string[]): string[] {
  const positions: string[] = [];
  const worldPos = new THREE.Vector3();
  scene.traverse((obj) => {
    if (!labels.includes(obj.userData.hoverLabel)) return;
    obj.getWorldPosition(worldPos);
    positions.push(`${obj.userData.hoverLabel}:${worldPos.x.toFixed(2)},${worldPos.y.toFixed(2)},${worldPos.z.toFixed(2)}`);
  });
  return positions.sort();
}

function createMinimalWorldConfig(): WorldConfig {
  return {
    worldWidth: 200,
    worldHeight: 200,
    tileSize: 1,
    worldScale: 1,
    mapWidth: 200,
    mapHeight: 200,
    colors: COLORS,
    randomSeed: 12345,
    roads: [
      {
        id: 'north-south',
        name: 'North South',
        path: [{ x: 100, z: 20 }, { x: 100, z: 100 }],
        type: 'main',
        lanesPerDirection: 1,
        laneWidth: 3.5,
        carriagewayWidth: 10,
        curbWidth: 0.4,
        curbHeight: 0.3,
        furnishingStripWidth: 2,
        clearWalkWidth: 2,
        laneLayout: [
          { kind: 'general', direction: 'forward', width: 3.5 },
          { kind: 'general', direction: 'backward', width: 3.5 },
        ],
        leftKerbside: { width: 2, clearWalkWidth: 2, use: 'planting', marking: 'double_yellow' },
        rightKerbside: { width: 2, clearWalkWidth: 2, use: 'loading', marking: 'double_yellow' },
      },
      {
        id: 'east-west',
        name: 'East West',
        path: [{ x: 100, z: 100 }, { x: 180, z: 100 }],
        type: 'main',
        lanesPerDirection: 1,
        laneWidth: 3.5,
        carriagewayWidth: 10,
        curbWidth: 0.4,
        curbHeight: 0.3,
        furnishingStripWidth: 2,
        clearWalkWidth: 2,
        laneLayout: [
          { kind: 'general', direction: 'forward', width: 3.5 },
          { kind: 'general', direction: 'backward', width: 3.5 },
        ],
        leftKerbside: { width: 2, clearWalkWidth: 2, use: 'planting', marking: 'single_yellow' },
        rightKerbside: { width: 2, clearWalkWidth: 2, use: 'planting', marking: 'single_yellow' },
      },
    ],
    intersections: [
      {
        id: 'test-junction',
        center: { x: 100, z: 100 },
        type: 'standard',
        radius: 12,
        arms: [
          { roadId: 'north-south', angle: -Math.PI / 2, crossing: 'signal', control: 'signal', stopLine: true },
          { roadId: 'east-west', angle: 0, crossing: 'none', control: 'priority', stopLine: false },
        ],
        sightTriangleLeg: 8,
        crosswalkWidth: 3,
        stopBarOffset: 1.5,
      },
    ],
    landscape: {
      formalTreeSpacing: 20,
      mainStreetSpecies: 'oak',
      secondaryStreetSpecies: 'pine',
      clusterDensity: 0,
      perimeterTreeBandWidth: 10,
      sightTriangleClearance: 8,
    },
    furniture: {
      streetlightSpacing: 30,
      maxPointLights: 4,
      benchSpacing: 0,
      trashCanSpacing: 50,
      hydrantSpacing: 80,
      intersectionClearance: 10,
      bollardSpacing: 15,
      phoneBoxCount: 0,
      pillarBoxCount: 0,
    },
  };
}

describe('World street systems', () => {
  it('captures explicit London-inspired lane and arm metadata', () => {
    const config = createLondonWorldConfig();
    const oxfordWest = config.roads.find((road) => road.id === 'oxford-street-w');
    const parkLane = config.roads.find((road) => road.id === 'park-lane');
    const oxfordCircus = config.intersections.find((intersection) => intersection.id === 'oxford-circus');

    expect(oxfordWest).toBeDefined();
    expect(getLaneLayout(oxfordWest!)[0].kind).toBe('bus');
    expect(parkLane?.oneWay).toBe(true);
    expect(getLaneLayout(parkLane!).every((lane) => lane.direction === 'forward')).toBe(true);
    expect(parkLane?.rightKerbside?.marking).toBe('double_red');
    expect(oxfordCircus?.arms).toHaveLength(4);
  });

  it('renders dedicated bus and cycle lane surfaces from lane layouts', () => {
    const scene = new THREE.Scene();
    const config = createLondonWorldConfig();
    const builder = new PathRoadBuilder(config, new TextureFactory(config));

    builder.build(scene);

    expect(collectLabels(scene, 'Bus Lane').length).toBeGreaterThan(0);
    expect(collectLabels(scene, 'Cycle Lane').length).toBeGreaterThan(0);
  });

  it('renders only the controls configured on each intersection arm', () => {
    const scene = new THREE.Scene();
    const config = createMinimalWorldConfig();
    const builder = new IntersectionBuilderV2(config, new TextureFactory(config));

    builder.build(scene);

    expect(collectLabels(scene, 'Crossing')).toHaveLength(1);
    expect(collectLabels(scene, 'Traffic Light')).toHaveLength(1);
    expect(collectLabels(scene, 'Give Way')).toHaveLength(0);
  });

  it('builds deterministic London street furniture placements from the world seed', () => {
    const sceneA = new THREE.Scene();
    const sceneB = new THREE.Scene();

    new WorldBuilder(createLondonWorldConfig()).build(sceneA);
    new WorldBuilder(createLondonWorldConfig()).build(sceneB);

    expect(
      collectPositions(sceneA, ['Phone Box', 'Pillar Box'])
    ).toEqual(
      collectPositions(sceneB, ['Phone Box', 'Pillar Box'])
    );
  });
});
