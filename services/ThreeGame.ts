import * as THREE from 'three';
import { PLAYER_PHYSICS, SPAWN_TARGET, STOREY_HEIGHT } from '../constants';
import { GameConfig } from '../types';
import { attachWeapon, StickFigureGroup } from './StickFigure';
import { AnimatorState, createAnimatorState, updateAnimation } from './StickFigureAnimator';
import { WorldBuilder } from './world/WorldBuilder';
import { ZoneMapV2 } from './world/ZoneMapV2';
import { ZoneType } from './world/WorldConfigV2';
import { findNearestZonePoint } from './world/Spawn';
import { PlaceNamer } from './world/Places';
import { FEATURES } from './features';
import { Input } from './game/Input';
import { createPlayerState, facingToYaw, PlayerState, stepPlayer } from './game/PlayerController';
import { CameraRig } from './game/CameraRig';
import { BuildSystem } from './game/BuildSystem';
import { RemotePlayers } from './game/RemotePlayers';
import { Pickups } from './game/Pickups';
import { CombatController, AttackType } from './game/CombatController';
import { createScene, setRenderDistance, setShadowQuality, ShadowQuality } from './game/SceneSetup';
import { PointerControls } from './game/PointerControls';
import { createCharacter, disposeObject } from './game/CharacterFactory';
import { GameOptions, UiState, WorldSave } from './game/GameTypes';
import { CursorTools } from './game/CursorTools';
import { playerNetState } from './net/PlayerSync';

export type { GameOptions, UiState, GameEvents } from './game/GameTypes';

/** Orchestrates the game: owns the loop and wires the systems together. */
export class ThreeGame {
    readonly scene: THREE.Scene;
    readonly renderer: THREE.WebGLRenderer;
    readonly rig: CameraRig;
    readonly input = new Input();
    readonly player: PlayerState;
    readonly zoneMap: ZoneMapV2;
    readonly spawnPoint: { x: number; z: number };
    frameCount = 0;
    cameraRelativeMovement = true;

    private sun: THREE.DirectionalLight;
    private avatar: StickFigureGroup;
    private animator: AnimatorState = createAnimatorState();
    private occluders: THREE.Object3D[] = [];
    private build: BuildSystem;
    private remotes: RemotePlayers;
    private pickups: Pickups | null;
    private combat = new CombatController();
    private pointer: PointerControls;
    private cursor: CursorTools;
    private places: PlaceNamer;
    private lastNetSend = 0;
    private lastTime = 0;
    private rafId = 0;
    private unsubscribers: Array<() => void> = [];

    constructor(private opts: GameOptions) {
        ({ scene: this.scene, renderer: this.renderer, sun: this.sun } = createScene(opts.container));
        this.rig = new CameraRig(window.innerWidth / window.innerHeight);

        const builder = new WorldBuilder();
        const world = builder.build(this.scene);
        this.places = new PlaceNamer(builder.getConfig());
        this.occluders.push(...world.collidableMeshes);
        this.zoneMap = world.zoneMap;
        this.spawnPoint = findNearestZonePoint(this.zoneMap, SPAWN_TARGET.x, SPAWN_TARGET.z, ZoneType.CLEAR_WALK)
            ?? { x: SPAWN_TARGET.x, z: SPAWN_TARGET.z };
        this.player = createPlayerState(this.spawnPoint.x, this.spawnPoint.z);

        this.build = new BuildSystem(this.scene, this.zoneMap, this.occluders);
        this.remotes = new RemotePlayers(this.scene);
        this.pickups = FEATURES.combat ? new Pickups(this.scene) : null;
        if (opts.restore) {
            Object.assign(this.player, { x: opts.restore.player.x, y: opts.restore.player.z, level: opts.restore.player.level });
            if (opts.net.mode === 'solo') opts.restore.blocks.forEach(b => this.build.addBlock(b));
        }

        this.avatar = createCharacter(opts.config);
        this.avatar.position.set(this.player.x, this.player.level * STOREY_HEIGHT, this.player.y);
        this.scene.add(this.avatar);
        this.rig.snap(this.avatar.position);
        this.cursor = new CursorTools(this.scene, this.rig.camera, this.build, opts);

        this.input.onAction(this.onAction);
        this.input.attach(window);
        this.pointer = new PointerControls(this.renderer.domElement, {
            isFreeFly: () => this.rig.freeEnabled,
            orbit: (dx, dy, k) => this.rig.orbit(dx, dy, k),
            freeLook: (dx, dy, k) => this.rig.freeLook(dx, dy, k),
            wheel: dy => this.rig.wheel(dy),
            primaryClick: () => { if (this.opts.getUi().isBuilding) this.cursor.buildAtCursor(); },
            aim: (nx, ny, cx, cy) => this.cursor.aim(nx, ny, cx, cy),
        });
        window.addEventListener('resize', this.onResize);

        const { net } = opts;
        this.unsubscribers.push(
            net.onRemotePlayer((id, data) => this.remotes.apply(id, data)),
            net.onBlockAdded(block => this.build.addBlock(block)),
            net.onBlockRemoved(id => this.build.removeBlock(id)),
        );
    }

