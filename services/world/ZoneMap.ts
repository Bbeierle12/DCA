import { WorldConfig, ZoneType, RoadConfig, IntersectionConfig } from './WorldConfig';

export interface Rect {
    x: number;
    z: number;
    width: number;
    height: number;
}

interface ZoneRect extends Rect {
    type: ZoneType;
}

export class ZoneMap {
    private zones: ZoneRect[] = [];
    private config: WorldConfig;

    constructor(config: WorldConfig) {
        this.config = config;
        this.buildZones();
    }

    private buildZones() {
        // Build road zones from config
        for (const road of this.config.roads) {
            this.buildRoadZones(road);
        }

        // Build intersection zones
        for (const intersection of this.config.intersections) {
            this.buildIntersectionZones(intersection);
        }

        // Build perimeter zones
        this.buildPerimeterZones();

        // Everything else is open landscape (implicit — checked last in getZone)
    }

    private buildRoadZones(road: RoadConfig) {
        const ws = this.config.worldScale;
        const center = road.centerline * ws;
        const halfCarriageway = road.carriagewayWidth / 2;
        const curbW = road.curbWidth;
        const furnW = road.furnishingStripWidth;
        const walkW = road.clearWalkWidth;

        if (road.direction === 'horizontal') {
            const length = this.config.worldWidth;
            // Carriageway
            this.zones.push({ x: 0, z: center - halfCarriageway, width: length, height: road.carriagewayWidth, type: ZoneType.CARRIAGEWAY });
            // Curbs (north and south)
            this.zones.push({ x: 0, z: center - halfCarriageway - curbW, width: length, height: curbW, type: ZoneType.CURB });
            this.zones.push({ x: 0, z: center + halfCarriageway, width: length, height: curbW, type: ZoneType.CURB });
            // Furnishing strips
            this.zones.push({ x: 0, z: center - halfCarriageway - curbW - furnW, width: length, height: furnW, type: ZoneType.FURNISHING_STRIP });
            this.zones.push({ x: 0, z: center + halfCarriageway + curbW, width: length, height: furnW, type: ZoneType.FURNISHING_STRIP });
            // Clear walks
            this.zones.push({ x: 0, z: center - halfCarriageway - curbW - furnW - walkW, width: length, height: walkW, type: ZoneType.CLEAR_WALK });
            this.zones.push({ x: 0, z: center + halfCarriageway + curbW + furnW, width: length, height: walkW, type: ZoneType.CLEAR_WALK });
        } else {
            const length = this.config.worldHeight;
            // Carriageway
            this.zones.push({ x: center - halfCarriageway, z: 0, width: road.carriagewayWidth, height: length, type: ZoneType.CARRIAGEWAY });
            // Curbs (west and east)
            this.zones.push({ x: center - halfCarriageway - curbW, z: 0, width: curbW, height: length, type: ZoneType.CURB });
            this.zones.push({ x: center + halfCarriageway, z: 0, width: curbW, height: length, type: ZoneType.CURB });
            // Furnishing strips
            this.zones.push({ x: center - halfCarriageway - curbW - furnW, z: 0, width: furnW, height: length, type: ZoneType.FURNISHING_STRIP });
            this.zones.push({ x: center + halfCarriageway + curbW, z: 0, width: furnW, height: length, type: ZoneType.FURNISHING_STRIP });
            // Clear walks
            this.zones.push({ x: center - halfCarriageway - curbW - furnW - walkW, z: 0, width: walkW, height: length, type: ZoneType.CLEAR_WALK });
            this.zones.push({ x: center + halfCarriageway + curbW + furnW, z: 0, width: walkW, height: length, type: ZoneType.CLEAR_WALK });
        }
    }

