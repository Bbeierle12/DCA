import { describe, it, expect } from 'vitest';
import { SaveStore, parseSave, migrate, SAVE_VERSION, SAVE_KEY, CORRUPT_KEY, isValidSave } from '../../services/save/SaveGame';

const appearance = { skin: '#fff', hair: '#000', eyes: '#000', shirt: '#f00', pants: '#00f', name: 'Ada', pet: null };
const base = {
  player: { x: 450.5, z: 272.25, level: 0 },
  money: 80,
  energy: 90,
  appearance,
  blocks: [{ x: 10, y: 12, z: 0, type: 'wood', builder: 'me', id: 'local_1' }],
};

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

describe('SaveStore', () => {
  it('round-trips a save with version and timestamp', () => {
    const storage = memory();
    const store = new SaveStore(storage);
    expect(store.load()).toBeNull();
    expect(store.save(base)).toBe(true);
    const loaded = store.load()!;
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.savedAt).toBeGreaterThan(0);
    expect(loaded.player).toEqual(base.player);
    expect(loaded.blocks).toEqual(base.blocks);
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('sets aside corrupt JSON and starts fresh', () => {
    const storage = memory();
    storage.setItem(SAVE_KEY, '{not json');
    expect(new SaveStore(storage).load()).toBeNull();
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(storage.getItem(CORRUPT_KEY)).toBe('{not json');
  });

  it('rejects structurally invalid saves', () => {
    const storage = memory();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, savedAt: 1, ...base, money: 'lots' }));
    expect(new SaveStore(storage).load()).toBeNull();
    expect(storage.getItem(CORRUPT_KEY)).not.toBeNull();
    expect(isValidSave({ version: SAVE_VERSION, savedAt: 1, ...base, blocks: [{ x: 1 }] })).toBe(false);
  });

  it('survives storage that throws', () => {
    const throwing = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    };
    const store = new SaveStore(throwing);
    expect(store.load()).toBeNull();
    expect(store.save(base)).toBe(false);
    expect(() => store.clear()).not.toThrow();
    expect(new SaveStore(null).load()).toBeNull();
  });
});

describe('migrations', () => {
  it('upgrades older versions step by step', () => {
    // A pretend version-0 save that stored the player flat and money in pence
    const v0 = { savedAt: 5, px: 1, pz: 2, pennies: 1234, energy: 50, appearance, blocks: [] };
    const migrations = {
      0: (o: Record<string, unknown>) => ({
        savedAt: o.savedAt, energy: o.energy, appearance: o.appearance, blocks: o.blocks,
        player: { x: o.px, z: o.pz, level: 0 }, money: Math.round((o.pennies as number) / 100),
      }),
    };
    const upgraded = migrate(v0, migrations)!;
    expect(upgraded.version).toBe(SAVE_VERSION);
    expect(upgraded.player).toEqual({ x: 1, z: 2, level: 0 });
    expect(upgraded.money).toBe(12);
  });

  it('refuses saves from the future or without a migration path', () => {
    expect(migrate({ ...base, version: SAVE_VERSION + 1, savedAt: 1 })).toBeNull();
    expect(migrate({ ...base, savedAt: 1 }, {})).toBeNull(); // version 0, no migrator
    expect(parseSave(null)).toBeNull();
    expect(parseSave('42')).toBe('corrupt');
  });
});
