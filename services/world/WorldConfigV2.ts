import { TILE_SIZE, WORLD_SCALE, MAP_WIDTH, MAP_HEIGHT, COLORS } from '../../constants';

// ===== GEOMETRY PRIMITIVES =====

export interface PathPoint {
    x: number;  // Three.js X coordinate (0-800 range)
    z: number;  // Three.js Z coordinate (0-800 range)
}

// ===== ZONE CLASSIFICATION =====

export enum ZoneType {
    CARRIAGEWAY = 'carriageway',
    CURB = 'curb',
    FURNISHING_STRIP = 'furnishing_strip',
    CLEAR_WALK = 'clear_walk',
    CROSSWALK = 'crosswalk',
    SIGHT_TRIANGLE = 'sight_triangle',
    ROUNDABOUT_CARRIAGEWAY = 'roundabout_carriageway',
    ROUNDABOUT_ISLAND = 'roundabout_island',
    OPEN_LANDSCAPE = 'open_landscape',
    PERIMETER = 'perimeter',
}

// ===== ROAD CONFIGURATION =====

export type RoadType = 'boulevard' | 'main' | 'secondary' | 'lane';

export interface RoadSegmentConfig {
    id: string;
    name: string;
    path: PathPoint[];       // Ordered waypoints (min 2), direct Three.js coords
    type: RoadType;
    lanesPerDirection: number;
    laneWidth: number;
    carriagewayWidth: number;
    curbWidth: number;
    curbHeight: number;
    furnishingStripWidth: number;
    clearWalkWidth: number;
    oneWay?: boolean;
}

// ===== INTERSECTION CONFIGURATION =====

export type IntersectionType = 'standard' | 'roundabout' | 'T' | 'Y' | 'complex';
export type TrafficControlType = 'signal' | 'yield' | 'roundabout' | 'none';

export interface IntersectionConfigV2 {
    id: string;
    center: PathPoint;
    type: IntersectionType;
    radius: number;                // Bounding radius of intersection zone
    approachRoadIds: string[];
    approachAngles: number[];      // Radians, angle each road enters at
    // Roundabout-specific
    roundaboutInnerRadius?: number;
    roundaboutOuterRadius?: number;
    // Rendering details
    sightTriangleLeg: number;
    crosswalkWidth: number;
    stopBarOffset: number;
    controlType: TrafficControlType;
}

// ===== LANDSCAPE CONFIGURATION =====

export interface LandscapeConfig {
    formalTreeSpacing: number;
    mainStreetSpecies: 'oak' | 'pine';
    secondaryStreetSpecies: 'oak' | 'pine';
    clusterDensity: number;
    perimeterTreeBandWidth: number;
    sightTriangleClearance: number;
}

// ===== FURNITURE CONFIGURATION =====

export interface FurnitureConfig {
    streetlightSpacing: number;
    maxPointLights: number;
    benchSpacing: number;
    trashCanSpacing: number;
    hydrantSpacing: number;
    intersectionClearance: number;
    // London-specific
    bollardSpacing: number;
    phoneBoxCount: number;
    pillarBoxCount: number;
}

// ===== WORLD CONFIGURATION =====

export interface WorldConfig {
    worldWidth: number;
    worldHeight: number;
    tileSize: number;
    worldScale: number;
    mapWidth: number;
    mapHeight: number;
    colors: typeof COLORS;
    roads: RoadSegmentConfig[];
    intersections: IntersectionConfigV2[];
    landscape: LandscapeConfig;
    furniture: FurnitureConfig;
}

// ===== ROAD PRESETS =====

function boulevard(id: string, name: string, path: PathPoint[], oneWay?: boolean): RoadSegmentConfig {
    return {
        id, name, path, type: 'boulevard',
        lanesPerDirection: 2, laneWidth: 3.5,
        carriagewayWidth: 14, curbWidth: 0.4, curbHeight: 0.3,
        furnishingStripWidth: 3, clearWalkWidth: 3,
        oneWay,
    };
}

function mainRoad(id: string, name: string, path: PathPoint[], oneWay?: boolean): RoadSegmentConfig {
    return {
        id, name, path, type: 'main',
        lanesPerDirection: 1, laneWidth: 5,
        carriagewayWidth: 10, curbWidth: 0.4, curbHeight: 0.3,
        furnishingStripWidth: 2.5, clearWalkWidth: 2.5,
        oneWay,
    };
}

