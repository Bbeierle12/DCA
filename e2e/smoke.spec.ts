import { test, expect } from '@playwright/test';
import { watchErrors, startGame, player, holdKey } from './helpers';

test('loads main menu', async ({ page }) => {
  const errs = watchErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'DCA City 3D' })).toBeVisible();
  errs.assertClean();
});

test('starts the game and renders frames', async ({ page }) => {
  const errs = watchErrors(page);
  await startGame(page);
  const info = await page.evaluate(() => window.__dca!.renderInfo());
  expect(info.calls).toBeGreaterThan(0);
  expect(info.triangles).toBeGreaterThan(0);
  const p = await player(page);
  expect(Number.isFinite(p.x) && Number.isFinite(p.z)).toBe(true);
  expect(typeof (await page.evaluate(() => window.__dca!.zone()))).toBe('string');
  expect(await page.evaluate(() => window.__dca!.money())).toBeGreaterThanOrEqual(0);
  errs.assertClean();
});

test('keyboard moves the player', async ({ page }) => {
  const errs = watchErrors(page);
  await startGame(page);
  const before = await player(page);
  await holdKey(page, 'd', 8);
  const after = await player(page);
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.5);
  errs.assertClean();
});

test('teleport moves the player', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.__dca!.teleport(430, 280));
  const p = await player(page);
  expect(p.x).toBeCloseTo(430, 1);
  expect(p.z).toBeCloseTo(280, 1);
});
