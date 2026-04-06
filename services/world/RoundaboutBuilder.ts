import * as THREE from 'three';
import { WorldConfig, IntersectionConfigV2 } from './WorldConfigV2';
import { TextureFactory } from './TextureFactory';

export class RoundaboutBuilder {
    private config: WorldConfig;
    private textures: TextureFactory;

    constructor(config: WorldConfig, textures: TextureFactory) {
        this.config = config;
        this.textures = textures;
    }

    build(scene: THREE.Scene): void {
        for (const inter of this.config.intersections) {
            if (inter.type === 'roundabout') {
                this.buildRoundabout(scene, inter);
            }
        }
    }

    private buildRoundabout(scene: THREE.Scene, inter: IntersectionConfigV2): void {
        const innerR = inter.roundaboutInnerRadius || 15;
        const outerR = inter.roundaboutOuterRadius || 30;
        const cx = inter.center.x;
        const cz = inter.center.z;
        const segments = 48;

        // Carriageway ring
        this.buildCarriagewayRing(scene, cx, cz, innerR, outerR, segments);

        // Central island (grass)
        this.buildCentralIsland(scene, cx, cz, innerR, segments);

        // Inner curb ring
        this.buildCurbRing(scene, cx, cz, innerR - 0.4, innerR, segments);

        // Outer curb ring
        this.buildCurbRing(scene, cx, cz, outerR, outerR + 0.4, segments);

        // Directional arrows painted on carriageway
        this.buildDirectionArrows(scene, cx, cz, innerR, outerR, segments);

        // Yield signs at each approach
        for (const arm of inter.arms) {
            const angle = arm.angle;
            this.buildYieldSign(scene, cx, cz, outerR, angle);
        }

        // Central island decoration (small monument/fountain)
        this.buildIslandDecoration(scene, cx, cz);
    }

