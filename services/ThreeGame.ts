
import * as THREE from 'three';
import { TILE_SIZE, WORLD_SCALE, MAP_WIDTH, MAP_HEIGHT, COLORS, WEAPON_SPAWNS, COMBAT_CONFIG, PLAYER_PHYSICS } from '../constants';
import { GameConfig, HouseBlock, PlayerData } from '../types';
import { updatePlayerInDb, subscribeToPlayers, subscribeToHouses, addHouseBlock, removeHouseBlock } from './firebase';
import { createStickFigure, attachWeapon, StickFigureGroup } from './StickFigure';
import { createAnimatorState, updateAnimation, triggerAttack, triggerHitReact, getAttackHitFrame, AnimatorState } from './StickFigureAnimator';
import { createCombatState, updateCombat, startAttack, isInHitWindow, checkHit, applyDamage, getAttackData, CombatState, equipWeapon, dropWeapon } from './CombatSystem';

interface KeyState {
    [key: string]: boolean;
}

export class ThreeGame {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    playerGroup: StickFigureGroup;

    keys: KeyState = {};
    analogInput: { x: number; y: number } = { x: 0, y: 0 };
    myUserId: string | null = null;
    config: GameConfig;

    // Game State internal
    playerData: {
        x: number, y: number, z: number,
        vx: number, vy: number, // velocity
        facing: string
    } = {
        x: 200, y: 200, z: 0,
        vx: 0, vy: 0,
        facing: 'down'
    };

    // Settings
    cameraRelativeMovement: boolean = true;

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
    collidableMeshes: THREE.Object3D[] = [];
    
    buildHighlight: THREE.Mesh;
    buildCursorPos = { x: 0, y: 0 };
    floorTexture: THREE.Texture | null = null;
    
    // Camera & Mouse
    cameraState = { 
        theta: 0, 
        phi: Math.PI / 4, 
        radius: 60, 
        currentRadius: 60,
        minRadius: 20,
        maxRadius: 150
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
        userId: string,
        config: GameConfig,
        onZoneChange: any,
        onInteract: any,
        onHover: any,
        onHealthChange?: (health: number, maxHealth: number) => void,
        onDamageDealt?: (amount: number, x: number, y: number) => void,
        onDeath?: () => void,
        onRespawn?: () => void
    ) {
        this.myUserId = userId;
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

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
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
        dirLight.shadow.camera.top = 100;
        dirLight.shadow.camera.bottom = -100;
        dirLight.shadow.camera.left = -100;
        dirLight.shadow.camera.right = 100;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);

        // World Gen
        this.initWorld();

        // Weapon Pickups
        this.initWeaponPickups();

        // Player (Stick Figure)
        this.playerGroup = this.createStickFigureMesh(config);
        this.scene.add(this.playerGroup);

