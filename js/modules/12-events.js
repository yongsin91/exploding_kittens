/**
 * Module 12: Event Handler / Input Controller
 * 
 * Routes user inputs to appropriate game logic handlers:
 * - Hand card clicks (play card)
 * - Draw/End turn buttons
 * - Target selection (Favor, combos)
 * - Modal interactions (defuse placement, favor give, nope, discard pick, three-kind)
 * - Combo builder multi-select
 * - Keyboard shortcuts (D=draw, S=skip, Esc=cancel)
 * 
 * @module Events
 * @requires Modules 3-10, GameApp
 * @exports {Object} window.Events
 */

(function() {
    'use strict';

    window.debug('[Module 12: Event Handler] Loading...');

    if (!window.GameState || !window.Player || !window.TurnEngine || !window.CardEffects || !window.Combo || !window.Nope || !window.UIRenderer) {
        throw new Error('[Module 12] Missing dependencies.');
    }

    // ========== STATE ==========

    let initialized = false;
    let selectedComboCards = [];
    let pendingTargetSelection = null; // { type: 'favor'|'combo', comboInfo }

    // ========== VALIDATION ==========

    /**
     * Validate that it's the current player's turn and they can act.
     * @private
     * @returns {Object} { valid, player, state }
     */
    function validateTurn() {
        let state = window.GameState.getState();
        let player = state.players[state.currentPlayerIndex];
        if (!player) return { valid: false, error: 'No current player' };
        if (!player.isAlive) return { valid: false, error: 'Current player is dead' };
        if (!player.isHuman) return { valid: false, error: 'Not human player turn' };
        if (state.nopeWindowActive) return { valid: false, error: 'Nope window active' };
        if (state.activeModal) return { valid: false, error: 'Modal active' };
        return { valid: true, player: player, state: state };
    }

    /**
     * Check if a card is in the current player's hand.
     * @private
     */
    function cardInHand(player, cardInstanceId) {
        return player.hand.some(function(c) { return c.instanceId === cardInstanceId; });
    }

    // ========== CARD CLICK HANDLER ==========

    /**
     * Handle a card click from the player's hand.
     * @param {string} cardInstanceId - Instance ID of clicked card
     */
    function handleCardClick(cardInstanceId) {
        let v = validateTurn();
        if (!v.valid) {
            window.debug('[Events] Cannot play card:', v.error);
            return;
        }

        let player = v.player;
        if (!cardInHand(player, cardInstanceId)) {
            window.debug('[Events] Card not in hand');
            return;
        }

        let card = player.hand.find(function(c) { return c.instanceId === cardInstanceId; });
        if (!card) return;

        // Don't allow playing Defuse or Exploding Kitten directly
        if (card.type === 'defuse' || card.type === 'exploding_kitten') {
            window.debug('[Events] Cannot play', card.type, 'directly');
            return;
        }

        // Cat cards — check for combo potential or play individually
        if (card.cornerIcon) {
            // Check if player has matching cat cards for a pair/triple combo
            let sameType = player.hand.filter(function(c) { return c.type === card.type; });
            if (sameType.length >= 2) {
                // Open combo modal for selection
                window.GameState.setStateProperty('activeModal', 'combo-modal');
                selectedComboCards = [];
                return;
            }

            // Check if player has 5 different cat cards for Five Different combo
            let catCards = player.hand.filter(function(c) { return c.cornerIcon; });
            let uniqueIcons = new Set(catCards.map(function(c) { return c.cornerIcon; }));
            if (uniqueIcons.size >= 5) {
                // Open combo modal for selection
                window.GameState.setStateProperty('activeModal', 'combo-modal');
                selectedComboCards = [];
                return;
            }

            // Single cat card — no effect, just discard
            playCard(cardInstanceId);
            return;
        }

        // Favor requires target selection
        if (card.type === 'favor') {
            // Open favor target modal
            window.GameState.setState({
                activeModal: 'favor-target-modal',
                modalData: { playerId: player.id }
            });
            return;
        }

        // All other cards — play directly
        playCard(cardInstanceId);
    }

    /**
     * Play a card — resolve effect, handle nope, discard.
     * @private
     * @param {string} cardInstanceId
     * @param {number} targetId - Optional target for favor
     */
    function playCard(cardInstanceId, targetId) {
        let v = validateTurn();
        if (!v.valid) return;

        let player = v.player;
        let card = player.hand.find(function(c) { return c.instanceId === cardInstanceId; });
        if (!card) return;

        // Remove card from hand
        window.Player.removeCardFromHand(player.id, cardInstanceId);

        // Add to discard pile
        window.GameState.mutate(function(state) {
            state.discardPile.push(card);
        });

        // Resolve card effect
        let result = window.CardEffects.resolveCardEffect(card.type, player.id, targetId);

        if (result.requiresNopeResolution) {
            // Open nope window with resolver
            let resolver = function() {
                // Effect proceeds — handle UI modals
                handleEffectUI(result, player.id);

                // See the Future: re-open peek modal after nope resolves
                if (card.type === 'see_the_future' && result.peekedCards) {
                    window.GameState.setState({
                        activeModal: 'peek-modal',
                        modalData: { playerId: player.id, peekedCards: result.peekedCards }
                    });
                }

                // Skip card ends the turn (no draw needed)
                if (card.type === 'skip') {
                    if (window.GameFlow && typeof window.GameFlow.handleTurnEnd === 'function') {
                        window.GameFlow.handleTurnEnd();
                    }
                }

                // Attack card ends the turn (next player gets 2 turns)
                if (card.type === 'attack') {
                    if (window.GameFlow && typeof window.GameFlow.handleTurnEnd === 'function') {
                        window.GameFlow.handleTurnEnd();
                    }
                }

                // Shuffle card actually shuffles the draw pile
                if (card.type === 'shuffle') {
                    window.GameState.mutate(function(state) {
                        state.drawPile = window.shuffle(state.drawPile);
                    });
                    window.UIRenderer.forceRender();
                }
            };
            window.Nope.openNopeWindow({
                type: 'play-card',
                cardType: card.type,
                playerId: player.id,
                targetId: targetId,
                description: player.name + ' plays ' + (card.name || card.type),
                resolver: resolver
            });
        } else {
            // No nope needed — handle effect UI directly
            handleEffectUI(result, player.id);
        }

        // Track played card in state
        window.GameState.mutate(function(state) {
            state.cardsPlayed.push(cardInstanceId);
        });
    }

    /**
     * Handle effect UI (modals) after card resolution.
     * @private
     */
    function handleEffectUI(effectResult, playerId) {
        if (!effectResult || !effectResult.success) {
            window.debug('[Events] Effect failed:', effectResult ? effectResult.error : 'null');
            return;
        }

        // Use shared post-effect handler for shuffle/see_future
        if (window.AIController) {
            window.AIController.handleEffectPost(effectResult, playerId);
        }

        // If effect sets a modal, it will be handled by UIRenderer
        if (effectResult.requiresUI) {
            return;
        }

        // For non-UI effects, just update state
        window.UIRenderer.forceRender();
    }

    // ========== DRAW BUTTON ==========

    /**
     * Handle draw card button click.
     */
    function handleDrawClick() {
        let v = validateTurn();
        if (!v.valid) {
            window.debug('[Events] Cannot draw:', v.error);
            return;
        }

        let result = window.TurnEngine.drawCard(v.player.id);
        if (!result.success) {
            window.debug('[Events] Draw failed:', result.error);
            return;
        }

        let state = window.GameState.getState();

        // If defuse modal is open (drew EK, has defuse) — wait for defuse placement
        if (state.activeModal === 'defuse-modal') {
            return;
        }

        // If player died (drew EK, no defuse) — TurnEngine already killed them
        if (!state.players[v.player.id] || !state.players[v.player.id].isAlive) {
            if (window.GameFlow && typeof window.GameFlow.handlePlayerDeath === 'function') {
                window.GameFlow.handlePlayerDeath(v.player.id);
            }
            return;
        }

        // Normal draw — end turn
        if (window.GameFlow && typeof window.GameFlow.handleTurnEnd === 'function') {
            window.GameFlow.handleTurnEnd();
        }
    }

    // ========== END TURN BUTTON ==========

    /**
     * Handle end turn button click.
     */
    function handleEndTurnClick() {
        let v = validateTurn();
        if (!v.valid) {
            window.debug('[Events] Cannot end turn:', v.error);
            return;
        }

        // If no cards played this turn, must draw a card to end turn
        let state = window.GameState.getState();
        if (state.cardsPlayed.length === 0) {
            handleDrawClick();
            return;
        }

        // Cards have been played — end turn directly
        if (window.GameFlow && typeof window.GameFlow.handleTurnEnd === 'function') {
            window.GameFlow.handleTurnEnd();
        } else {
            window.TurnEngine.endTurn();
        }
    }

    // ========== TARGET SELECTION ==========

    /**
     * Handle target selection for Favor or combo.
     * @param {number} targetPlayerId
     */
    function handleTargetSelect(targetPlayerId) {
        let state = window.GameState.getState();
        let modalData = state.modalData || {};
        let playerId = modalData.playerId;
        let comboInfo = modalData.comboInfo;
        let comboStage = modalData.comboStage;

        // Close target modal
        window.GameState.setState({ activeModal: null, modalData: {} });

        // Handle combo target selection
        if (comboInfo) {
            if (comboStage === 'three-kind-target') {
                // Three of a kind: now open naming modal with target selected
                window.GameState.setState({
                    activeModal: 'three-kind-modal',
                    modalData: { comboInfo: comboInfo, playerId: playerId, targetId: targetPlayerId }
                });
                return;
            }

            // Two of a kind: resolve combo with target
            let comboResult = window.Combo.resolveCombo(comboInfo, playerId, targetPlayerId, null);
            if (!comboResult.success) {
                window.debug('[Events] Combo failed:', comboResult.error);
            }
            window.UIRenderer.forceRender();
            return;
        }

        // Handle favor target selection
        // The favor card was not yet played — play it now with the target
        let player = state.players[playerId];
        let favorCard = player.hand.find(function(c) { return c.type === 'favor'; });
        if (favorCard) {
            // Remove favor card from hand and add to discard
            window.Player.removeCardFromHand(playerId, favorCard.instanceId);
            window.GameState.mutate(function(state) {
                state.discardPile.push(favorCard);
            });

            // Open nope window for favor, then show favor-give modal
            let favorResult = window.CardEffects.resolveCardEffect('favor', playerId, targetPlayerId);
            let resolver = function() {
                // After nope resolves, open favor-give modal
                window.GameState.setState({
                    activeModal: 'favor-give-modal',
                    modalData: { targetPlayerId: targetPlayerId, requesterId: playerId }
                });
            };
            window.Nope.openNopeWindow({
                type: 'play-card',
                cardType: 'favor',
                playerId: playerId,
                targetId: targetPlayerId,
                description: player.name + ' plays Favor on ' + state.players[targetPlayerId].name,
                resolver: resolver
            });
        }
    }

    // ========== FAVOR GIVE ==========

    /**
     * Handle favor give — target player gives a card.
     * @param {string} cardInstanceId - Card to give
     */
    function handleFavorGive(cardInstanceId) {
        let state = window.GameState.getState();
        let modalData = state.modalData || {};
        let targetPlayerId = modalData.targetPlayerId;
        let requesterId = modalData.requesterId;

        if (targetPlayerId === undefined || requesterId === undefined) {
            window.debug('[Events] Missing favor data');
            return;
        }

        let targetPlayer = state.players[targetPlayerId];
        let card = targetPlayer.hand.find(function(c) { return c.instanceId === cardInstanceId; });
        if (!card) return;

        // Transfer card
        window.Player.removeCardFromHand(targetPlayerId, cardInstanceId);
        window.Player.addCardToHand(requesterId, card);

        // Close modal
        window.GameState.setState({ activeModal: null, modalData: {} });

        window.GameState.logAction({
            type: 'FAVER_GIVEN',
            playerId: targetPlayerId,
            description: targetPlayer.name + ' gave a card to ' + state.players[requesterId].name
        });
    }

    // ========== NOPE RESPONSE ==========

    /**
     * Handle nope response from player.
     * @param {boolean} wantNope - Whether player wants to nope
     * @param {number} [playerId] - Player responding (optional, defaults to current)
     */
    function handleNopeResponse(wantNope, playerId) {
        if (wantNope) {
            if (playerId === undefined) {
                // Use pending nope player from HotSeat if available
                if (window.HotSeat && window.HotSeat.isHotSeatMode() && typeof window.HotSeat.getPendingNopePlayerId === 'function') {
                    playerId = window.HotSeat.getPendingNopePlayerId();
                } else {
                    // AI mode — find the human player who can nope
                    let eligiblePlayers = window.Nope.getEligibleNopePlayers();
                    let humanEligible = eligiblePlayers.find(function(p) {
                        let player = window.Player.getPlayerById(p.id);
                        return player && player.isHuman;
                    });
                    if (humanEligible) {
                        playerId = humanEligible.id;
                    }
                }
            }

            if (playerId !== null && playerId !== undefined) {
                window.Nope.playNope(playerId);
            } else {
                // No eligible human player — close the nope window
                window.Nope.closeNopeWindow();
            }
        } else {
            // Player declines — close nope window or move to next player
            if (window.HotSeat && window.HotSeat.isHotSeatMode() && typeof window.HotSeat.handleNopeResponse === 'function') {
                window.HotSeat.handleNopeResponse(false);
            } else {
                window.Nope.closeNopeWindow();
            }
        }
    }

    // ========== DEFUSE PLACEMENT ==========

    /**
     * Handle defuse placement — put EK back in deck at chosen position.
     */
    function handleDefusePlace() {
        let state = window.GameState.getState();
        let modalData = state.modalData || {};
        let ekCard = modalData.ekCard;
        let playerId = modalData.playerId;

        if (!ekCard || playerId === undefined) {
            window.debug('[Events] Missing defuse data');
            return;
        }

        // Get position from UI
        let position = window.UIRenderer.getDefusePosition();

        // Remove defuse card from player's hand
        let player = state.players[playerId];
        let defuseCard = player.hand.find(function(c) { return c.type === 'defuse'; });
        if (defuseCard) {
            window.Player.removeCardFromHand(playerId, defuseCard.instanceId);
            window.GameState.mutate(function(state) {
                state.discardPile.push(defuseCard);
            });
        }

        // Place EK back in deck
        window.TurnEngine.placeExplodingKitten(ekCard, position);

        // Close modal
        window.GameState.setState({ activeModal: null, modalData: {} });

        window.GameState.logAction({
            type: 'DEFUSED',
            playerId: playerId,
            description: player.name + ' defused the Exploding Kitten and placed it at position ' + position
        });

        // End turn after defusing
        if (window.GameFlow && typeof window.GameFlow.handleTurnEnd === 'function') {
            window.GameFlow.handleTurnEnd();
        }
    }

    // ========== COMBO HANDLING ==========

    /**
     * Clear combo card selection state.
     * Called when combo modal is closed/cancelled.
     */
    function clearComboSelection() {
        selectedComboCards = [];
        let comboSelector = document.getElementById('combo-card-selector');
        if (comboSelector) {
            let selectedCards = comboSelector.querySelectorAll('.card--selected');
            selectedCards.forEach(function(el) { el.classList.remove('card--selected'); });
        }
    }

    /**
     * Handle combo card selection toggle.
     * @param {string} cardInstanceId
     */
    function handleComboCardToggle(cardInstanceId) {
        let idx = selectedComboCards.indexOf(cardInstanceId);
        if (idx !== -1) {
            selectedComboCards.splice(idx, 1);
        } else {
            selectedComboCards.push(cardInstanceId);
        }
    }

    /**
     * Handle combo submit — validate and resolve combo.
     */
    function handleComboSubmit() {
        // Don't use validateTurn() — combo modal is active, which would block it
        let state = window.GameState.getState();
        let player = state.players[state.currentPlayerIndex];
        if (!player || !player.isAlive || !player.isHuman) return;

        if (selectedComboCards.length < 2) {
            window.debug('[Events] Need at least 2 cards for combo');
            return;
        }

        let cards = selectedComboCards.map(function(id) {
            return player.hand.find(function(c) { return c.instanceId === id; });
        }).filter(Boolean);

        if (cards.length !== selectedComboCards.length) {
            window.debug('[Events] Some cards not found in hand');
            return;
        }

        let comboInfo = window.Combo.detectCombo(cards);
        if (!comboInfo) {
            window.debug('[Events] Invalid combo');
            return;
        }

        // Save selected cards before clearing
        let cardsToRemove = selectedComboCards.slice();

        // Close combo modal
        window.GameState.setState({ activeModal: null });
        selectedComboCards = [];

        // Remove combo cards from hand and add to discard
        window.Combo.removeComboCards(player.id, cardsToRemove);

        // For three of a kind, need target then naming
        if (comboInfo.comboType === 'three_of_a_kind') {
            window.GameState.setState({
                activeModal: 'favor-target-modal',
                modalData: { playerId: player.id, comboInfo: comboInfo, comboStage: 'three-kind-target' }
            });
            return;
        }

        // For two of a kind, need target
        if (comboInfo.comboType === 'two_of_a_kind') {
            // Open favor-style target modal
            window.GameState.setState({
                activeModal: 'favor-target-modal',
                modalData: { playerId: player.id, comboInfo: comboInfo, comboStage: 'two-of-a-kind-target' }
            });
            return;
        }

        // For five different, route through nope window
        if (comboInfo.comboType === 'five_different') {
            let state = window.GameState.getState();
            let discardPile = state.discardPile;
            let resolver = function() {
                // After nope resolves, open discard browser modal
                window.GameState.setState({
                    activeModal: 'discard-browser-modal',
                    modalData: { comboInfo: comboInfo, playerId: player.id, discardPile: discardPile }
                });
            };
            window.Nope.openNopeWindow({
                type: 'combo',
                cardType: 'five_different',
                comboInfo: comboInfo,
                playerId: player.id,
                description: player.name + ' plays Five Different combo',
                resolver: resolver
            });
            return;
        }
    }

    // ========== THREE OF A KIND NAMING ==========

    /**
     * Handle three of a kind card naming.
     */
    function handleThreeKindName() {
        // Don't use validateTurn() — three-kind modal is active
        let state = window.GameState.getState();
        let modalData = state.modalData || {};
        let comboInfo = modalData.comboInfo;
        let playerId = modalData.playerId;
        let targetId = modalData.targetId;

        if (!comboInfo || playerId === undefined || targetId === undefined) {
            window.debug('[Events] Missing three-kind data');
            return;
        }

        let namedCard = window.UIRenderer.getSelectedCardName();

        // Close modal
        window.GameState.setState({ activeModal: null, modalData: {} });

        // Resolve combo with target and named card
        let result = window.Combo.resolveCombo(comboInfo, playerId, targetId, namedCard);
        if (!result.success) {
            window.debug('[Events] Combo failed:', result.error);
        }
        window.UIRenderer.forceRender();
    }

    // ========== DISCARD PICK ==========

    /**
     * Handle discard pile card pick (for Five Different combo).
     * @param {string} cardInstanceId
     */
    function handleDiscardPick(cardInstanceId) {
        // Don't use validateTurn() — discard browser modal is active
        let state = window.GameState.getState();
        let modalData = state.modalData || {};
        let playerId = modalData.playerId;

        if (playerId === undefined) {
            window.debug('[Events] Missing discard pick data');
            return;
        }

        // Pick card from discard
        window.Combo.pickFromDiscard(playerId, cardInstanceId);

        // Close modal
        window.GameState.setState({ activeModal: null, modalData: {} });
    }

    // ========== PLAY AGAIN ==========

    /**
     * Handle play again button click.
     */
    function handlePlayAgain() {
        if (window.GameFlow && typeof window.GameFlow.restartGame === 'function') {
            window.GameFlow.restartGame();
        } else {
            window.GameApp.resetToSetupScreen();
        }
    }

    // ========== KEYBOARD SHORTCUTS ==========

    /**
     * Handle keyboard shortcuts.
     * @private
     */
    function handleKeyboard(e) {
        // Only process if game screen is active
        let gameScreen = document.getElementById('game-screen');
        if (!gameScreen || !gameScreen.classList.contains('screen--active')) return;

        // Don't process if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key.toLowerCase()) {
            case 'd':
                handleDrawClick();
                break;
            case 's':
                // Skip = end turn
                handleEndTurnClick();
                break;
            case 'escape':
                // Close active modal via state — UIRenderer handles DOM
                let state = window.GameState.getState();
                if (state.activeModal) {
                    // Clear combo selection if closing combo modal
                    if (state.activeModal === 'combo-modal') {
                        clearComboSelection();
                    }
                    window.GameState.setState({ activeModal: null, modalData: {} });
                }
                break;
        }
    }

    // ========== EVENT LISTENER SETUP ==========

    /**
     * Set up all DOM event listeners.
     * Called on initialization.
     */
    function init() {
        if (initialized) return;
        initialized = true;

        // Draw button
        let drawBtn = document.getElementById('draw-btn');
        if (drawBtn) drawBtn.addEventListener('click', handleDrawClick);

        // End turn button
        let endTurnBtn = document.getElementById('end-turn-btn');
        if (endTurnBtn) endTurnBtn.addEventListener('click', handleEndTurnClick);

        // Nope buttons
        let nopeYesBtn = document.getElementById('nope-yes-btn');
        if (nopeYesBtn) nopeYesBtn.addEventListener('click', function() { handleNopeResponse(true); });

        let nopeNoBtn = document.getElementById('nope-no-btn');
        if (nopeNoBtn) nopeNoBtn.addEventListener('click', function() { handleNopeResponse(false); });

        // Defuse confirm
        let defuseConfirmBtn = document.getElementById('defuse-confirm-btn');
        if (defuseConfirmBtn) defuseConfirmBtn.addEventListener('click', handleDefusePlace);

        // Combo confirm
        let comboConfirmBtn = document.getElementById('combo-confirm-btn');
        if (comboConfirmBtn) comboConfirmBtn.addEventListener('click', handleComboSubmit);

        // Three of a kind confirm
        let threeKindConfirmBtn = document.getElementById('three-kind-confirm-btn');
        if (threeKindConfirmBtn) threeKindConfirmBtn.addEventListener('click', handleThreeKindName);

        // Play again
        let playAgainBtn = document.getElementById('play-again-btn');
        if (playAgainBtn) playAgainBtn.addEventListener('click', handlePlayAgain);

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboard);

        window.debug('[Module 12] Event listeners attached');
    }

    // ========== PUBLIC API ==========

    window.Events = Object.freeze({
        init: init,
        handleCardClick: handleCardClick,
        handleDrawClick: handleDrawClick,
        handleEndTurnClick: handleEndTurnClick,
        handleTargetSelect: handleTargetSelect,
        handleNopeResponse: handleNopeResponse,
        handleDefusePlace: handleDefusePlace,
        handleFavorGive: handleFavorGive,
        handleComboSubmit: handleComboSubmit,
        handleComboCardToggle: handleComboCardToggle,
        clearComboSelection: clearComboSelection,
        handleThreeKindName: handleThreeKindName,
        handleDiscardPick: handleDiscardPick,
        handlePlayAgain: handlePlayAgain
    });

    window.debug('[Module 12: Event Handler] Loaded ✓');
})();
