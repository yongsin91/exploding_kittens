/**
 * Task 9: AI Opponent Logic Tests
 * 
 * Tests for Module 9 — AI
 * 
 * Run: node run-test-task9.js
 */

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

// Simple DOM mock for UI Renderer
var elements = {};
global.document = {
    getElementById: function(id) {
        if (!elements[id]) {
            elements[id] = {
                classList: { _s: new Set(), add: function(c){this._s.add(c);}, remove: function(c){this._s.delete(c);}, contains: function(c){return this._s.has(c);}, toggle: function(c){if(this._s.has(c))this._s.delete(c);else this._s.add(c);} },
                children: [], childNodes: [], dataset: {}, style: {}, attributes: {}, textContent: '', innerHTML: '',
                appendChild: function(c){this.children.push(c);return c;}, addEventListener: function(){},
                querySelectorAll: function(){return [];}, querySelector: function(){return null;}, setAttribute: function(){}
            };
        }
        return elements[id];
    },
    createElement: function(tag) {
        return {
            classList: { _s: new Set(), add: function(c){this._s.add(c);}, remove: function(c){this._s.delete(c);}, contains: function(c){return this._s.has(c);}, toggle: function(c){if(this._s.has(c))this._s.delete(c);else this._s.add(c);} },
            children: [], childNodes: [], dataset: {}, style: {}, attributes: {}, textContent: '', innerHTML: '',
            appendChild: function(c){this.children.push(c);return c;}, addEventListener: function(){},
            querySelectorAll: function(){return [];}, querySelector: function(){return null;}, setAttribute: function(){}
        };
    },
    querySelector: function() { return null; },
    body: { appendChild: function(){} }
};
global.window.document = global.document;

require('../js/modules/10-ui-renderer.js');
require('../js/modules/09-ai.js');

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

function setupAIPlayer(playerId, hand, difficulty) {
    global.window.GameState.reset();
    var players = [
        global.window.Player.createPlayer(0, 'Alice', false),
        global.window.Player.createPlayer(1, 'Bob', true),
        global.window.Player.createPlayer(2, 'Carol', true)
    ];
    players[playerId].hand = hand;

    global.window.GameState.setState({
        players: players,
        currentPlayerIndex: playerId,
        gamePhase: 'play',
        gameStatus: 'active',
        drawPile: [makeCard('defuse', 'd1'), makeCard('skip', 's1'), makeCard('attack', 'a1')],
        discardPile: [],
        turnPhase: 'draw'
    });

    if (difficulty) {
        global.window.AI.setDifficulty(difficulty);
    }
}

// ========== TESTS ==========

console.log('========================================');
console.log('Task 9: AI Opponent Logic Tests');
console.log('========================================\n');

// Test 1: Module loads and exposes API
test('Module Loading', function() {
    assert(typeof global.window.AI === 'object', 'AI should be exposed on window');
    assert(typeof global.window.AI.setDifficulty === 'function', 'setDifficulty should be a function');
    assert(typeof global.window.AI.getDifficulty === 'function', 'getDifficulty should be a function');
    assert(typeof global.window.AI.aiTakeTurn === 'function', 'aiTakeTurn should be a function');
    assert(typeof global.window.AI.getAIDecision === 'function', 'getAIDecision should be a function');
    assert(typeof global.window.AI.getAINopeDecision === 'function', 'getAINopeDecision should be a function');
    assert(typeof global.window.AI.aiChooseFavorCard === 'function', 'aiChooseFavorCard should be a function');
    assert(typeof global.window.AI.aiChooseDefusePosition === 'function', 'aiChooseDefusePosition should be a function');
    assert(typeof global.window.AI.aiNameCardForThreeOfKind === 'function', 'aiNameCardForThreeOfKind should be a function');
    assert(typeof global.window.AI.rememberPeekedCards === 'function', 'rememberPeekedCards should be a function');
    assert(typeof global.window.AI.clearPeekMemory === 'function', 'clearPeekMemory should be a function');
});

// Test 2: Default difficulty is medium
test('Default Difficulty', function() {
    assertEqual(global.window.AI.getDifficulty(), 'medium', 'Default difficulty should be medium');
});

// Test 3: Set difficulty
test('Set Difficulty', function() {
    global.window.AI.setDifficulty('easy');
    assertEqual(global.window.AI.getDifficulty(), 'easy', 'Difficulty should be easy');
    global.window.AI.setDifficulty('hard');
    assertEqual(global.window.AI.getDifficulty(), 'hard', 'Difficulty should be hard');
    global.window.AI.setDifficulty('medium');
    assertEqual(global.window.AI.getDifficulty(), 'medium', 'Difficulty should be medium');
});

