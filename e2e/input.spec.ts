import { test, expect, type Page } from '@playwright/test';
import { watchErrors, startGame, player, waitForFrames } from './helpers';

test.use({ hasTouch: true });

async function touch(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: Array<{ x: number; y: number; id?: number }>) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map(p => ({ x: p.x, y: p.y, id: p.id ?? 1 })),
    });
  return { send };
}

test('joystick moves the player from the first frame, with no other UI interaction', async ({ page }) => {
  const errs = watchErrors(page);
  await startGame(page);
  const box = (await page.getByTestId('joystick').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const before = await player(page);
  const t = await touch(page);
  await t.send('touchStart', [{ x: cx, y: cy }]);
  await t.send('touchMove', [{ x: cx + 60, y: cy }]);
  await waitForFrames(page, 8);
  await t.send('touchEnd', []);
  const after = await player(page);
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.5);
  errs.assertClean();
});

test('one-finger drag on the canvas orbits the camera', async ({ page }) => {
  await startGame(page);
  const before = await page.evaluate(() => window.__dca!.camera());
  const t = await touch(page);
  await t.send('touchStart', [{ x: 640, y: 300 }]);
  for (let i = 1; i <= 5; i++) await t.send('touchMove', [{ x: 640 + i * 30, y: 300 }]);
  await t.send('touchEnd', []);
  const after = await page.evaluate(() => window.__dca!.camera());
  expect(Math.abs(after.theta - before.theta)).toBeGreaterThan(0.3);
});

test('releasing W while Shift is held stops the player', async ({ page }) => {
  await startGame(page);
  await page.keyboard.down('w');
  await waitForFrames(page, 4);
  await page.keyboard.down('Shift');
  await waitForFrames(page, 2);
  await page.keyboard.up('w');
  await page.keyboard.up('Shift');
  await waitForFrames(page, 12);
  const a = await player(page);
  await waitForFrames(page, 6);
  const b = await player(page);
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.05);
});
