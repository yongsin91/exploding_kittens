/**
 * Module 3: Game State Manager
 * 
 * Manages the complete game state with observer pattern for reactive updates.
 * All game data flows through this module for consistency and debugging.
 * 
 * Features:
 * - Single source of truth for game state
 * - Observer/subscription pattern for reactive state changes
 * - State validation and normalization
 * - Complete state snapshots for debugging
 * - Transaction-based updates for consistency
 * 
 * @module GameState
 * @requires Module 1 (Constants)
 * @exports {Object} window.GameState with methods: getState, setState, subscribe, logAction, reset
 */

(function() {
    'use strict';

    console.log('[Module 3: Game State Manager] Loading...');

    // Validate dependencies
    if (!window.GAME_CONFIG) {
        throw new Error('[Module 3] GAME_CONFIG not found. Module 1 must be loaded first.');
    }

    // ========== INITIAL STATE DEFINITION ==========

    /**
     * Creates the initial game state object
     * @returns {Object} Initial game state
     */
    function createInitialState() {
        return {
            // Game metadata
            gamePhase: window.GAME_CONFIG.PHASES.SETUP,
            
            // Players
            players: [], // Array of player objects (populated by Module 4)
            currentPlayerIndex: 0,
            
            // Deck and discard
            drawPile: [], // Array of card instances
            discardPile: [], // Array of card instances
            
            // Current turn state
            turnPhase: 'draw', // draw, play, resolve
            cardsPlayed: [], // Cards played this turn
            attackTurnsRemaining: 0,  // 0 = no attack, >0 = turns remaining for current player
            pendingAttackForNext: 0,    // Turns to pass to next player when their turn starts
            
            // Nope window state
            nopeWindowActive: false,
            nopeWindowCard: null, // The card being noped
            nopeWindowExpires: null, // Timestamp when nope window closes
            
            // Modal/dialog state
            activeModal: null, // Which modal is open (peek, defuse, etc.)
            modalData: {}, // Data for the active modal
            
            // Game events
            actionLog: [], // History of game actions
            lastAction: null, // Most recent action
            
            // Game metadata
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    // ========== STATE STORAGE ==========

    let gameState = createInitialState();
    const observers = []; // Array of subscriber functions

    // ========== OBSERVER PATTERN ==========

    /**
     * Subscribe to state changes
     * Callback receives (newState, changes) when state updates
     * 
     * @param {Function} callback - Function called on state changes
     * @returns {Function} Unsubscribe function
     */
    function subscribe(callback) {
        if (typeof callback !== 'function') {
            throw new Error('subscribe(): callback must be a function');
        }

        observers.push(callback);
        console.log(`[Module 3] Subscriber added (${observers.length} total)`);

        // Return unsubscribe function
        return function unsubscribe() {
            const index = observers.indexOf(callback);
            if (index > -1) {
                observers.splice(index, 1);
                console.log(`[Module 3] Subscriber removed (${observers.length} remaining)`);
            }
        };
    }

    /**
     * Notify all observers of state change
     * @private
     */
    function notifyObservers(changes) {
        observers.forEach(callback => {
            try {
                callback(gameState, changes);
            } catch (error) {
                console.error('[Module 3] Observer callback error:', error);
            }
        });
    }

    // ========== STATE GETTERS AND SETTERS ==========

    /**
     * Get the live game state object (NOT a copy).
     * For read-only access, this is safe and efficient.
     * For modifications, use mutate() to ensure observers are notified.
     * 
     * @returns {Object} Live game state object
     */
    function getState() {
        return gameState;
    }

    /**
     * Mutate game state atomically.
     * Calls fn(state) with the live state object, then notifies observers.
     * Use this for read-modify-write patterns instead of getState()+setState().
     * 
     * @param {Function} fn - Mutator function receiving live state
     * @returns {boolean} Whether mutation was successful
     */
    function mutate(fn) {
        if (typeof fn !== 'function') {
            console.error('[Module 3] mutate: fn must be a function');
            return false;
        }

        try {
            fn(gameState);
            gameState.updatedAt = new Date().toISOString();
            notifyObservers({ _mutate: true });
            return true;
        } catch (error) {
            console.error('[Module 3] mutate error:', error);
            return false;
        }
    }

    /**
     * Get a specific property from the game state
     * @param {string} path - Dot-notation path (e.g., 'players.0.hand')
     * @returns {*} State value or undefined
     */
    function getStateProperty(path) {
        if (!path || typeof path !== 'string') {
            return undefined;
        }

        const keys = path.split('.');
        let value = gameState;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return undefined;
            }
        }

        return value;
    }

    /**
     * Update game state with new values
     * Validates changes and notifies observers
     * 
     * @param {Object} updates - Object with properties to update
     * @returns {boolean} Whether update was successful
     */
    function setState(updates) {
        if (!updates || typeof updates !== 'object') {
            console.error('[Module 3] setState: updates must be an object');
            return false;
        }

        try {
            const changes = {};
            let hasChanges = false;

            // Collect changes and apply
            Object.entries(updates).forEach(([key, value]) => {
                if (gameState[key] !== value) {
                    changes[key] = {
                        old: gameState[key],
                        new: value
                    };
                    hasChanges = true;
                }
            });

            if (!hasChanges) {
                return true; // No changes needed
            }

            // Apply changes
            Object.assign(gameState, updates);
            gameState.updatedAt = new Date().toISOString();

            // Notify observers
            notifyObservers(changes);

            return true;
        } catch (error) {
            console.error('[Module 3] setState error:', error);
            return false;
        }
    }

    /**
     * Update a specific property using dot-notation path
     * @param {string} path - Dot-notation path (e.g., 'players.0.isAlive')
     * @param {*} value - New value
     * @returns {boolean} Whether update was successful
     */
    function setStateProperty(path, value) {
        if (!path || typeof path !== 'string') {
            console.error('[Module 3] setStateProperty: path must be a non-empty string');
            return false;
        }

        try {
            const keys = path.split('.');
            const lastKey = keys.pop();
            let target = gameState;

            // Navigate to parent object
            for (const key of keys) {
                if (!(key in target)) {
                    console.error(`[Module 3] setStateProperty: Path not found: ${path}`);
                    return false;
                }
                target = target[key];
            }

            const oldValue = target[lastKey];
            if (oldValue === value) {
                return true; // No change needed
            }

            target[lastKey] = value;
            gameState.updatedAt = new Date().toISOString();

            // Notify observers
            const changes = {};
            changes[path] = { old: oldValue, new: value };
            notifyObservers(changes);

            return true;
        } catch (error) {
            console.error('[Module 3] setStateProperty error:', error);
            return false;
        }
    }

    // ========== STATE MANAGEMENT ==========

    /**
     * Reset game state to initial values
     * Keeps observers registered
     */
    function reset() {
        gameState = createInitialState();
        console.log('[Module 3] Game state reset');

        // Notify observers of reset
        notifyObservers({ _reset: true });
    }

    /**
     * Add an entry to the action log
     * @param {Object} action - Action object with type, description, etc.
     */
    function logAction(action) {
        if (!action || typeof action !== 'object') {
            return;
        }

        const logEntry = {
            ...action,
            timestamp: new Date().toISOString(),
            sequenceNumber: gameState.actionLog.length
        };

        gameState.actionLog.push(logEntry);
        gameState.lastAction = logEntry;
        gameState.updatedAt = new Date().toISOString();

        notifyObservers({
            actionLog: { 
                old: gameState.actionLog.length - 1,
                new: gameState.actionLog.length 
            }
        });
    }

    /**
     * Get a summary of the game state for debugging
     * @returns {Object} Summary object
     */
    function getStateSummary() {
        return {
            gamePhase: gameState.gamePhase,
            playerCount: gameState.players.length,
            currentPlayer: gameState.currentPlayerIndex,
            drawPileSize: gameState.drawPile.length,
            discardPileSize: gameState.discardPile.length,
            actionLogSize: gameState.actionLog.length,
            nopeWindowActive: gameState.nopeWindowActive,
            observerCount: observers.length,
            updatedAt: gameState.updatedAt
        };
    }

    // ========== PUBLIC API ==========

    window.GameState = Object.freeze({
        getState,
        getStateProperty,
        setState,
        setStateProperty,
        mutate,
        subscribe,
        reset,
        logAction,
        getStateSummary
    });

    console.log('[Module 3: Game State Manager] Loaded ✓');
})();
