/**
 * Module 14: AI Turn Controller
 * 
 * Manages AI player turn execution:
 * - AI turn dispatch with natural pacing delays
 * - AI card play with nope window integration
 * - AI combo play with nope window integration
 * - AI multi-card play (up to 3 per turn)
 * - AI draw and defuse/explode handling
 * - Post-effect handling (shuffle, see the future)
 * 
 * Extracted from Module 13 (Game Flow) to separate AI concerns from
 * general game lifecycle management.
 * 
 * @module AIController
 * @requires Modules 1, 3, 4, 5, 6, 7, 8, 9, 10, 13
 * @exports {Object} window.AIController
 */

(function() {
    'use strict';

    console.log('[Module 14: AI Turn Controller] Loading...');

    if (!window.GameState || !window.Player || !window.TurnEngine || !window.CardEffects || !window.Combo || !window.Nope || !window.AI) {
        throw new Error('[Module 14] Missing dependencies.');
    }

    // ========== CONSTANTS ==========

    var MAX_PLAYS_PER_TURN = 3;
    var AI_TURN_DELAY_MS = 1500;

    // ========== AI TURN DISPATCH ==========

    /**
     * Handle AI turn with delay for natural pacing.
     * @param {number} playerId - AI player ID
     */
    function handleAITurn(playerId) {
        setTimeout(function() {
            var state = window.GameState.getState();
            if (state.currentPlayerIndex !== playerId) return;
            if (state.gamePhase !== 'active') return;

            var player = state.players[playerId];
            if (!player || !player.isAlive) {
                window.GameFlow.handleTurnEnd();
                return;
            }

            var decision = window.AI.aiTakeTurn(playerId);

            if (decision.action === 'play') {
                executeAIPlay(playerId, decision);
            } else {
                executeAIDraw(playerId);
            }
        }, AI_TURN_DELAY_MS);
    }

    // ========== AI CARD PLAY ==========

    /**
     * Execute AI play decision.
     * Supports multi-card play: after playing a card, re-evaluates if AI wants to play more.
     * @param {number} playerId - AI player ID
     * @param {Object} decision - AI decision from getAIDecision
     */
    function executeAIPlay(playerId, decision) {
        var state = window.GameState.getState();
        var player = state.players[playerId];

        if (decision.combo) {
            executeAICombo(playerId, decision, player);
        } else {
            executeAISingleCard(playerId, decision, player);
        }

        // After playing (non-nopeable, non-turn-ending), check if AI wants to play more
        scheduleNextAIAction(playerId);
    }

    /**
     * Execute AI combo play.
     * @private
     */
    function executeAICombo(playerId, decision, player) {
        var cards = decision.comboCards.map(function(id) {
            return player.hand.find(function(c) { return c.instanceId === id; });
        }).filter(Boolean);

        var comboInfo = window.Combo.detectCombo(cards);
        if (!comboInfo) return;

        window.Combo.removeComboCards(playerId, decision.comboCards);
        window.GameState.mutate(function(s) {
            s.cardsPlayed.push('combo:' + comboInfo.comboType);
        });

        var result = window.Combo.resolveCombo(comboInfo, playerId, decision.targetId, decision.namedCard);
        console.log('[AIController] AI combo result:', result);

        if (result.requiresNopeResolution && window.Nope) {
            window.Nope.openNopeWindow({
                type: 'combo',
                cardType: comboInfo.comboType,
                comboInfo: comboInfo,
                playerId: playerId,
                targetId: decision.targetId,
                description: player.name + ' plays ' + comboInfo.comboType,
                resolver: function() {
                    window.UIRenderer.forceRender();
                },
                onComplete: function() {
                    scheduleNextAIAction(playerId);
                }
            });
        }
    }

    /**
     * Execute AI single card play.
     * @private
     */
    function executeAISingleCard(playerId, decision, player) {
        var card = player.hand.find(function(c) { return c.instanceId === decision.cardInstanceId; });
        if (!card) return;

        window.Player.removeCardFromHand(playerId, decision.cardInstanceId);
        window.GameState.mutate(function(s) {
            s.discardPile.push(card);
            s.cardsPlayed.push(card.instanceId);
        });

        var effectResult = window.CardEffects.resolveCardEffect(decision.cardType, playerId, decision.targetId);
        console.log('[AIController] AI card effect:', effectResult);

        if (effectResult.requiresNopeResolution && window.Nope) {
            window.Nope.openNopeWindow({
                type: 'play-card',
                cardType: card.type,
                playerId: playerId,
                targetId: decision.targetId,
                description: player.name + ' plays ' + (card.name || card.type),
                resolver: function() {
                    handleEffectPost(effectResult, playerId);

                    if (card.type === 'skip' || card.type === 'attack') {
                        window.GameFlow.handleTurnEnd();
                    }
                },
                onComplete: function(nopeResult) {
                    var currentState = window.GameState.getState();
                    if (currentState.gamePhase !== 'active') return;

                    if (nopeResult.cancelled) {
                        scheduleNextAIAction(playerId);
                    } else if (card.type !== 'skip' && card.type !== 'attack') {
                        scheduleNextAIAction(playerId);
                    }
                }
            });
        } else {
            // Not nopeable — execute effect directly
            handleEffectPost(effectResult, playerId);

            if (card.type === 'skip' || card.type === 'attack') {
                window.GameFlow.handleTurnEnd();
            }
        }
    }

    // ========== AI MULTI-CARD SCHEDULING ==========

    /**
     * Schedule the next AI action: play more cards or draw.
     * @param {number} playerId - AI player ID
     */
    function scheduleNextAIAction(playerId) {
        setTimeout(function() {
            var state = window.GameState.getState();
            if (state.gamePhase !== 'active') return;
            if (state.currentPlayerIndex !== playerId) return;

            var playsThisTurn = state.cardsPlayed ? state.cardsPlayed.length : 0;
            if (playsThisTurn >= MAX_PLAYS_PER_TURN) {
                executeAIDraw(playerId);
                return;
            }

            var player = state.players[playerId];
            if (!player || !player.isAlive) {
                window.GameFlow.handleTurnEnd();
                return;
            }

            var decision = window.AI.aiTakeTurn(playerId);
            if (decision.action === 'play') {
                executeAIPlay(playerId, decision);
            } else {
                executeAIDraw(playerId);
            }
        }, AI_TURN_DELAY_MS);
    }

    // ========== AI DRAW ==========

    /**
     * Execute AI draw — handles Exploding Kitten encounter.
     * @param {number} playerId - AI player ID
     */
    function executeAIDraw(playerId) {
        var result = window.TurnEngine.drawCard(playerId);
        if (!result.success) {
            console.log('[AIController] AI draw failed:', result.error);
            window.GameFlow.handleTurnEnd();
            return;
        }

        if (result.card && result.card.type === 'exploding_kitten') {
            var state = window.GameState.getState();
            var player = state.players[playerId];
            var hasDefuse = player.hand.some(function(c) { return c.type === 'defuse'; });

            if (hasDefuse) {
                var defuseCard = player.hand.find(function(c) { return c.type === 'defuse'; });
                window.Player.removeCardFromHand(playerId, defuseCard.instanceId);
                window.GameState.mutate(function(s) {
                    s.discardPile.push(defuseCard);
                });

                var position = window.AI.aiChooseDefusePosition(state.drawPile.length);
                window.TurnEngine.placeExplodingKitten(result.card, position);

                window.GameState.logAction({
                    type: 'DEFUSED',
                    playerId: playerId,
                    description: player.name + ' defused the Exploding Kitten'
                });

                window.GameFlow.handleTurnEnd();
            } else {
                window.Player.killPlayer(playerId);
                window.GameFlow.handlePlayerDeath(playerId);
            }
        } else {
            window.GameFlow.handleTurnEnd();
        }
    }

    // ========== POST-EFFECT HANDLING ==========

    /**
     * Handle post-resolution effects for AI card plays.
     * This is the consolidated version that handles:
     * - Shuffle: actually shuffle the draw pile
     * - See the Future: store peek cards in AI memory
     * 
     * @param {Object} effectResult - Result from CardEffects.resolveCardEffect
     * @param {number} playerId - AI player ID
     */
    function handleEffectPost(effectResult, playerId) {
        if (!effectResult || !effectResult.success) return;

        if (effectResult.effectType === 'shuffle') {
            window.GameState.mutate(function(state) {
                state.drawPile = window.shuffle(state.drawPile);
            });
            window.UIRenderer.forceRender();
        }

        if (effectResult.effectType === 'see_future' && window.AI) {
            var state = window.GameState.getState();
            var peekedCards = state.drawPile.slice(-3).reverse();
            window.AI.rememberPeekedCards(playerId, peekedCards);
        }
    }

    // ========== PUBLIC API ==========

    window.AIController = Object.freeze({
        handleAITurn: handleAITurn,
        executeAIPlay: executeAIPlay,
        executeAIDraw: executeAIDraw,
        scheduleNextAIAction: scheduleNextAIAction,
        handleEffectPost: handleEffectPost
    });

    console.log('[Module 14: AI Turn Controller] Loaded ✓');
})();