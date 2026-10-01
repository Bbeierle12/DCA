/**
 * B2 page side: builds the batched London street scene exactly as the game did and exports it
 * as binary glTF. Driven by `scripts/export_glb.mjs` in headless Chromium (canvas textures need
 * a DOM). Result lands on `window.__export` as base64 plus stats.
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { WorldBuilder } from '../services/world/WorldBuilder';

interface ExportResult {
    glb?: string;
    error?: string;
    stats?: Record<string, unknown>;
}

declare global {
    interface Window {
        __export?: ExportResult;
    }
}

type FlatMaterial = THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;

/** glTF has no Lambert; a rough, non-metal standard material is the same look in Blender. */
function toStandard(m: FlatMaterial, name: string): THREE.Material {
    if ((m as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
        m.name = name;
        return m; // exported as KHR_materials_unlit
    }
    const l = m as THREE.MeshLambertMaterial;
    const s = new THREE.MeshStandardMaterial({
        name,
        color: l.color,
        map: l.map,
        vertexColors: l.vertexColors,
        transparent: l.transparent,
        opacity: l.opacity,
        side: l.side,
        emissive: l.emissive,
        roughness: 1,
        metalness: 0,
    });
    return s;
}

function bytesToBase64(bytes: Uint8Array): string {
    let s = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(s);
}

async function run(): Promise<ExportResult> {
    const scene = new THREE.Scene();
    const built = new WorldBuilder().build(scene, { batch: true });

    // Clean, stable names: street_c<cx>_<cz>_m<i>; materials street_m<i>_<kind>.
    const matIndex = new Map<string, number>();
    const matCache = new Map<THREE.Material, THREE.Material>();
    const meshes: THREE.Mesh[] = [];
    scene.traverse(o => {
        if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    let vertsBefore = 0;
    let vertsAfter = 0;
    let ground = 0;
    for (const mesh of meshes) {
        const isGround = built.collidableMeshes.includes(mesh);
        let chunk: number[] | null = null;
        let key = isGround ? 'ground' : 'unbatched';
        if (mesh.name.startsWith('batch:')) {
            const [chunkPart, ...rest] = mesh.name.slice(6).split('|');
            chunk = chunkPart.split(',').map(Number);
            key = rest.join('|');
        }
        if (!matIndex.has(key)) matIndex.set(key, matIndex.size);
        const mi = matIndex.get(key)!;
        const src = mesh.material as FlatMaterial;
        const lit = (src as THREE.MeshLambertMaterial).isMeshLambertMaterial;
        const kind = [lit ? 'lit' : 'unlit', src.map ? 'tex' : '', src.transparent ? 'alpha' : '',
            lit && (src as THREE.MeshLambertMaterial).emissive.getHex() !== 0 ? 'glow' : '']
            .filter(Boolean).join('_');
        if (!matCache.has(src)) matCache.set(src, toStandard(src, `street_m${mi}_${kind}`));
        mesh.material = matCache.get(src)!;

        vertsBefore += mesh.geometry.attributes.position.count;
        mesh.geometry = mergeVertices(mesh.geometry, 1e-4);
        vertsAfter += mesh.geometry.attributes.position.count;

        if (isGround) {
            mesh.name = `ground_${ground++}`;
            mesh.userData = { dca: 'ground', walkable: true };
        } else if (chunk) {
            mesh.name = `street_c${chunk[0]}_${chunk[1]}_m${mi}`;
            mesh.userData = { dca: 'street', chunk, batched: mesh.userData.batched ?? 0, material: key };
        } else {
            mesh.name = `street_unbatched_m${mi}`;
            mesh.userData = { dca: 'street' };
        }
    }

    const exporter = new GLTFExporter();
    const glb = (await exporter.parseAsync(scene, { binary: true, onlyVisible: true })) as ArrayBuffer;
    const bytes = new Uint8Array(glb);
    return {
        glb: bytesToBase64(bytes),
        stats: {
            bytes: bytes.length,
            meshes: meshes.length,
            materials: matCache.size,
            vertsBefore,
            vertsAfter,
            batch: built.batch,
        },
    };
}

run()
    .then(r => { window.__export = r; })
    .catch(e => { window.__export = { error: String(e && e.stack ? e.stack : e) }; })
    .finally(() => {
        const status = document.getElementById('status');
        if (status) status.textContent = window.__export?.error ? 'failed' : 'done';
    });
