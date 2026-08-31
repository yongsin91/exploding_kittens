/**
 * Task 10: Event Handler / Input Controller Tests
 * 
 * Tests for Module 12 — Events
 * 
 * Run: node run-test-task10.js
 */

// ========== DOM MOCK ==========

var elements = {};

function makeEl(id) {
    var classListObj = {
        _classes: new Set(),
        add: function(c) { this._classes.add(c); },
        remove: function(c) { this._classes.delete(c); },
        contains: function(c) { return this._classes.has(c); },
        toggle: function(c) { if (this._classes.has(c)) this._classes.delete(c); else this._classes.add(c); }
    };
    var el = {
        id: id,
        _classList: classListObj,
        classList: classListObj,
        dataset: {},
        children: [],
        childNodes: [],
        _innerHTML: '',
        _textContent: '',
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
        tagName: 'DIV',
        setAttribute: function(k, v) { this.attributes[k] = v; },
        getAttribute: function(k) { return this.attributes[k] || null; },
        appendChild: function(child) { this.children.push(child); child.parentNode = this; return child; },
        removeChild: function(child) { this.children = this.children.filter(c => c !== child); },
        addEventListener: function(event, handler) {
            if (!this._listeners) this._listeners = {};
            if (!this._listeners[event]) this._listeners[event] = [];
            this._listeners[event].push(handler);
        },
        removeEventListener: function() {},
        querySelectorAll: function() { return []; },
        querySelector: function() { return null; },
        closest: function() { return null; }
    };
    Object.defineProperty(el, 'className', {
        get: function() { return Array.from(classListObj._classes).join(' '); },
        set: function(val) { classListObj._classes = new Set(val.split(/\s+/).filter(Boolean)); }
    });
    Object.defineProperty(el, 'textContent', {
        get: function() { return this._textContent; },
        set: function(val) { this._textContent = val; }
    });
    Object.defineProperty(el, 'innerHTML', {
        get: function() { return this._innerHTML; },
        set: function(val) { this._innerHTML = val; if (val === '') { this.children = []; this.childNodes = []; } }
    });
    elements[id] = el;
    return el;
}

global.window = {};
global.document = {
    getElementById: function(id) { if (!elements[id]) makeEl(id); return elements[id]; },
    createElement: function(tag) { return makeEl('auto-' + tag + '-' + Math.random().toString(36).substr(2, 9)); },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    addEventListener: function() {},
    body: { appendChild: function(){} },
    readyState: 'complete'
};
global.window.document = global.document;

// Load modules
require('../js/modules/01-constants.js');
require('../js/modules/02-deck.js');
require('../js/modules/03-game-state.js');
require('../js/modules/04-player.js');
require('../js/modules/05-turn-engine.js');
require('../js/modules/06-card-effects.js');
require('../js/modules/07-combo.js');
require('../js/modules/08-nope.js');
require('../js/modules/09-ai.js');
require('../js/modules/10-ui-renderer.js');
global.window.UIRenderer.init();
require('../js/modules/11-hotseat.js');
require('../js/modules/12-events.js');

// ========== TEST UTILITIES ==========

var testCount = 0, passCount = 0, failCount = 0;
var failures = [];

function assert(condition, message) {
    testCount++;
    if (condition) { passCount++; }
    else { failCount++; failures.push(message); console.log('  ❌ FAIL: ' + message); }
}

function assertEqual(actual, expected, message) {
    testCount++;
    if (actual === expected) { passCount++; }
    else {
        failCount++;
        failures.push(message + ' (expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual) + ')');
        console.log('  ❌ FAIL: ' + message);
    }
}

function test(name, fn) {
    console.log('\n--- ' + name + ' ---');
    try { fn(); }
    catch (e) {
        testCount++; failCount++;
        failures.push(name + ' — Exception: ' + e.message);
        console.log('  ❌ EXCEPTION: ' + e.message);
    }
}

// ========== HELPERS ==========

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

