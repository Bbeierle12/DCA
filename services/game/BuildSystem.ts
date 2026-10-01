import * as THREE from 'three';
import { BUILD_TILE, COLORS, STOREY_HEIGHT, WORLD_SIZE } from '../../constants';
import { HouseBlock } from '../../types';
import { ZoneType } from '../world/WorldConfigV2';
import { tagMesh } from './CharacterFactory';

export const BUILD_COST = 10;
const SOLID_TYPES = new Set(['wood', 'stone', 'table']);

export interface ZoneSource {
    getZone(x: number, z: number): ZoneType;
}

export type BuildOutcome =
    | { kind: 'place'; block: Omit<HouseBlock, 'id'>; cost: number }
    | { kind: 'remove'; id: string }
    | { kind: 'error'; message: string };

const LABELS: Record<string, { label: string; type: string; color: number }> = {
    wood: { label: 'Wood Wall', type: 'Structure', color: COLORS.WOOD },
    stone: { label: 'Stone Wall', type: 'Structure', color: COLORS.STONE },
    floor: { label: 'Wood Floor', type: 'Floor', color: COLORS.FLOOR },
    flower: { label: 'Red Flower', type: 'Decor', color: 0xff0000 },
    table: { label: 'Wooden Table', type: 'Furniture', color: COLORS.TABLE },
    bed: { label: 'Cozy Bed', type: 'Furniture', color: COLORS.BED },
    stairs: { label: 'Stairs', type: 'Structure', color: COLORS.STAIRS },
};

/** Grid building: placed blocks, their meshes, collision and placement rules. */
export class BuildSystem {
    blocks: HouseBlock[] = [];
    private meshes = new Map<string, THREE.Mesh>();
    readonly highlight: THREE.Mesh;
    readonly cursor = { x: 0, y: 0 };
    private floorTexture: THREE.Texture | null = null;