    start() {
        const loop = () => {
            const time = performance.now() / 1000;
            const dt = this.lastTime === 0 ? 1 / 60 : Math.min(time - this.lastTime, 0.1);
            this.lastTime = time;
            this.update(dt, time);
            this.rafId = requestAnimationFrame(loop);
        };
        this.rafId = requestAnimationFrame(loop);
    }

    update(dt: number, time: number) {
        const ui = this.opts.getUi();
        this.cursor.updateHover(ui.isBuilding);
        this.remotes.update(dt);

        if (this.rig.freeEnabled) {
            const axis = this.input.moveAxis();
            const vertical = (this.input.anyDown(['KeyE', 'Space']) ? 1 : 0) - (this.input.isDown('KeyQ') ? 1 : 0);
            this.rig.fly(dt, { x: axis.x, y: axis.y, vertical, boost: this.input.running });
        } else if (this.combat.state.isDead) {
            if (this.combat.update(dt, time)) this.respawn();
            this.rig.follow(this.avatar.position, this.occluders);
        } else {
            this.updatePlayer(dt, time, ui);
            this.rig.follow(this.avatar.position, this.occluders);
        }
        this.publish(time);
        this.build.updateHighlight(ui.isBuilding, ui.buildLevel);
        this.renderer.render(this.scene, this.rig.camera);
        this.frameCount++;
    }

    private updatePlayer(dt: number, time: number, ui: UiState) {
        const p = this.player;
        const running = ui.alwaysRun || this.input.running;
        const axis = this.input.moveAxis();
        const result = stepPlayer(p, {
            x: axis.x, y: axis.y, running,
            speedMultiplier: this.combat.state.isAttacking ? PLAYER_PHYSICS.ATTACK_SPEED_MULTIPLIER : 1,
            cameraTheta: this.cameraRelativeMovement ? this.rig.theta : undefined,
        }, dt, (x, y, w, h) => this.build.collides(x, y, w, h, p.level), this.combat.knockback(dt));
        if (result.blockedX) this.combat.stopKnockback('x');
        if (result.blockedY) this.combat.stopKnockback('y');
        if (p.level > 0 && !this.build.supported(p.x, p.y, PLAYER_PHYSICS.COLLISION_WIDTH / 2, PLAYER_PHYSICS.COLLISION_HEIGHT / 2, p.level)) {
            p.level = 0;
        }

        const target = new THREE.Vector3(p.x, p.level * STOREY_HEIGHT, p.y);
        this.avatar.position.lerp(target, 1 - Math.exp(-PLAYER_PHYSICS.RENDER_SMOOTHING * dt));
        if (result.moving && !this.animator.isAttacking) this.avatar.rotation.y = facingToYaw(p.facing);
        updateAnimation(this.avatar, this.animator, dt, result.moving, running);

        if (this.combat.update(dt, time)) this.respawn();
        for (const hit of this.combat.checkHits(time, this.avatar, this.remotes.meshes())) {
            const s = this.rig.toScreen(hit.target.position, window.innerWidth, window.innerHeight);
            this.opts.events.onDamageDealt?.(hit.damage, s.x, s.y);
        }
        const picked = this.pickups?.update(dt, time, p.x, p.y, !this.combat.state.weapon) ?? null;
        if (picked) {
            this.combat.equip(picked);
            attachWeapon(this.avatar, picked);
            this.opts.events.onInteract('pickup', 0, `Picked up ${picked}!`);
        }
        this.avatar.visible = this.combat.state.invincibleFrames > 0 ? Math.floor(time * 10) % 2 === 0 : true;
    }

    /** Sends our state to the network at 10 Hz and the HUD-facing snapshot to React. */
    private publish(time: number) {
        const p = this.player;
        const c = this.combat.state;
        if (time - this.lastNetSend >= 0.1) {
            this.lastNetSend = time;
            this.opts.net.sendPlayerState(playerNetState(p, c));
        }
        const wasDead = this.opts.store.get().isDead;
        this.opts.store.set({
            zone: this.places.at(p.x, p.y), level: p.level,
            health: c.health, maxHealth: c.maxHealth, weapon: c.weapon, isDead: c.isDead,
        });
        if (!wasDead && c.isDead) this.opts.events.onDeath?.();
    }

    private respawn() {
        this.resetToSpawn();
        this.opts.events.onRespawn?.();
    }

