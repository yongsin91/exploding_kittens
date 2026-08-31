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

    console.log('[Module 6: Card Effect Resolver] Loading...');

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

            // Activate attack mode
            window.TurnEngine.activateAttack(2);

            window.GameState.logAction({
                type: 'CARD_PLAYED',
                cardType: 'attack',
                playerId,
                playerName: player.name,
                description: `${player.name} played Attack! Next player gets 2 turns.`
            });

            return {
                success: true,
                effectType: 'attack',
                turnsGranted: 2,
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
     * Can also cancel Attack effect
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
                // Cancel attack
                window.TurnEngine.deactivateAttack();
                
                window.GameState.logAction({
                    type: 'CARD_PLAYED',
                    cardType: 'skip',
                    playerId,
                    playerName: player.name,
                    description: `${player.name} played Skip and cancelled the Attack!`
                });

                return {
                    success: true,
                    effectType: 'skip',
                    cancelled: 'attack',
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
     * See the Future effect: Peek top 3 cards
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
            const topCards = state.drawPile.slice(-peekCount).reverse(); // Top cards

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
            'favor': 'Another player must give you one random card from their hand.',
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
        canBeNoped,
        getEffectDescription
    });

    console.log('[Module 6: Card Effect Resolver] Loaded ✓');
})();
