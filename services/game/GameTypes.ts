import { GameConfig } from '../../types';
import { NetClient } from '../net/NetClient';
import { GameStore } from './GameStore';

/** React-owned state the game reads each frame (never pushed per frame the other way). */
export interface UiState {
    money: number;
    isBuilding: boolean;
    buildItem: string;
    buildLevel: number;
    alwaysRun: boolean;
}

export interface GameEvents {
    /** Kinds: pet, food, build, error, pickup, drop. Cost is money to deduct. */
    onInteract(kind: string, cost: number, message: string): void;
    onDamageDealt?(amount: number, screenX: number, screenY: number): void;
    onDeath?(): void;
    onRespawn?(): void;
}

export interface GameOptions {
    container: HTMLElement;
    net: NetClient;
    config: GameConfig;
    store: GameStore;
    getUi: () => UiState;
    events: GameEvents;
}