function setupGame() {
    global.window.GameState.reset();
    var players = [
        global.window.Player.createPlayer(0, 'Alice', false),
        global.window.Player.createPlayer(1, 'Bob', true),
        global.window.Player.createPlayer(2, 'Carol', true)
    ];

    global.window.GameState.setState({
        players: players,
        currentPlayerIndex: 0,
        gamePhase: 'play',
        gameStatus: 'active',
        drawPile: [makeCard('defuse', 'd1'), makeCard('skip', 's1'), makeCard('attack', 'a1')],
        discardPile: [],
        turnPhase: 'draw'
    });

    // Add cards via Player module so they're in the internal state
    global.window.Player.addCardToHand(0, makeCard('skip', 's0'));
    global.window.Player.addCardToHand(0, makeCard('attack', 'a0'));
    global.window.Player.addCardToHand(0, makeCard('nope', 'n0'));
    global.window.Player.addCardToHand(1, makeCard('nope', 'n1'));
    global.window.Player.addCardToHand(2, makeCard('nope', 'n2'));
}

// ========== TESTS ==========

console.log('========================================');
console.log('Task 10: Event Handler Tests');
console.log('========================================\n');

// Test 1: Module loads and exposes API
test('Module Loading', function() {
    assert(typeof global.window.Events === 'object', 'Events should be exposed on window');
    assert(typeof global.window.Events.init === 'function', 'init should be a function');
    assert(typeof global.window.Events.handleCardClick === 'function', 'handleCardClick should be a function');
    assert(typeof global.window.Events.handleDrawClick === 'function', 'handleDrawClick should be a function');
    assert(typeof global.window.Events.handleEndTurnClick === 'function', 'handleEndTurnClick should be a function');
    assert(typeof global.window.Events.handleTargetSelect === 'function', 'handleTargetSelect should be a function');
    assert(typeof global.window.Events.handleNopeResponse === 'function', 'handleNopeResponse should be a function');
    assert(typeof global.window.Events.handleDefusePlace === 'function', 'handleDefusePlace should be a function');
    assert(typeof global.window.Events.handleFavorGive === 'function', 'handleFavorGive should be a function');
    assert(typeof global.window.Events.handleComboSubmit === 'function', 'handleComboSubmit should be a function');
    assert(typeof global.window.Events.handleComboCardToggle === 'function', 'handleComboCardToggle should be a function');
    assert(typeof global.window.Events.handleThreeKindName === 'function', 'handleThreeKindName should be a function');
    assert(typeof global.window.Events.handleDiscardPick === 'function', 'handleDiscardPick should be a function');
    assert(typeof global.window.Events.handlePlayAgain === 'function', 'handlePlayAgain should be a function');
});

// Test 2: init does not throw
test('Init', function() {
    global.window.Events.init();
    assert(true, 'init should not throw');
});

// Test 3: handleCardClick does not throw with valid card
test('Handle Card Click — Valid', function() {
    setupGame();
    global.window.Events.handleCardClick('s0');
    // Card should be removed from hand and added to discard
    var state = global.window.GameState.getState();
    assert(state.discardPile.length > 0, 'Discard pile should have card after play');
});

// Test 4: handleCardClick with invalid card ID
test('Handle Card Click — Invalid ID', function() {
    setupGame();
    global.window.Events.handleCardClick('nonexistent');
    var state = global.window.GameState.getState();
    assertEqual(state.discardPile.length, 0, 'Discard pile should be empty for invalid card');
});

// Test 5: handleCardClick with defuse card (should not play)
test('Handle Card Click — Defuse', function() {
    setupGame();
    global.window.Player.addCardToHand(0, makeCard('defuse', 'df0'));
    global.window.Events.handleCardClick('df0');
    var state = global.window.GameState.getState();
    assertEqual(state.discardPile.length, 0, 'Defuse should not be played directly');
});

// Test 6: handleCardClick with exploding kitten (should not play)
test('Handle Card Click — Exploding Kitten', function() {
    setupGame();
    global.window.Player.addCardToHand(0, makeCard('exploding_kitten', 'ek0'));
    global.window.Events.handleCardClick('ek0');
    var state = global.window.GameState.getState();
    assertEqual(state.discardPile.length, 0, 'EK should not be played directly');
});

