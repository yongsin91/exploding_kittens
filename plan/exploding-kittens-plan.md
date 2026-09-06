# Exploding Kittens — HTML Game Implementation Plan

## Overview

A single-file HTML game implementing the Exploding Kittens Original Edition (base 56-card deck + special combos). Supports two modes: **single-player vs AI bots** and **local hot-seat multiplayer**. Visual style uses emoji + CSS (no external assets). Single HTML file with logically separated `<script>` sections for each module.

---

## Game Rules Summary (verified from official + UltraBoardGames sources)

### Deck Composition (56 cards)
| Card Type | Count | Effect |
|---|---|---|
| Exploding Kitten | 4 | Draw it → die unless you have a Defuse. Place kitten back in deck if defused. |
| Defuse | 6 | Play when you draw an Exploding Kitten → place kitten back in deck secretly. |
| Nope | 5 | Cancel any action (except Exploding Kitten / Defuse). Can Nope a Nope. Playable on anyone's turn before action resolves. |
| Attack | 4 | End your turn without drawing. Next player takes 2 turns. Stacking Attack passes 2+N turns. |
| Skip | 4 | End your turn without drawing. Defending vs Attack: each Skip cancels 1 turn. |
| Favor | 4 | Force any player to give you 1 card (they choose which). |
| Shuffle | 4 | Shuffle the draw pile. |
| See the Future | 5 | Peek at top 3 cards of draw pile, put them back in same order. |
| Cat Cards (5 types × 4 each) | 20 | Powerless alone. Played as pairs/combos. |

### Cat Card Types (5 types, 4 each = 20 cards)
| Cat Type | Emoji | Corner Icon Name |
|---|---|---|
| Tacocat | 🌮 | taco |
| Cattermelon | 🍉 | melon |
| Hairy Potato Cat | 🥔 | potato |
| Beard Cat | 🧔 | beard |
| Rainbow-Ralphing Cat | 🌈 | rainbow |

### Special Combos
| Combo | Requirement | Effect |
|---|---|---|
| Two of a Kind | 2 cards with same corner icon | Steal 1 random card from any player |
| Three of a Kind | 3 cards with same corner icon | Name a card → steal that specific card from any player (if they have it) |
| 5 Different Cards | 5 cards, all different corner icons | Search discard pile, take any 1 card |

### Turn Structure
1. Play any number of cards (or none) from hand → place played cards in discard pile
2. End turn by drawing 1 card from top of draw pile
3. If drawn card is Exploding Kitten → must defuse or die
4. Play continues clockwise

### Setup
1. Remove all Exploding Kitten + Defuse cards from deck
2. Shuffle remaining deck, deal 4 cards + 1 Defuse to each player (5 cards total)
3. Insert (N-1) Exploding Kittens back into deck (N = number of players)
4. Insert remaining Defuse cards back into deck
5. Shuffle deck, place face-down as draw pile
6. Random first player

### Win Condition
Last player standing (not exploded) wins.

---

## Architecture: Module Breakdown

The single HTML file is organized into these logical modules, each as a separate `<script>` section:

```
exploding-kittens.html
├── <style>          → CSS module (all visual styling)
├── <body>           → HTML structure (screens, card containers)
├── <script> MODULE 1: Constants & Card Definitions
├── <script> MODULE 2: Deck & Shuffle Logic
├── <script> MODULE 3: Game State Manager
├── <script> MODULE 4: Player Manager
├── <script> MODULE 5: Turn Engine
├── <script> MODULE 6: Card Effect Resolver
├── <script> MODULE 7: Combo Resolver
├── <script> MODULE 8: Nope/Counter-Play System
├── <script> MODULE 9: AI Opponent Logic
├── <script> MODULE 10: UI Renderer
├── <script> MODULE 11: Hot-Seat Mode Controller
├── <script> MODULE 12: Event Handler / Input Controller
├── <script> MODULE 13: Game Flow Controller (init, win/lose, restart)
```

---

## Module Specifications

### MODULE 1: Constants & Card Definitions

**Input:** None (static definitions)

**Output:**
- `CARD_TYPES` — object mapping each card type to `{ id, name, emoji, color, description, count, isCat, cornerIcon }`
- `DECK_COMPOSITION` — array specifying exact deck contents (56 cards)
- `GAME_CONFIG` — constants: `TURNS_PER_ATTACK=2`, `NOPE_WINDOW_MS=5000` (hot-seat), `PEEK_COUNT=3`
- `COMBO_TYPES` — definitions for Two-of-a-Kind, Three-of-a-Kind, 5-Different

**Logic:**
- Define all 9 card types + 5 cat sub-types with metadata
- Each card instance gets a unique `instanceId` (generated at deck creation time)
- Corner icon names defined for combo-matching logic: `['taco','melon','potato','beard','rainbow']`

---

### MODULE 2: Deck & Shuffle Logic

**Input:** `DECK_COMPOSITION` (from Module 1), `playerCount` (integer 2-5)