    constructor(
        private scene: THREE.Scene,
        private zones: ZoneSource,
        /** Shared list the camera uses for occlusion; walls and floors are added to it. */
        private occluders: THREE.Object3D[],
    ) {
        this.highlight = new THREE.Mesh(
            new THREE.BoxGeometry(BUILD_TILE, STOREY_HEIGHT, BUILD_TILE),
            new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true }),
        );
        this.highlight.visible = false;
        scene.add(this.highlight);
    }

    /** Off the street network only: open land, never roads or pavements. */
    canBuildAt(x: number, y: number): boolean {
        const cx = x + BUILD_TILE / 2;
        const cz = y + BUILD_TILE / 2;
        if (cx < 0 || cz < 0 || cx > WORLD_SIZE || cz > WORLD_SIZE) return false;
        const zone = this.zones.getZone(cx, cz);
        return zone === ZoneType.OPEN_LANDSCAPE || zone === ZoneType.PERIMETER;
    }

    canBuildNear(x: number, y: number, reach = 6): boolean {
        for (let dx = -reach; dx <= reach; dx += BUILD_TILE) {
            for (let dy = -reach; dy <= reach; dy += BUILD_TILE) {
                if (this.canBuildAt(x + dx, y + dy)) return true;
            }
        }
        return false;
    }

    /** South-west corner of the grid cell under the cursor. */
    cursorCell(): { x: number; y: number } {
        return {
            x: Math.floor(this.cursor.x / BUILD_TILE) * BUILD_TILE,
            y: Math.floor(this.cursor.y / BUILD_TILE) * BUILD_TILE,
        };
    }

    /** Points the cursor where `ray` meets the given storey's floor plane. */
    aimCursor(ray: THREE.Ray, level: number) {
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -level * STOREY_HEIGHT);
        const point = new THREE.Vector3();
        if (ray.intersectPlane(plane, point)) {
            this.cursor.x = point.x;
            this.cursor.y = point.z;
        }
    }

    updateHighlight(active: boolean, level: number) {
        this.highlight.visible = active;
        if (!active) return;
        const cell = this.cursorCell();
        (this.highlight.material as THREE.MeshBasicMaterial).color.set(this.canBuildAt(cell.x, cell.y) ? 0xffff00 : 0xff3333);
        this.highlight.position.set(cell.x + BUILD_TILE / 2, level * STOREY_HEIGHT + STOREY_HEIGHT / 2, cell.y + BUILD_TILE / 2);
    }

    /** Decides what a build action at a cell means. Pure apart from reading current blocks. */
    plan(x: number, y: number, item: string, level: number, money: number, builder: string): BuildOutcome {
        if (!this.canBuildAt(x, y)) return { kind: 'error', message: "Can't build on roads or pavements!" };
        const here = this.blocks.filter(b => b.x === x && b.y === y && b.z === level);
        const floor = here.find(b => b.type === 'floor');
        const object = here.find(b => b.type !== 'floor');
        if (item === 'delete') {
            const target = object ?? floor;
            return target ? { kind: 'remove', id: target.id! } : { kind: 'error', message: 'Nothing here!' };
        }
        const free = item === 'floor' ? !floor : !object;
        if (!free) return { kind: 'error', message: 'Space Occupied!' };
        if (money < BUILD_COST) return { kind: 'error', message: `Need ${BUILD_COST}💰!` };
        return { kind: 'place', block: { x, y, z: level, type: item, builder }, cost: BUILD_COST };
    }

    /** Does a w x h footprint centred on (x, y) hit a solid block on this storey? */
    collides(x: number, y: number, w: number, h: number, level: number): boolean {
        const minX = x - w / 2, maxX = x + w / 2, minY = y - h / 2, maxY = y + h / 2;
        return this.blocks.some(b =>
            b.z === level && SOLID_TYPES.has(b.type) &&
            minX < b.x + BUILD_TILE && maxX > b.x && minY < b.y + BUILD_TILE && maxY > b.y,
        );
    }

    /** Is a footprint centred on (x, y) supported by a floor tile or stairs on this storey? */
    supported(x: number, y: number, hw: number, hh: number, level: number): boolean {
        const points = [[x, y], [x - hw, y - hh], [x + hw, y - hh], [x - hw, y + hh], [x + hw, y + hh]];
        for (const [px, py] of points) {
            const tx = Math.floor(px / BUILD_TILE) * BUILD_TILE;
            const ty = Math.floor(py / BUILD_TILE) * BUILD_TILE;
            if (this.blocks.some(b => b.type === 'floor' && b.z === level && b.x === tx && b.y === ty)) return true;
        }
        return this.blocks.some(b =>
            b.type === 'stairs' && b.z === level &&
            x - hw < b.x + BUILD_TILE && x + hw > b.x && y - hh < b.y + BUILD_TILE && y + hh > b.y,
        );
    }

    stairsAt(x: number, y: number, level: number): HouseBlock | undefined {
        const tx = Math.floor(x / BUILD_TILE) * BUILD_TILE;
        const ty = Math.floor(y / BUILD_TILE) * BUILD_TILE;
        return this.blocks.find(b => b.type === 'stairs' && b.x === tx && b.y === ty && b.z === level);
    }

    addBlock(data: HouseBlock) {
        if (!data.id || this.meshes.has(data.id)) return;
        this.blocks.push(data);
        const meta = LABELS[data.type] ?? { label: 'Structure', type: 'Structure', color: COLORS.WOOD };
        const baseY = data.z * STOREY_HEIGHT;
        const cx = data.x + BUILD_TILE / 2;
        const cz = data.y + BUILD_TILE / 2;
        let mesh: THREE.Mesh;
        if (data.type === 'floor') {
            mesh = new THREE.Mesh(new THREE.PlaneGeometry(BUILD_TILE, BUILD_TILE), new THREE.MeshLambertMaterial({ map: this.getFloorTexture() }));
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(cx, baseY + 0.05, cz);
            this.occluders.push(mesh);
        } else if (data.type === 'flower') {
            mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshLambertMaterial({ color: meta.color }));
            mesh.position.set(cx, baseY + 0.3, cz);
        } else {
            const isWall = data.type === 'wood' || data.type === 'stone';
            const h = isWall || data.type === 'stairs' ? STOREY_HEIGHT : (data.type === 'bed' ? 0.6 : 0.8);
            mesh = new THREE.Mesh(new THREE.BoxGeometry(BUILD_TILE, h, BUILD_TILE), new THREE.MeshLambertMaterial({ color: meta.color }));
            mesh.position.set(cx, baseY + h / 2, cz);
            if (isWall) this.occluders.push(mesh);
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        tagMesh(mesh, meta.label, meta.type);
        this.scene.add(mesh);
        this.meshes.set(data.id, mesh);
    }

    removeBlock(id: string) {
        const mesh = this.meshes.get(id);
        if (!mesh) return;
        const idx = this.occluders.indexOf(mesh);
        if (idx > -1) this.occluders.splice(idx, 1);
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.meshes.delete(id);
        this.blocks = this.blocks.filter(b => b.id !== id);
    }

    private getFloorTexture(): THREE.Texture {
        if (this.floorTexture) return this.floorTexture;
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#D2B48C';
            ctx.fillRect(0, 0, 64, 64);
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fillRect(0, 0, 64, 1);
            ctx.fillRect(0, 32, 64, 1);
            ctx.fillRect(0, 0, 1, 32);
            ctx.fillRect(32, 32, 1, 32);
        }
        this.floorTexture = new THREE.CanvasTexture(canvas);
        this.floorTexture.magFilter = THREE.NearestFilter;
        this.floorTexture.minFilter = THREE.NearestFilter;
        return this.floorTexture;
    }

    dispose() {
        for (const id of [...this.meshes.keys()]) this.removeBlock(id);
        this.scene.remove(this.highlight);
        this.highlight.geometry.dispose();
        (this.highlight.material as THREE.Material).dispose();
        this.floorTexture?.dispose();
    }
}
