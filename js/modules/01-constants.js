/**
 * MODULE 1: Constants & Card Definitions
 * 
 * Defines all static game constants:
 * - Card types with metadata (9 types + 5 cat subtypes)
 * - Deck composition (56 total cards)
 * - Game configuration constants
 * - Combo type definitions
 * 
 * Output:
 * - window.CARD_TYPES — object mapping card IDs to metadata
 * - window.DECK_COMPOSITION — array of card type IDs in deck
 * - window.GAME_CONFIG — game constants (turn counts, peek size, etc.)
 * - window.COMBO_TYPES — combo definitions and requirements
 * 
 * Dependencies: None
 * 
 * Implementation: Complete
 */

(function() {
    'use strict';

    console.log('[Module 1: Constants] Loading...');

    // ========== CARD TYPE DEFINITIONS ==========

    /**
     * All card types in the game
     * Each card has metadata used for gameplay and UI
     * 
     * @type {Object<string, {id, name, emoji, color, description, count, isCat, cornerIcon}>}
     */
    const CARD_TYPES = {
        // ===== Action Cards =====
        exploding_kitten: {
            id: 'exploding_kitten',
            name: 'Exploding Kitten',
            emoji: '💥',
            color: '#ff4444',
            description: 'Draw it and die (unless you have a Defuse)',
            count: 4,
            isCat: false,
            cornerIcon: null
        },

        defuse: {
            id: 'defuse',
            name: 'Defuse',
            emoji: '🔧',
            color: '#44aa44',
            description: 'Play when you draw an Exploding Kitten to save yourself',
            count: 6,
            isCat: false,
            cornerIcon: null
        },

        nope: {
            id: 'nope',
            name: 'Nope',
            emoji: '🚫',
            color: '#ff8800',
            description: 'Cancel any action (except Exploding Kitten/Defuse)',
            count: 5,
            isCat: false,
            cornerIcon: null
        },

        attack: {
            id: 'attack',
            name: 'Attack',
            emoji: '⚔️',
            color: '#ff4444',
            description: 'End turn without drawing. Next player draws twice',
            count: 4,
            isCat: false,
            cornerIcon: null
        },

        skip: {
            id: 'skip',
            name: 'Skip',
            emoji: '⏭️',
            color: '#4488ff',
            description: 'End your turn without drawing',
            count: 4,
            isCat: false,
            cornerIcon: null
        },

        favor: {
            id: 'favor',
            name: 'Favor',
            emoji: '🎁',
            color: '#ff44aa',
            description: 'Force any player to give you a card (they choose which)',
            count: 4,
            isCat: false,
            cornerIcon: null
        },

        shuffle: {
            id: 'shuffle',
            name: 'Shuffle',
            emoji: '🔀',
            color: '#8844ff',
            description: 'Shuffle the draw pile',
            count: 4,
            isCat: false,
            cornerIcon: null
        },

        see_the_future: {
            id: 'see_the_future',
            name: 'See the Future',
            emoji: '🔮',
            color: '#44aaaa',
            description: 'Peek at the top 3 cards of the draw pile',
            count: 5,
            isCat: false,
            cornerIcon: null
        },

        // ===== Cat Cards (5 types × 4 each) =====
        tacocat: {
            id: 'tacocat',
            name: 'Tacocat',
            emoji: '🌮',
            color: '#ffaa44',
            description: 'Cat card - use in combos',
            count: 4,
            isCat: true,
            cornerIcon: 'taco'
        },

        cattermelon: {
            id: 'cattermelon',
            name: 'Cattermelon',
            emoji: '🍉',
            color: '#44aa66',
            description: 'Cat card - use in combos',
            count: 4,
            isCat: true,
            cornerIcon: 'melon'
        },

        hairy_potato_cat: {
            id: 'hairy_potato_cat',
            name: 'Hairy Potato Cat',
            emoji: '🥔',
            color: '#bb8844',
            description: 'Cat card - use in combos',
            count: 4,
            isCat: true,
            cornerIcon: 'potato'
        },

        beard_cat: {
            id: 'beard_cat',
            name: 'Beard Cat',
            emoji: '🧔',
            color: '#886644',
            description: 'Cat card - use in combos',
            count: 4,
            isCat: true,
            cornerIcon: 'beard'
        },

        rainbow_cat: {
            id: 'rainbow_cat',
            name: 'Rainbow-Ralphing Cat',
            emoji: '🌈',
            color: '#ff44ff',
            description: 'Cat card - use in combos',
            count: 4,
            isCat: true,
            cornerIcon: 'rainbow'
        }
    };

    // ========== DECK COMPOSITION ==========

    /**
     * Defines the exact composition of the deck (56 cards total)
     * Each entry specifies how many of each card type to include
     * 
     * @type {Array<{type: string, count: number}>}
     */
    const DECK_COMPOSITION = [
        { type: 'exploding_kitten', count: 4 },
        { type: 'defuse', count: 6 },
        { type: 'nope', count: 5 },
        { type: 'attack', count: 4 },
        { type: 'skip', count: 4 },
        { type: 'favor', count: 4 },
        { type: 'shuffle', count: 4 },
        { type: 'see_the_future', count: 5 },
        { type: 'tacocat', count: 4 },
        { type: 'cattermelon', count: 4 },
        { type: 'hairy_potato_cat', count: 4 },
        { type: 'beard_cat', count: 4 },
        { type: 'rainbow_cat', count: 4 }
    ];

    // ========== COMBO DEFINITIONS ==========

    /**
     * Defines all possible card combos
     * Combos are played by matching corner icons on cat cards
     * 
     * @type {Object<string, {id, name, requirement, description}>}
     */
    const COMBO_TYPES = {
        two_of_a_kind: {
            id: 'two_of_a_kind',
            name: 'Two of a Kind',
            requirement: 'Two cards with the same corner icon',
            description: 'Steal 1 random card from any player',
            cardsRequired: 2,
            action: 'steal_random'
        },

        three_of_a_kind: {
            id: 'three_of_a_kind',
            name: 'Three of a Kind',
            requirement: 'Three cards with the same corner icon',
            description: 'Name a card type - steal it if target has it',
            cardsRequired: 3,
            action: 'steal_named'
        },

        five_different: {
            id: 'five_different',
            name: 'Five Different Cards',
            requirement: 'Five cards with different corner icons',
            description: 'Search the discard pile and take any 1 card',
            cardsRequired: 5,
            action: 'pick_from_discard'
        }
    };

    // ========== GAME CONFIGURATION ==========

    /**
     * Game constants and configuration values
     * Used throughout game logic for consistency
     * 
     * @type {Object}
     */
    const GAME_CONFIG = {
        // Player management
        MIN_PLAYERS: 2,
        MAX_PLAYERS: 5,
        STARTING_HAND_SIZE: 5,
        STARTING_DEFUSES: 1,

        // Attack mechanics
        ATTACK_TURNS_PER_CARD: 2,
        BASE_DRAW_COUNT: 1,

        // See the Future
        PEEK_CARD_COUNT: 3,

        // Nope window timing
        NOPE_WINDOW_DURATION_MS: 5000,

        // Phase names
        PHASES: {
            SETUP: 'setup',
            PLAY: 'play',
            DRAW: 'draw',
            NOPE_WINDOW: 'nope-window',
            DEFUSE_PLACEMENT: 'defuse-placement',
            PEEK: 'peek',
            GAME_OVER: 'game-over'
        },

        // Action types
        ACTIONS: {
            PLAY_CARD: 'play_card',
            DRAW_CARD: 'draw_card',
            PLAY_COMBO: 'play_combo',
            PLAY_NOPE: 'play_nope'
        }
    };

    // ========== VALIDATION ==========

    /**
     * Verify deck composition totals 56 cards
     */
    function validateDeckComposition() {
        const total = DECK_COMPOSITION.reduce((sum, item) => sum + item.count, 0);
        if (total !== 56) {
            console.warn(`[Module 1] Deck composition total is ${total}, expected 56`);
        }
    }

    /**
     * Verify all card types referenced in composition exist
     */
    function validateCardTypes() {
        DECK_COMPOSITION.forEach(item => {
            if (!CARD_TYPES[item.type]) {
                console.warn(`[Module 1] Referenced card type not found: ${item.type}`);
            }
        });
    }

    // ========== INITIALIZATION ==========

    validateDeckComposition();
    validateCardTypes();

    // ========== EXPORTS ==========

    window.CARD_TYPES = Object.freeze(CARD_TYPES);
    window.DECK_COMPOSITION = Object.freeze(DECK_COMPOSITION);
    window.COMBO_TYPES = Object.freeze(COMBO_TYPES);
    window.GAME_CONFIG = Object.freeze(GAME_CONFIG);

    console.log('[Module 1: Constants] Loaded - 56 card deck with 14 types defined');
})();
