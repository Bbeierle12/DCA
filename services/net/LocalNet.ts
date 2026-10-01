import { HouseBlock, PlayerData } from '../../types';
import { NetClient } from './NetClient';

const PLAYER_ID_KEY = 'dca-player-id';

type Listener<T extends unknown[]> = (...args: T) => void;

function makeId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Reads or creates the persistent local player id. Storage failures fall back to a fresh id. */
export function loadOrCreatePlayerId(storage: Pick<Storage, 'getItem' | 'setItem'> | null): string {
    try {
        const existing = storage?.getItem(PLAYER_ID_KEY);
        if (existing) return existing;
        const id = makeId();
        storage?.setItem(PLAYER_ID_KEY, id);
        return id;
    } catch {
        return makeId();
    }
}

/** Single-player NetClient: no network; block edits are echoed back immediately. */
export class LocalNet implements NetClient {
    readonly mode = 'solo' as const;
    readonly localId: string;
    private blockSeq = 0;
    private addedListeners = new Set<Listener<[HouseBlock]>>();
    private removedListeners = new Set<Listener<[string]>>();

    constructor(storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeLocalStorage()) {
        this.localId = loadOrCreatePlayerId(storage);
    }

    sendPlayerState(_state: Partial<PlayerData>): void {
        // Nobody to tell in solo play.
    }

    sendBlockAdd(block: Omit<HouseBlock, 'id'>): void {
        const withId: HouseBlock = { ...block, id: `local_${++this.blockSeq}_${Date.now().toString(36)}` };
        this.addedListeners.forEach(cb => cb(withId));
    }

    sendBlockRemove(id: string): void {
        this.removedListeners.forEach(cb => cb(id));
    }

    onRemotePlayer(_cb: (id: string, data: PlayerData) => void): () => void {
        return () => {};
    }

    onBlockAdded(cb: (block: HouseBlock) => void): () => void {
        this.addedListeners.add(cb);
        return () => this.addedListeners.delete(cb);
    }

    onBlockRemoved(cb: (id: string) => void): () => void {
        this.removedListeners.add(cb);
        return () => this.removedListeners.delete(cb);
    }

    dispose(): void {
        this.addedListeners.clear();
        this.removedListeners.clear();
    }
}

function safeLocalStorage(): Storage | null {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
        return null;
    }
}
