/**
 * Exploding Kittens - Main Application Controller
 * 
 * Manages:
 * - Setup screen interaction and validation
 * - Screen navigation and state management
 * - Form input handling
 * - Game initialization flow
 * 
 * @namespace GameApp
 */

(function() {
    'use strict';

    // ========== CONFIGURATION ==========
    const CONFIG = {
        MIN_PLAYERS: 2,
        MAX_PLAYERS: 5,
        DEFAULT_PLAYER_COUNT: 2,
        DEFAULT_GAME_MODE: 'ai',
        DEFAULT_AI_DIFFICULTY: 'medium'
    };

    // ========== SETUP STATE ==========
    const setupState = {
        playerCount: CONFIG.DEFAULT_PLAYER_COUNT,
        gameMode: CONFIG.DEFAULT_GAME_MODE,
        aiDifficulty: CONFIG.DEFAULT_AI_DIFFICULTY,
        playerNames: []
    };

    // ========== DOM ELEMENT CACHE ==========
    const DOM = {
        // Screens
        setupScreen: document.getElementById('setup-screen'),
        gameScreen: document.getElementById('game-screen'),
        gameOverScreen: document.getElementById('game-over-screen'),

        // Setup Form Elements
        setupForm: document.getElementById('setup-form'),
        playerCountSlider: document.getElementById('player-count-slider'),
        playerCountDisplay: document.getElementById('player-count-display'),
        difficultyGroup: document.getElementById('difficulty-group'),
        playerNamesContainer: document.getElementById('player-names-container'),
        aiDifficultySelect: document.getElementById('ai-difficulty'),
        startBtn: document.getElementById('start-btn'),

        // Mode Toggle Buttons
        modeToggles: document.querySelectorAll('[data-mode]'),

        // Game Screen Elements
        gameContainer: document.querySelector('.game-container'),
        playAgainBtn: document.getElementById('play-again-btn'),

        // Modals
        modals: document.querySelectorAll('.modal'),
        modalCloseButtons: document.querySelectorAll('[data-modal-close]'),
        modalOverlays: document.querySelectorAll('.modal-overlay')
    };

    // ========== UTILITY FUNCTIONS ==========

    /**
     * Log messages with namespace prefix
     * @param {string} message - Message to log
     * @param {string} [level='info'] - Log level (info, warn, error)
     */
    function log(message, level = 'info') {
        const prefix = '[GameApp]';
        // Always log errors and warnings; gate info/debug behind DEBUG flag
        if (level === 'error' || level === 'warn' || (window.GAME_CONFIG && window.GAME_CONFIG.DEBUG)) {
            console[level](`${prefix} ${message}`);
        }
    }

    /**
     * Validate setup state
     * @returns {object} Validation result { valid: boolean, errors: string[] }
     */
    function validateSetup() {
        const errors = [];

        if (setupState.playerCount < CONFIG.MIN_PLAYERS || setupState.playerCount > CONFIG.MAX_PLAYERS) {
            errors.push(`Player count must be between ${CONFIG.MIN_PLAYERS} and ${CONFIG.MAX_PLAYERS}`);
        }

        if (!setupState.gameMode) {
            errors.push('Game mode must be selected');
        }

        if (setupState.playerNames.length !== setupState.playerCount) {
            errors.push('All players must have names');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Update setup state with new values
     * @param {object} updates - Partial updates to apply
     */
    function updateSetupState(updates) {
        setupState.playerCount = updates.playerCount ?? setupState.playerCount;
        setupState.gameMode = updates.gameMode ?? setupState.gameMode;
        setupState.aiDifficulty = updates.aiDifficulty ?? setupState.aiDifficulty;
        setupState.playerNames = updates.playerNames ?? setupState.playerNames;
    }

    /**
     * Get default player name based on index and game mode
     * @param {number} index - Player index (0-based)
     * @returns {string} Default player name
     */
    function getDefaultPlayerName(index) {
        const isAI = setupState.gameMode === 'ai' && index > 0;
        return isAI ? `AI-${index}` : `Player ${index + 1}`;
    }

    // ========== SETUP SCREEN HANDLERS ==========

    /**
     * Handle player count slider change
     * @param {Event} event - Change event from slider
     */
    function handlePlayerCountChange(event) {
        const newCount = parseInt(event.target.value, 10);
        updateSetupState({ playerCount: newCount });
        DOM.playerCountDisplay.textContent = newCount;
        updatePlayerNameInputs();
        log(`Player count changed to ${newCount}`);
    }

    /**
     * Handle game mode toggle button click
     * @param {Event} event - Click event from toggle button
     */
    function handleModeToggle(event) {
        const mode = event.currentTarget.dataset.mode;
        updateSetupState({ gameMode: mode });
        updateModeToggleUI();
        updateDifficultyVisibility();
        log(`Game mode changed to ${mode}`);
    }

    /**
     * Handle AI difficulty selection change
     * @param {Event} event - Change event from select
     */
    function handleDifficultyChange(event) {
        updateSetupState({ aiDifficulty: event.target.value });
        log(`AI difficulty changed to ${event.target.value}`);
    }

    /**
     * Handle form submission
     * @param {Event} event - Submit event from form
     */
    function handleFormSubmit(event) {
        event.preventDefault();

        // Gather and validate player names
        gatherPlayerNames();

        // Validate setup
        const validation = validateSetup();
        if (!validation.valid) {
            validation.errors.forEach(error => log(error, 'warn'));
            return;
        }

        log(`Setup valid - Starting game with config:`, 'info');
        log(JSON.stringify(setupState), 'info');

        // Initialize game
        startGame();
    }

    // ========== PLAYER NAME MANAGEMENT ==========

    /**
     * Generate and render player name input fields
     * Updates DOM based on current player count and game mode
     */
    function updatePlayerNameInputs() {
        const container = DOM.playerNamesContainer;
        container.innerHTML = '';

        for (let i = 0; i < setupState.playerCount; i++) {
            const isAI = setupState.gameMode === 'ai' && i > 0;
            const defaultName = getDefaultPlayerName(i);
            const placeholder = isAI ? `AI Opponent ${i}` : `Player ${i + 1}`;

            // Create input group
            const group = document.createElement('div');
            group.className = 'player-input-group';

            // Create label
            const label = document.createElement('label');
            label.htmlFor = `player-name-${i}`;
            label.className = 'player-input-label';
            label.textContent = isAI ? 'AI' : `P${i + 1}:`;

            // Create input field
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `player-name-${i}`;
            input.className = 'player-name-input';
            input.placeholder = placeholder;
            input.value = setupState.playerNames[i] || defaultName;
            input.setAttribute('data-player-index', i);
            input.setAttribute('aria-label', `Name for ${isAI ? 'AI' : 'Player'} ${i + 1}`);
            input.maxLength = 20;

            group.appendChild(label);
            group.appendChild(input);
            container.appendChild(group);
        }

        log(`Updated player name inputs for ${setupState.playerCount} players`);
    }

    /**
     * Gather player names from input fields
     * Auto-generates default names for empty fields
     */
    function gatherPlayerNames() {
        setupState.playerNames = [];
        const inputs = DOM.playerNamesContainer.querySelectorAll('input');

        inputs.forEach((input, index) => {
            let name = input.value.trim();

            if (!name) {
                name = getDefaultPlayerName(index);
            }

            setupState.playerNames.push(name);
        });

        log(`Gathered player names: ${setupState.playerNames.join(', ')}`);
    }

    // ========== MODE & DIFFICULTY VISIBILITY ==========

    /**
     * Update mode toggle UI based on current game mode
     * Updates visual state and aria-pressed attributes
     */
    function updateModeToggleUI() {
        DOM.modeToggles.forEach(button => {
            const isActive = button.dataset.mode === setupState.gameMode;
            button.classList.toggle('toggle-btn--active', isActive);
            button.setAttribute('aria-pressed', isActive);
        });

        updatePlayerNameInputs();
    }

    /**
     * Show/hide AI difficulty selector based on game mode
     */
    function updateDifficultyVisibility() {
        const isAIMode = setupState.gameMode === 'ai';
        DOM.difficultyGroup.style.opacity = isAIMode ? '1' : '0.5';
        DOM.aiDifficultySelect.disabled = !isAIMode;

        const label = DOM.difficultyGroup.querySelector('.form-label');
        if (label) {
            label.style.color = isAIMode
                ? 'var(--color-text-light)'
                : 'var(--color-text-muted)';
        }
    }

    // ========== SCREEN NAVIGATION ==========

    /**
     * Display a specific screen and hide others
     * @param {string} screenId - ID of screen to show
     */
    function showScreen(screenId) {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => {
            screen.classList.remove('screen--active');
        });

        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('screen--active');
            log(`Screen changed to: ${screenId}`);
        } else {
            log(`Screen not found: ${screenId}`, 'warn');
        }
    }

    // ========== MODAL MANAGEMENT ==========

    /**
     * Close a modal by updating game state.
     * The UIRenderer reacts to the state change and handles all DOM manipulation.
     * This is the single entry point for user-initiated modal closing.
     * @param {string} modalId - ID of modal to close (used for combo cleanup)
     */
    function closeModal(modalId) {
        // Clear combo selection when closing combo modal
        if (modalId === 'combo-modal' && window.Events && typeof window.Events.clearComboSelection === 'function') {
            window.Events.clearComboSelection();
        }
        // Update state — UIRenderer.renderModals() will handle DOM changes
        if (window.GameState) {
            window.GameState.setState({ activeModal: null, modalData: {} });
        }
    }

    /**
     * Setup event listeners for all modal close buttons and overlays
     */
    function setupModalListeners() {
        // Modal close buttons
        DOM.modalCloseButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const modalId = e.currentTarget.dataset.modalClose;
                if (modalId) {
                    closeModal(modalId);
                }
            });
        });

        // Modal overlay clicks (close on backdrop click)
        DOM.modalOverlays.forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    const modal = overlay.closest('.modal');
                    if (modal) {
                        closeModal(modal.id);
                    }
                }
            });
        });

        log('Modal listeners registered');
    }

    // ========== GAME INITIALIZATION ==========

    /**
     * Initialize and start the game
     * Transitions from setup screen to game screen
     */
    function startGame() {
        try {
            log('Initializing game...');

            // Get setup configuration (use the public API or inline copy)
            const config = window.GameApp.getSetupState();

            // Initialize game via GameFlow controller
            if (window.GameFlow && typeof window.GameFlow.initGame === 'function') {
                window.GameFlow.initGame(config);
            } else {
                // Fallback: just show game screen
                showScreen('game-screen');
                log('GameFlow not available — showing game screen only', 'warn');
            }

            log('Game initialized successfully');
        } catch (error) {
            log(`Error starting game: ${error.message}`, 'error');
        }
    }

    // ========== RESET & RESTART ==========

    /**
     * Reset setup screen to initial state
     */
    function resetToSetupScreen() {
        updateSetupState({
            playerCount: CONFIG.DEFAULT_PLAYER_COUNT,
            gameMode: CONFIG.DEFAULT_GAME_MODE,
            aiDifficulty: CONFIG.DEFAULT_AI_DIFFICULTY,
            playerNames: []
        });

        // Reset form elements
        DOM.playerCountSlider.value = CONFIG.DEFAULT_PLAYER_COUNT;
        DOM.playerCountDisplay.textContent = CONFIG.DEFAULT_PLAYER_COUNT;
        DOM.aiDifficultySelect.value = CONFIG.DEFAULT_AI_DIFFICULTY;

        // Update UI
        updatePlayerNameInputs();
        updateModeToggleUI();
        updateDifficultyVisibility();

        // Show setup screen
        showScreen('setup-screen');

        log('Reset to setup screen');
    }

    // ========== EVENT LISTENER SETUP ==========

    /**
     * Attach all event listeners to DOM elements
     */
    function setupEventListeners() {
        // Player count slider
        DOM.playerCountSlider.addEventListener('change', handlePlayerCountChange);
        DOM.playerCountSlider.addEventListener('input', handlePlayerCountChange);

        // Mode toggle buttons
        DOM.modeToggles.forEach(button => {
            button.addEventListener('click', handleModeToggle);
        });

        // AI difficulty selector
        DOM.aiDifficultySelect.addEventListener('change', handleDifficultyChange);

        // Form submission
        DOM.setupForm.addEventListener('submit', handleFormSubmit);

        // Play again button
        DOM.playAgainBtn.addEventListener('click', resetToSetupScreen);

        // Modal listeners
        setupModalListeners();

        log('Event listeners attached');
    }

    // ========== INITIALIZATION ==========

    /**
     * Initialize the application
     * Called when DOM is ready
     */
    function init() {
        try {
            log('Initializing application...');

            // Setup event listeners
            setupEventListeners();

            // Initialize player name inputs
            updatePlayerNameInputs();

            // Initialize difficulty visibility
            updateDifficultyVisibility();

            // Initialize game event handlers
            if (window.Events && typeof window.Events.init === 'function') {
                window.Events.init();
            }

            log('Application initialized successfully');
        } catch (error) {
            log(`Initialization error: ${error.message}`, 'error');
        }
    }

    // ========== DOM READY CHECK & START ==========

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ========== EXPOSE PUBLIC API ==========

    /**
     * Public API exposed to global scope
     * Allows other modules to interact with the app
     */
    window.GameApp = {
        // Screen management
        showScreen,
        resetToSetupScreen,

        // Modal management
        closeModal,

        // State access (read-only)
        getSetupState: () => JSON.parse(JSON.stringify(setupState)),

        // Game control
        startGame,

        // Utility
        log
    };

    log('Module loaded successfully');
})();
