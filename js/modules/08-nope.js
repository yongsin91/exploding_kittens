/**
 * Module 8: Nope / Counter-Play System
 * 
 * Manages Nope card resolution and action cancellation:
 * - Opens Nope window when a nopeable action is played
 * - Allows other players to counter with Nope cards
 * - Stacks counter-Nopes (Yup mechanics)
 * - Resolves based on odd/even Nope count
 * - Handles AI Nope decisions (from Module 9)
 * - Handles hot-seat Nope prompts (from Module 11)
 * 
 * Nope Stack Rules:
 * - Odd number of Nopes → action CANCELLED
 * - Even number of Nopes (including 0) → action PROCEEDS
 * 
 * Resolver Callback Pattern:
 * - When openNopeWindow is called, a `resolver` function is stored in pendingAction
 * - When the nope window closes and the action proceeds, `resolver()` is called
 * - If the action is cancelled, the resolver is NOT called; cards go to discard
 * 
 * @module Nope
 * @requires Modules 1, 3, 4, 5 (Constants, GameState, Player, TurnEngine)
 * @exports {Object} window.Nope with nope resolution methods
 */

(function() {
    'use strict';

    console.log('[Module 8: Nope / Counter-Play System] Loading...');

    // Validate dependencies
    if (!window.GAME_CONFIG || !window.GameState || !window.Player || !window.TurnEngine) {
        throw new Error('[Module 8] Missing dependencies. Modules 1, 3, 4, 5 required.');
    }

    // ========== INTERNAL STATE ==========

    /**
     * The pending action awaiting Nope resolution.
     * @private
     */
    let pendingAction = null;

    /**
     * Stack of Nope cards played in response to the pending action.
     * Each entry: { playerId, playerName, cardInstanceId, card }
     * @private
     */
    let nopeStack = [];

    /**
     * Timeout ID for auto-close (AI mode).
     * @private
     */
    let autoCloseTimeout = null;

    // ========== NOPE WINDOW MANAGEMENT ==========

    /**
     * Open a Nope window for a pending action.
     * Other alive players (not the original actor) can play Nope cards.
     * 
     * @param {Object} action - The action to potentially nope
     * @param {Function} action.resolver - Callback to execute if action proceeds (not noped)
     * @param {string} action.type - 'card' or 'combo'
     * @param {number} action.playerId - Player who played the original action
     * @param {Array} action.cards - Cards played (for discard if cancelled)
     * @param {string} action.description - Human-readable description
     * @param {number} [action.targetId] - Target player ID
     * @param {string} [action.cardType] - Card type (for card actions)
     * @param {Object} [action.comboInfo] - Combo info (for combo actions)
     * @param {string} [action.namedCard] - Named card (for three of a kind)
     * @param {Function} [action.onComplete] - Callback always called when nope window closes (noped or not)
     * @returns {boolean} Success status
     */
    function openNopeWindow(action) {
        if (!action || typeof action.resolver !== 'function') {
            console.error('[Module 8] openNopeWindow: action with resolver function required');
            return false;
        }

        if (!Number.isInteger(action.playerId)) {
            console.error('[Module 8] openNopeWindow: playerId must be an integer');
            return false;
        }

        try {
            pendingAction = {
                type: action.type || 'card',
                cardType: action.cardType || null,
                comboInfo: action.comboInfo || null,
                cards: action.cards || [],
                playerId: action.playerId,
                targetId: action.targetId !== undefined ? action.targetId : null,
                namedCard: action.namedCard || null,
                resolver: action.resolver,
                onComplete: action.onComplete || null,
                description: action.description || 'An action was played'
            };

            nopeStack = [];

            const cardForWindow = action.cards && action.cards.length > 0
                ? action.cards[0]
                : { type: action.cardType || 'combo', emoji: '🃏', name: action.description || 'Action' };

            window.TurnEngine.openNopeWindow(cardForWindow);
            window.TurnEngine.setTurnPhase('nope-window');

            window.GameState.setState({
                activeModal: 'nope-modal',
                modalData: {
                    pendingAction: {
                        type: pendingAction.type,
                        description: pendingAction.description,
                        playerId: pendingAction.playerId,
                        targetId: pendingAction.targetId
                    },
                    nopeStack: [],
                    eligiblePlayers: getEligibleNopePlayers()
                }
            });

            console.log(`[Module 8] Nope window opened for: ${pendingAction.description}`);

            scheduleAINopeChecks();

            return true;
        } catch (error) {
            console.error('[Module 8] openNopeWindow error:', error);
            return false;
        }
    }

    /**
     * A player plays a Nope card to counter the pending action.
     * The original player (or any other alive player) can then counter-nope.
     * 
     * @param {number} playerId - Player playing the Nope
     * @returns {boolean} Success status
     */
    function playNope(playerId) {
        if (!Number.isInteger(playerId)) {
            console.error('[Module 8] playNope: playerId must be an integer');
            return false;
        }

        if (!pendingAction) {
            console.error('[Module 8] playNope: No pending action to nope');
            return false;
        }

        try {
            const player = window.Player.getPlayerById(playerId);

            if (!player) {
                console.error(`[Module 8] playNope: Player ${playerId} not found`);
                return false;
            }

            if (!player.isAlive) {
                console.warn(`[Module 8] playNope: Player ${playerId} is not alive`);
                return false;
            }

            // Can't nope your own nope
            const lastNope = nopeStack[nopeStack.length - 1];
            if (lastNope && lastNope.playerId === playerId) {
                console.warn(`[Module 8] playNope: ${player.name} cannot nope their own nope`);
                return false;
            }

            // Before the first nope, the original actor cannot nope their own action
            if (nopeStack.length === 0 && playerId === pendingAction.playerId) {
                console.warn(`[Module 8] playNope: ${player.name} cannot nope their own action`);
                return false;
            }

            // Check player has a Nope card
            const nopeCard = window.Player.findCardInHand(playerId, 'nope');
            if (!nopeCard) {
                console.warn(`[Module 8] playNope: ${player.name} has no Nope card`);
                return false;
            }

            // Remove Nope card from hand
            const removedCard = window.Player.removeCardFromHand(playerId, nopeCard.instanceId);
            if (!removedCard) {
                console.error(`[Module 8] playNope: Failed to remove Nope card from ${player.name}`);
                return false;
            }

            // Push to nope stack
            nopeStack.push({
                playerId,
                playerName: player.name,
                cardInstanceId: removedCard.instanceId,
                card: removedCard
            });

            // Update player stats
            const statePlayer = window.Player.getPlayerById(playerId);
            if (statePlayer) {
                window.GameState.mutate(function(state) {
                    const p = state.players[playerId];
                    if (p) {
                        p.stats.nopesPlayed = (p.stats.nopesPlayed || 0) + 1;
                    }
                });
            }

            // Log the nope
            const nopeCount = nopeStack.length;
            const actionWord = nopeCount % 2 === 1 ? 'NOPE!' : 'YUP!';
            window.GameState.logAction({
                type: 'NOPE_PLAYED',
                playerId,
                playerName: player.name,
                nopeCount,
                description: `${player.name} played Nope! (${nopeCount} ${nopeCount === 1 ? 'nope' : 'nopes'} → ${actionWord})`
            });

            // Update modal data with current nope stack
            window.GameState.setState({
                modalData: {
                    pendingAction: {
                        type: pendingAction.type,
                        description: pendingAction.description,
                        playerId: pendingAction.playerId,
                        targetId: pendingAction.targetId
                    },
                    nopeStack: nopeStack.map(n => ({
                        playerId: n.playerId,
                        playerName: n.playerName
                    })),
                    eligiblePlayers: getEligibleNopePlayers()
                }
            });

            console.log(`[Module 8] ${player.name} played Nope! Stack: ${nopeStack.length} (${isActionNoped() ? 'CANCELLED' : 'PROCEEDS'})`);

            scheduleAINopeChecks();

            return true;
        } catch (error) {
            console.error('[Module 8] playNope error:', error);
            return false;
        }
    }

    /**
     * Close the Nope window and resolve the pending action.
     * - Odd number of Nopes → action CANCELLED (cards to discard, resolver NOT called)
     * - Even number of Nopes → action PROCEEDS (resolver called)
     * 
     * @returns {Object} Resolution result: { cancelled, executed, nopeCount, action }
     */
    function closeNopeWindow() {
        if (!pendingAction) {
            console.warn('[Module 8] closeNopeWindow: No pending action');
            return { cancelled: false, executed: false, error: 'No pending action' };
        }

        try {
            if (autoCloseTimeout) {
                clearTimeout(autoCloseTimeout);
                autoCloseTimeout = null;
            }

            const noped = isActionNoped();
            const action = pendingAction;

            // Move all Nope cards to discard pile
            const stack = nopeStack.slice();
            window.GameState.mutate(function(state) {
                stack.forEach(nope => {
                    state.discardPile.push(nope.card);
                });

                // Move original action cards to discard pile
                if (action.cards && action.cards.length > 0) {
                    action.cards.forEach(card => {
                        state.discardPile.push(card);
                    });
                }
            });

            // Close the nope window in TurnEngine
            window.TurnEngine.closeNopeWindow();

            // Clear modal
            window.GameState.setState({
                activeModal: null,
                modalData: {}
            });

            // Set phase back to play
            window.TurnEngine.setTurnPhase('play');

            let result;

            if (noped) {
                console.log(`[Module 8] Action CANCELLED by ${stack.length} nope(s): ${action.description}`);

                window.GameState.logAction({
                    type: 'NOPE_RESOLVED',
                    result: 'cancelled',
                    nopeCount: stack.length,
                    description: `Action cancelled! (${stack.length} nope${stack.length === 1 ? '' : 's'})`
                });

                result = {
                    cancelled: true,
                    executed: false,
                    nopeCount: stack.length,
                    action: action.description
                };
            } else {
                console.log(`[Module 8] Action PROCEEDS (${stack.length} nope(s)): ${action.description}`);

                window.GameState.logAction({
                    type: 'NOPE_RESOLVED',
                    result: 'executed',
                    nopeCount: stack.length,
                    description: stack.length === 0
                        ? `No one noped — action proceeds: ${action.description}`
                        : `Action proceeds after ${stack.length} nope${stack.length === 1 ? '' : 's'} (even = yup!): ${action.description}`
                });

                try {
                    action.resolver();
                } catch (resolverError) {
                    console.error('[Module 8] Resolver callback error:', resolverError);
                }

                result = {
                    cancelled: false,
                    executed: true,
                    nopeCount: stack.length,
                    action: action.description
                };
            }

            pendingAction = null;
            nopeStack = [];

            // Call onComplete callback if provided (always called, noped or not)
            if (action.onComplete) {
                try {
                    action.onComplete(result);
                } catch (onCompleteError) {
                    console.error('[Module 8] onComplete callback error:', onCompleteError);
                }
            }

            return result;
        } catch (error) {
            console.error('[Module 8] closeNopeWindow error:', error);
            return { cancelled: false, executed: false, error: error.message };
        }
    }

    // ========== QUERY FUNCTIONS ==========

    /**
     * Check if the pending action is currently noped (odd nope count)
     * @returns {boolean} True if action would be cancelled
     */
    function isActionNoped() {
        return nopeStack.length % 2 === 1;
    }

    /**
     * Get the current nope stack
     * @returns {Array} Array of nope entries (copies)
     */
    function getNopeStack() {
        return nopeStack.map(n => ({ ...n }));
    }

    /**
     * Get the current pending action (copy, without resolver for safety)
     * @returns {Object|null} Pending action or null
     */
    function getPendingAction() {
        if (!pendingAction) return null;
        const { resolver, ...safe } = pendingAction;
        return safe;
    }

    /**
     * Check if a player can play a Nope card.
     * @param {number} playerId - Player ID to check
     * @returns {boolean} True if player can nope
     */
    function canPlayerNope(playerId) {
        if (!Number.isInteger(playerId) || !pendingAction) {
            return false;
        }

        const player = window.Player.getPlayerById(playerId);
        if (!player || !player.isAlive) {
            return false;
        }

        const hasNope = window.Player.findCardInHand(playerId, 'nope');
        if (!hasNope) {
            return false;
        }

        const lastNope = nopeStack[nopeStack.length - 1];
        if (lastNope && lastNope.playerId === playerId) {
            return false;
        }

        if (nopeStack.length === 0 && playerId === pendingAction.playerId) {
            return false;
        }

        return true;
    }

    /**
     * Get list of players eligible to play a Nope
     * @returns {Array} Array of { id, name } for eligible players
     */
    function getEligibleNopePlayers() {
        if (!pendingAction) {
            return [];
        }

        const alivePlayers = window.Player.getAlivePlayers();
        return alivePlayers
            .filter(p => canPlayerNope(p.id))
            .map(p => ({ id: p.id, name: p.name }));
    }

    /**
     * Check if the nope window is currently active
     * @returns {boolean} True if nope window is open
     */
    function isNopeWindowActive() {
        return pendingAction !== null && window.TurnEngine.isNopeWindowActive();
    }

    /**
     * Get a summary of the current nope state for debugging
     * @returns {Object} Nope state summary
     */
    function getNopeSummary() {
        return {
            hasPendingAction: pendingAction !== null,
            actionDescription: pendingAction ? pendingAction.description : null,
            actionType: pendingAction ? pendingAction.type : null,
            actionPlayerId: pendingAction ? pendingAction.playerId : null,
            nopeCount: nopeStack.length,
            isActionNoped: isActionNoped(),
            eligiblePlayers: getEligibleNopePlayers(),
            nopeStack: nopeStack.map(n => ({
                playerId: n.playerId,
                playerName: n.playerName
            }))
        };
    }

    // ========== AI INTEGRATION ==========

    /**
     * Schedule AI nope checks for all AI players.
     * If the AI module (Module 9) is loaded, it will be consulted.
     * Otherwise, the nope window auto-closes after a delay.
     * @private
     */
    function scheduleAINopeChecks() {
        if (!pendingAction) {
            return;
        }

        if (autoCloseTimeout) {
            clearTimeout(autoCloseTimeout);
        }

        const aiAvailable = typeof window.AI !== 'undefined' && typeof window.AI.getAINopeDecision === 'function';

        if (aiAvailable) {
            const eligibleAI = getEligibleNopePlayers().filter(p => {
                const player = window.Player.getPlayerById(p.id);
                return player && player.isAI;
            });

            if (eligibleAI.length > 0) {
                autoCloseTimeout = setTimeout(() => {
                    processAINopeDecisions();
                }, 1000);
            } else {
                const eligibleHumans = getEligibleNopePlayers().filter(p => {
                    const player = window.Player.getPlayerById(p.id);
                    return player && !player.isAI;
                });

                if (eligibleHumans.length === 0) {
                    autoCloseTimeout = setTimeout(() => {
                        if (pendingAction) {
                            closeNopeWindow();
                        }
                    }, 500);
                }
                // If human players are eligible, wait for their input via UI
            }
        } else {
            // AI module not loaded — auto-close after delay if no human can nope
            autoCloseTimeout = setTimeout(() => {
                if (pendingAction) {
                    const eligible = getEligibleNopePlayers();
                    if (eligible.length === 0) {
                        closeNopeWindow();
                    }
                    // Otherwise wait for UI interaction
                }
            }, 2000);
        }
    }

    /**
     * Process AI nope decisions for all eligible AI players.
     * @private
     */
    function processAINopeDecisions() {
        if (!pendingAction || !window.AI || typeof window.AI.getAINopeDecision !== 'function') {
            return;
        }

        const eligibleAI = getEligibleNopePlayers().filter(p => {
            const player = window.Player.getPlayerById(p.id);
            return player && player.isAI;
        });

        for (const eligible of eligibleAI) {
            const player = window.Player.getPlayerById(eligible.id);
            if (!player) continue;

            try {
                const shouldNope = window.AI.getAINopeDecision(player.id, {
                    type: pendingAction.type,
                    cardType: pendingAction.cardType,
                    comboInfo: pendingAction.comboInfo,
                    playerId: pendingAction.playerId,
                    targetId: pendingAction.targetId,
                    description: pendingAction.description,
                    currentNopeCount: nopeStack.length
                });

                if (shouldNope) {
                    console.log(`[Module 8] AI ${player.name} decided to NOPE`);
                    playNope(player.id);
                    scheduleAINopeChecks();
                    return;
                }
            } catch (error) {
                console.error(`[Module 8] AI nope decision error for ${player.name}:`, error);
            }
        }

        // No AI wants to nope — check if human players can still nope
        const eligibleHumans = getEligibleNopePlayers().filter(p => {
            const player = window.Player.getPlayerById(p.id);
            return player && !player.isAI;
        });

        if (eligibleHumans.length === 0) {
            closeNopeWindow();
        }
        // If human players are eligible, wait for their input via UI
    }

    // ========== HOT-SEAT / UI INTEGRATION ==========

    /**
     * Handle a human player's nope response from the UI.
     * Called when a player clicks "Nope" or "Don't Nope" in the nope modal.
     * 
     * @param {boolean} wantNope - Whether the player wants to nope
     * @param {number} playerId - Player ID responding
     * @returns {boolean} Success status
     */
    function handleNopeResponse(wantNope, playerId) {
        if (!pendingAction) {
            return false;
        }

        if (wantNope) {
            return playNope(playerId);
        } else {
            console.log(`[Module 8] Player ${playerId} declined to nope`);

            const eligible = getEligibleNopePlayers().filter(p => p.id !== playerId);

            if (eligible.length === 0) {
                closeNopeWindow();
            }

            return true;
        }
    }

    /**
     * Force-close the nope window (e.g., "No one wants to nope" button).
     * @returns {Object} Resolution result
     */
    function forceCloseNopeWindow() {
        return closeNopeWindow();
    }

    // ========== PUBLIC API ==========

    window.Nope = Object.freeze({
        openNopeWindow,
        playNope,
        closeNopeWindow,
        forceCloseNopeWindow,
        isActionNoped,
        getNopeStack,
        getPendingAction,
        canPlayerNope,
        getEligibleNopePlayers,
        isNopeWindowActive,
        getNopeSummary,
        handleNopeResponse
    });

    console.log('[Module 8: Nope / Counter-Play System] Loaded ✓');
})();
