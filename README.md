# Exploding Kittens - HTML Game

A single-player vs AI and local hot-seat multiplayer implementation of the card game Exploding Kittens, built with vanilla HTML, CSS, and JavaScript.

## Project Structure

```
exploding-kittens/
├── index.html                  # Main HTML file with all screens and modals
├── styles/main.css             # Complete stylesheet with dark theme
├── js/
│   ├── app.js                  # Main application controller (setup screen)
│   └── modules/
│       ├── 01-constants.js     # Card definitions and game config
│       ├── 02-deck.js          # Deck creation and shuffle logic
│       ├── 03-game-state.js    # Game state manager (observer pattern + mutate)
│       ├── 04-player.js        # Player management and hand logic
│       ├── 05-turn-engine.js   # Turn flow and phase management
│       ├── 06-card-effects.js  # Individual card effect resolution
│       ├── 07-combo.js         # Combo detection and resolution
│       ├── 08-nope.js          # Nope card counter-play system (with timeout fallback)
│       ├── 09-ai.js            # AI opponent decision-making
│       ├── 10-ui-renderer.js   # UI rendering and updates
│       ├── 11-hotseat.js       # Hot-seat multiplayer mode
│       ├── 12-events.js        # Input event handling
│       └── 13-flow.js          # Game lifecycle controller (AI multi-card play)
├── e2e/                        # Playwright E2E tests (148 tests)
│   ├── helpers.js              # Shared test helpers
│   ├── 00-smoke.spec.js        # Basic page load test
│   ├── 01-setup-screen.spec.js # Setup screen tests
│   ├── 02-game-screen-initial.spec.js # Initial game state tests
│   ├── 03-gameplay-interactions.spec.js # Gameplay interaction tests
│   ├── 04-nope-mechanic.spec.js # Nope mechanic tests
│   ├── 05-ai-turn-flow.spec.js # AI turn flow tests
│   ├── 06-hotseat-mode.spec.js # Hot-seat mode tests
│   ├── 07-win-gameover.spec.js # Win/game over tests
│   ├── 08-multiplayer-edge-cases.spec.js # Multiplayer edge cases
│   ├── 09-game-actions.spec.js # Card action tests
│   └── 10-corrected-mechanics.spec.js # Corrected mechanics tests
├── plan/                       # Implementation plan and progress tracking
└── README.md                   # This file
```

## Technical Stack

- **HTML5** — Semantic markup with ARIA labels for accessibility
- **CSS3** — CSS custom properties for theming, Flexbox/Grid layouts, animations
- **Vanilla JavaScript (ES6+)** — Module pattern with IIFE for scope isolation
- **No external dependencies** — Pure client-side implementation
- **Responsive design** — Works on desktop, tablet, and mobile

## Features (Phase 1 - Complete)

✅ **Setup Screen**
- Player count selector (2-5 players with slider)
- Game mode toggle (AI vs Hot-seat)
- AI difficulty selector (Easy/Medium/Hard)
- Dynamic player name inputs
- Auto-generated default names
- Form validation and error handling

✅ **UI/UX**
- Dark mode theme with cyan accents
- Responsive layout (mobile-first approach)
- Semantic HTML with accessibility support
- Smooth animations and transitions
- Card component system

✅ **Architecture**
- Module-based structure with clear separation of concerns
- Observer pattern for reactive state updates
- Event delegation for efficient input handling
- Centralized configuration management
- Comprehensive logging and debugging support
- Live state management with `mutate()` pattern for atomic updates

## Corrected Game Mechanics (Phase 2)

✅ **State Management** — `getState()` returns live object; `mutate(fn)` for atomic updates
✅ **Unified Game Phase** — Single `gamePhase` field: `'setup' | 'active' | 'game-over'`
✅ **Shuffle Card** — Actually shuffles the draw pile (was a no-op)
✅ **Attack Stacking** — Passes remaining turns + 2 to next player per official rules
✅ **Skip Under Attack** — Ends one attack turn, remaining turns still owed
✅ **Five Different Nopeable** — All combos including Five Different can be noped
✅ **Defuse Flow** — EK held in modalData, never added to hand
✅ **See the Future** — Well-documented card ordering (top first)
✅ **AI Nope Integration** — Human can nope AI card plays via nope modal
✅ **Combo Cancel** — Properly clears selection state on modal close
✅ **First Player** — Human always goes first in AI mode (deterministic)
✅ **Favor Description** — Target chooses card, not random
✅ **Nope Auto-Close** — Hard timeout fallback (5 seconds)
✅ **Turn Phase** — Simplified to `'action'` + transient phases
✅ **AI Multi-Card Play** — AI can play up to 3 cards per turn
✅ **E2E Test Coverage** — 148 tests covering all corrected mechanics

