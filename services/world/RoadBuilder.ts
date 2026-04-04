import * as THREE from 'three';
import { WorldConfig, RoadConfig } from './WorldConfig';
import { TextureFactory } from './TextureFactory';

export class RoadBuilder {
    private config: WorldConfig;
    private textures: TextureFactory;

    constructor(config: WorldConfig, textures: TextureFactory) {
        this.config = config;
        this.textures = textures;
    }

    build(scene: THREE.Scene): void {
        // Ground plane
        this.buildGround(scene);

        // Each road
        for (const road of this.config.roads) {
            this.buildRoadCrossSection(scene, road);
        }
    }

    private buildGround(scene: THREE.Scene) {
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

    private buildRoadCrossSection(scene: THREE.Scene, road: RoadConfig) {
        const ws = this.config.worldScale;
        const center = road.centerline * ws;
        const halfC = road.carriagewayWidth / 2;
        const curbW = road.curbWidth;
        const furnW = road.furnishingStripWidth;
        const walkW = road.clearWalkWidth;

        const isH = road.direction === 'horizontal';
        const length = isH ? this.config.worldWidth : this.config.worldHeight;

        // --- Carriageway ---
        this.buildCarriageway(scene, road, center, halfC, length, isH);

        // --- Curbs (raised geometry) ---
        this.buildCurbs(scene, road, center, halfC, curbW, length, isH);

        // --- Furnishing strips ---
        this.buildFurnishingStrips(scene, road, center, halfC, curbW, furnW, length, isH);

        // --- Clear walks ---
        this.buildClearWalks(scene, road, center, halfC, curbW, furnW, walkW, length, isH);
    }

    private buildCarriageway(scene: THREE.Scene, road: RoadConfig, center: number, halfC: number, length: number, isH: boolean) {
        const tex = this.textures.createRoadTexture(road, length);
        let geo: THREE.PlaneGeometry;
        let mesh: THREE.Mesh;

        if (isH) {
            geo = new THREE.PlaneGeometry(length, road.carriagewayWidth);
            mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(this.config.worldWidth / 2, 0.01, center);
        } else {
            geo = new THREE.PlaneGeometry(road.carriagewayWidth, length);
            const vTex = this.textures.createRoadTexture(road, length);
            vTex.rotation = Math.PI / 2;
            mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: vTex }));
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(center, 0.01, this.config.worldHeight / 2);
        }
        mesh.receiveShadow = true;
        mesh.userData.hoverLabel = 'Road';
        mesh.userData.hoverType = 'Terrain';
        scene.add(mesh);
    }

    private buildCurbs(scene: THREE.Scene, road: RoadConfig, center: number, halfC: number, curbW: number, length: number, isH: boolean) {
        const curbMat = this.textures.createCurbTexture();
        const curbH = road.curbHeight;

        for (const side of [-1, 1]) {
            let geo: THREE.BoxGeometry;
            let mesh: THREE.Mesh;

            if (isH) {
                geo = new THREE.BoxGeometry(length, curbH, curbW);
                mesh = new THREE.Mesh(geo, curbMat);
                mesh.position.set(
                    this.config.worldWidth / 2,
                    curbH / 2,
                    center + side * (halfC + curbW / 2)
                );
            } else {
                geo = new THREE.BoxGeometry(curbW, curbH, length);
                mesh = new THREE.Mesh(geo, curbMat);
                mesh.position.set(
                    center + side * (halfC + curbW / 2),
                    curbH / 2,
                    this.config.worldHeight / 2
                );
            }
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            mesh.userData.hoverLabel = 'Curb';
            mesh.userData.hoverType = 'Terrain';
            scene.add(mesh);
        }
    }

    private buildFurnishingStrips(scene: THREE.Scene, road: RoadConfig, center: number, halfC: number, curbW: number, furnW: number, length: number, isH: boolean) {
        const tex = this.textures.createFurnishingStripTexture(length);

        for (const side of [-1, 1]) {
            let geo: THREE.PlaneGeometry;
            let mesh: THREE.Mesh;
            const offset = halfC + curbW + furnW / 2;

            if (isH) {
                geo = new THREE.PlaneGeometry(length, furnW);
                mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
                mesh.rotation.x = -Math.PI / 2;
                mesh.position.set(this.config.worldWidth / 2, 0.02, center + side * offset);
            } else {
                geo = new THREE.PlaneGeometry(furnW, length);
                mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex.clone() }));
                mesh.rotation.x = -Math.PI / 2;
                mesh.position.set(center + side * offset, 0.02, this.config.worldHeight / 2);
            }
            mesh.receiveShadow = true;
            mesh.userData.hoverLabel = 'Planting Strip';
            mesh.userData.hoverType = 'Terrain';
            scene.add(mesh);
        }
    }

    private buildClearWalks(scene: THREE.Scene, road: RoadConfig, center: number, halfC: number, curbW: number, furnW: number, walkW: number, length: number, isH: boolean) {
        const tex = this.textures.createSidewalkTexture(length);

        for (const side of [-1, 1]) {
            let geo: THREE.PlaneGeometry;
            let mesh: THREE.Mesh;
            const offset = halfC + curbW + furnW + walkW / 2;

            if (isH) {
                geo = new THREE.PlaneGeometry(length, walkW);
                mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
                mesh.rotation.x = -Math.PI / 2;
                mesh.position.set(this.config.worldWidth / 2, road.curbHeight + 0.01, center + side * offset);
            } else {
                geo = new THREE.PlaneGeometry(walkW, length);
                mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex.clone() }));
                mesh.rotation.x = -Math.PI / 2;
                mesh.position.set(center + side * offset, road.curbHeight + 0.01, this.config.worldHeight / 2);
            }
            mesh.receiveShadow = true;
            mesh.userData.hoverLabel = 'Sidewalk';
            mesh.userData.hoverType = 'Terrain';
            scene.add(mesh);
        }
    }
}