function secondaryRoad(id: string, name: string, path: PathPoint[], oneWay?: boolean): RoadSegmentConfig {
    return {
        id, name, path, type: 'secondary',
        lanesPerDirection: 1, laneWidth: 4.5,
        carriagewayWidth: 9, curbWidth: 0.4, curbHeight: 0.3,
        furnishingStripWidth: 2, clearWalkWidth: 2,
        oneWay,
    };
}

function lane(id: string, name: string, path: PathPoint[], oneWay?: boolean): RoadSegmentConfig {
    return {
        id, name, path, type: 'lane',
        lanesPerDirection: 1, laneWidth: 3,
        carriagewayWidth: 6, curbWidth: 0.3, curbHeight: 0.25,
        furnishingStripWidth: 1.5, clearWalkWidth: 1.5,
        oneWay,
    };
}

// ===== LONDON LAYOUT =====

export function createLondonWorldConfig(): WorldConfig {
    const worldWidth = MAP_WIDTH * TILE_SIZE * WORLD_SCALE;
    const worldHeight = MAP_HEIGHT * TILE_SIZE * WORLD_SCALE;

    const roads: RoadSegmentConfig[] = [
        // --- Boulevards (carriagewayWidth: 14) ---
        boulevard('kensington-w', 'Kensington High Street (West)', [
            { x: 0, z: 400 }, { x: 365, z: 400 },
        ]),
        boulevard('kensington-e', 'Kensington High Street (East)', [
            { x: 435, z: 400 }, { x: 800, z: 400 },
        ]),
        boulevard('park-lane-n', 'Park Lane (North)', [
            { x: 400, z: 0 }, { x: 400, z: 365 },
        ]),
        boulevard('park-lane-s', 'Park Lane (South)', [
            { x: 400, z: 435 }, { x: 400, z: 800 },
        ]),

        // --- Main Roads (carriagewayWidth: 10) ---
        mainRoad('regent-street', 'Regent Street', [
            { x: 100, z: 100 }, { x: 250, z: 250 }, { x: 370, z: 370 },
        ]),
        mainRoad('the-strand', 'The Strand', [
            { x: 430, z: 430 }, { x: 600, z: 550 }, { x: 750, z: 650 },
        ]),
        mainRoad('oxford-street', 'Oxford Street', [
            { x: 50, z: 200 }, { x: 350, z: 200 }, { x: 700, z: 200 },
        ]),
        mainRoad('whitehall', 'Whitehall', [
            { x: 600, z: 100 }, { x: 600, z: 400 },
        ]),

        // --- Secondary Roads (carriagewayWidth: 9) ---
        secondaryRoad('baker-street', 'Baker Street', [
            { x: 200, z: 50 }, { x: 200, z: 350 },
        ]),
        secondaryRoad('piccadilly', 'Piccadilly', [
            { x: 50, z: 350 }, { x: 200, z: 340 }, { x: 370, z: 390 },
        ]),
        secondaryRoad('fleet-street', 'Fleet Street', [
            { x: 200, z: 600 }, { x: 500, z: 600 }, { x: 700, z: 580 },
        ]),

        // --- Narrow Lanes (carriagewayWidth: 6) ---
        lane('carnaby-street', 'Carnaby Street', [
            { x: 280, z: 150 }, { x: 280, z: 280 },
        ]),
        lane('savile-row', 'Savile Row', [
            { x: 150, z: 200 }, { x: 150, z: 350 },
        ]),
        lane('neal-street', 'Neal Street', [
            { x: 500, z: 450 }, { x: 550, z: 500 }, { x: 580, z: 570 },
        ]),

        // --- Crescent (polyline approximation of arc) ---
        secondaryRoad('portland-crescent', 'Portland Crescent', [
            { x: 550, z: 100 },
            { x: 620, z: 120 },
            { x: 670, z: 160 },
            { x: 690, z: 220 },
            { x: 670, z: 280 },
            { x: 620, z: 320 },
            { x: 550, z: 340 },
        ]),
    ];

    const intersections: IntersectionConfigV2[] = [
        // Central roundabout
        {
            id: 'hyde-park-corner',
            center: { x: 400, z: 400 },
            type: 'roundabout',
            radius: 40,
            approachRoadIds: ['kensington-w', 'kensington-e', 'park-lane-n', 'park-lane-s', 'regent-street', 'the-strand', 'piccadilly'],
            approachAngles: [Math.PI, 0, -Math.PI / 2, Math.PI / 2, -3 * Math.PI / 4, Math.PI / 4, -Math.PI * 0.95],
            roundaboutInnerRadius: 20,
            roundaboutOuterRadius: 35,
            sightTriangleLeg: 15,
            crosswalkWidth: 4,
            stopBarOffset: 2,
            controlType: 'roundabout',
        },
        // Standard 4-way: Baker Street / Oxford Street
        {
            id: 'baker-oxford',
            center: { x: 200, z: 200 },
            type: 'standard',
            radius: 18,
            approachRoadIds: ['baker-street', 'oxford-street'],
            approachAngles: [-Math.PI / 2, Math.PI / 2, Math.PI, 0],
            sightTriangleLeg: 12,
            crosswalkWidth: 3.5,
            stopBarOffset: 1.5,
            controlType: 'signal',
        },
        // T-intersection: Baker Street ends at Kensington
        {
            id: 'baker-kensington',
            center: { x: 200, z: 400 },
            type: 'T',
            radius: 16,
            approachRoadIds: ['baker-street', 'kensington-w'],
            approachAngles: [-Math.PI / 2, Math.PI, 0],
            sightTriangleLeg: 12,
            crosswalkWidth: 3.5,
            stopBarOffset: 1.5,
            controlType: 'yield',
        },
        // T-intersection: Carnaby Street ends at Oxford Street
        {
            id: 'carnaby-oxford',
            center: { x: 280, z: 200 },
            type: 'T',
            radius: 12,
            approachRoadIds: ['carnaby-street', 'oxford-street'],
            approachAngles: [-Math.PI / 2, Math.PI, 0],
            sightTriangleLeg: 10,
            crosswalkWidth: 3,
            stopBarOffset: 1.5,
            controlType: 'none',
        },
        // T-intersection: Savile Row ends at Piccadilly
        {
            id: 'savile-piccadilly',
            center: { x: 150, z: 350 },
            type: 'T',
            radius: 12,
            approachRoadIds: ['savile-row', 'piccadilly'],
            approachAngles: [Math.PI / 2, Math.PI, 0],
            sightTriangleLeg: 10,
            crosswalkWidth: 3,
            stopBarOffset: 1.5,
            controlType: 'none',
        },
        // T-intersection: Whitehall meets Oxford Street
        {
            id: 'whitehall-oxford',
            center: { x: 600, z: 200 },
            type: 'T',
            radius: 16,
            approachRoadIds: ['whitehall', 'oxford-street'],
            approachAngles: [Math.PI / 2, Math.PI, 0],
            sightTriangleLeg: 12,
            crosswalkWidth: 3.5,
            stopBarOffset: 1.5,
            controlType: 'signal',
        },
        // T-intersection: Portland Crescent north end meets Oxford Street
        {
            id: 'crescent-north',
            center: { x: 550, z: 200 },
            type: 'T',
            radius: 14,
            approachRoadIds: ['portland-crescent', 'oxford-street'],
            approachAngles: [Math.PI / 2, Math.PI, 0],
            sightTriangleLeg: 10,
            crosswalkWidth: 3,
            stopBarOffset: 1.5,
            controlType: 'none',
        },
        // T-intersection: Portland Crescent south end
        {
            id: 'crescent-south',
            center: { x: 550, z: 340 },
            type: 'T',
            radius: 14,
            approachRoadIds: ['portland-crescent'],
            approachAngles: [-Math.PI / 2],
            sightTriangleLeg: 10,
            crosswalkWidth: 3,
            stopBarOffset: 1.5,
            controlType: 'none',
        },
    ];

    return {
        worldWidth,
        worldHeight,
        tileSize: TILE_SIZE,
        worldScale: WORLD_SCALE,
        mapWidth: MAP_WIDTH,
        mapHeight: MAP_HEIGHT,
        colors: COLORS,
        roads,
        intersections,
        landscape: {
            formalTreeSpacing: 20,
            mainStreetSpecies: 'oak',
            secondaryStreetSpecies: 'pine',
            clusterDensity: 0.8,
            perimeterTreeBandWidth: 30,
            sightTriangleClearance: 18,
        },
        furniture: {
            streetlightSpacing: 40,
            maxPointLights: 16,
            benchSpacing: 60,
            trashCanSpacing: 80,
            hydrantSpacing: 120,
            intersectionClearance: 20,
            bollardSpacing: 15,
            phoneBoxCount: 6,
            pillarBoxCount: 4,
        },
    };
}
