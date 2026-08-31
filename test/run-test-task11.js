/**
 * Task 11: Game Flow Controller Tests
 * 
 * Tests for Module 13 — GameFlow
 * 
 * Run: node run-test-task11.js
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
        id: id, _classList: classListObj, classList: classListObj,
        dataset: {}, children: [], childNodes: [], _innerHTML: '', _textContent: '',
        style: {}, attributes: {}, disabled: false, value: '', type: '', min: '', max: '',
        parentNode: null, scrollTop: 0, scrollHeight: 0, tagName: 'DIV',
        setAttribute: function(k, v) { this.attributes[k] = v; },
        getAttribute: function(k) { return this.attributes[k] || null; },
        appendChild: function(child) { this.children.push(child); child.parentNode = this; return child; },
        removeChild: function(child) { this.children = this.children.filter(c => c !== child); },
        addEventListener: function() {}, removeEventListener: function() {},
        querySelectorAll: function() { return []; }, querySelector: function() { return null; },
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
    querySelector: function() { return null; }, querySelectorAll: function() { return []; },
    addEventListener: function() {}, body: { appendChild: function(){} }, readyState: 'complete'
};
global.window.document = global.document;

// Load all modules
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
require('../js/modules/13-flow.js');

// Mock GameApp
global.window.GameApp = {
    showScreen: function() {},
    resetToSetupScreen: function() {},
    openModal: function() {},
    closeModal: function() {},
    log: function() {}
};

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

// ========== TESTS ==========

console.log('========================================');
console.log('Task 11: Game Flow Controller Tests');
console.log('========================================\n');

// Test 1: Module loads and exposes API
test('Module Loading', function() {
    assert(typeof global.window.GameFlow === 'object', 'GameFlow should be exposed on window');
    assert(typeof global.window.GameFlow.initGame === 'function', 'initGame should be a function');
    assert(typeof global.window.GameFlow.startTurn === 'function', 'startTurn should be a function');
    assert(typeof global.window.GameFlow.handleTurnEnd === 'function', 'handleTurnEnd should be a function');
    assert(typeof global.window.GameFlow.handleAITurn === 'function', 'handleAITurn should be a function');
    assert(typeof global.window.GameFlow.handlePlayerDeath === 'function', 'handlePlayerDeath should be a function');
    assert(typeof global.window.GameFlow.checkWinCondition === 'function', 'checkWinCondition should be a function');
    assert(typeof global.window.GameFlow.endGame === 'function', 'endGame should be a function');
    assert(typeof global.window.GameFlow.restartGame === 'function', 'restartGame should be a function');
    assert(typeof global.window.GameFlow.executeEffect === 'function', 'executeEffect should be a function');
    assert(typeof global.window.GameFlow.handleHotSeatTransition === 'function', 'handleHotSeatTransition should be a function');
});

// Test 2: initGame creates players
test('InitGame — Creates Players', function() {
    global.window.GameFlow.initGame({
        playerCount: 3,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob', 'Carol']
    });
    var state = global.window.GameState.getState();
    assertEqual(state.players.length, 3, 'Should create 3 players');
});

// Test 3: initGame sets first player as human
test('InitGame — First Player Human', function() {
    global.window.GameFlow.initGame({
        playerCount: 3,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob', 'Carol']
    });
    var state = global.window.GameState.getState();
    assertEqual(state.players[0].isHuman, true, 'First player should be human');
    assertEqual(state.players[0].isAI, false, 'First player should not be AI');
});

// Test 4: initGame sets other players as AI
test('InitGame — Other Players AI', function() {
    global.window.GameFlow.initGame({
        playerCount: 3,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob', 'Carol']
    });
    var state = global.window.GameState.getState();
    assertEqual(state.players[1].isAI, true, 'Second player should be AI');
    assertEqual(state.players[2].isAI, true, 'Third player should be AI');
});

// Test 5: initGame deals 4 cards + 1 defuse to each player
test('InitGame — Deals Cards', function() {
    global.window.GameFlow.initGame({
        playerCount: 2,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob']
    });
    var state = global.window.GameState.getState();
    state.players.forEach(function(player) {
        assertEqual(player.hand.length, 5, player.name + ' should have 5 cards (4 + 1 defuse)');
    });
});

// Test 6: initGame creates draw pile with EKs
test('InitGame — Draw Pile Has EKs', function() {
    global.window.GameFlow.initGame({
        playerCount: 3,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob', 'Carol']
    });
    var state = global.window.GameState.getState();
    var ekCount = state.drawPile.filter(function(c) { return c.type === 'exploding_kitten'; }).length;
    assertEqual(ekCount, 2, 'Should have 2 EKs in draw pile (3 players - 1)');
});

// Test 7: initGame 2 players has 1 EK
test('InitGame — 2 Players 1 EK', function() {
    global.window.GameFlow.initGame({
        playerCount: 2,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob']
    });
    var state = global.window.GameState.getState();
    var ekCount = state.drawPile.filter(function(c) { return c.type === 'exploding_kitten'; }).length;
    assertEqual(ekCount, 1, 'Should have 1 EK in draw pile (2 players - 1)');
});

// Test 8: initGame sets game phase to play
test('InitGame — Game Phase Play', function() {
    global.window.GameFlow.initGame({
        playerCount: 2,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob']
    });
    var state = global.window.GameState.getState();
    assertEqual(state.gamePhase, 'play', 'Game phase should be play');
    assertEqual(state.gameStatus, 'active', 'Game status should be active');
});

// Test 9: initGame sets turn phase to draw
test('InitGame — Turn Phase Draw', function() {
    global.window.GameFlow.initGame({
        playerCount: 2,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob']
    });
    var state = global.window.GameState.getState();
    assertEqual(state.turnPhase, 'draw', 'Turn phase should be draw');
});

// Test 10: initGame logs game start
test('InitGame — Logs Game Start', function() {
    global.window.GameFlow.initGame({
        playerCount: 2,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob']
    });
    var state = global.window.GameState.getState();
    assert(state.actionLog.length > 0, 'Action log should have entries');
    assert(state.actionLog[0].description.indexOf('Game started') !== -1, 'First log should be game start');
});

// Test 11: initGame sets AI difficulty
test('InitGame — Sets AI Difficulty', function() {
    global.window.GameFlow.initGame({
        playerCount: 2,
        gameMode: 'ai',
        aiDifficulty: 'hard',
        playerNames: ['Alice', 'Bob']
    });
    assertEqual(global.window.AI.getDifficulty(), 'hard', 'AI difficulty should be hard');
});

// Test 12: initGame hot-seat mode
test('InitGame — Hot-Seat Mode', function() {
    global.window.GameFlow.initGame({
        playerCount: 3,
        gameMode: 'hotseat',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob', 'Carol']
    });
    var state = global.window.GameState.getState();
    // In hot-seat, all players are human
    assertEqual(state.players[1].isAI, false, 'Hot-seat player 2 should not be AI');
    assertEqual(state.players[2].isAI, false, 'Hot-seat player 3 should not be AI');
    assert(global.window.HotSeat.isHotSeatMode(), 'Hot-seat mode should be active');
});

// Test 13: initGame with default names
test('InitGame — Default Names', function() {
    global.window.GameFlow.initGame({
        playerCount: 2,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: []
    });
    var state = global.window.GameState.getState();
    assert(state.players[0].name.length > 0, 'Player 1 should have a default name');
    assert(state.players[1].name.length > 0, 'Player 2 should have a default name');
});

// Test 14: checkWinCondition returns false with multiple alive
test('CheckWinCondition — Multiple Alive', function() {
    global.window.GameFlow.initGame({
        playerCount: 3,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob', 'Carol']
    });
    assertEqual(global.window.GameFlow.checkWinCondition(), false, 'Should not win with 3 alive');
});

// Test 15: checkWinCondition returns true with 1 alive
test('CheckWinCondition — One Alive', function() {
    global.window.GameFlow.initGame({
        playerCount: 3,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob', 'Carol']
    });
    global.window.Player.killPlayer(1);
    global.window.Player.killPlayer(2);
    assertEqual(global.window.GameFlow.checkWinCondition(), true, 'Should win with 1 alive');
});

// Test 16: endGame sets game phase
test('EndGame — Sets Phase', function() {
    global.window.GameFlow.initGame({
        playerCount: 2,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob']
    });
    var winner = global.window.GameState.getState().players[0];
    global.window.GameFlow.endGame(winner);
    var state = global.window.GameState.getState();
    assertEqual(state.gamePhase, 'game-over', 'Game phase should be game-over');
    assertEqual(state.gameStatus, 'completed', 'Game status should be completed');
});

// Test 17: endGame with null winner
test('EndGame — Null Winner', function() {
    global.window.GameFlow.initGame({
        playerCount: 2,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob']
    });
    global.window.GameFlow.endGame(null);
    var state = global.window.GameState.getState();
    assertEqual(state.gamePhase, 'game-over', 'Game phase should be game-over');
});

// Test 18: handlePlayerDeath logs elimination
test('HandlePlayerDeath — Logs', function() {
    global.window.GameFlow.initGame({
        playerCount: 3,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob', 'Carol']
    });
    var logLengthBefore = global.window.GameState.getState().actionLog.length;
    global.window.Player.killPlayer(1);
    global.window.GameFlow.handlePlayerDeath(1);
    var logLengthAfter = global.window.GameState.getState().actionLog.length;
    assert(logLengthAfter > logLengthBefore, 'Action log should grow after death');
});

// Test 19: handlePlayerDeath triggers win condition
test('HandlePlayerDeath — Win Check', function() {
    global.window.GameFlow.initGame({
        playerCount: 2,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob']
    });
    global.window.Player.killPlayer(1);
    global.window.GameFlow.handlePlayerDeath(1);
    var state = global.window.GameState.getState();
    assertEqual(state.gamePhase, 'game-over', 'Should be game over after last opponent dies');
});

// Test 20: restartGame resets state
test('RestartGame — Resets', function() {
    global.window.GameFlow.initGame({
        playerCount: 3,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob', 'Carol']
    });
    global.window.GameFlow.restartGame();
    var state = global.window.GameState.getState();
    assertEqual(state.gamePhase, 'setup', 'Game phase should be reset to setup');
});

// Test 21: restartGame resets hot-seat
test('RestartGame — Resets HotSeat', function() {
    global.window.GameFlow.initGame({
        playerCount: 2,
        gameMode: 'hotseat',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob']
    });
    global.window.GameFlow.restartGame();
    assertEqual(global.window.HotSeat.isHotSeatMode(), false, 'Hot-seat mode should be reset');
});

// Test 22: initGame creates non-empty draw pile
test('InitGame — Non-Empty Draw Pile', function() {
    global.window.GameFlow.initGame({
        playerCount: 4,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['A', 'B', 'C', 'D']
    });
    var state = global.window.GameState.getState();
    assert(state.drawPile.length > 0, 'Draw pile should not be empty');
});

// Test 23: initGame 4 players has 3 EKs
test('InitGame — 4 Players 3 EKs', function() {
    global.window.GameFlow.initGame({
        playerCount: 4,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['A', 'B', 'C', 'D']
    });
    var state = global.window.GameState.getState();
    var ekCount = state.drawPile.filter(function(c) { return c.type === 'exploding_kitten'; }).length;
    assertEqual(ekCount, 3, 'Should have 3 EKs for 4 players');
});

// Test 24: initGame 5 players has 4 EKs
test('InitGame — 5 Players 4 EKs', function() {
    global.window.GameFlow.initGame({
        playerCount: 5,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['A', 'B', 'C', 'D', 'E']
    });
    var state = global.window.GameState.getState();
    var ekCount = state.drawPile.filter(function(c) { return c.type === 'exploding_kitten'; }).length;
    assertEqual(ekCount, 4, 'Should have 4 EKs for 5 players');
});

// Test 25: initGame each player has a defuse
test('InitGame — Each Player Has Defuse', function() {
    global.window.GameFlow.initGame({
        playerCount: 3,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob', 'Carol']
    });
    var state = global.window.GameState.getState();
    state.players.forEach(function(player) {
        var hasDefuse = player.hand.some(function(c) { return c.type === 'defuse'; });
        assert(hasDefuse, player.name + ' should have a Defuse card');
    });
});

// Test 26: executeEffect does not throw
test('ExecuteEffect — No Throw', function() {
    global.window.GameFlow.initGame({
        playerCount: 2,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob']
    });
    global.window.GameFlow.executeEffect({ success: true, effectType: 'skip' }, 0);
    assert(true, 'executeEffect should not throw');
});

// Test 27: executeEffect with failed result
test('ExecuteEffect — Failed Result', function() {
    global.window.GameFlow.initGame({
        playerCount: 2,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob']
    });
    global.window.GameFlow.executeEffect({ success: false }, 0);
    assert(true, 'executeEffect with failed result should not throw');
});

// Test 28: handleHotSeatTransition does not throw
test('HandleHotSeatTransition', function() {
    global.window.GameFlow.initGame({
        playerCount: 2,
        gameMode: 'hotseat',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob']
    });
    global.window.GameFlow.handleHotSeatTransition(0);
    assert(true, 'handleHotSeatTransition should not throw');
});

// Test 29: initGame with 5 players
test('InitGame — 5 Players', function() {
    global.window.GameFlow.initGame({
        playerCount: 5,
        gameMode: 'ai',
        aiDifficulty: 'easy',
        playerNames: ['A', 'B', 'C', 'D', 'E']
    });
    var state = global.window.GameState.getState();
    assertEqual(state.players.length, 5, 'Should create 5 players');
    state.players.forEach(function(player) {
        assertEqual(player.hand.length, 5, player.name + ' should have 5 cards');
    });
});

// Test 30: initGame sets current player index
test('InitGame — Current Player Index', function() {
    global.window.GameFlow.initGame({
        playerCount: 3,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob', 'Carol']
    });
    var state = global.window.GameState.getState();
    assert(state.currentPlayerIndex >= 0 && state.currentPlayerIndex < 3, 'Current player index should be valid');
});

// Test 31: initGame clears discard pile
test('InitGame — Empty Discard', function() {
    global.window.GameFlow.initGame({
        playerCount: 2,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob']
    });
    var state = global.window.GameState.getState();
    assertEqual(state.discardPile.length, 0, 'Discard pile should be empty');
});

// Test 32: initGame clears active modal
test('InitGame — No Active Modal', function() {
    global.window.GameFlow.initGame({
        playerCount: 2,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob']
    });
    var state = global.window.GameState.getState();
    assertEqual(state.activeModal, null, 'No modal should be active');
});

// Test 33: initGame clears nope window
test('InitGame — Nope Window Inactive', function() {
    global.window.GameFlow.initGame({
        playerCount: 2,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob']
    });
    var state = global.window.GameState.getState();
    assertEqual(state.nopeWindowActive, false, 'Nope window should be inactive');
});

// Test 34: initGame sets player names correctly
test('InitGame — Player Names', function() {
    global.window.GameFlow.initGame({
        playerCount: 3,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob', 'Carol']
    });
    var state = global.window.GameState.getState();
    assertEqual(state.players[0].name, 'Alice', 'Player 1 name should be Alice');
    assertEqual(state.players[1].name, 'Bob', 'Player 2 name should be Bob');
    assertEqual(state.players[2].name, 'Carol', 'Player 3 name should be Carol');
});

// Test 35: handlePlayerDeath clears AI peek memory
test('HandlePlayerDeath — Clears Peek Memory', function() {
    global.window.GameFlow.initGame({
        playerCount: 3,
        gameMode: 'ai',
        aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob', 'Carol']
    });
    global.window.AI.rememberPeekedCards(1, [{type: 'skip'}, {type: 'attack'}, {type: 'defuse'}]);
    global.window.Player.killPlayer(1);
    global.window.GameFlow.handlePlayerDeath(1);
    assertEqual(global.window.AI.getPeekMemory(1), null, 'Peek memory should be cleared for dead player');
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