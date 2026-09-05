/**
 * Module 7: Combo Resolver
 * 
 * Manages card combo detection and resolution:
 * - Two of a Kind: 2 same corner icons → steal random card
 * - Three of a Kind: 3 same corner icons → name card to steal
 * - Five Different: 5 different corner icons → pick from discard pile
 * 
 * Combo Rules:
 * - All combos subject to Nope resolution
 * - Five Different must resolve before Nope window
 * 
 * @module Combo
 * @requires Modules 1, 3, 4 (Constants, GameState, Player)
 * @exports {Object} window.Combo with combo detection/resolution methods
 */

(function() {
    'use strict';

    console.log('[Module 7: Combo Resolver] Loading...');

    // Validate dependencies
    if (!window.CARD_TYPES || !window.COMBO_TYPES || !window.GameState || !window.Player) {
        throw new Error('[Module 7] Missing dependencies. Modules 1, 3, 4 required.');
    }

    // ========== COMBO DETECTION ==========

    /**
     * Detect if cards form a combo
     * Returns combo type if found, null otherwise
     * 
     * @param {Array} cards - Array of card objects
     * @returns {Object|null} Combo info or null
     */
    function detectCombo(cards) {
        if (!Array.isArray(cards) || cards.length === 0) {
            return null;
        }

        // Check for Five Different first (highest value combo)
        const fiveDifferent = detectFiveDifferent(cards);
        if (fiveDifferent) {
            return fiveDifferent;
        }

        // Check for Three of a Kind
        const threeOfAKind = detectThreeOfAKind(cards);
        if (threeOfAKind) {
            return threeOfAKind;
        }

        // Check for Two of a Kind
        const twoOfAKind = detectTwoOfAKind(cards);
        if (twoOfAKind) {
            return twoOfAKind;
        }

        return null;
    }

    /**
     * Detect Two of a Kind combo (2 cards with same corner icon)
     * @private
     */
    function detectTwoOfAKind(cards) {
        // Filter cards with corner icons only
        const iconCards = cards.filter(c => c.cornerIcon);

        if (iconCards.length < 2) {
            return null;
        }

        // Group by corner icon
        const groups = {};
        iconCards.forEach(card => {
            if (!groups[card.cornerIcon]) {
                groups[card.cornerIcon] = [];
            }
            groups[card.cornerIcon].push(card);
        });

        // Find first icon with 2+ cards
        for (const [icon, cardsWithIcon] of Object.entries(groups)) {
            if (cardsWithIcon.length >= 2) {
                return {
                    type: 'two_of_a_kind',
                    comboType: 'two_of_a_kind',
                    icon,
                    cards: cardsWithIcon.slice(0, 2),
                    cardCount: cardsWithIcon.length,
                    action: 'steal_random',
                    description: `Two ${icon}s! Steal a random card from target.`
                };
            }
        }

        return null;
    }

    /**
     * Detect Three of a Kind combo (3 cards with same corner icon)
     * @private
     */
    function detectThreeOfAKind(cards) {
        // Filter cards with corner icons only
        const iconCards = cards.filter(c => c.cornerIcon);

        if (iconCards.length < 3) {
            return null;
        }

        // Group by corner icon
        const groups = {};
        iconCards.forEach(card => {
            if (!groups[card.cornerIcon]) {
                groups[card.cornerIcon] = [];
            }
            groups[card.cornerIcon].push(card);
        });

        // Find first icon with 3+ cards
        for (const [icon, cardsWithIcon] of Object.entries(groups)) {
            if (cardsWithIcon.length >= 3) {
                return {
                    type: 'three_of_a_kind',
                    comboType: 'three_of_a_kind',
                    icon,
                    cards: cardsWithIcon.slice(0, 3),
                    cardCount: cardsWithIcon.length,
                    action: 'steal_named',
                    description: `Three ${icon}s! Name a card to steal from target.`
                };
            }
        }

        return null;
    }

    /**
     * Detect Five Different combo (5 cards with different corner icons)
     * @private
     */
    function detectFiveDifferent(cards) {
        // Filter cards with corner icons only
        const iconCards = cards.filter(c => c.cornerIcon);

        if (iconCards.length < 5) {
            return null;
        }

        // Get unique icons
        const uniqueIcons = new Set();
        const usedCards = [];

        for (const card of iconCards) {
            if (!uniqueIcons.has(card.cornerIcon)) {
                uniqueIcons.add(card.cornerIcon);
                usedCards.push(card);

                if (uniqueIcons.size === 5) {
                    // Found 5 different icons
                    return {
                        type: 'five_different',
                        comboType: 'five_different',
                        icons: Array.from(uniqueIcons),
                        cards: usedCards,
                        action: 'pick_from_discard',
                        description: `Five Different! Pick a card from the discard pile.`
                    };
                }
            }
        }

        return null;
    }

    // ========== COMBO RESOLUTION ==========

    /**
     * Resolve a detected combo
     * Routes to specific combo handler
     * 
     * @param {Object} comboInfo - Combo info from detectCombo()
     * @param {number} playerId - Player playing the combo
     * @param {number} targetId - Target player (if applicable)
     * @param {string} namedCard - Named card (for Three of a Kind)
     * @returns {Object} Combo result
     */
    function resolveCombo(comboInfo, playerId, targetId = null, namedCard = null) {
        if (!comboInfo || !comboInfo.type) {
            return {
                success: false,
                error: 'Invalid combo info'
            };
        }

        const player = window.Player.getPlayerById(playerId);
        if (!player) {
            return { success: false, error: 'Player not found' };
        }

        try {
            switch (comboInfo.type) {
                case 'two_of_a_kind':
                    return resolveTwoOfAKind(comboInfo, playerId, targetId);

                case 'three_of_a_kind':
                    return resolveThreeOfAKind(comboInfo, playerId, targetId, namedCard);

                case 'five_different':
                    return resolveFiveDifferent(comboInfo, playerId);

                default:
                    return { success: false, error: `Unknown combo type: ${comboInfo.type}` };
            }
        } catch (error) {
            console.error('[Module 7] resolveCombo error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Resolve Two of a Kind combo
     * Player steals a random card from target
     * @private
     */
    function resolveTwoOfAKind(comboInfo, playerId, targetId) {
        const player = window.Player.getPlayerById(playerId);
        const target = targetId !== null ? window.Player.getPlayerById(targetId) : null;

        if (!target || !target.isAlive) {
            return {
                success: false,
                error: 'Invalid target'
            };
        }

        // Get random card from target's hand
        const targetHand = target.hand;
        if (targetHand.length === 0) {
            return {
                success: true,
                comboType: 'two_of_a_kind',
                stolenCard: null,
                description: `${target.name}'s hand is empty!`,
                requiresNopeResolution: true
            };
        }

        const randomIndex = Math.floor(Math.random() * targetHand.length);
        const stolenCard = targetHand[randomIndex];

        // Transfer card
        window.Player.removeCardFromHand(targetId, stolenCard.instanceId);
        window.Player.addCardToHand(playerId, stolenCard);

        window.GameState.logAction({
            type: 'COMBO_RESOLVED',
            comboType: 'two_of_a_kind',
            playerId,
            playerName: player.name,
            targetId,
            targetName: target.name,
            stolenCard: stolenCard.type,
            description: `${player.name} played Two ${comboInfo.icon}s and stole ${stolenCard.emoji} from ${target.name}!`
        });

        return {
            success: true,
            comboType: 'two_of_a_kind',
            stolenCard,
            targetName: target.name,
            description: `${player.name} stole ${stolenCard.emoji} from ${target.name}!`,
            requiresNopeResolution: true
        };
    }

    /**
     * Resolve Three of a Kind combo
     * Player names a card type and steals it from target
     * @private
     */
    function resolveThreeOfAKind(comboInfo, playerId, targetId, namedCard) {
        const player = window.Player.getPlayerById(playerId);
        const target = targetId !== null ? window.Player.getPlayerById(targetId) : null;

        if (!target || !target.isAlive) {
            return {
                success: false,
                error: 'Invalid target'
            };
        }

        if (!namedCard) {
            return {
                success: false,
                requiresUI: true,
                error: 'Must name a card type'
            };
        }

        // Find named card in target's hand
        const cardToSteal = window.Player.findCardInHand(targetId, namedCard);

        if (!cardToSteal) {
            return {
                success: true,
                comboType: 'three_of_a_kind',
                stolenCard: null,
                namedCard,
                description: `${target.name} doesn't have a ${namedCard}!`,
                requiresNopeResolution: true
            };
        }

        // Transfer card
        window.Player.removeCardFromHand(targetId, cardToSteal.instanceId);
        window.Player.addCardToHand(playerId, cardToSteal);

        window.GameState.logAction({
            type: 'COMBO_RESOLVED',
            comboType: 'three_of_a_kind',
            playerId,
            playerName: player.name,
            targetId,
            targetName: target.name,
            namedCard,
            stolenCard: cardToSteal.type,
            description: `${player.name} played Three ${comboInfo.icon}s and stole ${cardToSteal.emoji} from ${target.name}!`
        });

        return {
            success: true,
            comboType: 'three_of_a_kind',
            stolenCard: cardToSteal,
            namedCard,
            targetName: target.name,
            description: `${player.name} stole the ${cardToSteal.emoji} from ${target.name}!`,
            requiresNopeResolution: true
        };
    }

    /**
     * Resolve Five Different combo
     * Player picks a card from the discard pile
     * @private
     */
    function resolveFiveDifferent(comboInfo, playerId) {
        const player = window.Player.getPlayerById(playerId);
        const state = window.GameState.getState();

        if (state.discardPile.length === 0) {
            return {
                success: true,
                comboType: 'five_different',
                pickedCard: null,
                description: 'Discard pile is empty!',
                requiresNopeResolution: false // Five Different bypasses nope window
            };
        }

        // Open discard browser modal
        window.GameState.setState({
            activeModal: 'discard-browser-modal',
            modalData: {
                playerId,
                discardPile: state.discardPile,
                comboType: 'five_different'
            }
        });

        window.GameState.logAction({
            type: 'COMBO_ACTIVATED',
            comboType: 'five_different',
            playerId,
            playerName: player.name,
            description: `${player.name} played Five Different! Opening discard pile selection...`
        });

        return {
            success: true,
            comboType: 'five_different',
            description: 'Five Different! Pick a card from the discard pile.',
            requiresUI: true,
            requiresNopeResolution: true // Five Different IS nopeable per official rules
        };
    }

    /**
     * Player picks a card from discard pile (after Five Different)
     * @param {number} playerId - Player ID
     * @param {string} cardInstanceId - Instance ID of card to pick
     * @returns {Object} Result
     */
    function pickFromDiscard(playerId, cardInstanceId) {
        const player = window.Player.getPlayerById(playerId);

        if (!player) {
            return { success: false, error: 'Player not found' };
        }

        let pickedCard = null;

        window.GameState.mutate(function(state) {
            // Find and remove card from discard
            const cardIndex = state.discardPile.findIndex(c => c.instanceId === cardInstanceId);
            
            if (cardIndex === -1) {
                return;
            }

            pickedCard = state.discardPile.splice(cardIndex, 1)[0];
        });

        if (!pickedCard) {
            return { success: false, error: 'Card not found in discard pile' };
        }

        // Add to player's hand
        window.Player.addCardToHand(playerId, pickedCard);
        window.GameState.setState({ activeModal: null });

        window.GameState.logAction({
            type: 'CARD_PICKED_FROM_DISCARD',
            playerId,
            playerName: player.name,
            pickedCard: pickedCard.type,
            description: `${player.name} picked ${pickedCard.emoji} ${pickedCard.name} from the discard pile!`
        });

        return {
            success: true,
            pickedCard,
            description: `${player.name} picked ${pickedCard.emoji} from discard!`
        };
    }

    // ========== COMBO UTILITIES ==========

    /**
     * Remove played cards from player's hand after combo
     * Used after combo is resolved
     * 
     * @param {number} playerId - Player ID
     * @param {Array} cardInstanceIds - Card IDs to remove
     * @returns {boolean} Success status
     */
    function removeComboCards(playerId, cardInstanceIds) {
        if (!Array.isArray(cardInstanceIds) || cardInstanceIds.length === 0) {
            return false;
        }

        let allRemoved = true;
        const removedCards = [];

        cardInstanceIds.forEach(cardId => {
            const removed = window.Player.removeCardFromHand(playerId, cardId);
            if (removed) {
                removedCards.push(removed);
            } else {
                allRemoved = false;
            }
        });

        if (removedCards.length > 0) {
            window.GameState.mutate(function(state) {
                state.discardPile.push(...removedCards);
            });
        }

        return allRemoved;
    }

    /**
     * Get combo description text for UI
     * @param {Object} comboInfo - Combo info
     * @returns {string} Description
     */
    function getComboDescription(comboInfo) {
        if (!comboInfo) {
            return 'Unknown combo';
        }

        const descriptions = {
            'two_of_a_kind': `Two ${comboInfo.icon}s! Steal a random card from any player.`,
            'three_of_a_kind': `Three ${comboInfo.icon}s! Name a card to steal from any player.`,
            'five_different': 'Five Different! Pick any card from the discard pile.'
        };

        return descriptions[comboInfo.type] || comboInfo.description || 'No description';
    }

    /**
     * Check if combo is nopeable
     * Five Different cannot be noped
     * 
     * @param {Object} comboInfo - Combo info
     * @returns {boolean} True if can be noped
     */
    function canComboBeNoped(comboInfo) {
        if (!comboInfo) {
            return false;
        }

        // All combos can be noped per official rules
        return comboInfo.type === 'two_of_a_kind' || comboInfo.type === 'three_of_a_kind' || comboInfo.type === 'five_different';
    }

    // ========== PUBLIC API ==========

    window.Combo = Object.freeze({
        detectCombo,
        resolveCombo,
        removeComboCards,
        pickFromDiscard,
        getComboDescription,
        canComboBeNoped
    });

    console.log('[Module 7: Combo Resolver] Loaded ✓');
})();
