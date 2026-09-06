# Technical Documentation

Architecture, module breakdown, and design decisions for the Exploding Kittens browser game.

---

## Project Structure

```
exploding_kittens/
├── index.html                      # Single-page app — all screens & modals in one file
├── styles/
│   └── main.css                    # Dark theme, responsive layout, animations
├── js/
│   ├── app.js                      # Setup screen controller, screen navigation, modal close
│   └── modules/
│       ├── 01-constants.js         # Card definitions, deck composition, game config
│       ├── 02-deck.js              # Fisher-Yates shuffle, deck creation, EK/Defuse extraction
│       ├── 03-game-state.js        # Single source of truth — observer pattern + mutate()
│       ├── 04-player.js            # Player lifecycle, hand management, player queries
│       ├── 05-turn-engine.js        # Turn start/end, card drawing, attack mechanics
│       ├── 06-card-effects.js       # Card effect resolution (attack, skip, favor, etc.)
│       ├── 07-combo.js             # Combo detection & resolution (2-kind, 3-kind, 5-diff)
│       ├── 08-nope.js              # Nope counter-play system, stacking, auto-close
│       ├── 09-ai.js                # AI decision-making, difficulty levels, peek memory
│       ├── 10-ui-renderer.js       # DOM rendering — sole place that touches game-screen DOM
│       ├── 11-hotseat.js           # Pass-the-device mode, privacy screens, nope prompts
│       ├── 12-events.js            # User input handlers — clicks, keyboard, modal actions
│       ├── 13-flow.js              # Game lifecycle — init, turns, win condition, restart
│       └── 14-ai-controller.js     # AI turn execution — play, draw, nope integration
├── e2e/
│   ├── helpers.js                  # Shared test utilities (setup, assertions, helpers)
│   ├── 00-smoke.spec.js            # Page load verification
│   ├── 01-setup-screen.spec.js     # Setup screen interactions
│   ├── 02-game-screen-initial.spec.js  # Initial game state
│   ├── 03-gameplay-interactions.spec.js # Card play, draw, modals
│   ├── 04-nope-mechanic.spec.js    # Nope window, stacking, resolution
│   ├── 05-ai-turn-flow.spec.js     # AI turn timing, card play, draw
│   ├── 06-hotseat-mode.spec.js     # Hot-seat pass screens, privacy
│   ├── 07-win-gameover.spec.js     # Win condition, game over screen, restart
│   ├── 08-multiplayer-edge-cases.spec.js  # 2-5 players, eliminations, stability
│   ├── 09-game-actions.spec.js     # All card types, combos, defuse, EK
│   └── 10-corrected-mechanics.spec.js  # Attack stacking, skip under attack, five-diff nope
└── plan/                           # Implementation plans, code reviews, progress tracking
```

**Total:** ~7,350 lines of source + ~3,600 lines of E2E tests. 148 tests covering all game mechanics.

---

## Module System

### Loading Order

Modules are loaded via `<script>` tags in `index.html` in strict dependency order:

```
01-constants → 02-deck → 03-game-state → 04-player → 05-turn-engine →
06-card-effects → 07-combo → 08-nope → 09-ai → 10-ui-renderer →
11-hotseat → 12-events → 13-flow → 14-ai-controller → app.js
```

### IIFE Module Pattern

Each module is an Immediately Invoked Function Expression that attaches a frozen API to `window`:

```javascript
(function() {
    'use strict';

    // Private state and functions...

    // Public API (frozen — cannot be modified at runtime)
    window.ModuleName = Object.freeze({
        methodA,
        methodB
    });
})();
```

All modules use `const`/`let` (ES6). No `var` anywhere in the codebase.

---

## Module Reference

### Module 1 — Constants (`01-constants.js`)

Defines all static game data. No dependencies. Loaded first.

**Exports:**
- `window.CARD_TYPES` — 14 card type definitions (id, name, emoji, color, description, count, isCat, cornerIcon)
- `window.DECK_COMPOSITION` — Array of `{ type, count }` specifying the 56-card deck
- `window.COMBO_TYPES` — Three combo definitions (two_of_a_kind, three_of_a_kind, five_different)
- `window.GAME_CONFIG` — Game constants (player limits, attack turns, peek count, nope window duration, phase names, debug flag)
- `window.debug()` — Logging function that only outputs when `GAME_CONFIG.DEBUG === true`

