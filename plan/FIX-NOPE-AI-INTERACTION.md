# Fix: Human Nope on AI Cards + Nope Stacking

## Problem Statement

1. When AI plays a card and the nope modal appears, clicking "Nope!" does nothing — the human cannot counter AI card plays.
2. Nope stacking (playing nope on top of opponent's nope) needs to be verified to work correctly.

## Root Cause Analysis

### Bug 1: `handleNopeResponse(true)` doesn't resolve human player ID in AI mode

In `12-events.js`, when the "Nope!" button is clicked:

```javascript
function handleNopeResponse(wantNope, playerId) {
    if (wantNope) {
        if (playerId === undefined) {
            // Use pending nope player from HotSeat if available
            if (window.HotSeat && typeof window.HotSeat.getPendingNopePlayerId === 'function') {
                playerId = window.HotSeat.getPendingNopePlayerId();
            }
        }
        if (playerId !== null && playerId !== undefined) {
            window.Nope.playNope(playerId);  // <-- NEVER REACHED in AI mode
        }
    }
    ...
}
```

**In AI mode:**
- `playerId` starts as `undefined` (button click passes no ID)
- `HotSeat.getPendingNopePlayerId()` is only available in hot-seat mode
- `playerId` stays `undefined`
- `playerId !== null && playerId !== undefined` → `false`
- `playNope()` is never called → nothing happens

**In Hot-seat mode:** works because `HotSeat.getPendingNopePlayerId()` returns the current player.

### Bug 2: `executeAIPlay` calls `scheduleNextAIAction` even when nope window is open

In `14-ai-controller.js`:

```javascript
function executeAIPlay(playerId, decision) {
    ...
    if (decision.combo) {
        executeAICombo(playerId, decision, player);   // may open nope window
    } else {
        executeAISingleCard(playerId, decision, player); // may open nope window
    }

    // ALWAYS called, even if nope window was just opened
    scheduleNextAIAction(playerId);  // <-- BUG: races with nope window
}
```

When the AI plays a nopeable card:
1. `executeAISingleCard` opens the nope window (async — waits for human response)
2. `executeAIPlay` immediately calls `scheduleNextAIAction` → 1.5s timer
3. After 1.5s, `scheduleNextAIAction` tries to continue the AI turn
4. This can conflict with the still-open nope window

The `onComplete` callback in the nope window already handles scheduling the next action. The unconditional `scheduleNextAIAction` call is redundant and causes a race condition.

### Nope Stacking Verification

The stacking logic in `08-nope.js` `playNope()` and `canPlayerNope()` is correct:
- Can't nope your own nope (consecutive)
- Can't nope your own action (first nope only)
- After someone else nopes, you can nope again
- Odd = cancelled, even = proceeds

**But stacking is impossible to test because Bug 1 prevents the human from noping at all.** Fixing Bug 1 enables the entire stacking flow.

## Fix Plan

### Task 1: Fix `handleNopeResponse` to find the human player in AI mode

**File:** `js/modules/12-events.js`

When `playerId` is `undefined` and we're not in hot-seat mode, find the human player:

```javascript
if (playerId === undefined) {
    if (window.HotSeat && window.HotSeat.isHotSeatMode() && ...) {
        playerId = window.HotSeat.getPendingNopePlayerId();
    } else {
        // AI mode — find the human player
        const humanPlayer = window.Player.getAlivePlayers().find(p => p.isHuman);
        if (humanPlayer) {
            playerId = humanPlayer.id;
        }
    }
}
```

### Task 2: Fix `executeAIPlay` to not call `scheduleNextAIAction` when nope window is open

**File:** `js/modules/14-ai-controller.js`

Make `executeAISingleCard` and `executeAICombo` return `true` if they opened a nope window, `false` otherwise. Only call `scheduleNextAIAction` if no nope window was opened:

```javascript
function executeAIPlay(playerId, decision) {
    let nopeWindowOpened = false;
    
    if (decision.combo) {
        nopeWindowOpened = executeAICombo(playerId, decision, player);
    } else {
        nopeWindowOpened = executeAISingleCard(playerId, decision, player);
    }

    if (!nopeWindowOpened) {
        scheduleNextAIAction(playerId);
    }
}
```

### Task 3: Add E2E test for human noping AI card play + stacking

**File:** `e2e/10-corrected-mechanics.spec.js`

Add test that:
1. Sets up a game where the human has a Nope card
2. Ends the human's turn so AI plays
3. Verifies the nope modal appears
4. Clicks "Nope!" and verifies the action is cancelled
5. Tests stacking: AI counter-nopes, human nopes again