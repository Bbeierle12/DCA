import * as THREE from 'three';
import { WorldConfig, createLondonWorldConfig } from './WorldConfigV2';
import { ZoneMapV2 } from './ZoneMapV2';
import { TextureFactory } from './TextureFactory';
import { PathRoadBuilder } from './PathRoadBuilder';
import { RoundaboutBuilder } from './RoundaboutBuilder';
import { IntersectionBuilderV2 } from './IntersectionBuilderV2';
import { LandscapeBuilder } from './LandscapeBuilder';
import { FurnitureBuilder } from './FurnitureBuilder';

export interface WorldBuildResult {
    zoneMap: ZoneMapV2;
    collidableMeshes: THREE.Object3D[];
}

export class WorldBuilder {
    private config: WorldConfig;

    constructor(config?: WorldConfig) {
        this.config = config || createLondonWorldConfig();
    }

    build(scene: THREE.Scene): WorldBuildResult {
        const zoneMap = new ZoneMapV2(this.config);
        const textures = new TextureFactory(this.config);
        const roads = new PathRoadBuilder(this.config, textures);
        const intersections = new IntersectionBuilderV2(this.config, textures);
        const roundabouts = new RoundaboutBuilder(this.config, textures);
        const landscape = new LandscapeBuilder(this.config, zoneMap);
        const furniture = new FurnitureBuilder(this.config, zoneMap);

        // Phases execute in strict order
        roads.build(scene);              // Ground + road cross-sections
        intersections.build(scene);      // Crosswalks, stop bars, traffic lights
        roundabouts.build(scene);        // Roundabout geometry + yield signs
        landscape.buildEdges(scene);     // Formal street trees
        furniture.build(scene);          // Lights, benches, hydrants, London props
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
