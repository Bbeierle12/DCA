import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startGame, waitForFrames } from './helpers';

// Completion goal 3: draw calls <= 300, triangles <= 400k, active lights <= 4 at 1280x720.
// Also records the worst numbers per spot in test-results/metrics.json for the loop log.
const SPOTS: Array<[string, number | null, number | null]> = [
  ['spawn', null, null],
  ['Oxford Circus', 430, 275],
  ['Trafalgar Square', 530, 505],
  ['Piccadilly Circus', 430, 405],
];

test('render budget holds at key spots, looking all around', async ({ page }) => {
  test.setTimeout(180_000);
  await startGame(page);
  const metrics: Record<string, { calls: number; triangles: number; lights: number; programs: number }> = {};
  for (const [name, x, z] of SPOTS) {
    if (x !== null && z !== null) await page.evaluate(([px, pz]) => window.__dca!.teleport(px, pz), [x, z]);
    const startTheta = await page.evaluate(() => window.__dca!.camera().theta);
    const worst = { calls: 0, triangles: 0, lights: 0, programs: 0 };
    for (let i = 0; i < 4; i++) {
      await page.mouse.move(640, 360);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(640 + 157, 360);
      await page.mouse.up({ button: 'right' });
      await waitForFrames(page, 2);
      const info = await page.evaluate(() => window.__dca!.renderInfo());
      worst.calls = Math.max(worst.calls, info.calls);
      worst.triangles = Math.max(worst.triangles, info.triangles);
      worst.lights = Math.max(worst.lights, info.lights);
      worst.programs = Math.max(worst.programs, info.programs);
      if (i === 0) expect(Math.abs((await page.evaluate(() => window.__dca!.camera().theta)) - startTheta)).toBeGreaterThan(0.5);
    }
    metrics[name] = worst;
    expect(worst.calls, `draw calls at ${name}`).toBeLessThanOrEqual(300);
    expect(worst.triangles, `triangles at ${name}`).toBeLessThanOrEqual(400_000);
    expect(worst.lights, `lights at ${name}`).toBeLessThanOrEqual(4);
  }
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/metrics.json', JSON.stringify(metrics, null, 2));
  console.log('METRICS', JSON.stringify(metrics));
});
