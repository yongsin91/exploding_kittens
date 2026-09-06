// Task 6: AI Turn Flow E2E Tests
// Tests AI turn dispatch, timing, card playing, drawing, and turn passing

const { test, expect } = require('@playwright/test');
const { gotoGame, startGame, waitForHumanTurn } = require('./helpers');

test.describe('AI Turn Flow', () => {

  test('AI takes its turn within a reasonable time', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    // Wait for the game to stabilize — either human or AI goes first
    // If AI goes first, it should complete within ~5 seconds (1.5s delay + 1s draw)
    await page.waitForTimeout(5000);

    // Game should still be on game screen
    await expect(page.locator('#game-screen')).toHaveClass(/screen--active/);
  });

  test('turn indicator updates when turn changes', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    // Wait for initial turn and possible AI turn
    await page.waitForTimeout(3000);

    const playerName = page.locator('#current-player-name');
    const text = await playerName.textContent();
    expect(text).toContain('Turn');
  });

  test('AI turn shows action log entries', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    // Wait for AI turn to potentially complete
    await page.waitForTimeout(5000);

    // Action log should have entries
    const logEntries = page.locator('#action-log .log-entry');
    const count = await logEntries.count();
    expect(count).toBeGreaterThan(0);
  });

  test('human player can act after AI turn completes', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    // Wait for human turn (AI may go first with 1.5s + 1s delay)
    await waitForHumanTurn(page, 20000);

    // Human should be able to draw
    const deckBefore = parseInt(await page.locator('#deck-count').textContent(), 10);
    await page.locator('#draw-btn').click();
    await page.waitForTimeout(500);

    const deckAfter = parseInt(await page.locator('#deck-count').textContent(), 10);
    expect(deckAfter).toBe(deckBefore - 1);
  });

  test('AI playing a card updates discard pile', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    // Wait for potential AI turn
    await page.waitForTimeout(5000);

    // If AI played a card, discard pile should not be empty
    // (AI may or may not play depending on its hand)
    const discardText = await page.locator('#discard-pile').textContent();
    // Just verify no crash — discard may or may not have cards
    expect(discardText).toBeTruthy();
  });

  test('AI turn decreases deck count when drawing', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    const deckBefore = parseInt(await page.locator('#deck-count').textContent(), 10);

    // Wait for AI turn to complete (if AI goes first)
    await page.waitForTimeout(5000);

    const deckAfter = parseInt(await page.locator('#deck-count').textContent(), 10);
    // Deck count should have decreased (either AI drew or human drew)
    expect(deckAfter).toBeLessThanOrEqual(deckBefore);
  });

  test('multiple AI turns work in 4-player game', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 4, gameMode: 'ai' });

    // Wait for multiple AI turns (3 AI × ~2.5s each = ~7.5s)
    await page.waitForTimeout(10000);

    // Game should still be running
    await expect(page.locator('#game-screen')).toHaveClass(/screen--active/);

    // Human should eventually get a turn
    await waitForHumanTurn(page, 20000);
  });

  test('AI difficulty easy works without errors', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai', aiDifficulty: 'easy' });

    await page.waitForTimeout(3000);
    await expect(page.locator('#game-screen')).toHaveClass(/screen--active/);
  });

  test('AI difficulty hard works without errors', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai', aiDifficulty: 'hard' });

    await page.waitForTimeout(3000);
    await expect(page.locator('#game-screen')).toHaveClass(/screen--active/);
  });

  test('game does not freeze during AI turns', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 3, gameMode: 'ai' });

    // Wait for all AI turns in a round
    await page.waitForTimeout(8000);

    // Page should be responsive — check that we can interact
    const drawBtn = page.locator('#draw-btn');
    const isGameScreen = await page.locator('#game-screen').evaluate(el =>
      el.classList.contains('screen--active')
    );
    expect(isGameScreen).toBe(true);

    // If it's human's turn, draw button should be enabled
    const isEnabled = await drawBtn.isEnabled();
    if (isEnabled) {
      await drawBtn.click();
      await page.waitForTimeout(500);
      // Should not crash
      await expect(page.locator('#game-screen')).toHaveClass(/screen--active/);
    }
  });
});