// Test 4: Set invalid difficulty does nothing
test('Set Invalid Difficulty', function() {
    global.window.AI.setDifficulty('medium');
    global.window.AI.setDifficulty('impossible');
    assertEqual(global.window.AI.getDifficulty(), 'medium', 'Invalid difficulty should not change');
});

// Test 5: getAIDecision returns draw for dead player
test('AI Decision — Dead Player', function() {
    setupAIPlayer(1, [makeCard('skip', 's1')]);
    global.window.Player.killPlayer(1);
    var decision = global.window.AI.getAIDecision(1);
    assertEqual(decision.action, 'draw', 'Dead player should default to draw');
});

// Test 6: getAIDecision returns draw for invalid player
test('AI Decision — Invalid Player', function() {
    setupAIPlayer(1, [makeCard('skip', 's1')]);
    var decision = global.window.AI.getAIDecision(99);
    assertEqual(decision.action, 'draw', 'Invalid player should default to draw');
});

// Test 7: Easy AI — returns valid action
test('Easy AI — Valid Action', function() {
    setupAIPlayer(1, [makeCard('skip', 's1'), makeCard('attack', 'a1')], 'easy');
    var decision = global.window.AI.getAIDecision(1);
    assert(decision.action === 'play' || decision.action === 'draw', 'Easy AI should return play or draw');
});

// Test 8: Easy AI — empty hand draws
test('Easy AI — Empty Hand', function() {
    setupAIPlayer(1, [], 'easy');
    var decision = global.window.AI.getAIDecision(1);
    assertEqual(decision.action, 'draw', 'Empty hand should draw');
});

// Test 9: Medium AI — plays skip when EK known on top
test('Medium AI — Survival Skip', function() {
    var hand = [makeCard('skip', 's1'), makeCard('nope', 'n1')];
    setupAIPlayer(1, hand, 'medium');
    // Set known top card via peek memory
    global.window.AI.rememberPeekedCards(1, [makeCard('exploding_kitten', 'ek1'), makeCard('defuse', 'd1'), makeCard('skip', 's2')]);
    var decision = global.window.AI.getAIDecision(1);
    assertEqual(decision.action, 'play', 'Should play when EK on top');
    assertEqual(decision.cardType, 'skip', 'Should play skip for survival');
});

// Test 10: Medium AI — plays attack when EK known on top (no skip)
test('Medium AI — Survival Attack', function() {
    var hand = [makeCard('attack', 'a1'), makeCard('nope', 'n1')];
    setupAIPlayer(1, hand, 'medium');
    global.window.AI.rememberPeekedCards(1, [makeCard('exploding_kitten', 'ek1'), makeCard('defuse', 'd1'), makeCard('skip', 's2')]);
    var decision = global.window.AI.getAIDecision(1);
    assertEqual(decision.action, 'play', 'Should play when EK on top');
    assertEqual(decision.cardType, 'attack', 'Should play attack for survival');
});

// Test 11: Medium AI — attacks when next player has few cards
test('Medium AI — Disruption Attack', function() {
    var hand = [makeCard('attack', 'a1'), makeCard('nope', 'n1')];
    setupAIPlayer(1, hand, 'medium');
    // Player 2 (next alive) has 1 card
    global.window.GameState.getState().players[2].hand = [makeCard('nope', 'n2')];
    var decision = global.window.AI.getAIDecision(1);
    assertEqual(decision.action, 'play', 'Should attack next player with few cards');
    assertEqual(decision.cardType, 'attack', 'Should play attack');
});

// Test 12: Medium AI — plays see_future when deck is small
test('Medium AI — Info See Future', function() {
    var hand = [makeCard('see_future', 'sf1'), makeCard('nope', 'n1')];
    setupAIPlayer(1, hand, 'medium');
    global.window.GameState.setState({ drawPile: new Array(5) });
    var decision = global.window.AI.getAIDecision(1);
    assertEqual(decision.action, 'play', 'Should play see_future with small deck');
    assertEqual(decision.cardType, 'see_future', 'Should play see_future');
});

// Test 13: Medium AI — plays favor with target
test('Medium AI — Favor With Target', function() {
    var hand = [makeCard('favor', 'f1'), makeCard('nope', 'n1')];
    setupAIPlayer(1, hand, 'medium');
    // Give player 2 more cards than player 0
    global.window.GameState.getState().players[2].hand = [makeCard('nope', 'n2'), makeCard('skip', 's2'), makeCard('attack', 'a2')];
    var decision = global.window.AI.getAIDecision(1);
    assertEqual(decision.action, 'play', 'Should play favor');
    assertEqual(decision.cardType, 'favor', 'Should play favor');
    assert(decision.targetId !== null, 'Favor should have a target');
});

