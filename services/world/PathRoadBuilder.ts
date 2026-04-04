import * as THREE from 'three';
import { WorldConfig, RoadSegmentConfig, RoadType } from './WorldConfigV2';
import { TextureFactory } from './TextureFactory';
import {
    PathPoint, sub, add, scale, normalize, perpCW, dist,
    polylineSegments, segmentLength, computeMiterJoint, Segment,
} from './RoadGeometry';

export class PathRoadBuilder {
    private config: WorldConfig;
    private textures: TextureFactory;

    constructor(config: WorldConfig, textures: TextureFactory) {
        this.config = config;
        this.textures = textures;
    }

    build(scene: THREE.Scene): void {
        this.buildGround(scene);

        for (const road of this.config.roads) {
            this.buildRoad(scene, road);
        }
    }

    private buildGround(scene: THREE.Scene): void {
        const { worldWidth, worldHeight } = this.config;
        const groundGeo = new THREE.PlaneGeometry(worldWidth, worldHeight);
        const groundMat = new THREE.MeshLambertMaterial({ map: this.textures.createGrassTexture() });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(worldWidth / 2, -0.1, worldHeight / 2);
        ground.receiveShadow = true;
        ground.userData.hoverLabel = 'Grass';
        ground.userData.hoverType = 'Terrain';
        scene.add(ground);
    }

