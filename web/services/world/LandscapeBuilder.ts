import * as THREE from 'three';
import { WorldConfig, ZoneType, getCarriagewayWidth, getKerbsideConfig } from './WorldConfigV2';
import { ZoneMapV2 } from './ZoneMapV2';
import {
    polylineLength, samplePolyline, perpCW, add, scale,
} from './RoadGeometry';
import { SeededRandom } from './SeededRandom';

export class LandscapeBuilder {
    private config: WorldConfig;
    private zoneMap: ZoneMapV2;
    private random: SeededRandom;

    constructor(config: WorldConfig, zoneMap: ZoneMapV2) {
        this.config = config;
        this.zoneMap = zoneMap;
        this.random = new SeededRandom(config.randomSeed ^ 0x41C64E6D);
    }

    /**
     * Formal street-edge landscape -- trees in furnishing strips along road paths.
     */
    buildEdges(scene: THREE.Scene): void {
        for (let i = 0; i < this.config.roads.length; i++) {
            this.buildFormalTreeRow(scene, i);
        }
    }

    /**
     * Background landscape fill -- clusters in open areas, perimeter bands.
     */
    buildBackground(scene: THREE.Scene): void {
        this.buildOpenLandscapeClusters(scene);
        this.buildPerimeterBand(scene);
        this.buildFlowerBeds(scene);
    }

    private buildFormalTreeRow(scene: THREE.Scene, roadIndex: number): void {
        const road = this.config.roads[roadIndex];
        const halfC = getCarriagewayWidth(road) / 2;
        const curbW = road.curbWidth;
        const spacing = this.config.landscape.formalTreeSpacing;
        const species = (road.type === 'main' || road.type === 'boulevard')
            ? this.config.landscape.mainStreetSpecies
            : this.config.landscape.secondaryStreetSpecies;

        const totalLen = polylineLength(road.path);

        for (const side of [-1, 1] as const) {
            const sideName = side === -1 ? 'left' : 'right';
            const kerbside = getKerbsideConfig(road, sideName);
            if (kerbside.use !== 'planting') continue;
            const offset = halfC + curbW + kerbside.width / 2;
            for (let d = spacing / 2; d < totalLen; d += spacing) {
                const sample = samplePolyline(road.path, d);
                if (!sample) continue;

                const perp = perpCW(sample.direction);
                const pos = add(sample.point, scale(perp, side * offset));

                // Skip if in sight triangle or near intersection
                if (this.zoneMap.isInZone(pos.x, pos.z, ZoneType.SIGHT_TRIANGLE)) continue;
                if (this.zoneMap.isNearIntersection(pos.x, pos.z, this.config.landscape.sightTriangleClearance)) continue;

                const tree = this.createTree(species);
                tree.position.set(pos.x, 0, pos.z);
                scene.add(tree);
            }
        }
    }

    private buildOpenLandscapeClusters(scene: THREE.Scene): void {
        const { worldWidth, worldHeight } = this.config;
        const density = this.config.landscape.clusterDensity;
        const areaUnits = (worldWidth * worldHeight) / (100 * 100);
        const clusterCount = Math.floor(areaUnits * density);

        for (let i = 0; i < clusterCount; i++) {
            const cx = 20 + this.random.next() * (worldWidth - 40);
            const cz = 20 + this.random.next() * (worldHeight - 40);

            const zone = this.zoneMap.getZone(cx, cz);
            if (zone !== ZoneType.OPEN_LANDSCAPE) continue;

            // Place a cluster of 2-5 trees
            const count = 2 + Math.floor(this.random.next() * 4);
            for (let j = 0; j < count; j++) {
                const ox = cx + (this.random.next() - 0.5) * 12;
                const oz = cz + (this.random.next() - 0.5) * 12;

                if (this.zoneMap.getZone(ox, oz) !== ZoneType.OPEN_LANDSCAPE) continue;

                const rand = this.random.next();
                const type = rand < 0.5 ? 'oak' : rand < 0.8 ? 'pine' : 'bush';
                const tree = this.createTree(type as 'oak' | 'pine' | 'bush');
                tree.position.set(ox, 0, oz);
                scene.add(tree);
            }
        }
    }

    private buildPerimeterBand(scene: THREE.Scene): void {
        const bandW = this.config.landscape.perimeterTreeBandWidth;
        const { worldWidth, worldHeight } = this.config;
        const spacing = 8;

        for (let x = spacing / 2; x < worldWidth; x += spacing + this.random.next() * 4) {
            for (const z of [bandW * this.random.next(), worldHeight - bandW * this.random.next()]) {
                if (this.zoneMap.getZone(x, z) !== ZoneType.PERIMETER) continue;
                const type = this.random.next() < 0.6 ? 'pine' : 'oak';
                const tree = this.createTree(type as 'oak' | 'pine');
                tree.position.set(x, 0, z);
                scene.add(tree);
            }
        }
        for (let z = spacing / 2 + bandW; z < worldHeight - bandW; z += spacing + this.random.next() * 4) {
            for (const x of [bandW * this.random.next(), worldWidth - bandW * this.random.next()]) {
                if (this.zoneMap.getZone(x, z) !== ZoneType.PERIMETER) continue;
                const type = this.random.next() < 0.6 ? 'pine' : 'oak';
                const tree = this.createTree(type as 'oak' | 'pine');
                tree.position.set(x, 0, z);
                scene.add(tree);
            }
        }
    }

