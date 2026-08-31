# Task 11: Game Flow Controller + Integration — Complete ✅

## Module: `js/modules/13-flow.js` + `js/app.js` modification

### Overview
Implemented the game flow controller that orchestrates the complete game lifecycle: initialization, turn management, AI dispatch, win conditions, player death, and restart. Also modified `app.js` `startGame()` to call `GameFlow.initGame()`.

### API Exposed: `window.GameFlow`

| Method | Description |
|--------|-------------|
| `initGame(config)` | Full game setup: create deck, players, deal cards, insert EK/Defuses, start first turn |
| `startTurn(playerId)` | Start a turn — handles hot-seat pass screen and AI dispatch |
| `handleTurnEnd()` | Check win, advance to next player, handle attack turns |
| `handleAITurn(playerId)` | Dispatch AI turn with 1.5s delay for natural pacing |
| `handlePlayerDeath(playerId)` | Log elimination, clear AI memory, check win, advance turn |
| `checkWinCondition()` | Returns true if ≤1 alive player, triggers endGame |
| `endGame(winner)` | Sets game-over phase, logs result |
| `restartGame()` | Resets all modules, returns to setup screen |
| `executeEffect(effectResult, playerId)` | Central effect executor with nope resolution |
| `handleHotSeatTransition(playerId)` | Dispatches to HotSeat.onTurnStart |

### `initGame(config)` Flow
1. `GameState.reset()` — clear previous state
2. Set AI difficulty (if AI mode)
3. Set hot-seat mode flag
4. Create players (first = human, rest = AI in AI mode; all human in hot-seat)
5. `createDeck(playerCount)` → 56-card deck
6. `removeExplodingKittens()` + `removeDefuses()` → clean deck
7. `shuffle(cleanDeck)`
8. Set initial GameState with players (so Player module can find them)
9. Deal 4 cards + 1 Defuse to each player via `Player.addCardToHand()`
10. `insertExplodingKittens(deck, playerCount-1)`
11. `insertDefuses(deck, remaining)` — 6 total - playerCount
12. `shuffle(deck)` → set as drawPile
13. Log game start, show game screen, init UI/Events
14. Start first turn (random first player)

### AI Turn Flow
- 1.5 second `setTimeout` delay for natural pacing
- Gets decision from `AI.aiTakeTurn()`
- If play: executes card effect or combo, then draws after 1s
- If draw: calls `TurnEngine.drawCard()`, handles EK/Defuse
- AI defuses automatically using `AI.aiChooseDefusePosition()`
- AI remembers peeked cards via `AI.rememberPeekedCards()`

### `app.js` Integration
Modified `startGame()` to call `GameFlow.initGame(config)` with setup state from `getSetupState()`. Falls back to showing game screen only if GameFlow is unavailable.

### Test Results
- **Test File**: `run-test-task11.js`
- **Tests**: 63/63 passed ✅
- **Coverage**: Module loading, initGame (creates players, human/AI flags, deals 5 cards, EK count for 2-5 players, game phase, turn phase, action log, AI difficulty, hot-seat mode, default names, non-empty draw pile, empty discard, no modal, nope inactive, player names), checkWinCondition (multiple/one alive), endGame (with/without winner), handlePlayerDeath (logs, win check, clears peek memory), restartGame (resets state/hot-seat), executeEffect (success/failure), handleHotSeatTransition, 5-player game

### Key Design Decisions
- State set before dealing cards so `Player.addCardToHand()` can find players in GameState
- AI turns use `setTimeout` for natural pacing (1.5s initial, 1s between actions)
- Attack turns: same player goes again if `attackTurnsRemaining > 0`
- Dead players are skipped in `startTurn()` via `handleTurnEnd()`
- `restartGame()` resets all modules: GameState, HotSeat, Nope
- `executeEffect()` provides central nope resolution — opens nope window with resolver callback