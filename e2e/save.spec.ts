import { test, expect } from '@playwright/test';
import { watchErrors, startGame, player, waitForFrames, holdKey } from './helpers';

test('progress survives a reload: position, money and placed blocks', async ({ page }) => {
  const errs = watchErrors(page);
  await startGame(page);

  // Open land in Mayfair, away from streets
  await page.evaluate(() => window.__dca!.teleport(300, 330));
  await waitForFrames(page, 2);
  expect(await page.evaluate(() => window.__dca!.groundZone())).toBe('open_landscape');

  // Build one wall a few metres ahead of the player
  await page.keyboard.press('b');
  await waitForFrames(page, 3);
  await page.mouse.move(640, 200);
  await waitForFrames(page, 2);
  await page.mouse.click(640, 200);
  await expect.poll(() => page.evaluate(() => window.__dca!.blocks())).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__dca!.money())).toBe(90);
  await page.keyboard.press('b');

  // Walk a little so the saved position isn't the teleport target
  await holdKey(page, 'd', 6);
  const before = await player(page);
  expect(before.x).toBeGreaterThan(300.3);

  await page.reload(); // pagehide autosaves
  await page.getByRole('button', { name: 'Continue' }).click();
  await waitForFrames(page, 3);
  const after = await player(page);
  expect(after.x).toBeCloseTo(before.x, 1);
  expect(after.z).toBeCloseTo(before.z, 1);
  expect(await page.evaluate(() => window.__dca!.blocks())).toBe(1);
  expect(await page.evaluate(() => window.__dca!.money())).toBe(90);
  errs.assertClean();
});

test('New Game replaces the old save instead of restoring it', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.__dca!.teleport(300, 330));
  await page.evaluate(() => window.__dca!.save());
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await page.getByRole('button', { name: 'New Game' }).click();
  await page.getByRole('button', { name: /enter 3d city/i }).click();
  await waitForFrames(page, 2);
  expect(await page.evaluate(() => window.__dca!.groundZone())).toBe('clear_walk');
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await waitForFrames(page, 2);
  const p = await player(page);
  expect(Math.hypot(p.x - 300, p.z - 330)).toBeGreaterThan(20);
});

test('a corrupt save is set aside instead of crashing', async ({ page }) => {
  const errs = watchErrors(page);
  await page.goto('/');
  await page.evaluate(() => window.localStorage.setItem('dca-save', '{oops'));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start Game' })).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem('dca-save-corrupt'))).toBe('{oops');
  errs.assertClean();
});
