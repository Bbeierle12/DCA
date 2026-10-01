import { PathPoint } from './WorldConfigV2';
export type { PathPoint };

// ===== VECTOR MATH =====

/** Subtract b from a */
export function sub(a: PathPoint, b: PathPoint): PathPoint {
    return { x: a.x - b.x, z: a.z - b.z };
}

/** Add two vectors */
export function add(a: PathPoint, b: PathPoint): PathPoint {
    return { x: a.x + b.x, z: a.z + b.z };
}

/** Scale a vector */
export function scale(v: PathPoint, s: number): PathPoint {
    return { x: v.x * s, z: v.z * s };
}

/** Vector length */
export function length(v: PathPoint): number {
    return Math.sqrt(v.x * v.x + v.z * v.z);
}

/** Normalize a vector (returns zero vector if length is 0) */
export function normalize(v: PathPoint): PathPoint {
    const len = length(v);
    if (len === 0) return { x: 0, z: 0 };
    return { x: v.x / len, z: v.z / len };
}

/** Dot product in XZ plane */
export function dot(a: PathPoint, b: PathPoint): number {
    return a.x * b.x + a.z * b.z;
}

/** 2D cross product (returns scalar: positive = a is CCW from b) */
export function cross(a: PathPoint, b: PathPoint): number {
    return a.x * b.z - a.z * b.x;
}

/** Perpendicular vector (rotated 90 degrees CW in XZ plane: right-hand side of direction) */
export function perpCW(v: PathPoint): PathPoint {
    return { x: v.z, z: -v.x };
}

/** Perpendicular vector (rotated 90 degrees CCW in XZ plane: left-hand side of direction) */
export function perpCCW(v: PathPoint): PathPoint {
    return { x: -v.z, z: v.x };
}

/** Distance between two points */
export function dist(a: PathPoint, b: PathPoint): number {
    return length(sub(b, a));
}

/** Angle of vector from positive X axis (in radians) */
export function angle(v: PathPoint): number {
    return Math.atan2(v.z, v.x);
}

// ===== SEGMENT OPERATIONS =====

export interface Segment {
    p0: PathPoint;
    p1: PathPoint;
}

/** Get the direction vector of a segment */
export function segmentDir(seg: Segment): PathPoint {
    return normalize(sub(seg.p1, seg.p0));
}

/** Get the length of a segment */
export function segmentLength(seg: Segment): number {
    return dist(seg.p0, seg.p1);
}

/**
 * Find intersection point of two line segments.
 * Returns null if segments don't intersect or are parallel.
 * Returns { point, t, u } where t and u are parametric values [0,1].
 */
export function segmentIntersection(
    a: Segment,
    b: Segment
): { point: PathPoint; t: number; u: number } | null {
    const d1 = sub(a.p1, a.p0);
    const d2 = sub(b.p1, b.p0);
    const denom = cross(d1, d2);

    if (Math.abs(denom) < 1e-10) return null; // parallel

    const d = sub(b.p0, a.p0);
    const t = cross(d, d2) / denom;
    const u = cross(d, d1) / denom;

    if (t < 0 || t > 1 || u < 0 || u > 1) return null;

    return {
        point: add(a.p0, scale(d1, t)),
        t,
        u,
    };
}

/**
 * Find the closest point on a segment to a given point.
 * Returns { point, t } where t is the parametric value [0,1].
 */
export function closestPointOnSegment(
    seg: Segment,
    p: PathPoint
): { point: PathPoint; t: number; distance: number } {
    const d = sub(seg.p1, seg.p0);
    const len2 = dot(d, d);

    if (len2 === 0) {
        return { point: seg.p0, t: 0, distance: dist(p, seg.p0) };
    }

    let t = dot(sub(p, seg.p0), d) / len2;
    t = Math.max(0, Math.min(1, t));
    const closest = add(seg.p0, scale(d, t));
    return { point: closest, t, distance: dist(p, closest) };
}

// ===== POLYLINE OPERATIONS =====

/** Compute total length of a polyline path */
export function polylineLength(path: PathPoint[]): number {
    let total = 0;
    for (let i = 1; i < path.length; i++) {
        total += dist(path[i - 1], path[i]);
    }
    return total;
}

/** Walk along a polyline by a given distance, returning the point and tangent direction */
export function samplePolyline(
    path: PathPoint[],
    distance: number
): { point: PathPoint; direction: PathPoint } | null {
    let remaining = distance;
    for (let i = 1; i < path.length; i++) {
        const segLen = dist(path[i - 1], path[i]);
        if (remaining <= segLen || i === path.length - 1) {
            const t = segLen > 0 ? Math.min(remaining / segLen, 1) : 0;
            const dir = normalize(sub(path[i], path[i - 1]));
            return {
                point: add(path[i - 1], scale(sub(path[i], path[i - 1]), t)),
                direction: dir,
            };
        }
        remaining -= segLen;
    }
    return null;
}

/** Get all segment pairs from a polyline path */
export function polylineSegments(path: PathPoint[]): Segment[] {
    const segs: Segment[] = [];
    for (let i = 1; i < path.length; i++) {
        segs.push({ p0: path[i - 1], p1: path[i] });
    }
    return segs;
}

// ===== MITER / BEVEL JOINTS =====

export interface JointVertices {
    left: PathPoint;   // Left side vertex at joint
    right: PathPoint;  // Right side vertex at joint
}

/**
 * Compute the miter joint vertices at a waypoint where two segments meet.
 * halfWidth is the offset from center to edge.
 * Returns left and right vertices. Falls back to bevel if miter ratio exceeds limit.
 */
