import { describe, it, expect, vi, afterEach } from 'vitest';

describe('FEATURES', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.resetModules();
  });

  it('parks combat by default', async () => {
    const { FEATURES } = await import('../../services/features');
    expect(FEATURES.combat).toBe(false);
  });

  it('lets the URL turn a flag on for a session', async () => {
    window.history.replaceState({}, '', '/?combat=1');
    const { FEATURES } = await import('../../services/features');
    expect(FEATURES.combat).toBe(true);
  });

  it('lets the URL turn a flag off', async () => {
    window.history.replaceState({}, '', '/?combat=false');
    const { FEATURES } = await import('../../services/features');
    expect(FEATURES.combat).toBe(false);
  });
});