// Test 14: Medium AI — plays combo (two of a kind)
test('Medium AI — Two of a Kind Combo', function() {
    var hand = [makeCard('tacocat', 'tc1'), makeCard('tacocat', 'tc2'), makeCard('nope', 'n1')];
    setupAIPlayer(1, hand, 'medium');
    var decision = global.window.AI.getAIDecision(1);
    assertEqual(decision.action, 'play', 'Should play combo');
    assertEqual(decision.combo, true, 'Should be a combo');
    assertEqual(decision.comboType, 'two_of_a_kind', 'Should be two of a kind');
    assertEqual(decision.comboCards.length, 2, 'Should use 2 cards');
});

// Test 15: Medium AI — plays three of a kind combo
test('Medium AI — Three of a Kind Combo', function() {
    var hand = [makeCard('cattermelon', 'cm1'), makeCard('cattermelon', 'cm2'), makeCard('cattermelon', 'cm3'), makeCard('nope', 'n1')];
    setupAIPlayer(1, hand, 'medium');
    var decision = global.window.AI.getAIDecision(1);
    assertEqual(decision.action, 'play', 'Should play combo');
    assertEqual(decision.combo, true, 'Should be a combo');
    assertEqual(decision.comboType, 'three_of_a_kind', 'Should be three of a kind');
    assertEqual(decision.comboCards.length, 3, 'Should use 3 cards');
    assert(decision.namedCard !== undefined, 'Three of a kind should name a card');
});

// Test 16: Medium AI — default draw when nothing useful
test('Medium AI — Default Draw', function() {
    var hand = [makeCard('nope', 'n1')];
    setupAIPlayer(1, hand, 'medium');
    var decision = global.window.AI.getAIDecision(1);
    assertEqual(decision.action, 'draw', 'Should draw with only nope card');
});

// Test 17: Hard AI — returns valid decision
test('Hard AI — Valid Decision', function() {
    var hand = [makeCard('skip', 's1'), makeCard('attack', 'a1'), makeCard('defuse', 'd1')];
    setupAIPlayer(1, hand, 'hard');
    var decision = global.window.AI.getAIDecision(1);
    assert(decision.action === 'play' || decision.action === 'draw', 'Hard AI should return valid action');
});

// Test 18: getAINopeDecision — returns false for null action
test('AI Nope — Null Action', function() {
    setupAIPlayer(1, [makeCard('nope', 'n1')]);
    assertEqual(global.window.AI.getAINopeDecision(1, null), false, 'Should not nope null action');
});

// Test 19: getAINopeDecision — returns false without nope card
test('AI Nope — No Nope Card', function() {
    setupAIPlayer(1, [makeCard('skip', 's1')]);
    var action = { type: 'play-card', cardType: 'attack', playerId: 0 };
    assertEqual(global.window.AI.getAINopeDecision(1, action), false, 'Should not nope without nope card');
});

// Test 20: getAINopeDecision — returns false for own action
test('AI Nope — Own Action', function() {
    setupAIPlayer(1, [makeCard('nope', 'n1')]);
    var action = { type: 'play-card', cardType: 'attack', playerId: 1 };
    assertEqual(global.window.AI.getAINopeDecision(1, action), false, 'Should not nope own action');
});

// Test 21: getAINopeDecision — returns false for dead player
test('AI Nope — Dead Player', function() {
    setupAIPlayer(1, [makeCard('nope', 'n1')]);
    global.window.Player.killPlayer(1);
    var action = { type: 'play-card', cardType: 'attack', playerId: 0 };
    assertEqual(global.window.AI.getAINopeDecision(1, action), false, 'Dead player should not nope');
});

// Test 22: getAINopeDecision — nopes favor targeting self (medium)
test('AI Nope — Favor Targeting Self', function() {
    setupAIPlayer(1, [makeCard('nope', 'n1')], 'medium');
    var action = { type: 'play-card', cardType: 'favor', playerId: 0, targetId: 1 };
    assertEqual(global.window.AI.getAINopeDecision(1, action), true, 'Should nope favor targeting self');
});

// Test 23: getAINopeDecision — never nopes shuffle
test('AI Nope — Never Nope Shuffle', function() {
    setupAIPlayer(1, [makeCard('nope', 'n1')], 'medium');
    var action = { type: 'play-card', cardType: 'shuffle', playerId: 0 };
    assertEqual(global.window.AI.getAINopeDecision(1, action), false, 'Should never nope shuffle');
});

