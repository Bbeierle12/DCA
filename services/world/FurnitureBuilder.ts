import * as THREE from 'three';
import { WorldConfig, ZoneType, KerbsideConfig, getCarriagewayWidth, getKerbsideConfig } from './WorldConfigV2';
import { ZoneMapV2 } from './ZoneMapV2';
import {
    polylineLength, samplePolyline, perpCW, add, scale,
} from './RoadGeometry';
import { SeededRandom } from './SeededRandom';

export class FurnitureBuilder {
    private config: WorldConfig;
    private zoneMap: ZoneMapV2;
    private random: SeededRandom;

    constructor(config: WorldConfig, zoneMap: ZoneMapV2) {
        this.config = config;
        this.zoneMap = zoneMap;
        this.random = new SeededRandom(config.randomSeed ^ 0x9E3779B9);
    }

    build(scene: THREE.Scene): void {
        this.buildStreetlights(scene);
        this.buildBenches(scene);
        this.buildTrashCans(scene);
        this.buildHydrants(scene);
        this.buildBollards(scene);
        this.buildPhoneBoxes(scene);
        this.buildPillarBoxes(scene);
    }

    // ===== PATH-BASED PLACEMENT HELPERS =====

    /**
     * Walk along a road's polyline path at regular intervals,
     * placing items at a perpendicular offset from the centerline.
     */
    private placeAlongRoad(
        roadIndex: number,
        spacing: number,
        side: number,        // -1 = left, 1 = right
        callback: (x: number, z: number, angle: number, kerbside: KerbsideConfig) => void
    ): void {
        const road = this.config.roads[roadIndex];
        const halfC = getCarriagewayWidth(road) / 2;
        const curbW = road.curbWidth;
        const kerbside = getKerbsideConfig(road, side < 0 ? 'left' : 'right');
        const offset = side * (halfC + curbW + kerbside.width / 2);
        const totalLen = polylineLength(road.path);
        const clearance = this.config.furniture.intersectionClearance;

        for (let d = spacing / 2; d < totalLen; d += spacing) {
            const sample = samplePolyline(road.path, d);
            if (!sample) continue;

            const perp = perpCW(sample.direction);
            const pos = add(sample.point, scale(perp, offset));

            // Skip near intersections and in sight triangles
            if (this.zoneMap.isNearIntersection(pos.x, pos.z, clearance)) continue;
            if (this.zoneMap.isInZone(pos.x, pos.z, ZoneType.SIGHT_TRIANGLE)) continue;

            const angle = Math.atan2(sample.direction.z, sample.direction.x);
            callback(pos.x, pos.z, angle, kerbside);
        }
    }

    // ===== STREETLIGHTS =====

    private buildStreetlights(scene: THREE.Scene): void {
        const spacing = this.config.furniture.streetlightSpacing;
        const maxLights = this.config.furniture.maxPointLights;
        let pointLightCount = 0;
        let lightInterval = 0;

        for (let i = 0; i < this.config.roads.length; i++) {
            for (const side of [-1, 1]) {
                this.placeAlongRoad(i, spacing, side, (x, z, angle) => {
                    const light = this.createStreetlight();
                    light.position.set(x, 0, z);
                    // Orient arm toward road
                    light.rotation.y = angle + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
                    scene.add(light);

                    // Add point lights sparingly
                    lightInterval++;
                    if (pointLightCount < maxLights && lightInterval % 4 === 0) {
                        const pl = new THREE.PointLight(this.config.colors.LAMP_GLOW, 0.3, 30);
                        pl.position.set(x, 11, z);
                        scene.add(pl);
                        pointLightCount++;
                    }
                });
            }
        }
    }

    // ===== BENCHES =====

