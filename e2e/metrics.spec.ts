import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startGame, waitForFrames } from './helpers';

// Records render metrics at fixed spots so every loop iteration can see the budget trend.
// Budgets are asserted in budget.spec.ts once Phase 1 P1.8 lands.
const SPOTS: Array<[string, number, number]> = [
  ['spawn', NaN, NaN],
  ['oxford-circus', 430, 275],
  ['trafalgar-square', 530, 505],
];

test('record render metrics', async ({ page }) => {
  await startGame(page);
  const results: Record<string, unknown> = {};
  for (const [name, x, z] of SPOTS) {
    if (!Number.isNaN(x)) await page.evaluate(([px, pz]) => window.__dca!.teleport(px, pz), [x, z]);
    await waitForFrames(page, 4);
    results[name] = await page.evaluate(() => window.__dca!.renderInfo());
  }
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/metrics.json', JSON.stringify(results, null, 2));
  console.log('METRICS', JSON.stringify(results));
});
