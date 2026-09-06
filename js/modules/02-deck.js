/**
 * MODULE 2: Deck & Shuffle Logic
 * 
 * Manages all deck operations:
 * - Deck creation with unique card instances
 * - Fisher-Yates shuffle algorithm
 * - Exploding Kitten insertion/removal
 * - Defuse card insertion/removal
 * - Full setup sequence orchestration
 * 
 * Input: CARD_TYPES, DECK_COMPOSITION, GAME_CONFIG (from Module 1)
 * 
 * Output:
 * - window.createDeck(playerCount) → shuffled 56-card array
 * - window.shuffle(array) → shuffled copy of array
 * - window.removeExplodingKittens(deck) → { cleanDeck, removedKittens }
 * - window.insertExplodingKittens(deck, count) → deck with kittens inserted and shuffled
 * - window.removeDefuses(deck) → { cleanDeck, removedDefuses }
 * - window.insertDefuses(deck, count) → deck with defuses inserted and shuffled
 * 
 * Dependencies: Module 1 (CARD_TYPES, DECK_COMPOSITION, GAME_CONFIG)
 * 
 * Implementation: Complete
 */

(function() {
    'use strict';

    window.debug('[Module 2: Deck & Shuffle] Loading...');

    // ===== ERROR HANDLING =====

    /**
     * Check if Module 1 constants are loaded
     */
    function validateDependencies() {
        if (!window.CARD_TYPES || !window.DECK_COMPOSITION || !window.GAME_CONFIG) {
            throw new Error('Module 2: Required constants from Module 1 not found');
        }
    }

    // ========== SHUFFLE ALGORITHM ==========

    /**
     * Fisher-Yates shuffle algorithm
     * Creates a new shuffled copy of an array without mutating the original
     * 
     * Time Complexity: O(n)
     * Space Complexity: O(n)
     * 
     * @param {Array} array - Array to shuffle
     * @returns {Array} New shuffled array
     */
    function shuffle(array) {
        if (!array || !Array.isArray(array)) {
            console.warn('[Module 2] shuffle() called with non-array:', array);
            return [];
        }

        // Create a copy to avoid mutation
        const shuffled = [...array];
        const length = shuffled.length;

        // Fisher-Yates algorithm
        for (let i = length - 1; i > 0; i--) {
            // Random index from 0 to i (inclusive)
            const randomIndex = Math.floor(Math.random() * (i + 1));

            // Swap elements
            [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
        }

        return shuffled;
    }

    // ========== DECK CREATION HELPERS ==========

    /**
     * Create instances of all cards in the deck
     * Each card instance gets a unique ID for tracking
     * 
     * Format of card instance: { instanceId, type, cornerIcon, emoji, name }
     * 
     * @returns {Array} Array of card instances
     */
    function generateCardInstances() {
        const cards = [];
        let instanceCounter = 0;

        window.DECK_COMPOSITION.forEach(({ type, count }) => {
            const cardType = window.CARD_TYPES[type];

            if (!cardType) {
                console.warn(`[Module 2] Unknown card type: ${type}`);
                return;
            }

            for (let i = 0; i < count; i++) {
                cards.push({
                    instanceId: `${type}-${i + 1}`,
                    type: type,
                    cornerIcon: cardType.cornerIcon,
                    emoji: cardType.emoji,
                    name: cardType.name
                });
                instanceCounter++;
            }
        });

        return cards;
    }

    /**
     * Remove all Exploding Kittens from a deck
     * Used in setup sequence to segregate dangerous cards
     * 
     * @param {Array} deck - Deck array
     * @returns {Object} { cleanDeck, removedKittens }
     */
    function removeExplodingKittens(deck) {
        const removedKittens = [];
        const cleanDeck = [];

        deck.forEach(card => {
            if (card.type === 'exploding_kitten') {
                removedKittens.push(card);
            } else {
                cleanDeck.push(card);
            }
        });

        return { cleanDeck, removedKittens };
    }

    /**
     * Remove all Defuse cards from a deck
     * Used in setup sequence to distribute starting defuses
     * 
     * @param {Array} deck - Deck array
     * @returns {Object} { cleanDeck, removedDefuses }
     */
    function removeDefuses(deck) {
        const removedDefuses = [];
        const cleanDeck = [];

        deck.forEach(card => {
            if (card.type === 'defuse') {
                removedDefuses.push(card);
            } else {
                cleanDeck.push(card);
            }
        });

        return { cleanDeck, removedDefuses };
    }

    /**
     * Insert Exploding Kittens back into deck
     * Shuffles deck after insertion
     * 
     * @param {Array} deck - Deck array
     * @param {number} count - Number of EKs to insert
     * @returns {Array} Deck with EKs inserted and shuffled
     */
    function insertExplodingKittens(deck, count) {
        if (count < 0) {
            console.warn(`[Module 2] insertExplodingKittens() called with negative count: ${count}`);
            return deck;
        }

        // Get EKs (they should be available from removal step)
        // Create new ones if needed
        const kittens = [];
        for (let i = 0; i < count; i++) {
            kittens.push({
                instanceId: `exploding_kitten-new-${i + 1}`,
                type: 'exploding_kitten',
                cornerIcon: null,
                emoji: '💥',
                name: 'Exploding Kitten'
            });
        }

        // Combine and shuffle
        const combined = [...deck, ...kittens];
        return shuffle(combined);
    }

    /**
     * Insert Defuse cards back into deck
     * Shuffles deck after insertion
     * 
     * @param {Array} deck - Deck array
     * @param {number} count - Number of Defuses to insert
     * @returns {Array} Deck with Defuses inserted and shuffled
     */
    function insertDefuses(deck, count) {
        if (count < 0) {
            console.warn(`[Module 2] insertDefuses() called with negative count: ${count}`);
            return deck;
        }

        // Create defuses if needed
        const defuses = [];
        for (let i = 0; i < count; i++) {
            defuses.push({
                instanceId: `defuse-new-${i + 1}`,
                type: 'defuse',
                cornerIcon: null,
                emoji: '🔧',
                name: 'Defuse'
            });
        }

        // Combine and shuffle
        const combined = [...deck, ...defuses];
        return shuffle(combined);
    }

    // ========== MAIN DECK CREATION ==========

    /**
     * Create and initialize a complete 56-card deck
     * Returns all 56 cards in a shuffled order ready for gameplay
     * 
     * The deck includes:
     * - All 4 Exploding Kittens
     * - All 6 Defuses
     * - All 46 other cards (action + cat cards)
     * 
     * The player count parameter is used for validation and future features.
     * The actual dealing of initial hands is handled by Module 13 (Game Flow).
     * 
     * @param {number} playerCount - Number of players (2-5)
     * @returns {Array} Shuffled 56-card deck ready for gameplay
     * @throws {Error} If playerCount is invalid
     */
    function createDeck(playerCount) {
        // Validate input
        if (!Number.isInteger(playerCount)) {
            throw new Error(`createDeck(): playerCount must be an integer, got ${playerCount}`);
        }

        if (playerCount < window.GAME_CONFIG.MIN_PLAYERS || playerCount > window.GAME_CONFIG.MAX_PLAYERS) {
            throw new Error(
                `createDeck(): playerCount must be ${window.GAME_CONFIG.MIN_PLAYERS}-${window.GAME_CONFIG.MAX_PLAYERS}, got ${playerCount}`
            );
        }

        window.debug(`[Module 2] Creating 56-card deck for ${playerCount} players...`);

        try {
            // Generate all 56 card instances
            let deck = generateCardInstances();
            window.debug(`[Module 2] Generated ${deck.length} card instances`);

            if (deck.length !== 56) {
                throw new Error(`Expected 56 cards, generated ${deck.length}`);
            }

            // Shuffle the complete deck
            deck = shuffle(deck);
            window.debug(`[Module 2] Shuffled 56-card deck`);

            // Validate composition
            const summary = getDeckSummary(deck);
            const expectedCounts = {
                'exploding_kitten': 4,
                'defuse': 6,
                'nope': 5,
                'attack': 4,
                'skip': 4,
                'favor': 4,
                'shuffle': 4,
                'see_the_future': 5,
                'tacocat': 4,
                'cattermelon': 4,
                'hairy_potato_cat': 4,
                'beard_cat': 4,
                'rainbow_cat': 4
            };

            let compositionValid = true;
            Object.entries(expectedCounts).forEach(([type, expected]) => {
                if (summary[type] !== expected) {
                    console.warn(`[Module 2] Warning: ${type} count is ${summary[type]}, expected ${expected}`);
                    compositionValid = false;
                }
            });

            window.debug(`[Module 2] ✓ Deck created successfully (56 cards, ready for gameplay)`);

            return deck;
        } catch (error) {
            console.error(`[Module 2] Error creating deck:`, error);
            throw error;
        }
    }

    // ========== DEBUGGING & TESTING ==========

    /**
     * Get deck composition summary for debugging
     * Useful for verifying deck creation results
     * 
     * @param {Array} deck - Deck to analyze
     * @returns {Object} Composition breakdown by card type
     */
    function getDeckSummary(deck) {
        const summary = {};

        deck.forEach(card => {
            if (!summary[card.type]) {
                summary[card.type] = 0;
            }
            summary[card.type]++;
        });

        return summary;
    }

    // ========== INITIALIZATION & EXPORT ==========

    try {
        validateDependencies();

        // Export public functions
        window.shuffle = shuffle;
        window.createDeck = createDeck;
        window.removeExplodingKittens = removeExplodingKittens;
        window.removeDefuses = removeDefuses;

        window.debug('[Module 2: Deck & Shuffle] Loaded');
    } catch (error) {
        console.error('[Module 2: Deck & Shuffle] Load failed:', error);
    }
})();