    private buildBenches(scene: THREE.Scene): void {
        const spacing = this.config.furniture.benchSpacing;
        if (spacing === 0) return;

        for (let i = 0; i < this.config.roads.length; i++) {
            // Benches only on one side to avoid clutter
            this.placeAlongRoad(i, spacing, -1, (x, z, angle, kerbside) => {
                if (kerbside.use !== 'planting' && kerbside.use !== 'parking') return;
                const bench = this.createBench();
                bench.position.set(x, 0, z);
                bench.rotation.y = angle;
                scene.add(bench);
            });
        }
    }

    // ===== TRASH CANS =====

    private buildTrashCans(scene: THREE.Scene): void {
        // Place near each intersection
        for (const inter of this.config.intersections) {
            const offset = inter.radius + 4;

            // Place at 4 cardinal points around the intersection
            for (let a = 0; a < 4; a++) {
                const angle = (a / 4) * Math.PI * 2 + Math.PI / 4;
                const tx = inter.center.x + Math.cos(angle) * offset;
                const tz = inter.center.z + Math.sin(angle) * offset;

                const zone = this.zoneMap.getZone(tx, tz);
                if (zone !== ZoneType.FURNISHING_STRIP && zone !== ZoneType.OPEN_LANDSCAPE) continue;

                const tc = this.createTrashCan();
                tc.position.set(tx, 0, tz);
                scene.add(tc);
            }
        }
    }

    // ===== HYDRANTS =====

    private buildHydrants(scene: THREE.Scene): void {
        const spacing = this.config.furniture.hydrantSpacing;

        for (let i = 0; i < this.config.roads.length; i++) {
            this.placeAlongRoad(i, spacing, 1, (x, z, _angle, kerbside) => {
                if (kerbside.use === 'transit_stop') return;
                const fh = this.createFireHydrant();
                fh.position.set(x, 0, z);
                scene.add(fh);
            });
        }
    }

    // ===== LONDON-SPECIFIC FURNITURE =====

    private buildBollards(scene: THREE.Scene): void {
        const spacing = this.config.furniture.bollardSpacing;

        for (let i = 0; i < this.config.roads.length; i++) {
            const road = this.config.roads[i];
            // Only place bollards along lanes and secondary roads
            if (road.type === 'boulevard' || road.type === 'main') continue;

            for (const side of [-1, 1]) {
                this.placeAlongRoad(i, spacing, side, (x, z, _angle, kerbside) => {
                    if (kerbside.use !== 'parking' && kerbside.use !== 'loading') return;
                    const bollard = this.createBollard();
                    bollard.position.set(x, 0, z);
                    scene.add(bollard);
                });
            }
        }
    }

    private buildPhoneBoxes(scene: THREE.Scene): void {
        const count = this.config.furniture.phoneBoxCount;
        let placed = 0;

        // Distribute phone boxes along different roads
        for (let i = 0; i < this.config.roads.length && placed < count; i++) {
            const road = this.config.roads[i];
            if (road.type === 'lane') continue; // Too narrow

            const totalLen = polylineLength(road.path);
            const d = totalLen * 0.4 + this.random.next() * totalLen * 0.2;
            const sample = samplePolyline(road.path, d);
            if (!sample) continue;

            const perp = perpCW(sample.direction);
            const kerbside = getKerbsideConfig(road, 'right');
            if (kerbside.use !== 'loading' && kerbside.use !== 'transit_stop') continue;
            const offset = getCarriagewayWidth(road) / 2 + road.curbWidth + kerbside.width / 2;
            const pos = add(sample.point, scale(perp, offset));

            if (this.zoneMap.isNearIntersection(pos.x, pos.z, 15)) continue;

            const box = this.createPhoneBox();
            box.position.set(pos.x, 0, pos.z);
            box.rotation.y = Math.atan2(sample.direction.z, sample.direction.x);
            scene.add(box);
            placed++;
        }
    }