**Key constants:**
```javascript
GAME_CONFIG = {
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 5,
    STARTING_HAND_SIZE: 5,      // 4 cards + 1 Defuse
    PEEK_CARD_COUNT: 3,
    NOPE_WINDOW_DURATION_MS: 5000,
    DEBUG: false,
    PHASES: { SETUP, ACTIVE, NOPE_WINDOW, DEFUSE_PLACEMENT, PEEK, GAME_OVER }
}
```

### Module 2 — Deck (`02-deck.js`)

Deck creation and shuffle logic. Depends on Module 1.

**Exports:**
- `window.shuffle(array)` — Fisher-Yates shuffle, returns new array (non-mutating)
- `window.createDeck(playerCount)` — Creates 56-card deck with unique instance IDs
- `window.removeExplodingKittens(deck)` — Separates EKs from deck for setup
- `window.removeDefuses(deck)` — Separates Defuses for initial dealing

**Card instance format:**
```javascript
{
    instanceId: 'tacocat-3',   // Unique per card instance
    type: 'tacocat',
    emoji: '🌮',
    name: 'Tacocat',
    cornerIcon: 'taco'         // null for non-cat cards
}
```

### Module 3 — Game State (`03-game-state.js`)

Single source of truth for all game data. Observer pattern for reactive UI. Depends on Module 1.

**Exports:**
| Method | Purpose |
|--------|---------|
| `getState()` | Returns the live state object (not a copy) |
| `mutate(fn)` | Calls `fn(state)` with live state, then notifies observers |
| `setState(updates)` | Shallow-merge top-level fields, notifies if changed |
| `setStateProperty(path, value)` | Set nested property via dot-notation |
| `getStateProperty(path)` | Get nested property via dot-notation |
| `subscribe(callback)` | Register observer — called on every state change |
| `reset()` | Reinitialize state to defaults, keep observers |
| `logAction(action)` | Append to action log, notify observers |
| `getStateSummary()` | Debug snapshot of key state fields |

**State management patterns:**
- **`mutate(fn)`** — For read-modify-write patterns. Always notifies observers. Used for hand changes, discard pile, card transfers.
- **`setState(updates)`** — For simple top-level field updates (e.g., `activeModal`, `turnPhase`). Only notifies if value actually changed.
- **`getState()`** — Returns the live object. Safe for read-only access. Never call `setState` with values read from `getState` for the same field — use `mutate` instead.

**Game state fields:**
```javascript
{
    gamePhase: 'setup',           // 'setup' | 'active' | 'game-over'
    players: [],                  // Array of player objects
    currentPlayerIndex: 0,
    drawPile: [],                 // Cards in deck (pop() takes from end = top)
    discardPile: [],
    turnPhase: 'action',          // 'action' | 'nope-window' | 'defuse-placement' | 'peek'
    cardsPlayed: [],              // Instance IDs played this turn
    attackTurnsRemaining: 0,      // Current player's remaining attack turns
    pendingAttackForNext: 0,      // Turns to pass when next player starts
    nopeWindowActive: false,
    activeModal: null,            // 'peek-modal' | 'defuse-modal' | 'combo-modal' | etc.
    modalData: {},                // Context for the active modal
    actionLog: [],
    lastAction: null
}
```

### Module 4 — Player (`04-player.js`)

Player creation, hand management, and player queries. Depends on Modules 1, 3.

