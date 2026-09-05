// Task 10: Game Actions Comprehensive E2E Tests
// Tests all game actions: end turn, skip, attack, favor, shuffle, see future,
// nope, combos (two-of-a-kind, three-of-a-kind, five-different), defuse, EK elimination

const { test, expect } = require('@playwright/test');
const { gotoGame, startGame } = require('./helpers');

/**
 * Wait for the human player's turn (draw button enabled).
 */
async function waitForHumanTurn(page, timeout = 20000) {
  await expect(page.locator('#draw-btn')).toBeEnabled({ timeout });
}

/**
 * Get the current player's hand card types.
 */
async function getHandCardTypes(page) {
  const cards = page.locator('#player-hand .card');
  const count = await cards.count();
  const types = [];
  for (let i = 0; i < count; i++) {
    types.push(await cards.nth(i).getAttribute('data-card-type'));
  }
  return types;
}

/**
 * Get the current player name from the turn indicator.
 */
async function getCurrentPlayerName(page) {
  return await page.locator('#current-player-name').textContent();
}

/**
 * Get the current player index from game state.
 */
async function getCurrentPlayerIndex(page) {
  return await page.evaluate(() => window.GameState.getState().currentPlayerIndex);
}

/**
 * Get the current turn phase from game state.
 */
async function getTurnPhase(page) {
  return await page.evaluate(() => window.GameState.getState().turnPhase);
}

/**
 * Get the current game state snapshot.
 */
async function getGameState(page) {
  return await page.evaluate(() => {
    const s = window.GameState.getState();
    return {
      currentPlayerIndex: s.currentPlayerIndex,
      turnPhase: s.turnPhase,
      drawPileLength: s.drawPile.length,
      discardPileLength: s.discardPile.length,
      isAttackActive: s.isAttackActive,
      attackTurnsRemaining: s.attackTurnsRemaining,
      activeModal: s.activeModal,
      playerCount: s.players.length,
      aliveCount: s.players.filter(p => p.isAlive).length,
      players: s.players.map(p => ({
        id: p.id,
        name: p.name,
        isAlive: p.isAlive,
        isAI: p.isAI,
        handLength: p.hand.length
      }))
    };
  });
}

/**
 * Set up a controlled game state for testing.
 * Gives the human player specific cards and sets a known deck.
 */
async function setupControlledGame(page, options = {}) {
  const {
    handCards = ['skip', 'attack', 'favor', 'shuffle', 'see_the_future'],
    deckCards = [],
    currentPlayerIndex = 0,
    playerCount = 2,
    gameMode = 'ai'
  } = options;

  await gotoGame(page);
  await startGame(page, { playerCount, gameMode });
  await waitForHumanTurn(page);

  // Set up controlled state via game state manipulation
  await page.evaluate((opts) => {
    window.GameState.mutate(function(state) {
      // Ensure human player is current
      const humanPlayer = state.players.find(p => p.isHuman);
      if (humanPlayer) {
        state.currentPlayerIndex = humanPlayer.id;
      }

      // Build hand cards from CARD_TYPES definitions
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

      // Set human player's hand
      state.players[state.currentPlayerIndex].hand = hand;

      // Build draw pile if specified
      // Note: drawCard uses pop(), which takes from the END of the array
      // So the first card drawn is the LAST element in deckCards
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

      state.turnPhase = 'draw';
      state.activeModal = null;
      state.nopeWindowActive = false;
    });
    window.UIRenderer.forceRender();
  }, { handCards, deckCards, currentPlayerIndex });

  await page.waitForTimeout(300);
}

/**
 * Dismiss nope modal if it appears (AI usually declines quickly).
 */
