import * as THREE from 'three';
import { WorldConfig, IntersectionConfigV2, RoadSegmentConfig } from './WorldConfigV2';
import { TextureFactory } from './TextureFactory';
import {
    PathPoint, sub, add, scale, normalize, perpCW, dist,
    polylineSegments, closestPointOnSegment, Segment,
} from './RoadGeometry';

export class IntersectionBuilderV2 {
    private config: WorldConfig;
    private textures: TextureFactory;

    constructor(config: WorldConfig, textures: TextureFactory) {
        this.config = config;
        this.textures = textures;
    }

    build(scene: THREE.Scene): void {
        for (const inter of this.config.intersections) {
            if (inter.type === 'roundabout') continue; // handled by RoundaboutBuilder
            this.buildIntersection(scene, inter);
        }
    }

    private buildIntersection(scene: THREE.Scene, inter: IntersectionConfigV2): void {
        // Intersection patch (dark asphalt covering the junction area)
        this.buildPatch(scene, inter);

        // Get approach roads
        const approaches = this.getApproaches(inter);

        // Crosswalks on each approach
        for (const approach of approaches) {
            this.buildCrosswalk(scene, inter, approach);
            this.buildStopBar(scene, inter, approach);
        }

        // Traffic control
        if (inter.controlType === 'signal') {
            this.buildTrafficLights(scene, inter, approaches);
        } else if (inter.controlType === 'yield') {
            this.buildYieldSigns(scene, inter, approaches);
        }

        // Curb ramps at corners
        this.buildCurbRamps(scene, inter, approaches);
    }

    private buildPatch(scene: THREE.Scene, inter: IntersectionConfigV2): void {
        const r = inter.radius;
        // Use a circle geometry for the intersection patch
        const geo = new THREE.CircleGeometry(r, 24);
        const mat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(inter.center.x, 0.02, inter.center.z);
        mesh.receiveShadow = true;
        mesh.userData.hoverLabel = 'Junction';
        mesh.userData.hoverType = 'Road';
        scene.add(mesh);
    }

    private getApproaches(inter: IntersectionConfigV2): ApproachInfo[] {
        const approaches: ApproachInfo[] = [];
        for (let i = 0; i < inter.approachAngles.length; i++) {
            const angle = inter.approachAngles[i];
            const roadId = inter.approachRoadIds[Math.min(i, inter.approachRoadIds.length - 1)];
            const road = this.config.roads.find(r => r.id === roadId);

            approaches.push({
                angle,
                roadId,
                road,
                // Direction the approach comes FROM (toward center)
                dirToCenter: { x: -Math.cos(angle), z: -Math.sin(angle) },
                // Point at the edge of the intersection on this approach
                edgePoint: {
                    x: inter.center.x + Math.cos(angle) * inter.radius,
                    z: inter.center.z + Math.sin(angle) * inter.radius,
                },
            });
        }
        return approaches;
    }

    private buildCrosswalk(scene: THREE.Scene, inter: IntersectionConfigV2, approach: ApproachInfo): void {
        const cwW = inter.crosswalkWidth;
        const road = approach.road;
        const carriageWidth = road ? road.carriagewayWidth : 9;

        // Crosswalk positioned just outside the intersection patch
        const offset = inter.radius + cwW / 2;
        const cx = inter.center.x + Math.cos(approach.angle) * offset;
        const cz = inter.center.z + Math.sin(approach.angle) * offset;

        const tex = this.textures.createCrosswalkTexture(carriageWidth);
        const geo = new THREE.PlaneGeometry(carriageWidth, cwW);
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        // Rotate to align perpendicular to the approach direction
        mesh.rotation.z = -approach.angle;
        mesh.position.set(cx, 0.03, cz);
        mesh.receiveShadow = true;
        mesh.userData.hoverLabel = 'Crossing';
        mesh.userData.hoverType = 'Terrain';
        scene.add(mesh);
    }