**Exports:**
| Method | Purpose |
|--------|---------|
| `createPlayer(id, name, isAI)` | Create player object with empty hand |
| `addCardToHand(playerId, card)` | Push card to player's hand via `mutate()` |
| `removeCardFromHand(playerId, instanceId)` | Splice card from hand, return removed card |
| `findCardInHand(playerId, type)` | Find first card of type in hand |
| `getCardCountByType(playerId, type)` | Count cards of type |
| `getHandSize(playerId)` | Get hand length |
| `killPlayer(playerId)` | Set `isAlive = false`, log elimination |
| `getActivePlayer()` | Get current player object |
| `getNextAlivePlayerIndex()` | Next alive player after `currentPlayerIndex` |
| `getNextAlivePlayerAfter(playerId)` | Next alive player after any specific player |
| `getAlivePlayers()` | Array of alive players |
| `getOtherAlivePlayers(excludeId)` | Alive players excluding one |
| `getPlayerById(playerId)` | Get player by index |

**Player object format:**
```javascript
{
    id: 0,
    name: 'Player 1',
    isAI: false,
    isHuman: true,
    isAlive: true,
    hand: [],                    // Array of card instances
    turnCount: 0,
    stats: { cardsPlayed, cardsDrawn, combosUsed, nopesPlayed, timesEliminated }
}
```

### Module 5 — Turn Engine (`05-turn-engine.js`)

Turn lifecycle and card drawing. Depends on Modules 1, 3, 4.

**Exports:**
| Method | Purpose |
|--------|---------|
| `startTurn(playerId)` | Set current player, apply pending attack, reset turn state |
| `endTurn()` | Log turn end, advance to next player |
| `drawCard(playerId)` | Pop from draw pile; if EK, check defuse or kill; else add to hand |
| `placeExplodingKitten(ekCard, position)` | Insert EK at position in draw pile |
| `getTurnPhase()` / `setTurnPhase(phase)` | Read/write turn phase |
| `activateAttack(turns)` | Set `pendingAttackForNext` (applied when next player starts) |
| `deactivateAttack()` | Reset attack state to 0 |
| `isUnderAttack()` | Returns `attackTurnsRemaining > 0` |
| `openNopeWindow(card)` / `closeNopeWindow()` | Set/clear nope window state |
| `getTurnSummary()` | Debug snapshot of turn state |

**Draw pile convention:** `drawPile[drawPile.length - 1]` is the **top** of the deck (next to be drawn). `pop()` draws from the top. `slice(-3).reverse()` gives the top 3 in draw order.

### Module 6 — Card Effects (`06-card-effects.js`)

Routes card plays to effect handlers. Depends on Modules 1, 3, 4, 5.

**Exports:**
| Method | Purpose |
|--------|---------|
| `resolveCardEffect(cardType, playerId, targetId)` | Dispatch to handler, return effect result |
| `getEffectDescription(cardType)` | Human-readable description string |

**Effect result format:**
```javascript
{
    success: true,
    effectType: 'attack',
    requiresNopeResolution: true,   // If true, caller must open nope window
    requiresUI: false,              // If true, effect sets a modal in state
    description: '...'
}
```

**Handlers:** `handleAttack`, `handleSkip`, `handleFavor`, `handleShuffle`, `handleSeeTheFuture`, `handleDefuse`, `handleNope`.

### Module 7 — Combo (`07-combo.js`)

Combo detection and resolution. Depends on Modules 1, 3, 4.

**Exports:**
| Method | Purpose |
|--------|---------|
| `detectCombo(cards)` | Check if cards form a valid combo, return combo info |
| `resolveCombo(comboInfo, playerId, targetId, namedCard)` | Execute combo effect |
| `removeComboCards(playerId, instanceIds)` | Remove played cards from hand, add to discard |
| `pickFromDiscard(playerId, instanceId)` | Take card from discard (Five Different) |
| `canComboBeNoped(comboInfo)` | All combos return `true` (per official rules) |
| `getComboDescription(comboInfo)` | Human-readable description |

### Module 8 — Nope (`08-nope.js`)

Nope counter-play system with stacking and auto-close. Depends on Modules 1, 3, 4, 5, 9.

**Exports:**
| Method | Purpose |
|--------|---------|
| `openNopeWindow(action)` | Start nope resolution with resolver + onComplete callbacks |
| `playNope(playerId)` | Player plays a Nope card, pushed to nope stack |
| `closeNopeWindow()` | Resolve: odd nopes = cancelled, even = proceeds (resolver called) |
| `forceCloseNopeWindow()` | Close without resolution (e.g., restart) |
| `isActionNoped()` | `nopeStack.length % 2 === 1` |
| `canPlayerNope(playerId)` | Has Nope card, is alive, not self-noping |
| `getEligibleNopePlayers()` | Array of `{ id, name }` who can nope |
| `handleNopeResponse(wantNope, playerId)` | UI callback for human nope decision |

