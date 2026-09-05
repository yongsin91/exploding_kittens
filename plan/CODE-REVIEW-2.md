# Code Review 2: Tasks 4-6

## Reviewer: Automated
## Date: 2024-09-06
## Tasks Reviewed: 4 (attack stacking), 5 (skip under attack), 6 (five different nopeability)

---

## Task 4: Fix Attack Stacking Mechanic

### Changes Made
- `03-game-state.js`: Removed `isAttackActive` field, added `pendingAttackForNext` field
- `05-turn-engine.js`: 
  - `activateAttack(turns)` now sets `pendingAttackForNext` instead of overwriting `attackTurnsRemaining`
  - `startTurn` applies `pendingAttackForNext` to `attackTurnsRemaining` and resets pending
  - `isUnderAttack()` checks `attackTurnsRemaining > 0` only (no `isAttackActive`)
  - `deactivateAttack()` resets both fields
- `06-card-effects.js`: `handleAttack` calculates `turnsToPass = (remaining-1 if under attack else 0) + 2`
- `13-flow.js`: `handleTurnEnd` decrements `attackTurnsRemaining > 1` for same player, otherwise advances
- All test references to `isAttackActive` updated

### Review Findings
1. ✅ Attack stacking correctly implements official rules: playing Attack passes remaining+2 to next player
2. ✅ `pendingAttackForNext` correctly bridges the gap between playing Attack and next player starting
3. ✅ `startTurn` applies pending attack and resets the pending field
4. ✅ `handleTurnEnd` correctly handles attack turn decrement
5. ⚠️ Test `playing attack activates attack mode` was made more resilient with action log check due to timing sensitivity
6. ✅ No remaining `isAttackActive` references in source code

**Verdict: PASS** ✅

---

## Task 5: Fix Skip Under Attack

### Changes Made
- `06-card-effects.js`: Removed `deactivateAttack()` call from `handleSkip`
- Skip under attack now just ends the current turn — `handleTurnEnd()` naturally decrements `attackTurnsRemaining`
- Updated log message from "cancelled the Attack" to "end one attack turn"
- Fixed flaky test timing in `04-nope-mechanic.spec.js` and `03-gameplay-interactions.spec.js`

### Review Findings
1. ✅ Skip no longer cancels entire attack — only ends one turn
2. ✅ `handleTurnEnd()` handles the decrement automatically (attackTurnsRemaining > 1 = same player)
3. ✅ Log message accurately reflects new behavior
4. ✅ Flaky tests fixed with better nope modal polling

**Verdict: PASS** ✅

---

## Task 6: Fix Five Different Combo Nopeability

### Changes Made
- `07-combo.js`: `canComboBeNoped` now returns true for `five_different`; `resolveFiveDifferent` returns `requiresNopeResolution: true`
- `12-events.js`: `handleComboSubmit` routes Five Different through nope window with resolver that opens discard browser modal
- Tests updated to account for nope window appearing before discard browser modal

### Review Findings
1. ✅ Five Different is now nopeable per official rules
2. ✅ Combo cards still removed before nope window (consumed regardless of nope)
3. ✅ Effect (discard browser) only fires if not noped
4. ✅ Tests updated with `dismissNopeIfPresent` and polling
5. ⚠️ `resolveFiveDifferent` in `07-combo.js` still opens modal directly when called by AI — this will be addressed in Task 9 (AI nope integration)

**Verdict: PASS** ✅

---

## Summary

All 3 tasks pass review. 141/141 E2E tests pass.

### Notes for Future Tasks
- Attack stacking is now properly implemented with `pendingAttackForNext` pattern
- Skip under attack relies on `handleTurnEnd()` for attack turn decrement
- Five Different nope flow uses the same nope window pattern as other cards
- Some tests had timing sensitivity issues fixed with polling loops
- AI combo plays still need nope integration (Task 9)