/**
 * Task 7: UI Renderer Tests
 * 
 * Tests for Module 10 — UIRenderer
 * Uses jsdom-like mock for DOM operations.
 * 
 * Run: node run-test-task7.js
 */

// ========== DOM MOCK ==========

function createDOMMock() {
    const elements = {};

    function makeEl(id) {
        var classListObj = {
            _classes: new Set(),
            add: function(c) { this._classes.add(c); },
            remove: function(c) { this._classes.delete(c); },
            contains: function(c) { return this._classes.has(c); },
            toggle: function(c) {
                if (this._classes.has(c)) this._classes.delete(c);
                else this._classes.add(c);
            }
        };
        var el = {
            id: id,
            _classList: classListObj,
            classList: classListObj,
            dataset: {},
            children: [],
            childNodes: [],
            _innerHTML: '',
            style: {},
            attributes: {},
            disabled: false,
            value: '',
            type: '',
            min: '',
            max: '',
            parentNode: null,
            scrollTop: 0,
            scrollHeight: 0,
            setAttribute: function(k, v) { this.attributes[k] = v; },
            getAttribute: function(k) { return this.attributes[k] || null; },
            appendChild: function(child) {
                this.children.push(child);
                this.childNodes.push(child);
                child.parentNode = this;
                return child;
            },
            removeChild: function(child) {
                this.children = this.children.filter(c => c !== child);
                this.childNodes = this.childNodes.filter(c => c !== child);
            },
            addEventListener: function(event, handler) {
                if (!this._listeners) this._listeners = {};
                if (!this._listeners[event]) this._listeners[event] = [];
                this._listeners[event].push(handler);
            },
            removeEventListener: function() {},
            querySelectorAll: function(sel) {
                var results = [];
                var cleanSel = sel.replace(/[.#]/g, '');
                this.children.forEach(function(child) {
                    if (child._classList && typeof child._classList.has === 'function' && child._classList.has(cleanSel)) {
                        results.push(child);
                    }
                });
                return results;
            },
            querySelector: function(sel) {
                var results = this.querySelectorAll(sel);
                return results.length > 0 ? results[0] : null;
            }
        };
        // Make className sync with classList
        Object.defineProperty(el, 'className', {
            get: function() {
                return Array.from(classListObj._classes).join(' ');
            },
            set: function(val) {
                classListObj._classes = new Set(val.split(/\s+/).filter(Boolean));
            }
        });
        Object.defineProperty(el, 'textContent', {
            get: function() { return this._textContent; },
            set: function(val) { this._textContent = val; }
        });
        Object.defineProperty(el, 'innerHTML', {
            get: function() { return this._innerHTML; },
            set: function(val) {
                this._innerHTML = val;
                if (val === '') {
                    this.children = [];
                    this.childNodes = [];
                }
            }
        });
        elements[id] = el;
        return el;
    }

    // Create all elements referenced in index.html
    const ids = [
        'setup-screen', 'game-screen', 'game-over-screen',
        'deck-count', 'current-player-name', 'discard-pile',
        'opponents-area', 'action-log',
        'player-hand', 'draw-btn', 'end-turn-btn',
        'winner-text',
        'peek-modal', 'peek-cards',
        'defuse-modal', 'defuse-deck-picker', 'defuse-confirm-btn',
        'favor-target-modal', 'favor-target-list',
        'favor-give-modal', 'favor-give-cards',
        'combo-modal', 'combo-card-selector', 'combo-confirm-btn',
        'nope-modal', 'nope-yes-btn', 'nope-no-btn',
        'three-kind-modal', 'card-name-select', 'three-kind-confirm-btn',
        'discard-browser-modal', 'discard-cards',
        'defuse-position-slider'
    ];

    const documentMock = {
        _elements: elements,
        getElementById: function(id) {
            if (!elements[id]) {
                elements[id] = makeEl(id);
            }
            return elements[id];
        },
        createElement: function(tag) {
            return makeEl('auto-' + tag + '-' + Math.random().toString(36).substr(2, 9));
        },
        querySelector: function(sel) {
            // Search all elements for matching class
            var cleanSel = sel.replace(/[.#]/g, '');
            for (var key in elements) {
                if (elements[key]._classList && typeof elements[key]._classList.has === 'function' && elements[key]._classList.has(cleanSel)) {
                    return elements[key];
                }
            }
            return null;
        }
    };

    return { documentMock, elements, makeEl };
}

// ========== SETUP ==========

global.window = {};

// Load modules
require('../js/modules/01-constants.js');
require('../js/modules/02-deck.js');
require('../js/modules/03-game-state.js');
require('../js/modules/04-player.js');
require('../js/modules/05-turn-engine.js');
require('../js/modules/06-card-effects.js');
require('../js/modules/07-combo.js');
require('../js/modules/08-nope.js');

// Set up DOM mock before loading UI Renderer
const { documentMock, elements, makeEl } = createDOMMock();
global.document = documentMock;
global.window.document = documentMock;

// Load UI Renderer
require('../js/modules/10-ui-renderer.js');

// Initialize UI Renderer (caches DOM references)
global.window.UIRenderer.init();

// ========== TEST UTILITIES ==========

let testCount = 0;
let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
    testCount++;
    if (condition) {
        passCount++;
    } else {
        failCount++;
        failures.push(message);
        console.log('  ❌ FAIL: ' + message);
    }
}

function assertEqual(actual, expected, message) {
    testCount++;
    if (actual === expected) {
        passCount++;
    } else {
        failCount++;
        failures.push(message + ' (expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual) + ')');
        console.log('  ❌ FAIL: ' + message + ' (expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual) + ')');
    }
}

function assertNotEqual(actual, expected, message) {
    testCount++;
    if (actual !== expected) {
        passCount++;
    } else {
        failCount++;
        failures.push(message + ' (should not equal: ' + JSON.stringify(expected) + ')');
        console.log('  ❌ FAIL: ' + message);
    }
}

function test(name, fn) {
    console.log('\n--- ' + name + ' ---');
    try {
        fn();
    } catch (e) {
        testCount++;
        failCount++;
        failures.push(name + ' — Exception: ' + e.message);
        console.log('  ❌ EXCEPTION: ' + e.message);
    }
}

// ========== HELPER: Create test state ==========

function createTestState(overrides) {
    var baseState = {
        gamePhase: 'play',
        gameStatus: 'active',
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 2, name: 'Carol', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ],
        currentPlayerIndex: 0,
        drawPile: [],
        discardPile: [],
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
        lastAction: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    if (overrides) {
        Object.keys(overrides).forEach(function(key) {
            baseState[key] = overrides[key];
        });
    }
    return baseState;
}

function makeCard(type, instanceId) {
    var def = global.window.CARD_TYPES[type];
    return {
        instanceId: instanceId || (type + '-' + Math.random().toString(36).substr(2, 6)),
        type: type,
        cornerIcon: def ? def.cornerIcon : null,
        emoji: def ? def.emoji : '🃏',
        name: def ? def.name : type
    };
}

// ========== TESTS ==========

console.log('========================================');
console.log('Task 7: UI Renderer Tests');
console.log('========================================\n');

// Test 1: Module loads and exposes API
test('Module Loading', function() {
    assert(typeof global.window.UIRenderer === 'object', 'UIRenderer should be exposed on window');
    assert(typeof global.window.UIRenderer.init === 'function', 'init should be a function');
    assert(typeof global.window.UIRenderer.render === 'function', 'render should be a function');
    assert(typeof global.window.UIRenderer.renderCard === 'function', 'renderCard should be a function');
    assert(typeof global.window.UIRenderer.renderCardBack === 'function', 'renderCardBack should be a function');
    assert(typeof global.window.UIRenderer.forceRender === 'function', 'forceRender should be a function');
    assert(typeof global.window.UIRenderer.getDefusePosition === 'function', 'getDefusePosition should be a function');
    assert(typeof global.window.UIRenderer.getSelectedComboCards === 'function', 'getSelectedComboCards should be a function');
    assert(typeof global.window.UIRenderer.getSelectedCardName === 'function', 'getSelectedCardName should be a function');
});

// Test 2: renderCard creates card element
test('renderCard — Basic Card Creation', function() {
    var card = makeCard('attack', 'atk-1');
    var el = global.window.UIRenderer.renderCard(card);

    assert(el !== null && el !== undefined, 'renderCard should return an element');
    assert(el.classList.contains('card'), 'Card should have .card class');
    assert(el.classList.contains('card--attack'), 'Attack card should have card--attack class');
    assertEqual(el.dataset.cardType, 'attack', 'Card type should be set in dataset');
    assertEqual(el.dataset.instanceId, 'atk-1', 'Instance ID should be set in dataset');
});

// Test 3: renderCard with null returns empty div
test('renderCard — Null Input', function() {
    var el = global.window.UIRenderer.renderCard(null);
    assert(el !== null, 'renderCard(null) should return an element');
});

// Test 4: renderCard type classes
test('renderCard — Card Type Classes', function() {
    var types = [
        ['exploding_kitten', 'card--exploding'],
        ['defuse', 'card--defuse'],
        ['attack', 'card--attack'],
        ['skip', 'card--skip'],
        ['favor', 'card--favor'],
        ['shuffle', 'card--shuffle'],
        ['see_future', 'card--see-future'],
        ['nope', 'card--nope'],
        ['tacocat', 'card--cat'],
        ['cattermelon', 'card--cat'],
        ['hairy_potato_cat', 'card--cat'],
        ['beard_cat', 'card--cat'],
        ['rainbow_cat', 'card--cat']
    ];

    types.forEach(function(pair) {
        var card = makeCard(pair[0], pair[0] + '-test');
        var el = global.window.UIRenderer.renderCard(card);
        assert(el.classList.contains(pair[1]), pair[0] + ' should have class ' + pair[1]);
    });
});

// Test 5: renderCard with selected option
test('renderCard — Selected State', function() {
    var card = makeCard('skip', 'skip-1');
    var el = global.window.UIRenderer.renderCard(card, { selected: true });
    assert(el.classList.contains('card--selected'), 'Selected card should have card--selected class');
});

// Test 6: renderCard with disabled option
test('renderCard — Disabled State', function() {
    var card = makeCard('defuse', 'def-1');
    var el = global.window.UIRenderer.renderCard(card, { disabled: true });
    assert(el.classList.contains('card--disabled'), 'Disabled card should have card--disabled class');
});

// Test 7: renderCardBack
test('renderCardBack', function() {
    var el = global.window.UIRenderer.renderCardBack();
    assert(el.classList.contains('card'), 'Card back should have .card class');
    assert(el.classList.contains('card-back'), 'Card back should have .card-back class');
});

// Test 8: render — null state does nothing
test('render — Null State', function() {
    assertEqual(global.window.UIRenderer.render(null), undefined, 'render(null) should not throw');
});

// Test 9: render — game over phase
test('render — Game Over Phase', function() {
    var state = createTestState({
        gamePhase: 'game-over',
        gameStatus: 'completed',
        players: [
            { id: 0, name: 'Alice', isAlive: true, isHuman: true, isAI: false, hand: [] },
            { id: 1, name: 'Bob', isAlive: false, isHuman: false, isAI: true, hand: [] }
        ]
    });

    global.window.UIRenderer.render(state);

    // Game over screen should be active
    var gameOverScreen = documentMock.getElementById('game-over-screen');
    assert(gameOverScreen.classList.contains('screen--active'), 'Game over screen should be active');

    // Winner text should contain Alice
    var winnerText = documentMock.getElementById('winner-text');
    assert(winnerText.textContent.indexOf('Alice') !== -1, 'Winner text should contain winner name');
});

// Test 10: render — game over with no winner
test('render — Game Over No Winner', function() {
    var state = createTestState({
        gamePhase: 'game-over',
        gameStatus: 'completed',
        players: [
            { id: 0, name: 'Alice', isAlive: false, isHuman: true, isAI: false, hand: [] },
            { id: 1, name: 'Bob', isAlive: false, isHuman: false, isAI: true, hand: [] }
        ]
    });

    global.window.UIRenderer.render(state);
    var winnerText = documentMock.getElementById('winner-text');
    assert(winnerText.textContent.indexOf('Game Over') !== -1, 'Should show Game Over when no winner');
});

// Test 11: render — active game renders game screen
test('render — Active Game', function() {
    var card1 = makeCard('attack', 'atk-1');
    var card2 = makeCard('skip', 'skip-1');
    var state = createTestState({
        drawPile: [makeCard('defuse', 'd1'), makeCard('nope', 'n1')],
        discardPile: [makeCard('shuffle', 'sh1')],
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [card1, card2], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [makeCard('nope', 'n2')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ],
        currentPlayerIndex: 0,
        turnPhase: 'draw'
    });

    global.window.UIRenderer.render(state);

    // Deck count should be 2
    var deckCount = documentMock.getElementById('deck-count');
    assertEqual(String(deckCount.textContent), '2', 'Deck count should be 2');

    // Current player name should show Alice
    var cpName = documentMock.getElementById('current-player-name');
    assert(cpName.textContent.indexOf('Alice') !== -1, 'Current player should be Alice');

    // Player hand should have 2 cards
    var hand = documentMock.getElementById('player-hand');
    assertEqual(hand.children.length, 2, 'Player hand should have 2 cards');

    // Opponents area should have 1 panel (Bob, not Alice who is current)
    var oppArea = documentMock.getElementById('opponents-area');
    assertEqual(oppArea.children.length, 1, 'Opponents area should have 1 panel');
});

// Test 12: render — deck count updates
test('render — Deck Count', function() {
    var state = createTestState({ drawPile: new Array(10) });
    global.window.UIRenderer.render(state);
    var deckCount = documentMock.getElementById('deck-count');
    assertEqual(String(deckCount.textContent), '10', 'Deck count should be 10');
});

// Test 13: render — empty discard pile
test('render — Empty Discard Pile', function() {
    var state = createTestState({ discardPile: [] });
    global.window.UIRenderer.render(state);
    var discardPile = documentMock.getElementById('discard-pile');
    assertEqual(discardPile.children.length, 1, 'Empty discard should have 1 child (empty message)');
});

// Test 14: render — discard pile with cards
test('render — Discard Pile With Cards', function() {
    var state = createTestState({
        discardPile: [makeCard('skip', 's1'), makeCard('attack', 'a1')]
    });
    global.window.UIRenderer.render(state);
    var discardPile = documentMock.getElementById('discard-pile');
    assertEqual(discardPile.children.length, 1, 'Discard pile should show 1 card (top card only)');
});

// Test 15: render — opponents with dead player
test('render — Opponents With Dead Player', function() {
    var state = createTestState({
        currentPlayerIndex: 0,
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: false, isEliminated: true, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 1 } },
            { id: 2, name: 'Carol', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [makeCard('nope', 'n1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);
    var oppArea = documentMock.getElementById('opponents-area');
    assertEqual(oppArea.children.length, 2, 'Should have 2 opponent panels (Bob + Carol, not Alice)');

    // Bob's panel should have dead class
    var bobPanel = oppArea.children[0];
    assert(bobPanel.classList.contains('opponent-panel--dead'), 'Bob should be marked dead');
});

// Test 16: render — player hand with cards
test('render — Player Hand', function() {
    var cards = [makeCard('attack', 'a1'), makeCard('skip', 's1'), makeCard('defuse', 'd1')];
    var state = createTestState({
        currentPlayerIndex: 0,
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: cards, turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ],
        turnPhase: 'draw'
    });
    global.window.UIRenderer.render(state);
    var hand = documentMock.getElementById('player-hand');
    assertEqual(hand.children.length, 3, 'Hand should have 3 cards');
});

// Test 17: render — empty hand shows message
test('render — Empty Hand', function() {
    var state = createTestState({
        currentPlayerIndex: 0,
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ],
        turnPhase: 'draw'
    });
    global.window.UIRenderer.render(state);
    var hand = documentMock.getElementById('player-hand');
    assertEqual(hand.children.length, 1, 'Empty hand should have 1 child (message)');
});

// Test 18: render — action log
test('render — Action Log', function() {
    var state = createTestState({
        actionLog: [
            { description: 'Game started', timestamp: Date.now() },
            { description: 'Alice drew a card', playerName: 'Alice', timestamp: Date.now() },
            { description: 'Bob played Skip', playerName: 'Bob', timestamp: Date.now() }
        ]
    });
    global.window.UIRenderer.render(state);
    var log = documentMock.getElementById('action-log');
    assertEqual(log.children.length, 3, 'Log should have 3 entries');
});

// Test 19: render — action log limited to 20 entries
test('render — Action Log Limit', function() {
    var entries = [];
    for (var i = 0; i < 25; i++) {
        entries.push({ description: 'Action ' + i, timestamp: Date.now() });
    }
    var state = createTestState({ actionLog: entries });
    global.window.UIRenderer.render(state);
    var log = documentMock.getElementById('action-log');
    assertEqual(log.children.length, 20, 'Log should be limited to 20 entries');
});

// Test 20: render — draw button enabled during draw phase
test('render — Draw Button Enabled (draw phase)', function() {
    var state = createTestState({
        turnPhase: 'draw',
        currentPlayerIndex: 0,
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);
    var drawBtn = documentMock.getElementById('draw-btn');
    assertEqual(drawBtn.disabled, false, 'Draw button should be enabled during draw phase for human player');
});

// Test 21: render — draw button disabled for AI player
test('render — Draw Button Disabled (AI player)', function() {
    var state = createTestState({
        turnPhase: 'draw',
        currentPlayerIndex: 1,
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);
    var drawBtn = documentMock.getElementById('draw-btn');
    assertEqual(drawBtn.disabled, true, 'Draw button should be disabled for AI player');
});

// Test 22: render — draw button disabled during nope window
test('render — Draw Button Disabled (Nope Window)', function() {
    var state = createTestState({
        turnPhase: 'draw',
        nopeWindowActive: true,
        currentPlayerIndex: 0,
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);
    var drawBtn = documentMock.getElementById('draw-btn');
    assertEqual(drawBtn.disabled, true, 'Draw button should be disabled during nope window');
});

// Test 23: render — end turn button enabled during play phase
test('render — End Turn Button Enabled (play phase)', function() {
    var state = createTestState({
        turnPhase: 'play',
        currentPlayerIndex: 0,
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);
    var endTurnBtn = documentMock.getElementById('end-turn-btn');
    assertEqual(endTurnBtn.disabled, false, 'End turn button should be enabled during play phase');
});

// Test 24: render — end turn button disabled during draw phase
test('render — End Turn Button Disabled (draw phase)', function() {
    var state = createTestState({
        turnPhase: 'draw',
        currentPlayerIndex: 0,
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);
    var endTurnBtn = documentMock.getElementById('end-turn-btn');
    assertEqual(endTurnBtn.disabled, true, 'End turn button should be disabled during draw phase');
});

// Test 25: render — buttons disabled when modal active
test('render — Buttons Disabled (Modal Active)', function() {
    var state = createTestState({
        turnPhase: 'draw',
        activeModal: 'peek-modal',
        currentPlayerIndex: 0,
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);
    var drawBtn = documentMock.getElementById('draw-btn');
    var endTurnBtn = documentMock.getElementById('end-turn-btn');
    assertEqual(drawBtn.disabled, true, 'Draw button should be disabled when modal active');
    assertEqual(endTurnBtn.disabled, true, 'End turn button should be disabled when modal active');
});

// Test 26: render — peek modal opens
test('render — Peek Modal', function() {
    var peekedCards = [makeCard('attack', 'a1'), makeCard('skip', 's2'), makeCard('defuse', 'd3')];
    var state = createTestState({
        activeModal: 'peek-modal',
        modalData: { peekedCards: peekedCards }
    });
    global.window.UIRenderer.render(state);

    var peekModal = documentMock.getElementById('peek-modal');
    assert(peekModal.classList.contains('modal--active'), 'Peek modal should be active');

    var peekCards = documentMock.getElementById('peek-cards');
    assertEqual(peekCards.children.length, 3, 'Peek modal should show 3 cards');
});

// Test 27: render — defuse modal opens with slider
test('render — Defuse Modal', function() {
    var state = createTestState({
        activeModal: 'defuse-modal',
        drawPile: new Array(10),
        modalData: {}
    });
    global.window.UIRenderer.render(state);

    var defuseModal = documentMock.getElementById('defuse-modal');
    assert(defuseModal.classList.contains('modal--active'), 'Defuse modal should be active');

    var picker = documentMock.getElementById('defuse-deck-picker');
    assert(picker.children.length >= 2, 'Defuse picker should have label + slider + display');
});

// Test 28: render — favor target modal
test('render — Favor Target Modal', function() {
    var state = createTestState({
        activeModal: 'favor-target-modal',
        modalData: { playerId: 0 },
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [makeCard('nope', 'n1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 2, name: 'Carol', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [makeCard('attack', 'a1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);

    var favorModal = documentMock.getElementById('favor-target-modal');
    assert(favorModal.classList.contains('modal--active'), 'Favor target modal should be active');

    var targetList = documentMock.getElementById('favor-target-list');
    assertEqual(targetList.children.length, 2, 'Should list 2 target players (Bob + Carol)');
});

// Test 29: render — favor give modal
test('render — Favor Give Modal', function() {
    var bobCards = [makeCard('nope', 'n1'), makeCard('attack', 'a1')];
    var state = createTestState({
        activeModal: 'favor-give-modal',
        modalData: { targetPlayerId: 1 },
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: bobCards, turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);

    var favorGiveModal = documentMock.getElementById('favor-give-modal');
    assert(favorGiveModal.classList.contains('modal--active'), 'Favor give modal should be active');

    var giveCards = documentMock.getElementById('favor-give-cards');
    assertEqual(giveCards.children.length, 2, 'Should show 2 cards to give');
});

// Test 30: render — nope modal
test('render — Nope Modal', function() {
    var state = createTestState({
        activeModal: 'nope-modal',
        modalData: {
            nopeStack: [],
            pendingAction: { description: 'Alice plays Attack' }
        }
    });
    global.window.UIRenderer.render(state);

    var nopeModal = documentMock.getElementById('nope-modal');
    assert(nopeModal.classList.contains('modal--active'), 'Nope modal should be active');
});

// Test 31: render — three-kind modal
test('render — Three Kind Modal', function() {
    var state = createTestState({
        activeModal: 'three-kind-modal',
        modalData: {}
    });
    global.window.UIRenderer.render(state);

    var threeKindModal = documentMock.getElementById('three-kind-modal');
    assert(threeKindModal.classList.contains('modal--active'), 'Three kind modal should be active');

    var select = documentMock.getElementById('card-name-select');
    assert(select.children.length > 0, 'Card name select should have options');
});

// Test 32: render — discard browser modal
test('render — Discard Browser Modal', function() {
    var state = createTestState({
        activeModal: 'discard-browser-modal',
        discardPile: [makeCard('skip', 's1'), makeCard('attack', 'a1'), makeCard('nope', 'n1')]
    });
    global.window.UIRenderer.render(state);

    var discardModal = documentMock.getElementById('discard-browser-modal');
    assert(discardModal.classList.contains('modal--active'), 'Discard browser modal should be active');

    var discardCards = documentMock.getElementById('discard-cards');
    assertEqual(discardCards.children.length, 3, 'Should show 3 discard cards');
});

// Test 33: render — modal closes when activeModal is null
test('render — Modal Closes When Null', function() {
    // First open a modal
    var state1 = createTestState({ activeModal: 'peek-modal', modalData: { peekedCards: [] } });
    global.window.UIRenderer.render(state1);
    var peekModal = documentMock.getElementById('peek-modal');
    assert(peekModal.classList.contains('modal--active'), 'Peek modal should be active');

    // Now close it
    var state2 = createTestState({ activeModal: null });
    global.window.UIRenderer.render(state2);
    assert(!peekModal.classList.contains('modal--active'), 'Peek modal should be closed');
});

// Test 34: render — combo modal
test('render — Combo Modal', function() {
    var catCards = [makeCard('tacocat', 'tc1'), makeCard('cattermelon', 'cm1')];
    var state = createTestState({
        activeModal: 'combo-modal',
        currentPlayerIndex: 0,
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: catCards.concat([makeCard('skip', 's1')]), turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);

    var comboModal = documentMock.getElementById('combo-modal');
    assert(comboModal.classList.contains('modal--active'), 'Combo modal should be active');

    var selector = documentMock.getElementById('combo-card-selector');
    assertEqual(selector.children.length, 2, 'Should show 2 cat cards (not skip)');
});

// Test 35: getDefusePosition returns 0 when no slider
test('getDefusePosition — No Slider', function() {
    // Re-init to clear cached slider from previous defuse modal test
    global.window.UIRenderer.init();
    var pos = global.window.UIRenderer.getDefusePosition();
    assertEqual(pos, 0, 'getDefusePosition should return 0 when no slider exists');
});

// Test 36: getSelectedComboCards returns empty when no selector
test('getSelectedComboCards — Empty', function() {
    var cards = global.window.UIRenderer.getSelectedComboCards();
    assertEqual(cards.length, 0, 'Should return empty array when no cards selected');
});

// Test 37: getSelectedCardName returns empty string when no select
test('getSelectedCardName — Empty', function() {
    var name = global.window.UIRenderer.getSelectedCardName();
    assertEqual(name, '', 'Should return empty string when no card name select exists');
});

// Test 38: render — current player name updates
test('render — Current Player Name', function() {
    var state = createTestState({
        currentPlayerIndex: 1,
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);
    var cpName = documentMock.getElementById('current-player-name');
    assert(cpName.textContent.indexOf('Bob') !== -1, 'Current player name should show Bob');
});

// Test 39: render — dead current player hand not rendered
test('render — Dead Current Player', function() {
    var state = createTestState({
        currentPlayerIndex: 0,
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: false, isEliminated: true, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 1 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);
    var hand = documentMock.getElementById('player-hand');
    assertEqual(hand.children.length, 0, 'Dead player hand should not be rendered');
});

// Test 40: render — cards in hand are clickable during draw phase
test('render — Cards Clickable During Draw Phase', function() {
    var state = createTestState({
        turnPhase: 'draw',
        currentPlayerIndex: 0,
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);
    var hand = documentMock.getElementById('player-hand');
    var cardEl = hand.children[0];
    assert(!cardEl.classList.contains('card--disabled'), 'Card should not be disabled during draw phase');
});

// Test 41: render — cards in hand disabled during nope window
test('render — Cards Disabled During Nope Window', function() {
    var state = createTestState({
        turnPhase: 'draw',
        nopeWindowActive: true,
        currentPlayerIndex: 0,
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);
    var hand = documentMock.getElementById('player-hand');
    var cardEl = hand.children[0];
    assert(cardEl.classList.contains('card--disabled'), 'Card should be disabled during nope window');
});

// Test 42: render — cards disabled during resolve phase
test('render — Cards Disabled During Resolve Phase', function() {
    var state = createTestState({
        turnPhase: 'resolve',
        currentPlayerIndex: 0,
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);
    var hand = documentMock.getElementById('player-hand');
    var cardEl = hand.children[0];
    assert(cardEl.classList.contains('card--disabled'), 'Card should be disabled during resolve phase');
});

// Test 43: render — opponent panel shows AI indicator
test('render — Opponent AI Indicator', function() {
    var state = createTestState({
        currentPlayerIndex: 0,
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);
    var oppArea = documentMock.getElementById('opponents-area');
    var bobPanel = oppArea.children[0];
    var nameEl = bobPanel.children[0];
    assert(nameEl.textContent.indexOf('🤖') !== -1, 'AI opponent should have robot emoji');
});

// Test 44: render — opponent panel shows card count
test('render — Opponent Card Count', function() {
    var state = createTestState({
        currentPlayerIndex: 0,
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [makeCard('nope', 'n1'), makeCard('attack', 'a1'), makeCard('defuse', 'd1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);
    var oppArea = documentMock.getElementById('opponents-area');
    var bobPanel = oppArea.children[0];
    var cardCountEl = bobPanel.children[1];
    assert(cardCountEl.textContent.indexOf('3') !== -1, 'Opponent should show 3 cards');
});

// Test 45: render — favor target modal with no alive players
test('render — Favor Target No Players', function() {
    var state = createTestState({
        activeModal: 'favor-target-modal',
        modalData: { playerId: 0 },
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: false, isEliminated: true, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 1 } }
        ]
    });
    global.window.UIRenderer.render(state);
    var targetList = documentMock.getElementById('favor-target-list');
    assertEqual(targetList.children.length, 1, 'Should show 1 child (no players message)');
});

// Test 46: render — discard browser empty
test('render — Discard Browser Empty', function() {
    var state = createTestState({
        activeModal: 'discard-browser-modal',
        discardPile: []
    });
    global.window.UIRenderer.render(state);
    var discardCards = documentMock.getElementById('discard-cards');
    assertEqual(discardCards.children.length, 1, 'Should show 1 child (empty message)');
});

// Test 47: render — combo modal with no cat cards
test('render — Combo Modal No Cat Cards', function() {
    var state = createTestState({
        activeModal: 'combo-modal',
        currentPlayerIndex: 0,
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1'), makeCard('attack', 'a1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);
    var selector = documentMock.getElementById('combo-card-selector');
    assertEqual(selector.children.length, 1, 'Should show 1 child (no cat cards message)');
});

// Test 48: render — nope modal with stack
test('render — Nope Modal With Stack', function() {
    var state = createTestState({
        activeModal: 'nope-modal',
        modalData: {
            nopeStack: [{ playerId: 1, card: makeCard('nope', 'n1') }],
            pendingAction: { description: 'Alice plays Skip' }
        }
    });
    global.window.UIRenderer.render(state);
    var nopeModal = documentMock.getElementById('nope-modal');
    assert(nopeModal.classList.contains('modal--active'), 'Nope modal should be active with stack');
});

// Test 49: render — favor give modal with empty hand
test('render — Favor Give Empty Hand', function() {
    var state = createTestState({
        activeModal: 'favor-give-modal',
        modalData: { targetPlayerId: 1 },
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);
    var giveCards = documentMock.getElementById('favor-give-cards');
    assertEqual(giveCards.children.length, 1, 'Should show 1 child (no cards message)');
});

// Test 50: render — favor give modal with invalid player
test('render — Favor Give Invalid Player', function() {
    var state = createTestState({
        activeModal: 'favor-give-modal',
        modalData: { targetPlayerId: 99 },
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);
    var giveCards = documentMock.getElementById('favor-give-cards');
    assertEqual(giveCards.children.length, 1, 'Should show 1 child (no player found message)');
});

// Test 51: render — multiple modals, only one active
test('render — Only One Modal Active', function() {
    var state = createTestState({
        activeModal: 'defuse-modal',
        drawPile: new Array(5),
        modalData: {}
    });
    global.window.UIRenderer.render(state);

    var defuseModal = documentMock.getElementById('defuse-modal');
    var peekModal = documentMock.getElementById('peek-modal');
    var nopeModal = documentMock.getElementById('nope-modal');

    assert(defuseModal.classList.contains('modal--active'), 'Defuse modal should be active');
    assert(!peekModal.classList.contains('modal--active'), 'Peek modal should not be active');
    assert(!nopeModal.classList.contains('modal--active'), 'Nope modal should not be active');
});

// Test 52: render — game screen not rendered for setup phase
test('render — Setup Phase Does Not Render Game', function() {
    var state = createTestState({
        gamePhase: 'setup',
        gameStatus: 'inactive'
    });
    // Should not throw
    assertEqual(global.window.UIRenderer.render(state), undefined, 'render during setup should not throw');
});

// Test 53: render — log entries with player name
test('render — Log Entries With Player Name', function() {
    var state = createTestState({
        actionLog: [
            { description: 'played Skip', playerName: 'Alice', timestamp: Date.now() }
        ]
    });
    global.window.UIRenderer.render(state);
    var log = documentMock.getElementById('action-log');
    var entry = log.children[0];
    assert(entry.textContent.indexOf('Alice') !== -1, 'Log entry should contain player name');
});

// Test 54: render — opponent panel dataset has player ID
test('render — Opponent Panel Dataset', function() {
    var state = createTestState({
        currentPlayerIndex: 0,
        players: [
            { id: 0, name: 'Alice', isAI: false, isHuman: true, isAlive: true, isEliminated: false, hand: [makeCard('skip', 's1')], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } },
            { id: 1, name: 'Bob', isAI: true, isHuman: false, isAlive: true, isEliminated: false, hand: [], turnCount: 0, consecutiveAttackTurns: 0, hasTakenTurn: false, stats: { cardsPlayed: 0, cardsDrawn: 0, combosUsed: 0, nopesPlayed: 0, timesEliminated: 0 } }
        ]
    });
    global.window.UIRenderer.render(state);
    var oppArea = documentMock.getElementById('opponents-area');
    var bobPanel = oppArea.children[0];
    assertEqual(bobPanel.dataset.playerId, 1, 'Opponent panel should have player ID in dataset');
});

// Test 55: render — card has emoji and name
test('render — Card Has Emoji And Name', function() {
    var card = makeCard('tacocat', 'tc-1');
    var el = global.window.UIRenderer.renderCard(card);
    // Check children for emoji and name spans
    var hasEmoji = false;
    var hasName = false;
    el.children.forEach(function(child) {
        if (child.classList.contains('card-emoji')) hasEmoji = true;
        if (child.classList.contains('card-name')) hasName = true;
    });
    assert(hasEmoji, 'Card should have emoji element');
    assert(hasName, 'Card should have name element');
});

// ========== RESULTS ==========

console.log('\n========================================');
console.log('TEST RESULTS: ' + passCount + '/' + testCount + ' passed, ' + failCount + ' failed');
console.log('========================================');

if (failCount > 0) {
    console.log('\nFailed tests:');
    failures.forEach(function(f) {
        console.log('  - ' + f);
    });
    process.exit(1);
} else {
    console.log('\n✅ ALL ' + testCount + ' TESTS PASSED!');
}