**Output:**
- `createDeck(playerCount)` → returns a shuffled 56-card array (each card: `{ instanceId, type, cornerIcon }`)
- `shuffle(array)` → returns a new shuffled array (Fisher-Yates)
- `removeExplodingKittens(deck)` → returns `{ cleanDeck, removedKittens }`
- `insertExplodingKittens(deck, count)` → returns deck with kittens inserted + shuffled
- `removeDefuses(deck)` → returns `{ cleanDeck, removedDefuses }`
- `insertDefuses(deck, count)` → returns deck with defuses inserted + shuffled

**Logic:**
1. Generate 56 card instances from DECK_COMPOSITION with unique IDs
2. Fisher-Yates shuffle implementation
3. Setup sequence: remove EK + Defuse → shuffle rest → deal 4+1Defuse to each → insert (N-1) EK → insert remaining Defuses → final shuffle

---

### MODULE 3: Game State Manager

**Input:** Game configuration from setup screen (player count, mode, player names)

**Output:**
- `gameState` object:
  ```
  {
    mode: 'ai' | 'hotseat',
    players: Player[],
    drawPile: Card[],
    discardPile: Card[],
    currentPlayerIndex: int,
    direction: 1 | -1,         // clockwise/counter (Reverse not in base game, reserved)
    turnPhase: 'play' | 'draw' | 'nope-window' | 'defuse-placement' | 'peek' | 'game-over',
    pendingAction: Action | null,  // action waiting for Nope resolution
    nopeStack: Card[],          // stack of Nope cards played in response
    attackTurnsRemaining: int[], // per player: extra turns queued
    winner: Player | null,
    log: LogEntry[]
  }
  ```
- `getState()`, `setState(partial)`, `resetState()`
- State change observer pattern: `subscribe(callback)` → called on every state change

**Logic:**
- Single source of truth for all game state
- Immutable updates: `setState` merges partial into existing state, triggers observers
- Log entry format: `{ timestamp, player, action, description }`

---

### MODULE 4: Player Manager

**Input:** `gameState.players` array, player setup config

**Output:**
- `createPlayer(id, name, isAI, isHuman)` → returns `Player` object:
  ```
  {
    id, name, isAI, isHuman,
    hand: Card[],
    isAlive: boolean,
    turnsRemaining: int,   // usually 1, >1 if attacked
    defusesUsed: int
  }
  ```
- `getActivePlayer()` → current player object
- `getNextAlivePlayerIndex()` → next living player index (clockwise)
- `removeCardFromHand(playerId, instanceId)` → updated player
- `addCardToHand(playerId, card)` → updated player
- `killPlayer(playerId)` → mark dead, discard hand
- `getAlivePlayers()` → filtered array
- `getOtherAlivePlayers(excludeId)` → for targeting

**Logic:**
- Hand management (add/remove/search cards)
- Player elimination (dead → `isAlive=false`, hand goes to discard)
- Turn counting for Attack mechanics

---

### MODULE 5: Turn Engine

**Input:** `gameState`, player actions (play card / draw card / end turn)

**Output:**
- `startTurn()` → set phase to 'play', notify current player
- `endTurn()` → advance to next player, handle attack turns
- `drawCard(playerId)` → returns drawn card; if Exploding Kitten → trigger defuse flow
- `advanceToNextPlayer()` → skip dead players, handle turn count
- `getTurnPhase()` → current phase

**Logic:**
1. **Turn start:** `turnPhase = 'play'`, current player can play cards or directly draw
2. **Playing cards:** call Card Effect Resolver (Module 6) or Combo Resolver (Module 7). After effect resolves, player can play more cards or end turn by drawing.
3. **Drawing (end of turn):**
   - Pop top card from draw pile
   - If Exploding Kitten: `turnPhase = 'defuse'` → player must play Defuse or die
   - If Defuse played: player places EK back in deck (secretly, via UI picker) → turn ends
   - If no Defuse: player dies → `killPlayer()` → check win condition
   - If other card: add to hand → turn ends
4. **Attack handling:** if current player has `turnsRemaining > 1`, decrement and let them play again. If `turnsRemaining == 1`, advance to next player.
5. **Skip handling:** Skip card ends current turn without drawing. If under Attack, each Skip ends 1 of the 2 turns.
6. **Advance logic:** find next alive player, set `currentPlayerIndex`, reset their `turnsRemaining` (unless they have queued attack turns).

---

### MODULE 6: Card Effect Resolver

**Input:** `cardType` (string), `playerId` (who played it), `targetId` (optional, for Favor)

**Output:** Effect result object: `{ success, effectType, data, requiresNopeResolution }`

**Logic — per card type:**