    private buildStopBar(scene: THREE.Scene, inter: IntersectionConfigV2, approach: ApproachInfo): void {
        const road = approach.road;
        const carriageWidth = road ? road.carriagewayWidth : 9;
        const barThickness = 0.5;

        // Stop bar just before the crosswalk
        const offset = inter.radius + inter.crosswalkWidth + inter.stopBarOffset;
        const bx = inter.center.x + Math.cos(approach.angle) * offset;
        const bz = inter.center.z + Math.sin(approach.angle) * offset;

        const geo = new THREE.PlaneGeometry(carriageWidth, barThickness);
        const mat = new THREE.MeshLambertMaterial({ color: 0xEEEEEE });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = -approach.angle;
        mesh.position.set(bx, 0.035, bz);
        mesh.receiveShadow = true;
        scene.add(mesh);
    }

    private buildTrafficLights(scene: THREE.Scene, inter: IntersectionConfigV2, approaches: ApproachInfo[]): void {
        for (const approach of approaches) {
            const road = approach.road;
            const halfC = road ? road.carriagewayWidth / 2 : 4.5;
            const curbW = road ? road.curbWidth : 0.4;

            // Position: right side of the approach, on the curb
            const perp = perpCW(approach.dirToCenter);
            const offset = inter.radius + inter.crosswalkWidth + 2;
            const baseX = inter.center.x + Math.cos(approach.angle) * offset;
            const baseZ = inter.center.z + Math.sin(approach.angle) * offset;
            const sx = baseX + perp.x * (halfC + curbW + 1);
            const sz = baseZ + perp.z * (halfC + curbW + 1);

            this.buildTrafficLight(scene, sx, sz, approach.angle + Math.PI);
        }
    }

    private buildTrafficLight(scene: THREE.Scene, x: number, z: number, facingAngle: number): void {
        const group = new THREE.Group();

        // Pole
        const poleHeight = 4.5;
        const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, poleHeight, 6);
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = poleHeight / 2;
        pole.castShadow = true;
        group.add(pole);

        // Housing (rectangular box for 3 lights)
        const housingGeo = new THREE.BoxGeometry(0.6, 1.5, 0.4);
        const housingMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const housing = new THREE.Mesh(housingGeo, housingMat);
        housing.position.y = poleHeight + 0.75;
        housing.rotation.y = facingAngle;
        housing.castShadow = true;
        group.add(housing);

        // Three lights (red, amber, green)
        const lightColors = [0xFF0000, 0xFFAA00, 0x00FF00];
        const lightPositions = [0.45, 0, -0.45];
        for (let i = 0; i < 3; i++) {
            const lightGeo = new THREE.CircleGeometry(0.12, 8);
            const lightMat = new THREE.MeshLambertMaterial({
                color: lightColors[i],
                emissive: lightColors[i],
                emissiveIntensity: i === 0 ? 0.5 : 0.1, // Red is "on" by default
            });
            const light = new THREE.Mesh(lightGeo, lightMat);
            light.position.y = poleHeight + 0.75 + lightPositions[i];
            light.position.z = 0.21;
            light.rotation.y = facingAngle;
            group.add(light);
        }

        // Visor hood over the housing
        const visorGeo = new THREE.BoxGeometry(0.7, 0.15, 0.6);
        const visorMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const visor = new THREE.Mesh(visorGeo, visorMat);
        visor.position.y = poleHeight + 1.55;
        visor.rotation.y = facingAngle;
        group.add(visor);

