class LineyLinkGame {
    constructor() {
        // Game state - no sensitive data exposed
        this.playerChain = [];
        this.selectedPlayer = null;
        this.gameComplete = false;
        this.gameFailed = false;
        this.wrongGuesses = 0;
        this.maxWrongGuesses = 3;
        
        // Data containers - will be loaded securely
        this.playerNames = new Map();
        this.connections = new Map();
        this.targetPlayers = { start: null, end: null };
        
        this.initializeElements();
        this.loadGameData();
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
        this.searchClear = document.getElementById('searchClear');
        this.debugButton = document.getElementById('debugButton');
    }

    async loadGameData() {
        try {
            // Get today's date for puzzle selection
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            
            // Load all data files
            const [playersResponse, connectionsResponse, gameResponse] = await Promise.all([
                fetch('./web_data/players.json'),
                fetch('./web_data/connections.json'),
                fetch(`./puzzles/${today}.json`).catch(() => {
                    // Fallback to a default puzzle if today's doesn't exist
                    console.warn(`No puzzle found for ${today}, using fallback`);
                    return fetch('./puzzles/2024-12-16.json'); // Use first available puzzle as fallback
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
            
            this.initializeGame();
            
        } catch (error) {
            console.error('Failed to load game data:', error);
            this.showError('Failed to load game. Please refresh the page.');
        }
    }

    initializeGame() {
        // Initialize player chain with target players
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

        this.renderPlayerChain();
        this.setupEventListeners();
        this.enableInput();
    }

    setupEventListeners() {
        this.searchInput.addEventListener('input', (e) => this.handleSearchInput(e));
        this.searchInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.addButton.addEventListener('click', () => this.addLinkage());
        this.searchClear.addEventListener('click', () => this.clearSearchInput());
        this.shareButton.addEventListener('click', () => {
            if (this.gameFailed) {
                this.shareFailure();
            } else {
                this.shareScore();
            }
        });
        this.debugButton.addEventListener('click', () => this.loadRandomDay());
        
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
    }

    enableInput() {
        this.searchInput.disabled = false;
        this.searchInput.placeholder = 'Search for a player...';
    }

    handleSearchInput(e) {
        const query = e.target.value.trim();
        
        // Show/hide clear button based on input
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
    
    clearSearchInput() {
        this.searchInput.value = '';
        this.searchClear.classList.remove('show');
        this.hideSuggestions();
        this.selectedPlayer = null;
        this.updateAddButton();
        this.searchInput.focus();
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

        // Add player to chain
        this.insertPlayerInChain(this.selectedPlayer, validation.insertionIndex);
        
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

        // Chain grows inward from two target players
        // Find the "innermost" connection points where new players can be added
        
        // If only 2 players (both targets), new player connects to either
        if (this.playerChain.length === 2) {
            const leftTarget = this.playerChain[0];
            const rightTarget = this.playerChain[1];
            
            const connectsToLeft = this.arePlayersLinked(playerId, leftTarget.id);
            const connectsToRight = this.arePlayersLinked(playerId, rightTarget.id);
            
            if (!connectsToLeft && !connectsToRight) {
                this.wrongGuesses++;
                this.updateGuessCounter();
                
                if (this.wrongGuesses >= this.maxWrongGuesses) {
                    this.failGame();
                }
                
                return { 
                    isValid: false, 
                    error: `${this.selectedPlayer.name} must connect to either ${leftTarget.name} or ${rightTarget.name}!` 
                };
            }
            
            // Insert in the middle between the two targets
            return { 
                isValid: true, 
                insertionIndex: 1,
                connectedTo: connectsToLeft && connectsToRight ? 'both' : (connectsToLeft ? 'left' : 'right')
            };
        }
        
        // For chains with more than 2 players, we need to find the "inner ends"
        // where new players can be added. The chain grows inward from both sides.
        
        let leftConnectionIndex, rightConnectionIndex;
        
        if (this.playerChain.length === 3) {
            // Special handling for 3-player chains
            // Need to check where the gap is and insert accordingly
            const leftTarget = this.playerChain[0];
            const middlePlayer = this.playerChain[1]; 
            const rightTarget = this.playerChain[2];
            
            // Check where the gap is
            const leftToMiddleConnected = this.arePlayersLinked(leftTarget.id, middlePlayer.id);
            const middleToRightConnected = this.arePlayersLinked(middlePlayer.id, rightTarget.id);
            
            console.log(`DEBUG: 3-player chain state:`);
            console.log(`  ${leftTarget.name} -> ${leftToMiddleConnected ? 'connected' : 'GAP'} -> ${middlePlayer.name} -> ${middleToRightConnected ? 'connected' : 'GAP'} -> ${rightTarget.name}`);
            
            const connectsToLeftTarget = this.arePlayersLinked(playerId, leftTarget.id);
            const connectsToMiddle = this.arePlayersLinked(playerId, middlePlayer.id);
            const connectsToRightTarget = this.arePlayersLinked(playerId, rightTarget.id);
            
            console.log(`DEBUG: ${this.selectedPlayer.name} connects to: Left=${connectsToLeftTarget}, Middle=${connectsToMiddle}, Right=${connectsToRightTarget}`);
            
            // Determine valid connection points based on gaps and existing connections
            let insertionIndex;
            let connectedTo;
            
            if (!leftToMiddleConnected && !middleToRightConnected) {
                // Two gaps - middle player is isolated
                if (connectsToLeftTarget) {
                    insertionIndex = 1; // Insert after left
                    connectedTo = 'left';
                } else if (connectsToRightTarget) {
                    insertionIndex = 2; // Insert before right
                    connectedTo = 'right';
                } else if (connectsToMiddle) {
                    // Can connect to middle - choose based on which target we also connect to
                    if (connectsToLeftTarget) {
                        insertionIndex = 1;
                    } else {
                        insertionIndex = 2;
                    }
                    connectedTo = 'middle';
                } else {
                    // No valid connection
                    this.wrongGuesses++;
                    this.updateGuessCounter();
                    if (this.wrongGuesses >= this.maxWrongGuesses) {
                        this.failGame();
                    }
                    return { 
                        isValid: false, 
                        error: `${this.selectedPlayer.name} must connect to either ${leftTarget.name}, ${middlePlayer.name}, or ${rightTarget.name}!` 
                    };
                }
            } else if (!leftToMiddleConnected) {
                // Gap between left and middle
                // Middle and right are connected
                // Valid connection points: left target OR middle player (but not right if middle is already connected to it)
                
                if (connectsToLeftTarget) {
                    insertionIndex = 1; // Bridge the gap from left side
                    connectedTo = 'left';
                } else if (connectsToMiddle) {
                    // Insert before middle to bridge the gap
                    insertionIndex = 1;
                    connectedTo = 'middle';
                } else {
                    this.wrongGuesses++;
                    this.updateGuessCounter();
                    if (this.wrongGuesses >= this.maxWrongGuesses) {
                        this.failGame();
                    }
                    return { 
                        isValid: false, 
                        error: `${this.selectedPlayer.name} must connect to either ${leftTarget.name} or ${middlePlayer.name}!` 
                    };
                }
            } else if (!middleToRightConnected) {
                // Gap between middle and right
                // Left and middle are connected
                // Valid connection points: middle player OR right target
                
                if (connectsToMiddle) {
                    insertionIndex = 2; // Insert after middle
                    connectedTo = 'middle';
                } else if (connectsToRightTarget) {
                    insertionIndex = 2; // Bridge the gap from right side
                    connectedTo = 'right';
                } else {
                    this.wrongGuesses++;
                    this.updateGuessCounter();
                    if (this.wrongGuesses >= this.maxWrongGuesses) {
                        this.failGame();
                    }
                    return { 
                        isValid: false, 
                        error: `${this.selectedPlayer.name} must connect to either ${middlePlayer.name} or ${rightTarget.name}!` 
                    };
                }
            } else {
                // No gaps - chain is complete
                return { 
                    isValid: false, 
                    error: `The chain is already complete!` 
                };
            }
            
            console.log(`DEBUG: Inserting at index ${insertionIndex}`);
            
            return { 
                isValid: true, 
                insertionIndex: insertionIndex,
                connectedTo: connectedTo
            };
        } else {
            // For longer chains, find the connection points by looking for gaps
            // A gap exists where consecutive players are not connected
            const connectionPoints = [];
            
            // Check for gaps in the chain and identify connection points
            for (let i = 0; i < this.playerChain.length - 1; i++) {
                const currentPlayer = this.playerChain[i];
                const nextPlayer = this.playerChain[i + 1];
                
                if (!this.arePlayersLinked(currentPlayer.id, nextPlayer.id)) {
                    // Gap found - both players on either side are connection points
                    connectionPoints.push({
                        player: currentPlayer,
                        index: i,
                        side: 'left'
                    });
                    connectionPoints.push({
                        player: nextPlayer,
                        index: i + 1,
                        side: 'right'
                    });
                }
            }
            
            // If no gaps, the chain is complete
            if (connectionPoints.length === 0) {
                this.wrongGuesses++;
                this.updateGuessCounter();
                
                if (this.wrongGuesses >= this.maxWrongGuesses) {
                    this.failGame();
                }
                
                return { 
                    isValid: false, 
                    error: `The chain is already complete!` 
                };
            }
            
            // Check if the new player connects to any of the connection points
            console.log(`DEBUG: Connection points found:`, connectionPoints.map(cp => `${cp.player.name} (index ${cp.index}, ${cp.side} side)`));
            
            const validConnections = connectionPoints.filter(cp => {
                // First check if the new player connects to this connection point
                if (!this.arePlayersLinked(playerId, cp.player.id)) {
                    console.log(`DEBUG: ${this.selectedPlayer.name} does NOT connect to ${cp.player.name}`);
                    return false;
                }
                
                console.log(`DEBUG: ${this.selectedPlayer.name} DOES connect to ${cp.player.name} (${cp.side} side)`);
                
                // Check if this connection point is already "occupied"
                const playerIndex = cp.index;
                
                if (cp.side === 'left') {
                    // We would insert after this player, check if there's already a player there
                    const nextIndex = playerIndex + 1;
                    if (nextIndex < this.playerChain.length) {
                        const nextPlayer = this.playerChain[nextIndex];
                        // If there's already a connection here, this slot is occupied
                        if (this.arePlayersLinked(cp.player.id, nextPlayer.id)) {
                            console.log(`DEBUG: ${cp.player.name} left slot occupied by ${nextPlayer.name}`);
                            return false;
                        }
                    }
                } else {
                    // We would insert before this player, check if there's already a player there
                    const prevIndex = playerIndex - 1;
                    if (prevIndex >= 0) {
                        const prevPlayer = this.playerChain[prevIndex];
                        // If there's already a connection here, this slot is occupied
                        if (this.arePlayersLinked(cp.player.id, prevPlayer.id)) {
                            console.log(`DEBUG: ${cp.player.name} right slot occupied by ${prevPlayer.name}`);
                            return false;
                        }
                    }
                }
                
                console.log(`DEBUG: ${cp.player.name} slot is available`);
                return true;
            });
            
            if (validConnections.length === 0) {
                this.wrongGuesses++;
                this.updateGuessCounter();
                
                if (this.wrongGuesses >= this.maxWrongGuesses) {
                    this.failGame();
                }
                
                const connectionNames = connectionPoints.map(cp => cp.player.name);
                const uniqueNames = [...new Set(connectionNames)];
                const namesDisplay = uniqueNames.join(' or ');
                
                return { 
                    isValid: false, 
                    error: `${this.selectedPlayer.name} must connect to either ${namesDisplay}!` 
                };
            }
            
            // Choose the best connection point and determine proper insertion
            let chosenConnection = validConnections[0];
            let insertionIndex;
            
            // Simple insertion logic: insert next to the connection point to bridge gaps
            chosenConnection = validConnections[0];
            
            if (chosenConnection.side === 'right') {
                // Right side of gap - insert before this player to bridge the gap
                insertionIndex = chosenConnection.index;
            } else {
                // Left side of gap - insert after this player to bridge the gap  
                insertionIndex = chosenConnection.index + 1;
            }
            
            console.log(`DEBUG: Inserting player at index ${insertionIndex}, connecting to ${chosenConnection.player.name} (${chosenConnection.side} side of gap)`);
            console.log(`DEBUG: Current chain:`, this.playerChain.map(p => p.name));
            console.log(`DEBUG: Valid connections:`, validConnections.map(vc => `${vc.player.name} (${vc.side})`));
            
            return { 
                isValid: true, 
                insertionIndex: insertionIndex,
                connectedTo: chosenConnection.side
            };
        }
    }

    arePlayersLinked(playerId1, playerId2) {
        // Convert to strings since connections are stored as string keys
        const connections = this.connections.get(playerId1.toString());
        return connections && connections.has(playerId2);
    }


    insertPlayerInChain(player, insertionIndex) {
        const newPlayer = { ...player, isTarget: false };
        
        // Insert player at the specified index
        this.playerChain.splice(insertionIndex, 0, newPlayer);
        
        this.renderPlayerChain();
    }

    isPuzzleComplete() {
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
        
        this.modalScore.innerHTML = `
            <strong>Your Solution (${chainLength} players):</strong><br><br>
            ${playerNames.join(' → ')}
        `;
        
        this.completionModal.style.display = 'flex';
        
        // Show debug button for completed games
        this.debugButton.style.display = 'inline-block';
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
        
        // Error display with emoji
        const perfectGame = this.wrongGuesses === 0;
        const errorEmoji = perfectGame ? '🎯' : '❌';
        const errorDisplay = perfectGame ? 'Perfect' : `${this.wrongGuesses} errors`;
        
        // Build share text with player chain
        const chainStr = playerNames.join(' → ');
        const shareText = `Liney ${dateStr}\n${chainLength} players - ${errorDisplay} ${errorEmoji}\n\n${chainStr}\n\n${window.location.host}`;
        
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
            const startDate = new Date('2025-8-16'); // Base date
            const randomDays = Math.floor(Math.random() * 60); // Random day within 60 days
            const randomDate = new Date(startDate);
            randomDate.setDate(startDate.getDate() + randomDays);
            
            const randomDateStr = randomDate.toISOString().split('T')[0];
            
            // Try to load the random date's puzzle
            const gameResponse = await fetch(`./puzzles/${randomDateStr}.json`);
            
            if (gameResponse.ok) {
                const gameData = await gameResponse.json();
                
                // Update the target players
                this.targetPlayers = {
                    start: gameData.playerA,
                    end: gameData.playerB
                };
                
                // Reset the game state
                this.playerChain = [
                    { id: this.targetPlayers.start, name: this.playerNames.get(this.targetPlayers.start), isTarget: true },
                    { id: this.targetPlayers.end, name: this.playerNames.get(this.targetPlayers.end), isTarget: true }
                ];
                this.wrongGuesses = 0;
                this.gameCompleted = false;
                this.gameFailed = false;
                
                // Close modal and update UI
                this.completionModal.style.display = 'none';
                this.renderPlayerChain();
                this.updateGuessCounter();
                this.clearInput();
                this.enableInput();
                
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
        this.searchClear.classList.remove('show');  // Hide the X button
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

    updateGuessCounter() {
        const remaining = this.maxWrongGuesses - this.wrongGuesses;
        this.guessCount.textContent = remaining;
        
        // Add danger class if only 1 guess remaining
        if (remaining <= 1) {
            this.guessCount.classList.add('danger');
        }
    }

    failGame() {
        this.gameFailed = true;
        this.searchInput.disabled = true;
        this.updateAddButton();
        
        // Show failure modal
        this.showFailureModal();
    }

    showFailureModal() {
        // Find the shortest solution
        const solution = this.findShortestSolution();
        
        let solutionHtml = '';
        if (solution && solution.length > 0) {
            const solutionNames = solution.map(playerId => {
                return this.playerNames.get(playerId) || `Player ${playerId}`;
            });
            solutionHtml = `<br><br><strong>Shortest Solution (${solutionNames.length} players):</strong><br>
                <span style="color: #a6e3a1;">${solutionNames.join(' → ')}</span>`;
        }
        
        this.modalScore.innerHTML = `
            <strong style="color: #f38ba8;">Game Over!</strong><br><br>
            You've used all 3 wrong guesses.<br>
            The puzzle was to connect:<br><br>
            <strong>${this.playerNames.get(this.targetPlayers.start)} → ${this.playerNames.get(this.targetPlayers.end)}</strong>
            ${solutionHtml}
        `;
        
        // Change modal title for failure
        const modalTitle = this.completionModal.querySelector('.modal-title');
        modalTitle.textContent = '💀 Better luck next time!';
        modalTitle.style.color = '#f38ba8';
        
        // Update share button to still allow sharing failure
        this.shareButton.textContent = 'Share Result';
        
        this.completionModal.style.display = 'flex';
        
        // Show debug button for failed games too
        this.debugButton.style.display = 'inline-block';
    }
    
    findShortestSolution() {
        // BFS to find shortest path between the two target players
        const startId = this.targetPlayers.start;
        const endId = this.targetPlayers.end;
        
        if (!startId || !endId) return null;
        
        const visited = new Set();
        const queue = [[startId]]; // Array of paths
        visited.add(startId);
        
        while (queue.length > 0) {
            const path = queue.shift();
            const currentId = path[path.length - 1];
            
            // Check if we reached the target
            if (currentId === endId) {
                return path;
            }
            
            // Get connections for current player
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
        
        return null; // No path found
    }

    shareFailure() {
        // Get today's date in MM/DD/YY format
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const year = String(today.getFullYear()).slice(-2);
        const dateStr = `${month}/${day}/${year}`;
        
        // For failed games, don't show partial progress - just show "No links found"
        const linksDisplay = 'No links found';
        
        // Build share text for failure
        const shareText = `Liney ${dateStr}\nFailed - 3 errors ❌\n\n${linksDisplay}\n\n${window.location.host}`;
        
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
        const playerIndex = this.playerChain.findIndex(player => player.id === playerId);
        if (playerIndex === -1 || this.playerChain[playerIndex].isTarget) return;
        
        // Determine which players to remove based on position
        // The chain grows inward, so removal cascades inward
        this.cascadeRemoval(playerIndex);
        
        this.renderPlayerChain();
        this.clearInput();
        
        // Check if puzzle is complete after removal
        if (this.isPuzzleComplete()) {
            this.completePuzzle();
        }
    }

    cascadeRemoval(removedIndex) {
        // Rule: When removing a player, also remove all players further from the target (toward the gap)
        // Keep only players closer to the target than the removed player
        
        const leftTarget = this.playerChain[0];
        const rightTarget = this.playerChain[this.playerChain.length - 1];
        
        // Find the gap (where there's no connection)
        let gapIndex = -1;
        for (let i = 0; i < this.playerChain.length - 1; i++) {
            if (!this.arePlayersLinked(this.playerChain[i].id, this.playerChain[i + 1].id)) {
                gapIndex = i; // Gap is between i and i+1
                break;
            }
        }
        
        const playersToKeep = [];
        
        // Always keep targets
        playersToKeep.push(leftTarget);
        
        if (gapIndex === -1) {
            // No gap - chain is complete, just remove the one player
            for (let i = 1; i < this.playerChain.length - 1; i++) {
                if (i !== removedIndex) {
                    playersToKeep.push(this.playerChain[i]);
                }
            }
        } else {
            // There's a gap - determine what to keep based on position
            if (removedIndex <= gapIndex) {
                // Removed player is in left segment (connected to left target)
                // Keep only players BEFORE the removed player (closer to left target)
                for (let i = 1; i < removedIndex; i++) {
                    playersToKeep.push(this.playerChain[i]);
                }
                // Also keep the right segment (everything after the gap)
                for (let i = gapIndex + 1; i < this.playerChain.length - 1; i++) {
                    playersToKeep.push(this.playerChain[i]);
                }
            } else {
                // Removed player is in right segment (connected to right target)
                // Keep the left segment (everything before the gap)
                for (let i = 1; i <= gapIndex; i++) {
                    playersToKeep.push(this.playerChain[i]);
                }
                // Keep only players AFTER the removed player (closer to right target)
                for (let i = removedIndex + 1; i < this.playerChain.length - 1; i++) {
                    playersToKeep.push(this.playerChain[i]);
                }
            }
        }
        
        playersToKeep.push(rightTarget);
        
        console.log(`DEBUG: Removed player at index ${removedIndex}, gap at ${gapIndex}`);
        console.log(`DEBUG: Keeping players:`, playersToKeep.map(p => p.name));
        
        this.playerChain = playersToKeep;
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
}

// Initialize game when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new LineyLinkGame();
});