    private buildPillarBoxes(scene: THREE.Scene): void {
        const count = this.config.furniture.pillarBoxCount;
        let placed = 0;

        for (let i = 0; i < this.config.roads.length && placed < count; i++) {
            const road = this.config.roads[i];
            const totalLen = polylineLength(road.path);
            const d = totalLen * 0.6 + this.random.next() * totalLen * 0.3;
            const sample = samplePolyline(road.path, d);
            if (!sample) continue;

            const perp = perpCW(sample.direction);
            const kerbside = getKerbsideConfig(road, 'left');
            if (kerbside.use !== 'parking' && kerbside.use !== 'loading') continue;
            const offset = getCarriagewayWidth(road) / 2 + road.curbWidth + kerbside.width * 0.8;
            const pos = add(sample.point, scale(perp, -offset)); // opposite side from phone boxes

            if (this.zoneMap.isNearIntersection(pos.x, pos.z, 15)) continue;

            const pillar = this.createPillarBox();
            pillar.position.set(pos.x, 0, pos.z);
            scene.add(pillar);
            placed++;
        }
    }

    // ===== FACTORY METHODS =====

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

        body.userData.hoverLabel = 'Bin';
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

    private createBollard(): THREE.Group {
        const group = new THREE.Group();

        // Classic London cast-iron bollard
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

        // Base
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.4, 8), bodyMat);
        base.position.y = 0.2;
        group.add(base);

        // Shaft
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.2, 8), bodyMat);
        shaft.position.y = 1;
        shaft.castShadow = true;
        group.add(shaft);

        // Domed top
        const top = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat);
        top.position.y = 1.6;
        group.add(top);

        shaft.userData.hoverLabel = 'Bollard';
        shaft.userData.hoverType = 'Furniture';
        return group;
    }

    private createPhoneBox(): THREE.Group {
        const group = new THREE.Group();

        // Classic red telephone box
        const redMat = new THREE.MeshLambertMaterial({ color: 0xCC0000 });
        const glassMat = new THREE.MeshLambertMaterial({ color: 0xAADDFF, transparent: true, opacity: 0.4 });

        // Main body
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.8, 1.2), redMat);
        body.position.y = 1.4;
        body.castShadow = true;
        group.add(body);

        // Crown/dome top
        const crown = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 1.3), redMat);
        crown.position.y = 2.95;
        group.add(crown);

        // Glass panels (4 sides, slightly inset)
        for (let face = 0; face < 4; face++) {
            const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.8), glassMat);
            glass.position.y = 1.6;
            const angle = (face / 4) * Math.PI * 2;
            glass.position.x = Math.sin(angle) * 0.61;
            glass.position.z = Math.cos(angle) * 0.61;
            glass.rotation.y = angle;
            group.add(glass);
        }

        body.userData.hoverLabel = 'Phone Box';
        body.userData.hoverType = 'Landmark';
        return group;
    }

    private createPillarBox(): THREE.Group {
        const group = new THREE.Group();

        // Royal Mail pillar box
        const redMat = new THREE.MeshLambertMaterial({ color: 0xCC0000 });

        // Cylindrical body
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 12), redMat);
        body.position.y = 0.75;
        body.castShadow = true;
        group.add(body);

        // Domed top
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), redMat);
        dome.position.y = 1.5;
        group.add(dome);

        // Letter slot (dark rectangle)
        const slot = new THREE.Mesh(
            new THREE.PlaneGeometry(0.4, 0.08),
            new THREE.MeshLambertMaterial({ color: 0x111111 })
        );
        slot.position.set(0, 1.1, 0.51);
        group.add(slot);

        // Collection times plate (white rectangle)
        const plate = new THREE.Mesh(
            new THREE.PlaneGeometry(0.3, 0.2),
            new THREE.MeshLambertMaterial({ color: 0xFFFFFF })
        );
        plate.position.set(0, 0.6, 0.51);
        group.add(plate);

        body.userData.hoverLabel = 'Pillar Box';
        body.userData.hoverType = 'Landmark';
        return group;
    }
}