    private buildIntersectionZones(intersection: IntersectionConfig) {
        // Find the two roads that form this intersection
        const hRoad = this.config.roads.find(r => r.direction === 'horizontal' && r.centerline * this.config.worldScale === intersection.centerZ);
        const vRoad = this.config.roads.find(r => r.direction === 'vertical' && r.centerline * this.config.worldScale === intersection.centerX);
        if (!hRoad || !vRoad) return;

        const hHalf = hRoad.carriagewayWidth / 2;
        const vHalf = vRoad.carriagewayWidth / 2;
        const cwW = intersection.crosswalkWidth;

        // Crosswalks — 4 legs
        // North crosswalk (across horizontal road, north side)
        this.zones.push({
            x: intersection.centerX - vHalf,
            z: intersection.centerZ - hHalf - cwW,
            width: vRoad.carriagewayWidth,
            height: cwW,
            type: ZoneType.CROSSWALK,
        });
        // South crosswalk
        this.zones.push({
            x: intersection.centerX - vHalf,
            z: intersection.centerZ + hHalf,
            width: vRoad.carriagewayWidth,
            height: cwW,
            type: ZoneType.CROSSWALK,
        });
        // West crosswalk (across vertical road, west side)
        this.zones.push({
            x: intersection.centerX - vHalf - cwW,
            z: intersection.centerZ - hHalf,
            width: cwW,
            height: hRoad.carriagewayWidth,
            type: ZoneType.CROSSWALK,
        });
        // East crosswalk
        this.zones.push({
            x: intersection.centerX + vHalf,
            z: intersection.centerZ - hHalf,
            width: cwW,
            height: hRoad.carriagewayWidth,
            type: ZoneType.CROSSWALK,
        });

        // Sight triangles at 4 corners
        const leg = intersection.sightTriangleLeg;
        const corners = [
            { x: intersection.centerX - vHalf, z: intersection.centerZ - hHalf }, // NW
            { x: intersection.centerX + vHalf, z: intersection.centerZ - hHalf }, // NE
            { x: intersection.centerX - vHalf, z: intersection.centerZ + hHalf }, // SW
            { x: intersection.centerX + vHalf, z: intersection.centerZ + hHalf }, // SE
        ];
        for (const corner of corners) {
            this.zones.push({
                x: corner.x - leg / 2,
                z: corner.z - leg / 2,
                width: leg,
                height: leg,
                type: ZoneType.SIGHT_TRIANGLE,
            });
        }
    }

    private buildPerimeterZones() {
        const bandW = this.config.landscape.perimeterTreeBandWidth;
        const w = this.config.worldWidth;
        const h = this.config.worldHeight;

        // North band
        this.zones.push({ x: 0, z: 0, width: w, height: bandW, type: ZoneType.PERIMETER });
        // South band
        this.zones.push({ x: 0, z: h - bandW, width: w, height: bandW, type: ZoneType.PERIMETER });
        // West band
        this.zones.push({ x: 0, z: bandW, width: bandW, height: h - 2 * bandW, type: ZoneType.PERIMETER });
        // East band
        this.zones.push({ x: w - bandW, z: bandW, width: bandW, height: h - 2 * bandW, type: ZoneType.PERIMETER });
    }

    /**
     * Get the zone type at a specific point.
     * Priority order: sight_triangle > crosswalk > carriageway > curb > furnishing > clear_walk > perimeter > open_landscape
     */
    getZone(x: number, z: number): ZoneType {
        const priority: ZoneType[] = [
            ZoneType.SIGHT_TRIANGLE,
            ZoneType.CROSSWALK,
            ZoneType.CARRIAGEWAY,
            ZoneType.CURB,
            ZoneType.FURNISHING_STRIP,
            ZoneType.CLEAR_WALK,
            ZoneType.PERIMETER,
        ];

        for (const zoneType of priority) {
            for (const zone of this.zones) {
                if (zone.type !== zoneType) continue;
                if (x >= zone.x && x < zone.x + zone.width &&
                    z >= zone.z && z < zone.z + zone.height) {
                    return zoneType;
                }
            }
        }

        return ZoneType.OPEN_LANDSCAPE;
    }

    isInZone(x: number, z: number, type: ZoneType): boolean {
        return this.getZone(x, z) === type;
    }

    getZonesOfType(type: ZoneType): Rect[] {
        return this.zones.filter(z => z.type === type).map(({ x, z, width, height }) => ({ x, z, width, height }));
    }

    /**
     * Check if a point is within any intersection's clearance radius.
     */
    isNearIntersection(x: number, z: number, clearance: number): boolean {
        for (const inter of this.config.intersections) {
            const dx = x - inter.centerX;
            const dz = z - inter.centerZ;
            if (dx * dx + dz * dz < clearance * clearance) return true;
        }
        return false;
    }

    /**
     * Get the furnishing strip rects for a specific road.
     */
    getFurnishingStripsForRoad(road: number): Rect[] {
        const roadConfig = this.config.roads[road];
        if (!roadConfig) return [];
        const ws = this.config.worldScale;
        const center = roadConfig.centerline * ws;
        const halfC = roadConfig.carriagewayWidth / 2;
        const curbW = roadConfig.curbWidth;
        const furnW = roadConfig.furnishingStripWidth;

        if (roadConfig.direction === 'horizontal') {
            return [
                { x: 0, z: center - halfC - curbW - furnW, width: this.config.worldWidth, height: furnW },
                { x: 0, z: center + halfC + curbW, width: this.config.worldWidth, height: furnW },
            ];
        } else {
            return [
                { x: center - halfC - curbW - furnW, z: 0, width: furnW, height: this.config.worldHeight },
                { x: center + halfC + curbW, z: 0, width: furnW, height: this.config.worldHeight },
            ];
        }
    }
}
