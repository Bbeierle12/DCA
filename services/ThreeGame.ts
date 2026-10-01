
import * as THREE from 'three';
import { WORLD_SIZE, BUILD_TILE, STOREY_HEIGHT, PLAYER_HEIGHT, SPAWN_TARGET, COLORS, WEAPON_SPAWNS, COMBAT_CONFIG, PLAYER_PHYSICS } from '../constants';
import { GameConfig, HouseBlock, PlayerData } from '../types';
import { NetClient } from './net/NetClient';
import { createStickFigure, attachWeapon, StickFigureGroup } from './StickFigure';
import { createAnimatorState, updateAnimation, triggerAttack, triggerHitReact, getAttackHitFrame, AnimatorState } from './StickFigureAnimator';
import { createCombatState, updateCombat, startAttack, isInHitWindow, checkHit, applyDamage, getAttackData, CombatState, equipWeapon, dropWeapon } from './CombatSystem';
import { WorldBuilder } from './world/WorldBuilder';
import { ZoneMapV2 } from './world/ZoneMapV2';
import { ZoneType } from './world/WorldConfigV2';
import { findNearestZonePoint } from './world/Spawn';
import { Input } from './game/Input';

export class ThreeGame {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    playerGroup: StickFigureGroup;

    input = new Input();
    private touchLook: { id: number; x: number; y: number } | null = null;
    myUserId: string;
    net: NetClient;
    private lastNetSend = 0;
    config: GameConfig;

    // Game State internal
    // Metres. (x, y) is the centre of the footprint on the ground plane: x = world x, y = world z.
    // z is the storey index (0 = ground).
    playerData: {
        x: number, y: number, z: number,
        vx: number, vy: number, // velocity (m/s)
        facing: string
    } = {
        x: SPAWN_TARGET.x, y: SPAWN_TARGET.z, z: 0,
        vx: 0, vy: 0,
        facing: 'down'
    };

    // Settings
    cameraRelativeMovement: boolean = true;
    invertYCamera: boolean = false;
    cameraSensitivity: number = 1.0;
    showOtherPlayersEnabled: boolean = true;

    // Free camera mode (toggle with F9)
    freeCameraEnabled: boolean = false;
    freeCameraPos = new THREE.Vector3(400, 200, 400);
    freeCameraYaw: number = 0;      // horizontal rotation
    freeCameraPitch: number = -Math.PI / 2; // looking straight down by default
    freeCameraSpeed: number = 200;   // units per second

    // References for settings that affect Three.js objects
    private directionalLight: THREE.DirectionalLight | null = null;

    // Cached State for Events
    cachedState = {
        money: 0,
        isBuilding: false,
        buildItem: 'wood',
        buildLevel: 0,
        alwaysRun: false
    };

    // Animation and Combat
    animatorState: AnimatorState;
    combatState: CombatState;
    lastTime: number = 0;
    hitCheckedThisAttack: boolean = false;

    // Weapon pickups
    weaponPickups: { mesh: THREE.Group, type: string, x: number, y: number, taken: boolean }[] = [];

    // Debug/test bookkeeping (read through window.__dca)
    frameCount: number = 0;
    lastZone: string = '';

    // Callbacks
    onZoneChange: (zone: string, level: number) => void;
    onInteract: (type: string, cost: number, msg: string) => void;
    onHover: (info: { label: string, type: string, x: number, y: number } | null) => void;
    onHealthChange: (health: number, maxHealth: number) => void;
    onDamageDealt: (amount: number, x: number, y: number) => void;
    onDeath: () => void;
    onRespawn: () => void;
    
    // Assets
    otherPlayers: Record<string, { mesh: THREE.Group, data: PlayerData }> = {};
    houseBlocks: HouseBlock[] = [];
    blockMeshes: Record<string, THREE.Mesh> = {};
    buildings: {x: number, y: number, w: number, h: number}[] = [];
    zoneMap!: ZoneMapV2;
    spawnPoint: { x: number; z: number } = { x: SPAWN_TARGET.x, z: SPAWN_TARGET.z };
    collidableMeshes: THREE.Object3D[] = [];
    
    buildHighlight: THREE.Mesh;
    buildCursorPos = { x: 0, y: 0 };
    floorTexture: THREE.Texture | null = null;
    
    // Camera & Mouse
    cameraState = {
        theta: 0,
        phi: Math.PI / 4,
        radius: 7,
        currentRadius: 7,
        minRadius: 2.5,
        maxRadius: 40
    };
    mouseState = { isDown: false, button: -1 };
    
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    mouseClient = { x: 0, y: 0 };
    
    // Plane for raycasting build cursor
    groundPlane: THREE.Plane;

    // Listeners
    unsubPlayers: () => void = () => {};
    unsubHouses: () => void = () => {};

