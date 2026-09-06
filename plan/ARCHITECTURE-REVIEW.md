# Architecture Review & Reorganization Plan

## Date: 2024-09-06
## Branch: `architecture-review`

---

## Executive Summary

The Exploding Kittens codebase is ~7,275 lines across 13 modules + app.js, with 148 E2E tests. The architecture uses IIFE module pattern with `window.*` globals and an observer-pattern state manager. While functional, the codebase has several structural issues that affect maintainability, testability, and clarity.

**Verdict: Reorganization IS necessary** — but should be incremental, not a rewrite.

---

## Issues Found

### 1. God Modules (High Priority)

| Module | Lines | Dependencies | Problem |
|--------|-------|-------------|---------|
| `13-flow.js` | 613 | 12 | Game lifecycle + AI turn execution + effect UI. `executeAIPlay`, `scheduleNextAIAction`, `executeAIDraw` are AI concerns mixed with general flow. |
| `12-events.js` | 746 | 10 | All user input handling + its own `handleEffectUI` (duplicate of 13-flow). 19 functions, too many responsibilities. |
| `08-nope.js` | 665 | 4 | 144 internal state references. 4 internal timeout/state variables. Complex nope flow logic. |

### 2. Duplicate Code (High Priority)

- **`handleEffectUI`** — defined in BOTH `12-events.js` and `13-flow.js` with different logic. The AI version handles shuffle/see_future, the events version handles modal display.
- **`getNextPlayer`** (`09-ai.js`) duplicates `getNextAlivePlayerIndex` (`04-player.js`).
- **`handleTurnEnd` defensive check** — `window.GameFlow && typeof window.GameFlow.handleTurnEnd === 'function'` repeated 10+ times.
- **Test helpers** — `setupControlledGame`, `getGameState`, `dismissNopeIfPresent`, `waitForHumanTurn` duplicated in 2-7 test files.

### 3. Dead Code (Medium Priority)

| Export | Module | Issue |
|--------|--------|-------|
| `insertExplodingKittens` | 02-deck | Never called |
| `insertDefuses` | 02-deck | Never called |
| `getDeckSummary` | 02-deck | Only used internally, not externally |
| `Player.revivePlayer` | 04-player | Never called externally |
| `CardEffects.canBeNoped` | 06-card-effects | Never called |
| `TurnEngine.endTurn` | 05-turn-engine | Only called internally by `advanceToNextPlayer` |
| `TurnEngine.advanceToNextPlayer` | 05-turn-engine | Only called internally |
| `TurnEngine.openNopeWindow` | 05-turn-engine | Only called by Nope module |
| `GameState.getStateProperty` | 03-game-state | Only 2 internal uses |
| `GameState.setStateProperty` | 03-game-state | Only 3 uses across codebase |

### 4. Inconsistent State Access (Medium Priority)

- `setState`: 36 calls — used for simple top-level field updates
- `mutate`: 18 calls — used for read-modify-write patterns  
- `setStateProperty`: 3 calls — barely used, could be replaced by `mutate`
- Some `setState` calls update multiple fields (e.g., `activeModal` + `modalData`) — should use `mutate` for consistency

### 5. Inconsistent Coding Style (Low Priority)

- Modules 01-08: ES6 (`const`/`let`)
- Modules 09-13 + app.js: ES5 (`var`)
- Module 10: Mixed ES6 + ES5

### 6. Excessive Console Logging (Low Priority)

149 `console.log/error/warn` calls. Should be behind a debug flag or removed (keep `console.error` only).

### 7. Modal Management Split (Medium Priority)

Three files involved in modal management:
- `app.js`: DOM-level modal open/close (`openModal`, `closeModal`)
- `12-events.js`: Game state modal fields (`activeModal`, `modalData`)
- `10-ui-renderer.js`: Renders modals based on game state

The split between `app.js` closeModal and `12-events.js` is confusing — some modals are closed by app.js, others by events.js.

### 8. Test Helper Duplication (Low Priority)

