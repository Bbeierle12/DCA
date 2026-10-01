import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Collapses thousands of static meshes into a handful of draw calls.
 *
 * Meshes are grouped by spatial chunk and by "material key" (lit or unlit, transparency, side,
 * shadow flags, and texture image). Each group is merged into one geometry in world space. Flat
 * material colours are baked into vertex colours so one shared material serves every colour,
 * and texture repeat/offset is baked into UVs so segments that share a texture image share one
 * texture. Hover tags on merged props are dropped (they only fed build-mode tooltips).
 */

export interface BatchOptions {
    /** Chunk edge in metres; groups never span chunks so the camera can still cull. */
    chunkSize?: number;
    /** Meshes to leave alone (e.g. ground used for camera occlusion). */
    keep?: Set<THREE.Object3D>;
    /** Meshes smaller than this bounding radius stop casting shadows. */
    minShadowRadius?: number;
}

export interface BatchStats {
    meshesIn: number;
    meshesOut: number;
    skipped: number;
    materials: number;
}

type FlatMaterial = THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;

function isBatchable(mesh: THREE.Mesh, keep: Set<THREE.Object3D>): boolean {
    if (keep.has(mesh) || !mesh.visible || (mesh as THREE.InstancedMesh).isInstancedMesh) return false;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh || Array.isArray(mesh.material)) return false;
    const m = mesh.material as THREE.Material;
    return (m as FlatMaterial).isMeshLambertMaterial === true || (m as FlatMaterial).isMeshBasicMaterial === true;
}

function materialKey(mesh: THREE.Mesh, imageIds: Map<unknown, number>): string {
    const m = mesh.material as FlatMaterial;
    const lit = (m as THREE.MeshLambertMaterial).isMeshLambertMaterial ? 'lambert' : 'basic';
    let tex = 'none';
    if (m.map && m.map.image) {
        if (!imageIds.has(m.map.image)) imageIds.set(m.map.image, imageIds.size);
        tex = `img${imageIds.get(m.map.image)}:${m.map.magFilter}:${m.map.wrapS}:${m.map.wrapT}`;
    }
    const emissive = lit === 'lambert' ? (m as THREE.MeshLambertMaterial).emissive.getHexString() : '-';
    return [lit, tex, m.transparent ? `t${m.opacity}` : 'o', m.side, emissive, mesh.castShadow ? 'c' : '-', mesh.receiveShadow ? 'r' : '-'].join('|');
}

