import * as THREE from 'three';
import { WorldConfig, ZoneType } from './WorldConfig';
import { ZoneMap } from './ZoneMap';

export class FurnitureBuilder {
    private config: WorldConfig;
    private zoneMap: ZoneMap;

    constructor(config: WorldConfig, zoneMap: ZoneMap) {
        this.config = config;
        this.zoneMap = zoneMap;
    }

    build(scene: THREE.Scene): void {
        this.buildStreetlights(scene);
        this.buildBenches(scene);
        this.buildTrashCans(scene);
        this.buildHydrants(scene);
        this.buildFences(scene);
    }

    private buildStreetlights(scene: THREE.Scene) {
        const spacing = this.config.furniture.streetlightSpacing;
        const maxLights = this.config.furniture.maxPointLights;
        const clearance = this.config.furniture.intersectionClearance;
        let pointLightCount = 0;

        for (let i = 0; i < this.config.roads.length; i++) {
            const road = this.config.roads[i];
            const ws = this.config.worldScale;
            const center = road.centerline * ws;
            const halfC = road.carriagewayWidth / 2;
            const curbW = road.curbWidth;
            const furnW = road.furnishingStripWidth;
            const isH = road.direction === 'horizontal';
            const length = isH ? this.config.worldWidth : this.config.worldHeight;

            for (const side of [-1, 1]) {
                const stripCenter = center + side * (halfC + curbW + furnW / 2);

                for (let t = spacing / 2; t < length; t += spacing) {
                    const x = isH ? t : stripCenter;
                    const z = isH ? stripCenter : t;

                    // Skip near intersections and sight triangles
                    if (this.zoneMap.isNearIntersection(x, z, clearance)) continue;
                    if (this.zoneMap.isInZone(x, z, ZoneType.SIGHT_TRIANGLE)) continue;

                    const light = this.createStreetlight();
                    light.position.set(x, 0, z);

                    // Orient arm toward road
                    if (isH) {
                        light.rotation.y = side > 0 ? 0 : Math.PI;
                    } else {
                        light.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
                    }
                    scene.add(light);

                    // Add point lights sparingly
                    if (pointLightCount < maxLights && t % (spacing * 4) < spacing) {
                        const pl = new THREE.PointLight(this.config.colors.LAMP_GLOW, 0.3, 30);
                        pl.position.set(x + (isH ? 0 : side * 3), 11, z + (isH ? side * 3 : 0));
                        scene.add(pl);
                        pointLightCount++;
                    }
                }
            }
        }
    }

    private buildBenches(scene: THREE.Scene) {
        const spacing = this.config.furniture.benchSpacing;
        if (spacing === 0) return;
        const clearance = this.config.furniture.intersectionClearance;

        for (const road of this.config.roads) {
            const ws = this.config.worldScale;
            const center = road.centerline * ws;
            const halfC = road.carriagewayWidth / 2;
            const curbW = road.curbWidth;
            const furnW = road.furnishingStripWidth;
            const isH = road.direction === 'horizontal';
            const length = isH ? this.config.worldWidth : this.config.worldHeight;

            // Benches only on one side (north/west) to avoid clutter
            const side = -1;
            const stripCenter = center + side * (halfC + curbW + furnW / 2);

            for (let t = spacing / 2; t < length; t += spacing) {
                const x = isH ? t : stripCenter;
                const z = isH ? stripCenter : t;

                if (this.zoneMap.isNearIntersection(x, z, clearance)) continue;
                if (this.zoneMap.isInZone(x, z, ZoneType.SIGHT_TRIANGLE)) continue;

                const bench = this.createBench();
                bench.position.set(x, 0, z);
                if (!isH) bench.rotation.y = Math.PI / 2;
                scene.add(bench);
            }
        }
    }

    private buildTrashCans(scene: THREE.Scene) {
        // Place near each intersection corner
        for (const inter of this.config.intersections) {
            const hRoad = this.config.roads.find(r => r.direction === 'horizontal');
            const vRoad = this.config.roads.find(r => r.direction === 'vertical');
            if (!hRoad || !vRoad) continue;

            const hHalfC = hRoad.carriagewayWidth / 2;
            const vHalfC = vRoad.carriagewayWidth / 2;
            const offset = 6;

            const positions = [
                { x: inter.centerX + vHalfC + offset, z: inter.centerZ - hHalfC - offset },
                { x: inter.centerX - vHalfC - offset, z: inter.centerZ + hHalfC + offset },
                { x: inter.centerX + vHalfC + offset, z: inter.centerZ + hHalfC + offset },
                { x: inter.centerX - vHalfC - offset, z: inter.centerZ - hHalfC - offset },
            ];

            for (const pos of positions) {
                if (!this.zoneMap.isInZone(pos.x, pos.z, ZoneType.FURNISHING_STRIP) &&
                    !this.zoneMap.isInZone(pos.x, pos.z, ZoneType.OPEN_LANDSCAPE)) continue;

                const tc = this.createTrashCan();
                tc.position.set(pos.x, 0, pos.z);
                scene.add(tc);
            }
        }
    }