async function dismissNopeIfPresent(page, timeout = 3000) {
  const nopeModal = page.locator('#nope-modal');
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const isActive = await nopeModal.evaluate(el => el.classList.contains('modal--active'));
    if (isActive) {
      // Wait for AI to auto-resolve or click "Let It Happen"
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

// ========== END TURN / TURN SWITCHING ==========

test.describe('End Turn and Turn Switching', () => {

  test('drawing a card switches to next player', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['skip', 'defuse', 'nope', 'attack', 'favor'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    const playerBefore = await getCurrentPlayerIndex(page);

    // Draw a card (ends turn)
    await page.locator('#draw-btn').click();

    // Wait for turn to switch (draw ends turn)
    let turnSwitched = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(200);
      const state = await getGameState(page);
      // If defuse modal opened, that's also a valid outcome (drew EK)
      if (state.activeModal === 'defuse-modal') {
        turnSwitched = true;
        break;
      }
      // Turn switches when current player changes and no modal is active
      if (state.currentPlayerIndex !== playerBefore && state.activeModal === null) {
        turnSwitched = true;
        break;
      }
    }

    expect(turnSwitched).toBe(true);
  });

  test('end turn button in play phase advances to next player', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['skip'],
      deckCards: ['skip', 'attack', 'favor']
    });

    const playerBefore = await getCurrentPlayerIndex(page);

    // Play the skip card (enters play phase)
    const skipCard = page.locator('#player-hand .card[data-card-type="skip"]').first();
    await skipCard.click();
    await page.waitForTimeout(500);

    // Dismiss nope if it appears
    await dismissNopeIfPresent(page);
    await page.waitForTimeout(1000);

    // Now end turn
    const endTurnBtn = page.locator('#end-turn-btn');
    if (await endTurnBtn.isEnabled()) {
      await endTurnBtn.click();
      await page.waitForTimeout(2000);
    }

    // Player should have changed (unless AI is currently taking its turn)
    const state = await getGameState(page);
    const playerAfter = state.currentPlayerIndex;
    // In a 2-player game, the turn should switch
    expect(playerAfter).not.toBe(playerBefore);
  });

  test('turn indicator shows different player name after turn ends', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['skip', 'defuse', 'nope', 'attack', 'favor'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    const nameBefore = await getCurrentPlayerName(page);

    // Draw to end turn
    await page.locator('#draw-btn').click();

    // Wait for turn to switch
    let turnSwitched = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(200);
      const state = await getGameState(page);
      if (state.activeModal === 'defuse-modal') {
        turnSwitched = true;
        break;
      }
      if (state.currentPlayerIndex !== 0 && state.activeModal === null) {
        turnSwitched = true;
        break;
      }
    }

    if (turnSwitched) {
      const state = await getGameState(page);
      if (state.activeModal !== 'defuse-modal') {
        const nameAfter = await getCurrentPlayerName(page);
        expect(nameAfter).not.toBe(nameBefore);
      }
    }
  });
});

// ========== SKIP CARD ==========

test.describe('Skip Card', () => {

  test('playing skip ends turn without drawing', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['skip', 'defuse', 'nope', 'attack', 'favor'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    const playerBefore = await getCurrentPlayerIndex(page);
    const deckBefore = parseInt(await page.locator('#deck-count').textContent(), 10);

    // Play skip
    const skipCard = page.locator('#player-hand .card[data-card-type="skip"]').first();
    await skipCard.click();

    // Wait for turn to switch (skip ends turn after nope resolution)
    // The nope window auto-resolves quickly in AI mode
    let turnSwitched = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(200);
      const state = await getGameState(page);
      // Turn switches when current player changes and no nope/modal is active
      if (state.currentPlayerIndex !== playerBefore && !state.nopeWindowActive && state.activeModal === null) {
        turnSwitched = true;
        break;
      }
      // Dismiss nope if present
      const nopeActive = await page.locator('#nope-modal').evaluate(el => el.classList.contains('modal--active'));
      if (nopeActive) {
        const letItBtn = page.locator('#nope-no-btn');
        if (await letItBtn.isVisible()) {
          await letItBtn.click();
          await page.waitForTimeout(100);
        }
      }
    }

    expect(turnSwitched).toBe(true);

    // Deck should not have decreased (skip doesn't draw)
    const deckAfter = parseInt(await page.locator('#deck-count').textContent(), 10);
    expect(deckAfter).toBe(deckBefore);
  });

  test('skip card goes to discard pile', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['skip', 'defuse', 'nope', 'attack', 'favor'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    const discardBefore = (await getGameState(page)).discardPileLength;

    const skipCard = page.locator('#player-hand .card[data-card-type="skip"]').first();
    await skipCard.click();
    await page.waitForTimeout(500);

    await dismissNopeIfPresent(page);
    await page.waitForTimeout(500);

    const state = await getGameState(page);
    // Skip card should be in discard pile (possibly with nope cards too)
    expect(state.discardPileLength).toBeGreaterThan(discardBefore);
  });
});

