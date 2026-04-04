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
//
// Geographically accurate relative positions (800x800 world):
//   X axis = West(0) to East(800)
//   Z axis = North(0) to South(800)
//
// Key landmarks:
//   Hyde Park Corner roundabout: (240, 400) -- Park Lane meets Piccadilly
//   Oxford Circus:               (430, 260) -- Regent St crosses Oxford St
//   Piccadilly Circus:           (430, 390) -- Regent St meets Piccadilly
//   Trafalgar Square:            (530, 490) -- Strand meets Whitehall
//   Park Crescent:               (460, 100) -- Portland Place meets Marylebone Rd
//

export function createLondonWorldConfig(): WorldConfig {
    const worldWidth = MAP_WIDTH * TILE_SIZE * WORLD_SCALE;
    const worldHeight = MAP_HEIGHT * TILE_SIZE * WORLD_SCALE;

    const roads: RoadSegmentConfig[] = [
        // ============================================================
        // BOULEVARDS (carriagewayWidth: 14)
        // ============================================================

        // Oxford Street: major E-W artery through the West End
        // Runs from Marble Arch (Park Lane) east past Oxford Circus
        boulevard('oxford-street-w', 'Oxford Street (West)', [
            { x: 50, z: 260 }, { x: 222, z: 260 },
        ]),
        boulevard('oxford-street-e', 'Oxford Street (East)', [
            { x: 258, z: 260 }, { x: 430, z: 260 }, { x: 700, z: 260 },
        ]),

        // Park Lane: N-S along eastern edge of Hyde Park
        // From Marble Arch (north) to Hyde Park Corner (south)
        boulevard('park-lane', 'Park Lane', [
            { x: 240, z: 80 }, { x: 240, z: 365 },
        ]),

        // ============================================================
        // MAIN ROADS (carriagewayWidth: 10)
        // ============================================================

        // Regent Street: N-S through the West End
        // From Portland Place / Langham Place (north) through Oxford Circus
        // then via the Quadrant curve to Piccadilly Circus (south)
        mainRoad('regent-street-n', 'Regent Street (North)', [
            { x: 430, z: 80 }, { x: 430, z: 242 },
        ]),
        mainRoad('regent-street-s', 'Regent Street (South)', [
            { x: 430, z: 278 }, { x: 430, z: 390 },
        ]),

        // Piccadilly: E-W from Hyde Park Corner east to Piccadilly Circus
        mainRoad('piccadilly', 'Piccadilly', [
            { x: 275, z: 400 }, { x: 350, z: 395 }, { x: 412, z: 390 },
        ]),

        // The Strand: E-W from Trafalgar Square east (becomes Fleet Street)
        mainRoad('the-strand', 'The Strand', [
            { x: 548, z: 490 }, { x: 650, z: 490 }, { x: 710, z: 490 },
        ]),

        // Fleet Street: continuation of The Strand heading east toward the City
        mainRoad('fleet-street', 'Fleet Street', [
            { x: 710, z: 490 }, { x: 780, z: 490 },
        ]),

        // Whitehall: N-S from Trafalgar Square south to Parliament
        mainRoad('whitehall', 'Whitehall', [
            { x: 530, z: 508 }, { x: 530, z: 700 },
        ]),

        // Kensington Road: E-W, west of Hyde Park Corner (simplified as Kensington High St)
        mainRoad('kensington', 'Kensington High Street', [
            { x: 0, z: 400 }, { x: 205, z: 400 },
        ]),

        // ============================================================
        // SECONDARY ROADS (carriagewayWidth: 9)
        // ============================================================

        // Baker Street: N-S in Marylebone, meets Oxford Street at its south end
        secondaryRoad('baker-street', 'Baker Street', [
            { x: 310, z: 50 }, { x: 310, z: 260 },
        ]),

        // Portland Place: wide N-S boulevard north of Oxford Circus
        // Connects to Regent Street via Langham Place
        // Park Crescent at north end (curved terrace facing Regent's Park)
        secondaryRoad('portland-place', 'Portland Place', [
            { x: 460, z: 60 },
            { x: 458, z: 100 },  // Park Crescent area
            { x: 450, z: 150 },
            { x: 440, z: 200 },
            { x: 432, z: 242 },  // merges into Regent St at Langham Place
        ]),

        // Shaftesbury Avenue: NE from Piccadilly Circus toward Covent Garden area
        secondaryRoad('shaftesbury-ave', 'Shaftesbury Avenue', [
            { x: 448, z: 390 }, { x: 530, z: 350 }, { x: 620, z: 320 },
        ]),

        // Charing Cross Road: N-S connecting Leicester Square area to Trafalgar Sq
        secondaryRoad('charing-cross-rd', 'Charing Cross Road', [
            { x: 500, z: 300 }, { x: 510, z: 400 }, { x: 530, z: 472 },
        ]),

        // ============================================================
        // NARROW LANES (carriagewayWidth: 6)
        // ============================================================

        // Carnaby Street: short N-S lane in Soho, just south of Oxford St, west of Regent St
        lane('carnaby-street', 'Carnaby Street', [
            { x: 400, z: 275 }, { x: 400, z: 370 },
        ]),

        // Savile Row: N-S in Mayfair, between Regent St and Bond St area
        lane('savile-row', 'Savile Row', [
            { x: 380, z: 300 }, { x: 380, z: 400 },
        ]),

        // Neal Street: short lane in Covent Garden
        lane('neal-street', 'Neal Street', [
            { x: 600, z: 380 }, { x: 600, z: 460 },
        ]),

        // Bond Street: N-S luxury shopping street in Mayfair
        lane('bond-street', 'Bond Street', [
            { x: 350, z: 260 }, { x: 350, z: 400 },
        ]),
    ];

    const intersections: IntersectionConfigV2[] = [
        // ============================================================
        // HYDE PARK CORNER -- roundabout
        // Park Lane (from north) meets Piccadilly (from east) and Kensington (from west)
        // ============================================================
        {
            id: 'hyde-park-corner',
            center: { x: 240, z: 400 },
            type: 'roundabout',
            radius: 35,
            approachRoadIds: ['park-lane', 'piccadilly', 'kensington'],
            approachAngles: [-Math.PI / 2, 0, Math.PI],
            roundaboutInnerRadius: 16,
            roundaboutOuterRadius: 30,
            sightTriangleLeg: 12,
            crosswalkWidth: 4,
            stopBarOffset: 2,
            controlType: 'roundabout',
        },

        // ============================================================
        // OXFORD CIRCUS -- Regent St (N-S) crosses Oxford St (E-W)
        // Famous 4-way signal-controlled intersection
        // ============================================================
        {
            id: 'oxford-circus',
            center: { x: 430, z: 260 },
            type: 'standard',
            radius: 18,
            approachRoadIds: ['regent-street-n', 'regent-street-s', 'oxford-street-e'],
            approachAngles: [-Math.PI / 2, Math.PI / 2, Math.PI, 0],
            sightTriangleLeg: 12,
            crosswalkWidth: 4,
            stopBarOffset: 1.5,
            controlType: 'signal',
        },

        // ============================================================
        // PICCADILLY CIRCUS -- Regent St meets Piccadilly
        // Historically a circus (circular junction), now an open junction
        // ============================================================
        {
            id: 'piccadilly-circus',
            center: { x: 430, z: 390 },
            type: 'roundabout',
            radius: 22,
            approachRoadIds: ['regent-street-s', 'piccadilly', 'shaftesbury-ave', 'charing-cross-rd'],
            approachAngles: [-Math.PI / 2, Math.PI, Math.PI / 4, Math.PI / 2],
            roundaboutInnerRadius: 8,
            roundaboutOuterRadius: 18,
            sightTriangleLeg: 10,
            crosswalkWidth: 3.5,
            stopBarOffset: 1.5,
            controlType: 'roundabout',
        },

        // ============================================================
        // TRAFALGAR SQUARE -- The Strand meets Whitehall
        // Large public square with traffic flowing around
        // ============================================================
        {
            id: 'trafalgar-square',
            center: { x: 530, z: 490 },
            type: 'roundabout',
            radius: 25,
            approachRoadIds: ['the-strand', 'whitehall', 'charing-cross-rd'],
            approachAngles: [0, Math.PI / 2, -Math.PI / 2],
            roundaboutInnerRadius: 12,
            roundaboutOuterRadius: 22,
            sightTriangleLeg: 10,
            crosswalkWidth: 3.5,
            stopBarOffset: 1.5,
            controlType: 'roundabout',
        },

        // ============================================================
        // MARBLE ARCH -- Park Lane meets Oxford Street (west end)
        // ============================================================
        {
            id: 'marble-arch',
            center: { x: 240, z: 260 },
            type: 'T',
            radius: 16,
            approachRoadIds: ['park-lane', 'oxford-street-w'],
            approachAngles: [-Math.PI / 2, Math.PI, 0],
            sightTriangleLeg: 12,
            crosswalkWidth: 3.5,
            stopBarOffset: 1.5,
            controlType: 'signal',
        },

        // ============================================================
        // BAKER STREET / OXFORD STREET
        // Baker St meets Oxford St from the north
        // ============================================================
        {
            id: 'baker-oxford',
            center: { x: 310, z: 260 },
            type: 'T',
            radius: 14,
            approachRoadIds: ['baker-street', 'oxford-street-w'],
            approachAngles: [-Math.PI / 2, Math.PI, 0],
            sightTriangleLeg: 10,
            crosswalkWidth: 3.5,
            stopBarOffset: 1.5,
            controlType: 'signal',
        },

        // ============================================================
        // CARNABY / OXFORD STREET (pedestrian connection)
        // ============================================================
        {
            id: 'carnaby-oxford',
            center: { x: 400, z: 267 },
            type: 'T',
            radius: 10,
            approachRoadIds: ['carnaby-street', 'oxford-street-e'],
            approachAngles: [Math.PI / 2, Math.PI, 0],
            sightTriangleLeg: 8,
            crosswalkWidth: 3,
            stopBarOffset: 1.5,
            controlType: 'none',
        },

        // ============================================================
        // STRAND / FLEET STREET junction (continuous road, marked for clarity)
        // Near Temple Bar / Royal Courts of Justice
        // ============================================================
        {
            id: 'strand-fleet',
            center: { x: 710, z: 490 },
            type: 'standard',
            radius: 10,
            approachRoadIds: ['the-strand', 'fleet-street'],
            approachAngles: [Math.PI, 0],
            sightTriangleLeg: 8,
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
