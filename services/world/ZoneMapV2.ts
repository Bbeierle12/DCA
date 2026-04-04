import {
    WorldConfig, ZoneType, RoadSegmentConfig, IntersectionConfigV2,
} from './WorldConfigV2';
import {
    PathPoint, sub, normalize, perpCW, segmentOrientedRect,
    rasterizeOrientedRect, rasterizeAnnulus, rasterizeCircle,
    polylineSegments, Segment, segmentLength, add, scale,
} from './RoadGeometry';

const CELL_SIZE = 2;

// Zone priority: lower index = higher priority (wins when painting over)
const ZONE_PRIORITY: ZoneType[] = [
    ZoneType.ROUNDABOUT_ISLAND,
    ZoneType.ROUNDABOUT_CARRIAGEWAY,
    ZoneType.SIGHT_TRIANGLE,
    ZoneType.CROSSWALK,
    ZoneType.CARRIAGEWAY,
    ZoneType.CURB,
    ZoneType.FURNISHING_STRIP,
    ZoneType.CLEAR_WALK,
    ZoneType.PERIMETER,
    ZoneType.OPEN_LANDSCAPE,
];

function zonePriority(z: ZoneType): number {
    const idx = ZONE_PRIORITY.indexOf(z);
    return idx >= 0 ? idx : ZONE_PRIORITY.length;
}

export interface Rect {
    x: number;
    z: number;
    width: number;
    height: number;
}

export class ZoneMapV2 {
    private grid: Uint8Array;
    private gridWidth: number;
    private gridHeight: number;
    private config: WorldConfig;

    constructor(config: WorldConfig) {
        this.config = config;
        this.gridWidth = Math.ceil(config.worldWidth / CELL_SIZE);
        this.gridHeight = Math.ceil(config.worldHeight / CELL_SIZE);
        this.grid = new Uint8Array(this.gridWidth * this.gridHeight);
        // Initialize all cells to OPEN_LANDSCAPE
        this.grid.fill(ZONE_PRIORITY.indexOf(ZoneType.OPEN_LANDSCAPE));

        this.paintAllZones();
    }

    private paintAllZones(): void {
        // Paint perimeter first (lowest priority among painted zones)
        this.paintPerimeter();

        // Paint road cross-sections
        for (const road of this.config.roads) {
            this.paintRoadZones(road);
        }

        // Paint intersection zones (higher priority)
        for (const inter of this.config.intersections) {
            this.paintIntersectionZones(inter);
        }
    }

    private setCell(col: number, row: number, zone: ZoneType): void {
        const idx = row * this.gridWidth + col;
        const newPriority = zonePriority(zone);
        const existingPriority = this.grid[idx];
        // Lower priority index wins
        if (newPriority < existingPriority) {
            this.grid[idx] = newPriority;
        }
    }

    private paintPerimeter(): void {
        const bandW = this.config.landscape.perimeterTreeBandWidth;
        const bandCells = Math.ceil(bandW / CELL_SIZE);

        for (let row = 0; row < this.gridHeight; row++) {
            for (let col = 0; col < this.gridWidth; col++) {
                if (row < bandCells || row >= this.gridHeight - bandCells ||
                    col < bandCells || col >= this.gridWidth - bandCells) {
                    this.setCell(col, row, ZoneType.PERIMETER);
                }
            }
        }
    }

    private paintRoadZones(road: RoadSegmentConfig): void {
        const segments = polylineSegments(road.path);
        const halfC = road.carriagewayWidth / 2;
        const curbW = road.curbWidth;
        const furnW = road.furnishingStripWidth;
        const walkW = road.clearWalkWidth;

        for (const seg of segments) {
            // Carriageway (center band)
            this.paintSegmentBand(seg, 0, road.carriagewayWidth, ZoneType.CARRIAGEWAY);

            // Curbs (both sides)
            for (const side of [-1, 1]) {
                const offset = side * (halfC + curbW / 2);
                this.paintSegmentBand(seg, offset, curbW, ZoneType.CURB);
            }

            // Furnishing strips (both sides)
            for (const side of [-1, 1]) {
                const offset = side * (halfC + curbW + furnW / 2);
                this.paintSegmentBand(seg, offset, furnW, ZoneType.FURNISHING_STRIP);
            }

            // Clear walks (both sides)
            for (const side of [-1, 1]) {
                const offset = side * (halfC + curbW + furnW + walkW / 2);
                this.paintSegmentBand(seg, offset, walkW, ZoneType.CLEAR_WALK);
            }
        }
    }

