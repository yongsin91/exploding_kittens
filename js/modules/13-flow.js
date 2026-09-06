/**
 * Module 13: Game Flow Controller
 * 
 * Orchestrates complete game lifecycle:
 * - Game initialization and setup (deck creation, card dealing)
 * - Turn sequence management
 * - Win condition checking
 * - Game over state handling
 * - Restart/reset flow
 * - Mode-specific dispatch (AI vs hot-seat)
 * - Player death handling
 * 
 * AI turn execution is handled by Module 14 (AIController).
 * 
 * @module GameFlow
 * @requires All modules (1-12, 14)
 * @exports {Object} window.GameFlow
 */

(function() {
    'use strict';

    console.log('[Module 13: Game Flow Controller] Loading...');

    if (!window.GameState || !window.Player || !window.TurnEngine || !window.CardEffects || !window.Combo || !window.Nope || !window.UIRenderer || !window.Events) {
        throw new Error('[Module 13] Missing dependencies.');
    }

    // ========== STATE ==========

    let gameConfig = null;
    let isInitialized = false;

    // ========== GAME INITIALIZATION ==========

    /**
     * Initialize and start a new game.
     * @param {Object} config - Game configuration
     * @param {number} config.playerCount - Number of players (2-5)
     * @param {string} config.gameMode - 'ai' or 'hotseat'
     * @param {string} config.aiDifficulty - 'easy', 'medium', 'hard'
     * @param {string[]} config.playerNames - Array of player names
     */
    function initGame(config) {
        console.log('[GameFlow] Initializing game with config:', JSON.stringify(config));

        gameConfig = config;

        // 1. Reset game state
        window.GameState.reset();

        // 2. Set AI difficulty if in AI mode
        if (config.gameMode === 'ai' && window.AI) {
            window.AI.setDifficulty(config.aiDifficulty || 'medium');
        }

        // 3. Set hot-seat mode
        if (window.HotSeat) {
            window.HotSeat.setHotSeatMode(config.gameMode === 'hotseat');
        }

        // 4. Create players
        let players = [];
        for (let i = 0; i < config.playerCount; i++) {
            let isAI = config.gameMode === 'ai' && i > 0;
            let name = config.playerNames[i] || (isAI ? 'AI-' + i : 'Player ' + (i + 1));
            players.push(window.Player.createPlayer(i, name, isAI));
        }

        // 5. Create deck
        let deck = window.createDeck(config.playerCount);

        // 6. Remove Exploding Kittens and Defuses for initial dealing
        let ekResult = window.removeExplodingKittens(deck);
        deck = ekResult.cleanDeck;
        let defuseResult = window.removeDefuses(deck);
        deck = defuseResult.cleanDeck;

        // 7. Shuffle clean deck
        deck = window.shuffle(deck);

        // 8. Set initial game state with players (so Player module can find them)
        // In AI mode, always make the human player (index 0) go first for deterministic UX
        // In hot-seat mode, randomize the first player
        let firstPlayerIndex = config.gameMode === 'ai' ? 0 : Math.floor(Math.random() * players.length);
        window.GameState.setState({
            players: players,
            currentPlayerIndex: firstPlayerIndex,
            drawPile: [],
            discardPile: [],
            gamePhase: 'active',
            turnPhase: 'action',
            cardsPlayed: [],
            attackTurnsRemaining: 0,
            pendingAttackForNext: 0,
            nopeWindowActive: false,
            nopeWindowCard: null,
            nopeWindowExpires: null,
            activeModal: null,
            modalData: {},
            actionLog: [],
            lastAction: null
        });

        // 9. Deal 4 cards + 1 Defuse to each player
        for (let p = 0; p < players.length; p++) {
            for (let c = 0; c < 4; c++) {
                if (deck.length > 0) {
                    window.Player.addCardToHand(p, deck.pop());
                }
            }
            // Give each player a Defuse from the removed defuses
            if (defuseResult.removedDefuses.length > 0) {
                window.Player.addCardToHand(p, defuseResult.removedDefuses.pop());
            }
        }

        // 10. Insert Exploding Kittens (playerCount - 1)
        let ekCount = config.playerCount - 1;
        let eksToInsert = ekResult.removedKittens.slice(0, ekCount);
        deck = deck.concat(eksToInsert);

        // 11. Insert remaining Defuses (from removed pool)
        let remainingDefuses = defuseResult.removedDefuses;
        deck = deck.concat(remainingDefuses);

        // 12. Shuffle final deck
        deck = window.shuffle(deck);

        // 13. Set draw pile in game state
        window.GameState.setState({ drawPile: deck });

        // 14. Log game start
        window.GameState.logAction({
            type: 'GAME_START',
            description: 'Game started with ' + config.playerCount + ' players'
        });

        // 15. Show game screen
        if (window.GameApp) {
            window.GameApp.showScreen('game-screen');
        }

        // 16. Initialize UI and events
        if (window.UIRenderer) {
            window.UIRenderer.init();
        }
        if (window.Events && !isInitialized) {
            window.Events.init();
            isInitialized = true;
        }

        // 16. Start first turn
        startTurn(firstPlayerIndex);

        console.log('[GameFlow] Game initialized successfully');
    }

    // ========== TURN MANAGEMENT ==========

    /**
     * Start a turn for the given player.
     * @param {number} playerId
     */
    function startTurn(playerId) {
        let state = window.GameState.getState();
        let player = state.players[playerId];

        if (!player || !player.isAlive) {
            // Skip dead players
            handleTurnEnd();
            return;
        }

        window.GameState.setState({ currentPlayerIndex: playerId });
        window.TurnEngine.startTurn(playerId);

        // Hot-seat: show pass screen
        if (window.HotSeat && window.HotSeat.isHotSeatMode()) {
            window.HotSeat.onTurnStart(playerId);
        }

        // AI turn: dispatch to AI controller
        if (player.isAI && window.AIController) {
            window.AIController.handleAITurn(playerId);
        }
    }

    /**
     * Handle end of turn — check win, advance to next player.
     */
    function handleTurnEnd() {
        // Check win condition first
        if (checkWinCondition()) {
            return;
        }

        // Advance to next player
        let nextIndex = window.Player.getNextAlivePlayerIndex();
        if (nextIndex === -1) {
            console.log('[GameFlow] No alive players found');
            endGame(null);
            return;
        }

        // Handle attack turns — same player goes again if they still owe turns
        let state = window.GameState.getState();
        if (state.attackTurnsRemaining > 1) {
            // Current player still has attack turns remaining
            window.GameState.setState({
                attackTurnsRemaining: state.attackTurnsRemaining - 1
            });
            startTurn(state.currentPlayerIndex);
            return;
        }

        // Attack turns exhausted (or no attack) — advance to next player
        if (state.attackTurnsRemaining > 0) {
            window.TurnEngine.deactivateAttack();
        }

        startTurn(nextIndex);
    }

    // ========== WIN CONDITION ==========

    /**
     * Check if win condition is met (only 1 alive player).
     * @returns {boolean} true if game over
     */
    function checkWinCondition() {
        let alivePlayers = window.Player.getAlivePlayers();
        if (alivePlayers.length <= 1) {
            let winner = alivePlayers.length === 1 ? alivePlayers[0] : null;
            endGame(winner);
            return true;
        }
        return false;
    }

    /**
     * End the game with a winner.
     * @param {Object} winner - Winning player or null
     */
    function endGame(winner) {
        window.GameState.setState({
            gamePhase: 'game-over',
            activeModal: null
        });

        window.GameState.logAction({
            type: 'GAME_OVER',
            description: winner ? winner.name + ' wins!' : 'Game over — no winner'
        });

        if (window.UIRenderer) {
            window.UIRenderer.forceRender();
        }

        console.log('[GameFlow] Game over. Winner:', winner ? winner.name : 'None');
    }

    // ========== PLAYER DEATH ==========

    /**
     * Handle player death — check win, advance turn if needed.
     * @param {number} playerId
     */
    function handlePlayerDeath(playerId) {
        let state = window.GameState.getState();
        let player = state.players[playerId];

        window.GameState.logAction({
            type: 'PLAYER_ELIMINATED',
            playerId: playerId,
            description: player.name + ' exploded and is eliminated!'
        });

        if (window.AI) {
            window.AI.clearPeekMemory(playerId);
        }

        if (checkWinCondition()) {
            return;
        }

        if (state.currentPlayerIndex === playerId) {
            handleTurnEnd();
        }
    }

    // ========== RESTART ==========

    /**
     * Restart game — return to setup screen.
     */
    function restartGame() {
        console.log('[GameFlow] Restarting game...');

        window.GameState.reset();
        if (window.HotSeat) {
            window.HotSeat.reset();
        }
        if (window.Nope) {
            window.Nope.forceCloseNopeWindow();
        }

        if (window.GameApp) {
            window.GameApp.resetToSetupScreen();
        }
    }

    // ========== EFFECT EXECUTION ==========

    /**
     * Central effect executor — checks nope resolution and executes.
     * @param {Object} effectResult - Result from CardEffects.resolveCardEffect
     * @param {number} playerId
     */
    function executeEffect(effectResult, playerId) {
        if (!effectResult || !effectResult.success) return;

        if (effectResult.requiresNopeResolution) {
            let resolver = function() {
                if (window.AIController) {
                    window.AIController.handleEffectPost(effectResult, playerId);
                } else {
                    window.UIRenderer.forceRender();
                }
            };

            window.Nope.openNopeWindow({
                type: 'play-card',
                cardType: effectResult.effectType,
                playerId: playerId,
                description: 'Effect: ' + (effectResult.description || effectResult.effectType),
                resolver: resolver
            });
        } else {
            if (window.AIController) {
                window.AIController.handleEffectPost(effectResult, playerId);
            } else {
                window.UIRenderer.forceRender();
            }
        }
    }

    // ========== HOT-SEAT TRANSITION ==========

    /**
     * Handle hot-seat turn transition.
     * @param {number} playerId
     */
    function handleHotSeatTransition(playerId) {
        if (window.HotSeat && window.HotSeat.isHotSeatMode()) {
            window.HotSeat.onTurnStart(playerId);
        }
    }

    // ========== PUBLIC API ==========

    window.GameFlow = Object.freeze({
        initGame: initGame,
        startTurn: startTurn,
        handleTurnEnd: handleTurnEnd,
        handlePlayerDeath: handlePlayerDeath,
        checkWinCondition: checkWinCondition,
        endGame: endGame,
        restartGame: restartGame,
        executeEffect: executeEffect,
        handleHotSeatTransition: handleHotSeatTransition
    });

    console.log('[Module 13: Game Flow Controller] Loaded ✓');
})();
