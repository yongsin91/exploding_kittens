/**
 * Module 10: UI Renderer
 * 
 * Renders game state to DOM via observer pattern:
 * - Subscribes to GameState changes for reactive updates
 * - Renders game board: deck, discard, opponents, hand, log
 * - Card rendering with emoji + type-specific styling
 * - Opponent panels with card counts and status
 * - Action log with formatted entries
 * - Modal management driven by gameState.activeModal
 * - Action button state management (draw/end turn)
 * 
 * @module UIRenderer
 * @requires Modules 1, 3 (Constants, GameState)
 * @exports {Object} window.UIRenderer with rendering methods
 */

(function() {
    'use strict';

    window.debug('[Module 10: UI Renderer] Loading...');

    if (!window.CARD_TYPES || !window.GameState) {
        throw new Error('[Module 10] Missing dependencies. Modules 1, 3 required.');
    }

    // ========== DOM REFERENCES ==========

    let dom = {};

    /**
     * Cache DOM element references for performance.
     * @private
     */
    function cacheDOM() {
        dom = {
            // Screens
            setupScreen: document.getElementById('setup-screen'),
            gameScreen: document.getElementById('game-screen'),
            gameOverScreen: document.getElementById('game-over-screen'),

            // Game header
            deckCount: document.getElementById('deck-count'),
            currentPlayerName: document.getElementById('current-player-name'),
            discardPile: document.getElementById('discard-pile'),

            // Game board
            opponentsArea: document.getElementById('opponents-area'),
            actionLog: document.getElementById('action-log'),

            // Game footer
            playerHand: document.getElementById('player-hand'),
            drawBtn: document.getElementById('draw-btn'),
            endTurnBtn: document.getElementById('end-turn-btn'),

            // Game over
            winnerText: document.getElementById('winner-text'),

            // Modals
            peekModal: document.getElementById('peek-modal'),
            peekCards: document.getElementById('peek-cards'),
            defuseModal: document.getElementById('defuse-modal'),
            defuseDeckPicker: document.getElementById('defuse-deck-picker'),
            defuseConfirmBtn: document.getElementById('defuse-confirm-btn'),
            favorTargetModal: document.getElementById('favor-target-modal'),
            favorTargetList: document.getElementById('favor-target-list'),
            favorGiveModal: document.getElementById('favor-give-modal'),
            favorGiveCards: document.getElementById('favor-give-cards'),
            comboModal: document.getElementById('combo-modal'),
            comboCardSelector: document.getElementById('combo-card-selector'),
            comboConfirmBtn: document.getElementById('combo-confirm-btn'),
            nopeModal: document.getElementById('nope-modal'),
            nopeYesBtn: document.getElementById('nope-yes-btn'),
            nopeNoBtn: document.getElementById('nope-no-btn'),
            threeKindModal: document.getElementById('three-kind-modal'),
            cardNameSelect: document.getElementById('card-name-select'),
            threeKindConfirmBtn: document.getElementById('three-kind-confirm-btn'),
            discardBrowserModal: document.getElementById('discard-browser-modal'),
            discardCards: document.getElementById('discard-cards')
        };
    }

    // ========== CARD RENDERING ==========

    /**
     * Map card type to CSS class suffix.
     * @private
     */
    function getCardClass(cardType) {
        const classMap = {
            'exploding_kitten': 'exploding',
            'defuse': 'defuse',
            'attack': 'attack',
            'skip': 'skip',
            'favor': 'favor',
            'shuffle': 'shuffle',
            'see_future': 'see-future',
            'nope': 'nope',
            'tacocat': 'cat',
            'cattermelon': 'cat',
            'hairy_potato_cat': 'cat',
            'beard_cat': 'cat',
            'rainbow_cat': 'cat'
        };
        return classMap[cardType] || 'cat';
    }

    /**
     * Create a card DOM element.
     * @param {Object} card - Card instance { instanceId, type, emoji, name, cornerIcon }
     * @param {Object} [options] - Rendering options
     * @param {boolean} [options.clickable=false] - Add click handler
     * @param {boolean} [options.selected=false] - Show as selected
     * @param {boolean} [options.disabled=false] - Show as disabled
     * @param {boolean} [options.showCorner=true] - Show corner icons for cat cards
     * @param {Function} [options.onClick] - Click callback
     * @returns {HTMLElement} Card div element
     */
    function renderCard(card, options) {
        options = options || {};
        if (!card) {
            return document.createElement('div');
        }

        let clickable = options.clickable || false;
        let selected = options.selected || false;
        let disabled = options.disabled || false;
        let showCorner = options.showCorner !== false;
        let onClick = options.onClick || null;

        let cardEl = document.createElement('div');
        let cardClass = getCardClass(card.type);
        cardEl.classList.add('card');
        cardEl.classList.add('card--' + cardClass);
        cardEl.dataset.instanceId = card.instanceId || '';
        cardEl.dataset.cardType = card.type || '';

        if (selected) cardEl.classList.add('card--selected');
        if (disabled) cardEl.classList.add('card--disabled');

        // Emoji
        let emojiEl = document.createElement('span');
        emojiEl.className = 'card-emoji';
        emojiEl.textContent = card.emoji || '🃏';
        cardEl.appendChild(emojiEl);

        // Name
        let nameEl = document.createElement('span');
        nameEl.className = 'card-name';
        nameEl.textContent = card.name || card.type || 'Unknown';
        cardEl.appendChild(nameEl);

        // Corner icons for cat cards
        if (showCorner && card.cornerIcon) {
            let cornerTL = document.createElement('span');
            cornerTL.className = 'card-corner card-corner--tl';
            cornerTL.textContent = card.emoji || '';
            cardEl.appendChild(cornerTL);

            let cornerBR = document.createElement('span');
            cornerBR.className = 'card-corner card-corner--br';
            cornerBR.textContent = card.emoji || '';
            cardEl.appendChild(cornerBR);
        }

        // Click handler
        if (clickable && onClick && !disabled) {
            cardEl.style.cursor = 'pointer';
            cardEl.addEventListener('click', function() { onClick(card); });
            cardEl.setAttribute('role', 'button');
            cardEl.setAttribute('tabindex', '0');
            cardEl.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick(card);
                }
            });
        }

        return cardEl;
    }

    /**
     * Create a face-down card back element.
     * @returns {HTMLElement} Card back div
     */
    function renderCardBack() {
        let el = document.createElement('div');
        el.classList.add('card');
        el.classList.add('card-back');
        el.textContent = '🂠';
        return el;
    }

    // ========== GAME SCREEN RENDERING ==========

    /**
     * Main render function — called on every state change.
     * Dispatches to sub-renderers based on game phase.
     * @param {Object} state - Current game state
     */
    function render(state) {
        if (!state) return;

        // Game over phase
        if (state.gamePhase === 'game-over') {
            renderGameOver(state);
            return;
        }

        // Only render game screen if active
        if (state.gamePhase === 'active' || state.gamePhase === 'setup') {
            renderGameScreen(state);
        }

        // Handle modals (driven by activeModal)
        renderModals(state);
    }

    /**
     * Render the complete game screen.
     * @private
     */
    function renderGameScreen(state) {
        renderDeckInfo(state);
        renderDiscardPile(state);
        renderOpponents(state);
        renderPlayerHand(state);
        renderLog(state);
        updateActionButtons(state);
        updateCurrentPlayerName(state);
    }

    /**
     * Update current player name display.
     * @private
     */
    function updateCurrentPlayerName(state) {
        if (dom.currentPlayerName) {
            let player = state.players[state.currentPlayerIndex];
            dom.currentPlayerName.textContent = player
                ? player.name + "'s Turn"
                : 'Waiting...';
        }
    }

    /**
     * Render deck count info.
     * @private
     */
    function renderDeckInfo(state) {
        if (dom.deckCount) {
            dom.deckCount.textContent = state.drawPile.length;
        }
    }

    /**
     * Render discard pile (top card).
     * @private
     */
    function renderDiscardPile(state) {
        if (!dom.discardPile) return;

        dom.discardPile.innerHTML = '';

        if (state.discardPile.length > 0) {
            let topCard = state.discardPile[state.discardPile.length - 1];
            let cardEl = renderCard(topCard, { disabled: true });
            dom.discardPile.appendChild(cardEl);
        } else {
            let empty = document.createElement('span');
            empty.className = 'discard-empty';
            empty.textContent = 'Empty';
            dom.discardPile.appendChild(empty);
        }
    }

    /**
     * Render opponent panels.
     * @private
     */
    function renderOpponents(state) {
        if (!dom.opponentsArea) return;

        dom.opponentsArea.innerHTML = '';

        let currentPlayerId = state.currentPlayerIndex;

        state.players.forEach(function(player, index) {
            // Skip current player — they're shown in the hand area
            if (index === currentPlayerId) return;

            let panel = document.createElement('div');
            panel.className = 'opponent-panel';
            panel.dataset.playerId = player.id;

            if (!player.isAlive) {
                panel.classList.add('opponent-panel--dead');
            }

            // Player name
            let nameEl = document.createElement('div');
            nameEl.className = 'opponent-name';
            nameEl.textContent = player.name + (player.isAI ? ' 🤖' : '');
            if (!player.isAlive) {
                nameEl.textContent += ' 💀';
            }
            panel.appendChild(nameEl);

            // Card count (face-down cards)
            let cardCountEl = document.createElement('div');
            cardCountEl.className = 'opponent-card-count';
            cardCountEl.textContent = player.hand.length + ' cards';

            // Mini card backs
            let cardsVisual = document.createElement('div');
            cardsVisual.className = 'opponent-cards-visual';
            let maxVisible = Math.min(player.hand.length, 5);
            for (let i = 0; i < maxVisible; i++) {
                let back = document.createElement('span');
                back.className = 'card-back-mini';
                back.textContent = '🂠';
                cardsVisual.appendChild(back);
            }
            cardCountEl.appendChild(cardsVisual);
            panel.appendChild(cardCountEl);

            // Status indicator
            if (!player.isAlive) {
                let status = document.createElement('div');
                status.className = 'opponent-status opponent-status--dead';
                status.textContent = 'Exploded';
                panel.appendChild(status);
            }

            dom.opponentsArea.appendChild(panel);
        });
    }

    /**
     * Render current player's hand.
     * @private
     */
    function renderPlayerHand(state) {
        if (!dom.playerHand) return;

        dom.playerHand.innerHTML = '';

        let player = state.players[state.currentPlayerIndex];
        if (!player || !player.isAlive) return;

        // If current player is AI, don't render their cards face-up
        // Show a waiting message instead
        if (player.isAI) {
            let waitMsg = document.createElement('p');
            waitMsg.className = 'hand-empty';
            waitMsg.textContent = '🤖 ' + player.name + ' is thinking...';
            dom.playerHand.appendChild(waitMsg);
            return;
        }

        let turnPhase = state.turnPhase;
        let nopeActive = state.nopeWindowActive;
        let modalActive = state.activeModal !== null;
        let canPlay = (turnPhase === 'action') && !nopeActive && !modalActive;

        player.hand.forEach(function(card, index) {
            let cardEl = renderCard(card, {
                clickable: canPlay,
                disabled: !canPlay,
                onClick: function(clickedCard) {
                    // Delegate to event handler if available
                    if (window.Events && typeof window.Events.handleCardClick === 'function') {
                        window.Events.handleCardClick(clickedCard.instanceId);
                    }
                }
            });

            // Fan effect — slight rotation per card
            let totalCards = player.hand.length;
            let maxRotation = 15;
            let rotation = totalCards > 1
                ? (index - (totalCards - 1) / 2) * (maxRotation / Math.max(totalCards - 1, 1))
                : 0;
            cardEl.style.transform = 'rotate(' + rotation + 'deg)';

            dom.playerHand.appendChild(cardEl);
        });

        // If hand is empty, show message
        if (player.hand.length === 0) {
            let emptyMsg = document.createElement('p');
            emptyMsg.className = 'hand-empty';
            emptyMsg.textContent = 'No cards in hand — draw to end your turn';
            dom.playerHand.appendChild(emptyMsg);
        }
    }

    /**
     * Render action log (last 20 entries).
     * @private
     */
    function renderLog(state) {
        if (!dom.actionLog) return;

        dom.actionLog.innerHTML = '';

        let log = state.actionLog || [];
        let recentEntries = log.slice(-20);

        recentEntries.forEach(function(entry) {
            let logEl = document.createElement('div');
            logEl.className = 'log-entry';

            let time = entry.timestamp
                ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : '';

            let playerLabel = entry.playerName ? '[' + entry.playerName + '] ' : '';

            logEl.textContent = time + ' ' + playerLabel + (entry.description || '');
            dom.actionLog.appendChild(logEl);
        });

        // Auto-scroll to bottom
        dom.actionLog.scrollTop = dom.actionLog.scrollHeight;
    }

    /**
     * Update draw and end turn button states.
     * @private
     */
    function updateActionButtons(state) {
        let player = state.players[state.currentPlayerIndex];
        if (!player) return;

        let isCurrentPlayerHuman = player.isHuman;
        let phase = state.turnPhase;
        let nopeActive = state.nopeWindowActive;
        let modalActive = state.activeModal !== null;

        // Draw button: enabled during draw/play phase, not during nope/modal/defuse
        if (dom.drawBtn) {
            let canDraw = isCurrentPlayerHuman
                && (phase === 'action')
                && !nopeActive
                && !modalActive;
            dom.drawBtn.disabled = !canDraw;
        }

        // End turn button: enabled during draw or play phase
        // (player can end turn without playing cards — drawing is mandatory to end)
        if (dom.endTurnBtn) {
            let canEndTurn = isCurrentPlayerHuman
                && (phase === 'action')
                && !nopeActive
                && !modalActive;
            dom.endTurnBtn.disabled = !canEndTurn;
        }
    }

    // ========== MODAL RENDERING ==========

    /**
     * Render modals based on gameState.activeModal.
     * Opens the active modal, closes all others.
     * @private
     */
    function renderModals(state) {
        let activeModal = state.activeModal;
        let allModals = [
            'peek-modal', 'defuse-modal', 'favor-target-modal', 'favor-give-modal',
            'combo-modal', 'nope-modal', 'three-kind-modal', 'discard-browser-modal'
        ];

        // Close all modals first
        allModals.forEach(function(modalId) {
            let el = document.getElementById(modalId);
            if (el && el.classList.contains('modal--active') && modalId !== activeModal) {
                el.classList.remove('modal--active');
                el.setAttribute('aria-hidden', 'true');
            }
        });

        // Open active modal and populate content
        if (activeModal && allModals.indexOf(activeModal) !== -1) {
            let el = document.getElementById(activeModal);
            if (el) {
                el.classList.add('modal--active');
                el.setAttribute('aria-hidden', 'false');
            }

            // Populate modal content
            switch (activeModal) {
                case 'peek-modal':
                    renderPeekModal(state);
                    break;
                case 'defuse-modal':
                    renderDefuseModal(state);
                    break;
                case 'favor-target-modal':
                    renderFavorTargetModal(state);
                    break;
                case 'favor-give-modal':
                    renderFavorGiveModal(state);
                    break;
                case 'combo-modal':
                    renderComboModal(state);
                    break;
                case 'nope-modal':
                    renderNopeModal(state);
                    break;
                case 'three-kind-modal':
                    renderThreeKindModal(state);
                    break;
                case 'discard-browser-modal':
                    renderDiscardBrowserModal(state);
                    break;
            }
        }
    }

    /**
     * Render See the Future modal — show top 3 cards.
     * @private
     */
    function renderPeekModal(state) {
        if (!dom.peekCards) return;
        dom.peekCards.innerHTML = '';

        let cards = (state.modalData && state.modalData.peekedCards) || [];
        cards.forEach(function(card) {
            let cardEl = renderCard(card, { disabled: true });
            dom.peekCards.appendChild(cardEl);
        });
    }

    /**
     * Render Defuse placement modal — deck position picker.
     * @private
     */
    function renderDefuseModal(state) {
        if (!dom.defuseDeckPicker) return;
        dom.defuseDeckPicker.innerHTML = '';

        let deckSize = state.drawPile.length;

        // Create position selector
        let label = document.createElement('p');
        label.textContent = 'Choose a position (0 = top, ' + deckSize + ' = bottom):';
        dom.defuseDeckPicker.appendChild(label);

        let slider = document.createElement('input');
        slider.type = 'range';
        slider.id = 'defuse-position-slider';
        slider.min = '0';
        slider.max = String(deckSize);
        slider.value = String(Math.floor(deckSize / 2));
        slider.className = 'slider';
        dom.defuseDeckPicker.appendChild(slider);

        let valueDisplay = document.createElement('span');
        valueDisplay.className = 'slider-value';
        valueDisplay.textContent = slider.value;
        slider.addEventListener('input', function() {
            valueDisplay.textContent = slider.value;
        });
        dom.defuseDeckPicker.appendChild(valueDisplay);

        // Store reference for event handler
        dom.defusePositionSlider = slider;
    }

    /**
     * Render Favor target modal — list alive players.
     * @private
     */
    function renderFavorTargetModal(state) {
        if (!dom.favorTargetList) return;
        dom.favorTargetList.innerHTML = '';

        let data = state.modalData || {};
        let playerId = data.playerId;
        let alivePlayers = (state.players || []).filter(function(p) {
            return p.isAlive && p.id !== playerId;
        });

        alivePlayers.forEach(function(player) {
            let btn = document.createElement('button');
            btn.className = 'btn btn--secondary target-btn';
            btn.textContent = player.name + ' (' + player.hand.length + ' cards)';
            btn.dataset.playerId = player.id;
            btn.addEventListener('click', function() {
                if (window.Events && typeof window.Events.handleTargetSelect === 'function') {
                    window.Events.handleTargetSelect(player.id);
                }
            });
            dom.favorTargetList.appendChild(btn);
        });

        if (alivePlayers.length === 0) {
            let msg = document.createElement('p');
            msg.textContent = 'No players available to target.';
            dom.favorTargetList.appendChild(msg);
        }
    }

    /**
     * Render Favor give modal — target player selects card to give.
     * @private
     */
    function renderFavorGiveModal(state) {
        if (!dom.favorGiveCards) return;
        dom.favorGiveCards.innerHTML = '';

        let data = state.modalData || {};
        let targetPlayerId = data.targetPlayerId;
        let targetPlayer = targetPlayerId !== undefined ? state.players[targetPlayerId] : null;

        if (!targetPlayer) {
            let msg = document.createElement('p');
            msg.textContent = 'No player found.';
            dom.favorGiveCards.appendChild(msg);
            return;
        }

        let titleEl = document.getElementById('favor-give-title');
        if (titleEl) {
            titleEl.textContent = targetPlayer.name + ': Choose a Card to Give';
        }

        targetPlayer.hand.forEach(function(card) {
            let cardEl = renderCard(card, {
                clickable: true,
                onClick: function(clickedCard) {
                    if (window.Events && typeof window.Events.handleFavorGive === 'function') {
                        window.Events.handleFavorGive(clickedCard.instanceId);
                    }
                }
            });
            dom.favorGiveCards.appendChild(cardEl);
        });

        if (targetPlayer.hand.length === 0) {
            let emptyMsg = document.createElement('p');
            emptyMsg.textContent = 'No cards to give.';
            dom.favorGiveCards.appendChild(emptyMsg);
        }
    }

    /**
     * Render Combo builder modal — select cards for combo.
     * @private
     */
    function renderComboModal(state) {
        if (!dom.comboCardSelector) return;
        dom.comboCardSelector.innerHTML = '';

        let player = state.players[state.currentPlayerIndex];
        if (!player) return;

        let catCards = player.hand.filter(function(c) { return c.cornerIcon; });

        catCards.forEach(function(card) {
            let cardEl = renderCard(card, {
                clickable: true,
                onClick: function(clickedCard) {
                    cardEl.classList.toggle('card--selected');
                    if (window.Events && typeof window.Events.handleComboCardToggle === 'function') {
                        window.Events.handleComboCardToggle(clickedCard.instanceId);
                    }
                }
            });
            dom.comboCardSelector.appendChild(cardEl);
        });

        if (catCards.length === 0) {
            let msg = document.createElement('p');
            msg.textContent = 'No cat cards available for combos.';
            dom.comboCardSelector.appendChild(msg);
        }
    }

    /**
     * Render Nope modal — show nope prompt with stack info.
     * @private
     */
    function renderNopeModal(state) {
        let data = state.modalData || {};
        let nopeStack = data.nopeStack || [];
        let pendingAction = data.pendingAction || {};

        let titleEl = document.getElementById('nope-title');
        if (titleEl) {
            let nopeCount = nopeStack.length;
            let status = nopeCount % 2 === 1 ? 'CANCELLED' : 'PROCEEDS';
            titleEl.textContent = nopeCount > 0
                ? '⏱️ Nope Stack: ' + nopeCount + ' (' + status + ')'
                : '⏱️ Do you want to Nope?';
        }

        let descEl = document.querySelector('#nope-modal .modal-description');
        if (descEl) {
            descEl.textContent = pendingAction.description
                ? 'Action: ' + pendingAction.description
                : 'Another player played a card. Do you want to cancel it?';
        }
    }

    /**
     * Render Three of a Kind naming modal — dropdown of card types.
     * @private
     */
    function renderThreeKindModal(state) {
        if (!dom.cardNameSelect) return;
        dom.cardNameSelect.innerHTML = '';

        // Add all stealable card types as options
        let stealableTypes = [
            'exploding_kitten', 'defuse', 'nope', 'attack', 'skip',
            'favor', 'shuffle', 'see_future',
            'tacocat', 'cattermelon', 'hairy_potato_cat', 'beard_cat', 'rainbow_cat'
        ];

        stealableTypes.forEach(function(type) {
            let cardDef = window.CARD_TYPES[type];
            if (cardDef) {
                let option = document.createElement('option');
                option.value = type;
                option.textContent = cardDef.emoji + ' ' + cardDef.name;
                dom.cardNameSelect.appendChild(option);
            }
        });
    }

    /**
     * Render Discard browser modal — show discard pile cards.
     * @private
     */
    function renderDiscardBrowserModal(state) {
        if (!dom.discardCards) return;
        dom.discardCards.innerHTML = '';

        let discardPile = state.discardPile || [];

        // Show cards in reverse order (most recent first)
        let reversed = discardPile.slice().reverse();
        reversed.forEach(function(card) {
            let cardEl = renderCard(card, {
                clickable: true,
                onClick: function(clickedCard) {
                    if (window.Events && typeof window.Events.handleDiscardPick === 'function') {
                        window.Events.handleDiscardPick(clickedCard.instanceId);
                    }
                }
            });
            dom.discardCards.appendChild(cardEl);
        });

        if (discardPile.length === 0) {
            let msg = document.createElement('p');
            msg.textContent = 'Discard pile is empty.';
            dom.discardCards.appendChild(msg);
        }
    }

    // ========== GAME OVER ==========

    /**
     * Render game over screen with winner.
     * @private
     */
    function renderGameOver(state) {
        // Show game over screen
        if (dom.gameScreen) dom.gameScreen.classList.remove('screen--active');
        if (dom.gameOverScreen) dom.gameOverScreen.classList.add('screen--active');

        // Find winner
        let alivePlayers = (state.players || []).filter(function(p) { return p.isAlive; });
        let winner = alivePlayers.length === 1 ? alivePlayers[0] : null;

        if (dom.winnerText) {
            if (winner) {
                dom.winnerText.textContent = '🏆 ' + winner.name + ' wins!';
            } else {
                dom.winnerText.textContent = 'Game Over!';
            }
        }
    }

    // ========== PUBLIC API ==========

    /**
     * Initialize the UI renderer.
     * Caches DOM references and subscribes to GameState.
     */
    function init() {
        cacheDOM();
        window.GameState.subscribe(render);
        window.debug('[Module 10] Subscribed to GameState changes');
    }

    /**
     * Get the current defuse position slider value.
     * @returns {number} Selected position
     */
    function getDefusePosition() {
        if (dom.defusePositionSlider) {
            return parseInt(dom.defusePositionSlider.value, 10);
        }
        return 0;
    }

    /**
     * Get selected combo cards from combo modal.
     * @returns {Array} Array of selected card instance IDs
     */
    function getSelectedComboCards() {
        if (!dom.comboCardSelector) return [];
        let selected = dom.comboCardSelector.querySelectorAll('.card--selected');
        return Array.from(selected).map(function(el) { return el.dataset.instanceId; }).filter(Boolean);
    }

    /**
     * Get selected card name from three-kind modal.
     * @returns {string} Selected card type
     */
    function getSelectedCardName() {
        if (dom.cardNameSelect) {
            return dom.cardNameSelect.value;
        }
        return '';
    }

    /**
     * Force a manual re-render.
     */
    function forceRender() {
        render(window.GameState.getState());
    }

    window.UIRenderer = Object.freeze({
        init: init,
        render: render,
        renderCard: renderCard,
        renderCardBack: renderCardBack,
        forceRender: forceRender,
        getDefusePosition: getDefusePosition,
        getSelectedComboCards: getSelectedComboCards,
        getSelectedCardName: getSelectedCardName
    });

    window.debug('[Module 10: UI Renderer] Loaded ✓');
})();
