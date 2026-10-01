import { expect, type Page } from '@playwright/test';

/** Collects page errors and console errors; call assertClean() at the end of a test. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  return {
    errors,
    assertClean: () => expect(errors, errors.join('\n')).toEqual([]),
  };
}

/** Menu -> character creator -> in game, then wait until the first frames have rendered. */
export async function startGame(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.getByRole('button', { name: /enter 3d city/i }).click();
  await waitForFrames(page, 3);
}

export async function waitForFrames(page: Page, count: number) {
  const start = await page.evaluate(() => window.__dca?.frames() ?? 0);
  await page.waitForFunction(
    target => (window.__dca?.frames() ?? 0) >= target,
    start + count,
    { timeout: 60_000 }
  );
}

export async function player(page: Page) {
  return page.evaluate(() => window.__dca!.player());
}

/** Holds a key until at least `frames` frames have rendered (robust to slow software GL). */
export async function holdKey(page: Page, key: string, frames = 6) {
  await page.keyboard.down(key);
  await waitForFrames(page, frames);
  await page.keyboard.up(key);
}
