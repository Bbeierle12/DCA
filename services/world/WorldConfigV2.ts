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
export type LaneKind = 'general' | 'bus' | 'cycle';
export type LaneDirection = 'forward' | 'backward';
export type KerbsideUse = 'planting' | 'loading' | 'parking' | 'transit_stop';
export type KerbMarking = 'none' | 'single_yellow' | 'double_yellow' | 'single_red' | 'double_red';

export interface LaneConfig {
    kind: LaneKind;
    direction: LaneDirection;
    width: number;
}

export interface KerbsideConfig {
    width: number;
    clearWalkWidth: number;
    use: KerbsideUse;
    marking: KerbMarking;
}

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
    laneLayout?: LaneConfig[];
    leftKerbside?: KerbsideConfig;
    rightKerbside?: KerbsideConfig;
}

// ===== INTERSECTION CONFIGURATION =====

export type IntersectionType = 'standard' | 'roundabout' | 'T' | 'Y' | 'complex';
export type CrossingType = 'signal' | 'zebra' | 'informal' | 'none';
export type ArmControlType = 'signal' | 'give_way' | 'priority' | 'none';

export interface IntersectionArmConfig {
    roadId: string;
    angle: number;
    crossing: CrossingType;
    control: ArmControlType;
    stopLine?: boolean;
}

export interface IntersectionConfigV2 {
    id: string;
    center: PathPoint;
    type: IntersectionType;
    radius: number;                // Bounding radius of intersection zone
    arms: IntersectionArmConfig[];
    // Roundabout-specific
    roundaboutInnerRadius?: number;
    roundaboutOuterRadius?: number;
    // Rendering details
    sightTriangleLeg: number;
    crosswalkWidth: number;
    stopBarOffset: number;
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
    randomSeed: number;
    roads: RoadSegmentConfig[];
    intersections: IntersectionConfigV2[];
    landscape: LandscapeConfig;
    furniture: FurnitureConfig;
}

interface RoadPresetOptions {
    oneWay?: boolean;
    laneLayout?: LaneConfig[];
    leftKerbside?: Partial<KerbsideConfig>;
    rightKerbside?: Partial<KerbsideConfig>;
}

function sumLaneWidths(lanes: LaneConfig[]): number {
    return lanes.reduce((total, lane) => total + lane.width, 0);
}

function defaultKerbMarking(type: RoadType): KerbMarking {
    switch (type) {
        case 'boulevard':
            return 'double_red';
        case 'main':
            return 'double_yellow';
        case 'secondary':
            return 'single_yellow';
        default:
            return 'none';
    }
}

function createKerbsideConfig(
    type: RoadType,
    width: number,
    clearWalkWidth: number,
    override?: Partial<KerbsideConfig>
): KerbsideConfig {
    return {
        width,
        clearWalkWidth,
        use: 'planting',
        marking: defaultKerbMarking(type),
        ...override,
    };
}

function createDefaultLaneLayout(
    type: RoadType,
    laneWidth: number,
    lanesPerDirection: number,
    oneWay?: boolean
): LaneConfig[] {
    const layout: LaneConfig[] = [];
    if (oneWay) {
        for (let i = 0; i < lanesPerDirection * 2; i++) {
            layout.push({ kind: 'general', direction: 'forward', width: laneWidth });
        }
        return layout;
    }

    for (let i = 0; i < lanesPerDirection; i++) {
        layout.push({ kind: 'general', direction: 'forward', width: laneWidth });
    }
    for (let i = 0; i < lanesPerDirection; i++) {
        layout.push({ kind: 'general', direction: 'backward', width: laneWidth });
    }

    if (type === 'lane' && layout.length === 0) {
        return [{ kind: 'general', direction: 'forward', width: laneWidth }];
    }
    return layout;
}

