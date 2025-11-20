
import * as THREE from 'three';
import { TILE_SIZE, WORLD_SCALE, MAP_WIDTH, MAP_HEIGHT, COLORS } from '../constants';
import { GameConfig, HouseBlock, PlayerData } from '../types';
import { updatePlayerInDb, subscribeToPlayers, subscribeToHouses, addHouseBlock, removeHouseBlock } from './firebase';

interface KeyState {
    [key: string]: boolean;
}

export class ThreeGame {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    playerGroup: THREE.Group;
    
    keys: KeyState = {};
    myUserId: string | null = null;
    config: GameConfig;
    
    // Game State internal
    playerData: { x: number, y: number, z: number, facing: string, speed: number } = {
        x: 200, y: 200, z: 0, facing: 'down', speed: 4
    };
    
    // Cached State for Events
    cachedState = {
        money: 0,
        isBuilding: false,
        buildItem: 'wood',
        buildLevel: 0,
        alwaysRun: false
    };

    // Callbacks
    onZoneChange: (zone: string, level: number) => void;
    onInteract: (type: string, cost: number, msg: string) => void;
    onHover: (info: { label: string, type: string, x: number, y: number } | null) => void;
    
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
        onHover: any
    ) {
        this.myUserId = userId;
        this.config = config;
        this.onZoneChange = onZoneChange;
        this.onInteract = onInteract;
        this.onHover = onHover;

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
        
        // Player
        this.playerGroup = this.createCharacterMesh(config);
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

    createCharacterMesh(cfg: GameConfig) {
        const group = new THREE.Group();
        
        // Materials
        const skinMat = new THREE.MeshLambertMaterial({ color: cfg.skin });
        const shirtMat = new THREE.MeshLambertMaterial({ color: cfg.shirt });
        const pantsMat = new THREE.MeshLambertMaterial({ color: cfg.pants });
        const hairMat = new THREE.MeshLambertMaterial({ color: cfg.hair });
        
        const body = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 2), shirtMat);
        body.position.y = 4.5; group.add(body);

        const head = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), skinMat);
        head.position.y = 8.5; group.add(head);

        const hair = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 3.2), hairMat);
        hair.position.y = 10.2; group.add(hair);

        const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4, 1.8), pantsMat);
        leftLeg.position.set(-1, 2, 0); group.add(leftLeg);
        const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4, 1.8), pantsMat);
        rightLeg.position.set(1, 2, 0); group.add(rightLeg);

        // Name Tag
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if(ctx) {
            canvas.width = 256; canvas.height = 64;
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,256,64);
            ctx.fillStyle = 'white'; ctx.font = '40px Arial'; 
            ctx.textAlign = 'center'; ctx.fillText(cfg.name, 128, 45);
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
            sprite.position.y = 14; sprite.scale.set(10, 2.5, 1);
            group.add(sprite);
        }

        if (cfg.pet && cfg.pet !== 'none') {
            const pm = this.createPetMesh(cfg.pet);
            pm.position.set(4,0,4); group.add(pm);
        }

        // Shadows & Tags
        group.traverse(o => { 
            if(o instanceof THREE.Mesh) { 
                o.castShadow = true; 
                o.receiveShadow = true;
                this.tagMesh(o, cfg.name, 'Citizen');
            }
        });
        return group;
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
            const mesh = this.createCharacterMesh(data as GameConfig);
            this.scene.add(mesh);
            this.otherPlayers[id] = { mesh, data };
        } else {
            const p = this.otherPlayers[id];
            // visual update
            const target = new THREE.Vector3(data.x * WORLD_SCALE, (data.z||0)*15, data.y * WORLD_SCALE);
            p.mesh.position.lerp(target, 0.3);
            
            // Check if appearance changed
            if (p.data.skin !== data.skin || p.data.pet !== data.pet || p.data.shirt !== data.shirt) {
                this.scene.remove(p.mesh);
                p.mesh = this.createCharacterMesh(data as GameConfig);
                this.scene.add(p.mesh);
            }
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
        // Update cached state for events
        this.cachedState = { money, isBuilding, buildItem, buildLevel, alwaysRun };

        // Mouse Hover Check
        this.checkHover(isBuilding);

        // Movement Logic
        const speed = alwaysRun ? 7 : 4;
        let dx = 0; let dy = 0;
        
        if (this.keys['w'] || this.keys['ArrowUp']) { dy = -speed; this.playerData.facing = 'up'; }
        if (this.keys['s'] || this.keys['ArrowDown']) { dy = speed; this.playerData.facing = 'down'; }
        if (this.keys['a'] || this.keys['ArrowLeft']) { dx = -speed; this.playerData.facing = 'left'; }
        if (this.keys['d'] || this.keys['ArrowRight']) { dx = speed; this.playerData.facing = 'right'; }

        const isMoving = dx !== 0 || dy !== 0;
        
        let nx = this.playerData.x + dx;
        let ny = this.playerData.y + dy;
        
        // Boundaries
        if (nx < 0) nx = 0; if (ny < 0) ny = 0;
        if (nx > MAP_WIDTH * TILE_SIZE) nx = MAP_WIDTH * TILE_SIZE;
        if (ny > MAP_HEIGHT * TILE_SIZE) ny = MAP_HEIGHT * TILE_SIZE;

        // Collision
        let collided = false;
        // Buildings
        if (this.playerData.z === 0) {
            for(const b of this.buildings) {
                if (nx < b.x + b.w && nx + 24 > b.x && ny < b.y + b.h && ny + 32 > b.y) { collided = true; break; }
            }
        }
        // Blocks (Walls)
        for(const h of this.houseBlocks) {
            const bz = h.z;
            // Collide with walls/tables but NOT floors or flowers
            if (bz === this.playerData.z && (h.type === 'wood' || h.type === 'stone' || h.type === 'table')) {
                if (nx < h.x + TILE_SIZE && nx + 24 > h.x && ny < h.y + TILE_SIZE && ny + 32 > h.y) { collided = true; break; }
            }
        }

        if (!collided) {
            this.playerData.x = nx;
            this.playerData.y = ny;
        }

        // Falling off 2nd floor if not on floor tile
        if (this.playerData.z === 1 && ny < 600) { 
             this.playerData.z = 0; 
        }

        // Update Mesh
        const targetPos = new THREE.Vector3(this.playerData.x * WORLD_SCALE, (this.playerData.z * 15), this.playerData.y * WORLD_SCALE);
        this.playerGroup.position.lerp(targetPos, 0.2);
        
        // Rotation
        if (isMoving) {
            if (this.playerData.facing === 'down') this.playerGroup.rotation.y = 0;
            if (this.playerData.facing === 'up') this.playerGroup.rotation.y = Math.PI;
            if (this.playerData.facing === 'left') this.playerGroup.rotation.y = Math.PI / 2;
            if (this.playerData.facing === 'right') this.playerGroup.rotation.y = -Math.PI / 2;
            
            // Sync
            if (this.myUserId && Math.random() > 0.9) { // Throttled sync
                updatePlayerInDb(this.myUserId, { 
                    x: Math.round(this.playerData.x), 
                    y: Math.round(this.playerData.y), 
                    z: this.playerData.z, 
                    facing: this.playerData.facing,
                    lastActive: Date.now()
                });
            }
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
            
            // Set position based on mouse cursor logic in onMouseMove
            // If mouse is active, use buildCursorPos. 
            // If buildCursorPos is 0,0 (not set), fallback to player.
            // But since we init at 0,0 and that's valid... let's trust it if mouse updated.
            // However, onMouseMove updates it.
            
            // Snap to grid
            const gx = Math.round(this.buildCursorPos.x / TILE_SIZE) * TILE_SIZE;
            const gy = Math.round(this.buildCursorPos.y / TILE_SIZE) * TILE_SIZE;

            this.buildHighlight.position.set(
                gx * WORLD_SCALE + (TILE_SIZE*WORLD_SCALE)/2, 
                (buildLevel * 15) + 5, 
                gy * WORLD_SCALE + (TILE_SIZE*WORLD_SCALE)/2
            );
        } else {
            this.buildHighlight.visible = false;
        }

        this.updateCamera();
        this.renderer.render(this.scene, this.camera);
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
                     this.onInteract('build', 10, '');
                     const block = { x, y, z: buildLevel, type: buildItem, builder: this.myUserId || 'anon' };
                     
                     addHouseBlock(block);
                     
                     // Optimistic / Offline Update
                     // If we are offline, or just to be snappy, we can add it visually immediately
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
        this.playerGroup = this.createCharacterMesh(newConfig);
        this.scene.add(this.playerGroup);
        if(this.myUserId) updatePlayerInDb(this.myUserId, newConfig as any);
    }

    setKey(key: string, pressed: boolean) {
        this.keys[key] = pressed;
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
            const intersects = this.raycaster.intersectObject(this.groundPlane); // Intersect infinite plane at y=0??
            // Better to intersect the visible ground mesh if possible, but simpler:
            // Ground mesh is y=-0.1. Let's just intersect a mathematical plane at y=0.
            // But wait, raycaster uses world coords.
            
            // Actually, lets reuse the ground mesh if we can.
            // The ground mesh is in collidableMeshes[0] usually.
            // But simpler math:
            const targetZ = 0; // Game Logic Y is 3D Z. 3D Y is Height.
            // Plane equation: y = 0 (or whatever floor level * 15).
            // Let's project to the current floor level!
            const planeY = (this.cachedState.buildLevel * 15);
            const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), planeY); // Normal points down? No up. Vector3(0, 1, 0).
            
            const ray = new THREE.Ray(this.camera.position, this.raycaster.ray.direction);
            const target = new THREE.Vector3();
            
            // Ray-Plane intersection manually or via THREE
            // THREE.Raycaster.ray.intersectPlane needs a plane object.
            const p = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY); // Constant is -dist from origin
            const point = new THREE.Vector3();
            this.raycaster.ray.intersectPlane(p, point);
            
            if (point) {
                // Convert 3D point back to Game Coords (X, Z) -> (x, y)
                // x = point.x / WORLD_SCALE
                // y = point.z / WORLD_SCALE
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

    onKeyDown = (e: KeyboardEvent) => this.keys[e.key] = true;
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
