import { describe, it, expect, vi } from 'vitest';
import { LocalNet, loadOrCreatePlayerId } from '../../services/net/LocalNet';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
  };
}

describe('LocalNet', () => {
  it('keeps the same player id across instances', () => {
    const storage = memoryStorage();
    const a = new LocalNet(storage);
    const b = new LocalNet(storage);
    expect(a.localId).toBe(b.localId);
    expect(a.mode).toBe('solo');
  });

  it('falls back to a fresh id when storage throws', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => {} };
    expect(loadOrCreatePlayerId(broken)).toMatch(/.+/);
    expect(loadOrCreatePlayerId(null)).toMatch(/.+/);
  });

  it('echoes block adds with unique ids and removals', () => {
    const net = new LocalNet(memoryStorage());
    const added = vi.fn();
    const removed = vi.fn();
    net.onBlockAdded(added);
    const off = net.onBlockRemoved(removed);
    net.sendBlockAdd({ x: 0, y: 0, z: 0, type: 'wood', builder: net.localId });
    net.sendBlockAdd({ x: 2, y: 0, z: 0, type: 'wood', builder: net.localId });
    expect(added).toHaveBeenCalledTimes(2);
    const ids = added.mock.calls.map(c => c[0].id);
    expect(new Set(ids).size).toBe(2);
    net.sendBlockRemove(ids[0]);
    expect(removed).toHaveBeenCalledWith(ids[0]);
    off();
    net.sendBlockRemove(ids[1]);
    expect(removed).toHaveBeenCalledTimes(1);
  });

  it('player state and remote players are no-ops in solo', () => {
    const net = new LocalNet(memoryStorage());
    expect(() => net.sendPlayerState({ x: 1 })).not.toThrow();
    const unsub = net.onRemotePlayer(() => {});
    expect(typeof unsub).toBe('function');
    net.dispose();
  });
});
