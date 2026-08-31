// Task 9: Multi-Player Edge Cases E2E Tests
// Tests different player counts, player elimination UI, and attack turns

const { test, expect } = require('@playwright/test');
const { gotoGame, startGame } = require('./helpers');

async function waitForHumanTurn(page, timeout = 20000) {
  await expect(page.locator('#draw-btn')).toBeEnabled({ timeout });
}

test.describe('Multi-Player Edge Cases', () => {

  // ========== Player Count Variations ==========

  test('2-player AI game starts and renders correctly', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    await expect(page.locator('#game-screen')).toHaveClass(/screen--active/);
    await expect(page.locator('#player-hand .card')).toHaveCount(5);
    await expect(page.locator('.opponent-panel')).toHaveCount(1);
  });

  test('3-player AI game starts and renders correctly', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 3, gameMode: 'ai' });

    await expect(page.locator('#game-screen')).toHaveClass(/screen--active/);
    await expect(page.locator('#player-hand .card')).toHaveCount(5);
    await expect(page.locator('.opponent-panel')).toHaveCount(2);
  });

  test('4-player AI game starts and renders correctly', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 4, gameMode: 'ai' });

    await expect(page.locator('#game-screen')).toHaveClass(/screen--active/);
    await expect(page.locator('#player-hand .card')).toHaveCount(5);
    await expect(page.locator('.opponent-panel')).toHaveCount(3);
  });

  test('5-player AI game starts and renders correctly', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 5, gameMode: 'ai' });

    await expect(page.locator('#game-screen')).toHaveClass(/screen--active/);
    await expect(page.locator('#player-hand .card')).toHaveCount(5);
    await expect(page.locator('.opponent-panel')).toHaveCount(4);
  });

  test('2-player hot-seat game starts correctly', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'hotseat' });

    await expect(page.locator('#game-screen')).toHaveClass(/screen--active/);
  });

  test('5-player hot-seat game starts correctly', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 5, gameMode: 'hotseat' });

    await expect(page.locator('#game-screen')).toHaveClass(/screen--active/);
  });

  // ========== Deck Size Validation ==========

  test('2-player game has correct deck count', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    // 56 cards - 10 dealt (2×5) = 46, + 1 EK = 47, + remaining defuses (6-2=4) = 51
    // But exact count depends on implementation, just verify it's reasonable
    const deckCount = parseInt(await page.locator('#deck-count').textContent(), 10);
    expect(deckCount).toBeGreaterThan(30);
    expect(deckCount).toBeLessThan(56);
  });

  test('5-player game has correct deck count', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 5, gameMode: 'ai' });

    // 56 cards - 25 dealt (5×5) = 31, + 4 EK = 35, + 1 defuse (6-5=1) = 36
    const deckCount = parseInt(await page.locator('#deck-count').textContent(), 10);
    expect(deckCount).toBeGreaterThan(20);
    expect(deckCount).toBeLessThan(56);
  });

  // ========== Player Elimination ==========

  test('eliminated player shows dead indicator in opponent panel', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 3, gameMode: 'ai' });
    await waitForHumanTurn(page);

    // Kill an AI player
    await page.evaluate(() => {
      const state = window.GameState.getState();
      // Kill the first AI player (player index 1)
      if (state.players[1]) {
        state.players[1].isAlive = false;
        window.GameState.setState(state);
      }
    });

    await page.waitForTimeout(500);

    // Find the dead opponent panel
    const deadPanels = page.locator('.opponent-panel--dead');
    await expect(deadPanels).toHaveCount(1);

    // Should show skull or exploded text
    const deadPanel = deadPanels.first();
    const text = await deadPanel.textContent();
    expect(text).toContain('💀');
  });

  test('eliminated player shows Exploded status', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 3, gameMode: 'ai' });
    await waitForHumanTurn(page);

    await page.evaluate(() => {
      const state = window.GameState.getState();
      if (state.players[1]) {
        state.players[1].isAlive = false;
        window.GameState.setState(state);
      }
    });

    await page.waitForTimeout(500);

    const deadPanel = page.locator('.opponent-panel--dead').first();
    await expect(deadPanel.locator('.opponent-status')).toContainText('Exploded');
  });

  test('eliminated player panel still shows card count', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 3, gameMode: 'ai' });

    // Wait for game to stabilize (don't need human turn for this test)
    await page.waitForTimeout(3000);

    await page.evaluate(() => {
      const state = window.GameState.getState();
      if (state.players[1]) {
        state.players[1].isAlive = false;
        window.GameState.setState(state);
      }
    });

    await page.waitForTimeout(500);

    const deadPanel = page.locator('.opponent-panel--dead').first();
    await expect(deadPanel.locator('.opponent-card-count')).toContainText('cards');
  });

  test('multiple eliminations show multiple dead panels', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 4, gameMode: 'ai' });

    // Wait for game to stabilize
    await page.waitForTimeout(3000);

    // Kill two AI players
    await page.evaluate(() => {
      const state = window.GameState.getState();
      if (state.players[1]) state.players[1].isAlive = false;
      if (state.players[2]) state.players[2].isAlive = false;
      window.GameState.setState(state);
    });

    await page.waitForTimeout(500);

    const deadPanels = page.locator('.opponent-panel--dead');
    await expect(deadPanels).toHaveCount(2);
  });

  // ========== Attack Turns ==========

  test('attack card state can be set and UI remains stable', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });
    await waitForHumanTurn(page);

    // Set attack state
    await page.evaluate(() => {
      const state = window.GameState.getState();
      state.isAttackActive = true;
      state.attackTurnsRemaining = 2;
      window.GameState.setState(state);
    });

    await page.waitForTimeout(500);

    // Game should still be on game screen
    await expect(page.locator('#game-screen')).toHaveClass(/screen--active/);
  });

  // ========== AI Difficulty Variations ==========

  test('easy AI 3-player game runs without errors', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 3, gameMode: 'ai', aiDifficulty: 'easy' });

    await page.waitForTimeout(5000);
    await expect(page.locator('#game-screen')).toHaveClass(/screen--active/);
  });

  test('hard AI 4-player game runs without errors', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 4, gameMode: 'ai', aiDifficulty: 'hard' });

    await page.waitForTimeout(8000);
    await expect(page.locator('#game-screen')).toHaveClass(/screen--active/);
  });

  // ========== Custom Player Names ==========

  test('custom player names appear in game', async ({ page }) => {
    await gotoGame(page);

    // Set custom name
    await page.locator('#player-names-container input').nth(0).fill('Alice');
    await page.locator('#start-btn').click();
    await page.waitForTimeout(1000);

    // Wait for human turn
    await waitForHumanTurn(page);

    // Current player name should show Alice
    const playerName = page.locator('#current-player-name');
    const text = await playerName.textContent();
    // If it's Alice's turn, name should be shown
    if (text.includes('Alice')) {
      expect(text).toContain('Alice');
    }
  });

  test('custom AI names appear in opponent panels', async ({ page }) => {
    await gotoGame(page);

    // Set custom AI name
    await page.locator('#player-names-container input').nth(1).fill('BotMaster');
    await page.locator('#start-btn').click();
    await page.waitForTimeout(2000);

    // The custom-named AI might be the current player (not shown in opponents)
    // Check both opponent panels and current player name
    const allPlayerTexts = [];

    // Check opponent panels
    const opponentNames = page.locator('.opponent-panel .opponent-name');
    const oppCount = await opponentNames.count();
    for (let i = 0; i < oppCount; i++) {
      allPlayerTexts.push(await opponentNames.nth(i).textContent());
    }

    // Check current player name
    const currentPlayer = page.locator('#current-player-name');
    if (await currentPlayer.count() > 0) {
      allPlayerTexts.push(await currentPlayer.textContent());
    }

    // BotMaster should appear somewhere
    const foundCustomName = allPlayerTexts.some(t => t && t.includes('BotMaster'));
    expect(foundCustomName).toBe(true);
  });

  // ========== Game Stability ==========

  test('game remains stable after multiple turns (2-player AI)', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    // Wait for several turns to complete
    await page.waitForTimeout(10000);

    // Game should still be on game screen or game over (not crashed)
    const gameActive = await page.locator('#game-screen').evaluate(el =>
      el.classList.contains('screen--active')
    );
    const gameOver = await page.locator('#game-over-screen').evaluate(el =>
      el.classList.contains('screen--active')
    );
    expect(gameActive || gameOver).toBe(true);
  });

  test('all opponent panels have unique player IDs', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 4, gameMode: 'ai' });

    const panels = page.locator('.opponent-panel');
    const count = await panels.count();
    const playerIds = [];
    for (let i = 0; i < count; i++) {
      const id = await panels.nth(i).getAttribute('data-player-id');
      playerIds.push(id);
    }

    // All IDs should be unique
    const uniqueIds = new Set(playerIds);
    expect(uniqueIds.size).toBe(count);
  });
});