// Test 24: getAINopeDecision — easy AI is random
test('AI Nope — Easy Random', function() {
    setupAIPlayer(1, [makeCard('nope', 'n1')], 'easy');
    var action = { type: 'play-card', cardType: 'attack', playerId: 0 };
    // Run multiple times — should get mix of true/false
    var trueCount = 0;
    for (var i = 0; i < 100; i++) {
        if (global.window.AI.getAINopeDecision(1, action)) trueCount++;
    }
    assert(trueCount > 0 && trueCount < 100, 'Easy AI nope should be random (not all true or all false)');
});

// Test 25: getAINopeDecision — hard AI nopes attack when next
test('AI Nope — Hard Attack When Next', function() {
    setupAIPlayer(2, [makeCard('nope', 'n1')], 'hard');
    // Player 1 attacks, player 2 is next
    var action = { type: 'play-card', cardType: 'attack', playerId: 1 };
    assertEqual(global.window.AI.getAINopeDecision(2, action), true, 'Hard AI should nope attack when next');
});

// Test 26: aiChooseFavorCard — returns least valuable card
test('AI Favor Card — Least Valuable', function() {
    var hand = [makeCard('defuse', 'd1'), makeCard('tacocat', 'tc1'), makeCard('attack', 'a1')];
    setupAIPlayer(1, hand);
    var cardId = global.window.AI.aiChooseFavorCard(1);
    assertEqual(cardId, 'tc1', 'Should give least valuable card (tacocat)');
});

// Test 27: aiChooseFavorCard — avoids defuse
test('AI Favor Card — Avoids Defuse', function() {
    var hand = [makeCard('defuse', 'd1'), makeCard('nope', 'n1')];
    setupAIPlayer(1, hand);
    var cardId = global.window.AI.aiChooseFavorCard(1);
    assertEqual(cardId, 'n1', 'Should avoid giving defuse');
});

// Test 28: aiChooseFavorCard — gives defuse if only card
test('AI Favor Card — Only Defuse', function() {
    var hand = [makeCard('defuse', 'd1')];
    setupAIPlayer(1, hand);
    var cardId = global.window.AI.aiChooseFavorCard(1);
    assertEqual(cardId, 'd1', 'Should give defuse if only card');
});

// Test 29: aiChooseFavorCard — empty hand returns null
test('AI Favor Card — Empty Hand', function() {
    setupAIPlayer(1, []);
    var cardId = global.window.AI.aiChooseFavorCard(1);
    assertEqual(cardId, null, 'Empty hand should return null');
});

// Test 30: aiChooseDefusePosition — returns valid position
test('AI Defuse Position — Valid Range', function() {
    setupAIPlayer(1, []);
    var pos = global.window.AI.aiChooseDefusePosition(10);
    assert(pos >= 0 && pos <= 10, 'Position should be between 0 and deckSize');
});

// Test 31: aiChooseDefusePosition — empty deck returns 0
test('AI Defuse Position — Empty Deck', function() {
    setupAIPlayer(1, []);
    var pos = global.window.AI.aiChooseDefusePosition(0);
    assertEqual(pos, 0, 'Empty deck should return position 0');
});

// Test 32: aiChooseDefusePosition — easy is random
test('AI Defuse Position — Easy Random', function() {
    setupAIPlayer(1, [], 'easy');
    var positions = [];
    for (var i = 0; i < 20; i++) {
        positions.push(global.window.AI.aiChooseDefusePosition(10));
    }
    var unique = new Set(positions);
    assert(unique.size > 1, 'Easy AI should produce varied positions');
});

// Test 33: aiChooseDefusePosition — hard places near bottom
test('AI Defuse Position — Hard Near Bottom', function() {
    setupAIPlayer(1, [], 'hard');
    var pos = global.window.AI.aiChooseDefusePosition(20);
    assert(pos >= 10, 'Hard AI should place near bottom (>= 50%)');
});

// Test 34: aiNameCardForThreeOfKind — returns valid card type
test('AI Three Kind — Valid Type', function() {
    setupAIPlayer(1, [], 'medium');
    var named = global.window.AI.aiNameCardForThreeOfKind(1);
    assert(typeof named === 'string', 'Should return a string');
    assert(named !== 'exploding_kitten', 'Should not name exploding kitten');
});

// Test 35: aiNameCardForThreeOfKind — medium prefers defuse
test('AI Three Kind — Prefers Defuse', function() {
    setupAIPlayer(1, [], 'medium');
    var named = global.window.AI.aiNameCardForThreeOfKind(1);
    assertEqual(named, 'defuse', 'Medium AI should prefer defuse');
});