        group.position.set(x, 0, z);
        group.userData.hoverLabel = 'Traffic Light';
        group.userData.hoverType = 'Traffic Control';
        scene.add(group);
    }

    private buildYieldSigns(scene: THREE.Scene, inter: IntersectionConfigV2, approaches: ApproachInfo[]): void {
        // For T-intersections, only the stem road gets a yield sign
        // For standard, all approaches get one
        const stemApproaches = inter.type === 'T'
            ? approaches.slice(-1) // last approach is typically the stem
            : approaches;

        for (const approach of stemApproaches) {
            const road = approach.road;
            const halfC = road ? road.carriagewayWidth / 2 : 4.5;
            const curbW = road ? road.curbWidth : 0.4;

            const perp = perpCW(approach.dirToCenter);
            const offset = inter.radius + inter.crosswalkWidth + 2;
            const baseX = inter.center.x + Math.cos(approach.angle) * offset;
            const baseZ = inter.center.z + Math.sin(approach.angle) * offset;
            const sx = baseX + perp.x * (halfC + curbW + 1);
            const sz = baseZ + perp.z * (halfC + curbW + 1);

            this.buildYieldSign(scene, sx, sz, approach.angle + Math.PI);
        }
    }

    private buildYieldSign(scene: THREE.Scene, x: number, z: number, facingAngle: number): void {
        const group = new THREE.Group();

        // Pole
        const poleHeight = 3;
        const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, poleHeight, 6);
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = poleHeight / 2;
        pole.castShadow = true;
        group.add(pole);

        // Inverted triangle (UK give way sign)
        const signGroup = new THREE.Group();
        const borderShape = new THREE.Shape();
        const br = 0.5;
        borderShape.moveTo(0, -br);
        borderShape.lineTo(br * 0.866, br * 0.5);
        borderShape.lineTo(-br * 0.866, br * 0.5);
        borderShape.closePath();

        const borderGeo = new THREE.ShapeGeometry(borderShape);
        const borderMat = new THREE.MeshLambertMaterial({ color: 0xCC0000, side: THREE.DoubleSide });
        signGroup.add(new THREE.Mesh(borderGeo, borderMat));

        const innerShape = new THREE.Shape();
        const ir = 0.35;
        innerShape.moveTo(0, -ir);
        innerShape.lineTo(ir * 0.866, ir * 0.5);
        innerShape.lineTo(-ir * 0.866, ir * 0.5);
        innerShape.closePath();

        const innerGeo = new THREE.ShapeGeometry(innerShape);
        const innerMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
        const inner = new THREE.Mesh(innerGeo, innerMat);
        inner.position.z = 0.01;
        signGroup.add(inner);

        signGroup.position.y = poleHeight + 0.3;
        signGroup.rotation.y = facingAngle;
        group.add(signGroup);

        group.position.set(x, 0, z);
        group.userData.hoverLabel = 'Give Way';
        group.userData.hoverType = 'Traffic Control';
        scene.add(group);
    }

    private buildCurbRamps(scene: THREE.Scene, inter: IntersectionConfigV2, approaches: ApproachInfo[]): void {
        // Place curb ramps between adjacent approaches (at corners)
        for (let i = 0; i < approaches.length; i++) {
            const a1 = approaches[i];
            const a2 = approaches[(i + 1) % approaches.length];

            const midAngle = (a1.angle + a2.angle) / 2;
            const rx = inter.center.x + Math.cos(midAngle) * (inter.radius + 1);
            const rz = inter.center.z + Math.sin(midAngle) * (inter.radius + 1);

            const rampGeo = new THREE.PlaneGeometry(2, 1.5);
            const rampMat = new THREE.MeshLambertMaterial({ color: 0xCC9933 });
            const ramp = new THREE.Mesh(rampGeo, rampMat);
            ramp.rotation.x = -Math.PI / 2;
            ramp.rotation.z = -midAngle;
            ramp.position.set(rx, 0.1, rz);
            ramp.receiveShadow = true;
            ramp.userData.hoverLabel = 'Curb Ramp';
            ramp.userData.hoverType = 'Terrain';
            scene.add(ramp);
        }
    }
}

interface ApproachInfo {
    angle: number;
    roadId: string;
    road: RoadSegmentConfig | undefined;
    dirToCenter: PathPoint;
    edgePoint: PathPoint;
}