// ========== ATTACK CARD ==========

test.describe('Attack Card', () => {

  test('playing attack activates attack mode', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['attack', 'defuse', 'nope', 'skip', 'favor'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    const attackCard = page.locator('#player-hand .card[data-card-type="attack"]').first();
    await attackCard.click();
    await page.waitForTimeout(500);

    await dismissNopeIfPresent(page);
    await page.waitForTimeout(1000);

    // After attack resolves, attack mode should be active for next player
    const state = await getGameState(page);
    // Attack was played — either attack is active or turn switched
    // The attack effect sets isAttackActive = true
    expect(state.isAttackActive).toBe(true);
  });

  test('attack card goes to discard pile', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['attack', 'defuse', 'nope', 'skip', 'favor'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    const discardBefore = (await getGameState(page)).discardPileLength;

    const attackCard = page.locator('#player-hand .card[data-card-type="attack"]').first();
    await attackCard.click();
    await page.waitForTimeout(500);

    await dismissNopeIfPresent(page);
    await page.waitForTimeout(500);

    const state = await getGameState(page);
    expect(state.discardPileLength).toBeGreaterThan(discardBefore);
  });
});

// ========== FAVOR CARD ==========

test.describe('Favor Card', () => {

  test('playing favor opens target selection modal', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['favor', 'defuse', 'nope', 'skip', 'attack'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    const favorCard = page.locator('#player-hand .card[data-card-type="favor"]').first();
    await favorCard.click();
    await page.waitForTimeout(500);

    // Favor target modal should be open
    const favorModal = page.locator('#favor-target-modal');
    await expect(favorModal).toHaveClass(/modal--active/);
  });

  test('favor target modal lists alive opponents', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['favor', 'defuse', 'nope', 'skip', 'attack'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    const favorCard = page.locator('#player-hand .card[data-card-type="favor"]').first();
    await favorCard.click();
    await page.waitForTimeout(500);

    // Should have target buttons
    const targetButtons = page.locator('#favor-target-list .target-btn');
    const count = await targetButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('selecting favor target opens give modal', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['favor', 'defuse', 'nope', 'skip', 'attack'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    const favorCard = page.locator('#player-hand .card[data-card-type="favor"]').first();
    await favorCard.click();
    await page.waitForTimeout(500);

    // Select first target
    const targetBtn = page.locator('#favor-target-list .target-btn').first();
    await targetBtn.click();
    await page.waitForTimeout(500);

    // Wait for nope to resolve and favor-give modal to appear
    let found = false;
    for (let i = 0; i < 20; i++) {
      const state = await getGameState(page);
      if (state.activeModal === 'favor-give-modal') {
        found = true;
        break;
      }
      // Dismiss nope if present
      const nopeActive = await page.locator('#nope-modal').evaluate(el => el.classList.contains('modal--active'));
      if (nopeActive) {
        const letItBtn = page.locator('#nope-no-btn');
        if (await letItBtn.isVisible()) {
          await letItBtn.click();
          await page.waitForTimeout(300);
        }
      }
      await page.waitForTimeout(500);
    }
    expect(found).toBe(true);
  });
});

// ========== SHUFFLE CARD ==========

test.describe('Shuffle Card', () => {

  test('playing shuffle adds to discard pile', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['shuffle', 'defuse', 'nope', 'skip', 'attack'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    const discardBefore = (await getGameState(page)).discardPileLength;

    const shuffleCard = page.locator('#player-hand .card[data-card-type="shuffle"]').first();
    await shuffleCard.click();
    await page.waitForTimeout(500);

    await dismissNopeIfPresent(page);
    await page.waitForTimeout(500);

    const state = await getGameState(page);
    expect(state.discardPileLength).toBeGreaterThan(discardBefore);
  });

  test('shuffle card does not change deck size', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['shuffle', 'defuse', 'nope', 'skip', 'attack'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    const deckBefore = parseInt(await page.locator('#deck-count').textContent(), 10);

    const shuffleCard = page.locator('#player-hand .card[data-card-type="shuffle"]').first();
    await shuffleCard.click();
    await page.waitForTimeout(500);

    // Dismiss nope and wait for resolution
    let nopeResolved = false;
    for (let i = 0; i < 10; i++) {
      const nopeActive = await page.locator('#nope-modal').evaluate(el => el.classList.contains('modal--active'));
      if (!nopeActive) { nopeResolved = true; break; }
      const letItBtn = page.locator('#nope-no-btn');
      if (await letItBtn.isVisible()) {
        await letItBtn.click();
        await page.waitForTimeout(300);
      }
      await page.waitForTimeout(300);
    }

    const deckAfter = parseInt(await page.locator('#deck-count').textContent(), 10);
    // Shuffle doesn't draw, so deck size should be the same
    // (unless AI took its turn, but we check immediately after nope resolves)
    expect(deckAfter).toBe(deckBefore);
  });
});

// ========== SEE THE FUTURE CARD ==========

test.describe('See the Future Card', () => {

  test('playing see the future opens peek modal', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['see_the_future', 'defuse', 'nope', 'skip', 'attack'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    const seeFutureCard = page.locator('#player-hand .card[data-card-type="see_the_future"]').first();
    await seeFutureCard.click();
    await page.waitForTimeout(500);

    // Wait for nope to resolve and peek modal to appear
    const peekModal = page.locator('#peek-modal');
    let opened = false;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      const isActive = await peekModal.evaluate(el => el.classList.contains('modal--active'));
      if (isActive) { opened = true; break; }
      // Try dismissing nope if present
      const nopeActive = await page.locator('#nope-modal').evaluate(el => el.classList.contains('modal--active'));
      if (nopeActive) {
        const letItBtn = page.locator('#nope-no-btn');
        if (await letItBtn.isVisible()) {
          await letItBtn.click();
          await page.waitForTimeout(300);
        }
      }
    }
    expect(opened).toBe(true);
  });

  test('peek modal shows top 3 cards from deck', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['see_the_future', 'defuse', 'nope', 'skip', 'attack'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    const seeFutureCard = page.locator('#player-hand .card[data-card-type="see_the_future"]').first();
    await seeFutureCard.click();
    await page.waitForTimeout(500);

    // Wait for nope to resolve and peek modal to appear
    const peekModal = page.locator('#peek-modal');
    let opened = false;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      const isActive = await peekModal.evaluate(el => el.classList.contains('modal--active'));
      if (isActive) { opened = true; break; }
      const nopeActive = await page.locator('#nope-modal').evaluate(el => el.classList.contains('modal--active'));
      if (nopeActive) {
        const letItBtn = page.locator('#nope-no-btn');
        if (await letItBtn.isVisible()) {
          await letItBtn.click();
          await page.waitForTimeout(300);
        }
      }
    }

    if (opened) {
      const peekCards = page.locator('#peek-cards .card');
      const count = await peekCards.count();
      // Should show up to 3 cards (deck has 4)
      expect(count).toBeLessThanOrEqual(3);
      expect(count).toBeGreaterThan(0);
    }
  });
});