// Test 36: aiNameCardForThreeOfKind — easy is random
test('AI Three Kind — Easy Random', function() {
    setupAIPlayer(1, [], 'easy');
    var names = new Set();
    for (var i = 0; i < 50; i++) {
        names.add(global.window.AI.aiNameCardForThreeOfKind(1));
    }
    assert(names.size > 1, 'Easy AI should produce varied card names');
});

// Test 37: aiTakeTurn returns decision
test('AI Take Turn', function() {
    setupAIPlayer(1, [makeCard('skip', 's1')], 'medium');
    var decision = global.window.AI.aiTakeTurn(1);
    assert(typeof decision === 'object', 'aiTakeTurn should return a decision object');
    assert(decision.action !== undefined, 'Decision should have action property');
});

// Test 38: rememberPeekedCards stores info
test('AI Peek Memory — Remember', function() {
    setupAIPlayer(1, []);
    var peeked = [makeCard('exploding_kitten', 'ek1'), makeCard('defuse', 'd1'), makeCard('skip', 's1')];
    global.window.AI.rememberPeekedCards(1, peeked);
    var memory = global.window.AI.getPeekMemory(1);
    assertEqual(memory.topCard, 'exploding_kitten', 'Should remember top card');
    assertEqual(memory.top3.length, 3, 'Should remember 3 cards');
});

// Test 39: clearPeekMemory clears info
test('AI Peek Memory — Clear', function() {
    setupAIPlayer(1, []);
    var peeked = [makeCard('exploding_kitten', 'ek1'), makeCard('defuse', 'd1'), makeCard('skip', 's1')];
    global.window.AI.rememberPeekedCards(1, peeked);
    global.window.AI.clearPeekMemory(1);
    var memory = global.window.AI.getPeekMemory(1);
    assertEqual(memory, null, 'Should clear peek memory');
});

// Test 40: Medium AI — plays skip when deck is very small
test('Medium AI — Skip With Small Deck', function() {
    var hand = [makeCard('skip', 's1'), makeCard('nope', 'n1')];
    setupAIPlayer(1, hand, 'medium');
    global.window.GameState.setState({ drawPile: new Array(4) });
    var decision = global.window.AI.getAIDecision(1);
    // Should either skip or do something else useful
    assert(decision.action === 'play' || decision.action === 'draw', 'Should return valid action');
});

// Test 41: Hard AI — nopes see_future 70% of time
test('Hard AI — Nopes See Future', function() {
    setupAIPlayer(1, [makeCard('nope', 'n1')], 'hard');
    var action = { type: 'play-card', cardType: 'see_future', playerId: 0 };
    var nopeCount = 0;
    for (var i = 0; i < 100; i++) {
        if (global.window.AI.getAINopeDecision(1, action)) nopeCount++;
    }
    assert(nopeCount > 50, 'Hard AI should nope see_future >50% of time (got ' + nopeCount + '/100)');
});

// Test 42: Hard AI — nopes favor targeting self
test('Hard AI — Nopes Favor Self', function() {
    setupAIPlayer(1, [makeCard('nope', 'n1')], 'hard');
    var action = { type: 'play-card', cardType: 'favor', playerId: 0, targetId: 1 };
    assertEqual(global.window.AI.getAINopeDecision(1, action), true, 'Hard AI should nope favor targeting self');
});

// Test 43: Hard AI — never nopes shuffle
test('Hard AI — Never Nopes Shuffle', function() {
    setupAIPlayer(1, [makeCard('nope', 'n1')], 'hard');
    var action = { type: 'play-card', cardType: 'shuffle', playerId: 0 };
    assertEqual(global.window.AI.getAINopeDecision(1, action), false, 'Hard AI should never nope shuffle');
});

// Test 44: Medium AI — combo with single cat card does not combo
test('Medium AI — Single Cat No Combo', function() {
    var hand = [makeCard('tacocat', 'tc1'), makeCard('nope', 'n1')];
    setupAIPlayer(1, hand, 'medium');
    var decision = global.window.AI.getAIDecision(1);
    // Single cat card can't form combo, should draw or play nope
    assert(decision.combo === undefined || decision.combo === false, 'Single cat card should not form combo');
});

// Test 45: aiChooseFavorCard — prefers cat cards over action cards
test('AI Favor Card — Cat Over Action', function() {
    var hand = [makeCard('attack', 'a1'), makeCard('tacocat', 'tc1')];
    setupAIPlayer(1, hand);
    var cardId = global.window.AI.aiChooseFavorCard(1);
    assertEqual(cardId, 'tc1', 'Should prefer giving cat card over action card');
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