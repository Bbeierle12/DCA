import { WorldConfig, getCarriagewayWidth } from './WorldConfigV2';
import { closestPointOnSegment, polylineSegments } from './RoadGeometry';

/**
 * Human place names for the HUD, from the world config: a named junction if you're at one,
 * otherwise the street you're on, otherwise the district, otherwise "West End".
 */

interface District {
    name: string;
    x0: number;
    z0: number;
    x1: number;
    z1: number;
}

// Rough real-world districts on the 800 m West End map (x east, z south). First match wins.
export const DISTRICTS: District[] = [
    { name: 'Hyde Park', x0: 0, z0: 0, x1: 236, z1: 395 },
    { name: 'Marylebone', x0: 236, z0: 0, x1: 430, z1: 258 },
    { name: 'Fitzrovia', x0: 430, z0: 0, x1: 520, z1: 258 },
    { name: 'Bloomsbury', x0: 520, z0: 0, x1: 800, z1: 258 },
    { name: 'Mayfair', x0: 236, z0: 258, x1: 430, z1: 395 },
    { name: 'Soho', x0: 430, z0: 258, x1: 505, z1: 400 },
    { name: 'Covent Garden', x0: 505, z0: 258, x1: 650, z1: 480 },
    { name: 'Temple', x0: 650, z0: 258, x1: 800, z1: 560 },
    { name: "St James's", x0: 236, z0: 395, x1: 530, z1: 520 },
    { name: 'Knightsbridge', x0: 0, z0: 395, x1: 236, z1: 800 },
    { name: 'Westminster', x0: 236, z0: 520, x1: 800, z1: 800 },
];

const JUNCTION_MARGIN = 8;
const STREET_MARGIN = 6;

/** "Oxford Street (East)" -> "Oxford Street". */
export function streetName(name: string): string {
    return name.replace(/\s*\([^)]*\)\s*$/, '');
}

export function placeNameAt(config: WorldConfig, x: number, z: number): string {
    const p = { x, z };
    for (const j of config.intersections) {
        if (!j.name) continue;
        if (Math.hypot(x - j.center.x, z - j.center.z) <= j.radius + JUNCTION_MARGIN) return j.name;
    }

    let best: { name: string; gap: number } | null = null;
    for (const road of config.roads) {
        const halfWidth = getCarriagewayWidth(road) / 2 + road.curbWidth + road.furnishingStripWidth + road.clearWalkWidth;
        for (const seg of polylineSegments(road.path)) {
            const d = closestPointOnSegment(seg, p).distance;
            const gap = d - halfWidth;
            if (gap <= STREET_MARGIN && (!best || gap < best.gap)) best = { name: streetName(road.name), gap };
        }
    }
    if (best) return best.name;

    const district = DISTRICTS.find(d => x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1);
    return district?.name ?? 'West End';
}

/** Caches the last answer so per-frame calls are cheap while standing still. */
export class PlaceNamer {
    private lastX = Number.NaN;
    private lastZ = Number.NaN;
    private last = '';

    constructor(private config: WorldConfig) {}

    at(x: number, z: number): string {
        if (Math.abs(x - this.lastX) < 1 && Math.abs(z - this.lastZ) < 1) return this.last;
        this.lastX = x;
        this.lastZ = z;
        this.last = placeNameAt(this.config, x, z);
        return this.last;
    }
}
