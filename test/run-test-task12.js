/**
 * Task 12: Polish + Edge Case Tests
 * 
 * Tests for edge cases and bug fixes across all modules.
 * 
 * Run: node run-test-task12.js
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

global.window.GameApp = {
    showScreen: function() {}, resetToSetupScreen: function() {},
    openModal: function() {}, closeModal: function() {}, log: function() {}
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

function makeCard(type, instanceId) {
    var def = global.window.CARD_TYPES[type];
    return {
        instanceId: instanceId || (type + '-' + Math.random().toString(36).substr(2, 6)),
        type: type, cornerIcon: def ? def.cornerIcon : null,
        emoji: def ? def.emoji : '🃏', name: def ? def.name : type
    };
}

// ========== TESTS ==========

console.log('========================================');
console.log('Task 12: Polish + Edge Case Tests');
console.log('========================================\n');

// === Edge Case: 2-player game has exactly 1 EK ===
test('Edge: 2-Player 1 EK', function() {
    global.window.GameFlow.initGame({
        playerCount: 2, gameMode: 'ai', aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob']
    });
    var state = global.window.GameState.getState();
    var ekCount = state.drawPile.filter(function(c) { return c.type === 'exploding_kitten'; }).length;
    assertEqual(ekCount, 1, '2-player game should have exactly 1 EK');
});

// === Edge Case: 5-player game has exactly 4 EKs ===
test('Edge: 5-Player 4 EKs', function() {
    global.window.GameFlow.initGame({
        playerCount: 5, gameMode: 'ai', aiDifficulty: 'medium',
        playerNames: ['A', 'B', 'C', 'D', 'E']
    });
    var state = global.window.GameState.getState();
    var ekCount = state.drawPile.filter(function(c) { return c.type === 'exploding_kitten'; }).length;
    assertEqual(ekCount, 4, '5-player game should have exactly 4 EKs');
});

// === Edge Case: Each player gets exactly 1 Defuse ===
test('Edge: One Defuse Per Player', function() {
    global.window.GameFlow.initGame({
        playerCount: 4, gameMode: 'ai', aiDifficulty: 'medium',
        playerNames: ['A', 'B', 'C', 'D']
    });
    var state = global.window.GameState.getState();
    state.players.forEach(function(player) {
        var defuseCount = player.hand.filter(function(c) { return c.type === 'defuse'; }).length;
        assertEqual(defuseCount, 1, player.name + ' should have exactly 1 Defuse');
    });
});

// === Edge Case: Total cards correct (56 - unused EKs) ===
test('Edge: Total Cards Correct', function() {
    global.window.GameFlow.initGame({
        playerCount: 3, gameMode: 'ai', aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob', 'Carol']
    });
    var state = global.window.GameState.getState();
    var totalCards = state.drawPile.length;
    state.players.forEach(function(p) { totalCards += p.hand.length; });
    totalCards += state.discardPile.length;
    // 3-player game uses 2 EKs (not 4), so total = 56 - 2 = 54
    assertEqual(totalCards, 54, 'Total cards should be 54 (56 - 2 unused EKs for 3 players)');
});

// === Edge Case: Empty hand draw ===
test('Edge: Empty Hand Draw', function() {
    global.window.GameFlow.initGame({
        playerCount: 2, gameMode: 'ai', aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob']
    });
    // Clear player 0's hand
    var state = global.window.GameState.getState();
    state.players[0].hand.forEach(function(c) {
        global.window.Player.removeCardFromHand(0, c.instanceId);
    });
    assertEqual(global.window.Player.getHandSize(0), 0, 'Player should have empty hand');
    // Make sure it's player 0's turn and draw phase
    global.window.GameState.setState({ currentPlayerIndex: 0, turnPhase: 'draw' });
    global.window.TurnEngine.startTurn(0);
    // Drawing should still work
    var result = global.window.TurnEngine.drawCard(0);
    assert(result.success !== false, 'Draw with empty hand should not fail');
});

// === Edge Case: Nope chain 1 (cancelled) ===
test('Edge: Nope Chain 1 — Cancelled', function() {
    global.window.GameState.reset();
    var players = [
        global.window.Player.createPlayer(0, 'Alice', false),
        global.window.Player.createPlayer(1, 'Bob', false)
    ];
    global.window.GameState.setState({ players: players, currentPlayerIndex: 0, gamePhase: 'play', gameStatus: 'active', drawPile: [], discardPile: [], turnPhase: 'draw' });
    global.window.Player.addCardToHand(1, makeCard('nope', 'n1'));

    var resolverCalled = false;
    global.window.Nope.openNopeWindow({
        type: 'play-card', cardType: 'attack', playerId: 0,
        description: 'Alice plays Attack', resolver: function() { resolverCalled = true; }
    });
    global.window.Nope.playNope(1);
    assert(global.window.Nope.isActionNoped(), 'Action should be noped with 1 nope');
    global.window.Nope.closeNopeWindow();

    assertEqual(resolverCalled, false, 'Resolver should NOT be called with 1 nope (cancelled)');
});

// === Edge Case: Nope chain 2 (proceeds) ===
test('Edge: Nope Chain 2 — Proceeds', function() {
    global.window.GameState.reset();
    var players = [
        global.window.Player.createPlayer(0, 'Alice', false),
        global.window.Player.createPlayer(1, 'Bob', false)
    ];
    global.window.GameState.setState({ players: players, currentPlayerIndex: 0, gamePhase: 'play', gameStatus: 'active', drawPile: [], discardPile: [], turnPhase: 'draw' });
    global.window.Player.addCardToHand(0, makeCard('nope', 'n0'));
    global.window.Player.addCardToHand(1, makeCard('nope', 'n1'));

    var resolverCalled = false;
    global.window.Nope.openNopeWindow({
        type: 'play-card', cardType: 'attack', playerId: 0,
        description: 'Alice plays Attack', resolver: function() { resolverCalled = true; }
    });
    global.window.Nope.playNope(1);
    global.window.Nope.playNope(0);
    global.window.Nope.closeNopeWindow();

    assertEqual(resolverCalled, true, 'Resolver should be called with 2 nopes (proceeds)');
    assert(!global.window.Nope.isActionNoped(), 'Action should NOT be noped');
});

// === Edge Case: Nope chain 3 (cancelled) ===
test('Edge: Nope Chain 3 — Cancelled', function() {
    global.window.GameState.reset();
    var players = [
        global.window.Player.createPlayer(0, 'Alice', false),
        global.window.Player.createPlayer(1, 'Bob', false),
        global.window.Player.createPlayer(2, 'Carol', false)
    ];
    global.window.GameState.setState({ players: players, currentPlayerIndex: 0, gamePhase: 'play', gameStatus: 'active', drawPile: [], discardPile: [], turnPhase: 'draw' });
    global.window.Player.addCardToHand(1, makeCard('nope', 'n1'));
    global.window.Player.addCardToHand(0, makeCard('nope', 'n0'));
    global.window.Player.addCardToHand(2, makeCard('nope', 'n2'));

    var resolverCalled = false;
    global.window.Nope.openNopeWindow({
        type: 'play-card', cardType: 'attack', playerId: 0,
        description: 'Alice plays Attack', resolver: function() { resolverCalled = true; }
    });
    global.window.Nope.playNope(1);
    global.window.Nope.playNope(0);
    global.window.Nope.playNope(2);
    global.window.Nope.closeNopeWindow();

    assertEqual(resolverCalled, false, 'Resolver should NOT be called with 3 nopes (cancelled)');
});

// === Edge Case: 0 nopes (proceeds) ===
test('Edge: 0 Nopes — Proceeds', function() {
    global.window.GameState.reset();
    var players = [
        global.window.Player.createPlayer(0, 'Alice', false),
        global.window.Player.createPlayer(1, 'Bob', false)
    ];
    global.window.GameState.setState({ players: players, currentPlayerIndex: 0, gamePhase: 'play', gameStatus: 'active', drawPile: [], discardPile: [], turnPhase: 'draw' });

    var resolverCalled = false;
    global.window.Nope.openNopeWindow({
        type: 'play-card', cardType: 'attack', playerId: 0,
        description: 'Alice plays Attack', resolver: function() { resolverCalled = true; }
    });
    global.window.Nope.closeNopeWindow();

    assertEqual(resolverCalled, true, 'Resolver should be called with 0 nopes (proceeds)');
});

// === Edge Case: Win check after every death ===
test('Edge: Win Check After Death', function() {
    global.window.GameFlow.initGame({
        playerCount: 3, gameMode: 'ai', aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob', 'Carol']
    });
    global.window.Player.killPlayer(1);
    global.window.GameFlow.handlePlayerDeath(1);
    assertEqual(global.window.GameState.getState().gamePhase, 'play', 'Game should continue with 2 alive');

    global.window.Player.killPlayer(2);
    global.window.GameFlow.handlePlayerDeath(2);
    assertEqual(global.window.GameState.getState().gamePhase, 'game-over', 'Game should end with 1 alive');
});

// === Edge Case: Dead player skipped in turn order ===
test('Edge: Dead Player Skipped', function() {
    global.window.GameFlow.initGame({
        playerCount: 3, gameMode: 'ai', aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob', 'Carol']
    });
    global.window.GameState.setState({ currentPlayerIndex: 0 });
    global.window.Player.killPlayer(1);
    var next = global.window.Player.getNextAlivePlayerIndex();
    assertEqual(next, 2, 'Next alive after 0 should be 2 (skipping dead 1)');
});

// === Edge Case: All players dead ===
test('Edge: All Players Dead', function() {
    global.window.GameFlow.initGame({
        playerCount: 2, gameMode: 'ai', aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob']
    });
    global.window.Player.killPlayer(0);
    global.window.Player.killPlayer(1);
    var alive = global.window.Player.getAlivePlayers();
    assertEqual(alive.length, 0, 'No alive players');
    var result = global.window.GameFlow.checkWinCondition();
    assertEqual(result, true, 'Win condition should be met with 0 alive');
});

// === Edge Case: Defuse placement at position 0 (top) ===
test('Edge: Defuse Position 0', function() {
    global.window.GameState.reset();
    var players = [global.window.Player.createPlayer(0, 'Alice', false)];
    global.window.GameState.setState({ players: players, currentPlayerIndex: 0, gamePhase: 'play', gameStatus: 'active', drawPile: [makeCard('skip', 's1'), makeCard('attack', 'a1')], discardPile: [], turnPhase: 'defuse-placement' });
    var ek = makeCard('exploding_kitten', 'ek1');
    global.window.TurnEngine.placeExplodingKitten(ek, 0);
    var state = global.window.GameState.getState();
    assertEqual(state.drawPile[0].type, 'exploding_kitten', 'EK should be at top (position 0)');
});

// === Edge Case: Defuse placement at end (bottom) ===
test('Edge: Defuse Position End', function() {
    global.window.GameState.reset();
    var players = [global.window.Player.createPlayer(0, 'Alice', false)];
    global.window.GameState.setState({ players: players, currentPlayerIndex: 0, gamePhase: 'play', gameStatus: 'active', drawPile: [makeCard('skip', 's1'), makeCard('attack', 'a1')], discardPile: [], turnPhase: 'defuse-placement' });
    var ek = makeCard('exploding_kitten', 'ek1');
    global.window.TurnEngine.placeExplodingKitten(ek, 2);
    var state = global.window.GameState.getState();
    assertEqual(state.drawPile[2].type, 'exploding_kitten', 'EK should be at bottom (position 2)');
});

// === Edge Case: AI defuse position valid range ===
test('Edge: AI Defuse Position Range', function() {
    global.window.AI.setDifficulty('medium');
    for (var i = 0; i < 20; i++) {
        var pos = global.window.AI.aiChooseDefusePosition(15);
        assert(pos >= 0 && pos <= 15, 'AI defuse position should be 0-15 (got ' + pos + ')');
    }
});

// === Edge Case: AI favor card with only defuse ===
test('Edge: AI Favor Only Defuse', function() {
    global.window.GameState.reset();
    var players = [global.window.Player.createPlayer(0, 'Alice', false), global.window.Player.createPlayer(1, 'Bob', true)];
    global.window.GameState.setState({ players: players, currentPlayerIndex: 1, gamePhase: 'play', gameStatus: 'active', drawPile: [], discardPile: [], turnPhase: 'draw' });
    global.window.Player.addCardToHand(1, makeCard('defuse', 'd1'));
    var cardId = global.window.AI.aiChooseFavorCard(1);
    assertEqual(cardId, 'd1', 'AI should give defuse if only card');
});

// === Edge Case: AI nope without nope card ===
test('Edge: AI Nope Without Card', function() {
    global.window.GameState.reset();
    var players = [global.window.Player.createPlayer(0, 'Alice', false), global.window.Player.createPlayer(1, 'Bob', true)];
    global.window.GameState.setState({ players: players, currentPlayerIndex: 0, gamePhase: 'play', gameStatus: 'active', drawPile: [], discardPile: [], turnPhase: 'draw' });
    // Bob has no nope card
    var decision = global.window.AI.getAINopeDecision(1, { type: 'play-card', cardType: 'attack', playerId: 0 });
    assertEqual(decision, false, 'AI should not nope without nope card');
});

// === Edge Case: Combo with insufficient cards ===
test('Edge: Combo Insufficient Cards', function() {
    var oneCard = [makeCard('tacocat', 'tc1')];
    var result = global.window.Combo.detectCombo(oneCard);
    assertEqual(result, null, 'Single card should not form combo');
});

// === Edge Case: Five Different with empty discard ===
test('Edge: Five Different Empty Discard', function() {
    global.window.GameState.reset();
    var players = [global.window.Player.createPlayer(0, 'Alice', false)];
    global.window.GameState.setState({ players: players, currentPlayerIndex: 0, gamePhase: 'play', gameStatus: 'active', drawPile: [], discardPile: [], turnPhase: 'draw' });
    var cards = [
        makeCard('tacocat', 'tc1'), makeCard('cattermelon', 'cm1'),
        makeCard('hairy_potato_cat', 'hpc1'), makeCard('beard_cat', 'bc1'),
        makeCard('rainbow_cat', 'rc1')
    ];
    var comboInfo = global.window.Combo.detectCombo(cards);
    assert(comboInfo !== null, 'Five Different should be detected');
    var result = global.window.Combo.resolveCombo(comboInfo, 0);
    assertEqual(result.success, true, 'Five Different should succeed even with empty discard');
    assertEqual(result.pickedCard, null, 'Should pick null card from empty discard');
});

// === Edge Case: Card rendering with all types ===
test('Edge: All Card Types Render', function() {
    var types = Object.keys(global.window.CARD_TYPES);
    types.forEach(function(type) {
        var card = makeCard(type, type + '-test');
        var el = global.window.UIRenderer.renderCard(card);
        assert(el !== null, type + ' should render without error');
    });
});

// === Edge Case: Game restart clears all state ===
test('Edge: Restart Clears State', function() {
    global.window.GameFlow.initGame({
        playerCount: 3, gameMode: 'hotseat', aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob', 'Carol']
    });
    // Add some state
    global.window.Nope.openNopeWindow({
        type: 'test', cardType: 'skip', playerId: 0,
        description: 'test', resolver: function() {}
    });
    global.window.GameFlow.restartGame();
    var state = global.window.GameState.getState();
    assertEqual(state.gamePhase, 'setup', 'Phase should be setup after restart');
    assertEqual(state.nopeWindowActive, false, 'Nope window should be cleared');
    assertEqual(global.window.HotSeat.isHotSeatMode(), false, 'Hot-seat should be cleared');
});

// === Edge Case: Multiple initGame calls ===
test('Edge: Multiple InitGame Calls', function() {
    global.window.GameFlow.initGame({
        playerCount: 2, gameMode: 'ai', aiDifficulty: 'medium',
        playerNames: ['A', 'B']
    });
    var state1 = global.window.GameState.getState();
    var firstDeckSize = state1.drawPile.length;

    global.window.GameFlow.initGame({
        playerCount: 4, gameMode: 'ai', aiDifficulty: 'hard',
        playerNames: ['A', 'B', 'C', 'D']
    });
    var state2 = global.window.GameState.getState();
    assertEqual(state2.players.length, 4, 'Should have 4 players after reinit');
    assertEqual(global.window.AI.getDifficulty(), 'hard', 'Difficulty should be hard');
});

// === Edge Case: Player names with special characters ===
test('Edge: Special Character Names', function() {
    global.window.GameFlow.initGame({
        playerCount: 2, gameMode: 'ai', aiDifficulty: 'medium',
        playerNames: ["Alice!@#", "Bob$%^"]
    });
    var state = global.window.GameState.getState();
    assertEqual(state.players[0].name, "Alice!@#", 'Should preserve special characters');
});

// === Edge Case: Empty player names uses defaults ===
test('Edge: Empty Names Use Defaults', function() {
    global.window.GameFlow.initGame({
        playerCount: 3, gameMode: 'ai', aiDifficulty: 'medium',
        playerNames: ['', '', '']
    });
    var state = global.window.GameState.getState();
    assert(state.players[0].name.length > 0, 'Player 1 should have default name');
    assert(state.players[1].name.length > 0, 'Player 2 should have default name');
    assert(state.players[2].name.length > 0, 'Player 3 should have default name');
});

// === Edge Case: Hot-seat all human ===
test('Edge: Hot-Seat All Human', function() {
    global.window.GameFlow.initGame({
        playerCount: 3, gameMode: 'hotseat', aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob', 'Carol']
    });
    var state = global.window.GameState.getState();
    state.players.forEach(function(p) {
        assertEqual(p.isAI, false, p.name + ' should be human in hot-seat');
        assertEqual(p.isHuman, true, p.name + ' should have isHuman=true');
    });
});

// === Edge Case: AI mode first player human ===
test('Edge: AI Mode First Human', function() {
    global.window.GameFlow.initGame({
        playerCount: 3, gameMode: 'ai', aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob', 'Carol']
    });
    var state = global.window.GameState.getState();
    assertEqual(state.players[0].isHuman, true, 'First player should be human in AI mode');
    assertEqual(state.players[1].isHuman, false, 'Second player should not be human in AI mode');
});

// === Edge Case: Deck has correct composition ===
test('Edge: Deck Composition', function() {
    var deck = global.window.createDeck(2);
    var counts = {};
    deck.forEach(function(c) { counts[c.type] = (counts[c.type] || 0) + 1; });

    assertEqual(counts.exploding_kitten, 4, 'Should have 4 EKs in base deck');
    assertEqual(counts.defuse, 6, 'Should have 6 Defuses in base deck');
    assertEqual(counts.attack, 4, 'Should have 4 Attacks');
    assertEqual(counts.skip, 4, 'Should have 4 Skips');
    assertEqual(counts.favor, 4, 'Should have 4 Favors');
    assertEqual(counts.shuffle, 4, 'Should have 4 Shuffles');
    assertEqual(counts.see_the_future, 5, 'Should have 5 See the Futures');
    assertEqual(counts.nope, 5, 'Should have 5 Nopes');
    assertEqual(deck.length, 56, 'Total deck should be 56 cards');
});

// === Edge Case: Shuffle preserves card count ===
test('Edge: Shuffle Preserves Count', function() {
    var deck = global.window.createDeck(3);
    var shuffled = global.window.shuffle(deck);
    assertEqual(shuffled.length, deck.length, 'Shuffle should preserve card count');
});

// === Edge Case: Remove all EKs from deck ===
test('Edge: Remove All EKs', function() {
    var deck = global.window.createDeck(2);
    var result = global.window.removeExplodingKittens(deck);
    var ekInClean = result.cleanDeck.filter(function(c) { return c.type === 'exploding_kitten'; }).length;
    assertEqual(ekInClean, 0, 'No EKs should remain in clean deck');
    assertEqual(result.removedKittens.length, 4, 'Should remove 4 EKs');
});

// === Edge Case: Remove all Defuses from deck ===
test('Edge: Remove All Defuses', function() {
    var deck = global.window.createDeck(2);
    var result = global.window.removeDefuses(deck);
    var defuseInClean = result.cleanDeck.filter(function(c) { return c.type === 'defuse'; }).length;
    assertEqual(defuseInClean, 0, 'No Defuses should remain in clean deck');
    assertEqual(result.removedDefuses.length, 6, 'Should remove 6 Defuses');
});

// === Edge Case: Insert EKs back ===
test('Edge: Insert EKs', function() {
    var deck = [];
    var result = global.window.insertExplodingKittens(deck, 3);
    var ekCount = result.filter(function(c) { return c.type === 'exploding_kitten'; }).length;
    assertEqual(ekCount, 3, 'Should have 3 EKs after insertion');
});

// === Edge Case: Insert Defuses back ===
test('Edge: Insert Defuses', function() {
    var deck = [];
    var result = global.window.insertDefuses(deck, 2);
    var defuseCount = result.filter(function(c) { return c.type === 'defuse'; }).length;
    assertEqual(defuseCount, 2, 'Should have 2 Defuses after insertion');
});

// === Edge Case: AI decision for dead player ===
test('Edge: AI Decision Dead Player', function() {
    global.window.GameState.reset();
    var players = [global.window.Player.createPlayer(0, 'Alice', false), global.window.Player.createPlayer(1, 'Bob', true)];
    global.window.GameState.setState({ players: players, currentPlayerIndex: 1, gamePhase: 'play', gameStatus: 'active', drawPile: [], discardPile: [], turnPhase: 'draw' });
    global.window.Player.killPlayer(1);
    var decision = global.window.AI.getAIDecision(1);
    assertEqual(decision.action, 'draw', 'Dead AI should default to draw');
});

// === Edge Case: AI nope for own action ===
test('Edge: AI Nope Own Action', function() {
    global.window.GameState.reset();
    var players = [global.window.Player.createPlayer(0, 'Alice', false), global.window.Player.createPlayer(1, 'Bob', true)];
    global.window.GameState.setState({ players: players, currentPlayerIndex: 1, gamePhase: 'play', gameStatus: 'active', drawPile: [], discardPile: [], turnPhase: 'draw' });
    global.window.Player.addCardToHand(1, makeCard('nope', 'n1'));
    var decision = global.window.AI.getAINopeDecision(1, { type: 'play-card', cardType: 'attack', playerId: 1 });
    assertEqual(decision, false, 'AI should not nope own action');
});

// === Edge Case: UI render with no players ===
test('Edge: UI Render No Players', function() {
    global.window.GameState.reset();
    global.window.UIRenderer.render(global.window.GameState.getState());
    assert(true, 'UI render with no players should not throw');
});

// === Edge Case: Events handleCardClick with no game ===
test('Edge: Events No Game', function() {
    global.window.GameState.reset();
    global.window.Events.handleCardClick('nonexistent');
    assert(true, 'handleCardClick with no game should not throw');
});

// === Edge Case: Events handleDrawClick with no game ===
test('Edge: Events Draw No Game', function() {
    global.window.GameState.reset();
    global.window.Events.handleDrawClick();
    assert(true, 'handleDrawClick with no game should not throw');
});

// === Edge Case: HotSeat reset clears all ===
test('Edge: HotSeat Reset', function() {
    global.window.HotSeat.setHotSeatMode(true);
    global.window.HotSeat.showPassScreen('Test');
    global.window.HotSeat.reset();
    assertEqual(global.window.HotSeat.isHotSeatMode(), false, 'Hot-seat mode should be false');
    assertEqual(global.window.HotSeat.isPassScreenActive(), false, 'Pass screen should be inactive');
});

// === Edge Case: Game state summary ===
test('Edge: Game State Summary', function() {
    global.window.GameFlow.initGame({
        playerCount: 2, gameMode: 'ai', aiDifficulty: 'medium',
        playerNames: ['Alice', 'Bob']
    });
    var summary = global.window.GameState.getStateSummary();
    assert(typeof summary === 'object', 'State summary should be an object');
    assertEqual(summary.playerCount, 2, 'Summary should show 2 players');
    assert(summary.drawPileSize > 0, 'Summary should show non-empty draw pile');
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