## Game Rules (Implementation Target)

### Deck Composition
- 4 Exploding Kittens 💥
- 6 Defuses 🔧
- 4 Attacks ⚔️
- 4 Skips ⏭️
- 5 Nopes 🚫
- 4 Favors 🎁
- 4 Shuffles 🔀
- 5 See the Futures 🔮
- 20 Cat Cards (4 each of 5 types)

### Card Combos
- **Two of a Kind** — 2 same cat cards → steal 1 random card
- **Three of a Kind** — 3 same cat cards → name card type to steal
- **Five Different** — 5 different cat cards → pick from discard pile

### Special Rules
- **Nope** — Cancel any action (except Exploding Kitten/Defuse). All combos are nopeable.
- **Attack** — End turn without drawing. Next player takes 2 turns. If attacked player plays Attack, next player takes remaining + 2 turns.
- **Skip** — End turn without drawing. Under Attack, ends one turn (remaining turns still owed).
- **Shuffle** — Shuffles the draw pile.
- **Favor** — Force any player to give you 1 card (they choose which).

## Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- No build tools or dependencies required

### Running the Game

1. Open `index.html` in your browser
2. Select number of players (2-5)
3. Choose game mode:
   - **AI Mode**: Play against computer opponents
   - **Hot-seat**: Local multiplayer (pass device between players)
4. Enter player names (or leave blank for auto-generated defaults)
5. Select AI difficulty if in AI mode
6. Click "Start Game"

### Development Setup

No build step required! Simply:
1. Edit files in your code editor
2. Save changes
3. Refresh browser to see updates

All JavaScript modules load in dependency order via script tags in `index.html`.

## Browser Support

### Fully Supported
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

### Features Requiring Modern Browser
- CSS Grid and custom properties
- ES6+ JavaScript (arrow functions, destructuring, etc.)
- Flexbox layouts
- CSS animations and transitions

## Architecture & Design Patterns

### Module Pattern (IIFE)
Each module is wrapped in an IIFE to avoid global scope pollution:
```javascript
(function() {
    'use strict';
    // Module code here
    window.ModuleAPI = { /* exposed functions */ };
})();
```

### Observer Pattern
Game state changes trigger subscriber callbacks for reactive UI updates:
```javascript
subscribe(callback) // Called on every state change
```

### Event Delegation
Input events are centrally handled and routed to appropriate handlers:
```javascript
// Single listener for card clicks
document.addEventListener('click', handleCardClick);
```

### Single Responsibility Principle
Each module has one clear purpose:
- Module 1: Constants only
- Module 2: Deck operations only
- Module 3: State management only
- etc.

## Configuration & Customization

### Theme Colors
Edit CSS variables in `styles/main.css`:
```css
:root {
    --color-primary: #00d4ff;        /* Primary accent */
    --color-danger: #ff4444;         /* Danger actions */
    --color-bg-dark: #1a1a1a;        /* Background */
    /* ...more variables */
}
```

### Card Types & Emojis
Defined in Module 1 (constants):
```javascript
const CARD_TYPES = {
    exploding_kitten: { emoji: '💥', color: '#ff4444', ... },
    // ...
}
```

### Difficulty Levels
AI decision-making in Module 9:
- **Easy**: Random card selection
- **Medium**: Heuristic-based priorities
- **Hard**: Card counting and advanced strategy

## Performance Considerations

- **Minimal DOM manipulation** — Batch updates and use event delegation
- **CSS animations over JavaScript** — Smoother performance
- **No external resources** — Fully self-contained
- **Lazy rendering** — Only render visible elements
- **Memory efficient** — Reuse DOM elements where possible

## Accessibility Features

- ✅ Semantic HTML (`<button>`, `<form>`, `<label>`)
- ✅ ARIA labels and roles for screen readers
- ✅ Keyboard navigation support (Tab, Enter, Escape)
- ✅ Color contrast compliance (WCAG AA)
- ✅ Reduced motion support
- ✅ High contrast mode support
- ✅ Focus visible indicators

## Testing