/** World-space copy of the mesh geometry with position/normal/(uv)/color only, non-indexed. */
function prepareGeometry(mesh: THREE.Mesh, withUv: boolean): THREE.BufferGeometry | null {
    const src = mesh.geometry;
    if (!src.attributes.position) return null;
    let g = src.index ? src.toNonIndexed() : src.clone();
    for (const name of Object.keys(g.attributes)) {
        if (name !== 'position' && name !== 'normal' && !(withUv && name === 'uv')) g.deleteAttribute(name);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (withUv && !g.attributes.uv) {
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    g.morphAttributes = {};
    g.clearGroups();
    g.applyMatrix4(mesh.matrixWorld);

    const m = mesh.material as FlatMaterial;
    if (withUv && m.map) {
        const map = m.map;
        map.updateMatrix();
        const uv = g.attributes.uv as THREE.BufferAttribute;
        const v = new THREE.Vector3();
        for (let i = 0; i < uv.count; i++) {
            v.set(uv.getX(i), uv.getY(i), 1).applyMatrix3(map.matrix);
            uv.setXY(i, v.x, v.y);
        }
    }

    const color = m.color.clone(); // material colours are already linear
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
}

function sharedMaterial(sample: THREE.Mesh): THREE.Material {
    const m = sample.material as FlatMaterial;
    const common = {
        vertexColors: true,
        transparent: m.transparent,
        opacity: m.opacity,
        side: m.side,
        depthWrite: m.depthWrite,
    };
    let map: THREE.Texture | null = null;
    if (m.map) {
        map = new THREE.Texture(m.map.image);
        map.wrapS = m.map.wrapS;
        map.wrapT = m.map.wrapT;
        map.magFilter = m.map.magFilter;
        map.minFilter = m.map.minFilter;
        map.colorSpace = m.map.colorSpace;
        map.needsUpdate = true;
    }
    if ((m as THREE.MeshLambertMaterial).isMeshLambertMaterial) {
        const lm = m as THREE.MeshLambertMaterial;
        return new THREE.MeshLambertMaterial({ ...common, map, emissive: lm.emissive.clone() });
    }
    return new THREE.MeshBasicMaterial({ ...common, map });
}

function disposeMaterial(m: THREE.Material) {
    const map = (m as FlatMaterial).map;
    if (map) map.dispose();
    m.dispose();
}

export function batchStatic(root: THREE.Object3D, options: BatchOptions = {}): BatchStats {
    const chunkSize = options.chunkSize ?? 200;
    const keep = options.keep ?? new Set<THREE.Object3D>();
    const minShadow = options.minShadowRadius ?? 1.5;
    root.updateMatrixWorld(true);

    const candidates: THREE.Mesh[] = [];
    let meshesIn = 0;
    let skipped = 0;
    root.traverse(o => {
        if (!(o as THREE.Mesh).isMesh) return;
        meshesIn++;
        if (isBatchable(o as THREE.Mesh, keep)) candidates.push(o as THREE.Mesh);
        else skipped++;
    });

    const imageIds = new Map<unknown, number>();
    const groups = new Map<string, THREE.Mesh[]>();
    const sphere = new THREE.Sphere();
    for (const mesh of candidates) {
        if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
        sphere.copy(mesh.geometry.boundingSphere!).applyMatrix4(mesh.matrixWorld);
        if (sphere.radius < minShadow) mesh.castShadow = false;
        const cx = Math.floor(sphere.center.x / chunkSize);
        const cz = Math.floor(sphere.center.z / chunkSize);
        const key = `${cx},${cz}|${materialKey(mesh, imageIds)}`;
        const list = groups.get(key);
        if (list) list.push(mesh);
        else groups.set(key, [mesh]);
    }

    const materials = new Map<string, THREE.Material>();
    const oldMaterials = new Set<THREE.Material>();
    let meshesOut = skipped;
    for (const [key, meshes] of groups) {
        const matKey = key.slice(key.indexOf('|') + 1);
        const withUv = !matKey.includes('|none|');
        const geoms = meshes.map(m => prepareGeometry(m, withUv)).filter((g): g is THREE.BufferGeometry => g !== null);
        const merged = geoms.length ? mergeGeometries(geoms, false) : null;
        geoms.forEach(g => g.dispose());
        if (!merged) {
            meshesOut += meshes.length;
            continue;
        }
        let material = materials.get(matKey);
        if (!material) {
            material = sharedMaterial(meshes[0]);
            materials.set(matKey, material);
        }
        const batch = new THREE.Mesh(merged, material);
        batch.name = `batch:${key}`;
        batch.castShadow = meshes[0].castShadow;
        batch.receiveShadow = meshes[0].receiveShadow;
        batch.matrixAutoUpdate = false;
        batch.userData.batched = meshes.length;
        root.add(batch);
        meshesOut++;
        for (const m of meshes) {
            m.parent?.remove(m);
            m.geometry.dispose();
            oldMaterials.add(m.material as THREE.Material);
        }
    }
    oldMaterials.forEach(disposeMaterial);
    pruneEmptyGroups(root);
    return { meshesIn, meshesOut, skipped, materials: materials.size };
}

/** Removes Group/Object3D nodes left with no children after their meshes were merged. */
function pruneEmptyGroups(root: THREE.Object3D) {
    const empty: THREE.Object3D[] = [];
    root.traverse(o => {
        if (o !== root && o.type === 'Group' && o.children.length === 0) empty.push(o);
    });
    for (const o of empty) o.parent?.remove(o);
    if (empty.length) pruneEmptyGroups(root);
}
