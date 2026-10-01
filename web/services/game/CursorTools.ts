import * as THREE from 'three';
import { BuildSystem } from './BuildSystem';
import { GameOptions } from './GameTypes';

/** Mouse/touch aiming in build mode: hover tooltips, the build cursor and placing blocks. */
export class CursorTools {
    private raycaster = new THREE.Raycaster();
    private ndc = new THREE.Vector2();
    private client = { x: 0, y: 0 };

    constructor(
        private scene: THREE.Scene,
        private camera: THREE.Camera,
        private build: BuildSystem,
        private opts: GameOptions,
    ) {}

    aim(ndcX: number, ndcY: number, clientX: number, clientY: number) {
        this.ndc.set(ndcX, ndcY);
        this.client = { x: clientX, y: clientY };
        const ui = this.opts.getUi();
        if (!ui.isBuilding) return;
        this.raycaster.setFromCamera(this.ndc, this.camera);
        this.build.aimCursor(this.raycaster.ray, ui.buildLevel);
    }

    /** Publishes what the pointer is over (build mode only) for the tooltip. */
    updateHover(isBuilding: boolean) {
        if (!isBuilding) {
            this.opts.store.set({ hover: null });
            return;
        }
        this.raycaster.setFromCamera(this.ndc, this.camera);
        const hit = this.raycaster.intersectObjects(this.scene.children, true).find(h => h.object.userData?.hoverLabel);
        const data = hit?.object.userData;
        this.opts.store.set({
            hover: data ? { label: data.hoverLabel, type: data.hoverType, x: this.client.x, y: this.client.y } : null,
        });
    }

    buildAtCursor() {
        const ui = this.opts.getUi();
        const cell = this.build.cursorCell();
        const outcome = this.build.plan(cell.x, cell.y, ui.buildItem, ui.buildLevel, ui.money, this.opts.net.localId);
        if (outcome.kind === 'error') {
            this.opts.events.onInteract('error', 0, outcome.message);
        } else if (outcome.kind === 'remove') {
            this.opts.net.sendBlockRemove(outcome.id);
        } else {
            this.opts.events.onInteract('build', outcome.cost, `-${outcome.cost}💰`);
            this.opts.net.sendBlockAdd(outcome.block);
        }
    }
}
