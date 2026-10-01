/**
 * B1: export the London map data for the Blender/UPBGE build.
 *
 *   cd web && npm run export:map
 *
 * Writes (prototype coordinates: x east, z south, metres, map spans [0, 800]):
 *   ../data/london.json  roads, junctions (with names), districts, spawn target, settings
 *   ../data/zones.json   the 2 m zone grid, one character per cell, one string per row
 *   ../data/probes.json  answers from this TypeScript code at fixed points, so the Python port
 *                        (dca/world) can prove it gives the same zones, place names and spawns
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLondonWorldConfig, ZoneType } from '../services/world/WorldConfigV2';
import { ZoneMapV2 } from '../services/world/ZoneMapV2';
import { DISTRICTS, placeNameAt } from '../services/world/Places';
import { findNearestZonePoint } from '../services/world/Spawn';
import { SPAWN_TARGET } from '../constants';

const SCHEMA = 1;
const CELL = 2;
const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../../data');

// Zone codes: one character per cell. The order is fixed; Python reads the legend from the file.
const ZONE_CODES: ZoneType[] = [
    ZoneType.OPEN_LANDSCAPE,
    ZoneType.PERIMETER,
    ZoneType.CLEAR_WALK,
    ZoneType.FURNISHING_STRIP,
    ZoneType.CURB,
    ZoneType.CARRIAGEWAY,
    ZoneType.CROSSWALK,
    ZoneType.SIGHT_TRIANGLE,
    ZoneType.ROUNDABOUT_CARRIAGEWAY,
    ZoneType.ROUNDABOUT_ISLAND,
];

const COORDS = 'prototype: x east, z south, metres, [0, worldWidth] x [0, worldHeight]; Blender (x, -z)';

function hex(n: number): string {
    return '#' + n.toString(16).padStart(6, '0');
}

function writeJson(name: string, value: unknown, indent: number | undefined = 1): void {
    const path = resolve(dataDir, name);
    writeFileSync(path, JSON.stringify(value, null, indent) + '\n');
    console.log(`wrote ${path}`);
}

const config = createLondonWorldConfig();
const zones = new ZoneMapV2(config);
mkdirSync(dataDir, { recursive: true });

// ---- london.json
const colors: Record<string, string> = {};
for (const [k, v] of Object.entries(config.colors)) colors[k] = hex(v as number);

writeJson('london.json', {
    schema: SCHEMA,
    source: 'web/services/world/WorldConfigV2.ts createLondonWorldConfig()',
    coords: COORDS,
    worldWidth: config.worldWidth,
    worldHeight: config.worldHeight,
    randomSeed: config.randomSeed,
    spawnTarget: SPAWN_TARGET,
    roads: config.roads,
    intersections: config.intersections,
    districts: DISTRICTS,
    landscape: config.landscape,
    furniture: config.furniture,
    colors,
    counts: {
        roads: config.roads.length,
        intersections: config.intersections.length,
        namedIntersections: config.intersections.filter(j => j.name).length,
        districts: DISTRICTS.length,
        roadPoints: config.roads.reduce((n, r) => n + r.path.length, 0),
    },
});

// ---- zones.json
const width = Math.ceil(config.worldWidth / CELL);
const height = Math.ceil(config.worldHeight / CELL);
const rows: string[] = [];
const zoneCounts: Record<string, number> = {};
for (const z of ZONE_CODES) zoneCounts[z] = 0;
for (let row = 0; row < height; row++) {
    let line = '';
    for (let col = 0; col < width; col++) {
        const zone = zones.getZone((col + 0.5) * CELL, (row + 0.5) * CELL);
        const code = ZONE_CODES.indexOf(zone);
        if (code < 0) throw new Error(`zone ${zone} has no code`);
        line += String(code);
        zoneCounts[zone]++;
    }
    rows.push(line);
}

writeJson('zones.json', {
    schema: SCHEMA,
    source: 'web/services/world/ZoneMapV2.ts',
    coords: COORDS,
    cellSize: CELL,
    width,
    height,
    outside: ZoneType.OPEN_LANDSCAPE,
    legend: ZONE_CODES,
    rows,
    counts: zoneCounts,
});

// ---- probes.json (golden answers for the Python port)
const keySpots: Record<string, { x: number; z: number }> = {
    spawnTarget: SPAWN_TARGET,
    oxfordCircus: { x: 430, z: 260 },
    piccadillyCircus: { x: 430, z: 390 },
    trafalgarSquare: { x: 530, z: 490 },
    hydeParkCorner: { x: 240, z: 400 },
};

// Each point is [x, z, zone, place name].
const points: [number, number, string, string][] = [];
const STEP = 17;
for (let z = 3.3; z < config.worldHeight; z += STEP) {
    for (let x = 4.7; x < config.worldWidth; x += STEP) {
        const px = Math.round(x * 10) / 10;
        const pz = Math.round(z * 10) / 10;
        points.push([px, pz, zones.getZone(px, pz), placeNameAt(config, px, pz)]);
    }
}
for (const p of Object.values(keySpots)) {
    points.push([p.x, p.z, zones.getZone(p.x, p.z), placeNameAt(config, p.x, p.z)]);
}

const spawnFrom = [
    ...Object.values(keySpots),
    { x: 100, z: 200 }, { x: 600, z: 262 }, { x: 700, z: 700 }, { x: 15, z: 15 }, { x: 400, z: 320 },
];
const spawns = spawnFrom.map(p => ({
    x: p.x,
    z: p.z,
    type: ZoneType.CLEAR_WALK,
    result: findNearestZonePoint(zones, p.x, p.z, ZoneType.CLEAR_WALK),
}));

writeJson('probes.json', {
    schema: SCHEMA,
    source: 'web/scripts/export_map.ts',
    coords: COORDS,
    keySpots,
    pointFields: ['x', 'z', 'zone', 'place'],
    points,
    spawns,
}, undefined);
