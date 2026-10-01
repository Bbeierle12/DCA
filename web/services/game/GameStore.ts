/**
 * The small slice of game state React renders (HUD, tooltips). The game writes it only when a
 * value changes; React subscribes with useSyncExternalStore. No per-frame React updates.
 */
export interface HoverInfo {
    label: string;
    type: string;
    x: number;
    y: number;
}

export interface GameSnapshot {
    zone: string;
    level: number;
    health: number;
    maxHealth: number;
    weapon: string | null;
    isDead: boolean;
    hover: HoverInfo | null;
}

export const INITIAL_SNAPSHOT: GameSnapshot = {
    zone: '',
    level: 0,
    health: 100,
    maxHealth: 100,
    weapon: null,
    isDead: false,
    hover: null,
};

function sameHover(a: HoverInfo | null, b: HoverInfo | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.label === b.label && a.type === b.type && a.x === b.x && a.y === b.y;
}

export class GameStore {
    private snapshot: GameSnapshot;
    private listeners = new Set<() => void>();

    constructor(initial: Partial<GameSnapshot> = {}) {
        this.snapshot = { ...INITIAL_SNAPSHOT, ...initial };
    }

    get = (): GameSnapshot => this.snapshot;

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    /** Merges changes; listeners fire only if something actually changed. */
    set(patch: Partial<GameSnapshot>) {
        let changed = false;
        for (const key of Object.keys(patch) as (keyof GameSnapshot)[]) {
            const next = patch[key];
            const prev = this.snapshot[key];
            const equal = key === 'hover'
                ? sameHover(prev as HoverInfo | null, next as HoverInfo | null)
                : Object.is(prev, next);
            if (!equal) {
                changed = true;
                break;
            }
        }
        if (!changed) return;
        this.snapshot = { ...this.snapshot, ...patch };
        this.listeners.forEach(l => l());
    }
}