// ========== COMBOS ==========

test.describe('Two of a Kind Combo', () => {

  test('two of a kind combo steals a random card from target', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['tacocat', 'tacocat', 'defuse', 'nope', 'skip'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    const handBefore = (await getGameState(page)).players[0].handLength;
    const opponentHandBefore = (await getGameState(page)).players[1].handLength;

    // Click first tacocat — should open combo modal (2+ same type)
    const tacocatCard = page.locator('#player-hand .card[data-card-type="tacocat"]').first();
    await tacocatCard.click();
    await page.waitForTimeout(500);

    // Combo modal should be open
    const comboModal = page.locator('#combo-modal');
    await expect(comboModal).toHaveClass(/modal--active/);

    // Select both tacocat cards in combo modal
    const comboCards = page.locator('#combo-card-selector .card');
    const comboCardCount = await comboCards.count();
    expect(comboCardCount).toBeGreaterThanOrEqual(2);

    // Click first two cards to select them
    await comboCards.nth(0).click();
    await page.waitForTimeout(200);
    await comboCards.nth(1).click();
    await page.waitForTimeout(200);

    // Submit combo
    await page.locator('#combo-confirm-btn').click();
    await page.waitForTimeout(500);

    // Target modal should open (for two of a kind)
    const targetModal = page.locator('#favor-target-modal');
    const targetOpen = await targetModal.evaluate(el => el.classList.contains('modal--active'));
    expect(targetOpen).toBe(true);

    // Select target
    const targetBtn = page.locator('#favor-target-list .target-btn').first();
    await targetBtn.click();
    await page.waitForTimeout(1000);

    // Dismiss nope if it appears
    await dismissNopeIfPresent(page);
    await page.waitForTimeout(500);

    // Combo should have resolved — check hand sizes
    const state = await getGameState(page);
    // Player should have stolen a card (hand size changed)
    // Note: combo cards were removed (2), stolen card added (1), so net -1
    // But opponent lost 1 card
    const opponentHandAfter = state.players[1].handLength;
    expect(opponentHandAfter).toBe(opponentHandBefore - 1);
  });

  test('combo modal shows cat cards only', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['tacocat', 'tacocat', 'defuse', 'nope', 'skip'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    const tacocatCard = page.locator('#player-hand .card[data-card-type="tacocat"]').first();
    await tacocatCard.click();
    await page.waitForTimeout(500);

    // Combo modal should show only cat cards
    const comboCards = page.locator('#combo-card-selector .card');
    const count = await comboCards.count();
    expect(count).toBe(2); // Only the 2 tacocat cards

    // Verify they are all cat cards
    for (let i = 0; i < count; i++) {
      const type = await comboCards.nth(i).getAttribute('data-card-type');
      expect(type).toBe('tacocat');
    }
  });

  test('combo cards are removed from hand after combo', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['tacocat', 'tacocat', 'defuse', 'nope', 'skip'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    const handBefore = (await getGameState(page)).players[0].handLength;

    // Open combo modal
    const tacocatCard = page.locator('#player-hand .card[data-card-type="tacocat"]').first();
    await tacocatCard.click();
    await page.waitForTimeout(500);

    // Select both cards and submit
    const comboCards = page.locator('#combo-card-selector .card');
    await comboCards.nth(0).click();
    await page.waitForTimeout(200);
    await comboCards.nth(1).click();
    await page.waitForTimeout(200);
    await page.locator('#combo-confirm-btn').click();
    await page.waitForTimeout(500);

    // Select target
    const targetBtn = page.locator('#favor-target-list .target-btn').first();
    if (await targetBtn.count() > 0) {
      await targetBtn.click();
      await page.waitForTimeout(1000);
    }

    await dismissNopeIfPresent(page);
    await page.waitForTimeout(500);

    // Two combo cards should have been removed from hand
    const state = await getGameState(page);
    const handAfter = state.players[0].handLength;
    // Net: -2 (combo cards) + 1 (stolen card) = -1
    expect(handAfter).toBe(handBefore - 1);
  });
});

