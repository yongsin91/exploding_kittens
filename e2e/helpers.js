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

/**
 * Wait for the human player's turn (draw button enabled).
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout=20000]
 */
async function waitForHumanTurn(page, timeout = 20000) {
  await expect(page.locator('#draw-btn')).toBeEnabled({ timeout });
}

/**
 * Get the current player index from game state.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
async function getCurrentPlayerIndex(page) {
  return await page.evaluate(() => window.GameState.getState().currentPlayerIndex);
}

/**
 * Get the current turn phase from game state.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
async function getTurnPhase(page) {
  return await page.evaluate(() => window.GameState.getState().turnPhase);
}

/**
 * Get a snapshot of the game state for testing.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<object>}
 */
async function getGameState(page) {
  return await page.evaluate(() => {
    const s = window.GameState.getState();
    return {
      currentPlayerIndex: s.currentPlayerIndex,
      turnPhase: s.turnPhase,
      drawPileLength: s.drawPile.length,
      discardPileLength: s.discardPile.length,
      isAttackActive: s.attackTurnsRemaining > 0 || (s.pendingAttackForNext || 0) > 0,
      attackTurnsRemaining: s.attackTurnsRemaining,
      pendingAttackForNext: s.pendingAttackForNext || 0,
      activeModal: s.activeModal,
      playerCount: s.players.length,
      aliveCount: s.players.filter(p => p.isAlive).length,
      players: s.players.map(p => ({
        id: p.id,
        name: p.name,
        isAlive: p.isAlive,
        isAI: p.isAI,
        handLength: p.hand.length,
        handTypes: p.hand.map(c => c.type)
      }))
    };
  });
}

/**
 * Set up a controlled game state for testing.
 * Gives the human player specific cards and sets a known deck.
 * @param {import('@playwright/test').Page} page
 * @param {object} options
 * @param {string[]} [options.handCards] - Card types for human player's hand
 * @param {string[]} [options.deckCards] - Card types for draw pile
 * @param {number} [options.playerCount=2]
 * @param {string} [options.gameMode='ai']
 */
async function setupControlledGame(page, options = {}) {
  const {
    handCards = ['skip', 'attack', 'favor', 'shuffle', 'see_the_future'],
    deckCards = [],
    playerCount = 2,
    gameMode = 'ai'
  } = options;

  await gotoGame(page);
  await startGame(page, { playerCount, gameMode });
  await waitForHumanTurn(page);

  await page.evaluate((opts) => {
    window.GameState.mutate(function(state) {
      const humanPlayer = state.players.find(p => p.isHuman);
      if (humanPlayer) {
        state.currentPlayerIndex = humanPlayer.id;
      }

      const hand = opts.handCards.map((type, i) => {
        const def = window.CARD_TYPES[type];
        return {
          instanceId: 'test-card-' + i,
          type: type,
          emoji: def.emoji,
          name: def.name,
          cornerIcon: def.cornerIcon || null
        };
      });

      state.players[state.currentPlayerIndex].hand = hand;

      if (opts.deckCards.length > 0) {
        state.drawPile = opts.deckCards.map((type, i) => {
          const def = window.CARD_TYPES[type];
          return {
            instanceId: 'deck-card-' + i,
            type: type,
            emoji: def.emoji,
            name: def.name,
            cornerIcon: def.cornerIcon || null
          };
        });
      }

      state.turnPhase = 'action';
      state.activeModal = null;
      state.nopeWindowActive = false;
    });
    window.UIRenderer.forceRender();
  }, { handCards, deckCards });

  await page.waitForTimeout(300);
}

/**
 * Dismiss the nope modal if it appears (clicks 'Let It Happen').
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout=5000]
 */
async function dismissNopeIfPresent(page, timeout = 5000) {
  const nopeModal = page.locator('#nope-modal');
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const isActive = await nopeModal.evaluate(el => el.classList.contains('modal--active')).catch(() => false);
    if (isActive) {
      const letItBtn = page.locator('#nope-no-btn');
      if (await letItBtn.isVisible()) {
        await letItBtn.click();
        await page.waitForTimeout(300);
      }
      break;
    }
    await page.waitForTimeout(200);
  }
}

/**
 * Get hand card types for the current player.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
async function getHandCardTypes(page) {
  const cards = page.locator('#player-hand .card');
  const count = await cards.count();
  const types = [];
  for (let i = 0; i < count; i++) {
    const type = await cards.nth(i).getAttribute('data-card-type');
    if (type) types.push(type);
  }
  return types;
}

/**
 * Get the current player's name.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
async function getCurrentPlayerName(page) {
  return await page.locator('#current-player-name').textContent();
}

module.exports = {
  BASE_URL,
  gotoGame,
  startGame,
  waitForHumanTurn,
  getCurrentPlayerIndex,
  getTurnPhase,
  getGameState,
  setupControlledGame,
  dismissNopeIfPresent,
  getHandCardTypes,
  getCurrentPlayerName
};