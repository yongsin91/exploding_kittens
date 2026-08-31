// Create a mock window object for Node.js testing
global.window = {};

// Suppress module loading console logs for cleaner test output
const originalLog = console.log;
const originalError = console.error;

// Load modules in dependency order
require('../js/modules/01-constants.js');
require('../js/modules/02-deck.js');
require('../js/modules/03-game-state.js');
require('../js/modules/04-player.js');
require('../js/modules/05-turn-engine.js');
require('../js/modules/06-card-effects.js');
require('../js/modules/07-combo.js');
require('../js/modules/08-nope.js');

// Run tests
(function() {
    'use strict';

    let testsPassed = 0;
    let testsFailed = 0;
    let testsTotal = 0;

    function assert(condition, message) {
        testsTotal++;
        if (condition) {
            testsPassed++;
            console.log(`  ✅ ${message}`);
        } else {
            testsFailed++;
            console.error(`  ❌ ${message}`);
        }
    }

    function assertEqual(actual, expected, message) {
        testsTotal++;
        if (actual === expected) {
            testsPassed++;
            console.log(`  ✅ ${message} (got: ${actual})`);
        } else {
            testsFailed++;
            console.error(`  ❌ ${message} (expected: ${expected}, got: ${actual})`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('TASK 6: Nope / Counter-Play System - TEST SUITE');
    console.log('='.repeat(60) + '\n');

    // ========== MODULE LOADING ==========

    console.log('📋 MODULE LOADING\n');
    assert(typeof window.Nope === 'object', 'window.Nope is defined');
    assert(typeof window.Nope.openNopeWindow === 'function', 'openNopeWindow function exists');
    assert(typeof window.Nope.playNope === 'function', 'playNope function exists');
    assert(typeof window.Nope.closeNopeWindow === 'function', 'closeNopeWindow function exists');
    assert(typeof window.Nope.isActionNoped === 'function', 'isActionNoped function exists');
    assert(typeof window.Nope.canPlayerNope === 'function', 'canPlayerNope function exists');
    assert(typeof window.Nope.getNopeStack === 'function', 'getNopeStack function exists');
    assert(typeof window.Nope.getPendingAction === 'function', 'getPendingAction function exists');
    assert(typeof window.Nope.getEligibleNopePlayers === 'function', 'getEligibleNopePlayers function exists');
    assert(typeof window.Nope.isNopeWindowActive === 'function', 'isNopeWindowActive function exists');
    assert(typeof window.Nope.handleNopeResponse === 'function', 'handleNopeResponse function exists');
    assert(typeof window.Nope.forceCloseNopeWindow === 'function', 'forceCloseNopeWindow function exists');

    // ========== SETUP: Create test game state ==========

    console.log('\n📋 SETUP: Create test game state\n');

    // Reset state
    window.GameState.reset();

    // Create 3 players
    const p0 = window.Player.createPlayer(0, 'Alice', false);
    const p1 = window.Player.createPlayer(1, 'Bob', false);
    const p2 = window.Player.createPlayer(2, 'Carol', false);

    window.GameState.setState({
        players: [p0, p1, p2],
        currentPlayerIndex: 0,
        gamePhase: 'play',
        gameStatus: 'active',
        drawPile: window.createDeck(3),
        discardPile: []
    });

    // Give each player a Nope card and some other cards
    const nopeCard0 = { instanceId: 'nope-test-0', type: 'nope', emoji: '🚫', name: 'Nope', cornerIcon: null };
    const nopeCard1 = { instanceId: 'nope-test-1', type: 'nope', emoji: '🚫', name: 'Nope', cornerIcon: null };
    const nopeCard2 = { instanceId: 'nope-test-2', type: 'nope', emoji: '🚫', name: 'Nope', cornerIcon: null };
    const attackCard = { instanceId: 'attack-test-0', type: 'attack', emoji: '⚔️', name: 'Attack', cornerIcon: null };

    window.Player.addCardToHand(0, nopeCard0);
    window.Player.addCardToHand(1, nopeCard1);
    window.Player.addCardToHand(2, nopeCard2);
    window.Player.addCardToHand(0, attackCard);

    assertEqual(window.Player.getHandSize(0), 2, 'Alice has 2 cards (nope + attack)');
    assertEqual(window.Player.getHandSize(1), 1, 'Bob has 1 card (nope)');
    assertEqual(window.Player.getHandSize(2), 1, 'Carol has 1 card (nope)');

    // ========== TEST: openNopeWindow ==========

    console.log('\n📋 TEST: openNopeWindow\n');

    let resolverCalled = false;
    const resolver = () => { resolverCalled = true; };

    const result = window.Nope.openNopeWindow({
        type: 'card',
        cardType: 'attack',
        cards: [attackCard],
        playerId: 0,
        targetId: null,
        description: 'Alice played Attack',
        resolver
    });

    assert(result === true, 'openNopeWindow returns true');
    assert(window.Nope.getPendingAction() !== null, 'Pending action is stored');
    assertEqual(window.Nope.getPendingAction().type, 'card', 'Pending action type is "card"');
    assertEqual(window.Nope.getPendingAction().cardType, 'attack', 'Pending action cardType is "attack"');
    assertEqual(window.Nope.getPendingAction().playerId, 0, 'Pending action playerId is 0');
    assertEqual(window.Nope.getNopeStack().length, 0, 'Nope stack is empty initially');
    assertEqual(window.Nope.isActionNoped(), false, 'Action is not noped with 0 nopes');
    assertEqual(window.GameState.getStateProperty('turnPhase'), 'nope-window', 'turnPhase is nope-window');

    // ========== TEST: canPlayerNope ==========

    console.log('\n📋 TEST: canPlayerNope\n');

    assert(window.Nope.canPlayerNope(1) === true, 'Bob (player 1) can nope');
    assert(window.Nope.canPlayerNope(2) === true, 'Carol (player 2) can nope');
    assert(window.Nope.canPlayerNope(0) === false, 'Alice (player 0, original actor) cannot nope own action');

    // ========== TEST: getEligibleNopePlayers ==========

    console.log('\n📋 TEST: getEligibleNopePlayers\n');

    const eligible = window.Nope.getEligibleNopePlayers();
    assertEqual(eligible.length, 2, '2 eligible players (Bob and Carol)');
    assert(eligible.some(p => p.id === 1), 'Bob is eligible');
    assert(eligible.some(p => p.id === 2), 'Carol is eligible');
    assert(!eligible.some(p => p.id === 0), 'Alice is NOT eligible');

    // ========== TEST: playNope (1 nope = cancelled) ==========

    console.log('\n📋 TEST: playNope — 1 Nope = CANCELLED\n');

    const nopeResult = window.Nope.playNope(1);
    assert(nopeResult === true, 'playNope returns true for Bob');
    assertEqual(window.Nope.getNopeStack().length, 1, 'Nope stack has 1 entry');
    assertEqual(window.Nope.isActionNoped(), true, 'Action IS noped (1 nope = odd = cancelled)');
    assertEqual(window.Player.getHandSize(1), 0, 'Bob\'s Nope card was removed from hand');

    // After Bob nopes, Alice (original actor) can now counter-nope (Yup)
    assert(window.Nope.canPlayerNope(0) === true, 'Alice can now counter-nope (Yup)');
    assert(window.Nope.canPlayerNope(2) === true, 'Carol can still nope');
    assert(window.Nope.canPlayerNope(1) === false, 'Bob cannot nope his own nope');

    // ========== TEST: closeNopeWindow with 1 nope (cancelled) ==========

    console.log('\n📋 TEST: closeNopeWindow — 1 Nope → CANCELLED\n');

    const closeResult = window.Nope.closeNopeWindow();
    assert(closeResult.cancelled === true, 'closeNopeWindow returns cancelled=true');
    assert(closeResult.executed === false, 'closeNopeWindow returns executed=false');
    assertEqual(closeResult.nopeCount, 1, 'nopeCount is 1');
    assert(resolverCalled === false, 'Resolver was NOT called (action cancelled)');
    assert(window.Nope.getPendingAction() === null, 'Pending action cleared after close');
    assertEqual(window.Nope.getNopeStack().length, 0, 'Nope stack cleared after close');

    // Check discard pile has the nope card and original action card
    const discardAfterCancel = window.GameState.getStateProperty('discardPile');
    assert(discardAfterCancel.length >= 2, 'Discard pile has at least 2 cards (nope + attack)');
    assert(discardAfterCancel.some(c => c.type === 'nope'), 'Discard pile contains the Nope card');
    assert(discardAfterCancel.some(c => c.type === 'attack'), 'Discard pile contains the Attack card');

    // ========== TEST: 2 Nopes = PROCEEDS (Yup) ==========

    console.log('\n📋 TEST: 2 Nopes → PROCEEDS (Yup)\n');

    // Reset for next test
    window.GameState.reset();
    window.GameState.setState({
        players: [p0, p1, p2],
        currentPlayerIndex: 0,
        gamePhase: 'play',
        gameStatus: 'active',
        drawPile: window.createDeck(3),
        discardPile: []
    });

    // Give players fresh nope cards
    const nopeCard0b = { instanceId: 'nope-test-0b', type: 'nope', emoji: '🚫', name: 'Nope', cornerIcon: null };
    const nopeCard1b = { instanceId: 'nope-test-1b', type: 'nope', emoji: '🚫', name: 'Nope', cornerIcon: null };
    const skipCard = { instanceId: 'skip-test-0', type: 'skip', emoji: '⏭️', name: 'Skip', cornerIcon: null };

    window.Player.addCardToHand(0, nopeCard0b);
    window.Player.addCardToHand(0, skipCard);
    window.Player.addCardToHand(1, nopeCard1b);

    let resolverCalled2 = false;
    const resolver2 = () => { resolverCalled2 = true; };

    window.Nope.openNopeWindow({
        type: 'card',
        cardType: 'skip',
        cards: [skipCard],
        playerId: 0,
        description: 'Alice played Skip',
        resolver: resolver2
    });

    // Bob nopes
    window.Nope.playNope(1);
    assertEqual(window.Nope.getNopeStack().length, 1, '1 nope played by Bob');
    assertEqual(window.Nope.isActionNoped(), true, 'Action is noped after 1 nope');

    // Alice counter-nopes (Yup)
    window.Nope.playNope(0);
    assertEqual(window.Nope.getNopeStack().length, 2, '2 nopes played (Bob + Alice)');
    assertEqual(window.Nope.isActionNoped(), false, 'Action is NOT noped (2 nopes = even = proceeds)');

    // Close — should execute
    const closeResult2 = window.Nope.closeNopeWindow();
    assert(closeResult2.cancelled === false, 'closeNopeWindow returns cancelled=false');
    assert(closeResult2.executed === true, 'closeNopeWindow returns executed=true');
    assertEqual(closeResult2.nopeCount, 2, 'nopeCount is 2');
    assert(resolverCalled2 === true, 'Resolver WAS called (action proceeds)');

    // ========== TEST: 3 Nopes = CANCELLED ==========

    console.log('\n📋 TEST: 3 Nopes → CANCELLED\n');

    window.GameState.reset();
    window.GameState.setState({
        players: [p0, p1, p2],
        currentPlayerIndex: 0,
        gamePhase: 'play',
        gameStatus: 'active',
        drawPile: window.createDeck(3),
        discardPile: []
    });

    // Give players 3 nope cards total (Bob 2, Carol 1) + Alice has the action card
    const nopeCard1c = { instanceId: 'nope-test-1c', type: 'nope', emoji: '🚫', name: 'Nope', cornerIcon: null };
    const nopeCard1d = { instanceId: 'nope-test-1d', type: 'nope', emoji: '🚫', name: 'Nope', cornerIcon: null };
    const nopeCard2c = { instanceId: 'nope-test-2c', type: 'nope', emoji: '🚫', name: 'Nope', cornerIcon: null };
    const favorCard = { instanceId: 'favor-test-0', type: 'favor', emoji: '🎁', name: 'Favor', cornerIcon: null };

    window.Player.addCardToHand(0, favorCard);
    window.Player.addCardToHand(1, nopeCard1c);
    window.Player.addCardToHand(1, nopeCard1d);
    window.Player.addCardToHand(2, nopeCard2c);

    let resolverCalled3 = false;
    window.Nope.openNopeWindow({
        type: 'card',
        cardType: 'favor',
        cards: [favorCard],
        playerId: 0,
        targetId: 1,
        description: 'Alice played Favor on Bob',
        resolver: () => { resolverCalled3 = true; }
    });

    // Bob nopes (1)
    window.Nope.playNope(1);
    assertEqual(window.Nope.isActionNoped(), true, '1 nope → noped');

    // Carol nopes (2) — Yup
    window.Nope.playNope(2);
    assertEqual(window.Nope.isActionNoped(), false, '2 nopes → not noped');

    // Bob nopes again (3) — Nope
    window.Nope.playNope(1);
    assertEqual(window.Nope.isActionNoped(), true, '3 nopes → noped');

    const closeResult3 = window.Nope.closeNopeWindow();
    assert(closeResult3.cancelled === true, '3 nopes → cancelled=true');
    assert(closeResult3.executed === false, '3 nopes → executed=false');
    assert(resolverCalled3 === false, 'Resolver NOT called with 3 nopes');

    // ========== TEST: 0 Nopes = PROCEEDS ==========

    console.log('\n📋 TEST: 0 Nopes → PROCEEDS\n');

    window.GameState.reset();
    window.GameState.setState({
        players: [p0, p1, p2],
        currentPlayerIndex: 0,
        gamePhase: 'play',
        gameStatus: 'active',
        drawPile: window.createDeck(3),
        discardPile: []
    });

    const shuffleCard = { instanceId: 'shuffle-test-0', type: 'shuffle', emoji: '🔀', name: 'Shuffle', cornerIcon: null };
    window.Player.addCardToHand(0, shuffleCard);

    let resolverCalled0 = false;
    window.Nope.openNopeWindow({
        type: 'card',
        cardType: 'shuffle',
        cards: [shuffleCard],
        playerId: 0,
        description: 'Alice played Shuffle',
        resolver: () => { resolverCalled0 = true; }
    });

    // No one nopes — close immediately
    const closeResult0 = window.Nope.closeNopeWindow();
    assert(closeResult0.cancelled === false, '0 nopes → cancelled=false');
    assert(closeResult0.executed === true, '0 nopes → executed=true');
    assertEqual(closeResult0.nopeCount, 0, 'nopeCount is 0');
    assert(resolverCalled0 === true, 'Resolver called with 0 nopes');

    // ========== TEST: handleNopeResponse ==========

    console.log('\n📋 TEST: handleNopeResponse\n');

    window.GameState.reset();
    window.GameState.setState({
        players: [p0, p1, p2],
        currentPlayerIndex: 0,
        gamePhase: 'play',
        gameStatus: 'active',
        drawPile: window.createDeck(3),
        discardPile: []
    });

    const nopeCard1e = { instanceId: 'nope-test-1e', type: 'nope', emoji: '🚫', name: 'Nope', cornerIcon: null };
    const attackCard2 = { instanceId: 'attack-test-1', type: 'attack', emoji: '⚔️', name: 'Attack', cornerIcon: null };
    window.Player.addCardToHand(0, attackCard2);
    window.Player.addCardToHand(1, nopeCard1e);

    let resolverCalledHR = false;
    window.Nope.openNopeWindow({
        type: 'card',
        cardType: 'attack',
        cards: [attackCard2],
        playerId: 0,
        description: 'Alice played Attack',
        resolver: () => { resolverCalledHR = true; }
    });

    // Bob says "Nope"
    window.Nope.handleNopeResponse(true, 1);
    assertEqual(window.Nope.getNopeStack().length, 1, 'handleNopeResponse(true) adds to nope stack');

    // Carol says "Don't nope" — should close window since no one else can nope
    window.Nope.handleNopeResponse(false, 2);
    assert(window.Nope.getPendingAction() === null, 'handleNopeResponse(false) by last eligible → closes window');
    assert(resolverCalledHR === false, 'Resolver not called (1 nope = cancelled)');

    // ========== TEST: getNopeSummary ==========

    console.log('\n📋 TEST: getNopeSummary\n');

    window.GameState.reset();
    window.GameState.setState({
        players: [p0, p1, p2],
        currentPlayerIndex: 0,
        gamePhase: 'play',
        gameStatus: 'active',
        drawPile: window.createDeck(3),
        discardPile: []
    });

    const nopeCard1f = { instanceId: 'nope-test-1f', type: 'nope', emoji: '🚫', name: 'Nope', cornerIcon: null };
    const nopeCard2f = { instanceId: 'nope-test-2f', type: 'nope', emoji: '🚫', name: 'Nope', cornerIcon: null };
    const seeFutureCard = { instanceId: 'seefuture-test-0', type: 'see_future', emoji: '🔮', name: 'See the Future', cornerIcon: null };
    window.Player.addCardToHand(0, seeFutureCard);
    window.Player.addCardToHand(1, nopeCard1f);
    window.Player.addCardToHand(2, nopeCard2f);

    window.Nope.openNopeWindow({
        type: 'card',
        cardType: 'see_future',
        cards: [seeFutureCard],
        playerId: 0,
        description: 'Alice played See the Future',
        resolver: () => {}
    });

    const summary = window.Nope.getNopeSummary();
    assert(summary.hasPendingAction === true, 'Summary: hasPendingAction=true');
    assertEqual(summary.actionType, 'card', 'Summary: actionType=card');
    assertEqual(summary.actionPlayerId, 0, 'Summary: actionPlayerId=0');
    assertEqual(summary.nopeCount, 0, 'Summary: nopeCount=0');
    assertEqual(summary.isActionNoped, false, 'Summary: isActionNoped=false');
    assertEqual(summary.eligiblePlayers.length, 2, 'Summary: 2 eligible players (Bob + Carol)');

    window.Nope.playNope(1);
    const summary2 = window.Nope.getNopeSummary();
    assertEqual(summary2.nopeCount, 1, 'Summary after nope: nopeCount=1');
    assertEqual(summary2.isActionNoped, true, 'Summary after nope: isActionNoped=true');

    window.Nope.closeNopeWindow();

    // ========== TEST: Dead player cannot nope ==========

    console.log('\n📋 TEST: Dead player cannot nope\n');

    window.GameState.reset();
    const p0d = window.Player.createPlayer(0, 'Alice', false);
    const p1d = window.Player.createPlayer(1, 'Bob', false);
    const p2d = window.Player.createPlayer(2, 'DeadCarol', false);
    p2d.isAlive = false;

    window.GameState.setState({
        players: [p0d, p1d, p2d],
        currentPlayerIndex: 0,
        gamePhase: 'play',
        gameStatus: 'active',
        drawPile: window.createDeck(3),
        discardPile: []
    });

    const nopeCard1g = { instanceId: 'nope-test-1g', type: 'nope', emoji: '🚫', name: 'Nope', cornerIcon: null };
    const nopeCard2g = { instanceId: 'nope-test-2g', type: 'nope', emoji: '🚫', name: 'Nope', cornerIcon: null };
    const attackCard3 = { instanceId: 'attack-test-2', type: 'attack', emoji: '⚔️', name: 'Attack', cornerIcon: null };
    window.Player.addCardToHand(0, attackCard3);
    window.Player.addCardToHand(1, nopeCard1g);
    window.Player.addCardToHand(2, nopeCard2g);

    window.Nope.openNopeWindow({
        type: 'card',
        cardType: 'attack',
        cards: [attackCard3],
        playerId: 0,
        description: 'Alice played Attack',
        resolver: () => {}
    });

    assert(window.Nope.canPlayerNope(2) === false, 'Dead Carol cannot nope');
    assertEqual(window.Nope.getEligibleNopePlayers().length, 1, 'Only 1 eligible player (Bob)');

    window.Nope.closeNopeWindow();

    // ========== TEST: Player without Nope card cannot nope ==========

    console.log('\n📋 TEST: Player without Nope card cannot nope\n');

    window.GameState.reset();
    const p0e = window.Player.createPlayer(0, 'Alice', false);
    const p1e = window.Player.createPlayer(1, 'NoNopeBob', false);

    window.GameState.setState({
        players: [p0e, p1e],
        currentPlayerIndex: 0,
        gamePhase: 'play',
        gameStatus: 'active',
        drawPile: window.createDeck(2),
        discardPile: []
    });

    const skipCard2 = { instanceId: 'skip-test-1', type: 'skip', emoji: '⏭️', name: 'Skip', cornerIcon: null };
    window.Player.addCardToHand(0, skipCard2);
    // Bob has no cards at all

    window.Nope.openNopeWindow({
        type: 'card',
        cardType: 'skip',
        cards: [skipCard2],
        playerId: 0,
        description: 'Alice played Skip',
        resolver: () => {}
    });

    assert(window.Nope.canPlayerNope(1) === false, 'Bob without Nope card cannot nope');
    assertEqual(window.Nope.getEligibleNopePlayers().length, 0, '0 eligible players');

    window.Nope.closeNopeWindow();

    // ========== TEST: forceCloseNopeWindow ==========

    console.log('\n📋 TEST: forceCloseNopeWindow\n');

    window.GameState.reset();
    window.GameState.setState({
        players: [p0, p1, p2],
        currentPlayerIndex: 0,
        gamePhase: 'play',
        gameStatus: 'active',
        drawPile: window.createDeck(3),
        discardPile: []
    });

    const nopeCard1h = { instanceId: 'nope-test-1h', type: 'nope', emoji: '🚫', name: 'Nope', cornerIcon: null };
    const favorCard2 = { instanceId: 'favor-test-1', type: 'favor', emoji: '🎁', name: 'Favor', cornerIcon: null };
    window.Player.addCardToHand(0, favorCard2);
    window.Player.addCardToHand(1, nopeCard1h);

    let resolverCalledFC = false;
    window.Nope.openNopeWindow({
        type: 'card',
        cardType: 'favor',
        cards: [favorCard2],
        playerId: 0,
        targetId: 1,
        description: 'Alice played Favor on Bob',
        resolver: () => { resolverCalledFC = true; }
    });

    // Force close without anyone noping
    const forceResult = window.Nope.forceCloseNopeWindow();
    assert(forceResult.executed === true, 'forceCloseNopeWindow executes action (0 nopes)');
    assert(resolverCalledFC === true, 'Resolver called after force close');
    assert(window.Nope.getPendingAction() === null, 'Pending action cleared after force close');

    // ========== TEST RESULTS ==========

    console.log('\n' + '='.repeat(60));
    console.log(`TEST RESULTS: ${testsPassed}/${testsTotal} passed, ${testsFailed} failed`);
    console.log('='.repeat(60));

    if (testsFailed > 0) {
        console.error(`\n❌ ${testsFailed} test(s) FAILED!`);
        process.exit(1);
    } else {
        console.log(`\n✅ ALL ${testsTotal} TESTS PASSED!`);
    }
})();