    private buildRoad(scene: THREE.Scene, road: RoadSegmentConfig): void {
        const path = road.path;
        if (path.length < 2) return;

        const segments = polylineSegments(path);
        let cumulativeLength = 0;

        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const segLen = segmentLength(seg);

            // Compute joint vertices at start and end of this segment
            const startJoint = this.computeJointAt(path, i, road);
            const endJoint = this.computeJointAt(path, i + 1, road);

            this.buildSegmentCarriageway(scene, seg, road, startJoint, endJoint, cumulativeLength, segLen);
            this.buildSegmentCurbs(scene, seg, road, startJoint, endJoint);
            this.buildSegmentFurnishing(scene, seg, road, startJoint, endJoint);
            this.buildSegmentSidewalks(scene, seg, road, startJoint, endJoint);

            cumulativeLength += segLen;
        }
    }

    /**
     * Compute the cross-section vertices at a path waypoint.
     * Returns offset positions for each cross-section band edge.
     */
    private computeJointAt(
        path: PathPoint[],
        waypointIndex: number,
        road: RoadSegmentConfig
    ): CrossSectionVertices {
        const center = path[waypointIndex];
        const halfC = road.carriagewayWidth / 2;
        const curbW = road.curbWidth;
        const furnW = road.furnishingStripWidth;
        const walkW = road.clearWalkWidth;

        let dir: PathPoint;
        if (waypointIndex === 0) {
            dir = normalize(sub(path[1], path[0]));
        } else if (waypointIndex >= path.length - 1) {
            dir = normalize(sub(path[path.length - 1], path[path.length - 2]));
        } else {
            // At a joint, compute miter direction
            const prevDir = normalize(sub(path[waypointIndex], path[waypointIndex - 1]));
            const nextDir = normalize(sub(path[waypointIndex + 1], path[waypointIndex]));
            // Use average direction for perpendicular calculation
            const avgDir = normalize(add(prevDir, nextDir));
            dir = avgDir;
        }

        const perp = perpCW(dir);

        return {
            center,
            // Carriageway edges
            carrRight: add(center, scale(perp, halfC)),
            carrLeft: add(center, scale(perp, -halfC)),
            // Curb outer edges
            curbRight: add(center, scale(perp, halfC + curbW)),
            curbLeft: add(center, scale(perp, -(halfC + curbW))),
            // Furnishing strip outer edges
            furnRight: add(center, scale(perp, halfC + curbW + furnW)),
            furnLeft: add(center, scale(perp, -(halfC + curbW + furnW))),
            // Sidewalk outer edges
            walkRight: add(center, scale(perp, halfC + curbW + furnW + walkW)),
            walkLeft: add(center, scale(perp, -(halfC + curbW + furnW + walkW))),
        };
    }

    // ===== CARRIAGEWAY =====

    private buildSegmentCarriageway(
        scene: THREE.Scene,
        seg: Segment,
        road: RoadSegmentConfig,
        start: CrossSectionVertices,
        end: CrossSectionVertices,
        cumulativeLen: number,
        segLen: number
    ): void {
        const geo = this.createQuadGeometry(
            start.carrLeft, start.carrRight,
            end.carrLeft, end.carrRight,
            0.01
        );

        // UV mapping: U along road, V across width
        this.setQuadUVs(geo, cumulativeLen, segLen, road.carriagewayWidth);

        const mat = new THREE.MeshLambertMaterial({
            map: this.textures.createSegmentRoadTexture(road.type, segLen),
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.receiveShadow = true;
        mesh.userData.hoverLabel = road.name;
        mesh.userData.hoverType = 'Road';
        scene.add(mesh);

        // Lane markings as a separate overlay
        this.buildLaneMarkings(scene, seg, road, start, end, cumulativeLen, segLen);
    }

    private buildLaneMarkings(
        scene: THREE.Scene,
        seg: Segment,
        road: RoadSegmentConfig,
        start: CrossSectionVertices,
        end: CrossSectionVertices,
        cumulativeLen: number,
        segLen: number
    ): void {
        const markingWidth = 0.3;
        const dir = normalize(sub(seg.p1, seg.p0));
        const perp = perpCW(dir);

        if (road.type === 'boulevard') {
            // Double yellow center line
            for (const offset of [-0.3, 0.3]) {
                this.buildDashedLine(scene, seg, perp, offset, markingWidth * 0.6, 0xCCAA00, cumulativeLen, segLen, 3, 3);
            }
            // Lane dividers for 2-lane sides
            const laneOffset = road.laneWidth;
            this.buildDashedLine(scene, seg, perp, laneOffset, markingWidth, 0xCCCCCC, cumulativeLen, segLen, 3, 6);
            this.buildDashedLine(scene, seg, perp, -laneOffset, markingWidth, 0xCCCCCC, cumulativeLen, segLen, 3, 6);
        } else if (road.type === 'main') {
            // Double yellow center line
            for (const offset of [-0.2, 0.2]) {
                this.buildDashedLine(scene, seg, perp, offset, markingWidth * 0.5, 0xCCAA00, cumulativeLen, segLen, 3, 3);
            }
        } else if (road.type === 'secondary') {
            // Dashed white center line
            this.buildDashedLine(scene, seg, perp, 0, markingWidth, 0xCCCCCC, cumulativeLen, segLen, 3, 6);
        }
        // Lanes have no center markings

        // Edge lines (subtle)
        const halfC = road.carriagewayWidth / 2;
        for (const side of [-1, 1]) {
            const offset = side * (halfC - markingWidth / 2);
            this.buildDashedLine(scene, seg, perp, offset, markingWidth * 0.5, 0x888888, cumulativeLen, segLen, 100, 0);
        }
    }

    private buildDashedLine(
        scene: THREE.Scene,
        seg: Segment,
        perp: PathPoint,
        offsetFromCenter: number,
        lineWidth: number,
        color: number,
        cumulativeLen: number,
        segLen: number,
        dashLen: number,
        gapLen: number
    ): void {
        const dir = normalize(sub(seg.p1, seg.p0));
        const totalPattern = dashLen + gapLen;
        const startOffset = cumulativeLen % totalPattern;

        if (gapLen === 0) {
            // Solid line
            const p0 = add(seg.p0, scale(perp, offsetFromCenter));
            const p1 = add(seg.p1, scale(perp, offsetFromCenter));
            const left0 = add(p0, scale(perpCW(dir), -lineWidth / 2));
            const right0 = add(p0, scale(perpCW(dir), lineWidth / 2));
            const left1 = add(p1, scale(perpCW(dir), -lineWidth / 2));
            const right1 = add(p1, scale(perpCW(dir), lineWidth / 2));

            const geo = this.createQuadGeometry(left0, right0, left1, right1, 0.015);
            const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
            mesh.receiveShadow = true;
            scene.add(mesh);
            return;
        }

        // Dashed line
        let d = -startOffset;
        while (d < segLen) {
            const dashStart = Math.max(0, d);
            const dashEnd = Math.min(segLen, d + dashLen);
            d += totalPattern;

            if (dashEnd <= dashStart) continue;

            const t0 = dashStart / segLen;
            const t1 = dashEnd / segLen;
            const center0 = add(
                add(seg.p0, scale(sub(seg.p1, seg.p0), t0)),
                scale(perp, offsetFromCenter)
            );
            const center1 = add(
                add(seg.p0, scale(sub(seg.p1, seg.p0), t1)),
                scale(perp, offsetFromCenter)
            );

            const linePerp = perpCW(dir);
            const left0 = add(center0, scale(linePerp, -lineWidth / 2));
            const right0 = add(center0, scale(linePerp, lineWidth / 2));
            const left1 = add(center1, scale(linePerp, -lineWidth / 2));
            const right1 = add(center1, scale(linePerp, lineWidth / 2));

            const geo = this.createQuadGeometry(left0, right0, left1, right1, 0.015);
            const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
            mesh.receiveShadow = true;
            scene.add(mesh);
        }
    }

    // ===== CURBS =====

    private buildSegmentCurbs(
        scene: THREE.Scene,
        seg: Segment,
        road: RoadSegmentConfig,
        start: CrossSectionVertices,
        end: CrossSectionVertices
    ): void {
        const curbH = road.curbHeight;
        const curbMat = new THREE.MeshLambertMaterial({ color: 0x999999 });

        // Right side curb
        this.buildExtrudedBox(scene, start.carrRight, start.curbRight, end.carrRight, end.curbRight, curbH, curbMat, 'Curb');
        // Left side curb
        this.buildExtrudedBox(scene, start.curbLeft, start.carrLeft, end.curbLeft, end.carrLeft, curbH, curbMat, 'Curb');
    }

    private buildExtrudedBox(
        scene: THREE.Scene,
        startInner: PathPoint,
        startOuter: PathPoint,
        endInner: PathPoint,
        endOuter: PathPoint,
        height: number,
        material: THREE.Material,
        label: string
    ): void {
        // Create a box-like shape using BufferGeometry
        // 8 vertices: 4 bottom corners + 4 top corners
        const positions = new Float32Array([
            // Bottom face (y=0)
            startInner.x, 0, startInner.z,   // 0
            startOuter.x, 0, startOuter.z,   // 1
            endOuter.x, 0, endOuter.z,       // 2
            endInner.x, 0, endInner.z,       // 3
            // Top face (y=height)
            startInner.x, height, startInner.z,   // 4
            startOuter.x, height, startOuter.z,   // 5
            endOuter.x, height, endOuter.z,       // 6
            endInner.x, height, endInner.z,       // 7
        ]);

        const indices = [
            // Top face
            4, 5, 6, 4, 6, 7,
            // Bottom face
            0, 2, 1, 0, 3, 2,
            // Front face (start)
            0, 1, 5, 0, 5, 4,
            // Back face (end)
            2, 3, 7, 2, 7, 6,
            // Outer face
            1, 2, 6, 1, 6, 5,
            // Inner face
            3, 0, 4, 3, 4, 7,
        ];

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        const mesh = new THREE.Mesh(geo, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.hoverLabel = label;
        mesh.userData.hoverType = 'Terrain';
        scene.add(mesh);
    }

    // ===== FURNISHING STRIPS =====

    private buildSegmentFurnishing(
        scene: THREE.Scene,
        seg: Segment,
        road: RoadSegmentConfig,
        start: CrossSectionVertices,
        end: CrossSectionVertices
    ): void {
        const segLen = segmentLength(seg);
        const mat = new THREE.MeshLambertMaterial({
            map: this.textures.createFurnishingStripTexture(segLen),
        });

        // Right side
        const geoR = this.createQuadGeometry(start.curbRight, start.furnRight, end.curbRight, end.furnRight, 0.02);
        const meshR = new THREE.Mesh(geoR, mat);
        meshR.receiveShadow = true;
        meshR.userData.hoverLabel = 'Planting Strip';
        meshR.userData.hoverType = 'Terrain';
        scene.add(meshR);

        // Left side
        const geoL = this.createQuadGeometry(start.furnLeft, start.curbLeft, end.furnLeft, end.curbLeft, 0.02);
        const meshL = new THREE.Mesh(geoL, mat.clone());
        meshL.receiveShadow = true;
        meshL.userData.hoverLabel = 'Planting Strip';
        meshL.userData.hoverType = 'Terrain';
        scene.add(meshL);
    }

    // ===== SIDEWALKS =====

    private buildSegmentSidewalks(
        scene: THREE.Scene,
        seg: Segment,
        road: RoadSegmentConfig,
        start: CrossSectionVertices,
        end: CrossSectionVertices
    ): void {
        const segLen = segmentLength(seg);
        const mat = new THREE.MeshLambertMaterial({
            map: this.textures.createSidewalkTexture(segLen),
        });
        const y = road.curbHeight + 0.01;

        // Right side
        const geoR = this.createQuadGeometry(start.furnRight, start.walkRight, end.furnRight, end.walkRight, y);
        const meshR = new THREE.Mesh(geoR, mat);
        meshR.receiveShadow = true;
        meshR.userData.hoverLabel = 'Sidewalk';
        meshR.userData.hoverType = 'Terrain';
        scene.add(meshR);

        // Left side
        const geoL = this.createQuadGeometry(start.walkLeft, start.furnLeft, end.walkLeft, end.furnLeft, y);
        const meshL = new THREE.Mesh(geoL, mat.clone());
        meshL.receiveShadow = true;
        meshL.userData.hoverLabel = 'Sidewalk';
        meshL.userData.hoverType = 'Terrain';
        scene.add(meshL);
    }

    // ===== GEOMETRY HELPERS =====

    /**
     * Create a flat quad from 4 corner points at a given Y height.
     * Vertices: topLeft(0), topRight(1), bottomLeft(2), bottomRight(3)
     * where "top" = start of segment, "bottom" = end.
     */
    private createQuadGeometry(
        startLeft: PathPoint,
        startRight: PathPoint,
        endLeft: PathPoint,
        endRight: PathPoint,
        y: number
    ): THREE.BufferGeometry {
        const positions = new Float32Array([
            startLeft.x, y, startLeft.z,     // 0 - start left
            startRight.x, y, startRight.z,   // 1 - start right
            endLeft.x, y, endLeft.z,         // 2 - end left
            endRight.x, y, endRight.z,       // 3 - end right
        ]);

        const normals = new Float32Array([
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,
        ]);

        const uvs = new Float32Array([
            0, 0,
            1, 0,
            0, 1,
            1, 1,
        ]);

        const indices = [0, 2, 1, 1, 2, 3];

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        return geo;
    }

    /**
     * Set UVs on a quad for road texture alignment.
     * U = along road (based on cumulative length), V = across width.
     */
    private setQuadUVs(
        geo: THREE.BufferGeometry,
        cumulativeLen: number,
        segLen: number,
        width: number
    ): void {
        const repeatU = segLen / 12; // tile every 12 units along road
        const u0 = (cumulativeLen / 12);
        const u1 = u0 + repeatU;

        const uvs = new Float32Array([
            u0, 0,
            u0, 1,
            u1, 0,
            u1, 1,
        ]);
        geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    }
}

// ===== CROSS-SECTION VERTICES =====

interface CrossSectionVertices {
    center: PathPoint;
    carrRight: PathPoint;
    carrLeft: PathPoint;
    curbRight: PathPoint;
    curbLeft: PathPoint;
    furnRight: PathPoint;
    furnLeft: PathPoint;
    walkRight: PathPoint;
    walkLeft: PathPoint;
}