    private buildCarriagewayRing(
        scene: THREE.Scene,
        cx: number, cz: number,
        innerR: number, outerR: number,
        segments: number
    ): void {
        const geo = new THREE.RingGeometry(innerR, outerR, segments);
        const mat = new THREE.MeshLambertMaterial({
            map: this.textures.createRoundaboutTexture(),
            side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(cx, 0.02, cz);
        mesh.receiveShadow = true;
        mesh.userData.hoverLabel = 'Roundabout';
        mesh.userData.hoverType = 'Road';
        scene.add(mesh);
    }

    private buildCentralIsland(
        scene: THREE.Scene,
        cx: number, cz: number,
        radius: number,
        segments: number
    ): void {
        const geo = new THREE.CircleGeometry(radius - 0.5, segments);
        const mat = new THREE.MeshLambertMaterial({
            map: this.textures.createGrassTexture(),
        });
        // Override the grass texture repeat for the small island
        mat.map!.repeat.set(4, 4);

        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(cx, 0.15, cz);
        mesh.receiveShadow = true;
        mesh.userData.hoverLabel = 'Island';
        mesh.userData.hoverType = 'Terrain';
        scene.add(mesh);
    }

    private buildCurbRing(
        scene: THREE.Scene,
        cx: number, cz: number,
        innerR: number, outerR: number,
        segments: number
    ): void {
        const geo = new THREE.RingGeometry(innerR, outerR, segments);
        const mat = new THREE.MeshLambertMaterial({ color: 0x999999, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(cx, 0.15, cz);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        mesh.userData.hoverLabel = 'Curb';
        mesh.userData.hoverType = 'Terrain';
        scene.add(mesh);

        // Add a raised curb edge (thin torus-like ring)
        const torusGeo = new THREE.TorusGeometry((innerR + outerR) / 2, (outerR - innerR) / 2, 4, segments);
        const torusMat = new THREE.MeshLambertMaterial({ color: 0xAAAAAA });
        const torus = new THREE.Mesh(torusGeo, torusMat);
        torus.rotation.x = -Math.PI / 2;
        torus.position.set(cx, 0.15, cz);
        torus.castShadow = true;
        scene.add(torus);
    }

    private buildDirectionArrows(
        scene: THREE.Scene,
        cx: number, cz: number,
        innerR: number, outerR: number,
        segments: number
    ): void {
        // Paint clockwise arrows at 4 positions on the roundabout (UK drives on left)
        const midR = (innerR + outerR) / 2;
        const arrowCount = 4;

        for (let i = 0; i < arrowCount; i++) {
            const angle = (i / arrowCount) * Math.PI * 2;
            const ax = cx + Math.cos(angle) * midR;
            const az = cz + Math.sin(angle) * midR;

            // Arrow body (thin chevron shape)
            const arrowLen = 3;
            const arrowW = 1.5;
            // Arrow points clockwise (tangent direction)
            const tangentAngle = angle + Math.PI / 2; // perpendicular to radius = tangent

            const group = new THREE.Group();

            // Arrow shaft
            const shaftGeo = new THREE.PlaneGeometry(arrowLen, arrowW * 0.4);
            const shaftMat = new THREE.MeshLambertMaterial({ color: 0xEEEEEE });
            const shaft = new THREE.Mesh(shaftGeo, shaftMat);
            shaft.rotation.x = -Math.PI / 2;
            group.add(shaft);

            // Arrow head (triangle)
            const headShape = new THREE.Shape();
            headShape.moveTo(0, arrowW / 2);
            headShape.lineTo(arrowW * 0.6, 0);
            headShape.lineTo(0, -arrowW / 2);
            headShape.closePath();
            const headGeo = new THREE.ShapeGeometry(headShape);
            const head = new THREE.Mesh(headGeo, shaftMat);
            head.rotation.x = -Math.PI / 2;
            head.position.x = arrowLen / 2;
            group.add(head);

            group.position.set(ax, 0.025, az);
            group.rotation.y = -tangentAngle;
            scene.add(group);
        }
    }

    private buildYieldSign(
        scene: THREE.Scene,
        cx: number, cz: number,
        outerR: number,
        approachAngle: number
    ): void {
        // Position sign at the approach, just outside the roundabout
        const signDist = outerR + 3;
        const sx = cx + Math.cos(approachAngle) * signDist;
        const sz = cz + Math.sin(approachAngle) * signDist;

        const group = new THREE.Group();

        // Pole
        const poleHeight = 3;
        const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, poleHeight, 6);
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = poleHeight / 2;
        pole.castShadow = true;
        group.add(pole);

        // Inverted triangle yield sign (UK style: white with red border)
        const signGroup = this.createYieldSign();
        signGroup.position.y = poleHeight + 0.3;
        // Face toward the approaching traffic
        signGroup.rotation.y = approachAngle + Math.PI;
        group.add(signGroup);

        group.position.set(sx, 0, sz);
        group.userData.hoverLabel = 'Give Way';
        group.userData.hoverType = 'Traffic Control';
        scene.add(group);
    }

    private createYieldSign(): THREE.Group {
        const group = new THREE.Group();

        // Red border (larger inverted triangle)
        const borderShape = new THREE.Shape();
        const br = 0.55;
        borderShape.moveTo(0, -br);
        borderShape.lineTo(br * 0.866, br * 0.5);
        borderShape.lineTo(-br * 0.866, br * 0.5);
        borderShape.closePath();

        const borderGeo = new THREE.ShapeGeometry(borderShape);
        const borderMat = new THREE.MeshLambertMaterial({ color: 0xCC0000, side: THREE.DoubleSide });
        const border = new THREE.Mesh(borderGeo, borderMat);
        group.add(border);

        // White inner triangle
        const innerShape = new THREE.Shape();
        const ir = 0.4;
        innerShape.moveTo(0, -ir);
        innerShape.lineTo(ir * 0.866, ir * 0.5);
        innerShape.lineTo(-ir * 0.866, ir * 0.5);
        innerShape.closePath();

        const innerGeo = new THREE.ShapeGeometry(innerShape);
        const innerMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
        const inner = new THREE.Mesh(innerGeo, innerMat);
        inner.position.z = 0.01;
        group.add(inner);

        return group;
    }

    private buildIslandDecoration(scene: THREE.Scene, cx: number, cz: number): void {
        // Simple monument: a stone column with a sphere on top
        const group = new THREE.Group();

        // Base pedestal
        const baseGeo = new THREE.CylinderGeometry(2, 2.5, 1.5, 8);
        const baseMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.75;
        base.castShadow = true;
        group.add(base);

        // Column
        const colGeo = new THREE.CylinderGeometry(0.8, 1, 5, 8);
        const colMat = new THREE.MeshLambertMaterial({ color: 0x999999 });
        const col = new THREE.Mesh(colGeo, colMat);
        col.position.y = 4;
        col.castShadow = true;
        group.add(col);

        // Sphere on top
        const sphereGeo = new THREE.SphereGeometry(1.2, 12, 8);
        const sphereMat = new THREE.MeshLambertMaterial({ color: 0xBBBB88 });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.position.y = 7.5;
        sphere.castShadow = true;
        group.add(sphere);

        group.position.set(cx, 0.15, cz);
        group.userData.hoverLabel = 'Monument';
        group.userData.hoverType = 'Landmark';
        scene.add(group);
    }
}
