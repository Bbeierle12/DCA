import * as THREE from 'three';
import { WorldConfig, createDefaultWorldConfig } from './WorldConfig';
import { ZoneMap } from './ZoneMap';
import { TextureFactory } from './TextureFactory';
import { RoadBuilder } from './RoadBuilder';
import { IntersectionBuilder } from './IntersectionBuilder';
import { LandscapeBuilder } from './LandscapeBuilder';
import { FurnitureBuilder } from './FurnitureBuilder';

export interface WorldBuildResult {
    zoneMap: ZoneMap;
    collidableMeshes: THREE.Object3D[];
}

export class WorldBuilder {
    private config: WorldConfig;

    constructor(config?: WorldConfig) {
        this.config = config || createDefaultWorldConfig();
    }

    build(scene: THREE.Scene): WorldBuildResult {
        const zoneMap = new ZoneMap(this.config);
        const textures = new TextureFactory(this.config);
        const roads = new RoadBuilder(this.config, textures);
        const intersection = new IntersectionBuilder(this.config, textures);
        const landscape = new LandscapeBuilder(this.config, zoneMap);
        const furniture = new FurnitureBuilder(this.config, zoneMap);

        // Phases execute in strict order
        roads.build(scene);           // Ground + road cross-sections
        intersection.build(scene);    // Crosswalks, stop bars, signs, ramps
        landscape.buildEdges(scene);  // Formal street trees
        furniture.build(scene);       // Lights, benches, hydrants, trash, fences
        landscape.buildBackground(scene); // Open area clusters, perimeter, flowers

        // Collect collidable meshes (ground for raycasting)
        const collidableMeshes: THREE.Object3D[] = [];
        scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh && obj.userData.hoverLabel === 'Grass') {
                collidableMeshes.push(obj);
            }
        });

        return { zoneMap, collidableMeshes };
    }

    getConfig(): WorldConfig {
        return this.config;
    }
}