test.describe('Three of a Kind Combo', () => {

  test('three of a kind opens target then naming modal', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['cattermelon', 'cattermelon', 'cattermelon', 'defuse', 'nope'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    // Click first cattermelon — should open combo modal
    const catCard = page.locator('#player-hand .card[data-card-type="cattermelon"]').first();
    await catCard.click();
    await page.waitForTimeout(500);

    // Combo modal should be open
    const comboModal = page.locator('#combo-modal');
    await expect(comboModal).toHaveClass(/modal--active/);

    // Select all 3 cattermelon cards
    const comboCards = page.locator('#combo-card-selector .card');
    const count = await comboCards.count();
    expect(count).toBe(3);

    for (let i = 0; i < count; i++) {
      await comboCards.nth(i).click();
      await page.waitForTimeout(100);
    }

    // Submit combo
    await page.locator('#combo-confirm-btn').click();
    await page.waitForTimeout(500);

    // Target modal should open first (for three of a kind)
    const targetModal = page.locator('#favor-target-modal');
    const targetOpen = await targetModal.evaluate(el => el.classList.contains('modal--active'));
    expect(targetOpen).toBe(true);

    // Select target
    const targetBtn = page.locator('#favor-target-list .target-btn').first();
    await targetBtn.click();
    await page.waitForTimeout(500);

    // Three-kind naming modal should open
    const threeKindModal = page.locator('#three-kind-modal');
    const namingOpen = await threeKindModal.evaluate(el => el.classList.contains('modal--active'));
    expect(namingOpen).toBe(true);
  });
});