function buildRoadConfig(
    id: string,
    name: string,
    path: PathPoint[],
    type: RoadType,
    laneWidth: number,
    lanesPerDirection: number,
    curbWidth: number,
    curbHeight: number,
    furnishingStripWidth: number,
    clearWalkWidth: number,
    options: RoadPresetOptions = {}
): RoadSegmentConfig {
    const laneLayout = options.laneLayout || createDefaultLaneLayout(type, laneWidth, lanesPerDirection, options.oneWay);
    const carriagewayWidth = sumLaneWidths(laneLayout);
    return {
        id,
        name,
        path,
        type,
        lanesPerDirection,
        laneWidth,
        carriagewayWidth,
        curbWidth,
        curbHeight,
        furnishingStripWidth,
        clearWalkWidth,
        oneWay: options.oneWay,
        laneLayout,
        leftKerbside: createKerbsideConfig(type, furnishingStripWidth, clearWalkWidth, options.leftKerbside),
        rightKerbside: createKerbsideConfig(type, furnishingStripWidth, clearWalkWidth, options.rightKerbside),
    };
}

export function getLaneLayout(road: RoadSegmentConfig): LaneConfig[] {
    return road.laneLayout && road.laneLayout.length > 0
        ? road.laneLayout
        : createDefaultLaneLayout(road.type, road.laneWidth, road.lanesPerDirection, road.oneWay);
}

export function getCarriagewayWidth(road: RoadSegmentConfig): number {
    return sumLaneWidths(getLaneLayout(road));
}

export function getKerbsideConfig(road: RoadSegmentConfig, side: 'left' | 'right'): KerbsideConfig {
    const override = side === 'left' ? road.leftKerbside : road.rightKerbside;
    if (override) {
        return override;
    }
    return createKerbsideConfig(road.type, road.furnishingStripWidth, road.clearWalkWidth);
}

// ===== ROAD PRESETS =====

function boulevard(id: string, name: string, path: PathPoint[], options: RoadPresetOptions = {}): RoadSegmentConfig {
    return buildRoadConfig(
        id, name, path, 'boulevard',
        3.5, 2, 0.4, 0.3, 3, 3, options
    );
}

function mainRoad(id: string, name: string, path: PathPoint[], options: RoadPresetOptions = {}): RoadSegmentConfig {
    return buildRoadConfig(
        id, name, path, 'main',
        5, 1, 0.4, 0.3, 2.5, 2.5, options
    );
}

function secondaryRoad(id: string, name: string, path: PathPoint[], options: RoadPresetOptions = {}): RoadSegmentConfig {
    return buildRoadConfig(
        id, name, path, 'secondary',
        4.5, 1, 0.4, 0.3, 2, 2, options
    );
}