        // Builder Highlight
        this.buildHighlight = new THREE.Mesh(
            new THREE.BoxGeometry(TILE_SIZE*WORLD_SCALE, TILE_SIZE*WORLD_SCALE, TILE_SIZE*WORLD_SCALE),
            new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true })
        );
        this.buildHighlight.visible = false;
        this.scene.add(this.buildHighlight);
        
        // Ground plane for math
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        // Bindings
        window.addEventListener('resize', this.onResize);
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mouseup', this.onMouseUp);
        window.addEventListener('wheel', this.onWheel, { passive: true });
        // Prevent context menu on right click drag
        container.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Start DB Listeners
        if (userId) {
            this.unsubPlayers = subscribeToPlayers(userId, (id, data) => this.updateOtherPlayer(id, data));
            this.unsubHouses = subscribeToHouses((block) => this.addHouseBlockMesh(block), (id) => this.removeHouseBlockMesh(id));
        }
    }

    tagMesh(mesh: THREE.Object3D, label: string, type: string) {
        mesh.userData.hoverLabel = label;
        mesh.userData.hoverType = type;
    }

    initWorld() {
        // Ground
        const groundGeo = new THREE.PlaneGeometry(MAP_WIDTH * TILE_SIZE * WORLD_SCALE, MAP_HEIGHT * TILE_SIZE * WORLD_SCALE);
        const groundMat = new THREE.MeshLambertMaterial({ color: COLORS.GROUND });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set((MAP_WIDTH * TILE_SIZE * WORLD_SCALE)/2, -0.1, (MAP_HEIGHT * TILE_SIZE * WORLD_SCALE)/2);
        ground.receiveShadow = true;
        this.tagMesh(ground, 'Grass', 'Terrain');
        this.scene.add(ground);
        this.collidableMeshes.push(ground);

        // Roads
        const roadGeo = new THREE.PlaneGeometry(MAP_WIDTH * TILE_SIZE * WORLD_SCALE, 100 * WORLD_SCALE);
        const roadMat = new THREE.MeshLambertMaterial({ color: COLORS.ROAD });
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.rotation.x = -Math.PI / 2;
        road.position.set((MAP_WIDTH * TILE_SIZE * WORLD_SCALE)/2, 0, 450 * WORLD_SCALE);
        road.receiveShadow = true;
        this.tagMesh(road, 'Road', 'Terrain');
        this.scene.add(road);

        const vRoadGeo = new THREE.PlaneGeometry(100 * WORLD_SCALE, MAP_HEIGHT * TILE_SIZE * WORLD_SCALE);
        const vRoad = new THREE.Mesh(vRoadGeo, roadMat);
        vRoad.rotation.x = -Math.PI / 2;
        vRoad.position.set(600 * WORLD_SCALE, 0.01, (MAP_HEIGHT * TILE_SIZE * WORLD_SCALE)/2);
        vRoad.receiveShadow = true;
        this.tagMesh(vRoad, 'Road', 'Terrain');
        this.scene.add(vRoad);

        // Buildings
        this.addBldg(100, 100, 120, 100, 0x95a5a6, 'City Hall');
        this.addBldg(900, 100, 100, 80, 0xe74c3c, 'Burgers');
        this.addBldg(1100, 100, 100, 80, 0xf39c12, 'Pizza');
        this.addBldg(500, 100, 100, 80, 0x9b59b6, 'Pet Shop');

        // Trees
        for(let i=0; i<60; i++) {
            const tx = Math.random() * (MAP_WIDTH*TILE_SIZE);
            const ty = Math.random() * (MAP_HEIGHT*TILE_SIZE);
            if ((ty > 380 && ty < 520) || ty > 600) continue; // Avoid roads and housing
            const group = new THREE.Group();
            const trunk = new THREE.Mesh(new THREE.BoxGeometry(4, 10, 4), new THREE.MeshLambertMaterial({color: COLORS.WOOD}));
            trunk.position.y = 5; group.add(trunk);
            this.tagMesh(trunk, 'Tree', 'Nature');
            
            const leaves = new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshLambertMaterial({color: 0x228B22}));
            leaves.position.y = 15; group.add(leaves);
            this.tagMesh(leaves, 'Tree', 'Nature');

            group.position.set(tx * WORLD_SCALE, 0, ty * WORLD_SCALE);
            this.scene.add(group);
            this.collidableMeshes.push(trunk); 
        }
    }

    addBldg(x: number, y: number, w: number, h: number, color: number, label: string) {
        this.buildings.push({x,y,w,h});
        const group = new THREE.Group();
        const w3 = w * WORLD_SCALE; 
        const d3 = h * WORLD_SCALE;
        const h3 = 40;
        
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w3, h3, d3), new THREE.MeshLambertMaterial({color}));
        mesh.position.y = h3/2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        this.collidableMeshes.push(mesh);

        // Label
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if(ctx) {
            canvas.width = 256; canvas.height = 64;
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0,0,256,64);
            ctx.fillStyle = 'white'; ctx.font = 'bold 40px VT323'; 
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(label, 128, 32);
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
            sprite.position.set(0, h3 + 15, 0);
            sprite.scale.set(30, 7.5, 1);
            group.add(sprite);
        }
        
        // Tag all children for hover
        group.children.forEach(c => {
            if (c instanceof THREE.Mesh) this.tagMesh(c, label, 'Building');
        });

        group.position.set((x + w/2) * WORLD_SCALE, 0, (y + h/2) * WORLD_SCALE);
        this.scene.add(group);
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
            sprite.position.y = 16; sprite.scale.set(10, 2.5, 1);
            figure.add(sprite);
        }

        if (cfg.pet && cfg.pet !== 'none') {
            const pm = this.createPetMesh(cfg.pet);
            pm.position.set(4, 0, 4); figure.add(pm);
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
            pickup.position.set(spawn.x * WORLD_SCALE, 2, spawn.y * WORLD_SCALE);
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
                pickup.mesh.position.y = 2 + Math.sin(Date.now() * 0.003) * 0.5;
                pickup.mesh.rotation.y += deltaTime * 2;

                // Check if player can pick up
                const dist = Math.hypot(
                    this.playerData.x - pickup.x,
                    this.playerData.y - pickup.y
                );

                if (dist < 30 && !this.combatState.weapon) {
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
            const target = new THREE.Vector3(data.x * WORLD_SCALE, (data.z || 0) * 15, data.y * WORLD_SCALE);
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

            // Handle death visibility
            if (data.combat?.isDead) {
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
        
        // Prevent duplicates if we did optimistic update
        const existing = this.houseBlocks.find(b => b.x === data.x && b.y === data.y && b.z === data.z);
        if (existing) {
            // If existing is temp/offline and this is real, replace it
            if (existing.id?.startsWith('temp_') || existing.id?.startsWith('offline_')) {
                this.removeHouseBlockMesh(existing.id);
            } else {
                // Already have a real block here
                return;
            }
        }

        this.houseBlocks.push(data);
        
        const size = TILE_SIZE * WORLD_SCALE;
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
            mesh.position.set(data.x * WORLD_SCALE + size/2, (data.z * 15) + 0.1, data.y * WORLD_SCALE + size/2);
            this.collidableMeshes.push(mesh);
        } else if (data.type === 'stairs') {
            mesh = new THREE.Mesh(new THREE.BoxGeometry(size, 15, size), mat);
            mesh.position.set(data.x * WORLD_SCALE + size/2, (data.z * 15) + 7.5, data.y * WORLD_SCALE + size/2);
        } else if (data.type === 'flower') {
             mesh = new THREE.Mesh(new THREE.SphereGeometry(size/3, 8, 8), new THREE.MeshLambertMaterial({color: 0xff0000}));
             mesh.position.set(data.x * WORLD_SCALE + size/2, (data.z * 15) + 2, data.y * WORLD_SCALE + size/2);
        } else {
             const h = (data.type === 'wood' || data.type === 'stone') ? 15 : 6;
             mesh = new THREE.Mesh(new THREE.BoxGeometry(size, h, size), mat);
             mesh.position.set(data.x * WORLD_SCALE + size/2, (data.z * 15) + h/2, data.y * WORLD_SCALE + size/2);
             if (h > 10) this.collidableMeshes.push(mesh);
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
            this.updateCamera();
            this.renderer.render(this.scene, this.camera);
            return;
        }

        // Movement Logic - Time-based with acceleration
        let targetSpeed = alwaysRun ? PLAYER_PHYSICS.RUN_SPEED : PLAYER_PHYSICS.WALK_SPEED;
        if (this.combatState.isAttacking) {
            targetSpeed *= PLAYER_PHYSICS.ATTACK_SPEED_MULTIPLIER;
        }

        // Get raw input (keyboard)
        let inputX = 0;
        let inputY = 0;
        if (this.keys['w'] || this.keys['ArrowUp']) inputY = -1;
        if (this.keys['s'] || this.keys['ArrowDown']) inputY = 1;
        if (this.keys['a'] || this.keys['ArrowLeft']) inputX = -1;
        if (this.keys['d'] || this.keys['ArrowRight']) inputX = 1;

        // Optional: analog input (virtual stick)
        const analogX = this.analogInput.x;
        const analogY = this.analogInput.y;
        const analogLength = Math.sqrt(analogX * analogX + analogY * analogY);

        // Prefer analog input if present
        if (analogLength > 0) {
            inputX = analogX;
            inputY = analogY;
        }

        // Normalize diagonal input to prevent speed boost (keep analog magnitude)
        let inputLength = Math.sqrt(inputX * inputX + inputY * inputY);
        if (inputLength > 1) {
            inputX /= inputLength;
            inputY /= inputLength;
            inputLength = 1;
        }

        // Optional: Camera-relative movement
        if (this.cameraRelativeMovement && inputLength > 0) {
            const camAngle = this.cameraState.theta;
            const cos = Math.cos(camAngle);
            const sin = Math.sin(camAngle);
            const rotatedX = inputX * cos - inputY * sin;
            const rotatedY = inputX * sin + inputY * cos;
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
        this.playerData.x = Math.max(0, Math.min(MAP_WIDTH * TILE_SIZE - pw, this.playerData.x));
        this.playerData.y = Math.max(0, Math.min(MAP_HEIGHT * TILE_SIZE - ph, this.playerData.y));

        // Second floor fall - check if standing on an actual floor tile
        if (this.playerData.z === 1) {
            if (!this.isOnFloorTile()) {
                this.playerData.z = 0;
            }
        }

        // Update Mesh
        const targetPos = new THREE.Vector3(this.playerData.x * WORLD_SCALE, (this.playerData.z * 15), this.playerData.y * WORLD_SCALE);
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
        updateAnimation(this.playerGroup, this.animatorState, deltaTime, isMoving, alwaysRun);

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
        if (this.myUserId && Math.random() > 0.9) { // Throttled sync
            updatePlayerInDb(this.myUserId, {
                x: Math.round(this.playerData.x),
                y: Math.round(this.playerData.y),
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
        if (this.playerData.x < 600 && this.playerData.y < 500) zone = "City Center";
        else if (this.playerData.x > 800 && this.playerData.y < 500) zone = "Food Court";
        else if (this.playerData.y > 600) zone = "Home Lot";
        this.onZoneChange(zone, this.playerData.z);

        // Build Highlight
        if (isBuilding && zone === "Home Lot") {
            this.buildHighlight.visible = true;

            const gx = Math.round(this.buildCursorPos.x / TILE_SIZE) * TILE_SIZE;
            const gy = Math.round(this.buildCursorPos.y / TILE_SIZE) * TILE_SIZE;

            this.buildHighlight.position.set(
                gx * WORLD_SCALE + (TILE_SIZE * WORLD_SCALE) / 2,
                (buildLevel * 15) + 5,
                gy * WORLD_SCALE + (TILE_SIZE * WORLD_SCALE) / 2
            );
        } else {
            this.buildHighlight.visible = false;
        }

        this.updateCamera();
        this.renderer.render(this.scene, this.camera);
    }

    // Collision detection helper - checks if player at (x, y) with bounds (w, h) collides
    checkCollision(x: number, y: number, w: number, h: number): boolean {
        // Check buildings
        if (this.playerData.z === 0) {
            for (const b of this.buildings) {
                if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) {
                    return true;
                }
            }
        }

        // Check blocks (walls/tables)
        for (const block of this.houseBlocks) {
            if (block.z !== this.playerData.z) continue;
            if (block.type !== 'wood' && block.type !== 'stone' && block.type !== 'table') continue;

            if (x < block.x + TILE_SIZE && x + w > block.x &&
                y < block.y + TILE_SIZE && y + h > block.y) {
                return true;
            }
        }

        return false;
    }

    // Check if player is standing on a floor tile (for second floor logic)
    isOnFloorTile(): boolean {
        const pw = PLAYER_PHYSICS.COLLISION_WIDTH;
        const ph = PLAYER_PHYSICS.COLLISION_HEIGHT;

        // Check center and corners of player bounds
        const checkPoints = [
            { x: this.playerData.x + pw / 2, y: this.playerData.y + ph / 2 }, // center
            { x: this.playerData.x, y: this.playerData.y }, // top-left
            { x: this.playerData.x + pw, y: this.playerData.y }, // top-right
            { x: this.playerData.x, y: this.playerData.y + ph }, // bottom-left
            { x: this.playerData.x + pw, y: this.playerData.y + ph }, // bottom-right
        ];

        for (const point of checkPoints) {
            const tileX = Math.floor(point.x / TILE_SIZE) * TILE_SIZE;
            const tileY = Math.floor(point.y / TILE_SIZE) * TILE_SIZE;

            // Check if there's a floor tile at this position on current z level
            const hasFloor = this.houseBlocks.some(b =>
                b.type === 'floor' &&
                b.z === this.playerData.z &&
                b.x === tileX &&
                b.y === tileY
            );

            if (hasFloor) return true;
        }

        // Also check for stairs
        const stairCheck = this.houseBlocks.some(b =>
            b.type === 'stairs' &&
            b.z === this.playerData.z &&
            this.playerData.x < b.x + TILE_SIZE && this.playerData.x + pw > b.x &&
            this.playerData.y < b.y + TILE_SIZE && this.playerData.y + ph > b.y
        );

        return stairCheck;
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
        this.playerData.x = 200;
        this.playerData.y = 200;
        this.playerData.z = 0;
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

    updateCamera() {
        // Smooth Zoom
        this.cameraState.currentRadius += (this.cameraState.radius - this.cameraState.currentRadius) * 0.1;

        const target = this.playerGroup.position.clone().add(new THREE.Vector3(0, 10, 0));
        
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
             finalOffset = direction.multiplyScalar(intersects[0].distance - 2);
        }
        
        this.camera.position.lerp(target.clone().add(finalOffset), 0.1);
        this.camera.lookAt(target);
    }

    // Main Interaction Handler (called from UI or Keypress)
    handleInteraction(money: number, buildItem: string, buildLevel: number, isBuilding: boolean) {
        // If building, use the cursor position (highlight position)
        if (isBuilding) {
            const gx = Math.round(this.buildCursorPos.x / TILE_SIZE) * TILE_SIZE;
            const gy = Math.round(this.buildCursorPos.y / TILE_SIZE) * TILE_SIZE;
            this.attemptBuildAt(gx, gy, money, buildItem, buildLevel);
            return;
        }

        // Otherwise, check interactions near player
        const gridX = Math.round(this.playerData.x / TILE_SIZE) * TILE_SIZE;
        const gridY = Math.round(this.playerData.y / TILE_SIZE) * TILE_SIZE;

        // Check Stairs (Player Feet)
        const stair = this.houseBlocks.find(b => b.type === 'stairs' && b.x === gridX && b.y === gridY && b.z === this.playerData.z);
        if (stair) {
            this.playerData.z = this.playerData.z === 0 ? 1 : 0;
            return;
        }

        // Shops (Distance Check)
        const dist = (x: number, y: number) => Math.hypot(this.playerData.x - x, this.playerData.y - y);
        if (dist(550, 140) < 80) this.onInteract('pet', 0, '');
        else if (dist(1150, 140) < 80 && money >= 5) this.onInteract('food', 5, 'Yummy Pizza!');
        else if (dist(950, 140) < 80 && money >= 5) this.onInteract('food', 5, 'Tasty Burger!');
    }

    attemptBuildAt(x: number, y: number, money: number, buildItem: string, buildLevel: number) {
         // Double check zone (Rough check for Home Lot > 600)
         if (y <= 600) {
             this.onInteract('error', 0, "Go to Home Lot!");
             return;
         }

         // Allow stacking: Floor + Prop (Wall/Furniture)
         const blocksAtLoc = this.houseBlocks.filter(b => b.x === x && b.y === y && b.z === buildLevel);
         const existingFloor = blocksAtLoc.find(b => b.type === 'floor');
         const existingObject = blocksAtLoc.find(b => b.type !== 'floor');

         if (buildItem === 'delete') {
             if (existingObject) removeHouseBlock(existingObject.id!);
             else if (existingFloor) removeHouseBlock(existingFloor.id!);
             else this.onInteract('error', 0, "Nothing here!");
         } else {
             const isFloor = buildItem === 'floor';
             const canBuild = isFloor ? !existingFloor : !existingObject;
             
             if (canBuild) {
                 if (money >= 10) {
                     this.onInteract('build', 10, '-10💰');
                     const block = { x, y, z: buildLevel, type: buildItem, builder: this.myUserId || 'anon' };
                     
                     addHouseBlock(block);
                     
                     // Optimistic / Offline Update
                     if (!this.myUserId || this.myUserId.startsWith('offline_')) {
                         this.addHouseBlockMesh({ ...block, id: `offline_${Date.now()}_${Math.random()}` });
                     }
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
        if (this.myUserId) updatePlayerInDb(this.myUserId, newConfig as any);
    }

    setKey(key: string, pressed: boolean) {
        this.keys[key] = pressed;
    }

    setAnalogInput(x: number, y: number) {
        const length = Math.sqrt(x * x + y * y);
        if (length > 1) {
            x /= length;
            y /= length;
        }
        this.analogInput.x = x;
        this.analogInput.y = y;
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
        
        if (this.mouseState.isDown && this.mouseState.button === 2) {
            this.cameraState.theta -= e.movementX * 0.005;
            this.cameraState.phi -= e.movementY * 0.005;
            this.cameraState.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, this.cameraState.phi));
        }

        // Build Cursor Raycast
        if (this.cachedState.isBuilding) {
            this.raycaster.setFromCamera(this.mouse, this.camera);
            
            // Project cursor to current build level plane
            const planeY = (this.cachedState.buildLevel * 15);
            const p = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
            const point = new THREE.Vector3();
            this.raycaster.ray.intersectPlane(p, point);
            
            if (point) {
                this.buildCursorPos.x = point.x / WORLD_SCALE;
                this.buildCursorPos.y = point.z / WORLD_SCALE;
            }
        }
    }
    
    onMouseDown = (e: MouseEvent) => {
        if (e.button === 2) { // Right click
            this.mouseState.isDown = true;
            this.mouseState.button = 2;
        } else if (e.button === 0) { // Left Click
            if (this.cachedState.isBuilding) {
                const gx = Math.round(this.buildCursorPos.x / TILE_SIZE) * TILE_SIZE;
                const gy = Math.round(this.buildCursorPos.y / TILE_SIZE) * TILE_SIZE;
                
                this.attemptBuildAt(
                    gx, 
                    gy, 
                    this.cachedState.money, 
                    this.cachedState.buildItem, 
                    this.cachedState.buildLevel
                );
            }
        }
    }

    onMouseUp = () => {
        this.mouseState.isDown = false;
        this.mouseState.button = -1;
    }

    adjustZoom(delta: number) {
        this.cameraState.radius += delta;
        this.cameraState.radius = Math.max(this.cameraState.minRadius, Math.min(this.cameraState.maxRadius, this.cameraState.radius));
    }

    onWheel = (e: WheelEvent) => {
        this.adjustZoom(e.deltaY * 0.1);
    }

    onKeyDown = (e: KeyboardEvent) => {
        this.keys[e.key] = true;

        // Attack controls
        const key = e.key.toLowerCase();
        if (key === 'j' || key === 'z') {
            this.handleAttack('punch');
        } else if (key === 'k' || key === 'x') {
            this.handleAttack('kick');
        } else if (key === 'l' || key === 'c') {
            this.handleAttack('weapon');
        } else if (key === 'q') {
            this.handleDropWeapon();
        }
    };

    onKeyUp = (e: KeyboardEvent) => this.keys[e.key] = false;

    cleanup() {
        if (this.unsubPlayers) this.unsubPlayers();
        if (this.unsubHouses) this.unsubHouses();
        window.removeEventListener('resize', this.onResize);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('mouseup', this.onMouseUp);
        window.removeEventListener('wheel', this.onWheel);
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        this.renderer.dispose();
    }
}