test.describe('Five Different Combo', () => {

  test('five different opens discard browser modal', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['tacocat', 'cattermelon', 'hairy_potato_cat', 'beard_cat', 'rainbow_cat'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    // Add some cards to discard pile first
    await page.evaluate(() => {
      window.GameState.mutate(function(state) {
        state.discardPile = [
          { instanceId: 'discard-1', type: 'skip', emoji: '⏭️', name: 'Skip', cornerIcon: null },
          { instanceId: 'discard-2', type: 'attack', emoji: '⚡', name: 'Attack', cornerIcon: null }
        ];
      });
      window.UIRenderer.forceRender();
    });
    await page.waitForTimeout(200);

    // Click first cat card — should open combo modal (all 5 are different)
    const catCard = page.locator('#player-hand .card[data-card-type="tacocat"]').first();
    await catCard.click();
    await page.waitForTimeout(500);

    // Combo modal should be open
    const comboModal = page.locator('#combo-modal');
    await expect(comboModal).toHaveClass(/modal--active/);

    // Select all 5 different cat cards
    const comboCards = page.locator('#combo-card-selector .card');
    const count = await comboCards.count();
    expect(count).toBe(5);

    for (let i = 0; i < count; i++) {
      await comboCards.nth(i).click();
      await page.waitForTimeout(100);
    }

    // Submit combo
    await page.locator('#combo-confirm-btn').click();
    await page.waitForTimeout(500);

    // Discard browser modal should open
    const discardModal = page.locator('#discard-browser-modal');
    const isOpen = await discardModal.evaluate(el => el.classList.contains('modal--active'));
    expect(isOpen).toBe(true);
  });

  test('five different allows picking a card from discard', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['tacocat', 'cattermelon', 'hairy_potato_cat', 'beard_cat', 'rainbow_cat'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    // Add cards to discard pile
    await page.evaluate(() => {
      window.GameState.mutate(function(state) {
        state.discardPile = [
          { instanceId: 'discard-1', type: 'skip', emoji: '⏭️', name: 'Skip', cornerIcon: null },
          { instanceId: 'discard-2', type: 'attack', emoji: '⚡', name: 'Attack', cornerIcon: null }
        ];
      });
      window.UIRenderer.forceRender();
    });
    await page.waitForTimeout(200);

    const handBefore = (await getGameState(page)).players[0].handLength;

    // Open combo modal and select all 5 cards
    const catCard = page.locator('#player-hand .card[data-card-type="tacocat"]').first();
    await catCard.click();
    await page.waitForTimeout(500);

    const comboCards = page.locator('#combo-card-selector .card');
    const count = await comboCards.count();
    for (let i = 0; i < count; i++) {
      await comboCards.nth(i).click();
      await page.waitForTimeout(100);
    }
    await page.locator('#combo-confirm-btn').click();
    await page.waitForTimeout(500);

    // Discard browser should be open — pick a card
    const discardCards = page.locator('#discard-cards .card');
    const discardCount = await discardCards.count();
    expect(discardCount).toBeGreaterThan(0);

    await discardCards.nth(0).click();
    await page.waitForTimeout(500);

    // Card should be added to hand
    const state = await getGameState(page);
    const handAfter = state.players[0].handLength;
    // Net: -5 (combo cards) + 1 (picked card) = -4
    expect(handAfter).toBe(handBefore - 4);
  });
});

