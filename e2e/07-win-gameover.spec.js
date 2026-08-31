// Task 8: Win / Game Over E2E Tests
// Tests game over screen, winner display, and play again restart

const { test, expect } = require('@playwright/test');
const { gotoGame, startGame } = require('./helpers');

async function waitForHumanTurn(page, timeout = 20000) {
  await expect(page.locator('#draw-btn')).toBeEnabled({ timeout });
}

test.describe('Win / Game Over', () => {

  test('game over screen exists in DOM', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    const gameOverScreen = page.locator('#game-over-screen');
    await expect(gameOverScreen).toHaveCount(1);
    // Should not be active during gameplay
    await expect(gameOverScreen).not.toHaveClass(/screen--active/);
  });

  test('game over screen has winner text element', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    await expect(page.locator('#winner-text')).toHaveCount(1);
  });

  test('game over screen has play again button', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    await expect(page.locator('#play-again-btn')).toHaveCount(1);
    await expect(page.locator('#play-again-btn')).toHaveText('Play Again');
  });

  test('game over screen shows correct title', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    const title = page.locator('.game-over-title');
    await expect(title).toContainText('Game Over');
  });

  test('triggering game over shows winner text', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });
    await waitForHumanTurn(page);

    // Trigger game over by killing all but one player via game state
    await page.evaluate(() => {
      const state = window.GameState.getState();
      // Kill all AI players (make human the winner)
      state.players.forEach(p => {
        if (!p.isHuman) p.isAlive = false;
      });
      state.gamePhase = 'game-over';
      state.gameStatus = 'completed';
      window.GameState.setState(state);
    });

    // Game over screen should be visible
    await expect(page.locator('#game-over-screen')).toHaveClass(/screen--active/, { timeout: 5000 });
    await expect(page.locator('#game-screen')).not.toHaveClass(/screen--active/);

    // Winner text should show winner
    const winnerText = page.locator('#winner-text');
    await expect(winnerText).toContainText('wins');
    await expect(winnerText).toContainText('🏆');
  });

  test('game over with no winner shows Game Over text', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });
    await waitForHumanTurn(page);

    // Kill all players (no winner)
    await page.evaluate(() => {
      const state = window.GameState.getState();
      state.players.forEach(p => { p.isAlive = false; });
      state.gamePhase = 'game-over';
      state.gameStatus = 'completed';
      window.GameState.setState(state);
    });

    await expect(page.locator('#game-over-screen')).toHaveClass(/screen--active/, { timeout: 5000 });
    await expect(page.locator('#winner-text')).toHaveText('Game Over!');
  });

  test('clicking Play Again returns to setup screen', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });
    await waitForHumanTurn(page);

    // Trigger game over
    await page.evaluate(() => {
      const state = window.GameState.getState();
      state.players.forEach(p => { if (!p.isHuman) p.isAlive = false; });
      state.gamePhase = 'game-over';
      state.gameStatus = 'completed';
      window.GameState.setState(state);
    });

    await expect(page.locator('#game-over-screen')).toHaveClass(/screen--active/, { timeout: 5000 });

    // Click Play Again
    await page.locator('#play-again-btn').click();
    await page.waitForTimeout(1000);

    // Should be back at setup screen
    await expect(page.locator('#setup-screen')).toHaveClass(/screen--active/, { timeout: 5000 });
    await expect(page.locator('#game-over-screen')).not.toHaveClass(/screen--active/);
  });

  test('after Play Again, a new game can be started', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    // Wait for game to stabilize (don't depend on human turn)
    await page.waitForTimeout(3000);

    // Trigger game over
    await page.evaluate(() => {
      const state = window.GameState.getState();
      state.players.forEach(p => { if (!p.isHuman) p.isAlive = false; });
      state.gamePhase = 'game-over';
      state.gameStatus = 'completed';
      window.GameState.setState(state);
    });

    await expect(page.locator('#game-over-screen')).toHaveClass(/screen--active/, { timeout: 5000 });

    // Click Play Again
    await page.locator('#play-again-btn').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('#setup-screen')).toHaveClass(/screen--active/, { timeout: 5000 });

    // Start a new game
    await page.locator('#start-btn').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('#game-screen')).toHaveClass(/screen--active/, { timeout: 5000 });

    // Should have fresh hand of 5 cards
    const handCards = page.locator('#player-hand .card');
    await expect(handCards).toHaveCount(5);
  });

  test('game over screen is not visible during active gameplay', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 3, gameMode: 'ai' });

    // Wait for game to stabilize
    await page.waitForTimeout(3000);

    await expect(page.locator('#game-over-screen')).not.toHaveClass(/screen--active/);
    await expect(page.locator('#game-screen')).toHaveClass(/screen--active/);
  });

  test('winner name is displayed correctly', async ({ page }) => {
    await gotoGame(page);

    // Set a custom name for player 1
    await page.locator('#player-names-container input').nth(0).fill('Alice');
    await page.locator('#start-btn').click();
    await page.waitForTimeout(1000);
    await waitForHumanTurn(page);

    // Trigger game over with Alice as winner
    await page.evaluate(() => {
      const state = window.GameState.getState();
      state.players.forEach(p => { if (!p.isHuman) p.isAlive = false; });
      state.gamePhase = 'game-over';
      state.gameStatus = 'completed';
      window.GameState.setState(state);
    });

    await expect(page.locator('#game-over-screen')).toHaveClass(/screen--active/, { timeout: 5000 });
    await expect(page.locator('#winner-text')).toContainText('Alice');
  });
});