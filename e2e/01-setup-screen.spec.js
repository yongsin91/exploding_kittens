// Task 2: Setup Screen E2E Tests
// Tests the setup screen interactions: slider, mode toggle, difficulty, names, start

const { test, expect } = require('@playwright/test');
const { gotoGame } = require('./helpers');

test.describe('Setup Screen', () => {

  test.beforeEach(async ({ page }) => {
    await gotoGame(page);
  });

  test('setup screen is visible on page load', async ({ page }) => {
    await expect(page.locator('#setup-screen')).toHaveClass(/screen--active/);
    await expect(page.locator('#game-screen')).not.toHaveClass(/screen--active/);
    await expect(page.locator('#game-over-screen')).not.toHaveClass(/screen--active/);
  });

  test('title and subtitle are displayed', async ({ page }) => {
    await expect(page.locator('.setup-title')).toHaveText('Exploding Kittens');
    await expect(page.locator('.setup-subtitle')).toContainText('Card Game');
  });

  test('player count slider defaults to 2', async ({ page }) => {
    const slider = page.locator('#player-count-slider');
    await expect(slider).toHaveAttribute('min', '2');
    await expect(slider).toHaveAttribute('max', '5');
    await expect(slider).toHaveValue('2');
    await expect(page.locator('#player-count-display')).toHaveText('2');
  });

  test('player count slider updates display when changed', async ({ page }) => {
    const slider = page.locator('#player-count-slider');
    const display = page.locator('#player-count-display');

    // Change to 4
    await slider.fill('4');
    await slider.dispatchEvent('change');
    await expect(display).toHaveText('4');

    // Change to 5
    await slider.fill('5');
    await slider.dispatchEvent('change');
    await expect(display).toHaveText('5');

    // Change to 2
    await slider.fill('2');
    await slider.dispatchEvent('change');
    await expect(display).toHaveText('2');
  });

  test('player count slider updates name inputs', async ({ page }) => {
    const slider = page.locator('#player-count-slider');
    const container = page.locator('#player-names-container');

    // Default: 2 players → 2 inputs
    await expect(container.locator('input')).toHaveCount(2);

    // Change to 4
    await slider.fill('4');
    await slider.dispatchEvent('change');
    await expect(container.locator('input')).toHaveCount(4);

    // Change to 5
    await slider.fill('5');
    await slider.dispatchEvent('change');
    await expect(container.locator('input')).toHaveCount(5);

    // Back to 3
    await slider.fill('3');
    await slider.dispatchEvent('change');
    await expect(container.locator('input')).toHaveCount(3);
  });

  test('AI mode is active by default', async ({ page }) => {
    const aiBtn = page.locator('[data-mode="ai"]');
    const hotseatBtn = page.locator('[data-mode="hotseat"]');

    await expect(aiBtn).toHaveClass(/toggle-btn--active/);
    await expect(hotseatBtn).not.toHaveClass(/toggle-btn--active/);
    await expect(aiBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(hotseatBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('clicking Hot-Seat toggles mode', async ({ page }) => {
    const aiBtn = page.locator('[data-mode="ai"]');
    const hotseatBtn = page.locator('[data-mode="hotseat"]');

    await hotseatBtn.click();

    await expect(hotseatBtn).toHaveClass(/toggle-btn--active/);
    await expect(aiBtn).not.toHaveClass(/toggle-btn--active/);
    await expect(hotseatBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(aiBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('clicking AI mode toggles back from Hot-Seat', async ({ page }) => {
    const aiBtn = page.locator('[data-mode="ai"]');
    const hotseatBtn = page.locator('[data-mode="hotseat"]');

    // Switch to hotseat
    await hotseatBtn.click();
    await expect(hotseatBtn).toHaveClass(/toggle-btn--active/);

    // Switch back to AI
    await aiBtn.click();
    await expect(aiBtn).toHaveClass(/toggle-btn--active/);
    await expect(hotseatBtn).not.toHaveClass(/toggle-btn--active/);
  });

  test('AI difficulty selector is enabled in AI mode', async ({ page }) => {
    const difficultySelect = page.locator('#ai-difficulty');
    await expect(difficultySelect).toBeEnabled();
    await expect(difficultySelect).toHaveValue('medium');
  });

  test('AI difficulty selector is disabled in Hot-Seat mode', async ({ page }) => {
    const difficultySelect = page.locator('#ai-difficulty');

    // Switch to hotseat
    await page.locator('[data-mode="hotseat"]').click();

    await expect(difficultySelect).toBeDisabled();
  });

  test('AI difficulty can be changed', async ({ page }) => {
    const difficultySelect = page.locator('#ai-difficulty');

    await difficultySelect.selectOption('easy');
    await expect(difficultySelect).toHaveValue('easy');

    await difficultySelect.selectOption('hard');
    await expect(difficultySelect).toHaveValue('hard');

    await difficultySelect.selectOption('medium');
    await expect(difficultySelect).toHaveValue('medium');
  });

  test('player name inputs are rendered with default values', async ({ page }) => {
    const inputs = page.locator('#player-names-container input');

    // Default 2 players in AI mode: Player 1, AI-1
    await expect(inputs).toHaveCount(2);
    await expect(inputs.nth(0)).toHaveValue('Player 1');
    await expect(inputs.nth(1)).toHaveValue('AI-1');
  });

  test('player name inputs update when switching to Hot-Seat', async ({ page }) => {
    // Switch to hotseat
    await page.locator('[data-mode="hotseat"]').click();

    const inputs = page.locator('#player-names-container input');
    await expect(inputs).toHaveCount(2);

    // In hot-seat, all players are human
    await expect(inputs.nth(0)).toHaveValue('Player 1');
    await expect(inputs.nth(1)).toHaveValue('Player 2');
  });

  test('player name inputs can be edited', async ({ page }) => {
    const firstInput = page.locator('#player-names-container input').nth(0);

    await firstInput.fill('Alice');
    await expect(firstInput).toHaveValue('Alice');
  });

  test('start button transitions to game screen (AI mode, 2 players)', async ({ page }) => {
    await page.locator('#start-btn').click();
    await expect(page.locator('#game-screen')).toHaveClass(/screen--active/);
    await expect(page.locator('#setup-screen')).not.toHaveClass(/screen--active/);
  });

  test('start button transitions to game screen (Hot-Seat mode, 3 players)', async ({ page }) => {
    // Set to 3 players
    await page.locator('#player-count-slider').fill('3');
    await page.locator('#player-count-slider').dispatchEvent('change');

    // Switch to hotseat
    await page.locator('[data-mode="hotseat"]').click();

    // Start
    await page.locator('#start-btn').click();

    await expect(page.locator('#game-screen')).toHaveClass(/screen--active/);
  });

  test('start button works with 5 players in AI mode', async ({ page }) => {
    await page.locator('#player-count-slider').fill('5');
    await page.locator('#player-count-slider').dispatchEvent('change');

    await page.locator('#start-btn').click();

    await expect(page.locator('#game-screen')).toHaveClass(/screen--active/);
  });
});