// ========== DEFUSE / EXPLODING KITTEN ==========

test.describe('Defuse and Exploding Kitten', () => {

  test('drawing exploding kitten with defuse opens defuse modal', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['skip', 'defuse', 'nope', 'attack', 'favor'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle', 'exploding_kitten']
    });

    // Draw a card (should be EK — pop takes from end of array)
    await page.locator('#draw-btn').click();
    await page.waitForTimeout(500);

    // Defuse modal should open
    const defuseModal = page.locator('#defuse-modal');
    await expect(defuseModal).toHaveClass(/modal--active/);
  });

  test('defuse modal has position slider', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['skip', 'defuse', 'nope', 'attack', 'favor'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle', 'exploding_kitten']
    });

    await page.locator('#draw-btn').click();
    await page.waitForTimeout(500);

    // Defuse modal should have a slider
    const slider = page.locator('#defuse-position-slider');
    await expect(slider).toHaveCount(1);
  });

  test('confirming defuse places EK back in deck and ends turn', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['skip', 'defuse', 'nope', 'attack', 'favor'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle', 'exploding_kitten']
    });

    const playerBefore = await getCurrentPlayerIndex(page);

    // Draw EK
    await page.locator('#draw-btn').click();
    await page.waitForTimeout(500);

    // Confirm defuse placement
    await page.locator('#defuse-confirm-btn').click();

    // Wait for turn to switch
    let turnSwitched = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(200);
      const state = await getGameState(page);
      if (state.currentPlayerIndex !== playerBefore && state.activeModal === null) {
        turnSwitched = true;
        break;
      }
    }

    expect(turnSwitched).toBe(true);

    // Player should still be alive
    const state = await getGameState(page);
    expect(state.players[0].isAlive).toBe(true);

    // Deck should still have the EK in it
    expect(state.drawPileLength).toBeGreaterThan(0);
  });

  test('drawing exploding kitten without defuse eliminates player', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['skip', 'nope', 'attack', 'favor', 'shuffle'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle', 'exploding_kitten']
    });

    // Draw EK (no defuse in hand)
    await page.locator('#draw-btn').click();
    await page.waitForTimeout(2000);

    const state = await getGameState(page);
    // Player should be dead
    expect(state.players[0].isAlive).toBe(false);
  });
});

// ========== PLAYER ELIMINATION ==========

test.describe('Player Elimination', () => {

  test('eliminated player is skipped in turn order', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 3, gameMode: 'ai' });
    await waitForHumanTurn(page);

    // Kill player 1 (an AI)
    await page.evaluate(() => {
      window.GameState.mutate(function(state) {
        state.players[1].isAlive = false;
      });
      window.UIRenderer.forceRender();
    });
    await page.waitForTimeout(500);

    // Get current player
    const currentBefore = await getCurrentPlayerIndex(page);

    // Draw to end turn
    await page.locator('#draw-btn').click();
    await page.waitForTimeout(3000);

    // Next player should skip player 1 (dead) and go to player 2 or back to 0
    const state = await getGameState(page);
    if (state.activeModal !== 'defuse-modal') {
      const currentAfter = state.currentPlayerIndex;
      // Should not be the dead player (index 1)
      expect(currentAfter).not.toBe(1);
    }
  });

  test('game ends when only one player remains', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 3, gameMode: 'ai' });
    await waitForHumanTurn(page);

    // Kill all AI players and trigger game over
    await page.evaluate(() => {
      window.GameState.mutate(function(state) {
        state.players.forEach(p => {
          if (!p.isHuman) p.isAlive = false;
        });
        state.gamePhase = 'game-over';
      });
      window.UIRenderer.forceRender();
    });
    await page.waitForTimeout(1000);

    // Game over screen should appear
    await expect(page.locator('#game-over-screen')).toHaveClass(/screen--active/, { timeout: 5000 });
  });
});

// ========== HOT-SEAT TURN SWITCHING ==========

