export class SeededRandom {
    private state: number;

    constructor(seed: number) {
        this.state = seed >>> 0;
        if (this.state === 0) {
            this.state = 0x6D2B79F5;
        }
    }

    next(): number {
        // Mulberry32 PRNG
        this.state += 0x6D2B79F5;
        let t = this.state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    float(min: number, max: number): number {
        return min + this.next() * (max - min);
    }

    int(min: number, max: number): number {
        return Math.floor(this.float(min, max + 1));
    }

    pick<T>(items: T[]): T {
        return items[this.int(0, items.length - 1)];
    }
}

export function hashString(value: string): number {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
