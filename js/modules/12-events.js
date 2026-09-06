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

    console.log('[Module 12: Event Handler] Loading...');

    if (!window.GameState || !window.Player || !window.TurnEngine || !window.CardEffects || !window.Combo || !window.Nope || !window.UIRenderer) {
        throw new Error('[Module 12] Missing dependencies.');
    }

    // ========== STATE ==========

    var initialized = false;
    var selectedComboCards = [];
    var pendingTargetSelection = null; // { type: 'favor'|'combo', comboInfo }

    // ========== VALIDATION ==========

    /**
     * Validate that it's the current player's turn and they can act.
     * @private
     * @returns {Object} { valid, player, state }
     */
    function validateTurn() {
        var state = window.GameState.getState();
        var player = state.players[state.currentPlayerIndex];
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
        var v = validateTurn();
        if (!v.valid) {
            console.log('[Events] Cannot play card:', v.error);
            return;
        }

        var player = v.player;
        if (!cardInHand(player, cardInstanceId)) {
            console.log('[Events] Card not in hand');
            return;
        }

        var card = player.hand.find(function(c) { return c.instanceId === cardInstanceId; });
        if (!card) return;

        // Don't allow playing Defuse or Exploding Kitten directly
        if (card.type === 'defuse' || card.type === 'exploding_kitten') {
            console.log('[Events] Cannot play', card.type, 'directly');
            return;
        }

        // Cat cards — check for combo potential or play individually
        if (card.cornerIcon) {
            // Check if player has matching cat cards for a pair/triple combo
            var sameType = player.hand.filter(function(c) { return c.type === card.type; });
            if (sameType.length >= 2) {
                // Open combo modal for selection
                window.GameState.setStateProperty('activeModal', 'combo-modal');
                selectedComboCards = [];
                return;
            }

            // Check if player has 5 different cat cards for Five Different combo
            var catCards = player.hand.filter(function(c) { return c.cornerIcon; });
            var uniqueIcons = new Set(catCards.map(function(c) { return c.cornerIcon; }));
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
        var v = validateTurn();
        if (!v.valid) return;

        var player = v.player;
        var card = player.hand.find(function(c) { return c.instanceId === cardInstanceId; });
        if (!card) return;

        // Remove card from hand
        window.Player.removeCardFromHand(player.id, cardInstanceId);

        // Add to discard pile
        window.GameState.mutate(function(state) {
            state.discardPile.push(card);
        });

        // Resolve card effect
        var result = window.CardEffects.resolveCardEffect(card.type, player.id, targetId);

        if (result.requiresNopeResolution) {
            // Open nope window with resolver
            var resolver = function() {
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
            console.log('[Events] Effect failed:', effectResult ? effectResult.error : 'null');
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
        var v = validateTurn();
        if (!v.valid) {
            console.log('[Events] Cannot draw:', v.error);
            return;
        }

        var result = window.TurnEngine.drawCard(v.player.id);
        if (!result.success) {
            console.log('[Events] Draw failed:', result.error);
            return;
        }

        var state = window.GameState.getState();

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
        var v = validateTurn();
        if (!v.valid) {
            console.log('[Events] Cannot end turn:', v.error);
            return;
        }

        // If no cards played this turn, must draw a card to end turn
        var state = window.GameState.getState();
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
        var state = window.GameState.getState();
        var modalData = state.modalData || {};
        var playerId = modalData.playerId;
        var comboInfo = modalData.comboInfo;
        var comboStage = modalData.comboStage;

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
            var comboResult = window.Combo.resolveCombo(comboInfo, playerId, targetPlayerId, null);
            if (!comboResult.success) {
                console.log('[Events] Combo failed:', comboResult.error);
            }
            window.UIRenderer.forceRender();
            return;
        }

        // Handle favor target selection
        // The favor card was not yet played — play it now with the target
        var player = state.players[playerId];
        var favorCard = player.hand.find(function(c) { return c.type === 'favor'; });
        if (favorCard) {
            // Remove favor card from hand and add to discard
            window.Player.removeCardFromHand(playerId, favorCard.instanceId);
            window.GameState.mutate(function(state) {
                state.discardPile.push(favorCard);
            });

            // Open nope window for favor, then show favor-give modal
            var favorResult = window.CardEffects.resolveCardEffect('favor', playerId, targetPlayerId);
            var resolver = function() {
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
        var state = window.GameState.getState();
        var modalData = state.modalData || {};
        var targetPlayerId = modalData.targetPlayerId;
        var requesterId = modalData.requesterId;

        if (targetPlayerId === undefined || requesterId === undefined) {
            console.log('[Events] Missing favor data');
            return;
        }

        var targetPlayer = state.players[targetPlayerId];
        var card = targetPlayer.hand.find(function(c) { return c.instanceId === cardInstanceId; });
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
                if (window.HotSeat && typeof window.HotSeat.getPendingNopePlayerId === 'function') {
                    playerId = window.HotSeat.getPendingNopePlayerId();
                }
            }

            if (playerId !== null && playerId !== undefined) {
                window.Nope.playNope(playerId);
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
        var state = window.GameState.getState();
        var modalData = state.modalData || {};
        var ekCard = modalData.ekCard;
        var playerId = modalData.playerId;

        if (!ekCard || playerId === undefined) {
            console.log('[Events] Missing defuse data');
            return;
        }

        // Get position from UI
        var position = window.UIRenderer.getDefusePosition();

        // Remove defuse card from player's hand
        var player = state.players[playerId];
        var defuseCard = player.hand.find(function(c) { return c.type === 'defuse'; });
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
        var comboSelector = document.getElementById('combo-card-selector');
        if (comboSelector) {
            var selectedCards = comboSelector.querySelectorAll('.card--selected');
            selectedCards.forEach(function(el) { el.classList.remove('card--selected'); });
        }
    }

    /**
     * Handle combo card selection toggle.
     * @param {string} cardInstanceId
     */
    function handleComboCardToggle(cardInstanceId) {
        var idx = selectedComboCards.indexOf(cardInstanceId);
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
        var state = window.GameState.getState();
        var player = state.players[state.currentPlayerIndex];
        if (!player || !player.isAlive || !player.isHuman) return;

        if (selectedComboCards.length < 2) {
            console.log('[Events] Need at least 2 cards for combo');
            return;
        }

        var cards = selectedComboCards.map(function(id) {
            return player.hand.find(function(c) { return c.instanceId === id; });
        }).filter(Boolean);

        if (cards.length !== selectedComboCards.length) {
            console.log('[Events] Some cards not found in hand');
            return;
        }

        var comboInfo = window.Combo.detectCombo(cards);
        if (!comboInfo) {
            console.log('[Events] Invalid combo');
            return;
        }

        // Save selected cards before clearing
        var cardsToRemove = selectedComboCards.slice();

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
            var state = window.GameState.getState();
            var discardPile = state.discardPile;
            var resolver = function() {
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
        var state = window.GameState.getState();
        var modalData = state.modalData || {};
        var comboInfo = modalData.comboInfo;
        var playerId = modalData.playerId;
        var targetId = modalData.targetId;

        if (!comboInfo || playerId === undefined || targetId === undefined) {
            console.log('[Events] Missing three-kind data');
            return;
        }

        var namedCard = window.UIRenderer.getSelectedCardName();

        // Close modal
        window.GameState.setState({ activeModal: null, modalData: {} });

        // Resolve combo with target and named card
        var result = window.Combo.resolveCombo(comboInfo, playerId, targetId, namedCard);
        if (!result.success) {
            console.log('[Events] Combo failed:', result.error);
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
        var state = window.GameState.getState();
        var modalData = state.modalData || {};
        var playerId = modalData.playerId;

        if (playerId === undefined) {
            console.log('[Events] Missing discard pick data');
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
        var gameScreen = document.getElementById('game-screen');
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
                var state = window.GameState.getState();
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
        var drawBtn = document.getElementById('draw-btn');
        if (drawBtn) drawBtn.addEventListener('click', handleDrawClick);

        // End turn button
        var endTurnBtn = document.getElementById('end-turn-btn');
        if (endTurnBtn) endTurnBtn.addEventListener('click', handleEndTurnClick);

        // Nope buttons
        var nopeYesBtn = document.getElementById('nope-yes-btn');
        if (nopeYesBtn) nopeYesBtn.addEventListener('click', function() { handleNopeResponse(true); });

        var nopeNoBtn = document.getElementById('nope-no-btn');
        if (nopeNoBtn) nopeNoBtn.addEventListener('click', function() { handleNopeResponse(false); });

        // Defuse confirm
        var defuseConfirmBtn = document.getElementById('defuse-confirm-btn');
        if (defuseConfirmBtn) defuseConfirmBtn.addEventListener('click', handleDefusePlace);

        // Combo confirm
        var comboConfirmBtn = document.getElementById('combo-confirm-btn');
        if (comboConfirmBtn) comboConfirmBtn.addEventListener('click', handleComboSubmit);

        // Three of a kind confirm
        var threeKindConfirmBtn = document.getElementById('three-kind-confirm-btn');
        if (threeKindConfirmBtn) threeKindConfirmBtn.addEventListener('click', handleThreeKindName);

        // Play again
        var playAgainBtn = document.getElementById('play-again-btn');
        if (playAgainBtn) playAgainBtn.addEventListener('click', handlePlayAgain);

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboard);

        console.log('[Module 12] Event listeners attached');
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

    console.log('[Module 12: Event Handler] Loaded ✓');
})();
