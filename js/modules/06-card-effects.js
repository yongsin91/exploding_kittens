/**
 * Module 6: Card Effect Resolver
 * 
 * Resolves individual card effects:
 * - Attack: pass multiple turns
 * - Skip: end turn without drawing (can counter Attack)
 * - Favor: force player to give random card
 * - Shuffle: shuffle draw pile
 * - See the Future: peek top 3 cards
 * - Defuse: place Exploding Kitten back in deck
 * - Exploding Kitten: only via draw (handled by Turn Engine)
 * - Cat Cards: no individual effect (handled by Combo Resolver)
 * 
 * @module CardEffects
 * @requires Modules 1, 3, 4, 5 (Constants, GameState, Player, TurnEngine)
 * @exports {Object} window.CardEffects with effect resolution methods
 */

(function() {
    'use strict';

    window.debug('[Module 6: Card Effect Resolver] Loading...');

    // Validate dependencies
    if (!window.CARD_TYPES || !window.GameState || !window.Player || !window.TurnEngine) {
        throw new Error('[Module 6] Missing dependencies. Modules 1, 3, 4, 5 required.');
    }

    // ========== EFFECT RESOLUTION ==========

    /**
     * Resolve a card's effect
     * Routes to specific effect handler based on card type
     * 
     * @param {string} cardType - Type of card being played
     * @param {number} playerId - Player playing the card
     * @param {number} targetId - Target player (if applicable)
     * @returns {Object} Effect result
     */
    function resolveCardEffect(cardType, playerId, targetId = null) {
        if (!cardType || typeof cardType !== 'string') {
            return {
                success: false,
                error: 'Invalid card type'
            };
        }

        const cardDef = window.CARD_TYPES[cardType];
        if (!cardDef) {
            return {
                success: false,
                error: `Unknown card type: ${cardType}`
            };
        }

        // Dispatch to specific handler
        switch (cardType) {
            case 'attack':
                return handleAttack(playerId);
            case 'skip':
                return handleSkip(playerId);
            case 'favor':
                return handleFavor(playerId, targetId);
            case 'shuffle':
                return handleShuffle(playerId);
            case 'see_the_future':
                return handleSeeTheFuture(playerId);
            case 'defuse':
                return handleDefuse(playerId);
            case 'nope':
                return handleNope(playerId);
            
            // Cat cards have no individual effect
            case 'tacocat':
            case 'cattermelon':
            case 'hairy_potato_cat':
            case 'beard_cat':
            case 'rainbow_cat':
                return {
                    success: true,
                    effectType: 'cat_card',
                    description: `${cardDef.name} played (check for combos)`
                };
            
            // Exploding Kitten is drawn only
            case 'exploding_kitten':
                return {
                    success: false,
                    error: 'Exploding Kitten cannot be played - only drawn'
                };

            default:
                return {
                    success: false,
                    error: `No effect handler for ${cardType}`
                };
        }
    }

    // ========== INDIVIDUAL EFFECT HANDLERS ==========

    /**
     * Attack effect: Next player gets 2 turns
     * @private
     */
    function handleAttack(playerId) {
        try {
            const player = window.Player.getPlayerById(playerId);
            if (!player) {
                return { success: false, error: 'Player not found' };
            }

            // Calculate turns to pass to next player
            // If under attack, pass remaining turns (minus 1 for this turn) + 2
            // If not under attack, just pass 2
            const state = window.GameState.getState();
            const currentRemaining = state.attackTurnsRemaining;
            const turnsToPass = (currentRemaining > 0 ? currentRemaining - 1 : 0) + 2;

            // Activate attack for next player
            window.TurnEngine.activateAttack(turnsToPass);

            window.GameState.logAction({
                type: 'CARD_PLAYED',
                cardType: 'attack',
                playerId,
                playerName: player.name,
                description: `${player.name} played Attack! Next player takes ${turnsToPass} turns.`
            });

            return {
                success: true,
                effectType: 'attack',
                turnsGranted: turnsToPass,
                targetPlayer: 'next',
                requiresNopeResolution: true
            };
        } catch (error) {
            console.error('[Module 6] handleAttack error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Skip effect: End turn without drawing
     * Under Attack, Skip ends ONE turn — remaining turns still owed
     * @private
     */
    function handleSkip(playerId) {
        try {
            const player = window.Player.getPlayerById(playerId);
            if (!player) {
                return { success: false, error: 'Player not found' };
            }

            const wasUnderAttack = window.TurnEngine.isUnderAttack();
            
            if (wasUnderAttack) {
                // Skip ends one attack turn, remaining turns are still owed
                // handleTurnEnd() will decrement attackTurnsRemaining and same player goes again if > 1
                window.GameState.logAction({
                    type: 'CARD_PLAYED',
                    cardType: 'skip',
                    playerId,
                    playerName: player.name,
                    description: `${player.name} played Skip to end one attack turn.`
                });

                return {
                    success: true,
                    effectType: 'skip',
                    cancelled: null,
                    requiresNopeResolution: true
                };
            } else {
                // Just skip the draw
                window.GameState.logAction({
                    type: 'CARD_PLAYED',
                    cardType: 'skip',
                    playerId,
                    playerName: player.name,
                    description: `${player.name} played Skip and skipped drawing a card.`
                });

                return {
                    success: true,
                    effectType: 'skip',
                    cancelled: null,
                    requiresNopeResolution: true
                };
            }
        } catch (error) {
            console.error('[Module 6] handleSkip error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Favor effect: Player chooses to steal card from target
     * @private
     */
    function handleFavor(playerId, targetId) {
        try {
            const player = window.Player.getPlayerById(playerId);
            const target = targetId !== null ? window.Player.getPlayerById(targetId) : null;

            if (!player) {
                return { success: false, error: 'Player not found' };
            }

            if (targetId !== null && !target) {
                return { success: false, error: 'Target player not found' };
            }

            window.GameState.logAction({
                type: 'CARD_PLAYED',
                cardType: 'favor',
                playerId,
                playerName: player.name,
                targetId,
                targetName: target ? target.name : 'unknown',
                description: `${player.name} played Favor on ${target ? target.name : 'someone'}`
            });

            return {
                success: true,
                effectType: 'favor',
                requiresUI: true, // Player must choose target and card
                requiresNopeResolution: true
            };
        } catch (error) {
            console.error('[Module 6] handleFavor error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Shuffle effect: Shuffle the draw pile
     * @private
     */
    function handleShuffle(playerId) {
        try {
            const player = window.Player.getPlayerById(playerId);
            if (!player) {
                return { success: false, error: 'Player not found' };
            }

            const state = window.GameState.getState();
            
            // Shuffle would be done by Module 2's shuffle function
            // For now, we just mark it in the log
            window.GameState.logAction({
                type: 'CARD_PLAYED',
                cardType: 'shuffle',
                playerId,
                playerName: player.name,
                description: `${player.name} played Shuffle and shuffled the deck!`
            });

            return {
                success: true,
                effectType: 'shuffle',
                description: 'Draw pile has been shuffled',
                requiresNopeResolution: true
            };
        } catch (error) {
            console.error('[Module 6] handleShuffle error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * See the Future effect: Peek top 3 cards of the draw pile.
     * 
     * IMPORTANT: The draw pile uses pop() to draw cards, meaning the LAST element
     * in the array (drawPile[drawPile.length - 1]) is the TOP of the deck 
     * (the next card to be drawn).
     * 
     * To get the top 3 cards in draw order (top first):
     * - slice(-3) returns [3rd-from-top, 2nd-from-top, top]
     * - .reverse() returns [top, 2nd-from-top, 3rd-from-top]
     * 
     * So peekedCards[0] = next card to be drawn (top of deck)
     *    peekedCards[1] = second card to be drawn
     *    peekedCards[2] = third card to be drawn
     * 
     * @private
     */
    function handleSeeTheFuture(playerId) {
        try {
            const player = window.Player.getPlayerById(playerId);
            if (!player) {
                return { success: false, error: 'Player not found' };
            }

            const state = window.GameState.getState();
            const peekCount = window.GAME_CONFIG.PEEK_CARD_COUNT || 3;
            // Draw pile uses pop() so last element = top of deck (next to draw)
            // slice(-3) = [3rd-from-top, 2nd-from-top, top]
            // .reverse() = [top, 2nd, 3rd] — correct draw order for display
            const topCards = state.drawPile.slice(-peekCount).reverse();

            window.GameState.setState({
                activeModal: 'peek-modal',
                modalData: {
                    playerId,
                    peekedCards: topCards
                }
            });

            window.GameState.logAction({
                type: 'CARD_PLAYED',
                cardType: 'see_the_future',
                playerId,
                playerName: player.name,
                description: `${player.name} played See the Future and peeked at the top ${peekCount} cards!`
            });

            return {
                success: true,
                effectType: 'see_the_future',
                peekedCards: topCards,
                peekCount,
                requiresUI: true, // Show peek modal
                requiresNopeResolution: true
            };
        } catch (error) {
            console.error('[Module 6] handleSeeTheFuture error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Defuse effect: Place drawn Exploding Kitten back in deck
     * Called when player uses Defuse after drawing EK
     * @private
     */
    function handleDefuse(playerId) {
        try {
            const player = window.Player.getPlayerById(playerId);
            if (!player) {
                return { success: false, error: 'Player not found' };
            }

            const state = window.GameState.getState();
            const ekCard = state.modalData.ekCard;

            if (!ekCard || ekCard.type !== 'exploding_kitten') {
                return { success: false, error: 'No Exploding Kitten to defuse' };
            }

            window.GameState.logAction({
                type: 'CARD_PLAYED',
                cardType: 'defuse',
                playerId,
                playerName: player.name,
                description: `${player.name} used Defuse to survive the Exploding Kitten!`
            });

            return {
                success: true,
                effectType: 'defuse',
                description: 'Defuse activated',
                requiresUI: true, // Show placement modal
                requiresNopeResolution: false
            };
        } catch (error) {
            console.error('[Module 6] handleDefuse error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Nope effect: Cancel a card effect
     * This is special - it responds to other cards being played
     * @private
     */
    function handleNope(playerId) {
        try {
            const player = window.Player.getPlayerById(playerId);
            if (!player) {
                return { success: false, error: 'Player not found' };
            }

            window.GameState.logAction({
                type: 'CARD_PLAYED',
                cardType: 'nope',
                playerId,
                playerName: player.name,
                description: `${player.name} played Nope!`
            });

            return {
                success: true,
                effectType: 'nope',
                description: 'The previous card effect has been cancelled!',
                cancelsCard: true
            };
        } catch (error) {
            console.error('[Module 6] handleNope error:', error);
            return { success: false, error: error.message };
        }
    }

    // ========== UTILITY FUNCTIONS ==========

    /**
     * Check if card effect requires Nope resolution
     * @param {string} cardType - Card type
     * @returns {boolean} True if Nope can be played
     */
    function canBeNoped(cardType) {
        const nopeableCards = [
            'attack', 'skip', 'favor', 'shuffle', 'see_the_future', 'nope'
        ];
        return nopeableCards.includes(cardType);
    }

    /**
     * Get card effect description
     * @param {string} cardType - Card type
     * @returns {string} Effect description
     */
    function getEffectDescription(cardType) {
        const cardDef = window.CARD_TYPES[cardType];
        
        if (!cardDef) {
            return 'Unknown card';
        }

        const descriptions = {
            'attack': 'Pass your turn to the next player. They take 2 turns.',
            'skip': 'End your turn without drawing a card.',
            'favor': 'Force any player to give you 1 card. They choose which card to give.',
            'shuffle': 'Shuffle the deck.',
            'see_the_future': 'Peek at the top 3 cards of the deck.',
            'defuse': 'When you draw an Exploding Kitten, you can play this to put it back.',
            'nope': 'Cancel an action (Attack, Skip, Favor, Shuffle, or See the Future).',
            'exploding_kitten': 'If you draw this and have no Defuse, you\'re out!',
            'tacocat': 'No effect. Used for Combos.',
            'cattermelon': 'No effect. Used for Combos.',
            'hairy_potato_cat': 'No effect. Used for Combos.',
            'beard_cat': 'No effect. Used for Combos.',
            'rainbow_cat': 'No effect. Used for Combos.'
        };

        return descriptions[cardType] || 'No description available';
    }

    // ========== PUBLIC API ==========

    window.CardEffects = Object.freeze({
        resolveCardEffect,
        getEffectDescription
    });

    window.debug('[Module 6: Card Effect Resolver] Loaded ✓');
})();
