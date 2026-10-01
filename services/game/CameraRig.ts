import * as THREE from 'three';
import { PLAYER_HEIGHT, WORLD_SIZE } from '../../constants';

export interface FreeFlyInput {
    /** Strafe (x) and forward/back (y, negative = forward) from the move axis. */
    x: number;
    y: number;
    /** +1 up, -1 down, 0 none. */
    vertical: number;
    boost: boolean;
}

/**
 * Third-person orbit camera that follows a target and pulls in when something blocks the
 * view, plus a free-fly debug camera (toggle with ` or F9).
 */
export class CameraRig {
    readonly camera: THREE.PerspectiveCamera;

    theta = 0;
    phi = Math.PI / 4;
    radius = 7;
    currentRadius = 7;
    readonly minRadius = 2.5;
    readonly maxRadius = 40;
    invertY = false;
    sensitivity = 1;

    freeEnabled = false;
    freeSpeed = 200;
    readonly freePos = new THREE.Vector3(WORLD_SIZE / 2, 300, WORLD_SIZE / 2);
    freeYaw = 0;
    freePitch = -Math.PI / 2 + 0.01;

    private readonly raycaster = new THREE.Raycaster();
    private savedFog: THREE.FogBase | null = null;
    private readonly focusHeight = PLAYER_HEIGHT * 0.85;

    constructor(aspect: number) {
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    }

    setAspect(aspect: number) {
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
    }

    setSensitivity(value: number) {
        this.sensitivity = Math.max(0.1, Math.min(2.0, value));
    }

    /** Orbit by a screen-space delta in pixels. */
    orbit(dx: number, dy: number, perPixel: number) {
        const s = perPixel * this.sensitivity;
        this.theta -= dx * s;
        const yMove = this.invertY ? -dy : dy;
        this.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, this.phi - yMove * s));
    }

    /** Look around in free-fly mode by a screen-space delta in pixels. */
    freeLook(dx: number, dy: number, perPixel: number) {
        const s = perPixel * this.sensitivity;
        this.freeYaw -= dx * s;
        const yMove = this.invertY ? -dy : dy;
        this.freePitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.freePitch + yMove * s));
    }

    zoom(delta: number) {
        this.radius = Math.max(this.minRadius, Math.min(this.maxRadius, this.radius + delta));
    }

    /** Mouse wheel: zooms the orbit camera, or changes fly speed in free mode. */
    wheel(deltaY: number) {
        if (this.freeEnabled) {
            this.freeSpeed = Math.max(20, Math.min(2000, this.freeSpeed * (1 - deltaY * 0.001)));
        } else {
            this.zoom(deltaY * 0.01);
        }
    }

    private offset(radius: number): THREE.Vector3 {
        return new THREE.Vector3(
            radius * Math.sin(this.phi) * Math.sin(this.theta),
            radius * Math.cos(this.phi),
            radius * Math.sin(this.phi) * Math.cos(this.theta),
        );
    }

    /** Jump straight to the resting position behind `target` (no smoothing). */
    snap(target: THREE.Vector3) {
        this.currentRadius = this.radius;
        const focus = target.clone().add(new THREE.Vector3(0, this.focusHeight, 0));
        this.camera.position.copy(focus).add(this.offset(this.radius));
        this.camera.lookAt(focus);
    }

    /** Follow `target`, pulling in when `occluders` block the view. */
    follow(target: THREE.Vector3, occluders: THREE.Object3D[]) {
        this.currentRadius += (this.radius - this.currentRadius) * 0.1;
        const focus = target.clone().add(new THREE.Vector3(0, this.focusHeight, 0));
        const offset = this.offset(this.currentRadius);
        const direction = offset.clone().normalize();
        this.raycaster.set(focus, direction);
        this.raycaster.far = offset.length();
        const hits = occluders.length ? this.raycaster.intersectObjects(occluders, false) : [];
        let finalOffset = offset;
        if (hits.length > 0 && hits[0].distance < offset.length()) {
            finalOffset = direction.multiplyScalar(Math.max(0.3, hits[0].distance - 0.3));
        }
        this.camera.position.lerp(focus.add(finalOffset), 0.1);
        this.camera.lookAt(target.clone().add(new THREE.Vector3(0, this.focusHeight, 0)));
    }

    fly(dt: number, input: FreeFlyInput) {
        const step = this.freeSpeed * dt * (input.boost ? 3 : 1);
        const forward = new THREE.Vector3(-Math.sin(this.freeYaw), 0, -Math.cos(this.freeYaw));
        const right = new THREE.Vector3(-Math.cos(this.freeYaw), 0, Math.sin(this.freeYaw));
        this.freePos.addScaledVector(forward, -input.y * step);
        this.freePos.addScaledVector(right, input.x * step);
        this.freePos.y = Math.max(1, Math.min(1500, this.freePos.y + input.vertical * step));
        this.camera.position.copy(this.freePos);
        this.camera.lookAt(this.freePos.clone().add(new THREE.Vector3(
            -Math.sin(this.freeYaw) * Math.cos(this.freePitch),
            Math.sin(this.freePitch),
            -Math.cos(this.freeYaw) * Math.cos(this.freePitch),
        )));
    }

    /** Toggle free-fly. Removes fog and extends the far plane while flying. */
    toggleFree(scene: THREE.Scene): boolean {
        this.freeEnabled = !this.freeEnabled;
        if (this.freeEnabled) {
            this.freePos.set(WORLD_SIZE / 2, 300, WORLD_SIZE / 2);
            this.freeYaw = 0;
            this.freePitch = -Math.PI / 2 + 0.01;
            this.savedFog = scene.fog;
            scene.fog = null;
            this.camera.far = 3000;
        } else {
            if (this.savedFog) scene.fog = this.savedFog;
            this.savedFog = null;
            this.camera.far = 1000;
        }
        this.camera.updateProjectionMatrix();
        return this.freeEnabled;
    }

    /** Projects a world point to CSS pixel coordinates in the given viewport. */
    toScreen(point: THREE.Vector3, width: number, height: number): { x: number; y: number } {
        const v = point.clone().project(this.camera);
        return { x: (v.x * 0.5 + 0.5) * width, y: (v.y * -0.5 + 0.5) * height };
    }
}
