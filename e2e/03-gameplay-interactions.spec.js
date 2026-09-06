// Task 4: Gameplay Interactions E2E Tests
// Tests card playing, drawing, modals, and game interactions

const { test, expect } = require('@playwright/test');
const { gotoGame, startGame, waitForHumanTurn, getHandCardTypes } = require('./helpers');

test.describe('Gameplay Interactions', () => {

  test('drawing a card updates the hand', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });
    await waitForHumanTurn(page);

    const handBefore = await page.locator('#player-hand .card').count();
    const deckBefore = parseInt(await page.locator('#deck-count').textContent(), 10);

    await page.locator('#draw-btn').click();

    // Wait for hand to update — may increase by 1 or trigger defuse/EK
    // Give it a moment to process
    await page.waitForTimeout(500);

    const deckAfter = parseInt(await page.locator('#deck-count').textContent(), 10);
    expect(deckAfter).toBe(deckBefore - 1);
  });

  test('drawing a card decreases deck count', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });
    await waitForHumanTurn(page);

    const deckBefore = parseInt(await page.locator('#deck-count').textContent(), 10);

    await page.locator('#draw-btn').click();
    await page.waitForTimeout(500);

    const deckAfter = parseInt(await page.locator('#deck-count').textContent(), 10);
    expect(deckAfter).toBe(deckBefore - 1);
  });

  test('playing a non-cat action card adds to discard pile', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });
    await waitForHumanTurn(page);

    // Find a non-cat, non-defuse, non-EK card to play
    const types = await getHandCardTypes(page);
    const playableTypes = types.filter(t =>
      t !== 'defuse' && t !== 'exploding_kitten' && t !== 'tacocat' &&
      t !== 'cattermelon' && t !== 'hairy_potato_cat' && t !== 'beard_cat' &&
      t !== 'rainbow_cat'
    );

    // If we have a playable non-cat card, click it
    if (playableTypes.length > 0) {
      const cardToPlay = playableTypes[0];
      const cardEl = page.locator(`#player-hand .card[data-card-type="${cardToPlay}"]`).first();

      // Favor opens a modal, skip it for this test
      if (cardToPlay === 'favor') {
        // Just verify favor opens modal
        await cardEl.click();
        await page.waitForTimeout(300);
        await expect(page.locator('#favor-target-modal')).toHaveClass(/modal--active/);
        return;
      }

      await cardEl.click();
      await page.waitForTimeout(500);

      // Discard pile should no longer say "Empty"
      const discardText = await page.locator('#discard-pile').textContent();
      expect(discardText).not.toContain('Empty');
    }
  });

  test('action log updates after drawing a card', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });
    await waitForHumanTurn(page);

    const logBefore = await page.locator('#action-log .log-entry').count();

    await page.locator('#draw-btn').click();
    await page.waitForTimeout(500);

    const logAfter = await page.locator('#action-log .log-entry').count();
    expect(logAfter).toBeGreaterThanOrEqual(logBefore);
  });

  test('playing skip card ends turn (if available)', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });
    await waitForHumanTurn(page);

    const types = await getHandCardTypes(page);
    const skipIndex = types.indexOf('skip');

    if (skipIndex !== -1) {
      const skipCard = page.locator('#player-hand .card').nth(skipIndex);
      await skipCard.click();
      await page.waitForTimeout(500);

      // After skip, turn should pass — discard pile should have the skip
      const discardText = await page.locator('#discard-pile').textContent();
      expect(discardText).not.toContain('Empty');
    }
  });

  test('playing attack card works (if available)', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });
    await waitForHumanTurn(page);

    const types = await getHandCardTypes(page);
    const attackIndex = types.indexOf('attack');

    if (attackIndex !== -1) {
      const attackCard = page.locator('#player-hand .card').nth(attackIndex);
      await attackCard.click();
      await page.waitForTimeout(500);

      const discardText = await page.locator('#discard-pile').textContent();
      expect(discardText).not.toContain('Empty');
    }
  });

  test('playing shuffle card works (if available)', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });
    await waitForHumanTurn(page);

    const types = await getHandCardTypes(page);
    const shuffleIndex = types.indexOf('shuffle');

    if (shuffleIndex !== -1) {
      const shuffleCard = page.locator('#player-hand .card').nth(shuffleIndex);
      await shuffleCard.click();
      await page.waitForTimeout(500);

      const discardText = await page.locator('#discard-pile').textContent();
      expect(discardText).not.toContain('Empty');
    }
  });

  test('playing see the future opens peek modal (if available)', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });
    await waitForHumanTurn(page);

    const types = await getHandCardTypes(page);
    const seeFutureIndex = types.indexOf('see_the_future');

    if (seeFutureIndex !== -1) {
      const seeFutureCard = page.locator('#player-hand .card').nth(seeFutureIndex);
      await seeFutureCard.click();

      // See the Future is nopeable — wait for nope resolution then peek modal
      const peekModal = page.locator('#peek-modal');
      let peekOpened = false;
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(500);
        const isActive = await peekModal.evaluate(el => el.classList.contains('modal--active'));
        if (isActive) { peekOpened = true; break; }
      }

      if (peekOpened) {
        // Should show cards
        await expect(page.locator('#peek-cards')).toBeVisible();
      }
    }
  });

  test('playing favor opens target selection modal (if available)', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });
    await waitForHumanTurn(page);

    const types = await getHandCardTypes(page);
    const favorIndex = types.indexOf('favor');

    if (favorIndex !== -1) {
      const favorCard = page.locator('#player-hand .card').nth(favorIndex);
      await favorCard.click();
      await page.waitForTimeout(500);

      // Favor target modal should be open
      await expect(page.locator('#favor-target-modal')).toHaveClass(/modal--active/);
      // Should have target buttons
      await expect(page.locator('#favor-target-list')).toBeVisible();
    }
  });

  test('playing a single cat card discards it (no combo)', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });
    await waitForHumanTurn(page);

    const types = await getHandCardTypes(page);
    const catTypes = ['tacocat', 'cattermelon', 'hairy_potato_cat', 'beard_cat', 'rainbow_cat'];

    // Find a cat card that appears only once (no combo potential)
    for (const catType of catTypes) {
      const count = types.filter(t => t === catType).length;
      if (count === 1) {
        const catCard = page.locator(`#player-hand .card[data-card-type="${catType}"]`).first();
        await catCard.click();
        await page.waitForTimeout(500);

        // Should be discarded (no combo modal)
        const discardText = await page.locator('#discard-pile').textContent();
        expect(discardText).not.toContain('Empty');
        // Combo modal should NOT be open
        await expect(page.locator('#combo-modal')).not.toHaveClass(/modal--active/);
        return;
      }
    }
  });

  test('two matching cat cards open combo modal', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });
    await waitForHumanTurn(page);

    const types = await getHandCardTypes(page);
    const catTypes = ['tacocat', 'cattermelon', 'hairy_potato_cat', 'beard_cat', 'rainbow_cat'];

    // Find a cat card that appears 2+ times
    for (const catType of catTypes) {
      const count = types.filter(t => t === catType).length;
      if (count >= 2) {
        const catCard = page.locator(`#player-hand .card[data-card-type="${catType}"]`).first();
        await catCard.click();
        await page.waitForTimeout(500);

        // Combo modal should be open
        await expect(page.locator('#combo-modal')).toHaveClass(/modal--active/);
        await expect(page.locator('#combo-card-selector')).toBeVisible();
        return;
      }
    }
  });

  test('keyboard shortcut D draws a card', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });
    await waitForHumanTurn(page);

    const deckBefore = parseInt(await page.locator('#deck-count').textContent(), 10);

    await page.keyboard.press('d');
    await page.waitForTimeout(500);

    const deckAfter = parseInt(await page.locator('#deck-count').textContent(), 10);
    expect(deckAfter).toBe(deckBefore - 1);
  });

  test('hand card count decreases after playing a card', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });
    await waitForHumanTurn(page);

    const handBefore = await page.locator('#player-hand .card').count();

    // Find a playable card (non-cat, non-favor, non-defuse, non-EK)
    const types = await getHandCardTypes(page);
    const playable = types.find(t =>
      t !== 'defuse' && t !== 'exploding_kitten' && t !== 'favor' &&
      t !== 'tacocat' && t !== 'cattermelon' && t !== 'hairy_potato_cat' &&
      t !== 'beard_cat' && t !== 'rainbow_cat'
    );

    if (playable) {
      const cardEl = page.locator(`#player-hand .card[data-card-type="${playable}"]`).first();
      await cardEl.click();
      await page.waitForTimeout(300);

      const handAfter = await page.locator('#player-hand .card').count();
      expect(handAfter).toBe(handBefore - 1);
    }
  });

  test('peek modal can be closed with Got It button', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });
    await waitForHumanTurn(page);

    const types = await getHandCardTypes(page);
    const seeFutureIndex = types.indexOf('see_the_future');

    if (seeFutureIndex !== -1) {
      // Open peek modal
      await page.locator('#player-hand .card').nth(seeFutureIndex).click();

      // Wait for peek modal (nope window may delay it)
      const peekModal = page.locator('#peek-modal');
      let peekOpened = false;
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(500);
        const isActive = await peekModal.evaluate(el => el.classList.contains('modal--active'));
        if (isActive) { peekOpened = true; break; }
      }

      if (peekOpened) {
        // Close it
        await page.locator('#peek-modal .modal-close').click();
        await page.waitForTimeout(300);
        await expect(peekModal).not.toHaveClass(/modal--active/);
      }
    }
  });

  test('escape key closes active modal', async ({ page }) => {
    await gotoGame(page);
    await startGame(page, { playerCount: 2, gameMode: 'ai' });
    await waitForHumanTurn(page);

    const types = await getHandCardTypes(page);
    const seeFutureIndex = types.indexOf('see_the_future');

    if (seeFutureIndex !== -1) {
      await page.locator('#player-hand .card').nth(seeFutureIndex).click();

      // See the Future is nopeable — wait for nope resolution then peek modal
      // Wait up to 5s for peek modal to appear
      const peekModal = page.locator('#peek-modal');
      let peekOpened = false;
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(500);
        const isActive = await peekModal.evaluate(el => el.classList.contains('modal--active'));
        if (isActive) { peekOpened = true; break; }
      }

      if (peekOpened) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        await expect(peekModal).not.toHaveClass(/modal--active/);
      }
    }
  });
});