    private buildFlowerBeds(scene: THREE.Scene): void {
        const { worldWidth, worldHeight } = this.config;
        const colors = [0xFF6B6B, 0xFFD93D, 0xFFFFFF, 0xFF69B4, 0xE8A0BF];

        for (let i = 0; i < 20; i++) {
            const fx = this.random.next() * worldWidth;
            const fz = this.random.next() * worldHeight;

            const zone = this.zoneMap.getZone(fx, fz);
            if (zone !== ZoneType.OPEN_LANDSCAPE && zone !== ZoneType.FURNISHING_STRIP) continue;

            const cluster = new THREE.Group();
            for (let j = 0; j < 3 + Math.floor(this.random.next() * 3); j++) {
                const flower = new THREE.Mesh(
                    new THREE.SphereGeometry(0.3, 4, 4),
                    new THREE.MeshLambertMaterial({ color: colors[Math.floor(this.random.next() * colors.length)] })
                );
                flower.position.set((this.random.next() - 0.5) * 2, 0.3, (this.random.next() - 0.5) * 2);
                cluster.add(flower);
            }
            cluster.position.set(fx, 0, fz);
            scene.add(cluster);
        }
    }

    // ===== TREE FACTORY =====

    createTree(type: 'oak' | 'pine' | 'bush'): THREE.Group {
        const group = new THREE.Group();
        const variation = 0.85 + this.random.next() * 0.3;
        const colors = this.config.colors;

        if (type === 'oak') {
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(1.2, 1.8, 10 * variation, 6),
                new THREE.MeshLambertMaterial({ color: colors.WOOD })
            );
            trunk.position.y = 5 * variation;
            trunk.castShadow = true;
            group.add(trunk);
            trunk.userData.hoverLabel = 'Tree';
            trunk.userData.hoverType = 'Nature';

            const greenVar = new THREE.Color(colors.OAK_GREEN);
            greenVar.offsetHSL(0, 0, (this.random.next() - 0.5) * 0.08);
            const leafMat = new THREE.MeshLambertMaterial({ color: greenVar });

            const leaves1 = new THREE.Mesh(new THREE.SphereGeometry(6 * variation, 8, 6), leafMat);
            leaves1.position.y = 14 * variation;
            leaves1.castShadow = true;
            group.add(leaves1);

            const leaves2 = new THREE.Mesh(new THREE.SphereGeometry(5 * variation, 8, 6), leafMat);
            leaves2.position.set(3 * variation, 12 * variation, (this.random.next() - 0.5) * 2);
            group.add(leaves2);

            const leaves3 = new THREE.Mesh(new THREE.SphereGeometry(4.5 * variation, 8, 6), leafMat);
            leaves3.position.set(-2 * variation, 13 * variation, 2 * (this.random.next() - 0.5));
            group.add(leaves3);

        } else if (type === 'pine') {
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.8, 1.2, 12 * variation, 6),
                new THREE.MeshLambertMaterial({ color: colors.WOOD })
            );
            trunk.position.y = 6 * variation;
            trunk.castShadow = true;
            group.add(trunk);
            trunk.userData.hoverLabel = 'Pine';
            trunk.userData.hoverType = 'Nature';

            const pineGreen = new THREE.Color(colors.PINE_GREEN);
            pineGreen.offsetHSL(0, 0, (this.random.next() - 0.5) * 0.06);
            const pineMat = new THREE.MeshLambertMaterial({ color: pineGreen });

            const cone1 = new THREE.Mesh(new THREE.ConeGeometry(5 * variation, 8 * variation, 6), pineMat);
            cone1.position.y = 12 * variation;
            cone1.castShadow = true;
            group.add(cone1);

            const cone2 = new THREE.Mesh(new THREE.ConeGeometry(4 * variation, 6 * variation, 6), pineMat);
            cone2.position.y = 17 * variation;
            group.add(cone2);

            const cone3 = new THREE.Mesh(new THREE.ConeGeometry(3 * variation, 5 * variation, 6), pineMat);
            cone3.position.y = 21 * variation;
            group.add(cone3);

        } else { // bush
            const bushGreen = new THREE.Color(colors.BUSH_GREEN);
            bushGreen.offsetHSL(0, 0, (this.random.next() - 0.5) * 0.1);
            const bushMat = new THREE.MeshLambertMaterial({ color: bushGreen });

            for (let i = 0; i < 3; i++) {
                const s = (2.5 + this.random.next() * 1.5) * variation;
                const bush = new THREE.Mesh(new THREE.SphereGeometry(s, 6, 5), bushMat);
                bush.position.set((this.random.next() - 0.5) * 3, s * 0.7, (this.random.next() - 0.5) * 3);
                group.add(bush);
                if (i === 0) {
                    bush.userData.hoverLabel = 'Bush';
                    bush.userData.hoverType = 'Nature';
                }
            }
        }
        return group;
    }
}