**Internal state:**
- `pendingAction` — The action awaiting resolution (with `resolver` and `onComplete` callbacks)
- `nopeStack` — Array of played Nope cards
- `autoCloseTimeout` — AI nope check timer
- `windowExpiryTimeout` — Hard 5-second timeout fallback

**Flow:**
1. `openNopeWindow({ resolver, onComplete, ... })` stores pending action
2. `scheduleAINopeChecks()` asks AI players if they want to nope
3. Human players can click Nope/Let It Happen
4. `closeNopeWindow()` — if odd nopes, action cancelled (resolver NOT called); if even, resolver called
5. `onComplete(result)` always called (noped or not) — used by AI to schedule next action

### Module 9 — AI (`09-ai.js`)

AI decision-making with three difficulty levels. Depends on Modules 1, 3, 4, 5, 6, 7.

**Exports:**
| Method | Purpose |
|--------|---------|
| `setDifficulty(level)` | Set 'easy' | 'medium' | 'hard' |
| `aiTakeTurn(playerId)` | Get decision: `{ action: 'play'|'draw', cardType, ... }` |
| `getAIDecision(playerId)` | Same as aiTakeTurn (main decision logic) |
| `getAINopeDecision(playerId, action)` | Returns `true` to nope, `false` to allow |
| `aiChooseFavorCard(playerId)` | Returns instance ID of least valuable card to give |
| `aiChooseDefusePosition(deckSize)` | Returns position index for EK placement |
| `aiNameCardForThreeOfKind(playerId)` | Returns card type to steal |
| `rememberPeekedCards(playerId, cards)` | Store top-3 in private memory |
| `clearPeekMemory(playerId)` | Clear memory (on draw, shuffle, or death) |

**Decision priorities (Medium):**
1. Survival — if EK is on top, play Skip or Attack
2. Disruption — Attack when next player has few cards
3. Info — See the Future when deck is small
4. Card advantage — Favor on player with most cards
5. Combos — Two/Three of a Kind
6. Skip when deck is dangerous

**Hard AI enhancements:**
- Tracks EK probability (remaining EKs / draw pile size)
- Prioritizes survival when probability > 30%
- Plays Shuffle when deck is unfavorable
- Checks discard pile for card counting

### Module 10 — UI Renderer (`10-ui-renderer.js`)

Sole place that manipulates game-screen DOM. Subscribes to GameState. Depends on Modules 1, 3.

**Exports:**
| Method | Purpose |
|--------|---------|
| `init()` | Cache DOM references, subscribe to GameState |
| `render(state, changes)` | Main render — dispatches to sub-renderers |
| `renderCard(card, options)` | Create DOM element for a card |
| `forceRender()` | Trigger a manual re-render |
| `getDefusePosition()` | Read defuse slider value |
| `getSelectedComboCards()` | Read combo modal selection |
| `getSelectedCardName()` | Read three-of-a-kind naming dropdown |

**Rendering flow:**
```
GameState.setState() or GameState.mutate()
    → notifyObservers()
    → UIRenderer.render(state)
        → renderGameOver(state)     if gamePhase === 'game-over'
        → renderGameScreen(state)   if gamePhase === 'active'
            → renderDeckInfo, renderDiscardPile, renderOpponents
            → renderPlayerHand, renderLog
        → renderModals(state)       always (driven by activeModal)
```

**Modal management:** `renderModals()` is the **only** place that adds/removes `modal--active` CSS classes. All other code changes modal state via `GameState.setState({ activeModal })`.

### Module 11 — Hot-Seat (`11-hotseat.js`)

Pass-the-device multiplayer. Depends on Modules 3, 8, 10.

