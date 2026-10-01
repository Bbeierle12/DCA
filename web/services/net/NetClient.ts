import { HouseBlock, PlayerData } from '../../types';

export type NetMode = 'solo' | 'online';

/**
 * Everything the game sends to or hears from other players goes through a NetClient.
 * Solo play uses LocalNet; the Rust co-op server gets a WebSocket implementation (Phase 5).
 */
export interface NetClient {
    readonly mode: NetMode;
    readonly localId: string;
    /** Publish this player's state. Implementations throttle as they see fit. */
    sendPlayerState(state: Partial<PlayerData>): void;
    /** Ask to place a block; the block arrives back through onBlockAdded with an id. */
    sendBlockAdd(block: Omit<HouseBlock, 'id'>): void;
    sendBlockRemove(id: string): void;
    onRemotePlayer(cb: (id: string, data: PlayerData) => void): () => void;
    onBlockAdded(cb: (block: HouseBlock) => void): () => void;
    onBlockRemoved(cb: (id: string) => void): () => void;
    dispose(): void;
}
