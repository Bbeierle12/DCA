import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createStickFigure } from '../../services/StickFigure';
import { PLAYER_HEIGHT } from '../../constants';

const cfg = { skin: '#ffccaa', hair: '#4a3021', eyes: '#000000', shirt: '#ff5555', pants: '#5555ff', name: 'T', pet: null };

describe('StickFigure scale', () => {
  it('stands 1.75 m tall with feet on the ground', () => {
    const fig = createStickFigure(cfg);
    fig.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(fig);
    expect(box.max.y - box.min.y).toBeGreaterThan(PLAYER_HEIGHT - 0.05);
    expect(box.max.y - box.min.y).toBeLessThan(PLAYER_HEIGHT + 0.05);
    expect(Math.abs(box.min.y)).toBeLessThan(0.01);
  });

  it('is roughly human-proportioned in width', () => {
    const fig = createStickFigure(cfg);
    fig.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(fig).getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(0.3);
    expect(size.x).toBeLessThan(0.8);
  });
});
