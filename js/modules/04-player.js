/**
 * Module 4: Player Manager
 * 
 * Manages player data and operations:
 * - Player creation and initialization
 * - Hand management (add/remove/search cards)
 * - Player alive/dead status
 * - Turn counting and Attack mechanics
 * - Player elimination and filtering
 * 
 * @module Player
 * @requires Module 1 (Constants)
 * @requires Module 3 (GameState)
 * @exports {Object} window.Player with methods for player management
 */

(function() {
    'use strict';

    console.log('[Module 4: Player Manager] Loading...');

    // Validate dependencies
    if (!window.GAME_CONFIG) {
        throw new Error('[Module 4] GAME_CONFIG not found. Module 1 must be loaded first.');
    }
    if (!window.GameState) {
        throw new Error('[Module 4] GameState not found. Module 3 must be loaded first.');
    }

    // ========== PLAYER OBJECT DEFINITION ==========

    /**
     * Create a player object
     * @param {number} id - Unique player ID (0-indexed)
     * @param {string} name - Player name
     * @param {boolean} isAI - Whether this is an AI opponent
     * @returns {Object} Player object
     */
    function createPlayer(id, name, isAI = false) {
        if (!Number.isInteger(id) || id < 0) {
            throw new Error('createPlayer(): id must be a non-negative integer');
        }
        if (!name || typeof name !== 'string') {
            throw new Error('createPlayer(): name must be a non-empty string');
        }

        return {
            // Identity
            id,
            name,
            isAI,
            isHuman: !isAI,
            
            // Status
            isAlive: true,
            isEliminated: false,
            
            // Hand and cards
            hand: [], // Array of card instances
            
            // Turn mechanics
            turnCount: 0, // Number of turns taken
            consecutiveAttackTurns: 0, // Turns remaining in attack
            hasTakenTurn: false, // Whether player has acted this turn
            
            // Metadata
            joinedAt: new Date().toISOString(),
            lastCardPlayedAt: null,
            
            // Statistics (for future use)
            stats: {
                cardsPlayed: 0,
                cardsDrawn: 0,
                combosUsed: 0,
                nopesPlayed: 0,
                timesEliminated: 0
            }
        };
    }

    // ========== PLAYER HAND MANAGEMENT ==========

    /**
     * Add a card to a player's hand
     * Updates game state if needed
     * 
     * @param {number} playerId - Player ID
     * @param {Object} card - Card instance to add
     * @returns {boolean} Whether operation was successful
     */
    function addCardToHand(playerId, card) {
        if (!Number.isInteger(playerId)) {
            console.error('[Module 4] addCardToHand: playerId must be an integer');
            return false;
        }
        if (!card || typeof card !== 'object') {
            console.error('[Module 4] addCardToHand: card must be an object');
            return false;
        }

        try {
            return window.GameState.mutate(function(state) {
                const player = state.players[playerId];
                if (!player) {
                    console.error(`[Module 4] addCardToHand: Player ${playerId} not found`);
                    return;
                }
                player.hand.push(card);
                player.stats.cardsDrawn++;
            });
        } catch (error) {
            console.error('[Module 4] addCardToHand error:', error);
            return false;
        }
    }

    /**
     * Remove a card from a player's hand by instance ID
     * @param {number} playerId - Player ID
     * @param {string} cardInstanceId - Card instance ID to remove
     * @returns {Object|null} Removed card or null if not found
     */
    function removeCardFromHand(playerId, cardInstanceId) {
        if (!Number.isInteger(playerId)) {
            console.error('[Module 4] removeCardFromHand: playerId must be an integer');
            return null;
        }
        if (!cardInstanceId || typeof cardInstanceId !== 'string') {
            console.error('[Module 4] removeCardFromHand: cardInstanceId must be a string');
            return null;
        }

        try {
            let removedCard = null;
            const success = window.GameState.mutate(function(state) {
                const player = state.players[playerId];

                if (!player) {
                    console.error(`[Module 4] removeCardFromHand: Player ${playerId} not found`);
                    return;
                }

                const cardIndex = player.hand.findIndex(c => c.instanceId === cardInstanceId);
                
                if (cardIndex === -1) {
                    console.warn(`[Module 4] removeCardFromHand: Card ${cardInstanceId} not in hand`);
                    return;
                }

                removedCard = player.hand.splice(cardIndex, 1)[0];
            });

            return removedCard;
        } catch (error) {
            console.error('[Module 4] removeCardFromHand error:', error);
            return null;
        }
    }

    /**
     * Find a card in player's hand by type
     * @param {number} playerId - Player ID
     * @param {string} cardType - Card type to find
     * @returns {Object|null} First card of type or null
     */
    function findCardInHand(playerId, cardType) {
        if (!Number.isInteger(playerId)) {
            return null;
        }
        if (!cardType || typeof cardType !== 'string') {
            return null;
        }

        try {
            const state = window.GameState.getState();
            const player = state.players[playerId];

            if (!player) {
                return null;
            }

            return player.hand.find(c => c.type === cardType) || null;
        } catch (error) {
            console.error('[Module 4] findCardInHand error:', error);
            return null;
        }
    }

    /**
     * Get count of card type in player's hand
     * @param {number} playerId - Player ID
     * @param {string} cardType - Card type
     * @returns {number} Count of cards of type
     */
    function getCardCountByType(playerId, cardType) {
        if (!Number.isInteger(playerId)) {
            return 0;
        }
        if (!cardType || typeof cardType !== 'string') {
            return 0;
        }

        try {
            const state = window.GameState.getState();
            const player = state.players[playerId];

            if (!player) {
                return 0;
            }

            return player.hand.filter(c => c.type === cardType).length;
        } catch (error) {
            console.error('[Module 4] getCardCountByType error:', error);
            return 0;
        }
    }

    /**
     * Get player's current hand size
     * @param {number} playerId - Player ID
     * @returns {number} Hand size
     */
    function getHandSize(playerId) {
        if (!Number.isInteger(playerId)) {
            return 0;
        }

        try {
            const state = window.GameState.getState();
            const player = state.players[playerId];
            return player ? player.hand.length : 0;
        } catch (error) {
            return 0;
        }
    }

    // ========== PLAYER STATUS MANAGEMENT ==========

    /**
     * Mark a player as dead (drew Exploding Kitten without Defuse)
     * @param {number} playerId - Player ID
     * @returns {boolean} Whether operation was successful
     */
    function killPlayer(playerId) {
        if (!Number.isInteger(playerId)) {
            console.error('[Module 4] killPlayer: playerId must be an integer');
            return false;
        }

        try {
            window.GameState.mutate(function(state) {
                const player = state.players[playerId];

                if (!player) {
                    console.error(`[Module 4] killPlayer: Player ${playerId} not found`);
                    return;
                }

                player.isAlive = false;
                player.stats.timesEliminated++;
            });

            // Log action
            const player = window.Player.getPlayerById(playerId);
            window.GameState.logAction({
                type: 'PLAYER_ELIMINATED',
                playerId,
                playerName: player ? player.name : 'Unknown',
                description: `${player ? player.name : 'Player'} drew an Exploding Kitten without a Defuse`
            });

            return true;
        } catch (error) {
            console.error('[Module 4] killPlayer error:', error);
            return false;
        }
    }

    /**
     * Restore a player after using Defuse
     * @param {number} playerId - Player ID
     * @returns {boolean} Whether operation was successful
     */
    function revivePlayer(playerId) {
        if (!Number.isInteger(playerId)) {
            console.error('[Module 4] revivePlayer: playerId must be an integer');
            return false;
        }

        try {
            window.GameState.mutate(function(state) {
                const player = state.players[playerId];

                if (!player) {
                    console.error(`[Module 4] revivePlayer: Player ${playerId} not found`);
                    return;
                }

                if (player.isAlive) {
                    return; // Already alive
                }

                player.isAlive = true;
                player.isEliminated = false;
            });

            const player = window.Player.getPlayerById(playerId);
            window.GameState.logAction({
                type: 'PLAYER_REVIVED',
                playerId,
                playerName: player ? player.name : 'Unknown',
                description: `${player ? player.name : 'Player'} used a Defuse card`
            });

            return true;
        } catch (error) {
            console.error('[Module 4] revivePlayer error:', error);
            return false;
        }
    }

    // ========== PLAYER QUERIES ==========

    /**
     * Get the current active player
     * @returns {Object|null} Current player or null
     */
    function getActivePlayer() {
        try {
            const state = window.GameState.getState();
            const player = state.players[state.currentPlayerIndex];
            return player || null;
        } catch (error) {
            console.error('[Module 4] getActivePlayer error:', error);
            return null;
        }
    }

    /**
     * Get the next alive player (after current)
     * Handles elimination by skipping dead players
     * 
     * @returns {number} Index of next alive player
     */
    function getNextAlivePlayerIndex() {
        try {
            const state = window.GameState.getState();
            const currentIndex = state.currentPlayerIndex;
            const playerCount = state.players.length;

            if (playerCount === 0) {
                return -1;
            }

            let nextIndex = (currentIndex + 1) % playerCount;
            let checked = 0;

            // Find next alive player
            while (checked < playerCount) {
                if (state.players[nextIndex].isAlive) {
                    return nextIndex;
                }
                nextIndex = (nextIndex + 1) % playerCount;
                checked++;
            }

            return -1; // No alive players
        } catch (error) {
            console.error('[Module 4] getNextAlivePlayerIndex error:', error);
            return -1;
        }
    }

    /**
     * Get array of all alive players
     * @returns {Array} Array of alive player objects
     */
    function getAlivePlayers() {
        try {
            const state = window.GameState.getState();
            return state.players.filter(p => p.isAlive);
        } catch (error) {
            console.error('[Module 4] getAlivePlayers error:', error);
            return [];
        }
    }

    /**
     * Get alive players excluding a specific player
     * @param {number} excludeId - Player ID to exclude
     * @returns {Array} Array of alive players (excluding specified)
     */
    function getOtherAlivePlayers(excludeId) {
        if (!Number.isInteger(excludeId)) {
            return getAlivePlayers();
        }

        try {
            const state = window.GameState.getState();
            return state.players.filter(p => p.isAlive && p.id !== excludeId);
        } catch (error) {
            console.error('[Module 4] getOtherAlivePlayers error:', error);
            return [];
        }
    }

    /**
     * Get player by ID
     * @param {number} playerId - Player ID
     * @returns {Object|null} Player object or null
     */
    function getPlayerById(playerId) {
        if (!Number.isInteger(playerId)) {
            return null;
        }

        try {
            const state = window.GameState.getState();
            return state.players[playerId] || null;
        } catch (error) {
            console.error('[Module 4] getPlayerById error:', error);
            return null;
        }
    }

    /**
     * Get player count summary
     * @returns {Object} Summary with alive, dead, total counts
     */
    function getPlayerCountSummary() {
        try {
            const state = window.GameState.getState();
            const total = state.players.length;
            const alive = state.players.filter(p => p.isAlive).length;
            const dead = total - alive;

            return { total, alive, dead };
        } catch (error) {
            console.error('[Module 4] getPlayerCountSummary error:', error);
            return { total: 0, alive: 0, dead: 0 };
        }
    }

    // ========== PUBLIC API ==========

    window.Player = Object.freeze({
        createPlayer,
        addCardToHand,
        removeCardFromHand,
        findCardInHand,
        getCardCountByType,
        getHandSize,
        killPlayer,
        revivePlayer,
        getActivePlayer,
        getNextAlivePlayerIndex,
        getAlivePlayers,
        getOtherAlivePlayers,
        getPlayerById,
        getPlayerCountSummary
    });

    console.log('[Module 4: Player Manager] Loaded ✓');
})();
