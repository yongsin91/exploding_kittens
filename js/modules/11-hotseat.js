/**
 * Module 11: Hot-Seat Mode Controller
 * 
 * Manages local multiplayer hot-seat gameplay:
 * - Privacy screens between turns (hide opponent hands)
 * - "Pass device to next player" prompts
 * - Card reveal safety (only active player sees their hand)
 * - Favor interaction (target player sees "give card" screen)
 * - Nope window (each player gets to respond)
 * - See the Future privacy (only current player sees peek)
 * 
 * @module HotSeat
 * @requires Modules 3, 10 (GameState, UIRenderer)
 * @exports {Object} window.HotSeat
 */

(function() {
    'use strict';

    console.log('[Module 11: Hot-Seat Mode Controller] Loading...');

    if (!window.GameState || !window.UIRenderer) {
        throw new Error('[Module 11] Missing dependencies. Modules 3, 10 required.');
    }

    // ========== STATE ==========

    let isHotSeat = false;
    let passScreenActive = false;
    let pendingNopePlayerId = null;
    let nopePlayerQueue = [];

    // ========== PASS SCREEN ==========

    /**
     * Show full-screen "Pass device" overlay.
     * @param {string} playerName - Name of next player
     */
    function showPassScreen(playerName) {
        passScreenActive = true;

        // Create or show pass screen overlay
        let overlay = document.getElementById('pass-screen-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pass-screen-overlay';
            overlay.className = 'pass-screen-overlay';

            let content = document.createElement('div');
            content.className = 'pass-screen-content';

            let icon = document.createElement('div');
            icon.className = 'pass-screen-icon';
            icon.textContent = '📱';
            content.appendChild(icon);

            let title = document.createElement('h2');
            title.id = 'pass-screen-title';
            title.className = 'pass-screen-title';
            content.appendChild(title);

            let subtitle = document.createElement('p');
            subtitle.className = 'pass-screen-subtitle';
            subtitle.textContent = 'Make sure no one else can see the screen.';
            content.appendChild(subtitle);

            let btn = document.createElement('button');
            btn.id = 'pass-screen-btn';
            btn.className = 'btn btn--primary btn--large';
            btn.textContent = "I'm Ready";
            btn.addEventListener('click', function() {
                hidePassScreen();
            });
            content.appendChild(btn);

            overlay.appendChild(content);
            document.body.appendChild(overlay);
        }

        let titleEl = document.getElementById('pass-screen-title');
        if (titleEl) {
            titleEl.textContent = 'Pass device to ' + playerName;
        }

        overlay.classList.add('pass-screen--active');
        overlay.style.display = 'flex';
    }

    /**
     * Hide the pass screen overlay.
     */
    function hidePassScreen() {
        passScreenActive = false;
        let overlay = document.getElementById('pass-screen-overlay');
        if (overlay) {
            overlay.classList.remove('pass-screen--active');
            overlay.style.display = 'none';
        }

        // Force re-render to show current player's hand
        if (window.UIRenderer && typeof window.UIRenderer.forceRender === 'function') {
            window.UIRenderer.forceRender();
        }
    }

    /**
     * Check if pass screen is currently active.
     * @returns {boolean}
     */
    function isPassScreenActive() {
        return passScreenActive;
    }

    // ========== FAVOR GIVE SCREEN ==========

    /**
     * Show favor give screen for target player in hot-seat mode.
     * Swaps to target player's perspective temporarily.
     * @param {number} targetPlayerId - Player who must give a card
     */
    function showFavorGiveScreen(targetPlayerId) {
        let state = window.GameState.getState();
        let targetPlayer = state.players[targetPlayerId];
        if (!targetPlayer) return;

        // In hot-seat: show pass screen first, then favor give modal
        showPassScreen(targetPlayer.name);

        // After pass screen is dismissed, the favor-give-modal will be shown
        // by UIRenderer since activeModal is set to 'favor-give-modal'
        // The pass screen overlay covers the modal until dismissed
    }

    // ========== NOPE PROMPT ==========

    /**
     * Show nope prompt for hot-seat mode.
     * Iterates through alive players (except action initiator) offering nope chance.
     * @param {number} excludePlayerId - Player who initiated the action (cannot nope)
     */
    function showNopePrompt(excludePlayerId) {
        let state = window.GameState.getState();
        let alivePlayers = (state.players || []).filter(function(p) {
            return p.isAlive && p.id !== excludePlayerId;
        });

        // Build queue of players who might want to nope
        nopePlayerQueue = alivePlayers.map(function(p) { return p.id; });
        pendingNopePlayerId = null;

        // Start with first player
        processNextNopePlayer();
    }

    /**
     * Process the next player in the nope queue.
     * @private
     */
    function processNextNopePlayer() {
        if (nopePlayerQueue.length === 0) {
            // No more players to ask — auto-close nope window
            pendingNopePlayerId = null;
            if (window.Nope && typeof window.Nope.closeNopeWindow === 'function') {
                window.Nope.closeNopeWindow();
            }
            return;
        }

        let nextPlayerId = nopePlayerQueue.shift();
        let state = window.GameState.getState();
        let player = state.players[nextPlayerId];

        if (!player || !player.isAlive) {
            processNextNopePlayer();
            return;
        }

        // Check if player has a Nope card
        if (window.Nope && typeof window.Nope.canPlayerNope === 'function') {
            if (!window.Nope.canPlayerNope(nextPlayerId)) {
                processNextNopePlayer();
                return;
            }
        }

        pendingNopePlayerId = nextPlayerId;

        // Show pass screen for this player, then nope modal
        showPassScreen(player.name);
    }

    /**
     * Get the current player being asked about nope.
     * @returns {number|null}
     */
    function getPendingNopePlayerId() {
        return pendingNopePlayerId;
    }

    /**
     * Handle nope response from current player in queue.
     * @param {boolean} wantNope - Whether player wants to nope
     */
    function handleNopeResponse(wantNope) {
        let playerId = pendingNopePlayerId;

        if (wantNope && playerId !== null) {
            if (window.Nope && typeof window.Nope.playNope === 'function') {
                window.Nope.playNope(playerId);
            }
            // After a nope, other players can counter-nope
            // Re-build queue with remaining alive players
            let state = window.GameState.getState();
            let action = window.Nope ? window.Nope.getPendingAction() : null;
            let originalPlayerId = action ? action.playerId : null;
            nopePlayerQueue = (state.players || []).filter(function(p) {
                return p.isAlive && p.id !== playerId && p.id !== originalPlayerId;
            }).map(function(p) { return p.id; });
        }

        pendingNopePlayerId = null;
        processNextNopePlayer();
    }

    // ========== PRIVACY GUARDS ==========

    /**
     * Ensure only current player's hand is visible.
     * Called after every state change in hot-seat mode.
     */
    function hideHandForNonCurrentPlayers() {
        let state = window.GameState.getState();
        if (!state.players || state.players.length === 0) return;

        // In hot-seat, opponents area should show card backs only
        // (UIRenderer already does this — this is a safety check)
        let hand = document.getElementById('player-hand');
        if (hand && passScreenActive) {
            // Hide hand completely during pass screen
            hand.style.visibility = 'hidden';
        } else if (hand) {
            hand.style.visibility = '';
        }
    }

    /**
     * Check if current game is in hot-seat mode.
     * @returns {boolean}
     */
    function isHotSeatMode() {
        return isHotSeat;
    }

    /**
     * Set hot-seat mode.
     * @param {boolean} value
     */
    function setHotSeatMode(value) {
        isHotSeat = !!value;
    }

    // ========== TURN TRANSITION ==========

    /**
     * Called by flow controller on turn start.
     * Shows pass screen if in hot-seat mode.
     * @param {number} playerId - Next player's ID
     */
    function onTurnStart(playerId) {
        if (!isHotSeat) return;

        let state = window.GameState.getState();
        let player = state.players[playerId];
        if (!player) return;

        // Don't show pass screen for dead players
        if (!player.isAlive) return;

        showPassScreen(player.name);
    }

    /**
     * Called when a player needs to respond to a favor request.
     * In hot-seat, shows pass screen for target player.
     * @param {number} targetPlayerId
     */
    function onFavorRequest(targetPlayerId) {
        if (!isHotSeat) return;
        showFavorGiveScreen(targetPlayerId);
    }

    /**
     * Called when a nope window opens.
     * In hot-seat, iterates through players.
     * @param {number} excludePlayerId - Player who initiated action
     */
    function onNopeWindow(excludePlayerId) {
        if (!isHotSeat) return;
        showNopePrompt(excludePlayerId);
    }

    /**
     * Hide all special screens (pass screen, etc).
     */
    function hideSpecialScreens() {
        hidePassScreen();
        pendingNopePlayerId = null;
        nopePlayerQueue = [];
    }

    // ========== SEE THE FUTURE PRIVACY ==========

    /**
     * Called before showing peek modal.
     * In hot-seat, ensures only current player sees it.
     * @param {number} playerId - Player who played See the Future
     */
    function onPeekStart(playerId) {
        if (!isHotSeat) return;

        let state = window.GameState.getState();
        let player = state.players[playerId];
        if (!player) return;

        // If it's not the current viewer's turn, show pass screen first
        if (state.currentPlayerIndex !== playerId) {
            showPassScreen(player.name);
        }
    }

    // ========== CLEANUP ==========

    /**
     * Reset hot-seat controller state.
     */
    function reset() {
        hidePassScreen();
        isHotSeat = false;
        pendingNopePlayerId = null;
        nopePlayerQueue = [];
    }

    // ========== PUBLIC API ==========

    window.HotSeat = Object.freeze({
        // Pass screen
        showPassScreen: showPassScreen,
        hidePassScreen: hidePassScreen,
        isPassScreenActive: isPassScreenActive,

        // Favor
        showFavorGiveScreen: showFavorGiveScreen,
        onFavorRequest: onFavorRequest,

        // Nope
        showNopePrompt: showNopePrompt,
        handleNopeResponse: handleNopeResponse,
        getPendingNopePlayerId: getPendingNopePlayerId,

        // Privacy
        hideHandForNonCurrentPlayers: hideHandForNonCurrentPlayers,
        onPeekStart: onPeekStart,

        // Mode
        isHotSeatMode: isHotSeatMode,
        setHotSeatMode: setHotSeatMode,

        // Turn transitions
        onTurnStart: onTurnStart,
        onNopeWindow: onNopeWindow,

        // Utility
        hideSpecialScreens: hideSpecialScreens,
        reset: reset
    });

    console.log('[Module 11: Hot-Seat Mode Controller] Loaded ✓');
})();
