// Shared helpers for Exploding Kittens E2E tests

const { expect } = require('@playwright/test');

const BASE_URL = 'file:///home/yongsin91/projects/exploding_kittens/index.html';

/**
 * Navigate to the game page and wait for it to load.
 * @param {import('@playwright/test').Page} page
 */
async function gotoGame(page) {
  await page.goto(BASE_URL);
  await page.waitForSelector('#setup-screen.screen--active');
  return page;
}

/**
 * Start a game with the given options by interacting with the setup screen.
 * @param {import('@playwright/test').Page} page
 * @param {object} options
 * @param {number} [options.playerCount=2] - Number of players (2-5)
 * @param {string} [options.gameMode='ai'] - 'ai' or 'hotseat'
 * @param {string} [options.aiDifficulty='medium'] - 'easy', 'medium', 'hard'
 */
async function startGame(page, options = {}) {
  const { playerCount = 2, gameMode = 'ai', aiDifficulty = 'medium' } = options;

  // Set player count via slider
  const slider = page.locator('#player-count-slider');
  await slider.fill(String(playerCount));
  // Trigger change event
  await slider.dispatchEvent('change');

  // Wait for player count display to update
  await expect(page.locator('#player-count-display')).toHaveText(String(playerCount));

  // Set game mode
  if (gameMode === 'hotseat') {
    await page.locator('[data-mode="hotseat"]').click();
  } else {
    await page.locator('[data-mode="ai"]').click();
  }

  // Set AI difficulty (only in AI mode)
  if (gameMode === 'ai') {
    await page.locator('#ai-difficulty').selectOption(aiDifficulty);
  }

  // Click start button
  await page.locator('#start-btn').click();

  // Wait for game screen to appear
  await page.waitForSelector('#game-screen.screen--active', { timeout: 5000 });
}

module.exports = { BASE_URL, gotoGame, startGame };