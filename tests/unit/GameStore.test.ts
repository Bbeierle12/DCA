import { describe, it, expect, vi } from 'vitest';
import { GameStore, INITIAL_SNAPSHOT } from '../../services/game/GameStore';

describe('GameStore', () => {
  it('starts from the initial snapshot plus overrides', () => {
    const store = new GameStore({ zone: 'Oxford Circus' });
    expect(store.get()).toEqual({ ...INITIAL_SNAPSHOT, zone: 'Oxford Circus' });
  });

  it('notifies only on real changes and keeps snapshots immutable', () => {
    const store = new GameStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const first = store.get();
    store.set({ zone: '' });
    store.set({ hover: null });
    expect(listener).not.toHaveBeenCalled();
    store.set({ zone: 'Regent Street', level: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(first.zone).toBe('');
    expect(store.get().zone).toBe('Regent Street');
    store.set({ hover: { label: 'Bench', type: 'Furniture', x: 1, y: 2 } });
    store.set({ hover: { label: 'Bench', type: 'Furniture', x: 1, y: 2 } });
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.set({ zone: 'Piccadilly Circus' });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
