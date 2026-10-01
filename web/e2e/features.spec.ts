import { test, expect } from '@playwright/test';
import { watchErrors, startGame } from './helpers';

test('combat is parked: no attack buttons, combat HUD or weapon pickups', async ({ page }) => {
  const errs = watchErrors(page);
  await startGame(page);
  await expect(page.getByTestId('attack-buttons')).toHaveCount(0);
  await expect(page.getByText('Drop Weapon')).toHaveCount(0);
  await expect(page.getByText('Combat:')).toHaveCount(0);
  await expect(page.getByText(/100 \/ 100/)).toHaveCount(0);
  // Standing on a weapon spawn picks nothing up
  await page.evaluate(() => window.__dca!.teleport(80, 140));
  await page.waitForFunction(n => window.__dca!.frames() > n, await page.evaluate(() => window.__dca!.frames() + 4));
  await expect(page.getByText(/Picked up/)).toHaveCount(0);
  errs.assertClean();
});

test('?combat=1 brings combat back for a session', async ({ page }) => {
  await page.goto('/?combat=1');
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.getByRole('button', { name: /enter 3d city/i }).click();
  await expect(page.getByTestId('attack-buttons')).toHaveCount(1);
});
