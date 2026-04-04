import * as THREE from 'three';
import { WorldConfig, IntersectionConfig } from './WorldConfig';
import { TextureFactory } from './TextureFactory';

export class IntersectionBuilder {
    private config: WorldConfig;
    private textures: TextureFactory;

    constructor(config: WorldConfig, textures: TextureFactory) {
        this.config = config;
        this.textures = textures;
    }

    build(scene: THREE.Scene): void {
        for (const intersection of this.config.intersections) {
            this.buildIntersection(scene, intersection);
        }
    }

    private buildIntersection(scene: THREE.Scene, inter: IntersectionConfig) {
        const hRoad = this.config.roads.find(r => r.direction === 'horizontal');
        const vRoad = this.config.roads.find(r => r.direction === 'vertical');
        if (!hRoad || !vRoad) return;

        const hHalfC = hRoad.carriagewayWidth / 2;
        const vHalfC = vRoad.carriagewayWidth / 2;

        // Intersection box — patch over lane markings
        this.buildIntersectionPatch(scene, inter, hHalfC, vHalfC);

        // Crosswalks
        this.buildCrosswalks(scene, inter, hRoad, vRoad);

        // Stop bars
        this.buildStopBars(scene, inter, hRoad, vRoad);

        // Curb ramps at all 4 corners
        this.buildCurbRamps(scene, inter, hRoad, vRoad);

        // Stop signs
        this.buildStopSigns(scene, inter, hRoad, vRoad);
    }

    private buildIntersectionPatch(scene: THREE.Scene, inter: IntersectionConfig, hHalfC: number, vHalfC: number) {
        // Dark asphalt rectangle covering the intersection box (no lane markings)
        const patchW = vHalfC * 2 + inter.crosswalkWidth * 2;
        const patchH = hHalfC * 2 + inter.crosswalkWidth * 2;
        const geo = new THREE.PlaneGeometry(patchW, patchH);
        const mat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(inter.centerX, 0.02, inter.centerZ);
        mesh.receiveShadow = true;
        scene.add(mesh);
    }

    private buildCrosswalks(scene: THREE.Scene, inter: IntersectionConfig, hRoad: typeof this.config.roads[0], vRoad: typeof this.config.roads[0]) {
        const hHalfC = hRoad.carriagewayWidth / 2;
        const vHalfC = vRoad.carriagewayWidth / 2;
        const cwW = inter.crosswalkWidth;

        // North crosswalk (pedestrian crosses the horizontal road on the north approach of the vertical road)
        this.placeCrosswalk(scene, inter.centerX, inter.centerZ - hHalfC - cwW / 2, vRoad.carriagewayWidth, cwW, 0);
        // South crosswalk
        this.placeCrosswalk(scene, inter.centerX, inter.centerZ + hHalfC + cwW / 2, vRoad.carriagewayWidth, cwW, 0);
        // West crosswalk
        this.placeCrosswalk(scene, inter.centerX - vHalfC - cwW / 2, inter.centerZ, cwW, hRoad.carriagewayWidth, Math.PI / 2);
        // East crosswalk
        this.placeCrosswalk(scene, inter.centerX + vHalfC + cwW / 2, inter.centerZ, cwW, hRoad.carriagewayWidth, Math.PI / 2);
    }

    private placeCrosswalk(scene: THREE.Scene, x: number, z: number, w: number, h: number, rotation: number) {
        const tex = this.textures.createCrosswalkTexture(w);
        const geo = new THREE.PlaneGeometry(w, h);
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = rotation;
        mesh.position.set(x, 0.03, z);
        mesh.receiveShadow = true;
        mesh.userData.hoverLabel = 'Crosswalk';
        mesh.userData.hoverType = 'Terrain';
        scene.add(mesh);
    }

    private buildStopBars(scene: THREE.Scene, inter: IntersectionConfig, hRoad: typeof this.config.roads[0], vRoad: typeof this.config.roads[0]) {
        const hHalfC = hRoad.carriagewayWidth / 2;
        const vHalfC = vRoad.carriagewayWidth / 2;
        const cwW = inter.crosswalkWidth;
        const sbOffset = inter.stopBarOffset;
        const barThickness = 0.5;

        // Stop bars are placed just before the crosswalk on each approach
        // North approach (vehicle coming south on vertical road, stops north of intersection)
        this.placeStopBar(scene, inter.centerX, inter.centerZ - hHalfC - cwW - sbOffset, vRoad.carriagewayWidth, barThickness, 0);
        // South approach
        this.placeStopBar(scene, inter.centerX, inter.centerZ + hHalfC + cwW + sbOffset, vRoad.carriagewayWidth, barThickness, 0);
        // West approach
        this.placeStopBar(scene, inter.centerX - vHalfC - cwW - sbOffset, inter.centerZ, barThickness, hRoad.carriagewayWidth, 0);
        // East approach
        this.placeStopBar(scene, inter.centerX + vHalfC + cwW + sbOffset, inter.centerZ, barThickness, hRoad.carriagewayWidth, 0);
    }