    private buildHydrants(scene: THREE.Scene) {
        // Place along roads at intervals
        const spacing = this.config.furniture.hydrantSpacing;
        const clearance = this.config.furniture.intersectionClearance;

        for (const road of this.config.roads) {
            const ws = this.config.worldScale;
            const center = road.centerline * ws;
            const halfC = road.carriagewayWidth / 2;
            const curbW = road.curbWidth;
            const isH = road.direction === 'horizontal';
            const length = isH ? this.config.worldWidth : this.config.worldHeight;

            // Hydrants on one side, near curb
            const side = 1;
            const pos = center + side * (halfC + curbW + 0.8);

            for (let t = spacing / 3; t < length; t += spacing) {
                const x = isH ? t : pos;
                const z = isH ? pos : t;

                if (this.zoneMap.isNearIntersection(x, z, clearance)) continue;

                const fh = this.createFireHydrant();
                fh.position.set(x, 0, z);
                scene.add(fh);
            }
        }
    }

    private buildFences(scene: THREE.Scene) {
        const fenceZ = this.config.homeLotBoundaryY * this.config.worldScale;
        const sectionLen = 20;

        // Find vertical road to create gap
        const vRoad = this.config.roads.find(r => r.direction === 'vertical');
        const vCenter = vRoad ? vRoad.centerline * this.config.worldScale : -1;
        const vHalfTotal = vRoad ? (vRoad.carriagewayWidth / 2 + vRoad.curbWidth + vRoad.furnishingStripWidth + vRoad.clearWalkWidth + 2) : 0;

        for (let x = sectionLen / 2; x < this.config.worldWidth; x += sectionLen + 1) {
            // Gap for road
            if (vRoad && x > vCenter - vHalfTotal && x < vCenter + vHalfTotal) continue;

            const fence = this.createFenceSection(sectionLen);
            fence.position.set(x, 0, fenceZ);
            scene.add(fence);
        }
    }

    // --- Furniture factory methods (extracted from ThreeGame) ---

    private createStreetlight(): THREE.Group {
        const group = new THREE.Group();
        const metalMat = new THREE.MeshLambertMaterial({ color: this.config.colors.METAL });

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 12, 6), metalMat);
        pole.position.y = 6;
        pole.castShadow = true;
        group.add(pole);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 0.3), metalMat);
        arm.position.set(1.5, 12, 0);
        group.add(arm);

        const housing = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), new THREE.MeshLambertMaterial({ color: 0x555555 }));
        housing.position.set(3, 11.5, 0);
        group.add(housing);

        const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 6, 6),
            new THREE.MeshBasicMaterial({ color: this.config.colors.LAMP_GLOW })
        );
        bulb.position.set(3, 11, 0);
        group.add(bulb);

        pole.userData.hoverLabel = 'Streetlight';
        pole.userData.hoverType = 'Furniture';
        return group;
    }

    private createBench(): THREE.Group {
        const group = new THREE.Group();
        const woodMat = new THREE.MeshLambertMaterial({ color: this.config.colors.WOOD });
        const metalMat = new THREE.MeshLambertMaterial({ color: this.config.colors.METAL });

        const seat = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 1.5), woodMat);
        seat.position.y = 2;
        group.add(seat);

        const back = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 0.3), woodMat);
        back.position.set(0, 3, -0.6);
        back.rotation.x = -0.15;
        group.add(back);

        const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2, 1.5), metalMat);
        leg1.position.set(-2, 1, 0);
        group.add(leg1);

        const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2, 1.5), metalMat);
        leg2.position.set(2, 1, 0);
        group.add(leg2);

        seat.userData.hoverLabel = 'Bench';
        seat.userData.hoverType = 'Furniture';
        return group;
    }

    private createTrashCan(): THREE.Group {
        const group = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(1, 1, 2.5, 8),
            new THREE.MeshLambertMaterial({ color: this.config.colors.TRASH_CAN })
        );
        body.position.y = 1.25;
        group.add(body);

        const lid = new THREE.Mesh(
            new THREE.CylinderGeometry(1.1, 1.1, 0.3, 8),
            new THREE.MeshLambertMaterial({ color: 0x666666 })
        );
        lid.position.y = 2.6;
        group.add(lid);

        body.userData.hoverLabel = 'Trash Can';
        body.userData.hoverType = 'Furniture';
        return group;
    }

    private createFireHydrant(): THREE.Group {
        const group = new THREE.Group();
        const hydrantMat = new THREE.MeshLambertMaterial({ color: this.config.colors.HYDRANT });

        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 2, 8), hydrantMat);
        body.position.y = 1;
        group.add(body);

        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.6, 6, 6), hydrantMat);
        cap.position.y = 2.2;
        group.add(cap);

        body.userData.hoverLabel = 'Fire Hydrant';
        body.userData.hoverType = 'Furniture';
        return group;
    }

    private createFenceSection(length: number): THREE.Group {
        const group = new THREE.Group();
        const fenceMat = new THREE.MeshLambertMaterial({ color: this.config.colors.FENCE });

        const post1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3, 0.5), fenceMat);
        post1.position.set(-length / 2, 1.5, 0);
        group.add(post1);

        const post2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3, 0.5), fenceMat);
        post2.position.set(length / 2, 1.5, 0);
        group.add(post2);

        const rail1 = new THREE.Mesh(new THREE.BoxGeometry(length, 0.3, 0.3), fenceMat);
        rail1.position.y = 1;
        group.add(rail1);

        const rail2 = new THREE.Mesh(new THREE.BoxGeometry(length, 0.3, 0.3), fenceMat);
        rail2.position.y = 2;
        group.add(rail2);

        post1.userData.hoverLabel = 'Fence';
        post1.userData.hoverType = 'Furniture';
        return group;
    }
}
