# Task 10: Event Handler / Input Controller — Complete ✅

## Module: `js/modules/12-events.js`

### Overview
Implemented the event handler/input controller that routes all user interactions to the appropriate game logic. Handles card clicks, button presses, modal interactions, target selection, combo building, and keyboard shortcuts.

### API Exposed: `window.Events`

| Method | Description |
|--------|-------------|
| `init()` | Sets up all DOM event listeners (buttons, keyboard) |
| `handleCardClick(cardInstanceId)` | Processes hand card click — plays card or opens combo modal |
| `handleDrawClick()` | Draws a card, handles EK/Defuse, ends turn |
| `handleEndTurnClick()` | Ends current player's turn |
| `handleTargetSelect(playerId)` | Handles Favor/combo target selection |
| `handleNopeResponse(wantNope, playerId)` | Processes nope yes/no response |
| `handleDefusePlace()` | Places EK back in deck at chosen position |
| `handleFavorGive(cardInstanceId)` | Transfers card from target to requester |
| `handleComboSubmit()` | Validates and resolves combo from selected cards |
| `handleComboCardToggle(cardInstanceId)` | Toggles card selection in combo builder |
| `handleThreeKindName()` | Resolves three-of-a-kind with named card |
| `handleDiscardPick(cardInstanceId)` | Picks card from discard (Five Different combo) |
| `handlePlayAgain()` | Restarts game or returns to setup |

### Features Implemented

1. **Card Click Handling**:
   - Validates turn phase, player alive, human player, no active modal/nope
   - Defuse and Exploding Kitten cannot be played directly
   - Cat cards: opens combo modal if matching pair exists, otherwise plays individually
   - Favor: opens target selection modal
   - Other cards: played directly with effect resolution

2. **Card Play Flow**:
   - Removes card from hand → adds to discard pile
   - Resolves effect via `CardEffects.resolveCardEffect()`
   - If `requiresNopeResolution`: opens Nope window with resolver callback
   - If `requiresUI`: modal is shown by UIRenderer (driven by `activeModal`)

3. **Draw Card Flow**:
   - Calls `TurnEngine.drawCard()`
   - If EK drawn: checks for Defuse in hand → opens defuse modal, or kills player
   - Calls `GameFlow.handleTurnEnd()` if available

4. **Nope Response**:
   - `true`: calls `Nope.playNope()` with player ID
   - `false`: closes nope window or advances hot-seat queue

5. **Combo Handling**:
   - Combo card toggle for multi-select
   - Submit validates via `Combo.detectCombo()`
   - Three-of-a-kind: opens naming modal
   - Two-of-a-kind: opens target selection
   - Five-different: opens discard browser

6. **Keyboard Shortcuts**:
   - `D` = Draw card
   - `S` = Skip (end turn)
   - `Escape` = Close active modal
   - Disabled when typing in inputs

7. **Validation Guards**:
   - Cannot act during nope window
   - Cannot act during active modal
   - Cannot act for AI players
   - Cannot act for dead players
   - Card must be in player's hand

### Dependencies
- Modules 3-10: GameState, Player, TurnEngine, CardEffects, Combo, Nope, AI, UIRenderer
- Module 11: HotSeat (optional, for nope queue)
- GameApp (for play again / screen management)
- GameFlow (optional, for turn end / player death / restart)

### Test Results
- **Test File**: `run-test-task10.js`
- **Tests**: 43/43 passed ✅
- **Coverage**: Module loading, init, card click (valid/invalid/defuse/EK/favor/cat/combo), draw click, end turn, nope response (true/false), target select, favor give, defuse place, combo submit/toggle, three-kind name, discard pick, play again, validation guards (nope window/modal/AI/dead player), missing data handling, multiple init calls

### Key Design Decisions
- Event delegation pattern: UIRenderer calls `Events.handleCardClick()` from card click handlers
- Nope resolver callback: `playCard()` stores resolver function in `Nope.openNopeWindow()`, called if action proceeds
- GameFlow integration is optional: Events checks `if (window.GameFlow)` before calling, allowing standalone testing
- Combo modal: cat cards with matching types open combo builder, single cat cards play individually
- Keyboard shortcuts only active on game screen, disabled in input fields