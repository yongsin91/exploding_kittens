# Task 9: AI Opponent Logic — Complete ✅

## Module: `js/modules/09-ai.js`

### Overview
Implemented the AI opponent logic with three difficulty levels (easy, medium, hard). AI makes decisions about card play, nope responses, favor card selection, defuse placement, and three-of-a-kind card naming using priority-based heuristics.

### API Exposed: `window.AI`

| Method | Description |
|--------|-------------|
| `setDifficulty(level)` | Set difficulty: 'easy', 'medium', or 'hard' |
| `getDifficulty()` | Get current difficulty level |
| `aiTakeTurn(playerId)` | Execute AI turn — returns decision object |
| `getAIDecision(playerId)` | Get AI decision: `{ action, cardType, cardInstanceId, targetId, combo, comboType, comboCards, namedCard }` |
| `getAINopeDecision(playerId, pendingAction)` | Returns boolean — whether AI wants to nope |
| `aiChooseFavorCard(playerId)` | Returns instance ID of least valuable card to give |
| `aiChooseDefusePosition(deckSize)` | Returns position index for EK placement |
| `aiNameCardForThreeOfKind(playerId)` | Returns card type to steal |
| `rememberPeekedCards(playerId, peekedCards)` | Store peek info for AI memory |
| `clearPeekMemory(playerId)` | Clear AI's peek memory |
| `getPeekMemory(playerId)` | Get AI's peek memory |

### Difficulty Levels

#### Easy
- 50% chance to play a random card, 50% to draw
- Nope decisions: 25% random chance
- Defuse placement: random position
- Three-of-a-kind naming: random card type

#### Medium (Default)
- **Priority hierarchy**: Survival → Disruption → Info → Card Advantage → Combos → Skip → Draw
- Survival: Play Skip/Attack if known EK on top (from peek memory)
- Disruption: Attack when next player has ≤2 cards
- Info: See the Future when deck ≤8 cards
- Card Advantage: Favor on player with most cards
- Combos: Two/Three of a Kind with matching cat cards
- Nope: Always nope Favor targeting self, Attack when next, 50% See the Future, never Shuffle
- Defuse: Middle-bottom placement (~60%)
- Three-of-a-kind: Prefers Defuse > See the Future > Attack > Skip

#### Hard
- All medium strategies plus:
- Card counting: Tracks EKs in discard vs deck, calculates EK probability
- High EK probability (>30%): Prioritizes Skip/Attack over drawing
- Shuffle when deck is unfavorable (>20% EK probability)
- Nope: 70% nope See the Future, always nope Favor/Attack targeting self, 40% nope combos
- Defuse: Places near bottom (~75%) with jitter
- Three-of-a-kind: Checks discard pile to avoid depleted card types

### Card Value Assessment
```
Defuse: 100 | Attack: 70 | Skip: 60 | See Future: 50 | Nope: 40
Favor: 30 | Shuffle: 25 | Cat cards: 10
```
Used for favor card selection (give lowest value) and decision prioritization.

### Peek Memory
- Private memory map (not stored in GameState since it's immutable)
- `rememberPeekedCards()` stores top card type and top 3 types
- `getMediumDecision()` checks peek memory for survival priority
- `clearPeekMemory()` called after drawing or shuffling

### Test Results
- **Test File**: `run-test-task9.js`
- **Tests**: 73/73 passed ✅
- **Coverage**: Module loading, difficulty get/set, AI decision (dead/invalid/easy/medium/hard), survival (skip/attack with EK on top), disruption (attack few cards), info (see future small deck), favor with target, combos (two/three of a kind), default draw, nope decisions (null/no card/own action/dead/favor self/shuffle/easy random/hard attack/favor/shuffle/see future), favor card selection (least valuable/avoids defuse/only defuse/empty/cat over action), defuse position (valid range/empty deck/easy random/hard near bottom), three-of-a-kind naming (valid type/prefers defuse/easy random), peek memory (remember/clear)

### Key Design Decisions
- Three-of-a-kind checked before two-of-a-kind (greedy: use more cards for better effect)
- Peek memory stored in private closure map, not GameState (GameState is immutable)
- Card value hierarchy drives both favor giving and decision priorities
- Hard AI uses EK probability calculation: `(EKs remaining) / (draw pile size)`
- All AI functions are safe to call with invalid/dead players (return safe defaults)