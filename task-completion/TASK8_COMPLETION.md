# Task 8: Hot-Seat Mode Controller — Complete ✅

## Module: `js/modules/11-hotseat.js`

### Overview
Implemented the hot-seat mode controller for local multiplayer gameplay. Manages privacy screens between turns, favor give interactions, nope prompts, and ensures card information doesn't leak between players sharing a device.

### API Exposed: `window.HotSeat`

| Method | Description |
|--------|-------------|
| `showPassScreen(playerName)` | Shows full-screen "Pass device to [Name]" overlay |
| `hidePassScreen()` | Hides pass screen overlay and triggers re-render |
| `isPassScreenActive()` | Returns whether pass screen is currently showing |
| `showFavorGiveScreen(targetPlayerId)` | Shows pass screen for target player in favor interaction |
| `showNopePrompt(excludePlayerId)` | Iterates through alive players offering nope chance |
| `handleNopeResponse(wantNope)` | Processes nope response from current player in queue |
| `getPendingNopePlayerId()` | Returns player currently being asked about nope |
| `hideHandForNonCurrentPlayers()` | Privacy guard — hides hand during pass screen |
| `isHotSeatMode()` | Returns whether hot-seat mode is active |
| `setHotSeatMode(value)` | Enables/disables hot-seat mode |
| `onTurnStart(playerId)` | Called by flow controller — shows pass screen if hot-seat |
| `onFavorRequest(targetPlayerId)` | Called on favor request — shows pass screen in hot-seat |
| `onNopeWindow(excludePlayerId)` | Called on nope window — iterates players in hot-seat |
| `onPeekStart(playerId)` | Called before peek — shows pass screen for non-current viewer |
| `hideSpecialScreens()` | Clears all special screens and queues |
| `reset()` | Resets all hot-seat state |

### Features Implemented

1. **Pass Screen Overlay**: Full-screen privacy overlay with:
   - Animated bouncing phone icon (📱)
   - "Pass device to [Player Name]" title
   - Privacy reminder subtitle
   - "I'm Ready" button to dismiss
   - Dynamically created and appended to document body

2. **Turn Transitions**: `onTurnStart()` shows pass screen for next player in hot-seat mode, skipped for dead players or AI mode

3. **Favor Give Flow**: `showFavorGiveScreen()` shows pass screen for target player, then favor-give-modal appears after dismissal

4. **Nope Prompt Queue**: `showNopePrompt()` builds a queue of eligible alive players (excluding action initiator), iterates through each with pass screen, `handleNopeResponse()` processes yes/no and continues queue

5. **See the Future Privacy**: `onPeekStart()` shows pass screen if the peeking player is not the current viewer

6. **Privacy Guards**: `hideHandForNonCurrentPlayers()` hides hand element during pass screen

### CSS Added (`styles/main.css`)
- `.pass-screen-overlay` — full-screen dark overlay (z-index: 9999)
- `.pass-screen-content` — centered flex column
- `.pass-screen-icon` — bouncing animation
- `.pass-screen-title` — large heading
- `.pass-screen-subtitle` — muted privacy reminder
- `.opponent-panel` styles — border, padding, dead state
- `.log-entry` styles — small text, border separator
- `.hand-empty` and `.discard-empty` message styles

### Dependencies
- Module 3: `GameState` (state access)
- Module 10: `UIRenderer` (force re-render after pass screen)
- Module 8: `Nope` (canPlayerNope, playNope, closeNopeWindow — optional integration)

### Test Results
- **Test File**: `run-test-task8.js`
- **Tests**: 54/54 passed ✅
- **Coverage**: Module loading, pass screen show/hide, overlay creation, title display, hot-seat mode toggle, onTurnStart (hot-seat/AI/dead/invalid), favor give screen, nope prompt queue, nope response handling, onNopeWindow (hot-seat/AI), onPeekStart (current/different player), hideSpecialScreens, reset, hideHandForNonCurrentPlayers, edge cases

### Key Design Decisions
- Pass screen overlay is dynamically created on first show, reused on subsequent calls
- Nope prompt uses a queue pattern — each player gets pass screen, then nope modal
- All hot-seat functions are no-ops when `isHotSeat` is false (safe to call in AI mode)
- `reset()` clears all state including mode flag, pass screen, and nope queue