**Exports:**
| Method | Purpose |
|--------|---------|
| `setHotSeatMode(enabled)` | Toggle hot-seat mode |
| `isHotSeatMode()` | Check if hot-seat is active |
| `onTurnStart(playerId)` | Show pass screen, hide hand |
| `showPassScreen()` / `hidePassScreen()` | Privacy screen control |
| `onFavorRequest(targetId, requesterId)` | Show give-card screen for target player |
| `handleNopeResponse(wantNope)` | Route nope through hot-seat player queue |
| `reset()` | Clear hot-seat state |

### Module 12 — Events (`12-events.js`)

User input handlers. Depends on most modules. Depends on Modules 3-10, 13, 14.

**Exports:**
| Method | Purpose |
|--------|---------|
| `init()` | Attach all DOM event listeners |
| `handleCardClick(instanceId)` | Card in hand clicked — play or open combo modal |
| `handleDrawClick()` | Draw button — draw card, end turn |
| `handleEndTurnClick()` | End turn button — draw if no cards played, else end |
| `handleTargetSelect(targetId)` | Favor/combo target selected |
| `handleNopeResponse(wantNope, playerId)` | Nope button click |
| `handleDefusePlace()` | Confirm defuse placement |
| `handleFavorGive(instanceId)` | Target gives card in favor |
| `handleComboSubmit()` | Submit combo selection |
| `handleComboCardToggle(instanceId)` | Toggle card in combo builder |
| `clearComboSelection()` | Clear combo modal state |
| `handleThreeKindName()` | Submit named card for three-of-a-kind |
| `handleDiscardPick(instanceId)` | Pick card from discard (five different) |
| `handlePlayAgain()` | Restart game |

### Module 13 — Game Flow (`13-flow.js`)

Game lifecycle controller. Depends on most modules. Depends on Modules 1-12, 14.

**Exports:**
| Method | Purpose |
|--------|---------|
| `initGame(config)` | Full setup: reset, create players, build deck, deal, start |
| `startTurn(playerId)` | Dispatch to AI controller or wait for human input |
| `handleTurnEnd()` | Check win, handle attack turns, advance to next player |
| `handlePlayerDeath(playerId)` | Log, clear peek memory, check win, advance turn |
| `checkWinCondition()` | If ≤1 alive player, end game |
| `endGame(winner)` | Set game-over state, render |
| `restartGame()` | Reset all modules, return to setup |
| `executeEffect(effectResult, playerId)` | Open nope window or execute effect directly |
| `handleHotSeatTransition(playerId)` | Delegate to HotSeat module |

### Module 14 — AI Controller (`14-ai-controller.js`)

AI turn execution. Depends on Modules 1, 3-9, 13.

**Exports:**
| Method | Purpose |
|--------|---------|
| `handleAITurn(playerId)` | 1.5s delay, get AI decision, dispatch to play or draw |
| `executeAIPlay(playerId, decision)` | Play card/combo, handle nope window, schedule next |
| `executeAIDraw(playerId)` | Draw card, handle EK (defuse or explode) |
| `scheduleNextAIAction(playerId)` | Re-evaluate AI decision — play more or draw (max 3 plays/turn) |
| `handleEffectPost(effectResult, playerId)` | Post-resolution: shuffle deck, AI peek memory |

**AI multi-card flow:**
```
handleAITurn → 1.5s delay → AI decision
  ├─ play → executeAIPlay → card/combo
  │   ├─ nopeable → openNopeWindow → onComplete → scheduleNextAIAction
  │   └─ not nopeable → handleEffectPost → scheduleNextAIAction
  └─ draw → executeAIDraw → handleTurnEnd

scheduleNextAIAction → 1.5s delay → check max plays → AI decision
  ├─ play → executeAIPlay (loop)
  └─ draw → executeAIDraw → handleTurnEnd
```

### App Controller (`app.js`)

Setup screen controller. Loaded last.

**Exports:**
| Method | Purpose |
|--------|---------|
| `showScreen(screenId)` | Switch between setup/game/game-over screens |
| `resetToSetupScreen()` | Reset setup state, show setup screen |
| `closeModal(modalId)` | Close modal via state update (UIRenderer handles DOM) |
| `getSetupState()` | Returns copy of setup config |
| `startGame()` | Pass config to GameFlow.initGame() |

