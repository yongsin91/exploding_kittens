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
 * - AI turn dispatch
 * 
 * @module GameFlow
 * @requires All modules (1-12)
 * @exports {Object} window.GameFlow
 */

(function() {
    'use strict';

    console.log('[Module 13: Game Flow Controller] Loading...');

    if (!window.GameState || !window.Player || !window.TurnEngine || !window.CardEffects || !window.Combo || !window.Nope || !window.UIRenderer || !window.Events) {
        throw new Error('[Module 13] Missing dependencies.');
    }

    // ========== STATE ==========

    var gameConfig = null;
    var isInitialized = false;

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
        var players = [];
        for (var i = 0; i < config.playerCount; i++) {
            var isAI = config.gameMode === 'ai' && i > 0;
            var name = config.playerNames[i] || (isAI ? 'AI-' + i : 'Player ' + (i + 1));
            players.push(window.Player.createPlayer(i, name, isAI));
        }

        // 5. Create deck
        var deck = window.createDeck(config.playerCount);

        // 6. Remove Exploding Kittens and Defuses for initial dealing
        var ekResult = window.removeExplodingKittens(deck);
        deck = ekResult.cleanDeck;
        var defuseResult = window.removeDefuses(deck);
        deck = defuseResult.cleanDeck;

        // 7. Shuffle clean deck
        deck = window.shuffle(deck);

        // 8. Set initial game state with players (so Player module can find them)
        // In AI mode, always make the human player (index 0) go first for deterministic UX
        // In hot-seat mode, randomize the first player
        var firstPlayerIndex = config.gameMode === 'ai' ? 0 : Math.floor(Math.random() * players.length);
        window.GameState.setState({
            players: players,
            currentPlayerIndex: firstPlayerIndex,
            drawPile: [],
            discardPile: [],
            gamePhase: 'active',
            turnPhase: 'draw',
            cardsPlayed: [],
            isAttackActive: false,
            attackTurnsRemaining: 0,
            nopeWindowActive: false,
            nopeWindowCard: null,
            nopeWindowExpires: null,
            activeModal: null,
            modalData: {},
            actionLog: [],
            lastAction: null
        });

        // 9. Deal 4 cards + 1 Defuse to each player
        for (var p = 0; p < players.length; p++) {
            for (var c = 0; c < 4; c++) {
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
        var ekCount = config.playerCount - 1;
        var eksToInsert = ekResult.removedKittens.slice(0, ekCount);
        deck = deck.concat(eksToInsert);

        // 11. Insert remaining Defuses (from removed pool)
        var remainingDefuses = defuseResult.removedDefuses;
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
        var state = window.GameState.getState();
        var player = state.players[playerId];

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

        // AI turn: dispatch to AI
        if (player.isAI && window.AI) {
            handleAITurn(playerId);
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
        var nextIndex = window.Player.getNextAlivePlayerIndex();
        if (nextIndex === -1) {
            console.log('[GameFlow] No alive players found');
            endGame(null);
            return;
        }

        // Handle attack turns
        var state = window.GameState.getState();
        if (state.isAttackActive && state.attackTurnsRemaining > 0) {
            // Same player goes again
            var remaining = state.attackTurnsRemaining - 1;
            if (remaining > 0) {
                window.TurnEngine.activateAttack(remaining);
                startTurn(state.currentPlayerIndex);
                return;
            } else {
                window.TurnEngine.deactivateAttack();
            }
        }

        startTurn(nextIndex);
    }

    // ========== AI TURN ==========

    /**
     * Handle AI turn with delay for natural pacing.
     * @param {number} playerId
     */
    function handleAITurn(playerId) {
        setTimeout(function() {
            var state = window.GameState.getState();
            if (state.currentPlayerIndex !== playerId) return; // State changed

            var player = state.players[playerId];
            if (!player || !player.isAlive) {
                handleTurnEnd();
                return;
            }

            var decision = window.AI.aiTakeTurn(playerId);

            if (decision.action === 'play') {
                executeAIPlay(playerId, decision);
            } else {
                // Draw
                executeAIDraw(playerId);
            }
        }, 1500); // 1.5 second delay
    }

    /**
     * Execute AI play decision.
     * @private
     */
    function executeAIPlay(playerId, decision) {
        var state = window.GameState.getState();
        var player = state.players[playerId];

        if (decision.combo) {
            // Execute combo
            var cards = decision.comboCards.map(function(id) {
                return player.hand.find(function(c) { return c.instanceId === id; });
            }).filter(Boolean);

            var comboInfo = window.Combo.detectCombo(cards);
            if (comboInfo) {
                window.Combo.removeComboCards(playerId, decision.comboCards);
                var result = window.Combo.resolveCombo(comboInfo, playerId, decision.targetId, decision.namedCard);
                console.log('[GameFlow] AI combo result:', result);
            }
        } else {
            // Play single card
            var card = player.hand.find(function(c) { return c.instanceId === decision.cardInstanceId; });
            if (card) {
                window.Player.removeCardFromHand(playerId, decision.cardInstanceId);
                window.GameState.mutate(function(state) {
                    state.discardPile.push(card);
                });

                var effectResult = window.CardEffects.resolveCardEffect(decision.cardType, playerId, decision.targetId);
                console.log('[GameFlow] AI card effect:', effectResult);

                // Handle nope for AI plays
                if (effectResult.requiresNopeResolution) {
                    // Check if any human players want to nope
                    // For now, proceed with effect
                    handleEffectUI(effectResult, playerId);
                } else {
                    handleEffectUI(effectResult, playerId);
                }
            }
        }

        // After playing, AI can play more or draw
        // For simplicity, AI draws after one play
        setTimeout(function() {
            executeAIDraw(playerId);
        }, 1000);
    }

    /**
     * Execute AI draw.
     * @private
     */
    function executeAIDraw(playerId) {
        var result = window.TurnEngine.drawCard(playerId);
        if (!result.success) {
            console.log('[GameFlow] AI draw failed:', result.error);
            handleTurnEnd();
            return;
        }

        // Check if drew Exploding Kitten
        if (result.card && result.card.type === 'exploding_kitten') {
            var state = window.GameState.getState();
            var player = state.players[playerId];
            var hasDefuse = player.hand.some(function(c) { return c.type === 'defuse'; });

            if (hasDefuse) {
                // AI defuses
                var defuseCard = player.hand.find(function(c) { return c.type === 'defuse'; });
                window.Player.removeCardFromHand(playerId, defuseCard.instanceId);
                window.GameState.mutate(function(state) {
                    state.discardPile.push(defuseCard);
                });

                var position = window.AI.aiChooseDefusePosition(state.drawPile.length);
                window.TurnEngine.placeExplodingKitten(result.card, position);

                window.GameState.logAction({
                    type: 'DEFUSED',
                    playerId: playerId,
                    description: player.name + ' defused the Exploding Kitten'
                });

                // AI continues turn (can play more or end)
                handleTurnEnd();
            } else {
                // AI explodes
                window.Player.killPlayer(playerId);
                handlePlayerDeath(playerId);
            }
        } else {
            handleTurnEnd();
        }
    }

    /**
     * Handle effect UI for AI plays.
     * @private
     */
    function handleEffectUI(effectResult, playerId) {
        if (!effectResult.success) return;

        // For Shuffle, actually shuffle the draw pile
        if (effectResult.effectType === 'shuffle') {
            window.GameState.mutate(function(state) {
                state.drawPile = window.shuffle(state.drawPile);
            });
            window.UIRenderer.forceRender();
        }

        // For See the Future, AI remembers the cards
        if (effectResult.effectType === 'see_future' && window.AI) {
            var state = window.GameState.getState();
            var peekedCards = state.drawPile.slice(-3).reverse();
            window.AI.rememberPeekedCards(playerId, peekedCards);
        }
    }

    // ========== WIN CONDITION ==========

    /**
     * Check if win condition is met (only 1 alive player).
     * @returns {boolean} true if game over
     */
    function checkWinCondition() {
        var alivePlayers = window.Player.getAlivePlayers();
        if (alivePlayers.length <= 1) {
            var winner = alivePlayers.length === 1 ? alivePlayers[0] : null;
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

        // UIRenderer will show game over screen
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
        var state = window.GameState.getState();
        var player = state.players[playerId];

        window.GameState.logAction({
            type: 'PLAYER_ELIMINATED',
            playerId: playerId,
            description: player.name + ' exploded and is eliminated!'
        });

        // Clear AI peek memory
        if (window.AI) {
            window.AI.clearPeekMemory(playerId);
        }

        // Check win condition
        if (checkWinCondition()) {
            return;
        }

        // If current player died, advance turn
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

        // Reset all modules
        window.GameState.reset();
        if (window.HotSeat) {
            window.HotSeat.reset();
        }
        if (window.Nope) {
            window.Nope.forceCloseNopeWindow();
        }

        // Return to setup screen
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
            // Open nope window with resolver
            var resolver = function() {
                handleEffectUI(effectResult, playerId);
            };

            window.Nope.openNopeWindow({
                type: 'play-card',
                cardType: effectResult.effectType,
                playerId: playerId,
                description: 'Effect: ' + (effectResult.description || effectResult.effectType),
                resolver: resolver
            });
        } else {
            handleEffectUI(effectResult, playerId);
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
        handleAITurn: handleAITurn,
        handlePlayerDeath: handlePlayerDeath,
        checkWinCondition: checkWinCondition,
        endGame: endGame,
        restartGame: restartGame,
        executeEffect: executeEffect,
        handleHotSeatTransition: handleHotSeatTransition
    });

    console.log('[Module 13: Game Flow Controller] Loaded ✓');
})();
