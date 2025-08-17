class LineyLinkGame {
    constructor() {
        // Game state - no sensitive data exposed
        this.playerChain = [];
        this.selectedPlayer = null;
        this.gameComplete = false;
        this.gameFailed = false;
        this.attemptsRemaining = 3;
        this.maxWrongGuesses = 3;
        
        // Store attempts separately for each mode
        this.attemptsByMode = {
            easy: 3,
            hard: 3
        };
        
        // Data containers - will be loaded securely
        this.playerNames = new Map();
        this.connections = new Map();
        this.targetPlayers = { start: null, end: null };
        
        this.initializeElements();
        this.setupEventListeners(); // Set up event listeners once
        this.updateDifficultyUI(); // Initialize difficulty UI
        this.loadGameData();
    }
    
    loadGameState(puzzleDate) {
        const dateToUse = puzzleDate || this.currentPuzzleDate || new Date().toISOString().split('T')[0];
        const storageKey = `liney_${dateToUse}_${this.currentDifficulty}`;
        
        const savedState = localStorage.getItem(storageKey);
        if (savedState) {
            const state = JSON.parse(savedState);
            
            // Validate that saved state matches current target players
            const savedChain = state.playerChain || [];
            if (savedChain.length >= 2) {
                const savedStart = savedChain[0]?.id;
                const savedEnd = savedChain[savedChain.length - 1]?.id;
                
                // If saved target players don't match current puzzle, don't load this state
                if (savedStart !== this.targetPlayers.start || savedEnd !== this.targetPlayers.end) {
                    console.log('Saved state target players don\'t match current puzzle, not loading');
                    return false;
                }
            }
            
            this.playerChain = savedChain;
            this.attemptsRemaining = state.attemptsRemaining !== undefined ? state.attemptsRemaining : 3;
            this.gameComplete = state.completed || false;
            this.gameFailed = state.failed || false;
            // Update the mode-specific attempts tracker
            this.attemptsByMode[this.currentDifficulty] = this.attemptsRemaining;
            return true;
        }
        return false;
    }

    saveGameState() {
        const puzzleDate = this.currentPuzzleDate || new Date().toISOString().split('T')[0];
        const storageKey = `liney_${puzzleDate}_${this.currentDifficulty}`;
        
        const state = {
            playerChain: this.playerChain,
            attemptsRemaining: this.attemptsRemaining,
            completed: this.gameComplete,
            failed: this.gameFailed,
            timestamp: Date.now()
        };
        
        localStorage.setItem(storageKey, JSON.stringify(state));
        // Also update the mode-specific attempts tracker
        this.attemptsByMode[this.currentDifficulty] = this.attemptsRemaining;
    }

    initializeElements() {
        this.searchInput = document.getElementById('searchInput');
        this.suggestions = document.getElementById('suggestions');
        this.addButton = document.getElementById('addButton');
        this.errorMessage = document.getElementById('errorMessage');
        this.playersChain = document.getElementById('playersChain');
        this.completionModal = document.getElementById('completionModal');
        this.modalScore = document.getElementById('modalScore');
        this.shareButton = document.getElementById('shareButton');
        this.confetti = document.getElementById('confetti');
        this.guessCount = document.getElementById('guessCount');
        this.linematesLink = document.getElementById('linematesLink');
        this.linematestooltip = document.getElementById('linematestooltip');
        this.tooltipClose = document.getElementById('tooltipClose');
        this.howToPlayBtn = document.getElementById('howToPlayBtn');
        this.howToPlayModal = document.getElementById('howToPlayModal');
        this.howToPlayClose = document.getElementById('howToPlayClose');
        // this.debugButton = document.getElementById('debugButton'); // Debug button removed
        this.searchClear = document.getElementById('searchClear');
        this.difficultyToggle = document.getElementById('difficultyToggle');
        this.difficultyText = document.getElementById('difficultyText');
        this.easyLabel = document.querySelector('.easy-label');
        this.hardLabel = document.querySelector('.hard-label');
        
        // Game state
        this.currentDifficulty = 'easy'; // Default to easy
        this.currentPuzzleDate = null; // Track which day we're currently playing (null = today)
    }

    async loadGameData() {
        try {
            // Use current puzzle date or today's date if none set
            const puzzleDate = this.currentPuzzleDate || new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            console.log(`Loading puzzle for ${puzzleDate} in ${this.currentDifficulty} mode`);
            
            // Load all data files
            const [playersResponse, connectionsResponse, gameResponse] = await Promise.all([
                fetch('./web_data/players.json').then(response => {
                    console.log('Players fetch:', response.status, response.url);
                    return response;
                }),
                fetch('./web_data/connections.json').then(response => {
                    console.log('Connections fetch:', response.status, response.url);
                    return response;
                }),
                fetch(`./puzzles/${puzzleDate}-${this.currentDifficulty}.json`).then(response => {
                    console.log('Puzzle fetch:', response.status, response.url);
                    return response;
                }).catch((error) => {
                    // Fallback to a default puzzle if current date doesn't exist
                    console.warn(`No puzzle found for ${puzzleDate}, using fallback`, error);
                    return fetch(`./puzzles/2025-08-16-${this.currentDifficulty}.json`);
                })
            ]);

            const players = await playersResponse.json();
            const connections = await connectionsResponse.json();
            const gameData = await gameResponse.json();

            // Store data in Maps for secure access
            this.playerNames = new Map(players.map(p => [p.id, p.name]));
            this.connections = new Map(Object.entries(connections).map(([id, conns]) => 
                [id, new Set(conns)]  // Keep as string keys
            ));

            // Set up game
            this.targetPlayers.start = gameData.playerA;
            this.targetPlayers.end = gameData.playerB;
            
            // Check for saved game state
            const hasLoadedState = this.loadGameState(puzzleDate);
            if (!hasLoadedState) {
                // No saved state, use the stored attempts for this mode
                this.attemptsRemaining = this.attemptsByMode[this.currentDifficulty];
            }
            
            this.initializeGame();
            
        } catch (error) {
            console.error('Failed to load game data:', error);
            this.showError('Failed to load game. Please refresh the page.');
        }
    }

    initializeGame() {
        // If no saved chain or chain is empty, initialize with target players
        if (!this.playerChain || this.playerChain.length === 0) {
            this.playerChain = [
                { 
                    id: this.targetPlayers.start, 
                    name: this.playerNames.get(this.targetPlayers.start),
                    isTarget: true 
                },
                { 
                    id: this.targetPlayers.end, 
                    name: this.playerNames.get(this.targetPlayers.end),
                    isTarget: true 
                }
            ];
        }

        this.renderPlayerChain();
        this.enableInput();
        this.updateGuessCounter(); // Ensure counter is properly initialized
        
        // If game is already complete/failed, show "View Results" button instead of game
        if (this.gameComplete || this.gameFailed) {
            this.showViewResultsButton();
        }
    }

    setupEventListeners() {
        this.searchInput.addEventListener('input', (e) => this.handleSearchInput(e));
        this.searchInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Fix mobile keyboard issues
        let viewportHeight = window.innerHeight;
        
        this.searchInput.addEventListener('focus', () => {
            // Store the current viewport height before keyboard appears
            viewportHeight = window.innerHeight;
        });
        
        this.searchInput.addEventListener('blur', () => {
            // Force viewport reset after keyboard dismissal
            setTimeout(() => {
                // Force browser to recalculate viewport
                document.body.style.height = '100vh';
                window.scrollTo(0, 0);
                
                // Additional reset for stubborn mobile browsers
                setTimeout(() => {
                    document.body.style.height = '';
                    window.scrollTo(0, 0);
                }, 50);
            }, 100);
        });
        
        // Handle form submission (Enter key)
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.searchInput.blur();
            }
        });
        
        this.addButton.addEventListener('click', () => this.addLinkage());
        this.shareButton.addEventListener('click', () => {
            if (this.gameFailed) {
                this.shareFailure();
            } else {
                this.shareScore();
            }
        });
        // this.debugButton.addEventListener('click', () => this.loadRandomDay()); // Debug button removed
        this.difficultyToggle.addEventListener('change', () => this.handleDifficultyChange());
        this.searchClear.addEventListener('click', () => this.clearSearchInput());
        
        // Setup linemates tooltip
        this.setupLinematesTooltip();
        
        // Setup how-to-play modal
        this.setupHowToPlayModal();
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                this.hideSuggestions();
            }
        });
        
        // Close completion modal when clicking outside
        this.completionModal.addEventListener('click', (e) => {
            if (e.target === this.completionModal) {
                this.completionModal.style.display = 'none';
            }
        });
    }

    enableInput() {
        this.searchInput.disabled = false;
        this.searchInput.placeholder = 'Search for a player...';
    }

    handleDifficultyChange() {
        const isHard = this.difficultyToggle.checked;
        const previousMode = this.currentDifficulty;
        
        // Save current game state for the previous mode if there's meaningful progress
        // (more than just the initial target players, or game is complete/failed, or attempts used)
        const hasProgress = this.playerChain.length > 2 || this.gameComplete || this.gameFailed || this.attemptsRemaining < 3;
        if (hasProgress) {
            this.saveGameState();
        }
        
        // Update attempts tracking for the previous mode
        this.attemptsByMode[previousMode] = this.attemptsRemaining;
        
        // Switch to the new mode
        this.currentDifficulty = isHard ? 'hard' : 'easy';
        
        // Update UI
        this.updateDifficultyUI();
        
        // Clear any view results button
        const viewResultsBtn = document.getElementById('viewResultsBtn');
        if (viewResultsBtn) {
            viewResultsBtn.remove();
        }
        
        // Clear modal
        this.completionModal.style.display = 'none';
        
        // Clear search input and selection
        this.clearInput();
        
        // Reset game state variables for the new mode (these will be overridden if saved state exists)
        this.gameComplete = false;
        this.gameFailed = false;
        this.playerChain = [];
        this.selectedPlayer = null;
        
        // Load attempts for the new mode (this will be overridden if saved state exists)
        this.attemptsRemaining = this.attemptsByMode[this.currentDifficulty];
        
        // Reload the game with new difficulty
        this.loadGameData();
    }

    updateDifficultyUI() {
        const isHard = this.currentDifficulty === 'hard';
        
        // Update labels
        this.easyLabel.classList.toggle('active', !isHard);
        this.hardLabel.classList.toggle('active', isHard);
        
        // Update description
        this.difficultyText.textContent = isHard ? 'Can be solved in 2+ players' : 'Can be solved in 1 player';
        
        // Ensure toggle is in correct position
        this.difficultyToggle.checked = isHard;
    }

    handleSearchInput(e) {
        const query = e.target.value.trim();
        
        // Show/hide clear button based on input content
        if (e.target.value.length > 0) {
            this.searchClear.classList.add('show');
        } else {
            this.searchClear.classList.remove('show');
        }
        
        if (query.length < 2) {
            this.hideSuggestions();
            this.selectedPlayer = null;
            this.updateAddButton();
            return;
        }

        this.showSuggestions(query);
    }

    handleKeyDown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const firstSuggestion = this.suggestions.querySelector('.suggestion-item');
            if (firstSuggestion) {
                const playerId = parseInt(firstSuggestion.dataset.playerId);
                const playerName = firstSuggestion.textContent;
                this.selectPlayer(playerId, playerName);
            }
        } else if (e.key === 'Escape') {
            this.hideSuggestions();
        }
    }

    clearSearchInput() {
        this.searchInput.value = '';
        this.searchClear.classList.remove('show');
        this.selectedPlayer = null;
        this.updateAddButton();
        this.hideSuggestions();
        this.clearError();
        
        // Focus back on the input after clearing
        this.searchInput.focus();
    }

    showSuggestions(query) {
        const matches = this.searchPlayers(query);
        
        if (matches.length === 0) {
            this.hideSuggestions();
            return;
        }

        const html = matches.map(player => 
            `<div class="suggestion-item" data-player-id="${player.id}">${player.name}</div>`
        ).join('');
        
        this.suggestions.innerHTML = html;
        this.suggestions.style.display = 'block';

        // Add click listeners to suggestions
        this.suggestions.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const playerId = parseInt(item.dataset.playerId);
                const playerName = item.textContent;
                this.selectPlayer(playerId, playerName);
            });
        });
    }

    hideSuggestions() {
        this.suggestions.style.display = 'none';
    }

    searchPlayers(query) {
        const normalizedQuery = query.toLowerCase();
        const matches = [];
        
        // Search through player names
        for (const [id, name] of this.playerNames) {
            if (name.toLowerCase().includes(normalizedQuery)) {
                matches.push({ id, name });
                if (matches.length >= 10) break; // Limit results
            }
        }
        
        return matches.sort((a, b) => a.name.localeCompare(b.name));
    }

    selectPlayer(playerId, playerName) {
        this.selectedPlayer = { id: playerId, name: playerName };
        this.searchInput.value = playerName;
        this.hideSuggestions();
        this.updateAddButton();
        this.clearError();
    }

    updateAddButton() {
        this.addButton.disabled = !this.selectedPlayer || this.gameComplete || this.gameFailed;
    }

    addLinkage() {
        if (!this.selectedPlayer || this.gameComplete) return;

        const validation = this.validateLinkage(this.selectedPlayer.id);
        
        if (!validation.isValid) {
            this.showError(validation.error);
            return;
        }
        
        // Immediately blur input to dismiss keyboard on mobile
        if (document.activeElement === this.searchInput) {
            this.searchInput.blur();
        }

        // Add player to chain
        this.insertPlayerInChain(this.selectedPlayer, validation.insertionIndex);
        this.saveGameState();
        
        // Check if puzzle is complete
        if (this.isPuzzleComplete()) {
            this.completePuzzle();
        } else {
            this.clearInput();
        }
    }

    validateLinkage(playerId) {
        // Check if player is already in chain
        if (this.playerChain.some(p => p.id === playerId)) {
            return { isValid: false, error: 'Player is already in the chain!' };
        }

        // Find all players this new player connects to in the current chain
        const connectedToPlayers = [];
        for (let i = 0; i < this.playerChain.length; i++) {
            const chainPlayer = this.playerChain[i];
            if (this.arePlayersLinked(playerId, chainPlayer.id)) {
                connectedToPlayers.push({ player: chainPlayer, index: i });
            }
        }

        if (connectedToPlayers.length === 0) {
            // Wrong guess - decrement attempts
            this.attemptsRemaining--;
            this.updateGuessCounter();
            this.saveGameState();
            
            if (this.attemptsRemaining <= 0) {
                this.attemptsRemaining = 0; // Ensure it doesn't go below 0
                this.failGame();
            }
            
            return { 
                isValid: false, 
                error: `${this.selectedPlayer.name} is not connected to any player in the chain!` 
            };
        }

        // Find the best insertion point
        let insertionInfo = this.findBestInsertionPoint(connectedToPlayers);
        
        return { 
            isValid: true, 
            insertionIndex: insertionInfo.index,
            connectedTo: insertionInfo.connectedTo
        };
    }

    arePlayersLinked(playerId1, playerId2) {
        // Convert to strings since connections are stored as string keys
        const connections = this.connections.get(playerId1.toString());
        return connections && connections.has(playerId2);
    }

    findBestInsertionPoint(connectedToPlayers) {
        const startIndex = 0;
        const endIndex = this.playerChain.length - 1;
        
        // Sort connections by index
        connectedToPlayers.sort((a, b) => a.index - b.index);
        
        // Separate target and non-target connections
        const targetConnections = connectedToPlayers.filter(conn => 
            this.playerChain[conn.index].isTarget
        );
        const nonTargetConnections = connectedToPlayers.filter(conn => 
            !this.playerChain[conn.index].isTarget
        );
        
        // If connecting to non-target players, determine which chain they belong to
        if (nonTargetConnections.length > 0) {
            for (const conn of nonTargetConnections) {
                const connectedPlayer = this.playerChain[conn.index];
                
                // Check if this player is part of the "start chain"
                // (i.e., it has a connection path back to the start)
                if (conn.index > 0) {
                    const prevPlayer = this.playerChain[conn.index - 1];
                    if (this.arePlayersLinked(connectedPlayer.id, prevPlayer.id)) {
                        // This player is connected to its predecessor, so it's part of start chain
                        // Insert after it
                        return { index: conn.index + 1, connectedTo: 'start-chain' };
                    }
                }
                
                // Check if this player is part of the "end chain"  
                // (i.e., it has a connection path forward to the end)
                if (conn.index < this.playerChain.length - 1) {
                    const nextPlayer = this.playerChain[conn.index + 1];
                    if (this.arePlayersLinked(connectedPlayer.id, nextPlayer.id)) {
                        // This player is connected to its successor, so it's part of end chain
                        // Insert before it
                        return { index: conn.index, connectedTo: 'end-chain' };
                    }
                }
            }
            
            // If we can't determine the chain, default to inserting after
            const conn = nonTargetConnections[0];
            return { index: conn.index + 1, connectedTo: 'unknown-chain' };
        }
        
        // Only connecting to target players
        const connectedToStart = targetConnections.find(conn => conn.index === startIndex);
        const connectedToEnd = targetConnections.find(conn => conn.index === endIndex);
        
        if (connectedToStart && !connectedToEnd) {
            // Building from start
            return { index: 1, connectedTo: 'start' };
        }
        
        if (connectedToEnd && !connectedToStart) {
            // Building from end
            return { index: endIndex, connectedTo: 'end' };
        }
        
        if (connectedToStart && connectedToEnd) {
            // Connects both - completes the puzzle
            return { index: 1, connectedTo: 'both' };
        }
        
        // Fallback
        return { index: 1, connectedTo: 'fallback' };
    }

    insertPlayerInChain(player, insertionIndex) {
        const newPlayer = { ...player, isTarget: false };
        
        // Insert player at the specified index
        this.playerChain.splice(insertionIndex, 0, newPlayer);
        
        this.renderPlayerChain();
    }

    isPuzzleComplete() {
        // Must have at least one non-target player to be considered complete
        const hasNonTargetPlayer = this.playerChain.some(player => !player.isTarget);
        if (!hasNonTargetPlayer) {
            return false;
        }
        
        // Check if there's a complete chain from first to last player
        for (let i = 0; i < this.playerChain.length - 1; i++) {
            const currentPlayer = this.playerChain[i];
            const nextPlayer = this.playerChain[i + 1];
            
            if (!this.arePlayersLinked(currentPlayer.id, nextPlayer.id)) {
                return false;
            }
        }
        return true;
    }

    renderPlayerChain() {
        const html = this.playerChain.map((player, index) => {
            const cardClass = player.isTarget ? 'player-card target' : 'player-card linked';
            let connectionElement = '';
            
            // Add remove button for non-target players
            const removeButton = !player.isTarget && !this.gameComplete && !this.gameFailed ? 
                `<button class="remove-button" onclick="game.removePlayer(${player.id})" title="Remove player">×</button>` : '';
            
            if (index < this.playerChain.length - 1) {
                const nextPlayer = this.playerChain[index + 1];
                
                // Check if these two consecutive players are connected
                const areConnected = this.arePlayersLinked(player.id, nextPlayer.id);
                
                if (areConnected) {
                    connectionElement = '<div class="connection-line"></div>';
                } else {
                    connectionElement = '<div class="question-mark">?</div>';
                }
            }
            
            return `
                <div class="${cardClass}">
                    ${player.name}
                    ${removeButton}
                </div>
                ${connectionElement}
            `;
        }).join('');
        
        this.playersChain.innerHTML = html;
    }

    completePuzzle() {
        this.gameComplete = true;
        this.updateAddButton();
        this.searchInput.disabled = true;
        this.saveGameState();
        this.showConfetti();
        this.showCompletionModal();
    }

    showConfetti() {
        const colors = ['#89b4fa', '#cba6f7', '#f38ba8', '#fab387', '#a6e3a1', '#94e2d5'];
        
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const piece = document.createElement('div');
                piece.className = 'confetti-piece';
                piece.style.left = Math.random() * 100 + '%';
                piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                piece.style.animationDelay = Math.random() * 2 + 's';
                piece.style.animationDuration = (Math.random() * 2 + 2) + 's';
                
                this.confetti.appendChild(piece);
                
                setTimeout(() => piece.remove(), 5000);
            }, i * 50);
        }
    }

    showCompletionModal() {
        const chainLength = this.playerChain.length;
        const playerNames = this.playerChain.map(p => p.name);
        
        // Reset modal title to success state (in case it was changed by failure modal)
        const modalTitle = this.completionModal.querySelector('.modal-title');
        modalTitle.textContent = '🎉 Puzzle Complete!';
        modalTitle.style.color = '#a6e3a1';
        
        // Reset share button text
        this.shareButton.textContent = 'Copy Score';
        
        this.modalScore.innerHTML = `
            <strong>Your Solution (${chainLength} players):</strong><br><br>
            ${playerNames.join(' → ')}
        `;
        
        this.completionModal.style.display = 'flex';
        
        // Debug button removed
        // this.debugButton.style.display = 'inline-block';
    }

    shareScore() {
        const chainLength = this.playerChain.length;
        const playerNames = this.playerChain.map(p => p.name);
        
        // Get today's date in MM/DD/YY format
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const year = String(today.getFullYear()).slice(-2);
        const dateStr = `${month}/${day}/${year}`;
        
        // Build emoji grid representation
        const difficultyText = this.currentDifficulty === 'hard' ? 'Hard' : 'Easy';
        const errorsCount = 3 - this.attemptsRemaining;
        
        // Create rows for each attempt
        let emojiGrid = '';
        
        // Add failed attempts (red X between locks)
        for (let i = 0; i < errorsCount; i++) {
            emojiGrid += '🔒❌🔒\n';
        }
        
        // Add successful completion (chain between locks)
        if (this.currentDifficulty === 'easy') {
            // Easy mode: single chain emoji
            emojiGrid += '🔒⛓️🔒';
        } else {
            // Hard mode: number of chain emojis equals number of players used
            const chainEmojis = '⛓️'.repeat(chainLength);
            emojiGrid += `🔒${chainEmojis}🔒`;
        }
        
        // Build share text
        let shareContent = `Liney ${dateStr} (${difficultyText})\n\n${emojiGrid}`;
        
        if (this.currentDifficulty === 'hard') {
            const chainStr = playerNames.join(' → ');
            shareContent += `\n\n${chainStr}`;
        }
        
        const shareText = `${shareContent}\n\n${window.location.host}`;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareText).then(() => {
                this.shareButton.textContent = 'Copied!';
                setTimeout(() => {
                    this.shareButton.textContent = 'Copy Score';
                }, 2000);
            }).catch(() => {
                this.fallbackCopy(shareText);
            });
        } else {
            this.fallbackCopy(shareText);
        }
    }

    fallbackCopy(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.shareButton.textContent = 'Copied!';
            setTimeout(() => {
                this.shareButton.textContent = 'Copy Score';
            }, 2000);
        } catch (err) {
            this.shareButton.textContent = 'Copy failed';
            setTimeout(() => {
                this.shareButton.textContent = 'Copy Score';
            }, 2000);
        }
        
        document.body.removeChild(textArea);
    }

    startNewGame() {
        // Close modal
        this.completionModal.style.display = 'none';
        
        // Regenerate game data and reload
        this.regenerateGameData();
    }

    async regenerateGameData() {
        try {
            // Generate new game data
            const response = await fetch('./regenerate_game.py', { method: 'POST' });
            
            // If that fails, just reload the page to get new data
            window.location.reload();
        } catch (error) {
            // Fallback: just reload the page
            window.location.reload();
        }
    }

    async loadRandomDay() {
        try {
            // Generate a random date within the available puzzle range
            const startDate = new Date('2025-08-16'); // Base date
            const randomDays = Math.floor(Math.random() * 60); // Random day within 60 days
            const randomDate = new Date(startDate);
            randomDate.setDate(startDate.getDate() + randomDays);
            
            const randomDateStr = randomDate.toISOString().split('T')[0];
            
            // Try to load the random date's puzzle
            const gameResponse = await fetch(`./puzzles/${randomDateStr}-${this.currentDifficulty}.json`);
            
            if (gameResponse.ok) {
                const gameData = await gameResponse.json();
                
                // Set the current puzzle date to the random date we loaded
                this.currentPuzzleDate = randomDateStr;
                
                // Update the target players
                this.targetPlayers = {
                    start: gameData.playerA,
                    end: gameData.playerB
                };
                
                // Reset the game state completely
                this.playerChain = [
                    { id: this.targetPlayers.start, name: this.playerNames.get(this.targetPlayers.start), isTarget: true },
                    { id: this.targetPlayers.end, name: this.playerNames.get(this.targetPlayers.end), isTarget: true }
                ];
                
                // Use the reset method to ensure complete state reset
                this.resetGameState();
                
                // Close modal and update UI
                this.completionModal.style.display = 'none';
                this.renderPlayerChain();
                
                console.log(`Loaded random puzzle for ${randomDateStr}: ${this.playerNames.get(this.targetPlayers.start)} → ${this.playerNames.get(this.targetPlayers.end)}`);
            } else {
                // Fallback to reload if specific date not found
                window.location.reload();
            }
        } catch (error) {
            console.error('Error loading random day:', error);
            // Fallback: just reload the page
            window.location.reload();
        }
    }

    clearInput() {
        this.searchInput.value = '';
        this.searchClear.classList.remove('show');
        this.selectedPlayer = null;
        this.updateAddButton();
        this.hideSuggestions();
        this.clearError();
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.add('show');
        setTimeout(() => this.clearError(), 5000);
    }

    clearError() {
        this.errorMessage.classList.remove('show');
    }

    resetGameState() {
        // Reset all game state variables
        this.attemptsRemaining = 3;
        this.gameComplete = false;
        this.gameFailed = false;
        this.selectedPlayer = null;
        
        // Reset UI elements
        this.updateGuessCounter();
        this.clearInput();
        this.clearError();
        this.enableInput();
        
        // Reset modal title and button text in case they were changed
        const modalTitle = this.completionModal.querySelector('.modal-title');
        modalTitle.textContent = '🎉 Puzzle Complete!';
        modalTitle.style.color = '';
        this.shareButton.textContent = 'Copy Score';
    }

    updateGuessCounter() {
        this.guessCount.textContent = this.attemptsRemaining;
        
        // Remove danger class first
        this.guessCount.classList.remove('danger');
        
        // Add danger class if only 1 attempt remaining
        if (this.attemptsRemaining <= 1) {
            this.guessCount.classList.add('danger');
        }
    }
    
    showViewResultsButton() {
        // Hide the game area and show a "View Results" button
        this.searchInput.disabled = true;
        this.updateAddButton();
        
        // Clear the player chain display
        this.playersChain.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 20px;">
                <div style="color: #a6adc8; font-size: 1.1rem;">
                    ${this.gameComplete ? '✅ Puzzle Complete!' : '❌ Puzzle Failed'}
                </div>
                <button id="viewResultsBtn" style="
                    background: linear-gradient(135deg, #89b4fa 0%, #cba6f7 100%);
                    color: #11111b;
                    border: none;
                    border-radius: 25px;
                    padding: 15px 30px;
                    font-size: 1.1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                ">View Results</button>
            </div>
        `;
        
        // Add event listener to the button
        const viewResultsBtn = document.getElementById('viewResultsBtn');
        if (viewResultsBtn) {
            viewResultsBtn.addEventListener('click', () => {
                if (this.gameComplete) {
                    this.showCompletionModal();
                } else {
                    this.showFailureModal();
                }
            });
            
            // Add hover effect
            viewResultsBtn.addEventListener('mouseenter', () => {
                viewResultsBtn.style.transform = 'translateY(-2px)';
                viewResultsBtn.style.boxShadow = '0 5px 15px rgba(137, 180, 250, 0.4)';
            });
            
            viewResultsBtn.addEventListener('mouseleave', () => {
                viewResultsBtn.style.transform = 'translateY(0)';
                viewResultsBtn.style.boxShadow = 'none';
            });
        }
    }

    failGame() {
        this.gameFailed = true;
        this.searchInput.disabled = true;
        this.updateAddButton();
        this.saveGameState();
        
        // Show failure modal
        this.showFailureModal();
    }

    showFailureModal() {
        let solutionHtml = '';
        
        // Show solution for both easy and hard mode
        const solution = this.findShortestSolution();
        
        if (solution && solution.length > 0) {
            const solutionNames = solution.map(playerId => {
                return this.playerNames.get(playerId) || `Player ${playerId}`;
            });
            solutionHtml = `<br><br><strong>Shortest Solution (${solutionNames.length} players):</strong><br>
                <span style="color: #a6e3a1;">${solutionNames.join(' → ')}</span>`;
        }
        
        this.modalScore.innerHTML = `
            <strong style="color: #f38ba8;">Try again tomorrow.</strong><br><br>
            You've used all 3 attempts.<br>
            The puzzle was to connect:<br><br>
            <strong>${this.playerNames.get(this.targetPlayers.start)} → ${this.playerNames.get(this.targetPlayers.end)}</strong>
            ${solutionHtml}
        `;
        
        // Change modal title for failure
        const modalTitle = this.completionModal.querySelector('.modal-title');
        modalTitle.textContent = 'Game Over!';
        modalTitle.style.color = '#f38ba8';
        
        // Allow sharing for all failures
        this.shareButton.textContent = 'Share Result';
        this.shareButton.style.display = 'inline-block';
        
        this.completionModal.style.display = 'flex';
        
        // Debug button removed
        // this.debugButton.style.display = 'inline-block';
    }

    shareFailure() {
        // Get today's date in MM/DD/YY format
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const year = String(today.getFullYear()).slice(-2);
        const dateStr = `${month}/${day}/${year}`;
        
        const difficultyText = this.currentDifficulty === 'hard' ? 'Hard' : 'Easy';
        
        // Build emoji grid for failure (3 failed attempts)
        let emojiGrid = '';
        for (let i = 0; i < 3; i++) {
            emojiGrid += '🔒❌🔒';
            if (i < 2) emojiGrid += '\n'; // Add newline except for last row
        }
        
        const shareText = `Liney ${dateStr} (${difficultyText})\n\n${emojiGrid}\n\n${window.location.host}`;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareText).then(() => {
                this.shareButton.textContent = 'Copied!';
                setTimeout(() => {
                    this.shareButton.textContent = 'Share Result';
                }, 2000);
            }).catch(() => {
                this.fallbackCopy(shareText);
            });
        } else {
            this.fallbackCopy(shareText);
        }
    }

    removePlayer(playerId) {
        if (this.gameComplete || this.gameFailed) return;
        
        // Find the index of the player to remove
        const playerIndex = this.playerChain.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return;
        
        // Remove the player
        this.playerChain.splice(playerIndex, 1);
        
        // The chain has two parts: building from start (left) and building from end (right)
        // We need to identify which players belong to which side
        // Start from both ends and trace connections
        
        const startIndex = 0;
        const endIndex = this.playerChain.length - 1;
        const validPlayers = new Set();
        
        // Always keep the target players
        validPlayers.add(this.playerChain[startIndex].id);
        validPlayers.add(this.playerChain[endIndex].id);
        
        // Trace from start - add all players connected in sequence from start
        let lastValidFromStart = startIndex;
        for (let i = 1; i < this.playerChain.length - 1; i++) {
            const player = this.playerChain[i];
            const prevPlayer = this.playerChain[lastValidFromStart];
            
            if (this.arePlayersLinked(player.id, prevPlayer.id)) {
                validPlayers.add(player.id);
                lastValidFromStart = i;
            } else {
                // No more connections from start side
                break;
            }
        }
        
        // Trace from end - add all players connected in sequence from end
        let lastValidFromEnd = endIndex;
        for (let i = this.playerChain.length - 2; i > 0; i--) {
            const player = this.playerChain[i];
            const nextPlayer = this.playerChain[lastValidFromEnd];
            
            if (this.arePlayersLinked(player.id, nextPlayer.id)) {
                validPlayers.add(player.id);
                lastValidFromEnd = i;
            } else {
                // No more connections from end side
                break;
            }
        }
        
        // Remove all players not in the valid set
        this.playerChain = this.playerChain.filter(player => 
            player.isTarget || validPlayers.has(player.id)
        );
        
        this.renderPlayerChain();
        this.clearInput();
        this.saveGameState();
        
        // Check if puzzle is complete after removal
        if (this.isPuzzleComplete()) {
            this.completePuzzle();
        }
    }

    setupLinematesTooltip() {
        // Check if device supports hover (desktop)
        const supportsHover = window.matchMedia('(hover: hover)').matches;
        
        if (supportsHover && window.innerWidth >= 768) {
            // Desktop: hover behavior
            let hoverTimeout;
            
            this.linematesLink.addEventListener('mouseenter', () => {
                clearTimeout(hoverTimeout);
                this.linematestooltip.classList.add('desktop-hover');
                this.linematestooltip.classList.add('visible');
                
                // Position tooltip below the link
                const linkRect = this.linematesLink.getBoundingClientRect();
                const tooltipContent = this.linematestooltip.querySelector('.tooltip-content');
                tooltipContent.style.top = (linkRect.bottom + window.scrollY + 10) + 'px';
            });
            
            this.linematesLink.addEventListener('mouseleave', () => {
                hoverTimeout = setTimeout(() => {
                    this.linematestooltip.classList.remove('visible');
                }, 200);
            });
            
            // Keep tooltip open if hovering over it
            this.linematestooltip.addEventListener('mouseenter', () => {
                clearTimeout(hoverTimeout);
            });
            
            this.linematestooltip.addEventListener('mouseleave', () => {
                this.linematestooltip.classList.remove('visible');
            });
        }
        
        // Always add click behavior for mobile and as fallback
        this.linematesLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // If on desktop with hover support, don't show the modal
            if (supportsHover && window.innerWidth >= 768) {
                return;
            }
            
            this.linematestooltip.classList.remove('desktop-hover');
            this.linematestooltip.classList.add('show');
        });
        
        // Close button for modal
        this.tooltipClose.addEventListener('click', (e) => {
            e.stopPropagation();
            this.linematestooltip.classList.remove('show');
        });
        
        // Close on background click
        this.linematestooltip.addEventListener('click', (e) => {
            if (e.target === this.linematestooltip) {
                this.linematestooltip.classList.remove('show');
            }
        });
    }

    setupHowToPlayModal() {
        // Open modal on button click
        this.howToPlayBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.howToPlayModal.classList.add('show');
        });

        // Close modal on X button click
        this.howToPlayClose.addEventListener('click', () => {
            this.howToPlayModal.classList.remove('show');
        });

        // Close on background click
        this.howToPlayModal.addEventListener('click', (e) => {
            if (e.target === this.howToPlayModal) {
                this.howToPlayModal.classList.remove('show');
            }
        });
    }

    findShortestSolution() {
        // BFS to find shortest path between the two target players
        const startId = this.targetPlayers.start;
        const endId = this.targetPlayers.end;
        const visited = new Set();
        const queue = [[startId]];
        visited.add(startId);
        
        while (queue.length > 0) {
            const path = queue.shift();
            const currentId = path[path.length - 1];
            
            if (currentId === endId) {
                return path;
            }
            
            const connections = this.connections.get(currentId.toString());
            if (connections) {
                for (const nextId of connections) {
                    const nextIdNum = parseInt(nextId);
                    if (!visited.has(nextIdNum)) {
                        visited.add(nextIdNum);
                        queue.push([...path, nextIdNum]);
                    }
                }
            }
        }
        return null;
    }
}

// Initialize game when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    // Mobile viewport fix
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        // Set initial viewport height
        const setViewportHeight = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };
        
        setViewportHeight();
        window.addEventListener('resize', setViewportHeight);
        
        // Prevent background from shifting
        document.addEventListener('touchstart', () => {
            document.body.style.backgroundPosition = 'center';
        });
    }
    
    game = new LineyLinkGame();
});