---

## Data Flow

### Game Initialization

```
app.js startGame()
  → GameFlow.initGame(config)
    → GameState.reset()
    → Player.createPlayer() for each player
    → createDeck() → removeExplodingKittens() → removeDefuses() → shuffle()
    → GameState.setState({ players, drawPile, gamePhase: 'active', ... })
    → Player.addCardToHand() × 5 per player (4 cards + 1 Defuse)
    → Reinsert EKs and remaining Defuses, shuffle
    → UIRenderer.init() → Events.init()
    → startTurn(firstPlayerIndex)  // Human (0) in AI mode, random in hot-seat
```

### Human Turn

```
User clicks card → Events.handleCardClick()
  → validateTurn() — check it's human's turn, no modal open
  → Player.removeCardFromHand() → GameState.mutate() to discard
  → CardEffects.resolveCardEffect()
  → If requiresNopeResolution:
      → Nope.openNopeWindow({ resolver })
      → AI nope checks (1s delay) → human can respond
      → Nope.closeNopeWindow()
        → If not noped: resolver() — handleEffectUI, turn end for skip/attack
        → If noped: effect cancelled
  → GameState.mutate() to track in cardsPlayed
  → Observer fires → UIRenderer.render() updates DOM

User clicks Draw → Events.handleDrawClick()
  → TurnEngine.drawCard()
    → Pop from drawPile
    → If EK: check Defuse → open defuse modal OR kill player
    → If normal: add to hand
  → GameFlow.handleTurnEnd() → advance to next player
```

### AI Turn

```
GameFlow.startTurn(aiPlayerId)
  → AIController.handleAITurn(playerId)
    → 1.5s delay
    → AI.aiTakeTurn() → decision { action: 'play'|'draw', ... }
    → If play: executeAIPlay()
        → Remove card, resolve effect
        → If nopeable: openNopeWindow() → onComplete → scheduleNextAIAction()
        → If not: handleEffectPost() → scheduleNextAIAction()
    → If draw: executeAIDraw()
        → TurnEngine.drawCard() → handle EK → handleTurnEnd()

scheduleNextAIAction()
  → 1.5s delay
  → Check max 3 plays → AI.aiTakeTurn() again
  → Loop back to executeAIPlay or executeAIDraw
```

### Modal Flow

```
Open: GameState.setState({ activeModal: 'peek-modal', modalData: {...} })
  → Observer fires → UIRenderer.renderModals()
  → Adds 'modal--active' class, populates content

Close (user): app.js closeModal() → GameState.setState({ activeModal: null })
  → Observer fires → UIRenderer.renderModals()
  → Removes 'modal--active' class

Close (escape key): Events handleKeyboard() → same state update
Close (code): GameState.setState({ activeModal: null, modalData: {} })
```

---

## State Management

### Three Access Patterns

| Pattern | When to use | Notifies? |
|---------|------------|-----------|
| `getState()` | Read-only access to live state | No |
| `mutate(fn)` | Read-modify-write (e.g., push to array, modify nested object) | Always |
| `setState(updates)` | Simple top-level field replacement | Only if value changed |

### Observer Pattern

`UIRenderer.init()` calls `GameState.subscribe(render)`. Every `setState` or `mutate` call triggers `render(state)`, which dispatches to sub-renderers. This is the only way the DOM updates.

### Game State Shape

See Module 3 reference above for the full state object. Key design decisions:

- **`gamePhase`** — Single field: `'setup' | 'active' | 'game-over'`. No separate `gameStatus`.
- **`turnPhase`** — `'action'` is the main phase. Transient phases: `'nope-window'`, `'defuse-placement'`, `'peek'`.
- **`drawPile`** — Array where the last element is the top (next to draw). `pop()` draws, `slice(-3).reverse()` peeks.
- **`pendingAttackForNext`** — When a player plays Attack, this stores turns to pass. Applied when the next player's turn starts via `startTurn()`.
- **`activeModal`** — Single field drives all modal visibility. `modalData` holds context.

