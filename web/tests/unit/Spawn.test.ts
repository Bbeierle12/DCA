import { describe, it, expect } from 'vitest';
import { findNearestZonePoint } from '../../services/world/Spawn';
import { ZoneType, createLondonWorldConfig } from '../../services/world/WorldConfigV2';
import { ZoneMapV2 } from '../../services/world/ZoneMapV2';
import { SPAWN_TARGET } from '../../constants';

describe('findNearestZonePoint', () => {
  const stripe = {
    // Pavement only in the band 10 <= z < 12
    getZone: (_x: number, z: number) => (z >= 10 && z < 12 ? ZoneType.CLEAR_WALK : ZoneType.CARRIAGEWAY),
  };

  it('returns the start point when it already matches', () => {
    expect(findNearestZonePoint(stripe, 3, 11, ZoneType.CLEAR_WALK)).toEqual({ x: 3, z: 11 });
  });

  it('finds the nearest matching cell centre', () => {
    const p = findNearestZonePoint(stripe, 3, 5, ZoneType.CLEAR_WALK)!;
    expect(stripe.getZone(p.x, p.z)).toBe(ZoneType.CLEAR_WALK);
    expect(Math.hypot(p.x - 3, p.z - 5)).toBeLessThan(8);
  });

  it('gives up beyond the search radius', () => {
    expect(findNearestZonePoint(stripe, 3, 200, ZoneType.CLEAR_WALK, 20)).toBeNull();
  });

  it('puts the London spawn on a pavement near Oxford Circus', () => {
    const zones = new ZoneMapV2(createLondonWorldConfig());
    const p = findNearestZonePoint(zones, SPAWN_TARGET.x, SPAWN_TARGET.z, ZoneType.CLEAR_WALK)!;
    expect(p).not.toBeNull();
    expect(zones.getZone(p.x, p.z)).toBe(ZoneType.CLEAR_WALK);
    expect(Math.hypot(p.x - 430, p.z - 260)).toBeLessThan(60);
  });
});
