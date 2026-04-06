import * as THREE from 'three';
import { WorldConfig, RoadType, CrossingType } from './WorldConfigV2';
import { SeededRandom, hashString } from './SeededRandom';

export class TextureFactory {
    private config: WorldConfig;

    constructor(config: WorldConfig) {
        this.config = config;
    }

    private createRandom(tag: string): SeededRandom {
        return new SeededRandom(this.config.randomSeed ^ hashString(tag));
    }

    createGrassTexture(): THREE.CanvasTexture {
        const random = this.createRandom('grass');
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#4CA64C';
        ctx.fillRect(0, 0, 128, 128);
        const greens = ['#3D8B3D', '#5CB85C', '#6FCF6F', '#44944A'];
        for (let i = 0; i < 200; i++) {
            ctx.fillStyle = random.pick(greens);
            const s = 1 + random.next();
            ctx.fillRect(random.float(0, 128), random.float(0, 128), s, s);
        }
        for (let i = 0; i < 40; i++) {
            ctx.strokeStyle = random.pick(greens);
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            const bx = random.float(0, 128);
            const by = random.float(0, 128);
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + random.float(-2, 2), by - 2 - random.float(0, 3));
            ctx.stroke();
        }
        for (let i = 0; i < 8; i++) {
            ctx.fillStyle = '#8B7355';
            ctx.fillRect(random.float(0, 128), random.float(0, 128), 2 + random.float(0, 2), 1 + random.next());
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(80, 80);
        tex.magFilter = THREE.NearestFilter;
        return tex;
    }

    createSidewalkTexture(length: number): THREE.CanvasTexture {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#BBBBBB';
        ctx.fillRect(0, 0, 64, 64);
        ctx.strokeStyle = '#AAAAAA';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const pos = (i / 4) * 64;
            ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, 64); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(64, pos); ctx.stroke();
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(Math.floor(length / 4), 1);
        tex.magFilter = THREE.NearestFilter;
        return tex;
    }

    /**
     * Create a plain asphalt texture for UV-mapped road segments.
     * Lane markings are rendered as separate geometry by PathRoadBuilder,
     * so this texture is just the asphalt surface.
     */
    createSegmentRoadTexture(roadType: RoadType, segmentLength: number): THREE.CanvasTexture {
        const random = this.createRandom(`road:${roadType}:${Math.round(segmentLength)}`);
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d')!;

        // Base asphalt - darker for main roads
        const baseGray = roadType === 'lane' ? 72 : roadType === 'secondary' ? 66 : 60;
        ctx.fillStyle = `rgb(${baseGray},${baseGray},${baseGray})`;
        ctx.fillRect(0, 0, 128, 128);

        // Asphalt texture noise
        for (let i = 0; i < 400; i++) {
            const gray = baseGray - 10 + Math.floor(random.next() * 20);
            ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
            ctx.fillRect(random.float(0, 128), random.float(0, 128), 1 + random.next(), 1 + random.next());
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.magFilter = THREE.NearestFilter;
        return tex;
    }

    /** Create a roundabout asphalt texture (circular tiling) */
    createRoundaboutTexture(): THREE.CanvasTexture {
        const random = this.createRandom('roundabout');
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d')!;

        ctx.fillStyle = '#3C3C3C';
        ctx.fillRect(0, 0, 128, 128);

        for (let i = 0; i < 500; i++) {
            const gray = 50 + Math.floor(random.next() * 25);
            ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
            ctx.fillRect(random.float(0, 128), random.float(0, 128), 1 + random.next(), 1 + random.next());
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(4, 4);
        tex.magFilter = THREE.NearestFilter;
        return tex;
    }

    createCurbTexture(): THREE.MeshLambertMaterial {
        return new THREE.MeshLambertMaterial({ color: 0x999999 });
    }

    createCrosswalkTexture(width: number, crossingType: CrossingType = 'signal'): THREE.CanvasTexture {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 64;
        const ctx = canvas.getContext('2d')!;

        // Asphalt base
        ctx.fillStyle = '#444444';
        ctx.fillRect(0, 0, 128, 64);

        if (crossingType === 'informal') {
            ctx.fillStyle = '#D9C7A1';
            ctx.fillRect(0, 24, 128, 16);
        } else {
            ctx.fillStyle = '#EEEEEE';
            const barCount = crossingType === 'zebra' ? 5 : 6;
            const barWidth = 128 / (barCount * 2);
            for (let i = 0; i < barCount; i++) {
                const height = crossingType === 'zebra' ? 60 : 56;
                const top = crossingType === 'zebra' ? 2 : 4;
                const widthScale = crossingType === 'zebra' ? 1.1 : 0.7;
                ctx.fillRect(i * barWidth * 2 + barWidth * 0.2, top, barWidth * widthScale, height);
            }
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        return tex;
    }

    createStopBarTexture(width: number): THREE.CanvasTexture {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 16;
        const ctx = canvas.getContext('2d')!;

        ctx.fillStyle = '#444444';
        ctx.fillRect(0, 0, 64, 16);
        ctx.fillStyle = '#EEEEEE';
        ctx.fillRect(0, 4, 64, 8);

        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        return tex;
    }

    createFurnishingStripTexture(length: number): THREE.CanvasTexture {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d')!;

        // Darker grass / mulch strip
        ctx.fillStyle = '#3A7A3A';
        ctx.fillRect(0, 0, 64, 64);

        // Texture variation
        const greens = ['#2E6E2E', '#448844', '#3C7C3C'];
        for (let i = 0; i < 80; i++) {
            ctx.fillStyle = greens[Math.floor(Math.random() * greens.length)];
            ctx.fillRect(Math.random() * 64, Math.random() * 64, 1 + Math.random(), 1 + Math.random());
        }

        // Occasional dirt patches
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = '#6B5B3A';
            ctx.fillRect(Math.random() * 64, Math.random() * 64, 3 + Math.random() * 3, 2 + Math.random() * 2);
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(Math.floor(length / 3), 1);
        tex.magFilter = THREE.NearestFilter;
        return tex;
    }
}
