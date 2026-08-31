// Task 3: Game Screen Initial State E2E Tests
// Verifies the game screen renders correctly after starting a game

const { test, expect } = require('@playwright/test');
const { gotoGame, startGame } = require('./helpers');

test.describe('Game Screen — Initial State', () => {

  test('game screen is visible after starting a 2-player AI game', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    await expect(page.locator('#game-screen')).toHaveClass(/screen--active/);
    await expect(page.locator('#setup-screen')).not.toHaveClass(/screen--active/);
  });

  test('deck count displays correct number after game start', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    // 2 players: 56-card deck - 5 dealt (2×5) + 1 EK + remaining defuses
    // Deck should have cards remaining (not 0)
    const deckCount = page.locator('#deck-count');
    await expect(deckCount).not.toHaveText('0');
    const count = parseInt(await deckCount.textContent(), 10);
    expect(count).toBeGreaterThan(0);
  });

  test('player hand renders 5 cards after game start', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    // Each player starts with 5 cards (4 + 1 defuse)
    const handCards = page.locator('#player-hand .card');
    await expect(handCards).toHaveCount(5);
  });

  test('opponent panels render for non-current players (2-player AI)', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    // 2 players: 1 opponent panel (current player is excluded)
    const opponents = page.locator('.opponent-panel');
    await expect(opponents).toHaveCount(1);
  });

  test('opponent panels render for 4-player AI game', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 4, gameMode: 'ai' });

    // 4 players: 3 opponent panels
    const opponents = page.locator('.opponent-panel');
    await expect(opponents).toHaveCount(3);
  });

  test('opponent panel shows AI indicator', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    const opponentName = page.locator('.opponent-panel .opponent-name');
    await expect(opponentName).toContainText('🤖');
  });

  test('opponent panel shows card count', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    const cardCount = page.locator('.opponent-panel .opponent-card-count');
    await expect(cardCount).toContainText('5 cards');
  });

  test('current player name is displayed', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    const playerName = page.locator('#current-player-name');
    await expect(playerName).toContainText('Turn');
  });

  test('draw button is enabled on human player turn', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    // If human player goes first, draw should be enabled
    // If AI goes first, we need to wait for human turn
    const drawBtn = page.locator('#draw-btn');
    // Wait up to 10s for draw button to be enabled (AI turn may need to complete first)
    await expect(drawBtn).toBeEnabled({ timeout: 15000 });
  });

  test('end turn button is enabled in draw phase (can end turn without playing)', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    // End turn should be enabled during draw phase (player can end turn by drawing)
    const endTurnBtn = page.locator('#end-turn-btn');
    await expect(endTurnBtn).toBeEnabled({ timeout: 15000 });
  });

  test('discard pile shows empty initially', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    const discardPile = page.locator('#discard-pile');
    await expect(discardPile).toContainText('Empty');
  });

  test('action log has entries after game start', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    const logEntries = page.locator('#action-log .log-entry');
    await expect(logEntries.first()).toBeVisible({ timeout: 5000 });
    const count = await logEntries.count();
    expect(count).toBeGreaterThan(0);
  });

  test('no modals are visible at game start', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    const activeModals = page.locator('.modal.modal--active');
    await expect(activeModals).toHaveCount(0);
  });

  test('hand cards have correct data attributes', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    const firstCard = page.locator('#player-hand .card').first();
    await expect(firstCard).toHaveAttribute('data-instance-id');
    await expect(firstCard).toHaveAttribute('data-card-type');
  });

  test('hand cards display emoji and name', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    const firstCard = page.locator('#player-hand .card').first();
    await expect(firstCard.locator('.card-emoji')).toBeVisible();
    await expect(firstCard.locator('.card-name')).toBeVisible();
    const name = await firstCard.locator('.card-name').textContent();
    expect(name.length).toBeGreaterThan(0);
  });

  test('5-player AI game renders 4 opponent panels', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 5, gameMode: 'ai' });

    const opponents = page.locator('.opponent-panel');
    await expect(opponents).toHaveCount(4);
  });

  test('hot-seat 3-player game renders 2 opponent panels', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 3, gameMode: 'hotseat' });

    const opponents = page.locator('.opponent-panel');
    await expect(opponents).toHaveCount(2);
  });
});