function lane(id: string, name: string, path: PathPoint[], options: RoadPresetOptions = {}): RoadSegmentConfig {
    return buildRoadConfig(
        id, name, path, 'lane',
        3, 1, 0.3, 0.25, 1.5, 1.5, options
    );
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
        ], {
            laneLayout: [
                { kind: 'bus', direction: 'forward', width: 3.3 },
                { kind: 'general', direction: 'forward', width: 3.7 },
                { kind: 'general', direction: 'backward', width: 3.7 },
                { kind: 'bus', direction: 'backward', width: 3.3 },
            ],
            leftKerbside: { use: 'loading', marking: 'double_yellow' },
            rightKerbside: { use: 'loading', marking: 'double_yellow' },
        }),
        boulevard('oxford-street-e', 'Oxford Street (East)', [
            { x: 258, z: 260 }, { x: 430, z: 260 }, { x: 700, z: 260 },
        ], {
            laneLayout: [
                { kind: 'bus', direction: 'forward', width: 3.3 },
                { kind: 'general', direction: 'forward', width: 3.7 },
                { kind: 'general', direction: 'backward', width: 3.7 },
                { kind: 'bus', direction: 'backward', width: 3.3 },
            ],
            leftKerbside: { use: 'loading', marking: 'double_yellow' },
            rightKerbside: { use: 'loading', marking: 'double_yellow' },
        }),

        // Park Lane: N-S along eastern edge of Hyde Park
        // From Marble Arch (north) to Hyde Park Corner (south)
        boulevard('park-lane', 'Park Lane', [
            { x: 240, z: 80 }, { x: 240, z: 365 },
        ], {
            oneWay: true,
            laneLayout: [
                { kind: 'cycle', direction: 'forward', width: 1.8 },
                { kind: 'general', direction: 'forward', width: 4.1 },
                { kind: 'general', direction: 'forward', width: 4.1 },
                { kind: 'bus', direction: 'forward', width: 4.0 },
            ],
            leftKerbside: { use: 'planting', marking: 'double_red' },
            rightKerbside: { use: 'transit_stop', marking: 'double_red' },
        }),

        // ============================================================
        // MAIN ROADS (carriagewayWidth: 10)
        // ============================================================

        // Regent Street: N-S through the West End
        // From Portland Place / Langham Place (north) through Oxford Circus
        // then via the Quadrant curve to Piccadilly Circus (south)
        mainRoad('regent-street-n', 'Regent Street (North)', [
            { x: 430, z: 80 }, { x: 430, z: 242 },
        ], {
            laneLayout: [
                { kind: 'cycle', direction: 'forward', width: 1.5 },
                { kind: 'general', direction: 'forward', width: 3.5 },
                { kind: 'general', direction: 'backward', width: 3.5 },
                { kind: 'cycle', direction: 'backward', width: 1.5 },
            ],
            leftKerbside: { use: 'loading' },
            rightKerbside: { use: 'loading' },
        }),
        mainRoad('regent-street-s', 'Regent Street (South)', [
            { x: 430, z: 278 }, { x: 430, z: 390 },
        ], {
            laneLayout: [
                { kind: 'cycle', direction: 'forward', width: 1.5 },
                { kind: 'general', direction: 'forward', width: 3.5 },
                { kind: 'general', direction: 'backward', width: 3.5 },
                { kind: 'cycle', direction: 'backward', width: 1.5 },
            ],
            leftKerbside: { use: 'loading' },
            rightKerbside: { use: 'loading' },
        }),

        // Piccadilly: E-W from Hyde Park Corner east to Piccadilly Circus
        mainRoad('piccadilly', 'Piccadilly', [
            { x: 275, z: 400 }, { x: 350, z: 395 }, { x: 412, z: 390 },
        ], {
            laneLayout: [
                { kind: 'bus', direction: 'forward', width: 3.1 },
                { kind: 'general', direction: 'forward', width: 3.4 },
                { kind: 'general', direction: 'backward', width: 3.5 },
            ],
            leftKerbside: { use: 'loading', marking: 'double_yellow' },
            rightKerbside: { use: 'planting', marking: 'double_yellow' },
        }),

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
        ], {
            laneLayout: [
                { kind: 'cycle', direction: 'forward', width: 1.5 },
                { kind: 'general', direction: 'forward', width: 3.0 },
                { kind: 'general', direction: 'backward', width: 3.0 },
                { kind: 'cycle', direction: 'backward', width: 1.5 },
            ],
        }),

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
        ], {
            oneWay: true,
            laneLayout: [
                { kind: 'general', direction: 'forward', width: 3.0 },
                { kind: 'cycle', direction: 'forward', width: 3.0 },
            ],
            leftKerbside: { use: 'parking' },
            rightKerbside: { use: 'loading' },
        }),

        // Savile Row: N-S in Mayfair, between Regent St and Bond St area
        lane('savile-row', 'Savile Row', [
            { x: 380, z: 300 }, { x: 380, z: 400 },
        ]),

        // Neal Street: short lane in Covent Garden
        lane('neal-street', 'Neal Street', [
            { x: 600, z: 380 }, { x: 600, z: 460 },
        ], {
            oneWay: true,
            leftKerbside: { use: 'parking' },
            rightKerbside: { use: 'loading' },
        }),

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
            arms: [
                { roadId: 'park-lane', angle: -Math.PI / 2, crossing: 'none', control: 'give_way' },
                { roadId: 'piccadilly', angle: 0, crossing: 'zebra', control: 'give_way' },
                { roadId: 'kensington', angle: Math.PI, crossing: 'zebra', control: 'give_way' },
            ],
            roundaboutInnerRadius: 16,
            roundaboutOuterRadius: 30,
            sightTriangleLeg: 12,
            crosswalkWidth: 4,
            stopBarOffset: 2,
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
            arms: [
                { roadId: 'regent-street-n', angle: -Math.PI / 2, crossing: 'signal', control: 'signal', stopLine: true },
                { roadId: 'regent-street-s', angle: Math.PI / 2, crossing: 'signal', control: 'signal', stopLine: true },
                { roadId: 'oxford-street-w', angle: Math.PI, crossing: 'signal', control: 'signal', stopLine: true },
                { roadId: 'oxford-street-e', angle: 0, crossing: 'signal', control: 'signal', stopLine: true },
            ],
            sightTriangleLeg: 12,
            crosswalkWidth: 4,
            stopBarOffset: 1.5,
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
            arms: [
                { roadId: 'regent-street-s', angle: -Math.PI / 2, crossing: 'signal', control: 'signal', stopLine: true },
                { roadId: 'piccadilly', angle: Math.PI, crossing: 'signal', control: 'signal', stopLine: true },
                { roadId: 'shaftesbury-ave', angle: Math.PI / 4, crossing: 'signal', control: 'signal', stopLine: true },
                { roadId: 'charing-cross-rd', angle: Math.PI / 2, crossing: 'signal', control: 'signal', stopLine: true },
            ],
            roundaboutInnerRadius: 8,
            roundaboutOuterRadius: 18,
            sightTriangleLeg: 10,
            crosswalkWidth: 3.5,
            stopBarOffset: 1.5,
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
            arms: [
                { roadId: 'the-strand', angle: 0, crossing: 'signal', control: 'signal', stopLine: true },
                { roadId: 'whitehall', angle: Math.PI / 2, crossing: 'signal', control: 'signal', stopLine: true },
                { roadId: 'charing-cross-rd', angle: -Math.PI / 2, crossing: 'signal', control: 'signal', stopLine: true },
            ],
            roundaboutInnerRadius: 12,
            roundaboutOuterRadius: 22,
            sightTriangleLeg: 10,
            crosswalkWidth: 3.5,
            stopBarOffset: 1.5,
        },

        // ============================================================
        // MARBLE ARCH -- Park Lane meets Oxford Street (west end)
        // ============================================================
        {
            id: 'marble-arch',
            center: { x: 240, z: 260 },
            type: 'T',
            radius: 16,
            arms: [
                { roadId: 'park-lane', angle: -Math.PI / 2, crossing: 'signal', control: 'signal', stopLine: true },
                { roadId: 'oxford-street-w', angle: Math.PI, crossing: 'signal', control: 'signal', stopLine: true },
                { roadId: 'oxford-street-e', angle: 0, crossing: 'signal', control: 'signal', stopLine: true },
            ],
            sightTriangleLeg: 12,
            crosswalkWidth: 3.5,
            stopBarOffset: 1.5,
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
            arms: [
                { roadId: 'baker-street', angle: -Math.PI / 2, crossing: 'signal', control: 'signal', stopLine: true },
                { roadId: 'oxford-street-w', angle: Math.PI, crossing: 'signal', control: 'signal', stopLine: true },
                { roadId: 'oxford-street-e', angle: 0, crossing: 'signal', control: 'signal', stopLine: true },
            ],
            sightTriangleLeg: 10,
            crosswalkWidth: 3.5,
            stopBarOffset: 1.5,
        },

        // ============================================================
        // CARNABY / OXFORD STREET (pedestrian connection)
        // ============================================================
        {
            id: 'carnaby-oxford',
            center: { x: 400, z: 267 },
            type: 'T',
            radius: 10,
            arms: [
                { roadId: 'carnaby-street', angle: Math.PI / 2, crossing: 'zebra', control: 'priority' },
                { roadId: 'oxford-street-w', angle: Math.PI, crossing: 'none', control: 'priority' },
                { roadId: 'oxford-street-e', angle: 0, crossing: 'none', control: 'priority' },
            ],
            sightTriangleLeg: 8,
            crosswalkWidth: 3,
            stopBarOffset: 1.5,
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
            arms: [
                { roadId: 'the-strand', angle: Math.PI, crossing: 'none', control: 'priority' },
                { roadId: 'fleet-street', angle: 0, crossing: 'none', control: 'priority' },
            ],
            sightTriangleLeg: 8,
            crosswalkWidth: 3,
            stopBarOffset: 1.5,
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
        randomSeed: 19760401,
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