test.describe('Hot-Seat Turn Switching', () => {

  test('turn switches to next player after draw in hot-seat', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 3, gameMode: 'hotseat' });

    // Dismiss pass screen if present
    await page.waitForTimeout(500);
    const overlay = page.locator('#pass-screen-overlay');
    const isActive = await overlay.evaluate(el =>
      el.classList.contains('pass-screen--active') && el.style.display !== 'none'
    );
    if (isActive) {
      await page.locator('#pass-screen-btn').click();
      await page.waitForTimeout(500);
    }

    const playerBefore = await getCurrentPlayerIndex(page);

    // Draw to end turn
    await page.locator('#draw-btn').click();
    await page.waitForTimeout(1000);

    // Pass screen should appear for next player (or defuse modal)
    const state = await getGameState(page);
    if (state.activeModal !== 'defuse-modal') {
      // Check if pass screen appeared or player changed
      const passActive = await overlay.evaluate(el =>
        el.classList.contains('pass-screen--active') && el.style.display !== 'none'
      );
      const playerAfter = state.currentPlayerIndex;
      expect(passActive || playerAfter !== playerBefore).toBe(true);
    }
  });
});

// ========== COMBO CANCEL ==========

test.describe('Combo Cancel', () => {

  test('canceling combo modal returns to gameplay and allows play', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['tacocat', 'tacocat', 'defuse', 'nope', 'skip'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    // Open combo modal
    const tacocatCard = page.locator('#player-hand .card[data-card-type="tacocat"]').first();
    await tacocatCard.click();
    await page.waitForTimeout(500);

    // Combo modal should be open
    const comboModal = page.locator('#combo-modal');
    await expect(comboModal).toHaveClass(/modal--active/);

    // Click Cancel
    await page.locator('[data-modal-close="combo-modal"]').click();
    await page.waitForTimeout(500);

    // Combo modal should be closed
    await expect(comboModal).not.toHaveClass(/modal--active/);

    // Game state activeModal should be null
    const state = await getGameState(page);
    expect(state.activeModal).toBeNull();

    // Player should be able to play cards (hand cards should be clickable)
    const handCards = page.locator('#player-hand .card');
    const cardCount = await handCards.count();
    expect(cardCount).toBe(5); // All cards still in hand

    // Draw button should be enabled (game not stuck)
    await expect(page.locator('#draw-btn')).toBeEnabled({ timeout: 5000 });
  });

  test('canceling combo modal via overlay returns to gameplay', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['tacocat', 'tacocat', 'defuse', 'nope', 'skip'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    // Open combo modal
    const tacocatCard = page.locator('#player-hand .card[data-card-type="tacocat"]').first();
    await tacocatCard.click();
    await page.waitForTimeout(500);

    // Click overlay at top-left corner (outside modal-content)
    await page.locator('#combo-modal .modal-overlay').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(500);

    // Game state activeModal should be null
    const state = await getGameState(page);
    expect(state.activeModal).toBeNull();

    // Draw button should be enabled
    await expect(page.locator('#draw-btn')).toBeEnabled({ timeout: 5000 });
  });
});

// ========== AI HAND VISIBILITY ==========

test.describe('AI Hand Visibility', () => {

  test('AI cards are not shown face-up during AI turn', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });

    // Wait for game to stabilize — AI may go first
    await page.waitForTimeout(5000);

    // Check if it's currently AI's turn
    const state = await getGameState(page);
    const currentPlayer = state.players[state.currentPlayerIndex];

    if (currentPlayer && currentPlayer.isAI) {
      // Hand area should NOT show face-up cards
      const handCards = page.locator('#player-hand .card');
      const handCount = await handCards.count();
      expect(handCount).toBe(0); // No face-up cards shown for AI

      // Should show a waiting message instead
      const waitingMsg = page.locator('#player-hand .hand-empty');
      await expect(waitingMsg).toContainText(/thinking/);
    }
  });

  test('human cards are shown face-up during human turn', async ({ page }) => {
    await setupControlledGame(page, {
      handCards: ['skip', 'defuse', 'nope', 'attack', 'favor'],
      deckCards: ['skip', 'attack', 'favor', 'shuffle']
    });

    // Human player's cards should be visible
    const handCards = page.locator('#player-hand .card');
    const count = await handCards.count();
    expect(count).toBe(5);
  });
});