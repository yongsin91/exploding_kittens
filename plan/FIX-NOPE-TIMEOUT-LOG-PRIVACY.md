# Fix: Nope Window Timeout + Action Log Privacy

## Issues

### Issue 1: Nope window auto-closes before user can click
The nope window has THREE auto-close mechanisms:
1. `windowExpiryTimeout` (5s hard timeout) — closes regardless of human eligibility
2. `TurnEngine.isNopeWindowActive()` checks `nopeWindowExpires` timestamp — closes if expired
3. `autoCloseTimeout` (500ms) — closes when no humans eligible (this is fine)

The user wants NO time limit — the nope modal should stay open until the human clicks "Nope!" or "Let It Happen". AI nope checks should still auto-run.

### Issue 2: Action log reveals opponent's drawn cards
`CARD_DRAWN` log entry says `"AI-1 drew 🔮 See the Future"` — reveals the card type to the human player. In the physical game, drawn cards are private (except Exploding Kitten which is public).

## Fix Plan

### Step 1: Remove nope window hard timeout
- Remove `windowExpiryTimeout` variable and all its usages from `08-nope.js`
- Remove the timeout set in `openNopeWindow()` and `playNope()`
- Keep clearing it in `closeNopeWindow()` (no-op if already null)

### Step 2: Remove expiration from TurnEngine
- `TurnEngine.openNopeWindow()` — set `nopeWindowExpires: null` instead of a timestamp
- `TurnEngine.isNopeWindowActive()` — remove the expiration check, just check `nopeWindowActive`

### Step 3: Keep AI nope auto-check (no change)
- `scheduleAINopeChecks()` still schedules AI nope decisions after 1s
- When no AI nopes and human is eligible → just wait (no timeout)
- When no AI and no human eligible → auto-close after 500ms (fine)

### Step 4: Hide drawn card info in action log
- `05-turn-engine.js` `drawCard()`: for non-EK draws, log `"${player.name} drew a card"`
- For EK draws: keep `"${player.name} drew an Exploding Kitten!"` (public)
- Remove `cardType` and `cardEmoji` from non-EK log entries

### Step 5: Add/verify E2E tests
- Verify nope modal stays open for human response
- Verify drawn card info is not in log for non-EK draws