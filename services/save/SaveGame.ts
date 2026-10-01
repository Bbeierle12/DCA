import { GameConfig, HouseBlock } from '../../types';

/**
 * Versioned local save for solo play. Bump SAVE_VERSION and add a migrator whenever the shape
 * changes; old saves are upgraded step by step on load. Anything unreadable is set aside under
 * CORRUPT_KEY (so it can be inspected) and the game starts fresh instead of crashing.
 */
export const SAVE_VERSION = 1;
export const SAVE_KEY = 'dca-save';
export const CORRUPT_KEY = 'dca-save-corrupt';

export interface SaveData {
    version: typeof SAVE_VERSION;
    savedAt: number;
    player: { x: number; z: number; level: number };
    money: number;
    energy: number;
    appearance: GameConfig;
    blocks: HouseBlock[];
}

type Migrator = (old: Record<string, unknown>) => Record<string, unknown>;

/** MIGRATIONS[n] upgrades a version-n save to version n + 1. */
export const MIGRATIONS: Record<number, Migrator> = {};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

function validBlock(b: unknown): b is HouseBlock {
    const o = b as Record<string, unknown>;
    return !!o && isNum(o.x) && isNum(o.y) && isNum(o.z) && isStr(o.type) && isStr(o.builder) && (o.id === undefined || isStr(o.id));
}

function validAppearance(a: unknown): a is GameConfig {
    const o = a as Record<string, unknown>;
    return !!o && ['skin', 'hair', 'eyes', 'shirt', 'pants', 'name'].every(k => isStr(o[k])) && (o.pet === null || isStr(o.pet));
}

export function isValidSave(o: unknown): o is SaveData {
    const s = o as Record<string, unknown>;
    if (!s || s.version !== SAVE_VERSION || !isNum(s.savedAt) || !isNum(s.money) || !isNum(s.energy)) return false;
    const p = s.player as Record<string, unknown>;
    if (!p || !isNum(p.x) || !isNum(p.z) || !isNum(p.level)) return false;
    return validAppearance(s.appearance) && Array.isArray(s.blocks) && s.blocks.every(validBlock);
}

/** Upgrades an older save object to the current version, or returns null if impossible. */
export function migrate(raw: Record<string, unknown>, migrations: Record<number, Migrator> = MIGRATIONS): SaveData | null {
    let obj = raw;
    let version = isNum(obj.version) ? obj.version : 0;
    if (version > SAVE_VERSION) return null; // from a newer build; don't guess
    while (version < SAVE_VERSION) {
        const step = migrations[version];
        if (!step) return null;
        obj = step(obj);
        version += 1;
        obj = { ...obj, version };
    }
    return isValidSave(obj) ? obj : null;
}

export function parseSave(text: string | null, migrations: Record<number, Migrator> = MIGRATIONS): SaveData | null | 'corrupt' {
    if (text === null) return null;
    try {
        const obj = JSON.parse(text);
        if (!obj || typeof obj !== 'object') return 'corrupt';
        return migrate(obj, migrations) ?? 'corrupt';
    } catch {
        return 'corrupt';
    }
}

export class SaveStore {
    constructor(private storage: StorageLike | null, private key = SAVE_KEY) {}

    load(): SaveData | null {
        let text: string | null = null;
        try {
            text = this.storage?.getItem(this.key) ?? null;
        } catch {
            return null;
        }
        const result = parseSave(text);
        if (result === 'corrupt') {
            try {
                this.storage?.setItem(CORRUPT_KEY, text ?? '');
                this.storage?.removeItem(this.key);
            } catch {
                // storage unavailable; nothing more we can do
            }
            return null;
        }
        return result;
    }

    save(data: Omit<SaveData, 'version' | 'savedAt'>): boolean {
        const full: SaveData = { ...data, version: SAVE_VERSION, savedAt: Date.now() };
        try {
            this.storage?.setItem(this.key, JSON.stringify(full));
            return true;
        } catch {
            return false;
        }
    }

    clear() {
        try {
            this.storage?.removeItem(this.key);
        } catch {
            // ignore
        }
    }
}

export function browserStorage(): StorageLike | null {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
        return null;
    }
}