    constructor(
        container: HTMLElement,
        net: NetClient,
        config: GameConfig,
        onZoneChange: any,
        onInteract: any,
        onHover: any,
        onHealthChange?: (health: number, maxHealth: number) => void,
        onDamageDealt?: (amount: number, x: number, y: number) => void,
        onDeath?: () => void,
        onRespawn?: () => void
    ) {
        this.net = net;
        this.myUserId = net.localId;
        this.config = config;
        this.onZoneChange = onZoneChange;
        this.onInteract = onInteract;
        this.onHover = onHover;
        this.onHealthChange = onHealthChange || (() => {});
        this.onDamageDealt = onDamageDealt || (() => {});
        this.onDeath = onDeath || (() => {});
        this.onRespawn = onRespawn || (() => {});

        // Initialize animation and combat
        this.animatorState = createAnimatorState();
        this.combatState = createCombatState();

        // Scene Setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(COLORS.SKY);
        this.scene.fog = new THREE.Fog(COLORS.SKY, 100, 700);

        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        container.appendChild(this.renderer.domElement);

        // Lights
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
        hemiLight.position.set(0, 200, 0);
        this.scene.add(hemiLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(100, 200, 100);
        dirLight.castShadow = true;
        // Optimization for shadows
        dirLight.shadow.camera.top = 60;
        dirLight.shadow.camera.bottom = -60;
        dirLight.shadow.camera.left = -60;
        dirLight.shadow.camera.right = 60;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);
        this.directionalLight = dirLight;

        // World Gen
        const worldBuilder = new WorldBuilder();
        const worldResult = worldBuilder.build(this.scene);
        // Add ground to collidables for raycasting
        worldResult.collidableMeshes.forEach(m => this.collidableMeshes.push(m));
        this.zoneMap = worldResult.zoneMap;
        this.spawnPoint = findNearestZonePoint(this.zoneMap, SPAWN_TARGET.x, SPAWN_TARGET.z, ZoneType.CLEAR_WALK)
            ?? { x: SPAWN_TARGET.x, z: SPAWN_TARGET.z };
        this.playerData.x = this.spawnPoint.x;
        this.playerData.y = this.spawnPoint.z;

        // Weapon Pickups
        this.initWeaponPickups();

        // Player (Stick Figure)
        this.playerGroup = this.createStickFigureMesh(config);
        this.playerGroup.position.set(this.playerData.x, 0, this.playerData.y);
        this.scene.add(this.playerGroup);
        this.snapCamera();

        // Builder Highlight
        this.buildHighlight = new THREE.Mesh(
            new THREE.BoxGeometry(BUILD_TILE, STOREY_HEIGHT, BUILD_TILE),
            new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true })
        );
        this.buildHighlight.visible = false;
        this.scene.add(this.buildHighlight);
        
        // Ground plane for math
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        // Bindings
        window.addEventListener('resize', this.onResize);
        this.input.onAction(this.onAction);
        this.input.attach(window);
        const canvas = this.renderer.domElement;
        canvas.style.touchAction = 'none';
        document.addEventListener('mousemove', this.onMouseMove);
        canvas.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mouseup', this.onMouseUp);
        canvas.addEventListener('wheel', this.onWheel, { passive: true });
        canvas.addEventListener('pointerdown', this.onPointerDown);
        canvas.addEventListener('pointermove', this.onPointerMove);
        canvas.addEventListener('pointerup', this.onPointerUp);
        canvas.addEventListener('pointercancel', this.onPointerUp);
        // Prevent context menu on right click drag
        container.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Network listeners (LocalNet in solo play)
        this.unsubPlayers = net.onRemotePlayer((id, data) => this.updateOtherPlayer(id, data));
        const unsubAdded = net.onBlockAdded((block) => this.addHouseBlockMesh(block));
        const unsubRemoved = net.onBlockRemoved((id) => this.removeHouseBlockMesh(id));
        this.unsubHouses = () => { unsubAdded(); unsubRemoved(); };
    }

    tagMesh(mesh: THREE.Object3D, label: string, type: string) {
        mesh.userData.hoverLabel = label;
        mesh.userData.hoverType = type;
    }

    createStickFigureMesh(cfg: GameConfig): StickFigureGroup {
        const figure = createStickFigure(cfg);

        // Name Tag
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
            canvas.width = 256; canvas.height = 64;
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, 256, 64);
            ctx.fillStyle = 'white'; ctx.font = '40px Arial';
            ctx.textAlign = 'center'; ctx.fillText(cfg.name, 128, 45);
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
            sprite.position.y = PLAYER_HEIGHT + 0.4; sprite.scale.set(1.4, 0.35, 1);
            figure.add(sprite);
        }

        if (cfg.pet && cfg.pet !== 'none') {
            const pm = this.createPetMesh(cfg.pet);
            // Pet meshes are modelled in legacy units; 0.13 brings a dog to roughly knee height.
            pm.scale.setScalar(0.13);
            pm.position.set(0.7, 0, 0.5); figure.add(pm);
        }

        // Tags
        figure.traverse(o => {
            if (o instanceof THREE.Mesh) {
                this.tagMesh(o, cfg.name, 'Citizen');
            }
        });

        return figure;
    }

    // Keep old method for compatibility (redirects to new one)
    createCharacterMesh(cfg: GameConfig) {
        return this.createStickFigureMesh(cfg);
    }

    initWeaponPickups() {
        WEAPON_SPAWNS.forEach(spawn => {
            const pickup = this.createWeaponPickupMesh(spawn.type);
            pickup.scale.setScalar(0.25);
            pickup.position.set(spawn.x, 0.5, spawn.y);
            this.scene.add(pickup);
            this.weaponPickups.push({
                mesh: pickup,
                type: spawn.type,
                x: spawn.x,
                y: spawn.y,
                taken: false
            });
        });
    }

    createWeaponPickupMesh(type: string): THREE.Group {
        const group = new THREE.Group();

        // Floating platform
        const platformGeo = new THREE.CylinderGeometry(3, 3, 0.5, 16);
        const platformMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const platform = new THREE.Mesh(platformGeo, platformMat);
        platform.castShadow = true;
        group.add(platform);

        // Weapon visual
        let weaponColor = 0x8B4513; // Brown for bat
        if (type === 'sword') weaponColor = 0xcccccc;
        if (type === 'axe') weaponColor = 0x888888;

        const weaponGeo = new THREE.BoxGeometry(1, 4, 0.5);
        const weaponMat = new THREE.MeshLambertMaterial({ color: weaponColor });
        const weapon = new THREE.Mesh(weaponGeo, weaponMat);
        weapon.position.y = 3;
        weapon.rotation.z = 0.2;
        weapon.castShadow = true;
        group.add(weapon);

        // Glow ring
        const ringGeo = new THREE.TorusGeometry(3.5, 0.2, 8, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: type === 'sword' ? 0x00ff00 : type === 'axe' ? 0xff0000 : 0xffff00,
            transparent: true,
            opacity: 0.6
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.5;
        group.add(ring);

        this.tagMesh(platform, `${type.charAt(0).toUpperCase() + type.slice(1)} Pickup`, 'Weapon');
        this.tagMesh(weapon, `${type.charAt(0).toUpperCase() + type.slice(1)}`, 'Weapon');

        return group;
    }

    updateWeaponPickups(deltaTime: number) {
        this.weaponPickups.forEach(pickup => {
            if (!pickup.taken) {
                // Floating animation
                pickup.mesh.position.y = 0.5 + Math.sin(Date.now() * 0.003) * 0.1;
                pickup.mesh.rotation.y += deltaTime * 2;

                // Check if player can pick up
                const dist = Math.hypot(
                    this.playerData.x - pickup.x,
                    this.playerData.y - pickup.y
                );

                if (dist < 1.5 && !this.combatState.weapon) {
                    // Pick up weapon
                    pickup.taken = true;
                    pickup.mesh.visible = false;
                    equipWeapon(this.combatState, pickup.type);
                    attachWeapon(this.playerGroup, pickup.type);
                    this.onInteract('pickup', 0, `Picked up ${pickup.type}!`);

                    // Respawn after 30 seconds
                    setTimeout(() => {
                        pickup.taken = false;
                        pickup.mesh.visible = true;
                    }, 30000);
                }
            }
        });
    }

    handleDropWeapon() {
        if (this.combatState.weapon) {
            const droppedWeapon = dropWeapon(this.combatState);
            attachWeapon(this.playerGroup, null);
            this.onInteract('drop', 0, `Dropped ${droppedWeapon}!`);
        }
    }

    createPetMesh(type: string) {
        const group = new THREE.Group();
        let color = 0x8B4513; let scale = 1;
        if (type === 'cat') { color = 0xFFA500; scale = 0.7; }
        if (type === 'horse') { color = 0xA0522D; scale = 1.5; }
        
        const mat = new THREE.MeshLambertMaterial({ color });
        const body = new THREE.Mesh(new THREE.BoxGeometry(4*scale, 3*scale, 6*scale), mat);
        body.position.y = 2*scale; group.add(body);
        const head = new THREE.Mesh(new THREE.BoxGeometry(2.5*scale, 2.5*scale, 2.5*scale), mat);
        head.position.set(0, 4.5*scale, 3*scale); group.add(head);
        
        // Tag pet parts
        group.traverse(o => {
            if (o instanceof THREE.Mesh) this.tagMesh(o, type === 'horse' ? 'Horse' : (type === 'cat' ? 'Cat' : 'Dog'), 'Pet');
        });

        return group;
    }

    updateOtherPlayer(id: string, data: PlayerData) {
        if (!this.otherPlayers[id]) {
            const mesh = this.createStickFigureMesh(data as GameConfig);
            this.scene.add(mesh);
            this.otherPlayers[id] = {
                mesh,
                data,
                animatorState: createAnimatorState()
            } as any;
        } else {
            const p = this.otherPlayers[id] as any;
            // Visual update
            const target = new THREE.Vector3(data.x, (data.z || 0) * STOREY_HEIGHT, data.y);
            p.mesh.position.lerp(target, 0.3);

            // Update rotation based on facing
            if (data.facing === 'down') p.mesh.rotation.y = 0;
            else if (data.facing === 'up') p.mesh.rotation.y = Math.PI;
            else if (data.facing === 'left') p.mesh.rotation.y = Math.PI / 2;
            else if (data.facing === 'right') p.mesh.rotation.y = -Math.PI / 2;

            // Check if appearance changed
            if (p.data.skin !== data.skin || p.data.pet !== data.pet || p.data.shirt !== data.shirt) {
                this.scene.remove(p.mesh);
                p.mesh = this.createStickFigureMesh(data as GameConfig);
                this.scene.add(p.mesh);
                p.animatorState = createAnimatorState();
            }

            // Handle weapon changes
            const oldWeapon = p.data.combat?.weapon || null;
            const newWeapon = data.combat?.weapon || null;
            if (oldWeapon !== newWeapon) {
                attachWeapon(p.mesh as StickFigureGroup, newWeapon);
            }

            // Update animation for other players
            const isMoving = p.data.x !== data.x || p.data.y !== data.y;
            const deltaTime = 0.016; // Approximate frame time

            // Trigger attack animation if they started attacking
            if (data.combat?.isAttacking && !p.data.combat?.isAttacking) {
                const attackType = data.combat.attackType as 'punch' | 'kick' | 'weapon';
                if (attackType) {
                    triggerAttack(p.animatorState, attackType);
                }
            }

            // Handle death visibility and show other players setting
            if (data.combat?.isDead || !this.showOtherPlayersEnabled) {
                p.mesh.visible = false;
            } else {
                p.mesh.visible = true;
            }

            updateAnimation(p.mesh as StickFigureGroup, p.animatorState, deltaTime, isMoving, false);

            p.data = data;
        }
    }

    getFloorTexture() {
        if (this.floorTexture) return this.floorTexture;
        
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Base color
            ctx.fillStyle = '#D2B48C'; 
            ctx.fillRect(0, 0, 64, 64);
            
            // Wood Plank Details
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            
            // Horizontal lines (between planks)
            ctx.fillRect(0, 0, 64, 1);
            ctx.fillRect(0, 32, 64, 1);
            
            // Vertical staggered lines
            ctx.fillRect(0, 0, 1, 32);
            ctx.fillRect(32, 32, 1, 32);
            
            // Subtle gradient for depth
            const grad = ctx.createLinearGradient(0,0,0,64);
            grad.addColorStop(0, 'rgba(255,255,255,0.05)');
            grad.addColorStop(1, 'rgba(0,0,0,0.05)');
            ctx.fillStyle = grad;
            ctx.fillRect(0,0,64,64);
        }
        this.floorTexture = new THREE.CanvasTexture(canvas);
        this.floorTexture.magFilter = THREE.NearestFilter;
        this.floorTexture.minFilter = THREE.NearestFilter;
        return this.floorTexture;
    }

    addHouseBlockMesh(data: HouseBlock) {
        if (this.blockMeshes[data.id!]) return;
        

        this.houseBlocks.push(data);
        
        const size = BUILD_TILE;
        const baseY = data.z * STOREY_HEIGHT;
        const cx = data.x + size / 2;
        const cz = data.y + size / 2;
        let mesh: THREE.Mesh;
        let color = COLORS.WOOD;
        let label = "Structure";
        let type = "Structure";
        
        // Map colors & labels
        if (data.type === 'wood') { color = COLORS.WOOD; label = "Wood Wall"; }
        if (data.type === 'stone') { color = COLORS.STONE; label = "Stone Wall"; }
        if (data.type === 'floor') { label = "Wood Floor"; type = "Floor"; }
        if (data.type === 'flower') { color = COLORS.FLOWER; label = "Red Flower"; type = "Decor"; }
        if (data.type === 'table') { color = COLORS.TABLE; label = "Wooden Table"; type = "Furniture"; }
        if (data.type === 'bed') { color = COLORS.BED; label = "Cozy Bed"; type = "Furniture"; }
        if (data.type === 'stairs') { color = COLORS.STAIRS; label = "Stairs"; type = "Structure"; }

        let mat: THREE.Material;

        if (data.type === 'floor') {
             mat = new THREE.MeshLambertMaterial({ map: this.getFloorTexture() });
        } else {
             mat = new THREE.MeshLambertMaterial({ color });
        }

        if (data.type === 'floor') {
            mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
            mesh.rotation.x = -Math.PI/2;
            mesh.position.set(cx, baseY + 0.05, cz);
            this.collidableMeshes.push(mesh);
        } else if (data.type === 'stairs') {
            mesh = new THREE.Mesh(new THREE.BoxGeometry(size, STOREY_HEIGHT, size), mat);
            mesh.position.set(cx, baseY + STOREY_HEIGHT / 2, cz);
        } else if (data.type === 'flower') {
             mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshLambertMaterial({color: 0xff0000}));
             mesh.position.set(cx, baseY + 0.3, cz);
        } else {
             const isWall = data.type === 'wood' || data.type === 'stone';
             const h = isWall ? STOREY_HEIGHT : (data.type === 'bed' ? 0.6 : 0.8);
             mesh = new THREE.Mesh(new THREE.BoxGeometry(size, h, size), mat);
             mesh.position.set(cx, baseY + h / 2, cz);
             if (isWall) this.collidableMeshes.push(mesh);
        }
        
        mesh.castShadow = true; 
        mesh.receiveShadow = true;
        this.tagMesh(mesh, label, type);
        this.scene.add(mesh);
        this.blockMeshes[data.id!] = mesh;
    }

    removeHouseBlockMesh(id: string) {
        if (this.blockMeshes[id]) {
            const mesh = this.blockMeshes[id];
            // Remove from collidables
            const idx = this.collidableMeshes.indexOf(mesh);
            if (idx > -1) this.collidableMeshes.splice(idx, 1);

            this.scene.remove(mesh);
            delete this.blockMeshes[id];
            this.houseBlocks = this.houseBlocks.filter(b => b.id !== id);
        }
    }

    checkHover(isBuilding: boolean) {
        if (!isBuilding) {
            this.onHover(null);
            return;
        }

        this.raycaster.setFromCamera(this.mouse, this.camera);
        // Check intersection with all children recursively
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        let found = null;
        for (const hit of intersects) {
            const obj = hit.object;
            if (obj.userData && obj.userData.hoverLabel) {
                found = {
                    label: obj.userData.hoverLabel,
                    type: obj.userData.hoverType,
                    x: this.mouseClient.x,
                    y: this.mouseClient.y
                };
                break;
            }
        }
        this.onHover(found);
    }

    update(money: number, isBuilding: boolean, buildItem: string, alwaysRun: boolean, buildLevel: number) {
        // Calculate delta time
        const currentTime = performance.now() / 1000;
        const deltaTime = this.lastTime === 0 ? 0.016 : Math.min(currentTime - this.lastTime, 0.1);
        this.lastTime = currentTime;

        // Update cached state for events
        this.cachedState = { money, isBuilding, buildItem, buildLevel, alwaysRun };

        // Mouse Hover Check
        this.checkHover(isBuilding);

        // Don't allow movement or actions if dead
        if (this.combatState.isDead) {
            // Update combat for respawn timer
            const wasDeadBefore = this.combatState.isDead;
            updateCombat(this.combatState, deltaTime, currentTime);

            // Check for respawn
            if (wasDeadBefore && !this.combatState.isDead) {
                this.handleRespawn();
            }

            // Still render
            this.updateCamera(deltaTime);
            this.renderFrame();
            return;
        }

        // In free camera mode, only update camera and render -- skip player logic
        if (this.freeCameraEnabled) {
            this.updateCamera(deltaTime);
            this.renderFrame();
            return;
        }

        // Movement Logic - Time-based with acceleration
        const running = alwaysRun || this.input.running;
        let targetSpeed = running ? PLAYER_PHYSICS.RUN_SPEED : PLAYER_PHYSICS.WALK_SPEED;
        if (this.combatState.isAttacking) {
            targetSpeed *= PLAYER_PHYSICS.ATTACK_SPEED_MULTIPLIER;
        }

        // Input: keyboard, on-screen buttons or joystick (already normalised)
        const axis = this.input.moveAxis();
        let inputX = axis.x;
        let inputY = axis.y;
        const inputLength = Math.hypot(inputX, inputY);

        // Optional: Camera-relative movement
        if (this.cameraRelativeMovement && inputLength > 0) {
            const camAngle = this.cameraState.theta;
            const cos = Math.cos(camAngle);
            const sin = Math.sin(camAngle);
            const rotatedX = inputX * cos + inputY * sin;
            const rotatedY = -inputX * sin + inputY * cos;
            inputX = rotatedX;
            inputY = rotatedY;
        }

        // Calculate target velocity
        const targetVx = inputX * targetSpeed;
        const targetVy = inputY * targetSpeed;

        // Apply acceleration/deceleration
        const isMoving = inputLength > 0;
        const accel = isMoving ? PLAYER_PHYSICS.ACCELERATION : PLAYER_PHYSICS.DECELERATION;

        // Smoothly interpolate velocity toward target
        const velDiffX = targetVx - this.playerData.vx;
        const velDiffY = targetVy - this.playerData.vy;
        const maxChange = accel * deltaTime;

        if (Math.abs(velDiffX) <= maxChange) {
            this.playerData.vx = targetVx;
        } else {
            this.playerData.vx += Math.sign(velDiffX) * maxChange;
        }

        if (Math.abs(velDiffY) <= maxChange) {
            this.playerData.vy = targetVy;
        } else {
            this.playerData.vy += Math.sign(velDiffY) * maxChange;
        }

        // Snap to zero when no input and near stop threshold
        if (!isMoving) {
            if (Math.abs(this.playerData.vx) < PLAYER_PHYSICS.STOP_THRESHOLD) this.playerData.vx = 0;
            if (Math.abs(this.playerData.vy) < PLAYER_PHYSICS.STOP_THRESHOLD) this.playerData.vy = 0;
        }

        // Add knockback to velocity (time-based decay)
        const knockbackDecay = Math.pow(COMBAT_CONFIG.KNOCKBACK_DECAY, deltaTime * 60); // Normalize to 60fps
        this.combatState.knockbackVelocity.x *= knockbackDecay;
        this.combatState.knockbackVelocity.z *= knockbackDecay;

        // Stop very small knockback
        if (Math.abs(this.combatState.knockbackVelocity.x) < 0.5) this.combatState.knockbackVelocity.x = 0;
        if (Math.abs(this.combatState.knockbackVelocity.z) < 0.5) this.combatState.knockbackVelocity.z = 0;

        // Calculate movement delta (time-based)
        let dx = (this.playerData.vx + this.combatState.knockbackVelocity.x) * deltaTime;
        let dy = (this.playerData.vy + this.combatState.knockbackVelocity.z) * deltaTime;

        // Clamp step size to prevent tunneling at low FPS
        const stepLength = Math.sqrt(dx * dx + dy * dy);
        if (stepLength > PLAYER_PHYSICS.MAX_STEP) {
            const scale = PLAYER_PHYSICS.MAX_STEP / stepLength;
            dx *= scale;
            dy *= scale;
        }

        // Update facing direction based on input (not velocity)
        if (inputLength > 0) {
            if (Math.abs(inputY) > Math.abs(inputX)) {
                this.playerData.facing = inputY < 0 ? 'up' : 'down';
            } else {
                this.playerData.facing = inputX < 0 ? 'left' : 'right';
            }
        } else {
            const facingVx = this.playerData.vx + this.combatState.knockbackVelocity.x;
            const facingVy = this.playerData.vy + this.combatState.knockbackVelocity.z;
            if (Math.abs(facingVx) > 0.01 || Math.abs(facingVy) > 0.01) {
                if (Math.abs(facingVy) > Math.abs(facingVx)) {
                    this.playerData.facing = facingVy < 0 ? 'up' : 'down';
                } else {
                    this.playerData.facing = facingVx < 0 ? 'left' : 'right';
                }
            }
        }

        // Axis-separated collision detection for wall sliding
        const pw = PLAYER_PHYSICS.COLLISION_WIDTH;
        const ph = PLAYER_PHYSICS.COLLISION_HEIGHT;

        // Try X movement first
        let nx = this.playerData.x + dx;
        let ny = this.playerData.y;

        if (!this.checkCollision(nx, ny, pw, ph)) {
            this.playerData.x = nx;
        } else {
            // X collision - stop X velocity
            this.playerData.vx = 0;
            this.combatState.knockbackVelocity.x = 0;
        }

        // Then try Y movement
        nx = this.playerData.x;
        ny = this.playerData.y + dy;

        if (!this.checkCollision(nx, ny, pw, ph)) {
            this.playerData.y = ny;
        } else {
            // Y collision - stop Y velocity
            this.playerData.vy = 0;
            this.combatState.knockbackVelocity.z = 0;
        }

        // Boundaries
        this.playerData.x = Math.max(pw / 2, Math.min(WORLD_SIZE - pw / 2, this.playerData.x));
        this.playerData.y = Math.max(ph / 2, Math.min(WORLD_SIZE - ph / 2, this.playerData.y));

        // Second floor fall - check if standing on an actual floor tile
        if (this.playerData.z === 1) {
            if (!this.isOnFloorTile()) {
                this.playerData.z = 0;
            }
        }

        // Update Mesh
        const targetPos = new THREE.Vector3(this.playerData.x, this.playerData.z * STOREY_HEIGHT, this.playerData.y);
        const positionLerp = 1 - Math.exp(-PLAYER_PHYSICS.RENDER_SMOOTHING * deltaTime);
        this.playerGroup.position.lerp(targetPos, positionLerp);

        // Rotation
        if (isMoving && !this.animatorState.isAttacking) {
            if (this.playerData.facing === 'down') this.playerGroup.rotation.y = 0;
            if (this.playerData.facing === 'up') this.playerGroup.rotation.y = Math.PI;
            if (this.playerData.facing === 'left') this.playerGroup.rotation.y = Math.PI / 2;
            if (this.playerData.facing === 'right') this.playerGroup.rotation.y = -Math.PI / 2;
        }

        // Update Animation
        updateAnimation(this.playerGroup, this.animatorState, deltaTime, isMoving, running);

        // Update Combat
        updateCombat(this.combatState, deltaTime, currentTime);

        // Combat Hit Detection
        this.updateCombatHits(currentTime);

        // Update Weapon Pickups
        this.updateWeaponPickups(deltaTime);

        // Flashing effect when invincible
        if (this.combatState.invincibleFrames > 0) {
            this.playerGroup.visible = Math.floor(currentTime * 10) % 2 === 0;
        } else {
            this.playerGroup.visible = true;
        }

        // Sync position and combat state
        // Publish state at most 10 times per second (frame-rate independent)
        if (currentTime - this.lastNetSend >= 0.1) {
            this.lastNetSend = currentTime;
            this.net.sendPlayerState({
                x: Math.round(this.playerData.x * 100) / 100,
                y: Math.round(this.playerData.y * 100) / 100,
                z: this.playerData.z,
                facing: this.playerData.facing,
                lastActive: Date.now(),
                combat: {
                    isAttacking: this.combatState.isAttacking,
                    attackType: this.combatState.attackType,
                    attackStartTime: this.combatState.attackStartTime,
                    health: this.combatState.health,
                    weapon: this.combatState.weapon,
                    isDead: this.combatState.isDead
                }
            });
        }

        // Zone Check
        let zone = "Streets";
        if (this.playerData.x < 120 && this.playerData.y < 100) zone = "City Center";
        else if (this.playerData.x > 160 && this.playerData.y < 100) zone = "Food Court";
        else if (this.playerData.y > 120) zone = "Home Lot";
        this.lastZone = zone;
        this.onZoneChange(zone, this.playerData.z);

        // Build Highlight
        if (isBuilding) {
            const cell = this.cursorCell();
            this.buildHighlight.visible = true;
            (this.buildHighlight.material as THREE.MeshBasicMaterial).color.set(
                this.canBuildAt(cell.x, cell.y) ? 0xffff00 : 0xff3333
            );
            this.buildHighlight.position.set(
                cell.x + BUILD_TILE / 2,
                buildLevel * STOREY_HEIGHT + STOREY_HEIGHT / 2,
                cell.y + BUILD_TILE / 2
            );
        } else {
            this.buildHighlight.visible = false;
        }

        this.updateCamera(deltaTime);
        this.renderFrame();
    }

    private renderFrame() {
        this.renderer.render(this.scene, this.camera);
        this.frameCount++;
    }

    getDebugPlayer() {
        return {
            x: this.playerData.x,
            y: this.playerGroup.position.y,
            z: this.playerData.y,
            vx: this.playerData.vx,
            vz: this.playerData.vy,
            floor: this.playerData.z,
            facing: this.playerData.facing,
        };
    }

    getDebugCamera() {
        const p = this.camera.position;
        return { x: p.x, y: p.y, z: p.z, theta: this.cameraState.theta, phi: this.cameraState.phi };
    }

    getZoneName(): string {
        return this.lastZone;
    }

    getGroundZone(): string {
        return this.zoneMap.getZone(this.playerData.x, this.playerData.y);
    }

    teleportTo(x: number, z: number) {
        this.playerData.x = x;
        this.playerData.y = z;
        this.playerData.vx = 0;
        this.playerData.vy = 0;
        this.playerGroup.position.set(x, this.playerData.z * STOREY_HEIGHT, z);
        this.snapCamera();
    }

    // Collision helper: does a w x h footprint centred on (x, y) overlap anything solid on this storey?
    checkCollision(x: number, y: number, w: number, h: number): boolean {
        const minX = x - w / 2, maxX = x + w / 2;
        const minY = y - h / 2, maxY = y + h / 2;
        if (this.playerData.z === 0) {
            for (const b of this.buildings) {
                if (minX < b.x + b.w && maxX > b.x && minY < b.y + b.h && maxY > b.y) return true;
            }
        }
        for (const block of this.houseBlocks) {
            if (block.z !== this.playerData.z) continue;
            if (block.type !== 'wood' && block.type !== 'stone' && block.type !== 'table') continue;
            if (minX < block.x + BUILD_TILE && maxX > block.x &&
                minY < block.y + BUILD_TILE && maxY > block.y) {
                return true;
            }
        }
        return false;
    }

    // Is the player standing on a floor tile or stairs (upper-storey logic)?
    isOnFloorTile(): boolean {
        const hw = PLAYER_PHYSICS.COLLISION_WIDTH / 2;
        const hh = PLAYER_PHYSICS.COLLISION_HEIGHT / 2;
        const { x, y, z } = this.playerData;
        const checkPoints = [
            { x, y },
            { x: x - hw, y: y - hh }, { x: x + hw, y: y - hh },
            { x: x - hw, y: y + hh }, { x: x + hw, y: y + hh },
        ];
        for (const point of checkPoints) {
            const tileX = Math.floor(point.x / BUILD_TILE) * BUILD_TILE;
            const tileY = Math.floor(point.y / BUILD_TILE) * BUILD_TILE;
            if (this.houseBlocks.some(b => b.type === 'floor' && b.z === z && b.x === tileX && b.y === tileY)) {
                return true;
            }
        }
        return this.houseBlocks.some(b =>
            b.type === 'stairs' && b.z === z &&
            x - hw < b.x + BUILD_TILE && x + hw > b.x &&
            y - hh < b.y + BUILD_TILE && y + hh > b.y
        );
    }

    /** Grid cell (south-west corner, metres) under the build cursor. */
    cursorCell(): { x: number; y: number } {
        return {
            x: Math.floor(this.buildCursorPos.x / BUILD_TILE) * BUILD_TILE,
            y: Math.floor(this.buildCursorPos.y / BUILD_TILE) * BUILD_TILE,
        };
    }

    /** Building is allowed off the street network: open land, never roads or pavements. */
    canBuildAt(x: number, y: number): boolean {
        const cx = x + BUILD_TILE / 2;
        const cz = y + BUILD_TILE / 2;
        if (cx < 0 || cz < 0 || cx > WORLD_SIZE || cz > WORLD_SIZE) return false;
        const zone = this.zoneMap.getZone(cx, cz);
        return zone === ZoneType.OPEN_LANDSCAPE || zone === ZoneType.PERIMETER;
    }

    /** Can the player build within reach of where they stand? */
    canBuildNearPlayer(): boolean {
        const { x, y } = this.playerData;
        for (let dx = -6; dx <= 6; dx += BUILD_TILE) {
            for (let dy = -6; dy <= 6; dy += BUILD_TILE) {
                if (this.canBuildAt(x + dx, y + dy)) return true;
            }
        }
        return false;
    }

    resetToSpawn() {
        this.playerData.z = 0;
        this.teleportTo(this.spawnPoint.x, this.spawnPoint.z);
    }

    updateCombatHits(currentTime: number) {
        // Check if we're in a hit window and haven't checked yet
        if (isInHitWindow(this.combatState, currentTime) && !this.hitCheckedThisAttack) {
            this.hitCheckedThisAttack = true;

            const attackerPos = this.playerGroup.position.clone();
            const attackerRotation = this.playerGroup.rotation.y;

            // Check hits against other players
            Object.entries(this.otherPlayers).forEach(([id, player]) => {
                const targetPos = player.mesh.position.clone();

                if (checkHit(attackerPos, attackerRotation, targetPos, this.combatState.attackType!, this.combatState.weapon)) {
                    // Calculate knockback direction
                    const knockbackDir = {
                        x: targetPos.x - attackerPos.x,
                        z: targetPos.z - attackerPos.z
                    };

                    const attackData = getAttackData(this.combatState.attackType!, this.combatState.weapon);

                    // Note: In a real multiplayer game, damage would be validated server-side
                    // For this demo, we just show damage numbers locally
                    const screenPos = this.worldToScreen(targetPos);
                    this.onDamageDealt(attackData.damage, screenPos.x, screenPos.y);
                }
            });
        }

        // Reset hit check when attack ends
        if (!this.combatState.isAttacking) {
            this.hitCheckedThisAttack = false;
        }
    }

    worldToScreen(worldPos: THREE.Vector3): { x: number, y: number } {
        const vector = worldPos.clone();
        vector.project(this.camera);

        return {
            x: (vector.x * 0.5 + 0.5) * window.innerWidth,
            y: (vector.y * -0.5 + 0.5) * window.innerHeight
        };
    }

    handleRespawn() {
        // Reset position to spawn point
        this.playerData.z = 0;
        this.playerData.x = this.spawnPoint.x;
        this.playerData.y = this.spawnPoint.z;
        // Reset velocity
        this.playerData.vx = 0;
        this.playerData.vy = 0;
        this.onRespawn();
        this.onHealthChange(this.combatState.health, this.combatState.maxHealth);
    }

    // Toggle camera-relative movement
    setCameraRelativeMovement(enabled: boolean) {
        this.cameraRelativeMovement = enabled;
    }

    // Set invert Y camera
    setInvertYCamera(inverted: boolean) {
        this.invertYCamera = inverted;
    }

    // Set camera sensitivity
    setCameraSensitivity(value: number) {
        this.cameraSensitivity = Math.max(0.1, Math.min(2.0, value));
    }

    // Set render distance (fog far distance)
    setRenderDistance(distance: number) {
        const clampedDistance = Math.max(300, Math.min(1000, distance));
        if (this.scene.fog instanceof THREE.Fog) {
            this.scene.fog.far = clampedDistance;
        }
    }

    // Set shadow quality
    setShadowQuality(quality: 'low' | 'medium' | 'high') {
        if (!this.directionalLight) return;

        const sizes: Record<string, number> = {
            low: 512,
            medium: 2048,
            high: 4096
        };

        const size = sizes[quality] || 2048;
        this.directionalLight.shadow.mapSize.width = size;
        this.directionalLight.shadow.mapSize.height = size;
        this.directionalLight.shadow.map?.dispose();
        this.directionalLight.shadow.map = null as any;
    }

    // Set show other players
    setShowOtherPlayers(show: boolean) {
        this.showOtherPlayersEnabled = show;
        Object.values(this.otherPlayers).forEach(player => {
            player.mesh.visible = show && !(player.data.combat?.isDead);
        });
    }

    // Attack methods
    handleAttack(type: 'punch' | 'kick' | 'weapon') {
        if (this.combatState.isDead) return;

        if (type === 'weapon' && !this.combatState.weapon) {
            // No weapon equipped, do punch instead
            type = 'punch';
        }

        const currentTime = performance.now() / 1000;
        if (startAttack(this.combatState, type, currentTime)) {
            triggerAttack(this.animatorState, type);
        }
    }

    // Get combat state for UI
    getHealth(): number {
        return this.combatState.health;
    }

    getMaxHealth(): number {
        return this.combatState.maxHealth;
    }

    getWeapon(): string | null {
        return this.combatState.weapon;
    }

    isDead(): boolean {
        return this.combatState.isDead;
    }

    updateCamera(deltaTime?: number) {
        if (this.freeCameraEnabled) {
            this.updateFreeCamera(deltaTime || 0.016);
            return;
        }

        // Smooth Zoom
        this.cameraState.currentRadius += (this.cameraState.radius - this.cameraState.currentRadius) * 0.1;

        const target = this.playerGroup.position.clone().add(new THREE.Vector3(0, PLAYER_HEIGHT * 0.85, 0));

        // Calculate offset based on spherical coords
        const x = this.cameraState.currentRadius * Math.sin(this.cameraState.phi) * Math.sin(this.cameraState.theta);
        const y = this.cameraState.currentRadius * Math.cos(this.cameraState.phi);
        const z = this.cameraState.currentRadius * Math.sin(this.cameraState.phi) * Math.cos(this.cameraState.theta);
        const offset = new THREE.Vector3(x, y, z);

        // Raycasting for camera occlusion
        const direction = offset.clone().normalize();
        this.raycaster.set(target, direction);
        // Check collision with buildings/ground/walls
        const intersects = this.raycaster.intersectObjects(this.collidableMeshes);

        let finalOffset = offset;
        if (intersects.length > 0 && intersects[0].distance < offset.length()) {
             // Zoom in if blocked
             finalOffset = direction.multiplyScalar(Math.max(0.3, intersects[0].distance - 0.3));
        }

        this.camera.position.lerp(target.clone().add(finalOffset), 0.1);
        this.camera.lookAt(target);
    }

    /** Put the follow camera at its resting spot immediately (no lerp), e.g. on spawn. */
    snapCamera() {
        const { theta, phi, radius } = this.cameraState;
        this.cameraState.currentRadius = radius;
        const target = this.playerGroup.position.clone().add(new THREE.Vector3(0, PLAYER_HEIGHT * 0.85, 0));
        this.camera.position.set(
            target.x + radius * Math.sin(phi) * Math.sin(theta),
            target.y + radius * Math.cos(phi),
            target.z + radius * Math.sin(phi) * Math.cos(theta),
        );
        this.camera.lookAt(target);
    }

    private updateFreeCamera(deltaTime: number) {
        const speed = this.freeCameraSpeed * deltaTime;
        const boosted = this.input.running ? speed * 3 : speed;

        // Forward/back/strafe based on yaw (horizontal only)
        const forward = new THREE.Vector3(
            -Math.sin(this.freeCameraYaw),
            0,
            -Math.cos(this.freeCameraYaw)
        );
        const right = new THREE.Vector3(
            -Math.cos(this.freeCameraYaw),
            0,
            Math.sin(this.freeCameraYaw)
        );

        const axis = this.input.moveAxis();
        this.freeCameraPos.add(forward.clone().multiplyScalar(-axis.y * boosted));
        this.freeCameraPos.add(right.clone().multiplyScalar(axis.x * boosted));

        // Vertical movement
        if (this.input.anyDown(['KeyE', 'Space'])) this.freeCameraPos.y += boosted;
        if (this.input.isDown('KeyQ')) this.freeCameraPos.y -= boosted;

        // Clamp height
        this.freeCameraPos.y = Math.max(1, Math.min(1500, this.freeCameraPos.y));

        // Apply position and look direction
        this.camera.position.copy(this.freeCameraPos);
        const lookTarget = this.freeCameraPos.clone().add(new THREE.Vector3(
            -Math.sin(this.freeCameraYaw) * Math.cos(this.freeCameraPitch),
            Math.sin(this.freeCameraPitch),
            -Math.cos(this.freeCameraYaw) * Math.cos(this.freeCameraPitch)
        ));
        this.camera.lookAt(lookTarget);
    }


    toggleFreeCamera() {
        this.freeCameraEnabled = !this.freeCameraEnabled;
        if (this.freeCameraEnabled) {
            // Snap to bird's-eye view above the world center
            this.freeCameraPos.set(400, 300, 400);
            this.freeCameraYaw = 0;
            this.freeCameraPitch = -Math.PI / 2 + 0.01; // looking straight down

            // Disable fog so the whole world is visible from above
            this.savedFog = this.scene.fog;
            this.scene.fog = null;

            // Extend far plane for high altitude
            this.camera.far = 3000;
            this.camera.updateProjectionMatrix();
        } else {
            // Restore fog and camera settings
            if (this.savedFog) {
                this.scene.fog = this.savedFog;
                this.savedFog = null;
            }
            this.camera.far = 1000;
            this.camera.updateProjectionMatrix();
        }
    }

    private savedFog: THREE.FogBase | null = null;

    // Main Interaction Handler (called from UI or Keypress)
    handleInteraction(money: number, buildItem: string, buildLevel: number, isBuilding: boolean) {
        // If building, use the cursor position (highlight position)
        if (isBuilding) {
            const cell = this.cursorCell();
            this.attemptBuildAt(cell.x, cell.y, money, buildItem, buildLevel);
            return;
        }

        // Otherwise, check interactions near player
        const gridX = Math.floor(this.playerData.x / BUILD_TILE) * BUILD_TILE;
        const gridY = Math.floor(this.playerData.y / BUILD_TILE) * BUILD_TILE;

        // Check Stairs (Player Feet)
        const stair = this.houseBlocks.find(b => b.type === 'stairs' && b.x === gridX && b.y === gridY && b.z === this.playerData.z);
        if (stair) {
            this.playerData.z = this.playerData.z === 0 ? 1 : 0;
            return;
        }

        // Shops (Distance Check)
        const dist = (x: number, y: number) => Math.hypot(this.playerData.x - x, this.playerData.y - y);
        if (dist(110, 28) < 16) this.onInteract('pet', 0, '');
        else if (dist(230, 28) < 16 && money >= 5) this.onInteract('food', 5, 'Yummy Pizza!');
        else if (dist(190, 28) < 16 && money >= 5) this.onInteract('food', 5, 'Tasty Burger!');
    }

    attemptBuildAt(x: number, y: number, money: number, buildItem: string, buildLevel: number) {
         if (!this.canBuildAt(x, y)) {
             this.onInteract('error', 0, "Can't build on roads or pavements!");
             return;
         }

         // Allow stacking: Floor + Prop (Wall/Furniture)
         const blocksAtLoc = this.houseBlocks.filter(b => b.x === x && b.y === y && b.z === buildLevel);
         const existingFloor = blocksAtLoc.find(b => b.type === 'floor');
         const existingObject = blocksAtLoc.find(b => b.type !== 'floor');

         if (buildItem === 'delete') {
             if (existingObject) this.net.sendBlockRemove(existingObject.id!);
             else if (existingFloor) this.net.sendBlockRemove(existingFloor.id!);
             else this.onInteract('error', 0, "Nothing here!");
         } else {
             const isFloor = buildItem === 'floor';
             const canBuild = isFloor ? !existingFloor : !existingObject;
             
             if (canBuild) {
                 if (money >= 10) {
                     this.onInteract('build', 10, '-10💰');
                     this.net.sendBlockAdd({ x, y, z: buildLevel, type: buildItem, builder: this.myUserId });
                 } else {
                     this.onInteract('error', 0, "Need 10💰!");
                 }
             } else {
                 this.onInteract('error', 0, "Space Occupied!");
             }
         }
    }

    updateConfig(newConfig: GameConfig) {
        this.config = newConfig;
        this.scene.remove(this.playerGroup);
        this.playerGroup = this.createStickFigureMesh(newConfig);
        // Re-attach weapon if equipped
        if (this.combatState.weapon) {
            attachWeapon(this.playerGroup, this.combatState.weapon);
        }
        this.scene.add(this.playerGroup);
        this.net.sendPlayerState({ ...newConfig });
    }

    setKey(code: string, pressed: boolean) {
        this.input.setVirtual(code, pressed);
    }

    setAnalogInput(x: number, y: number) {
        this.input.setAnalog(x, y);
    }

    onResize = () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    onMouseMove = (e: MouseEvent) => {
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        this.mouseClient = { x: e.clientX, y: e.clientY };

        if (this.freeCameraEnabled && this.mouseState.isDown) {
            // Any mouse button rotates in free camera mode
            const sensitivity = 0.005 * this.cameraSensitivity;
            this.freeCameraYaw -= e.movementX * sensitivity;
            const yMovement = this.invertYCamera ? -e.movementY : e.movementY;
            this.freeCameraPitch += yMovement * sensitivity;
            this.freeCameraPitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.freeCameraPitch));
        } else if (this.mouseState.isDown && this.mouseState.button === 2) {
            this.orbitCamera(e.movementX, e.movementY, 0.005);
        }

        // Build Cursor Raycast
        if (this.cachedState.isBuilding) {
            this.raycaster.setFromCamera(this.mouse, this.camera);
            
            // Project cursor to current build level plane
            const planeY = this.cachedState.buildLevel * STOREY_HEIGHT;
            const p = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
            const point = new THREE.Vector3();
            this.raycaster.ray.intersectPlane(p, point);
            
            if (point) {
                this.buildCursorPos.x = point.x;
                this.buildCursorPos.y = point.z;
            }
        }
    }
    
    onMouseDown = (e: MouseEvent) => {
        if (this.freeCameraEnabled) {
            // Any button enables drag-look in free camera
            this.mouseState.isDown = true;
            this.mouseState.button = e.button;
            return;
        }
        if (e.button === 2) { // Right click
            this.mouseState.isDown = true;
            this.mouseState.button = 2;
        } else if (e.button === 0) { // Left Click
            if (this.cachedState.isBuilding) {
                const cell = this.cursorCell();
                this.attemptBuildAt(
                    cell.x,
                    cell.y,
                    this.cachedState.money,
                    this.cachedState.buildItem,
                    this.cachedState.buildLevel
                );
            }
        }
    }

    /** Orbit the follow camera by a screen-space delta (pixels). */
    orbitCamera(dx: number, dy: number, perPixel: number) {
        const sensitivity = perPixel * this.cameraSensitivity;
        this.cameraState.theta -= dx * sensitivity;
        const yMovement = this.invertYCamera ? -dy : dy;
        this.cameraState.phi -= yMovement * sensitivity;
        this.cameraState.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, this.cameraState.phi));
    }

    // One-finger drag on the canvas orbits the camera (the joystick lives outside the canvas).
    onPointerDown = (e: PointerEvent) => {
        if (e.pointerType !== 'touch' || this.touchLook) return;
        this.touchLook = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };

    onPointerMove = (e: PointerEvent) => {
        if (!this.touchLook || e.pointerId !== this.touchLook.id) return;
        const dx = e.clientX - this.touchLook.x;
        const dy = e.clientY - this.touchLook.y;
        this.touchLook.x = e.clientX;
        this.touchLook.y = e.clientY;
        if (this.freeCameraEnabled) {
            this.freeCameraYaw -= dx * 0.008 * this.cameraSensitivity;
        } else {
            this.orbitCamera(dx, dy, 0.008);
        }
    };

    onPointerUp = (e: PointerEvent) => {
        if (this.touchLook && this.touchLook.id === e.pointerId) this.touchLook = null;
    };

    onMouseUp = () => {
        this.mouseState.isDown = false;
        this.mouseState.button = -1;
    }

    adjustZoom(delta: number) {
        this.cameraState.radius += delta;
        this.cameraState.radius = Math.max(this.cameraState.minRadius, Math.min(this.cameraState.maxRadius, this.cameraState.radius));
    }

    onWheel = (e: WheelEvent) => {
        if (this.freeCameraEnabled) {
            // Scroll adjusts free camera speed
            this.freeCameraSpeed = Math.max(20, Math.min(2000, this.freeCameraSpeed * (1 - e.deltaY * 0.001)));
        } else {
            this.adjustZoom(e.deltaY * 0.01);
        }
    }

    // Fresh key presses (by KeyboardEvent.code); held movement keys are read in update().
    onAction = (code: string, e: KeyboardEvent) => {
        if (code === 'Backquote' || code === 'F9') {
            e.preventDefault();
            this.toggleFreeCamera();
            return;
        }
        if (this.freeCameraEnabled) return;
        if (code === 'KeyJ' || code === 'KeyZ') this.handleAttack('punch');
        else if (code === 'KeyK' || code === 'KeyX') this.handleAttack('kick');
        else if (code === 'KeyL' || code === 'KeyC') this.handleAttack('weapon');
        else if (code === 'KeyQ') this.handleDropWeapon();
    };

    cleanup() {
        if (this.unsubPlayers) this.unsubPlayers();
        if (this.unsubHouses) this.unsubHouses();
        window.removeEventListener('resize', this.onResize);
        this.input.detach();
        const canvas = this.renderer.domElement;
        document.removeEventListener('mousemove', this.onMouseMove);
        canvas.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('mouseup', this.onMouseUp);
        canvas.removeEventListener('wheel', this.onWheel);
        canvas.removeEventListener('pointerdown', this.onPointerDown);
        canvas.removeEventListener('pointermove', this.onPointerMove);
        canvas.removeEventListener('pointerup', this.onPointerUp);
        canvas.removeEventListener('pointercancel', this.onPointerUp);
        this.renderer.dispose();
        canvas.remove();
    }
}