    private placeStopBar(scene: THREE.Scene, x: number, z: number, w: number, h: number, _rotation: number) {
        const geo = new THREE.PlaneGeometry(w, h);
        const mat = new THREE.MeshLambertMaterial({ color: 0xEEEEEE });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0.035, z);
        mesh.receiveShadow = true;
        scene.add(mesh);
    }

    private buildCurbRamps(scene: THREE.Scene, inter: IntersectionConfig, hRoad: typeof this.config.roads[0], vRoad: typeof this.config.roads[0]) {
        const hHalfC = hRoad.carriagewayWidth / 2;
        const vHalfC = vRoad.carriagewayWidth / 2;
        const curbH = hRoad.curbHeight;
        const rampW = 2;
        const rampD = 1.5;

        // 4 corners — each gets a ramp (depressed curb with warning surface)
        const corners = [
            { x: inter.centerX - vHalfC - rampD / 2, z: inter.centerZ - hHalfC - rampD / 2 }, // NW
            { x: inter.centerX + vHalfC + rampD / 2, z: inter.centerZ - hHalfC - rampD / 2 }, // NE
            { x: inter.centerX - vHalfC - rampD / 2, z: inter.centerZ + hHalfC + rampD / 2 }, // SW
            { x: inter.centerX + vHalfC + rampD / 2, z: inter.centerZ + hHalfC + rampD / 2 }, // SE
        ];

        for (const corner of corners) {
            // Ramp slope (simple wedge approximated as a flat colored pad)
            const rampGeo = new THREE.PlaneGeometry(rampW, rampD);
            const rampMat = new THREE.MeshLambertMaterial({ color: 0xCC9933 }); // Detectable warning surface (yellow truncated domes)
            const ramp = new THREE.Mesh(rampGeo, rampMat);
            ramp.rotation.x = -Math.PI / 2;
            ramp.position.set(corner.x, curbH * 0.3, corner.z);
            ramp.receiveShadow = true;
            ramp.userData.hoverLabel = 'Curb Ramp';
            ramp.userData.hoverType = 'Terrain';
            scene.add(ramp);
        }
    }

    private buildStopSigns(scene: THREE.Scene, inter: IntersectionConfig, hRoad: typeof this.config.roads[0], vRoad: typeof this.config.roads[0]) {
        const hHalfC = hRoad.carriagewayWidth / 2;
        const vHalfC = vRoad.carriagewayWidth / 2;
        const curbW = hRoad.curbWidth;
        const signHeight = 3.5;
        const poleHeight = 3;

        // Stop signs placed at the near-right corner of each approach
        const approaches = [
            // North approach — sign on right side (east of vertical road), facing south
            { x: inter.centerX + vHalfC + curbW + 1, z: inter.centerZ - hHalfC - 3, rotY: 0 },
            // South approach — sign on right side (west of vertical road), facing north
            { x: inter.centerX - vHalfC - curbW - 1, z: inter.centerZ + hHalfC + 3, rotY: Math.PI },
            // West approach — sign on right side (north of horizontal road), facing east
            { x: inter.centerX - vHalfC - 3, z: inter.centerZ - hHalfC - curbW - 1, rotY: Math.PI / 2 },
            // East approach — sign on right side (south of horizontal road), facing west
            { x: inter.centerX + vHalfC + 3, z: inter.centerZ + hHalfC + curbW + 1, rotY: -Math.PI / 2 },
        ];

        for (const approach of approaches) {
            const group = new THREE.Group();

            // Pole
            const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, poleHeight, 6);
            const poleMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.y = poleHeight / 2;
            pole.castShadow = true;
            group.add(pole);

            // Octagonal sign face
            const sign = this.createOctagonSign();
            sign.position.y = signHeight;
            sign.rotation.y = approach.rotY;
            group.add(sign);

            group.position.set(approach.x, 0, approach.z);
            group.userData.hoverLabel = 'Stop Sign';
            group.userData.hoverType = 'Traffic Control';
            scene.add(group);
        }
    }

    private createOctagonSign(): THREE.Group {
        const group = new THREE.Group();

        // Octagon shape
        const shape = new THREE.Shape();
        const r = 0.6;
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI / 8) + (i * Math.PI / 4);
            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle);
            if (i === 0) shape.moveTo(x, y);
            else shape.lineTo(x, y);
        }
        shape.closePath();

        const geo = new THREE.ShapeGeometry(shape);
        const mat = new THREE.MeshLambertMaterial({ color: 0xCC0000, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);

        // White border (slightly larger octagon behind)
        const borderShape = new THREE.Shape();
        const br = 0.68;
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI / 8) + (i * Math.PI / 4);
            const x = br * Math.cos(angle);
            const y = br * Math.sin(angle);
            if (i === 0) borderShape.moveTo(x, y);
            else borderShape.lineTo(x, y);
        }
        borderShape.closePath();

        const borderGeo = new THREE.ShapeGeometry(borderShape);
        const borderMat = new THREE.MeshLambertMaterial({ color: 0xEEEEEE, side: THREE.DoubleSide });
        const border = new THREE.Mesh(borderGeo, borderMat);
        border.position.z = -0.02;
        group.add(border);

        return group;
    }
}
