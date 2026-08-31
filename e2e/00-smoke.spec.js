// Smoke test — verify Playwright can load the game page
const { test, expect } = require('@playwright/test');
const { gotoGame } = require('./helpers');

test('page loads and shows setup screen', async ({ page }) => {
  await gotoGame(page);
  await expect(page.locator('#setup-screen')).toBeVisible();
  await expect(page.locator('.setup-title')).toHaveText('Exploding Kittens');
});