    /** Space/Enter or the Interact button. */
    handleInteraction() {
        const ui = this.opts.getUi();
        if (ui.isBuilding) return this.cursor.buildAtCursor();
        const p = this.player;
        // Shops return as real buildings in Phase 4 (P4.6); stairs are the only interaction for now.
        if (this.build.stairsAt(p.x, p.y, p.level)) p.level = p.level === 0 ? 1 : 0;
    }

    private onAction = (code: string, e: KeyboardEvent) => {
        if (code === 'Backquote' || code === 'F9') {
            e.preventDefault();
            this.toggleFreeCamera();
            return;
        }
        if (this.rig.freeEnabled || !FEATURES.combat) return;
        if (code === 'KeyJ' || code === 'KeyZ') this.handleAttack('punch');
        else if (code === 'KeyK' || code === 'KeyX') this.handleAttack('kick');
        else if (code === 'KeyL' || code === 'KeyC') this.handleAttack('weapon');
        else if (code === 'KeyQ') this.handleDropWeapon();
    };

    handleAttack(type: AttackType) {
        if (FEATURES.combat) this.combat.attack(type, this.animator, performance.now() / 1000);
    }

    handleDropWeapon() {
        const dropped = this.combat.drop();
        if (!dropped) return;
        attachWeapon(this.avatar, null);
        this.opts.events.onInteract('drop', 0, `Dropped ${dropped}!`);
    }

    updateConfig(config: GameConfig) {
        this.opts.config = config;
        const next = createCharacter(config);
        next.position.copy(this.avatar.position);
        next.rotation.copy(this.avatar.rotation);
        if (this.combat.state.weapon) attachWeapon(next, this.combat.state.weapon);
        this.scene.remove(this.avatar);
        disposeObject(this.avatar);
        this.avatar = next;
        this.scene.add(next);
        this.opts.net.sendPlayerState({ ...config });
    }

    // Settings and controls used by React
    setKey(code: string, pressed: boolean) { this.input.setVirtual(code, pressed); }
    setAnalogInput(x: number, y: number) { this.input.setAnalog(x, y); }
    adjustZoom(delta: number) { this.rig.zoom(delta); }
    toggleFreeCamera() { this.rig.toggleFree(this.scene); }
    get freeCameraEnabled() { return this.rig.freeEnabled; }
    set freeCameraSpeed(v: number) { this.rig.freeSpeed = v; }
    setCameraRelativeMovement(on: boolean) { this.cameraRelativeMovement = on; }
    setInvertYCamera(on: boolean) { this.rig.invertY = on; }
    setCameraSensitivity(v: number) { this.rig.setSensitivity(v); }
    setRenderDistance(d: number) { setRenderDistance(this.scene, d); }
    setShadowQuality(q: ShadowQuality) { setShadowQuality(this.sun, q); }
    setShowOtherPlayers(show: boolean) { this.remotes.setVisible(show); }
    canBuildNearPlayer() { return this.build.canBuildNear(this.player.x, this.player.y); }

    resetToSpawn() {
        this.player.level = 0;
        this.teleportTo(this.spawnPoint.x, this.spawnPoint.z);
    }

    teleportTo(x: number, z: number) {
        Object.assign(this.player, { x, y: z, vx: 0, vy: 0 });
        this.avatar.position.set(x, this.player.level * STOREY_HEIGHT, z);
        this.rig.snap(this.avatar.position);
    }

    /** What a solo save needs from the world. */
    saveState(): WorldSave {
        const p = this.player;
        return { player: { x: p.x, z: p.y, level: p.level }, blocks: this.build.blocks.map(b => ({ ...b })) };
    }

    // Debug API sources (window.__dca)
    getDebugPlayer() {
        const p = this.player;
        return { x: p.x, y: this.avatar.position.y, z: p.y, vx: p.vx, vz: p.vy, floor: p.level, facing: p.facing };
    }
    getDebugCamera() {
        const c = this.rig.camera.position;
        return { x: c.x, y: c.y, z: c.z, theta: this.rig.theta, phi: this.rig.phi };
    }
    getZoneName() { return this.opts.store.get().zone; }
    getGroundZone() { return this.zoneMap.getZone(this.player.x, this.player.y); }
    getBlockCount() { return this.build.blocks.length; }

    private onResize = () => {
        this.rig.setAspect(window.innerWidth / window.innerHeight);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    };

    cleanup() {
        cancelAnimationFrame(this.rafId);
        this.unsubscribers.forEach(u => u());
        window.removeEventListener('resize', this.onResize);
        this.input.detach();
        this.pointer.dispose();
        this.build.dispose();
        this.remotes.dispose();
        this.pickups?.dispose();
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }
}