---

## Attack Mechanics

### Attack Stacking (Official Rules)

1. Player A plays Attack → `pendingAttackForNext = 2` (or `remaining - 1 + 2` if under attack)
2. A's turn ends → advance to next player B
3. `startTurn(B)` applies `pendingAttackForNext` → `attackTurnsRemaining = 2`
4. B takes a turn (draw or play)
5. `handleTurnEnd()`:
   - If `attackTurnsRemaining > 1`: decrement, same player goes again
   - If `attackTurnsRemaining ≤ 1`: reset to 0, advance to next player

### Skip Under Attack

Playing Skip while under attack ends ONE turn. `handleTurnEnd()` naturally decrements `attackTurnsRemaining`. If turns remain, same player goes again. Skip does NOT cancel the entire attack.

---

## Nope System

### Stacking Rules

- Each Nope card played toggles the action state
- Odd number of Nopes → action CANCELLED
- Even number of Nopes (including 0) → action PROCEEDS
- Players cannot nope their own action (first nope only)
- Players cannot nope their own nope (consecutive)

### Timeout Fallback

- `windowExpiryTimeout` auto-closes after `NOPE_WINDOW_DURATION_MS` (5 seconds)
- Timer resets when someone plays a Nope (new window for counter-nopes)
- Prevents game from hanging if human doesn't respond

### AI Nope Integration

When AI plays a nopeable card:
1. `AIController.executeAIPlay()` opens nope window
2. Human sees nope modal with "Nope!" / "Let It Happen" buttons
3. AI nope checks scheduled after 1s delay
4. `onComplete` callback always fires — schedules next AI action regardless of outcome

---

## Testing

### Framework

Playwright E2E tests. 148 tests across 11 spec files. Tests run in Chromium.

### Shared Helpers (`e2e/helpers.js`)

| Helper | Purpose |
|--------|---------|
| `gotoGame(page)` | Navigate to game, wait for setup screen |
| `startGame(page, options)` | Configure and start a game via UI interaction |
| `waitForHumanTurn(page)` | Wait for draw button to be enabled |
| `setupControlledGame(page, options)` | Inject specific hand/deck state via `mutate()` |
| `getGameState(page)` | Snapshot of key state fields |
| `dismissNopeIfPresent(page)` | Click "Let It Happen" if nope modal appears |
| `getCurrentPlayerIndex(page)` | Read `currentPlayerIndex` |
| `getHandCardTypes(page)` | Array of card types in human's hand |
| `getCurrentPlayerName(page)` | Read player name display |

### Test Strategy

Tests use `page.evaluate()` to call `window.GameState.mutate()` for controlled state setup. This allows testing specific card combos and scenarios without relying on random deck order. Tests use polling loops for timing-dependent assertions (nope resolution, AI turns).

---

## Debugging

### Enable Debug Logging

Set `GAME_CONFIG.DEBUG = true` in `js/modules/01-constants.js` before loading the page. This enables all `window.debug()` calls throughout the codebase.

`console.error` (66 calls) and `console.warn` (14 calls) always output regardless of the debug flag.

### Inspect Game State

Open browser DevTools console and access state directly:

```javascript
window.GameState.getState()                    // Full state object
window.GameState.getStateSummary()              // Compact summary
window.Nope.getNopeSummary()                    // Nope system state
window.TurnEngine.getTurnSummary()              // Turn state
window.AI.getPeekMemory(1)                      // AI player 1's peek memory
```

---

## Coding Conventions

- **Module pattern** — IIFE with `Object.freeze()` on public API
- **Variables** — `const` for constants, `let` for mutables. No `var`.
- **Naming** — `camelCase` for functions/variables, `UPPER_SNAKE_CASE` for constants
- **State access** — `mutate(fn)` for modifications, `getState()` for reads
- **Error handling** — `console.error` for errors, `console.warn` for warnings, `window.debug()` for info
- **DOM manipulation** — Only in `10-ui-renderer.js` (game screen) and `app.js` (setup screen)
- **Modals** — State-driven via `activeModal` field. Only `renderModals()` touches modal CSS classes.