    private paintSegmentBand(seg: Segment, offsetFromCenter: number, bandWidth: number, zone: ZoneType): void {
        const rect = segmentOrientedRect(seg, offsetFromCenter, bandWidth);
        // Extend the rect along the segment direction by the band width to cover joints
        const extendedRect = {
            ...rect,
            halfExtents: { x: rect.halfExtents.x, z: rect.halfExtents.z + bandWidth / 2 },
        };
        rasterizeOrientedRect(extendedRect, CELL_SIZE, this.gridWidth, this.gridHeight, (col, row) => {
            this.setCell(col, row, zone);
        });
    }

    private paintIntersectionZones(inter: IntersectionConfigV2): void {
        if (inter.type === 'roundabout') {
            this.paintRoundaboutZones(inter);
        } else {
            this.paintStandardIntersectionZones(inter);
        }
    }

    private paintRoundaboutZones(inter: IntersectionConfigV2): void {
        const innerR = inter.roundaboutInnerRadius || 15;
        const outerR = inter.roundaboutOuterRadius || 30;

        // Roundabout carriageway (annular ring)
        rasterizeAnnulus(inter.center, innerR, outerR, CELL_SIZE, this.gridWidth, this.gridHeight, (col, row) => {
            this.setCell(col, row, ZoneType.ROUNDABOUT_CARRIAGEWAY);
        });

        // Central island
        rasterizeCircle(inter.center, innerR, CELL_SIZE, this.gridWidth, this.gridHeight, (col, row) => {
            this.setCell(col, row, ZoneType.ROUNDABOUT_ISLAND);
        });
    }

    private paintStandardIntersectionZones(inter: IntersectionConfigV2): void {
        const r = inter.radius;

        // Paint the intersection box as carriageway
        rasterizeCircle(inter.center, r, CELL_SIZE, this.gridWidth, this.gridHeight, (col, row) => {
            this.setCell(col, row, ZoneType.CARRIAGEWAY);
        });

        // Sight triangles at corners
        const leg = inter.sightTriangleLeg;
        for (const angle of inter.approachAngles) {
            const cornerX = inter.center.x + Math.cos(angle) * r;
            const cornerZ = inter.center.z + Math.sin(angle) * r;
            rasterizeCircle(
                { x: cornerX, z: cornerZ }, leg / 2,
                CELL_SIZE, this.gridWidth, this.gridHeight,
                (col, row) => { this.setCell(col, row, ZoneType.SIGHT_TRIANGLE); }
            );
        }
    }

    // ===== PUBLIC API =====

    getZone(x: number, z: number): ZoneType {
        const col = Math.floor(x / CELL_SIZE);
        const row = Math.floor(z / CELL_SIZE);
        if (col < 0 || col >= this.gridWidth || row < 0 || row >= this.gridHeight) {
            return ZoneType.OPEN_LANDSCAPE;
        }
        return ZONE_PRIORITY[this.grid[row * this.gridWidth + col]];
    }

    isInZone(x: number, z: number, type: ZoneType): boolean {
        return this.getZone(x, z) === type;
    }

    isNearIntersection(x: number, z: number, clearance: number): boolean {
        for (const inter of this.config.intersections) {
            const dx = x - inter.center.x;
            const dz = z - inter.center.z;
            if (dx * dx + dz * dz < clearance * clearance) return true;
        }
        return false;
    }

    /**
     * Get the furnishing strip rects for a specific road (by index).
     * Returns approximate axis-aligned bounding rects for each segment's furnishing strips.
     */
    getFurnishingStripsForRoad(roadIndex: number): Rect[] {
        const road = this.config.roads[roadIndex];
        if (!road) return [];
        const halfC = road.carriagewayWidth / 2;
        const curbW = road.curbWidth;
        const furnW = road.furnishingStripWidth;
        const rects: Rect[] = [];

        const segments = polylineSegments(road.path);
        for (const seg of segments) {
            const dir = normalize(sub(seg.p1, seg.p0));
            const perp = perpCW(dir);
            const segLen = Math.sqrt((seg.p1.x - seg.p0.x) ** 2 + (seg.p1.z - seg.p0.z) ** 2);

            for (const side of [-1, 1]) {
                const offset = side * (halfC + curbW + furnW / 2);
                const mid = add(
                    add(seg.p0, scale(sub(seg.p1, seg.p0), 0.5)),
                    scale(perp, offset)
                );
                rects.push({
                    x: mid.x - segLen / 2,
                    z: mid.z - furnW / 2,
                    width: segLen,
                    height: furnW,
                });
            }
        }
        return rects;
    }
}