### Manual Testing Checklist

**Setup Screen:**
- [ ] Slider changes player count (2-5)
- [ ] Player name fields update dynamically
- [ ] Mode toggle shows/hides difficulty
- [ ] Default names auto-generate
- [ ] Form submits successfully
- [ ] Console shows no errors

**Responsive Design:**
- [ ] Desktop layout works (1920×1080)
- [ ] Tablet layout works (768×1024)
- [ ] Mobile layout works (375×667)
- [ ] Touch interactions work
- [ ] No horizontal scrolling on mobile

**Accessibility:**
- [ ] Keyboard navigation works (Tab)
- [ ] Buttons are focusable
- [ ] Form inputs are labeled
- [ ] Color contrast is sufficient
- [ ] Screen reader announces elements

### Browser DevTools

Open DevTools (F12) to check:
- **Console tab** — Log messages from modules and app
- **Elements tab** — Inspect DOM structure and styles
- **Network tab** — No failed resource loads
- **Application tab** — Check local storage (future use)

## Debugging

Enable detailed logging by editing `js/app.js`:
```javascript
GameApp.log('message', 'info');    // Info
GameApp.log('warning', 'warn');    // Warning
GameApp.log('error', 'error');     // Error
```

Check browser console (F12 → Console) for module load messages:
```
[GameApp] Initializing application...
[Module 1: Constants] Loading...
[Module 2: Deck & Shuffle] Loading...
...
[GameApp] Application initialized successfully
```

## Implementation Roadmap

### Phase 1 (Complete) ✅
- [x] HTML structure and screens
- [x] CSS styling and responsive design
- [x] Setup screen UI and interaction
- [x] Module skeleton and stubs
- [x] Accessibility features

### Phase 2 (Next)
- [ ] Module 1: Card definitions
- [ ] Module 2: Deck creation and shuffle
- [ ] Module 3: Game state manager
- [ ] Module 4: Player manager
- [ ] Basic game initialization

### Phase 3
- [ ] Module 5: Turn engine
- [ ] Module 6: Card effects
- [ ] Module 7: Combo system
- [ ] Basic turn flow and card playing

### Phase 4
- [ ] Module 8: Nope system
- [ ] Module 9: AI logic
- [ ] Full game flow working

### Phase 5
- [ ] Module 10: UI renderer
- [ ] Module 11: Hot-seat mode
- [ ] Module 12: Event handlers
- [ ] Module 13: Game flow controller
- [ ] Polish and optimization

## Code Quality Standards

### Naming Conventions
- **Constants** — `UPPER_SNAKE_CASE`
- **Functions** — `camelCase`
- **Classes** — `PascalCase`
- **Private** — `_leadingUnderscore`
- **Variables** — `camelCase`

### Comments & Documentation
- JSDoc for public functions
- Inline comments for complex logic
- TODO markers for incomplete features

### Error Handling
- Graceful degradation
- Console logging instead of alerts
- Validation before state changes

### Performance
- Avoid nested loops where possible
- Cache DOM queries
- Use event delegation
- Batch DOM updates

## Contributing Guidelines

1. Follow the established module pattern
2. Add comprehensive JSDoc comments
3. Update this README for major changes
4. Test on multiple browsers before committing
5. Keep modules focused and single-responsibility
6. Use semantic HTML and accessibility best practices

## Known Limitations (Phase 1)

- Game logic not yet implemented (stub modules)
- Hot-seat privacy screens not implemented
- AI decision-making not implemented
- No persistent state (localStorage, etc.)
- No networking/multiplayer support

## Future Enhancements

- [ ] Undo/redo functionality
- [ ] Game replay and statistics
- [ ] Settings/preferences storage
- [ ] Sound effects and music
- [ ] Animations and particle effects
- [ ] Difficulty adjustment during game
- [ ] Chat/emotes for local multiplayer
- [ ] Mobile app wrapper (Cordova/Electron)

## License

This project is created for educational purposes. Exploding Kittens is a trademark of Exploding Kittens LLC.

## Support

For issues, questions, or suggestions:
1. Check the browser console for error messages
2. Review the implementation plan in exploding-kittens-plan.md
3. Check module stub comments for TODOs
4. Refer to game rules in this README

---

**Last Updated:** 2026-08-30
**Phase:** 1 - Setup Screen & Architecture (Complete)
**Next Phase:** Card Definitions & Deck Logic
