import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraRig } from '../../services/game/CameraRig';

describe('CameraRig', () => {
  it('orbits with clamped pitch and honours invert-Y and sensitivity', () => {
    const rig = new CameraRig(1.5);
    rig.orbit(100, 0, 0.01);
    expect(rig.theta).toBeCloseTo(-1);
    rig.orbit(0, -1000, 0.01);
    expect(rig.phi).toBeCloseTo(Math.PI / 2 - 0.1);
    rig.invertY = true;
    rig.orbit(0, -1000, 0.01);
    expect(rig.phi).toBeCloseTo(0.1);
    rig.setSensitivity(10);
    expect(rig.sensitivity).toBe(2);
  });

  it('zooms within limits and uses the wheel for fly speed in free mode', () => {
    const rig = new CameraRig(1);
    rig.zoom(-100);
    expect(rig.radius).toBe(rig.minRadius);
    rig.wheel(100000);
    expect(rig.radius).toBe(rig.maxRadius);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xffffff, 1, 2);
    expect(rig.toggleFree(scene)).toBe(true);
    expect(scene.fog).toBeNull();
    const speed = rig.freeSpeed;
    rig.wheel(-500);
    expect(rig.freeSpeed).toBeGreaterThan(speed);
    rig.fly(1, { x: 0, y: -1, vertical: 1, boost: false });
    expect(rig.camera.position.y).toBeGreaterThan(300);
    rig.freeLook(10, 10, 0.01);
    expect(rig.toggleFree(scene)).toBe(false);
    expect(scene.fog).not.toBeNull();
  });

  it('snaps behind the target at the resting radius and projects to screen', () => {
    const rig = new CameraRig(1);
    const target = new THREE.Vector3(100, 0, 100);
    rig.snap(target);
    const d = rig.camera.position.distanceTo(target.clone().add(new THREE.Vector3(0, 1.4875, 0)));
    expect(d).toBeCloseTo(rig.radius, 3);
    rig.camera.updateMatrixWorld(true);
    const s = rig.toScreen(target.clone().add(new THREE.Vector3(0, 1.4875, 0)), 800, 600);
    expect(s.x).toBeCloseTo(400, 0);
    expect(s.y).toBeCloseTo(300, 0);
  });

  it('pulls in when an occluder blocks the view', () => {
    const rig = new CameraRig(1);
    const target = new THREE.Vector3(0, 0, 0);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 0.2), new THREE.MeshBasicMaterial());
    wall.position.set(0, 2, 2);
    wall.updateMatrixWorld(true);
    rig.snap(target);
    for (let i = 0; i < 100; i++) rig.follow(target, [wall]);
    expect(rig.camera.position.z).toBeLessThan(2);
  });
});
