import { ZoneType } from './WorldConfigV2';

export interface ZoneLookup {
    getZone(x: number, z: number): ZoneType;
}

/**
 * Finds the point of the given zone type nearest to (x, z), searching outward in rings.
 * Returns the centre of the matching 2 m zone cell, or null if none within maxRadius.
 */
export function findNearestZonePoint(
    zones: ZoneLookup,
    x: number,
    z: number,
    type: ZoneType,
    maxRadius = 80,
    step = 0.5,
): { x: number; z: number } | null {
    if (zones.getZone(x, z) === type) return { x, z };
    for (let r = step; r <= maxRadius; r += step) {
        // Walk the ring at radius r with roughly `step` spacing, nearest-first along the ring
        const samples = Math.max(8, Math.ceil((2 * Math.PI * r) / step));
        let best: { x: number; z: number } | null = null;
        for (let i = 0; i < samples; i++) {
            const a = (i / samples) * Math.PI * 2;
            const px = x + Math.cos(a) * r;
            const pz = z + Math.sin(a) * r;
            if (zones.getZone(px, pz) === type) {
                best = { x: px, z: pz };
                break;
            }
        }
        if (best) {
            // Settle into the middle of the zone cell so we don't spawn on a boundary.
            const cx = Math.floor(best.x / 2) * 2 + 1;
            const cz = Math.floor(best.z / 2) * 2 + 1;
            return zones.getZone(cx, cz) === type ? { x: cx, z: cz } : best;
        }
    }
    return null;
}
