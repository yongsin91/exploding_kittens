/**
 * Module 5: Turn Engine
 * 
 * Orchestrates turn flow and phase management:
 * - Turn start/end logic
 * - Card drawing and validation
 * - Exploding Kitten defuse flow
 * - Attack turn chaining
 * - Skip under Attack handling
 * - Phase management (play, draw, nope-window, defuse-placement, peek)
 * 
 * @module TurnEngine
 * @requires Modules 1, 3, 4 (Constants, GameState, Player)
 * @exports {Object} window.TurnEngine with turn management methods
 */

(function() {
    'use strict';

    console.log('[Module 5: Turn Engine] Loading...');

    // Validate dependencies
    if (!window.GAME_CONFIG || !window.GameState || !window.Player) {
        throw new Error('[Module 5] Missing dependencies. Modules 1, 3, 4 required.');
    }

    // ========== TURN PHASE MANAGEMENT ==========

    /**
     * Get current turn phase
     * @returns {string} Current phase
     */
    function getTurnPhase() {
        return window.GameState.getStateProperty('turnPhase') || 'draw';
    }

    /**
     * Set turn phase
     * @param {string} phase - New phase (draw, play, resolve, nope-window, etc.)
     * @returns {boolean} Success status
     */
    function setTurnPhase(phase) {
        const validPhases = ['draw', 'play', 'resolve', 'nope-window', 'defuse-placement', 'peek', 'end'];
        
        if (!validPhases.includes(phase)) {
            console.error(`[Module 5] Invalid phase: ${phase}`);
            return false;
        }

        return window.GameState.setStateProperty('turnPhase', phase);
    }

    // ========== TURN START/END ==========

    /**
     * Start a player's turn
     * Resets turn state and sets phase to draw
     * 
     * @param {number} playerId - Player ID
     * @returns {boolean} Success status
     */
    function startTurn(playerId) {
        if (!Number.isInteger(playerId)) {
            console.error('[Module 5] startTurn: playerId must be integer');
            return false;
        }

        try {
            const state = window.GameState.getState();
            const player = window.Player.getPlayerById(playerId);

            if (!player) {
                console.error(`[Module 5] startTurn: Player ${playerId} not found`);
                return false;
            }

            if (!player.isAlive) {
                console.warn(`[Module 5] startTurn: Player ${playerId} is not alive`);
                return false;
            }

            // Update state
            const success = window.GameState.setState({
                currentPlayerIndex: playerId,
                turnPhase: 'draw',
                cardsPlayed: [],
                isAttackActive: state.isAttackActive,
                attackTurnsRemaining: Math.max(0, state.attackTurnsRemaining - 1)
            });

            if (success) {
                console.log(`[Module 5] Turn started: ${player.name} (Attack turns left: ${state.attackTurnsRemaining - 1})`);
                
                window.GameState.logAction({
                    type: 'TURN_START',
                    playerId,
                    playerName: player.name,
                    description: `${player.name}'s turn started`
                });
            }

            return success;
        } catch (error) {
            console.error('[Module 5] startTurn error:', error);
            return false;
        }
    }

    /**
     * End current player's turn and advance to next
     * @returns {boolean} Success status
     */
    function endTurn() {
        try {
            const state = window.GameState.getState();
            const currentPlayer = window.Player.getActivePlayer();

            if (!currentPlayer) {
                console.error('[Module 5] endTurn: No active player');
                return false;
            }

            // Log action
            window.GameState.logAction({
                type: 'TURN_END',
                playerId: currentPlayer.id,
                playerName: currentPlayer.name,
                cardsPlayed: state.cardsPlayed.length,
                description: `${currentPlayer.name}'s turn ended`
            });

            // Advance to next player
            return advanceToNextPlayer();
        } catch (error) {
            console.error('[Module 5] endTurn error:', error);
            return false;
        }
    }

    /**
     * Advance to next alive player
     * @returns {boolean} Success status
     */
    function advanceToNextPlayer() {
        try {
            const nextIndex = window.Player.getNextAlivePlayerIndex();

            if (nextIndex === -1) {
                console.error('[Module 5] advanceToNextPlayer: No alive players');
                return false;
            }

            const success = window.GameState.setState({ currentPlayerIndex: nextIndex });
            
            if (success) {
                const nextPlayer = window.Player.getPlayerById(nextIndex);
                console.log(`[Module 5] Advanced to next player: ${nextPlayer.name}`);
            }

            return success;
        } catch (error) {
            console.error('[Module 5] advanceToNextPlayer error:', error);
            return false;
        }
    }

    // ========== CARD DRAWING ==========

    /**
     * Draw a card from the deck
     * Handles Exploding Kitten draw and defuse placement
     * 
     * @param {number} playerId - Player ID
     * @returns {Object|null} Drawn card or null if failed
     */
    function drawCard(playerId) {
        if (!Number.isInteger(playerId)) {
            console.error('[Module 5] drawCard: playerId must be integer');
            return null;
        }

        try {
            const player = window.Player.getPlayerById(playerId);

            if (!player) {
                console.error(`[Module 5] drawCard: Player ${playerId} not found`);
                return null;
            }

            let drawnCard = null;
            let isExplodingKitten = false;

            // Draw top card via mutate
            window.GameState.mutate(function(state) {
                const drawPile = state.drawPile;
                if (drawPile.length === 0) {
                    return;
                }
                drawnCard = drawPile.pop();
            });

            if (!drawnCard) {
                console.error('[Module 5] drawCard: Draw pile is empty');
                return null;
            }

            // Add to player's hand
            window.Player.addCardToHand(playerId, drawnCard);

            // Log action
            window.GameState.logAction({
                type: 'CARD_DRAWN',
                playerId,
                playerName: player.name,
                cardType: drawnCard.type,
                cardEmoji: drawnCard.emoji,
                description: `${player.name} drew ${drawnCard.emoji} ${drawnCard.name}`
            });

            // Handle Exploding Kitten
            if (drawnCard.type === 'exploding_kitten') {
                console.log(`[Module 5] ⚠️ EXPLODING KITTEN DRAWN by ${player.name}`);

                // Check if player has Defuse
                const defuseCard = window.Player.findCardInHand(playerId, 'defuse');

                if (defuseCard) {
                    console.log(`[Module 5] ${player.name} has Defuse - entering defuse placement`);
                    
                    // Open defuse modal / enter defuse phase
                    window.GameState.setState({
                        turnPhase: 'defuse-placement',
                        activeModal: 'defuse-modal',
                        modalData: {
                            playerId,
                            ekCard: drawnCard,
                            defuseCard
                        }
                    });
                } else {
                    console.log(`[Module 5] ${player.name} has no Defuse - ELIMINATED`);
                    
                    // Remove from hand and discard
                    window.Player.removeCardFromHand(playerId, drawnCard.instanceId);
                    window.GameState.mutate(function(state) {
                        state.discardPile.push(drawnCard);
                    });
                    
                    // Kill player
                    window.Player.killPlayer(playerId);
                    
                    // Update state
                    window.GameState.setState({ turnPhase: 'end' });
                }
            } else {
                // Regular card - deck state already updated via mutate above
            }

            return { success: true, card: drawnCard };
        } catch (error) {
            console.error('[Module 5] drawCard error:', error);
            return { success: false, error: error.message, card: null };
        }
    }

    /**
     * Place Exploding Kitten back in draw pile (after using Defuse)
     * Player chooses position (handled by UI/Module 12)
     * 
     * @param {Object} ekCard - Exploding Kitten card
     * @param {number} position - Position in deck (0 = top, deck.length = bottom)
     * @returns {boolean} Success status
     */
    function placeExplodingKitten(ekCard, position = -1) {
        try {
            window.GameState.mutate(function(state) {
                const drawPile = state.drawPile;

                if (position < 0 || position > drawPile.length) {
                    position = drawPile.length; // Default to bottom
                }

                drawPile.splice(position, 0, ekCard);
            });
            
            console.log(`[Module 5] Exploding Kitten placed at position ${position} in deck`);

            return true;
        } catch (error) {
            console.error('[Module 5] placeExplodingKitten error:', error);
            return false;
        }
    }

    // ========== ATTACK MECHANICS ==========

    /**
     * Activate Attack mode (player gets extra turns)
     * @param {number} turns - Number of turns granted (usually 2)
     * @returns {boolean} Success status
     */
    function activateAttack(turns = 2) {
        return window.GameState.setState({
            isAttackActive: true,
            attackTurnsRemaining: turns
        });
    }

    /**
     * Deactivate Attack mode
     * @returns {boolean} Success status
     */
    function deactivateAttack() {
        return window.GameState.setState({
            isAttackActive: false,
            attackTurnsRemaining: 0
        });
    }

    /**
     * Check if current turn is under Attack
     * @returns {boolean} True if in Attack mode
     */
    function isUnderAttack() {
        const state = window.GameState.getState();
        return state.isAttackActive && state.attackTurnsRemaining > 0;
    }

    // ========== NOPE WINDOW ==========

    /**
     * Open Nope window (players can nope the card)
     * Lasts 5 seconds before auto-closing
     * 
     * @param {Object} card - Card being played
     * @returns {boolean} Success status
     */
    function openNopeWindow(card) {
        const expiresAt = new Date(Date.now() + window.GAME_CONFIG.NOPE_WINDOW_DURATION_MS).toISOString();

        return window.GameState.setState({
            nopeWindowActive: true,
            nopeWindowCard: card,
            nopeWindowExpires: expiresAt
        });
    }

    /**
     * Close Nope window
     * @returns {boolean} Success status
     */
    function closeNopeWindow() {
        return window.GameState.setState({
            nopeWindowActive: false,
            nopeWindowCard: null,
            nopeWindowExpires: null
        });
    }

    /**
     * Check if Nope window is still active
     * @returns {boolean} True if window still open
     */
    function isNopeWindowActive() {
        const state = window.GameState.getState();
        
        if (!state.nopeWindowActive) {
            return false;
        }

        // Check expiration
        if (state.nopeWindowExpires) {
            const expiresTime = new Date(state.nopeWindowExpires).getTime();
            if (Date.now() > expiresTime) {
                closeNopeWindow();
                return false;
            }
        }

        return true;
    }

    // ========== TURN SUMMARY ==========

    /**
     * Get current turn summary
     * @returns {Object} Turn state summary
     */
    function getTurnSummary() {
        const state = window.GameState.getState();
        const player = window.Player.getActivePlayer();

        return {
            currentPlayer: player ? player.name : 'None',
            playerId: player ? player.id : -1,
            phase: state.turnPhase,
            cardsPlayed: state.cardsPlayed.length,
            isAttackActive: state.isAttackActive,
            attackTurnsRemaining: state.attackTurnsRemaining,
            deckSize: state.drawPile.length,
            discardSize: state.discardPile.length,
            nopeWindowActive: state.nopeWindowActive
        };
    }

    // ========== PUBLIC API ==========

    window.TurnEngine = Object.freeze({
        startTurn,
        endTurn,
        advanceToNextPlayer,
        drawCard,
        placeExplodingKitten,
        getTurnPhase,
        setTurnPhase,
        activateAttack,
        deactivateAttack,
        isUnderAttack,
        openNopeWindow,
        closeNopeWindow,
        isNopeWindowActive,
        getTurnSummary
    });

    console.log('[Module 5: Turn Engine] Loaded ✓');
})();