| Card | Effect Logic |
|---|---|
| **Defuse** | Only playable when drew Exploding Kitten. Play → enter `defuse-placement` phase → player picks position in draw pile to insert EK → resume |
| **Nope** | Not resolved here — handled by Module 8 (Nope System). Played as a reaction. |
| **Attack** | End current turn without drawing. Set `next player's turnsRemaining = 2` (or +2 if already under attack). Advance turn. |
| **Skip** | End current turn without drawing. If under attack (turnsRemaining > 1), decrement by 1. |
| **Favor** | Open target picker (choose another alive player). Target must give 1 card (they choose which). Transfer card to requester. |
| **Shuffle** | `shuffle(drawPile)`. No targeting. |
| **See the Future** | Enter `peek` phase. Show top 3 cards to current player only (modal/overlay). Player acknowledges → return to play phase. |
| **Exploding Kitten** | Not playable from hand — only encountered via draw. Handled by Turn Engine. |
| **Cat Cards** | Not resolved here — handled by Combo Resolver (Module 7). No individual effect. |

Each effect (except Defuse, Exploding Kitten) is subject to Nope resolution before executing.

---

### MODULE 7: Combo Resolver

**Input:** `cardsPlayed[]` (array of card instances), `playerId`, `targetId`

**Output:** Effect result, same shape as Module 6

**Logic:**
1. **Detect combo type:**
   - Extract corner icons from played cards
   - If 2 cards, same icon → **Two of a Kind**
   - If 3 cards, same icon → **Three of a Kind**
   - If 5 cards, all different icons → **5 Different Cards**
   - Else → invalid combo, reject
2. **Two of a Kind:**
   - Target picker → steal 1 random card from target's hand
   - Random selection: `Math.floor(Math.random() * target.hand.length)`
   - Transfer card to player
3. **Three of a Kind:**
   - Target picker → name a card type → search target's hand for matching card
   - If found → take it. If not → get nothing (combo still consumed)
4. **5 Different Cards:**
   - Open discard pile viewer (modal showing all discarded cards)
   - Player picks 1 card → add to hand
   - Must resolve before Nope window (per rules: "Grab the Pile quickly")
5. All combos are subject to Nope resolution (another player can Nope the combo).

---

### MODULE 8: Nope / Counter-Play System

**Input:** `pendingAction` (the action being Noped), `nopeStack`

**Output:** `{ resolved: boolean, actionCancelled: boolean }`

**Logic:**
1. When any action card is played (Attack, Skip, Favor, Shuffle, See the Future, or combo), before resolving:
   - Set `turnPhase = 'nope-window'`
   - Store action in `pendingAction`
   - Start Nope window (timed in AI mode, button-based in hot-seat)
2. Any other alive player (not the one who played the original card) can play a Nope card
3. The original player (or any other player) can play a Nope on the Nope → creates a "Yup" (negates the negate)
4. Nope stack resolution:
   - Odd number of Nopes → action is **cancelled**
   - Even number of Nopes (including 0) → action **proceeds**
5. After Nope window closes:
   - If cancelled → cards go to discard, no effect
   - If not cancelled → execute the pending action via Module 6/7
   - Clear `nopeStack` and `pendingAction`
6. **Nope timing (AI mode):** AI players evaluate whether to Nope based on heuristics (see Module 9). Resolution after all AI decisions + short delay.
7. **Nope timing (hot-seat):** Show "Any player want to Nope?" prompt. Each player can press their Nope button. Timer-based (configurable, default 5 seconds) or "Continue" button to skip.

---

### MODULE 9: AI Opponent Logic

**Input:** `gameState`, current AI player's hand, visible game info (deck size, other players' hand sizes, discard pile)

**Output:** AI decision: `{ action: 'play' | 'draw', cards: Card[], targetType?: string, targetId?: int, nopeDecision?: boolean }`

