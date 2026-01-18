import { test, expect } from '@playwright/test';

test('loads main menu', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'DCA City 3D' })).toBeVisible();
});
