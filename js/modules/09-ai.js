/**
 * Module 9: AI Opponent Logic
 * 
 * Manages AI player decision-making:
 * - Nope decisions based on threat assessment
 * - Card play priority (survival, disruption, info, advantage, combos)
 * - Defuse placement strategy
 * - Favor response (give least valuable card)
 * - Three of a Kind naming strategy
 * 
 * AI Difficulty Levels:
 * - Easy: Random decisions
 * - Medium: Heuristic-based priorities
 * - Hard: Card counting and advanced strategy
 * 
 * @module AI
 * @requires Modules 1, 3, 4, 5, 6, 7, 8
 * @exports {Object} window.AI
 */

(function() {
    'use strict';

    console.log('[Module 9: AI Opponent Logic] Loading...');

    if (!window.CARD_TYPES || !window.GameState || !window.Player || !window.TurnEngine || !window.CardEffects || !window.Combo) {
        throw new Error('[Module 9] Missing dependencies. Modules 1, 3, 4, 5, 6, 7 required.');
    }

    // ========== AI DIFFICULTY ==========

    var difficulty = 'medium';

    /**
     * Set AI difficulty level.
     * @param {string} level - 'easy', 'medium', or 'hard'
     */
    function setDifficulty(level) {
        if (level === 'easy' || level === 'medium' || level === 'hard') {
            difficulty = level;
        }
    }

    /**
     * Get current AI difficulty.
     * @returns {string}
     */
    function getDifficulty() {
        return difficulty;
    }

    // ========== UTILITY ==========

    /**
     * Get a random integer between 0 and max (exclusive).
     * @private
     */
    function randomInt(max) {
        return Math.floor(Math.random() * max);
    }

    /**
     * Pick a random element from an array.
     * @private
     */
    function randomPick(arr) {
        if (!arr || arr.length === 0) return null;
        return arr[randomInt(arr.length)];
    }

    /**
     * Count cards by type in a player's hand.
     * @private
     */
    function countCardsByType(hand) {
        var counts = {};
        hand.forEach(function(card) {
            counts[card.type] = (counts[card.type] || 0) + 1;
        });
        return counts;
    }

    /**
     * Find cards of a specific type in hand.
     * @private
     */
    function findCardsOfType(hand, type) {
        return hand.filter(function(c) { return c.type === type; });
    }

    /**
     * Get all cat cards from hand.
     * @private
     */
    function getCatCards(hand) {
        return hand.filter(function(c) { return c.cornerIcon; });
    }

    // ========== CARD VALUE ASSESSMENT ==========

    /**
     * Assess the value of a card to the AI.
     * Lower value = more likely to give away in favor.
     * @private
     */
    function getCardValue(cardType) {
        var values = {
            'exploding_kitten': 0,    // Should never have one
            'defuse': 100,             // Most valuable
            'attack': 70,
            'skip': 60,
            'see_future': 50,
            'nope': 40,
            'shuffle': 25,
            'favor': 30,
            'tacocat': 10,
            'cattermelon': 10,
            'hairy_potato_cat': 10,
            'beard_cat': 10,
            'rainbow_cat': 10
        };
        return values[cardType] || 5;
    }

    // ========== MAIN DECISION LOGIC ==========

    /**
     * Get AI decision for current turn.
     * @param {number} playerId - AI player ID
     * @returns {Object} Decision: { action: 'play'|'draw', cardType, cardInstanceId, targetId, comboCards, namedCard }
     */
    function getAIDecision(playerId) {
        var state = window.GameState.getState();
        var player = state.players[playerId];
        if (!player || !player.isAlive) {
            return { action: 'draw' };
        }

        if (difficulty === 'easy') {
            return getEasyDecision(playerId, state, player);
        } else if (difficulty === 'hard') {
            return getHardDecision(playerId, state, player);
        } else {
            return getMediumDecision(playerId, state, player);
        }
    }

    /**
     * Easy AI: Random valid play or draw.
     * @private
     */
    function getEasyDecision(playerId, state, player) {
        // 50% chance to play a random card, 50% to draw
        if (player.hand.length > 0 && Math.random() < 0.5) {
            var playableCards = player.hand.filter(function(c) {
                return c.type !== 'exploding_kitten' && c.type !== 'defuse';
            });
            if (playableCards.length > 0) {
                var card = randomPick(playableCards);
                var targetId = null;
                if (card.type === 'favor') {
                    var others = window.Player.getOtherAlivePlayers(playerId);
                    if (others.length > 0) targetId = randomPick(others).id;
                }
                return {
                    action: 'play',
                    cardType: card.type,
                    cardInstanceId: card.instanceId,
                    targetId: targetId
                };
            }
        }
        return { action: 'draw' };
    }

    /**
     * Medium AI: Heuristic-based priorities.
     * @private
     */
    function getMediumDecision(playerId, state, player) {
        var hand = player.hand;
        var counts = countCardsByType(hand);

        // Priority 1: Survival — if we know EK is on top, play Skip or Attack
        var memory = getPeekMemory(playerId);
        if (memory && memory.topCard === 'exploding_kitten') {
            var skipCard = findCardsOfType(hand, 'skip');
            if (skipCard.length > 0) {
                return { action: 'play', cardType: 'skip', cardInstanceId: skipCard[0].instanceId };
            }
            var attackCard = findCardsOfType(hand, 'attack');
            if (attackCard.length > 0) {
                return { action: 'play', cardType: 'attack', cardInstanceId: attackCard[0].instanceId };
            }
        }

        // Priority 2: Disruption — Attack when next player has few cards
        var nextPlayer = getNextPlayer(playerId, state);
        if (nextPlayer && nextPlayer.hand.length <= 2) {
            var attackCard = findCardsOfType(hand, 'attack');
            if (attackCard.length > 0) {
                return { action: 'play', cardType: 'attack', cardInstanceId: attackCard[0].instanceId };
            }
        }

        // Priority 3: Info — See the Future if deck is getting small
        if (state.drawPile.length <= 8) {
            var seeFutureCard = findCardsOfType(hand, 'see_future');
            if (seeFutureCard.length > 0) {
                return { action: 'play', cardType: 'see_future', cardInstanceId: seeFutureCard[0].instanceId };
            }
        }

        // Priority 4: Card advantage — Favor on player with most cards
        var favorCard = findCardsOfType(hand, 'favor');
        if (favorCard.length > 0) {
            var bestTarget = getBestFavorTarget(playerId, state);
            if (bestTarget !== null) {
                return {
                    action: 'play',
                    cardType: 'favor',
                    cardInstanceId: favorCard[0].instanceId,
                    targetId: bestTarget
                };
            }
        }

        // Priority 5: Combos — Two of a Kind if has matching cat cards
        var comboDecision = checkComboPlay(playerId, state, player);
        if (comboDecision) {
            return comboDecision;
        }

        // Priority 6: Skip if has skip and deck is dangerous
        if (state.drawPile.length <= 5) {
            var skipCard = findCardsOfType(hand, 'skip');
            if (skipCard.length > 0) {
                return { action: 'play', cardType: 'skip', cardInstanceId: skipCard[0].instanceId };
            }
        }

        // Default: draw
        return { action: 'draw' };
    }

    /**
     * Hard AI: Card counting + advanced strategy.
     * @private
     */
    function getHardDecision(playerId, state, player) {
        // Start with medium strategy
        var decision = getMediumDecision(playerId, state, player);

        // Hard AI enhancements:
        // 1. Track EKs in deck vs discard
        var eksInDiscard = state.discardPile.filter(function(c) { return c.type === 'exploding_kitten'; }).length;
        var eksRemaining = (state.players.length - 1) - eksInDiscard;
        var ekProbability = eksRemaining / Math.max(state.drawPile.length, 1);

        // 2. If high EK probability, prioritize survival
        if (ekProbability > 0.3 && decision.action === 'draw') {
            var skipCard = findCardsOfType(player.hand, 'skip');
            if (skipCard.length > 0) {
                return { action: 'play', cardType: 'skip', cardInstanceId: skipCard[0].instanceId };
            }
            var attackCard = findCardsOfType(player.hand, 'attack');
            if (attackCard.length > 0) {
                return { action: 'play', cardType: 'attack', cardInstanceId: attackCard[0].instanceId };
            }
        }

        // 3. Hold onto Defuse cards (never play them proactively)
        // 4. Prefer to play shuffle when deck is unfavorable
        if (ekProbability > 0.2 && decision.action === 'draw') {
            var shuffleCard = findCardsOfType(player.hand, 'shuffle');
            if (shuffleCard.length > 0 && Math.random() < 0.5) {
                return { action: 'play', cardType: 'shuffle', cardInstanceId: shuffleCard[0].instanceId };
            }
        }

        return decision;
    }

    // ========== COMBO DETECTION ==========

    /**
     * Check if AI can play a combo.
     * @private
     */
    function checkComboPlay(playerId, state, player) {
        var catCards = getCatCards(player.hand);
        if (catCards.length < 2) return null;

        var counts = countCardsByType(player.hand);

        // Check for Three of a Kind first (before two of a kind)
        for (var type in counts) {
            if (counts[type] >= 3 && window.CARD_TYPES[type] && window.CARD_TYPES[type].cornerIcon) {
                var matching3 = findCardsOfType(player.hand, type).slice(0, 3);
                var namedCard = aiNameCardForThreeOfKind(playerId);
                return {
                    action: 'play',
                    combo: true,
                    comboType: 'three_of_a_kind',
                    comboCards: matching3.map(function(c) { return c.instanceId; }),
                    namedCard: namedCard
                };
            }
        }

        // Check for Two of a Kind
        for (var type2 in counts) {
            if (counts[type2] >= 2 && window.CARD_TYPES[type2] && window.CARD_TYPES[type2].cornerIcon) {
                var matching = findCardsOfType(player.hand, type2).slice(0, 2);
                var targetId = getBestStealTarget(playerId, state);
                return {
                    action: 'play',
                    combo: true,
                    comboType: 'two_of_a_kind',
                    comboCards: matching.map(function(c) { return c.instanceId; }),
                    targetId: targetId
                };
            }
        }

        return null;
    }

    // ========== TARGET SELECTION ==========

    /**
     * Get the best player to target for Favor (most cards).
     * @private
     */
    function getBestFavorTarget(playerId, state) {
        var others = window.Player.getOtherAlivePlayers(playerId);
        if (others.length === 0) return null;

        var best = others[0];
        for (var i = 1; i < others.length; i++) {
            if (others[i].hand.length > best.hand.length) {
                best = others[i];
            }
        }
        return best.id;
    }

    /**
     * Get the best player to steal from (most cards).
     * @private
     */
    function getBestStealTarget(playerId, state) {
        return getBestFavorTarget(playerId, state);
    }

    /**
     * Get next alive player after a given player.
     * Uses shared Player.getNextAlivePlayerAfter for consistency.
     * @private
     */
    function getNextPlayer(playerId, state) {
        return window.Player.getNextAlivePlayerAfter(playerId);
    }

    // ========== NOPE DECISION ==========

    /**
     * Get AI's nope decision for a pending action.
     * @param {number} playerId - AI player ID
     * @param {Object} pendingAction - The action being noped
     * @returns {boolean} true to nope, false to allow
     */
    function getAINopeDecision(playerId, pendingAction) {
        if (!pendingAction) return false;

        var state = window.GameState.getState();
        var player = state.players[playerId];
        if (!player || !player.isAlive) return false;

        // Check if AI has a nope card
        var nopeCards = findCardsOfType(player.hand, 'nope');
        if (nopeCards.length === 0) return false;

        var actionType = pendingAction.type;
        var cardType = pendingAction.cardType;
        var actionPlayerId = pendingAction.playerId;

        // Don't nope own actions
        if (actionPlayerId === playerId) return false;

        if (difficulty === 'easy') {
            // Easy: 25% chance to nope
            return Math.random() < 0.25;
        }

        if (difficulty === 'hard') {
            // Hard: Strategic nope decisions
            // Always nope Attack targeting next player if we're next
            if (cardType === 'attack') {
                var nextP = getNextPlayer(actionPlayerId, state);
                if (nextP && nextP.id === playerId) return true;
            }
            // Always nope Favor targeting self
            if (cardType === 'favor' && pendingAction.targetId === playerId) return true;
            // 70% nope See the Future (deny info)
            if (cardType === 'see_future') return Math.random() < 0.7;
            // 40% nope combos
            if (actionType && actionType.indexOf('combo') !== -1) {
                if (pendingAction.targetId === playerId) return true;
                return Math.random() < 0.4;
            }
            // Never nope shuffle
            if (cardType === 'shuffle') return false;
            // 20% nope skip
            if (cardType === 'skip') return Math.random() < 0.2;
            return false;
        }

        // Medium: Moderate nope decisions
        // Always nope Favor targeting self
        if (cardType === 'favor' && pendingAction.targetId === playerId) return true;
        // Always nope Attack if we're the next player
        if (cardType === 'attack') {
            var nextPlayer = getNextPlayer(actionPlayerId, state);
            if (nextPlayer && nextPlayer.id === playerId) return true;
        }
        // 50% nope See the Future
        if (cardType === 'see_future') return Math.random() < 0.5;
        // 30% nope combo targeting self
        if (actionType && actionType.indexOf('combo') !== -1 && pendingAction.targetId === playerId) {
            return Math.random() < 0.3;
        }
        // Never nope shuffle
        if (cardType === 'shuffle') return false;
        return false;
    }

    // ========== FAVOR CARD SELECTION ==========

    /**
     * AI chooses which card to give in a favor.
     * Strategy: Give least valuable card.
     * @param {number} playerId - AI player giving card
     * @returns {string} Card instance ID to give
     */
    function aiChooseFavorCard(playerId) {
        var state = window.GameState.getState();
        var player = state.players[playerId];
        if (!player || player.hand.length === 0) return null;

        // Sort hand by value (ascending) — give lowest value card
        var sortedHand = player.hand.slice().sort(function(a, b) {
            return getCardValue(a.type) - getCardValue(b.type);
        });

        // Never give Defuse unless it's the only card
        var nonDefuse = sortedHand.filter(function(c) { return c.type !== 'defuse'; });
        if (nonDefuse.length > 0) {
            return nonDefuse[0].instanceId;
        }

        return sortedHand[0].instanceId;
    }

    // ========== DEFUSE PLACEMENT ==========

    /**
     * AI chooses where to place Exploding Kitten after defusing.
     * @param {number} deckSize - Current draw pile size
     * @returns {number} Position index (0 = top, deckSize = bottom)
     */
    function aiChooseDefusePosition(deckSize) {
        if (deckSize === 0) return 0;

        if (difficulty === 'easy') {
            // Easy: Random position
            return randomInt(deckSize + 1);
        }

        if (difficulty === 'hard') {
            // Hard: Place near bottom (next player won't draw it soon)
            // But not at the very bottom — mix it up slightly
            var basePos = Math.floor(deckSize * 0.75);
            var jitter = randomInt(Math.max(Math.floor(deckSize * 0.15), 2));
            return Math.min(basePos + jitter, deckSize);
        }

        // Medium: Place in middle-bottom area
        var midPos = Math.floor(deckSize * 0.6);
        var variation = randomInt(Math.max(Math.floor(deckSize * 0.2), 2));
        return Math.min(midPos + variation, deckSize);
    }

    // ========== THREE OF A KIND NAMING ==========

    /**
     * AI names a card to steal with Three of a Kind.
     * Strategy: Prefer Defuse > See the Future > Attack > Skip.
     * @param {number} playerId - AI player
     * @returns {string} Card type to steal
     */
    function aiNameCardForThreeOfKind(playerId) {
        var state = window.GameState.getState();

        if (difficulty === 'easy') {
            // Easy: Random card type
            var types = Object.keys(window.CARD_TYPES);
            return randomPick(types.filter(function(t) { return t !== 'exploding_kitten'; }));
        }

        // Medium/Hard: Check what other players likely have
        // Priority: Defuse > See the Future > Attack > Skip > Nope
        var priorities = ['defuse', 'see_future', 'attack', 'skip', 'nope', 'favor', 'shuffle'];

        // Hard: Check discard pile to know what's been played
        if (difficulty === 'hard') {
            var discardCounts = countCardsByType(state.discardPile);
            // Choose a card type that hasn't been fully depleted
            for (var i = 0; i < priorities.length; i++) {
                var type = priorities[i];
                var totalInDeck = window.DECK_COMPOSITION[type] || 0;
                var inDiscard = discardCounts[type] || 0;
                if (inDiscard < totalInDeck) {
                    return type;
                }
            }
        }

        // Medium: Just use priority list
        for (var j = 0; j < priorities.length; j++) {
            return priorities[0]; // Return highest priority
        }

        return 'defuse';
    }

    // ========== AI TURN EXECUTION ==========

    /**
     * Execute AI turn — makes decision and performs action.
     * @param {number} playerId - AI player ID
     * @returns {Object} The decision that was made
     */
    function aiTakeTurn(playerId) {
        var decision = getAIDecision(playerId);
        return decision;
    }

    // ========== PEEK MEMORY ==========

    /**
     * Store peeked cards info for AI.
     * Uses a private memory map since GameState is immutable.
     * 
     * Card ordering convention:
     * peekedCards[0] = top of deck (next to be drawn)
     * peekedCards[1] = second card
     * peekedCards[2] = third card
     * 
     * @param {number} playerId - AI player
     * @param {Array} peekedCards - Top 3 cards from draw pile (top first)
     */
    var peekMemory = {};

    function rememberPeekedCards(playerId, peekedCards) {
        // Store cards in draw order: [0] = top (next draw), [1] = second, [2] = third
        peekMemory[playerId] = {
            topCard: peekedCards[0] ? peekedCards[0].type : null,
            top3: peekedCards.map(function(c) { return c.type; })
        };
    }

    /**
     * Clear AI's peek memory (after drawing or shuffling).
     * @param {number} playerId
     */
    function clearPeekMemory(playerId) {
        delete peekMemory[playerId];
    }

    /**
     * Get AI's peek memory.
     * @param {number} playerId
     * @returns {Object|null}
     */
    function getPeekMemory(playerId) {
        return peekMemory[playerId] || null;
    }

    // ========== PUBLIC API ==========

    window.AI = Object.freeze({
        // Configuration
        setDifficulty: setDifficulty,
        getDifficulty: getDifficulty,

        // Decision making
        aiTakeTurn: aiTakeTurn,
        getAIDecision: getAIDecision,
        getAINopeDecision: getAINopeDecision,

        // Specific choices
        aiChooseFavorCard: aiChooseFavorCard,
        aiChooseDefusePosition: aiChooseDefusePosition,
        aiNameCardForThreeOfKind: aiNameCardForThreeOfKind,

        // Peek memory
        rememberPeekedCards: rememberPeekedCards,
        clearPeekMemory: clearPeekMemory,
        getPeekMemory: getPeekMemory
    });

    console.log('[Module 9: AI Opponent Logic] Loaded ✓');
})();