**Logic:**
1. **Decision: Nope or not?** (when another player plays an action)
   - Always Nope a Favor targeting self (don't want to lose a card)
   - Always Nope an Attack targeting self
   - 50% chance to Nope See the Future (disrupt info advantage)
   - Never Nope Shuffle (doesn't hurt AI directly)
   - 30% chance to Nope a combo targeting self
   - Never Nope if no Nope cards in hand
2. **Decision: What to play on turn?**
   - **Priority 1 — Survival:** If knows EK is on top (via See the Future), play Skip or Attack to avoid drawing it
   - **Priority 2 — Disruption:** If has Attack, use it when next player has few cards (low chance of having Defuse)
   - **Priority 3 — Info:** Play See the Future if deck size is small and unknown
   - **Priority 4 — Card advantage:** Play Favor on player with most cards
   - **Priority 5 — Combos:** If has 2+ matching cat cards, play Two of a Kind to steal from player with most cards
   - **Priority 6 — Shuffle:** If saw EK coming and can't Skip/Attack, play Shuffle
   - **Default:** Draw a card (end turn)
3. **Defuse placement:** If drew EK and has Defuse:
   - Place EK at random position in deck (not top, not bottom)
   - Higher difficulty: place EK near top if next player has no Defuse (track defuses played)
4. **Favor response:** When forced to give a card, give the least valuable (prefer giving cat card over action card)
5. **Three of a Kind naming:** Name the card the AI most wants (prefer Defuse, then See the Future, then Attack)
6. **Difficulty levels (optional):** Easy = random play, Medium = heuristic priorities above, Hard = track discard pile for card counting

---

### MODULE 10: UI Renderer

**Input:** `gameState` (via observer subscription from Module 3)

**Output:** DOM updates (no return value — directly manipulates DOM)

**Logic:**
1. **Screens:**
   - `#setup-screen` — player count selector, mode selector, name inputs, start button
   - `#game-screen` — main game board
   - `#game-over-screen` — winner announcement, play again button
2. **Game screen layout:**
   - **Top bar:** draw pile (card back with count), discard pile (top card visible), direction indicator
   - **Opponents area:** each opponent shown as a panel with name, card count (face-down cards), alive/dead status, turn indicator
   - **Center area:** action log / status messages
   - **Player hand:** current player's cards displayed face-up as clickable buttons/cards
   - **Action bar:** "Draw Card" button, "End Turn" button (contextual), combo selector
3. **Card rendering:**
   - Each card = a div with emoji icon, card name, colored border by type
   - Cat cards show their corner icon emoji
   - Cards in hand are clickable → opens action menu (Play, Use in Combo)
4. **Modals/Overlays:**
   - **See the Future modal:** shows top 3 cards face-up, "Close" button
   - **Defuse placement modal:** visual deck representation, slider or click-to-insert position picker
   - **Favor target modal:** list of alive players to target
   - **Favor give modal:** (hot-seat) player whose turn is NOT active selects a card to give
   - **Combo builder modal:** select 2/3/5 cards from hand, then select target
   - **Nope prompt:** button overlay "Play Nope?" for each eligible player
   - **Three of a Kind naming modal:** dropdown of card types to name
   - **5 Different Cards modal:** discard pile browser with selectable cards
5. **Hot-seat privacy:** When not current player's turn, hand is hidden — show "Pass to [Next Player]" screen with tap-to-reveal
6. **Animations (CSS-based):**
   - Card draw: slide from deck to hand
   - Card play: slide from hand to discard
   - Exploding Kitten: explosion emoji animation 💥
   - Nope: card slam animation
7. **Update trigger:** subscribed to Game State Manager (Module 3) → re-renders on every state change

---

### MODULE 11: Hot-Seat Mode Controller

**Input:** `gameState`, mode flag = 'hotseat'

**Output:** Manages screen transitions between players, privacy screens

**Logic:**
1. **Between turns:** show "Pass device to [Next Player Name]" screen with "I'm Ready" button
2. **Card reveal:** when player taps "I'm Ready", their hand appears face-up
3. **See the Future privacy:** only show peeked cards to current player — auto-hide after "Got it" button
4. **Favor interaction:**
   - Current player selects target → target player gets a "You were Favored! Select a card to give" screen
   - Target selects card → card transfers → back to current player's screen
5. **Nope interaction:**
   - After an action is played, show "Does anyone want to Nope?" screen
   - Each player can tap "I want to Nope" → if multiple, they take turns
   - "No one wants to Nope" button to proceed
6. **Defuse placement:** only current player sees deck position picker
7. **General principle:** at no point should one player see another player's hand cards (except via Favor give screen where they choose what to reveal)

---

### MODULE 12: Event Handler / Input Controller

**Input:** DOM events (clicks, drags, keyboard)

**Output:** Calls to appropriate module functions (Turn Engine, Card Effect Resolver, etc.)

**Logic:**
1. **Setup screen events:**
   - Player count selector (2-5) → updates setup config
   - Mode toggle (AI / Hot-seat) → shows/hides AI difficulty, shows/hides player name fields
   - Start button → calls Module 13 `initGame(config)`
2. **Hand card click:** open context menu for that card:
   - "Play [CardName]" → calls Turn Engine to play card → triggers Nope window → resolves effect
   - "Use in Combo" → opens combo builder modal
3. **Combo builder:**
   - Multi-select cards from hand (checkboxes/toggles)
   - "Confirm Combo" → validates combo (Module 7) → triggers Nope window → resolves
   - "Cancel" → return to hand view
4. **Draw button:** calls `drawCard(currentPlayerId)` → handles result (EK or normal)
5. **End turn button:** only shown when applicable (e.g., after Skip without drawing under Attack — confirms end of turn)
6. **Nope button:** shown during nope-window for eligible players → calls Module 8
7. **Target selection:** clicking an opponent panel → sets target for Favor/combo steal
8. **Modal events:**
   - See the Future: "Close" → returns to play phase
   - Defuse placement: position slider + "Place Here" → inserts EK at chosen position
   - 5 Different: card selection in discard pile + "Take Card"
   - Three of a Kind: card name dropdown + "Steal"
9. **Keyboard shortcuts (optional):**
   - `D` = draw, `S` = skip turn, `Esc` = cancel modal

---

### MODULE 13: Game Flow Controller

**Input:** Setup config, all module APIs

**Output:** Orchestrates game lifecycle

**Logic:**
1. **`initGame(config)`:**
   - Create players (Module 4)
   - Create & shuffle deck (Module 2)
   - Deal cards (4 + 1 Defuse per player)
   - Insert (N-1) Exploding Kittens + remaining Defuses
   - Set initial game state (Module 3)
   - Render game screen (Module 10)
   - Start first turn (Module 5)
2. **Win check:** after every player death, check if only 1 alive → `gameState.winner = that player` → `turnPhase = 'game-over'` → render game-over screen
3. **`restartGame()`:** reset state, return to setup screen
4. **Mode dispatch:**
   - If AI mode and current player isAI → trigger AI logic (Module 9) with setTimeout delay (~1-2s for natural feel)
   - If hot-seat → trigger pass-device screen (Module 11)
5. **Error handling:** invalid actions log a warning and re-render without state change

---

## Task Breakdown for Coding Harness

Each task below is a self-contained unit that can be coded and tested independently. Tasks should be implemented in order.

---

### Task 1: HTML Skeleton + CSS + Setup Screen

**Input:** Module specification (Module 10 UI Renderer, Module 13 Game Flow Controller)

**Output:** 
- HTML structure with all screen containers (`#setup-screen`, `#game-screen`, `#game-over-screen`)
- Complete CSS for: card styling (emoji-based), layout (flexbox/grid), modals, animations, responsive design
- Functional setup screen: player count (2-5), mode toggle (AI/Hot-seat), player name inputs, AI difficulty selector, "Start Game" button
- CSS classes for all card types (color-coded borders), card back style, deck/discard pile styling

**Logic:**
1. Create `<!DOCTYPE html>` boilerplate with `<style>` and `<body>`
2. Build `#setup-screen` with form controls
3. Build `#game-screen` with placeholders: top bar (draw pile, discard pile, deck count), opponents area, center log, player hand area, action bar
4. Build `#game-over-screen` with winner text and "Play Again" button
5. Build all modal templates (hidden by default): See the Future, Defuse placement, Favor target, Favor give, Combo builder, Nope prompt, Three-of-a-Kind naming, 5-Different discard browser
6. CSS: card component (`.card` with `.card--exploding`, `.card--defuse`, etc.), hand layout, fan-style card spread, modal overlays, explosion animation, responsive breakpoints
7. No JavaScript logic yet — just visual shell

---

### Task 2: Card Definitions + Deck Creation + Shuffle

**Input:** Module 1 (Constants & Card Definitions), Module 2 (Deck & Shuffle Logic)

**Output:**
- `CARD_TYPES` object with all 9 card types + 5 cat sub-types
- `DECK_COMPOSITION` array
- `COMBO_TYPES` definitions
- `createDeck()`, `shuffle()`, `removeExplodingKittens()`, `insertExplodingKittens()`, `removeDefuses()`, `insertDefuses()` functions
- Unit test: `console.log(createDeck(4))` should produce a deck with 56 unique cards, correctly composed

**Logic:**
1. Define `CARD_TYPES`:
   ```js
   const CARD_TYPES = {
     exploding_kitten: { id: 'exploding_kitten', name: 'Exploding Kitten', emoji: '💥', color: '#FF4444', description: '...', count: 4, isCat: false, cornerIcon: null },
     defuse: { id: 'defuse', name: 'Defuse', emoji: '🔧', color: '#44AA44', description: '...', count: 6, isCat: false, cornerIcon: null },
     nope: { id: 'nope', name: 'Nope', emoji: '🚫', color: '#FF8800', description: '...', count: 5, isCat: false, cornerIcon: null },
     attack: { id: 'attack', name: 'Attack', emoji: '⚔️', color: '#FF4444', description: '...', count: 4, isCat: false, cornerIcon: null },
     skip: { id: 'skip', name: 'Skip', emoji: '⏭️', color: '#4488FF', description: '...', count: 4, isCat: false, cornerIcon: null },
     favor: { id: 'favor', name: 'Favor', emoji: '🎁', color: '#FF44AA', description: '...', count: 4, isCat: false, cornerIcon: null },
     shuffle: { id: 'shuffle', name: 'Shuffle', emoji: '🔀', color: '#8844FF', description: '...', count: 4, isCat: false, cornerIcon: null },
     see_future: { id: 'see_future', name: 'See the Future', emoji: '🔮', color: '#44AAAA', description: '...', count: 5, isCat: false, cornerIcon: null },
     tacocat: { id: 'tacocat', name: 'Tacocat', emoji: '🌮', color: '#FFAA44', count: 4, isCat: true, cornerIcon: 'taco' },
     cattermelon: { id: 'cattermelon', name: 'Cattermelon', emoji: '🍉', color: '#44AA66', count: 4, isCat: true, cornerIcon: 'melon' },
     hairy_potato_cat: { id: 'hairy_potato_cat', name: 'Hairy Potato Cat', emoji: '🥔', color: '#BB8844', count: 4, isCat: true, cornerIcon: 'potato' },
     beard_cat: { id: 'beard_cat', name: 'Beard Cat', emoji: '🧔', color: '#886644', count: 4, isCat: true, cornerIcon: 'beard' },
     rainbow_cat: { id: 'rainbow_cat', name: 'Rainbow-Ralphing Cat', emoji: '🌈', color: '#FF44FF', count: 4, isCat: true, cornerIcon: 'rainbow' }
   };
   ```
2. Fisher-Yates shuffle
3. `createDeck(playerCount)`:
   - Generate all 56 card instances with unique `instanceId` (e.g., `'tacocat-1'`, `'tacocat-2'`, ...)
   - Return full deck array
4. Setup helper functions for the deal/setup sequence

---

### Task 3: Game State Manager + Player Manager

**Input:** Module 3 (Game State Manager), Module 4 (Player Manager)

**Output:**
- `gameState` global object with all fields defined in spec
- `getState()`, `setState(partial)`, `resetState()`, `subscribe(callback)` functions
- `createPlayer()`, `getActivePlayer()`, `getNextAlivePlayerIndex()`, `removeCardFromHand()`, `addCardToHand()`, `killPlayer()`, `getAlivePlayers()`, `getOtherAlivePlayers()` functions
- Observer pattern working: any `setState` call triggers subscribed callbacks

**Logic:**
1. Initialize `gameState` with default/empty values
2. `setState(partial)`: merge partial into state → call all subscribed callbacks with new state
3. `subscribe(callback)`: add to observers array, return unsubscribe function
4. Player functions operate on `gameState.players` array
5. `killPlayer`: set `isAlive=false`, move all hand cards to discardPile
6. `getNextAlivePlayerIndex`: iterate from current+1, wrap around, skip dead players

---

### Task 4: Turn Engine + Card Effect Resolver

**Input:** Module 5 (Turn Engine), Module 6 (Card Effect Resolver)

**Output:**
- `startTurn()`, `endTurn()`, `drawCard()`, `advanceToNextPlayer()` functions
- `resolveCardEffect(cardType, playerId, targetId)` function
- Correct handling of: normal draw, Exploding Kitten draw, Defuse flow, Attack turn chaining, Skip under Attack

**Logic:**
1. `startTurn()`: set phase to 'play', log "[Player] turn started", if AI → schedule AI decision
2. `drawCard(playerId)`:
   - Pop `drawPile[0]` → if Exploding Kitten → check hand for Defuse
   - If Defuse exists → enter 'defuse-placement' phase → wait for UI to pick position → insert EK → end turn
   - If no Defuse → `killPlayer(playerId)` → check win → advance turn
   - If normal card → add to hand → end turn
3. `endTurn()`: check `turnsRemaining`:
   - If > 1: decrement, same player goes again
   - If == 1: advance to next player
4. `advanceToNextPlayer()`: find next alive, set currentPlayerIndex, call `startTurn()`
5. `resolveCardEffect()` — switch on cardType:
   - `attack`: set next player's turnsRemaining += 2, end current turn (no draw)
   - `skip`: end current turn (no draw), decrement turnsRemaining if under attack
   - `favor`: trigger target selection → target gives card (via UI callback)
   - `shuffle`: `drawPile = shuffle(drawPile)`
   - `see_future`: enter peek phase, show top 3 via UI
   - `defuse`: only valid in defuse phase, triggers EK placement
6. Each effect (except defuse/EK) wraps through Nope system first (Module 8 — stub for now, pass-through)

---

### Task 5: Combo Resolver

**Input:** Module 7 (Combo Resolver)

**Output:**
- `detectCombo(cardsPlayed)` → returns `{ type: 'two_kind'|'three_kind'|'five_different'|'invalid' }`
- `resolveCombo(cards, playerId, targetId, namedCard?)` → executes combo effect

**Logic:**
1. `detectCombo`:
   - Get corner icons of all played cards
   - 2 cards, same icon → 'two_kind'
   - 3 cards, same icon → 'three_kind'
   - 5 cards, all unique icons → 'five_different'
   - else → 'invalid'
2. `resolveCombo`:
   - 'two_kind': steal random card from target → transfer
   - 'three_kind': search target hand for `namedCard` type → if found, transfer; else nothing
   - 'five_different': open discard pile browser → player picks 1 → add to hand
3. All combos are Nopeable → wrap through Module 8

---

### Task 6: Nope / Counter-Play System

**Input:** Module 8 (Nope / Counter-Play System)

**Output:**
- `openNopeWindow(action, playerId)` — starts the Nope resolution window
- `playNope(playerId)` — a player plays a Nope card
- `closeNopeWindow()` — resolves the stack and either executes or cancels the action
- `isActionNoped()` — returns true if odd number of Nopes in stack

**Logic:**
1. When any Nopeable action is played → `openNopeWindow`:
   - Set `turnPhase = 'nope-window'`
   - Store `pendingAction = { type, cards, playerId, targetId }`
   - Clear `nopeStack = []`
2. `playNope(playerId)`:
   - Remove Nope card from player's hand
   - Push to `nopeStack`
   - Re-open window for counter-Nope (any other alive player)
3. `closeNopeWindow()`:
   - Count Nopes in stack: odd → cancel action, even → execute
   - If cancelled: move all played cards (original + Nopes) to discard pile
   - If executed: call the original action's resolver (Module 6 or 7)
   - Set `turnPhase = 'play'` (back to current player's turn)
   - Clear `pendingAction` and `nopeStack`
4. AI mode: each AI player evaluates Nope decision (Module 9), short delay, then auto-close
5. Hot-seat mode: show "Any player want to Nope?" screen, wait for button press or "Continue"

---

### Task 7: UI Renderer

**Input:** Module 10 (UI Renderer), `gameState` (via subscription)

**Output:**
- `render()` function called on every state change
- All screen transitions, card displays, modal management, log updates
- `renderCard(card)` → returns DOM element for a card
- `renderHand(player)` → renders player's hand cards
- `renderOpponents()` → renders opponent panels
- `renderDrawPile()`, `renderDiscardPile()` → top bar elements
- `showModal(modalId, data)`, `hideModal(modalId)` → modal management
- `renderLog()` → action log display

**Logic:**
1. Subscribe to Game State Manager: `subscribe(render)`
2. `render()`:
   - If `turnPhase == 'game-over'` → show game-over screen with winner
   - Else → update all game-screen elements
3. `renderCard(card)`:
   - Create div with class `card card--{type}`
   - Show emoji + name
   - Add click handler if it's in current player's hand
4. `renderHand(player)`:
   - Fan layout for cards (CSS transform rotate per card index)
   - Only show face-up for current player (hot-seat: hide unless "I'm Ready" clicked)
5. `renderOpponents()`:
   - Each opponent: name, face-down card count (stack of card-backs), alive/dead indicator, "current turn" highlight
6. Modals: each modal has a `show`/`hide` function, populated with `data` parameter
7. Log: append new entries to `#action-log`, auto-scroll to bottom, max 20 entries visible

---

### Task 8: Hot-Seat Mode Controller

**Input:** Module 11 (Hot-Seat Mode Controller)

**Output:**
- `showPassScreen(playerName)` — "Pass to [Name]" privacy screen
- `showFavorGiveScreen(targetPlayer)` — target player selects card to give
- `showNopePrompt()` — "Does anyone want to Nope?" screen
- `hideHandForNonCurrentPlayers()` — privacy guard

**Logic:**
1. Between turns: full-screen overlay "Pass device to [Name]" with "I'm Ready" button
2. On "I'm Ready": hide overlay, show current player's hand face-up
3. See the Future: cards shown in modal → "Got it" → cards hidden
4. Favor give: swap to target player's perspective → they see their hand → pick card → confirm → swap back
5. Nope prompt: show all alive player names as buttons → tap name → that player can play Nope or pass
6. Defuse placement: only current player sees the deck position picker

---

### Task 9: AI Opponent Logic

**Input:** Module 9 (AI Opponent Logic), `gameState`

**Output:**
- `aiTakeTurn(playerId)` — AI decides what to play and executes
- `aiDecideNope(playerId, pendingAction)` — returns true/false
- `aiChooseFavorCard(cards)` — returns card to give
- `aiChooseDefusePosition(deckSize)` — returns insertion index
- `aiNameCardForThreeOfKind()` — returns card type name

**Logic:**
1. `aiTakeTurn`:
   - Evaluate hand + game state
   - Apply priority hierarchy (survival → disruption → info → card advantage → combos → draw)
   - Execute decision via Module 5/6/7
2. `aiDecideNope`: apply heuristics (Always Nope Attack/Favor on self, sometimes Nope See the Future, etc.)
3. `aiChooseFavorCard`: sort hand by value → give lowest value (cat card > action card in terms of "keep")
4. `aiChooseDefusePosition`: random position (1 to deckSize-1), not index 0 (top)
5. Add 1-2 second `setTimeout` before AI acts for natural pacing

---

### Task 10: Event Handler / Input Controller

**Input:** Module 12 (Event Handler / Input Controller)

**Output:**
- All event listeners wired up: card clicks, button clicks, modal interactions
- `playCard(instanceId)`, `drawCardClick()`, `selectTarget(playerId)`, `confirmCombo(cards)`, `confirmNope()`, `placeDefuse(position)` functions
- Input validation: can't play during opponent's turn, can't draw before ending play phase, etc.

**Logic:**
1. Setup screen: wire player count, mode toggle, name inputs, start button → `initGame(config)`
2. Hand card click: open context menu → "Play" or "Use in Combo"
3. Combo builder: multi-select cards → validate via `detectCombo()` → select target → `resolveCombo()`
4. Draw button: call `drawCard(currentPlayerId)`
5. Target selection: clicking opponent panel during Favor/combo → set target
6. Nope button: during nope-window → call `playNope(playerId)`
7. Modal buttons: wire all confirm/cancel/close buttons to appropriate functions
8. Validation: check `turnPhase` and `currentPlayerIndex` before allowing actions

---

### Task 11: Game Flow Controller + Integration

**Input:** Module 13 (Game Flow Controller), all previous modules

**Output:**
- `initGame(config)` — full game setup and first turn
- `checkWinCondition()` — returns winner or null
- `restartGame()` — reset to setup screen
- `handleAITurn()` — dispatches to AI logic with delay
- `handleHotSeatTransition()` — dispatches to hot-seat controller
- Full working game playable end-to-end

**Logic:**
1. `initGame(config)`:
   - Call Module 2 to create deck
   - Call Module 4 to create players
   - Deal 4 + 1 Defuse each
   - Insert (N-1) EK + remaining Defuses, shuffle
   - Set `gameState` via Module 3
   - Hide setup screen, show game screen
   - Call `startTurn()` for first player
2. `checkWinCondition()`: if `getAlivePlayers().length == 1` → set winner, show game-over screen
3. After every turn ends → `checkWinCondition()` → if no winner → `advanceToNextPlayer()` → mode dispatch (AI or hot-seat)
4. `restartGame()`: `resetState()`, show setup screen
5. Integration testing: play a full 4-player AI game, verify all card effects work, no state corruption

---

### Task 12: Polish + Bug Fix + Edge Cases

**Input:** All modules, testing feedback

**Output:** Production-ready game

**Logic:**
1. **Edge cases:**
   - 2-player game: only 1 EK in deck
   - Player runs out of cards in hand: can still draw to end turn
   - Attack stacking: Player A attacks Player B (2 turns), B attacks C → B's turns end, C takes 2 turns (not 3)
   - Nope on Nope on Nope (3 Nopes = cancelled)
   - 5 Different Cards when discard pile is empty (edge: can't play if no cards in discard? Rules don't specify — allow playing but get nothing, or prevent playing)
   - Defuse placement when deck is empty (place at position 0 = only option)
   - All players except one die simultaneously (not possible in turn-based, but verify win check)
2. **UI polish:**
   - Card hover effects (lift, glow)
   - Smooth transitions between screens
   - Explosion animation when player dies
   - Sound effects (optional: Web Audio API beeps/tones, no external files)
   - Mobile responsive (cards stack vertically on small screens)
3. **Game log:** formatted entries with player names and card emojis
4. **Testing checklist:**
   - [ ] Each card type plays correctly
   - [ ] Nope chain resolves correctly (1 Nope = cancel, 2 = execute, 3 = cancel)
   - [ ] Attack + Skip interaction (2 Skips needed to cancel both turns)
   - [ ] All 3 combos work (Two/Three of a Kind, 5 Different)
   - [ ] Defuse placement works at any deck position
   - [ ] See the Future shows top 3, then hides
   - [ ] Hot-seat privacy: no card leakage between players
   - [ ] AI doesn't cheat (doesn't look at hidden info)
   - [ ] Win condition triggers correctly
   - [ ] Restart works without page reload

---

## Data Flow Diagram

```
User Input (click)
       │
       ▼
Module 12: Event Handler
       │
       ▼
Module 5: Turn Engine ──→ Module 6: Card Effect Resolver
       │                         │
       │                    Module 8: Nope System
       │                         │
       │                    Module 7: Combo Resolver
       │                         │
       ▼                         ▼
Module 3: Game State Manager ←── (state updates)
       │
       ├──→ Module 4: Player Manager (hand/dead updates)
       │
       ▼
Module 10: UI Renderer (re-renders on state change)
       │
       ├──→ Module 11: Hot-Seat Controller (privacy screens)
       │
       ▼
User sees updated game

Parallel:
Module 9: AI Logic ←── reads state → outputs decision → feeds to Turn Engine
Module 13: Game Flow Controller ←── orchestrates init/win/restart/AI dispatch
```

---

## Key Design Decisions

1. **No server needed:** All game logic client-side in a single HTML file. No persistence (no save game).
2. **Nope timing:** In AI mode, AI decisions are computed synchronously but executed with setTimeout for UX pacing. In hot-seat, button-based with optional timer.
3. **Card uniqueness:** Each card instance has a unique `instanceId` to prevent duplication bugs (e.g., `'tacocat-1'` vs `'tacocat-2'`).
4. **State as single source of truth:** All modules read from and write to `gameState` via Module 3. UI never holds state — it only renders from `gameState`.
5. **Observer pattern:** UI subscribes to state changes → automatic re-render. No manual render calls needed.
6. **AI fairness:** AI only uses public information (deck size, discard pile, other players' card counts). AI does NOT read other players' hands or the draw pile order (unless it used See the Future).

---

## Estimated Complexity per Task

| Task | Complexity | Dependencies |
|---|---|---|
| 1: HTML + CSS + Setup | Medium | None |
| 2: Cards + Deck | Low | None |
| 3: State + Players | Low-Medium | None |
| 4: Turn Engine + Effects | High | Tasks 2, 3 |
| 5: Combo Resolver | Medium | Tasks 2, 3 |
| 6: Nope System | High | Tasks 3, 4 |
| 7: UI Renderer | High | Tasks 1, 3 |
| 8: Hot-Seat Controller | Medium | Task 7 |
| 9: AI Logic | Medium-High | Tasks 4, 5, 6 |
| 10: Event Handler | Medium | Tasks 4, 5, 6, 7 |
| 11: Game Flow + Integration | Medium | All previous |
| 12: Polish + Edge Cases | Medium | All previous |