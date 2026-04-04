import { TILE_SIZE, WORLD_SCALE, MAP_WIDTH, MAP_HEIGHT, COLORS, STREETLIGHT_SPACING } from '../../constants';

// Zone type classification
export enum ZoneType {
    CARRIAGEWAY = 'carriageway',
    CURB = 'curb',
    FURNISHING_STRIP = 'furnishing_strip',
    CLEAR_WALK = 'clear_walk',
    CROSSWALK = 'crosswalk',
    SIGHT_TRIANGLE = 'sight_triangle',
    OPEN_LANDSCAPE = 'open_landscape',
    BUILDING_PAD = 'building_pad',
    PERIMETER = 'perimeter',
}

export interface RoadConfig {
    // Position of road centerline in world units
    centerline: number;
    // Direction: 'horizontal' (along X axis) or 'vertical' (along Z axis)
    direction: 'horizontal' | 'vertical';
    // Road type affects lane markings and tree species
    type: 'main' | 'secondary';
    // Number of lanes (each direction)
    lanesPerDirection: number;
    // Cross-section widths (in Three.js units)
    laneWidth: number;
    carriagewayWidth: number; // total paved width (all lanes)
    curbWidth: number;
    curbHeight: number;
    furnishingStripWidth: number;
    clearWalkWidth: number;
    // Total reserve = carriageway + 2*(curb + furnishing + clearWalk)
}

export interface IntersectionConfig {
    // Center point in world units
    centerX: number;
    centerZ: number;
    // Sight triangle leg length (Three.js units from corner)
    sightTriangleLeg: number;
    // Crosswalk width (Three.js units)
    crosswalkWidth: number;
    // Stop bar offset from crosswalk edge (Three.js units)
    stopBarOffset: number;
}

export interface LandscapeConfig {
    // Street tree spacing (Three.js units between trunks)
    formalTreeSpacing: number;
    // Species per road type
    mainStreetSpecies: 'oak' | 'pine';
    secondaryStreetSpecies: 'oak' | 'pine';
    // Background fill
    clusterDensity: number; // clusters per 100x100 Three.js unit area
    perimeterTreeBandWidth: number; // Three.js units
    // Sight triangle clearance radius around intersection corners
    sightTriangleClearance: number;
}

export interface FurnitureConfig {
    streetlightSpacing: number; // Three.js units
    maxPointLights: number;
    benchSpacing: number; // Three.js units, 0 = no benches
    trashCanSpacing: number;
    hydrantSpacing: number;
    // Min distance from intersection center to place furniture
    intersectionClearance: number;
}

export interface WorldConfig {
    // Computed world dimensions (Three.js units)
    worldWidth: number;
    worldHeight: number;
    // Raw map dimensions
    tileSize: number;
    worldScale: number;
    mapWidth: number;
    mapHeight: number;
    // Colors
    colors: typeof COLORS;
    // Road definitions
    roads: RoadConfig[];
    // Intersection definitions (auto-computed from road crossings)
    intersections: IntersectionConfig[];
    // Landscape
    landscape: LandscapeConfig;
    // Furniture
    furniture: FurnitureConfig;
    // Fence boundary (world units Y threshold for Home Lot)
    homeLotBoundaryY: number;
}

function computeIntersections(roads: RoadConfig[], worldScale: number): IntersectionConfig[] {
    const horizontals = roads.filter(r => r.direction === 'horizontal');
    const verticals = roads.filter(r => r.direction === 'vertical');
    const intersections: IntersectionConfig[] = [];

    for (const h of horizontals) {
        for (const v of verticals) {
            intersections.push({
                centerX: v.centerline * worldScale,
                centerZ: h.centerline * worldScale,
                sightTriangleLeg: 15,
                crosswalkWidth: 4,
                stopBarOffset: 1.5,
            });
        }
    }

    return intersections;
}

export function createDefaultWorldConfig(): WorldConfig {
    const worldWidth = MAP_WIDTH * TILE_SIZE * WORLD_SCALE;
    const worldHeight = MAP_HEIGHT * TILE_SIZE * WORLD_SCALE;

    const mainStreet: RoadConfig = {
        centerline: 450, // world units — horizontal road
        direction: 'horizontal',
        type: 'main',
        lanesPerDirection: 1,
        laneWidth: 5,
        carriagewayWidth: 10, // 2 lanes * 5
        curbWidth: 0.4,
        curbHeight: 0.3,
        furnishingStripWidth: 3,
        clearWalkWidth: 2.5,
    };

    const secondaryStreet: RoadConfig = {
        centerline: 600, // world units — vertical road
        direction: 'vertical',
        type: 'secondary',
        lanesPerDirection: 1,
        laneWidth: 4.5,
        carriagewayWidth: 9,
        curbWidth: 0.4,
        curbHeight: 0.3,
        furnishingStripWidth: 2.5,
        clearWalkWidth: 2,
    };

    const roads = [mainStreet, secondaryStreet];
    const intersections = computeIntersections(roads, WORLD_SCALE);

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
            streetlightSpacing: STREETLIGHT_SPACING,
            maxPointLights: 10,
            benchSpacing: 60,
            trashCanSpacing: 80,
            hydrantSpacing: 120,
            intersectionClearance: 20,
        },
        homeLotBoundaryY: 600,
    };
}
