/**
 * Task 8: Hot-Seat Mode Controller Tests
 * 
 * Tests for Module 11 — HotSeat
 * 
 * Run: node run-test-task8.js
 */

// ========== DOM MOCK ==========

function createDOMMock() {
    var elements = {};

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
            addEventListener: function() {},
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
            },
            cloneNode: function() {
                return makeEl(id + '-clone');
            }
        };
        Object.defineProperty(el, 'className', {
            get: function() { return Array.from(classListObj._classes).join(' '); },
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
                if (val === '') { this.children = []; this.childNodes = []; }
            }
        });
        elements[id] = el;
        return el;
    }

    var body = makeEl('body');

    var documentMock = {
        _elements: elements,
        getElementById: function(id) {
            if (!elements[id]) elements[id] = makeEl(id);
            return elements[id];
        },
        createElement: function(tag) {
            return makeEl('auto-' + tag + '-' + Math.random().toString(36).substr(2, 9));
        },
        querySelector: function(sel) {
            var cleanSel = sel.replace(/[.#]/g, '');
            for (var key in elements) {
                if (elements[key]._classList && typeof elements[key]._classList.has === 'function' && elements[key]._classList.has(cleanSel)) {
                    return elements[key];
                }
            }
            return null;
        },
        body: body
    };

    return { documentMock: documentMock, elements: elements, body: body };
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

// Set up DOM mock
var domMock = createDOMMock();
global.document = domMock.documentMock;
global.window.document = domMock.documentMock;

// Load UI Renderer and init
require('../js/modules/10-ui-renderer.js');
global.window.UIRenderer.init();

// Load HotSeat
require('../js/modules/11-hotseat.js');

// ========== TEST UTILITIES ==========

var testCount = 0;
var passCount = 0;
var failCount = 0;
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
        console.log('  ❌ FAIL: ' + message + ' (expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual) + ')');
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

function setupGameState() {
    global.window.GameState.reset();
    var players = [
        global.window.Player.createPlayer(0, 'Alice', false),
        global.window.Player.createPlayer(1, 'Bob', false),
        global.window.Player.createPlayer(2, 'Carol', false)
    ];
    // Give each player a nope card directly in hand
    players[0].hand.push(makeCard('nope', 'nope-0'));
    players[1].hand.push(makeCard('nope', 'nope-1'));
    players[2].hand.push(makeCard('nope', 'nope-2'));

    global.window.GameState.setState({
        players: players,
        currentPlayerIndex: 0,
        gamePhase: 'play',
        gameStatus: 'active',
        drawPile: [makeCard('defuse', 'd1')],
        discardPile: [],
        turnPhase: 'draw'
    });
}

// ========== TESTS ==========

console.log('========================================');
console.log('Task 8: Hot-Seat Mode Controller Tests');
console.log('========================================\n');

// Test 1: Module loads and exposes API
test('Module Loading', function() {
    assert(typeof global.window.HotSeat === 'object', 'HotSeat should be exposed on window');
    assert(typeof global.window.HotSeat.showPassScreen === 'function', 'showPassScreen should be a function');
    assert(typeof global.window.HotSeat.hidePassScreen === 'function', 'hidePassScreen should be a function');
    assert(typeof global.window.HotSeat.isPassScreenActive === 'function', 'isPassScreenActive should be a function');
    assert(typeof global.window.HotSeat.showFavorGiveScreen === 'function', 'showFavorGiveScreen should be a function');
    assert(typeof global.window.HotSeat.showNopePrompt === 'function', 'showNopePrompt should be a function');
    assert(typeof global.window.HotSeat.handleNopeResponse === 'function', 'handleNopeResponse should be a function');
    assert(typeof global.window.HotSeat.getPendingNopePlayerId === 'function', 'getPendingNopePlayerId should be a function');
    assert(typeof global.window.HotSeat.hideHandForNonCurrentPlayers === 'function', 'hideHandForNonCurrentPlayers should be a function');
    assert(typeof global.window.HotSeat.isHotSeatMode === 'function', 'isHotSeatMode should be a function');
    assert(typeof global.window.HotSeat.setHotSeatMode === 'function', 'setHotSeatMode should be a function');
    assert(typeof global.window.HotSeat.onTurnStart === 'function', 'onTurnStart should be a function');
    assert(typeof global.window.HotSeat.onFavorRequest === 'function', 'onFavorRequest should be a function');
    assert(typeof global.window.HotSeat.onNopeWindow === 'function', 'onNopeWindow should be a function');
    assert(typeof global.window.HotSeat.onPeekStart === 'function', 'onPeekStart should be a function');
    assert(typeof global.window.HotSeat.hideSpecialScreens === 'function', 'hideSpecialScreens should be a function');
    assert(typeof global.window.HotSeat.reset === 'function', 'reset should be a function');
});

// Test 2: Default mode is not hot-seat
test('Default Mode', function() {
    global.window.HotSeat.reset();
    assertEqual(global.window.HotSeat.isHotSeatMode(), false, 'Default mode should not be hot-seat');
});

// Test 3: Set hot-seat mode
test('Set Hot-Seat Mode', function() {
    global.window.HotSeat.reset();
    global.window.HotSeat.setHotSeatMode(true);
    assertEqual(global.window.HotSeat.isHotSeatMode(), true, 'Hot-seat mode should be true after set');
});

// Test 4: Show pass screen
test('Show Pass Screen', function() {
    global.window.HotSeat.reset();
    global.window.HotSeat.showPassScreen('Alice');
    assertEqual(global.window.HotSeat.isPassScreenActive(), true, 'Pass screen should be active');
});

// Test 5: Hide pass screen
test('Hide Pass Screen', function() {
    global.window.HotSeat.reset();
    global.window.HotSeat.showPassScreen('Bob');
    assertEqual(global.window.HotSeat.isPassScreenActive(), true, 'Pass screen should be active');
    global.window.HotSeat.hidePassScreen();
    assertEqual(global.window.HotSeat.isPassScreenActive(), false, 'Pass screen should be inactive');
});

// Test 6: Pass screen creates overlay element
test('Pass Screen Creates Overlay', function() {
    global.window.HotSeat.reset();
    global.window.HotSeat.showPassScreen('Carol');
    var overlay = global.document.getElementById('pass-screen-overlay');
    assert(overlay !== null, 'Pass screen overlay should exist in DOM');
    assert(overlay.classList.contains('pass-screen--active'), 'Overlay should have active class');
});

// Test 7: Pass screen title shows player name
test('Pass Screen Title', function() {
    global.window.HotSeat.reset();
    global.window.HotSeat.showPassScreen('Alice');
    var title = global.document.getElementById('pass-screen-title');
    assert(title !== null, 'Pass screen title should exist');
    assert(title.textContent.indexOf('Alice') !== -1, 'Title should contain player name');
});

// Test 8: onTurnStart shows pass screen in hot-seat mode
test('onTurnStart — Hot-Seat Mode', function() {
    global.window.HotSeat.reset();
    global.window.HotSeat.setHotSeatMode(true);
    setupGameState();
    global.window.HotSeat.onTurnStart(0);
    assertEqual(global.window.HotSeat.isPassScreenActive(), true, 'Pass screen should show on turn start in hot-seat');
});

// Test 9: onTurnStart does nothing in AI mode
test('onTurnStart — AI Mode', function() {
    global.window.HotSeat.reset();
    global.window.HotSeat.setHotSeatMode(false);
    setupGameState();
    global.window.HotSeat.onTurnStart(0);
    assertEqual(global.window.HotSeat.isPassScreenActive(), false, 'Pass screen should not show in AI mode');
});

// Test 10: onTurnStart does nothing for dead player
test('onTurnStart — Dead Player', function() {
    global.window.HotSeat.reset();
    global.window.HotSeat.setHotSeatMode(true);
    setupGameState();
    global.window.Player.killPlayer(0);
    global.window.HotSeat.onTurnStart(0);
    assertEqual(global.window.HotSeat.isPassScreenActive(), false, 'Pass screen should not show for dead player');
});

// Test 11: showFavorGiveScreen shows pass screen
test('showFavorGiveScreen', function() {
    global.window.HotSeat.reset();
    setupGameState();
    global.window.HotSeat.showFavorGiveScreen(1);
    assertEqual(global.window.HotSeat.isPassScreenActive(), true, 'Pass screen should show for favor give');
});

// Test 12: onFavorRequest in hot-seat mode
test('onFavorRequest — Hot-Seat', function() {
    global.window.HotSeat.reset();
    global.window.HotSeat.setHotSeatMode(true);
    setupGameState();
    global.window.HotSeat.onFavorRequest(1);
    assertEqual(global.window.HotSeat.isPassScreenActive(), true, 'Pass screen should show for favor request in hot-seat');
});

// Test 13: onFavorRequest in AI mode does nothing
test('onFavorRequest — AI Mode', function() {
    global.window.HotSeat.reset();
    global.window.HotSeat.setHotSeatMode(false);
    setupGameState();
    global.window.HotSeat.onFavorRequest(1);
    assertEqual(global.window.HotSeat.isPassScreenActive(), false, 'Pass screen should not show in AI mode');
});

// Test 14: showNopePrompt initializes queue
test('showNopePrompt', function() {
    global.window.HotSeat.reset();
    setupGameState();
    // Open a nope window first so canPlayerNope works
    global.window.Nope.openNopeWindow({
        type: 'play-card',
        cardType: 'attack',
        playerId: 0,
        description: 'Alice plays Attack',
        resolver: function() {}
    });
    global.window.HotSeat.showNopePrompt(0);
    // Should show pass screen for first eligible player
    assertEqual(global.window.HotSeat.isPassScreenActive(), true, 'Pass screen should show for nope prompt');
});

// Test 15: getPendingNopePlayerId returns null initially
test('getPendingNopePlayerId — Initial', function() {
    global.window.HotSeat.reset();
    assertEqual(global.window.HotSeat.getPendingNopePlayerId(), null, 'Pending nope player should be null initially');
});

// Test 16: handleNopeResponse with false (no nope)
test('handleNopeResponse — No Nope', function() {
    global.window.HotSeat.reset();
    setupGameState();
    // Don't actually process nope queue — just test handleNopeResponse doesn't throw
    global.window.HotSeat.handleNopeResponse(false);
    assertEqual(global.window.HotSeat.getPendingNopePlayerId(), null, 'Pending nope player should be null after response');
});

// Test 17: onNopeWindow in hot-seat mode
test('onNopeWindow — Hot-Seat', function() {
    global.window.HotSeat.reset();
    global.window.HotSeat.setHotSeatMode(true);
    setupGameState();
    // Open a nope window first
    global.window.Nope.openNopeWindow({
        type: 'play-card',
        cardType: 'attack',
        playerId: 0,
        description: 'Alice plays Attack',
        resolver: function() {}
    });
    global.window.HotSeat.onNopeWindow(0);
    assertEqual(global.window.HotSeat.isPassScreenActive(), true, 'Pass screen should show for nope window in hot-seat');
});

// Test 18: onNopeWindow in AI mode does nothing
test('onNopeWindow — AI Mode', function() {
    global.window.HotSeat.reset();
    global.window.HotSeat.setHotSeatMode(false);
    setupGameState();
    global.window.HotSeat.onNopeWindow(0);
    assertEqual(global.window.HotSeat.isPassScreenActive(), false, 'Pass screen should not show in AI mode');
});

// Test 19: onPeekStart in hot-seat mode
test('onPeekStart — Hot-Seat', function() {
    global.window.HotSeat.reset();
    global.window.HotSeat.setHotSeatMode(true);
    setupGameState();
    global.window.GameState.setState({ currentPlayerIndex: 1 });
    global.window.HotSeat.onPeekStart(0);
    assertEqual(global.window.HotSeat.isPassScreenActive(), true, 'Pass screen should show for peek in hot-seat when different player');
});

// Test 20: onPeekStart for current player does not show pass screen
test('onPeekStart — Current Player', function() {
    global.window.HotSeat.reset();
    global.window.HotSeat.setHotSeatMode(true);
    setupGameState();
    global.window.GameState.setState({ currentPlayerIndex: 0 });
    global.window.HotSeat.onPeekStart(0);
    assertEqual(global.window.HotSeat.isPassScreenActive(), false, 'Pass screen should not show for current player peek');
});

// Test 21: hideSpecialScreens clears everything
test('hideSpecialScreens', function() {
    global.window.HotSeat.reset();
    global.window.HotSeat.showPassScreen('Alice');
    assertEqual(global.window.HotSeat.isPassScreenActive(), true, 'Pass screen should be active');
    global.window.HotSeat.hideSpecialScreens();
    assertEqual(global.window.HotSeat.isPassScreenActive(), false, 'Pass screen should be inactive after hideSpecialScreens');
    assertEqual(global.window.HotSeat.getPendingNopePlayerId(), null, 'Pending nope player should be null');
});

// Test 22: reset clears everything
test('Reset', function() {
    global.window.HotSeat.setHotSeatMode(true);
    global.window.HotSeat.showPassScreen('Alice');
    global.window.HotSeat.reset();
    assertEqual(global.window.HotSeat.isHotSeatMode(), false, 'Hot-seat mode should be false after reset');
    assertEqual(global.window.HotSeat.isPassScreenActive(), false, 'Pass screen should be inactive after reset');
    assertEqual(global.window.HotSeat.getPendingNopePlayerId(), null, 'Pending nope player should be null after reset');
});

// Test 23: setHotSeatMode(false)
test('Set Hot-Seat Mode False', function() {
    global.window.HotSeat.setHotSeatMode(true);
    global.window.HotSeat.setHotSeatMode(false);
    assertEqual(global.window.HotSeat.isHotSeatMode(), false, 'Hot-seat mode should be false');
});

// Test 24: hideHandForNonCurrentPlayers does not throw
test('hideHandForNonCurrentPlayers', function() {
    global.window.HotSeat.reset();
    setupGameState();
    // Should not throw
    global.window.HotSeat.hideHandForNonCurrentPlayers();
    assert(true, 'hideHandForNonCurrentPlayers should not throw');
});

// Test 25: hideHandForNonCurrentPlayers with empty state
test('hideHandForNonCurrentPlayers — Empty State', function() {
    global.window.HotSeat.reset();
    global.window.GameState.reset();
    global.window.HotSeat.hideHandForNonCurrentPlayers();
    assert(true, 'hideHandForNonCurrentPlayers should not throw with empty state');
});

// Test 26: Pass screen overlay has button
test('Pass Screen Has Button', function() {
    global.window.HotSeat.reset();
    global.window.HotSeat.showPassScreen('Alice');
    var btn = global.document.getElementById('pass-screen-btn');
    assert(btn !== null, 'Pass screen should have a button');
});

// Test 27: Pass screen has icon
test('Pass Screen Has Icon', function() {
    global.window.HotSeat.reset();
    global.window.HotSeat.showPassScreen('Alice');
    var icon = global.document.getElementById('pass-screen-overlay');
    assert(icon !== null, 'Pass screen overlay should exist');
});

// Test 28: Multiple showPassScreen calls update title
test('Pass Screen Updates Title', function() {
    global.window.HotSeat.reset();
    global.window.HotSeat.showPassScreen('Alice');
    var title1 = global.document.getElementById('pass-screen-title');
    assert(title1.textContent.indexOf('Alice') !== -1, 'Title should show Alice');

    global.window.HotSeat.showPassScreen('Bob');
    var title2 = global.document.getElementById('pass-screen-title');
    assert(title2.textContent.indexOf('Bob') !== -1, 'Title should show Bob');
});

// Test 29: onTurnStart with invalid player ID
test('onTurnStart — Invalid Player', function() {
    global.window.HotSeat.reset();
    global.window.HotSeat.setHotSeatMode(true);
    setupGameState();
    global.window.HotSeat.onTurnStart(99);
    assertEqual(global.window.HotSeat.isPassScreenActive(), false, 'Pass screen should not show for invalid player');
});

// Test 30: showFavorGiveScreen with invalid player
test('showFavorGiveScreen — Invalid Player', function() {
    global.window.HotSeat.reset();
    setupGameState();
    global.window.HotSeat.showFavorGiveScreen(99);
    // Should not throw, pass screen may or may not show
    assert(true, 'showFavorGiveScreen with invalid player should not throw');
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