`waitForHumanTurn` is defined in 7 test files. `setupControlledGame`, `getGameState`, `dismissNopeIfPresent` are defined in 2 files each. Should be centralized in `helpers.js`.

---

## Reorganization Plan

### Task A: Extract AI Controller from Game Flow (High Priority)

**Goal:** Split `13-flow.js` into `13-flow.js` (game lifecycle) and `14-ai-controller.js` (AI turn execution).

**Move to `14-ai-controller.js`:**
- `handleAITurn`
- `executeAIPlay`
- `scheduleNextAIAction`
- `executeAIDraw`
- `handleEffectUI` (consolidate both versions)

**Keep in `13-flow.js`:**
- `initGame`
- `startTurn`
- `handleTurnEnd`
- `checkWinCondition`
- `endGame`
- `handlePlayerDeath`
- `restartGame`
- `executeEffect`
- `handleHotSeatTransition`

### Task B: Consolidate handleEffectUI (High Priority)

**Goal:** Single `handleEffectUI` function used by both human and AI flows.

**Location:** `06-card-effects.js` or a new `effect-resolver.js`.

**Logic:** Handle all effect types (shuffle, see_future, peek modal, skip turn end, attack turn end) in one place.

### Task C: Remove Dead Code (Medium Priority)

**Goal:** Clean up unused exports and functions.

- Remove `insertExplodingKittens`, `insertDefuses`, `getDeckSummary` from `02-deck.js` exports
- Remove `Player.revivePlayer` if truly unused
- Remove `CardEffects.canBeNoped`
- Remove `TurnEngine.endTurn`, `TurnEngine.advanceToNextPlayer` from public API (keep internal)
- Remove `GameState.getStateProperty`, `GameState.setStateProperty` if replaceable by `mutate`

### Task D: Consolidate Modal Management (Medium Priority)

**Goal:** Single source of truth for modal state.

- Move `closeModal` logic from `app.js` into `12-events.js` or a new `modal-manager.js`
- Remove DOM-level modal manipulation from `app.js` — let `10-ui-renderer.js` handle all modal rendering based on `activeModal` state
- `app.js` only handles setup screen

### Task E: Centralize Test Helpers (Low Priority)

**Goal:** Single `helpers.js` with all shared test utilities.

- Move `waitForHumanTurn`, `setupControlledGame`, `getGameState`, `dismissNopeIfPresent`, `getCurrentPlayerIndex` into `e2e/helpers.js`
- Update all test files to import from helpers

### Task F: Standardize Coding Style (Low Priority)

**Goal:** Consistent ES6 across all modules.

- Convert `var` to `const`/`let` in modules 09-13 and app.js
- Convert `function(x) {}` to arrow functions where appropriate

### Task G: Reduce Console Logging (Low Priority)

**Goal:** Clean logging — errors only, debug behind flag.

- Add `DEBUG` flag to `GAME_CONFIG`
- Wrap `console.log` in `if (DEBUG)` checks or create a `debug()` helper
- Keep `console.error` for actual errors

### Task H: Deduplicate getNextPlayer (Low Priority)

**Goal:** Single next-player function.

- Use `Player.getNextAlivePlayerIndex()` in `09-ai.js` instead of the local `getNextPlayer`
- Or extract a shared helper

---

## Task Priority & Dependencies

```
Task A (extract AI controller) ── Task B (consolidate handleEffectUI)
                                        │
Task C (remove dead code) ──────────────┤
                                        │
Task D (consolidate modals) ────────────┤
                                        │
Task E (centralize test helpers) ───────┤
                                        │
Task F (standardize style) ─────────────┤
                                        │
Task G (reduce logging) ────────────────┤
                                        │
Task H (deduplicate getNextPlayer) ──────┘
```

Tasks A+B should be done first (highest impact). Tasks C-H can be done in parallel after A+B.

## Acceptance Criteria

- All 148 E2E tests pass after each task
- No new console errors
- Code is more modular and testable
- Dead code removed
- Single source of truth for each concern