// Test 7: handleCardClick with favor opens target modal
test('Handle Card Click — Favor Opens Modal', function() {
    setupGame();
    global.window.Player.addCardToHand(0, makeCard('favor', 'f0'));
    global.window.Events.handleCardClick('f0');
    var state = global.window.GameState.getState();
    assertEqual(state.activeModal, 'favor-target-modal', 'Favor should open target modal');
});

// Test 8: handleCardClick with cat card (single, no combo) plays it
test('Handle Card Click — Single Cat Card', function() {
    setupGame();
    global.window.Player.addCardToHand(0, makeCard('tacocat', 'tc0'));
    global.window.Events.handleCardClick('tc0');
    var state = global.window.GameState.getState();
    assert(state.discardPile.length > 0, 'Single cat card should be played');
});

// Test 9: handleCardClick with matching cat cards opens combo modal
test('Handle Card Click — Matching Cats Opens Combo', function() {
    setupGame();
    global.window.Player.addCardToHand(0, makeCard('tacocat', 'tc0'));
    global.window.Player.addCardToHand(0, makeCard('tacocat', 'tc1'));
    global.window.Events.handleCardClick('tc0');
    var state = global.window.GameState.getState();
    assertEqual(state.activeModal, 'combo-modal', 'Matching cats should open combo modal');
});

// Test 10: handleDrawClick does not throw
test('Handle Draw Click', function() {
    setupGame();
    // Should not throw even if GameFlow is not available
    global.window.Events.handleDrawClick();
    assert(true, 'handleDrawClick should not throw');
});

// Test 11: handleEndTurnClick does not throw
test('Handle End Turn Click', function() {
    setupGame();
    global.window.GameState.setState({ turnPhase: 'play' });
    global.window.Events.handleEndTurnClick();
    assert(true, 'handleEndTurnClick should not throw');
});

// Test 12: handleNopeResponse with false
test('Handle Nope Response — False', function() {
    setupGame();
    global.window.Events.handleNopeResponse(false);
    assert(true, 'handleNopeResponse(false) should not throw');
});

// Test 13: handleNopeResponse with true
test('Handle Nope Response — True', function() {
    setupGame();
    // Open a nope window first
    global.window.Nope.openNopeWindow({
        type: 'play-card',
        cardType: 'attack',
        playerId: 1,
        description: 'Bob plays Attack',
        resolver: function() {}
    });
    global.window.Events.handleNopeResponse(true, 0);
    assert(true, 'handleNopeResponse(true) should not throw');
});

// Test 14: handleTargetSelect does not throw
test('Handle Target Select', function() {
    setupGame();
    global.window.Events.handleTargetSelect(1);
    assert(true, 'handleTargetSelect should not throw');
});

// Test 15: handleFavorGive does not throw
test('Handle Favor Give', function() {
    setupGame();
    global.window.GameState.setState({
        activeModal: 'favor-give-modal',
        modalData: { targetPlayerId: 1, requesterId: 0 }
    });
    global.window.Events.handleFavorGive('n1');
    assert(true, 'handleFavorGive should not throw');
});

// Test 16: handleDefusePlace does not throw
test('Handle Defuse Place', function() {
    setupGame();
    global.window.Player.addCardToHand(0, makeCard('defuse', 'df0'));
    global.window.GameState.setState({
        activeModal: 'defuse-modal',
        modalData: { ekCard: makeCard('exploding_kitten', 'ek1'), playerId: 0 }
    });
    global.window.Events.handleDefusePlace();
    assert(true, 'handleDefusePlace should not throw');
});

// Test 17: handleComboSubmit with no cards selected
test('Handle Combo Submit — No Cards', function() {
    setupGame();
    global.window.Events.handleComboSubmit();
    assert(true, 'handleComboSubmit with no cards should not throw');
});

// Test 18: handleComboCardToggle
test('Handle Combo Card Toggle', function() {
    global.window.Events.handleComboCardToggle('test-card-1');
    global.window.Events.handleComboCardToggle('test-card-2');
    global.window.Events.handleComboCardToggle('test-card-1'); // Toggle off
    assert(true, 'handleComboCardToggle should not throw');
});

// Test 19: handleThreeKindName does not throw
test('Handle Three Kind Name', function() {
    setupGame();
    global.window.GameState.setState({
        activeModal: 'three-kind-modal',
        modalData: { comboInfo: { comboType: 'three_of_a_kind' }, playerId: 0 }
    });
    global.window.Events.handleThreeKindName();
    assert(true, 'handleThreeKindName should not throw');
});

