# 🐱 Exploding Kittens

A browser-based card game where you draw cards and try to avoid the Exploding Kitten. Play solo against AI opponents or gather friends for hot-seat multiplayer — no server, no install, just open and play.

## 🎮 Play the Game

👉 **[Play Exploding Kittens](https://yongsin91.github.io/exploding_kittens/)**

No download or installation needed. Works on desktop, tablet, and mobile browsers.

## How to Play

You take turns drawing cards from the deck. If you draw an Exploding Kitten 💥 and don't have a Defuse 🔧, you're out. Last player standing wins.

Each turn you can either **draw a card** (ending your turn) or **play a card** from your hand to change the game:

| Card | What it does |
|------|-------------|
| 🔧 **Defuse** | Saves you when you draw an Exploding Kitten — place it back in the deck wherever you want |
| ⚔️ **Attack** | Skip your draw and force the next player to take 2 turns |
| ⏭️ **Skip** | End your turn without drawing |
| 🎁 **Favor** | Steal a card from another player — they choose which one to give |
| 🔀 **Shuffle** | Shuffles the draw pile |
| 🔮 **See the Future** | Peek at the top 3 cards of the deck |
| 🚫 **Nope** | Cancel another player's action — any card, any combo, anytime |

### Cat Card Combos

Cat cards have no effect on their own, but combine them for powerful plays:

- **Two of a Kind** (2 matching cats) — Steal a random card from any player
- **Three of a Kind** (3 matching cats) — Name a card type and steal it from a player
- **Five Different** (5 different cats) — Pick any card from the discard pile

All combos can be Noped by other players.

### Attack Stacking

If you're attacked and play an Attack card back, the next player takes your remaining turns **plus 2**. Chain attacks to pile the pressure on!

## Game Modes

### 🤖 AI Mode
Play against 1–4 computer opponents. Choose from three difficulty levels:
- **Easy** — Random card selection
- **Medium** — Strategic priorities (survival, disruption, card advantage)
- **Hard** — Card counting and advanced threat assessment

### 👥 Hot-Seat Mode
Pass-the-device multiplayer for 2–5 players on the same screen. Privacy screens hide your hand between turns so nobody can peek.

## Features

- **2–5 players** — AI opponents or local hot-seat multiplayer
- **3 AI difficulty levels** — From casual to challenging
- **Custom player names** — Or use auto-generated defaults
- **All 56 cards** — Full deck with every card type and combo
- **Nope counter-play** — Cancel any action, with stacking Nopes (odd = cancelled, even = proceeds)
- **See the Future** — Peek at upcoming cards and plan your moves
- **Defuse placement** — Choose exactly where to re-insert the Exploding Kitten
- **Discard pile browser** — Five Different combo lets you reclaim cards from the discard
- **Action log** — Every move is logged so you can follow what happened
- **Keyboard shortcuts** — `D` to draw, `S` to end turn, `Esc` to close modals
- **Responsive design** — Works on desktop, tablet, and mobile
- **Dark theme** — Easy on the eyes for long sessions
- **No install, no server** — Pure browser game, no dependencies

## Getting Started

Just open the game in your browser:

1. Go to **[the game page](https://yongsin91.github.io/exploding_kittens/)**
2. Choose how many players (2–5)
3. Pick AI Mode or Hot-Seat
4. Enter player names
5. Click **Start Game**

That's it. No accounts, no downloads, no waiting.

## Browser Support

Works in any modern browser:
- Chrome / Edge 90+
- Firefox 88+
- Safari 14+

## Tech Stack

Built with vanilla HTML, CSS, and JavaScript — no frameworks, no build tools, no dependencies. The game is a single-page app with 14 JavaScript modules loaded via script tags. 148 end-to-end tests cover all game mechanics.

## License

This project is created for educational purposes. Exploding Kittens is a trademark of Exploding Kittens LLC.