export function computeMiterJoint(
    prevDir: PathPoint,
    nextDir: PathPoint,
    center: PathPoint,
    halfWidth: number,
    miterLimit: number = 2.0
): JointVertices {
    const prevPerp = perpCW(prevDir);   // right side of prev segment
    const nextPerp = perpCW(nextDir);   // right side of next segment

    // Average the two perpendiculars for the miter direction
    const avgPerp = normalize(add(prevPerp, nextPerp));

    // Miter length = halfWidth / cos(half angle between segments)
    const cosHalf = dot(avgPerp, prevPerp);

    if (Math.abs(cosHalf) < 0.1 || (halfWidth / cosHalf) > halfWidth * miterLimit) {
        // Angle too sharp, use bevel (just use the next segment's perpendicular)
        return {
            right: add(center, scale(nextPerp, halfWidth)),
            left: add(center, scale(nextPerp, -halfWidth)),
        };
    }

    const miterLen = halfWidth / cosHalf;
    return {
        right: add(center, scale(avgPerp, miterLen)),
        left: add(center, scale(avgPerp, -miterLen)),
    };
}

// ===== ORIENTED RECTANGLE =====

export interface OrientedRect {
    center: PathPoint;
    halfExtents: PathPoint;  // { x: halfWidth, z: halfLength }
    axisX: PathPoint;        // Unit vector along width
    axisZ: PathPoint;        // Unit vector along length
}

/** Create an oriented rectangle for a road segment cross-section band */
export function segmentOrientedRect(
    seg: Segment,
    offsetFromCenter: number,
    bandWidth: number
): OrientedRect {
    const dir = segmentDir(seg);
    const perp = perpCW(dir);
    const mid = add(seg.p0, scale(sub(seg.p1, seg.p0), 0.5));
    const segLen = segmentLength(seg);

    return {
        center: add(mid, scale(perp, offsetFromCenter)),
        halfExtents: { x: bandWidth / 2, z: segLen / 2 },
        axisX: perp,
        axisZ: dir,
    };
}

/** Test if a point is inside an oriented rectangle */
export function pointInOrientedRect(p: PathPoint, rect: OrientedRect): boolean {
    const d = sub(p, rect.center);
    const projX = Math.abs(dot(d, rect.axisX));
    const projZ = Math.abs(dot(d, rect.axisZ));
    return projX <= rect.halfExtents.x && projZ <= rect.halfExtents.z;
}

// ===== GRID RASTERIZATION =====

/**
 * Rasterize an oriented rectangle into grid cells.
 * Calls the callback with each grid cell (col, row) that the rectangle overlaps.
 */
export function rasterizeOrientedRect(
    rect: OrientedRect,
    cellSize: number,
    gridWidth: number,
    gridHeight: number,
    callback: (col: number, row: number) => void
): void {
    // Compute AABB of the oriented rect to limit iteration
    const corners = getOrientedRectCorners(rect);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const c of corners) {
        minX = Math.min(minX, c.x);
        maxX = Math.max(maxX, c.x);
        minZ = Math.min(minZ, c.z);
        maxZ = Math.max(maxZ, c.z);
    }

    const startCol = Math.max(0, Math.floor(minX / cellSize));
    const endCol = Math.min(gridWidth - 1, Math.floor(maxX / cellSize));
    const startRow = Math.max(0, Math.floor(minZ / cellSize));
    const endRow = Math.min(gridHeight - 1, Math.floor(maxZ / cellSize));

    for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
            const cellCenter: PathPoint = {
                x: (col + 0.5) * cellSize,
                z: (row + 0.5) * cellSize,
            };
            if (pointInOrientedRect(cellCenter, rect)) {
                callback(col, row);
            }
        }
    }
}

/** Get the 4 corners of an oriented rectangle */
export function getOrientedRectCorners(rect: OrientedRect): PathPoint[] {
    const dx = scale(rect.axisX, rect.halfExtents.x);
    const dz = scale(rect.axisZ, rect.halfExtents.z);
    return [
        add(add(rect.center, dx), dz),
        add(sub(rect.center, dx), dz),
        sub(sub(rect.center, dx), dz),
        sub(add(rect.center, dx), dz),
    ];
}

// ===== CIRCLE RASTERIZATION =====

/**
 * Rasterize a circle (annular ring) into grid cells.
 */
export function rasterizeAnnulus(
    center: PathPoint,
    innerRadius: number,
    outerRadius: number,
    cellSize: number,
    gridWidth: number,
    gridHeight: number,
    callback: (col: number, row: number) => void
): void {
    const startCol = Math.max(0, Math.floor((center.x - outerRadius) / cellSize));
    const endCol = Math.min(gridWidth - 1, Math.floor((center.x + outerRadius) / cellSize));
    const startRow = Math.max(0, Math.floor((center.z - outerRadius) / cellSize));
    const endRow = Math.min(gridHeight - 1, Math.floor((center.z + outerRadius) / cellSize));

    for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
            const cx = (col + 0.5) * cellSize;
            const cz = (row + 0.5) * cellSize;
            const dx = cx - center.x;
            const dz = cz - center.z;
            const d2 = dx * dx + dz * dz;
            if (d2 >= innerRadius * innerRadius && d2 <= outerRadius * outerRadius) {
                callback(col, row);
            }
        }
    }
}

/** Rasterize a filled circle into grid cells */
export function rasterizeCircle(
    center: PathPoint,
    radius: number,
    cellSize: number,
    gridWidth: number,
    gridHeight: number,
    callback: (col: number, row: number) => void
): void {
    rasterizeAnnulus(center, 0, radius, cellSize, gridWidth, gridHeight, callback);
}