// Test 20: handleDiscardPick does not throw
test('Handle Discard Pick', function() {
    setupGame();
    global.window.GameState.setState({
        activeModal: 'discard-browser-modal',
        modalData: { playerId: 0 }
    });
    global.window.Events.handleDiscardPick('test-card');
    assert(true, 'handleDiscardPick should not throw');
});

// Test 21: handlePlayAgain does not throw
test('Handle Play Again', function() {
    // Mock GameApp if not available
    if (!global.window.GameApp) {
        global.window.GameApp = { resetToSetupScreen: function() {} };
    }
    global.window.Events.handlePlayAgain();
    assert(true, 'handlePlayAgain should not throw');
});

// Test 22: handleCardClick during nope window does nothing
test('Handle Card Click — During Nope Window', function() {
    setupGame();
    global.window.GameState.setState({ nopeWindowActive: true });
    global.window.Events.handleCardClick('s0');
    var state = global.window.GameState.getState();
    assertEqual(state.discardPile.length, 0, 'Should not play card during nope window');
});

// Test 23: handleCardClick during modal does nothing
test('Handle Card Click — During Modal', function() {
    setupGame();
    global.window.GameState.setState({ activeModal: 'peek-modal' });
    global.window.Events.handleCardClick('s0');
    var state = global.window.GameState.getState();
    assertEqual(state.discardPile.length, 0, 'Should not play card during modal');
});

// Test 24: handleCardClick for AI player does nothing
test('Handle Card Click — AI Player', function() {
    setupGame();
    global.window.GameState.setState({ currentPlayerIndex: 1 }); // Bob (AI)
    global.window.Events.handleCardClick('n1');
    var state = global.window.GameState.getState();
    assertEqual(state.discardPile.length, 0, 'Should not play card for AI player');
});

// Test 25: handleCardClick for dead player does nothing
test('Handle Card Click — Dead Player', function() {
    setupGame();
    global.window.Player.killPlayer(0);
    global.window.Events.handleCardClick('s0');
    var state = global.window.GameState.getState();
    assertEqual(state.discardPile.length, 0, 'Should not play card for dead player');
});

// Test 26: handleFavorGive with missing data
test('Handle Favor Give — Missing Data', function() {
    setupGame();
    global.window.GameState.setState({ activeModal: 'favor-give-modal', modalData: {} });
    global.window.Events.handleFavorGive('n1');
    assert(true, 'handleFavorGive with missing data should not throw');
});

// Test 27: handleDefusePlace with missing data
test('Handle Defuse Place — Missing Data', function() {
    setupGame();
    global.window.GameState.setState({ activeModal: 'defuse-modal', modalData: {} });
    global.window.Events.handleDefusePlace();
    assert(true, 'handleDefusePlace with missing data should not throw');
});

// Test 28: handleThreeKindName with missing data
test('Handle Three Kind Name — Missing Data', function() {
    setupGame();
    global.window.GameState.setState({ activeModal: 'three-kind-modal', modalData: {} });
    global.window.Events.handleThreeKindName();
    assert(true, 'handleThreeKindName with missing data should not throw');
});

// Test 29: init can be called multiple times safely
test('Init — Multiple Calls', function() {
    global.window.Events.init();
    global.window.Events.init();
    assert(true, 'Multiple init calls should not throw');
});

// Test 30: handleDrawClick during nope window
test('Handle Draw Click — Nope Window', function() {
    setupGame();
    global.window.GameState.setState({ nopeWindowActive: true });
    global.window.Events.handleDrawClick();
    assert(true, 'handleDrawClick during nope window should not throw');
});

// ========== RESULTS ==========

console.log('\n========================================');
console.log('TEST RESULTS: ' + passCount + '/' + testCount + ' passed, ' + failCount + ' failed');
console.log('========================================');

if (failCount > 0) {
    console.log('\nFailed tests:');
    failures.forEach(function(f) { console.log('  - ' + f); });
    process.exit(1);
} else {
    console.log('\n✅ ALL ' + testCount + ' TESTS PASSED!');
}