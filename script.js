        'use strict';

        const WORDS = [
            'SABLE', 'LUCES', 'MUNDO', 'FUEGO', 'NIEVE', 'CIELO', 'PIANO',
            'LIBRO', 'PERRO', 'GATOS', 'VERDE', 'NEGRO', 'TECHO', 'CAMPO',
            'NIÑOS', 'AÑEJO', 'CAÑON', 'LEÑOS', 'PIÑAS', 'PEÑAS', 'MOÑOS',
            'BAÑOS', 'SEÑAL', 'PUÑAL', 'TEÑIR', 'NIÑAS'
        ];
        const WORD_LENGTH = 5;
        const MAX_TRIES = 6;
        const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM'];
        const KEY_PRIORITY = { absent: 1, present: 2, correct: 3 };
        const STATS_STORAGE_KEY = 'acheronex-statistics';
        const DEFAULT_STATS = { played: 0, won: 0, currentStreak: 0, maxStreak: 0 };
        const RESULT_EMOJI = { correct: '\u{1F7E9}', present: '\u{1F7E8}', absent: '\u{1F7E5}' };

        let currentWord = '';
        let currentRow = 0;
        let currentTile = 0;
        let isGameOver = false;
        let gameStarted = false;
        let messageTimer = null;
        const keyStates = new Map();
        let attemptResults = [];
        let gameCounted = false;
        let statistics = loadStatistics();

        const board = document.getElementById('game-board');
        const msgContainer = document.getElementById('message-container');
        const resetBtn = document.getElementById('reset-btn');
        const startBtn = document.getElementById('start-btn');
        const tutorial = document.getElementById('tutorial-backdrop');
        const virtualKeyboard = document.getElementById('keyboard');
        const statsBtn = document.getElementById('stats-btn');
        const statsBackdrop = document.getElementById('stats-backdrop');
        const closeStatsBtn = document.getElementById('close-stats-btn');
        const doneStatsBtn = document.getElementById('done-stats-btn');
        const shareBtn = document.getElementById('share-btn');

        function initGame() {
            currentWord = WORDS[Math.floor(Math.random() * WORDS.length)];
            currentRow = 0;
            currentTile = 0;
            isGameOver = false;
            keyStates.clear();
            attemptResults = [];
            gameCounted = false;
            shareBtn.classList.add('hidden');
            clearTimeout(messageTimer);
            msgContainer.textContent = '';
            resetBtn.classList.add('hidden');
            board.replaceChildren();
            buildKeyboard();

            for (let rowIndex = 0; rowIndex < MAX_TRIES; rowIndex++) {
                const row = document.createElement('div');
                row.className = 'row';
                row.setAttribute('role', 'group');
                row.setAttribute('aria-label', `Intento ${rowIndex + 1}`);

                for (let column = 0; column < WORD_LENGTH; column++) {
                    const tile = document.createElement('div');
                    tile.className = 'tile';
                    tile.id = `tile-${rowIndex}-${column}`;
                    tile.dataset.row = String(rowIndex);
                    tile.dataset.column = String(column);
                    tile.setAttribute('aria-label', `Intento ${rowIndex + 1}, casilla ${column + 1}`);
                    row.appendChild(tile);
                }
                board.appendChild(row);
            }

            updateActiveTile();
        }

        function buildKeyboard() {
            virtualKeyboard.querySelectorAll('.keyboard-row').forEach(row => row.replaceChildren());
            KEY_ROWS.forEach((letters, rowIndex) => {
                const row = virtualKeyboard.querySelector(`[data-key-row="${rowIndex + 1}"]`);
                if (rowIndex === 2) row.appendChild(createActionKey('ENTER', 'ENTER'));
                for (const letter of letters) row.appendChild(createLetterKey(letter));
                if (rowIndex === 2) row.appendChild(createActionKey('BACKSPACE', '⌫'));
            });
        }

        function createLetterKey(letter) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'key';
            button.dataset.key = letter;
            button.textContent = letter;
            button.setAttribute('aria-label', letter);
            if (keyStates.has(letter)) button.dataset.state = keyStates.get(letter);
            return button;
        }

        function createActionKey(action, label) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'key action-key';
            button.dataset.key = action;
            if (action === 'BACKSPACE') {
                button.setAttribute('aria-label', 'Borrar letra');
                button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5H20V19H9L3 12L9 5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9L17 15M17 9L12 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
            } else {
                button.setAttribute('aria-label', 'Enter, confirmar palabra');
                button.textContent = label;
            }
            return button;
        }

        function updateActiveTile() {
            board.querySelectorAll('.tile').forEach(tile => {
                tile.removeAttribute('data-row-active');
                if (tile.dataset.row === String(currentRow)) tile.dataset.rowActive = 'true';
                if (tile.dataset.row === String(currentRow) && Number(tile.dataset.column) === currentTile && currentTile < WORD_LENGTH) {
                    tile.dataset.state = 'active';
                } else if (tile.dataset.state === 'active') {
                    tile.removeAttribute('data-state');
                }
            });
        }

        function handleInput(key) {
            if (!gameStarted || isGameOver) return;

            if (key === 'ENTER') {
                if (currentTile === WORD_LENGTH) checkWord();
                else showMessage('La palabra debe tener 5 letras.');
                return;
            }

            if (key === 'BACKSPACE') {
                if (currentTile > 0) {
                    currentTile--;
                    const tile = getTile(currentRow, currentTile);
                    tile.textContent = '';
                    tile.removeAttribute('data-state');
                    updateActiveTile();
                }
                return;
            }

            if (/^[A-ZÑ]$/.test(key) && currentTile < WORD_LENGTH) {
                const tile = getTile(currentRow, currentTile);
                tile.textContent = key;
                tile.removeAttribute('data-state');
                currentTile++;
                updateActiveTile();
            }
        }

        function getTile(row, column) {
            return document.getElementById(`tile-${row}-${column}`);
        }

        function editFromTile(tile) {
            if (!gameStarted || isGameOver || Number(tile.dataset.row) !== currentRow) return;
            const clickedColumn = Number(tile.dataset.column);
            for (let column = clickedColumn; column < WORD_LENGTH; column++) {
                const target = getTile(currentRow, column);
                target.textContent = '';
                target.removeAttribute('data-state');
            }
            currentTile = clickedColumn;
            updateActiveTile();
        }

        function checkWord() {
            const guess = Array.from({ length: WORD_LENGTH }, (_, column) => getTile(currentRow, column).textContent).join('');
            const remainingLetters = currentWord.split('');
            const results = Array(WORD_LENGTH).fill('absent');

            // Primero se marcan coincidencias exactas para contar bien las letras repetidas.
            for (let index = 0; index < WORD_LENGTH; index++) {
                if (guess[index] === currentWord[index]) {
                    results[index] = 'correct';
                    remainingLetters[index] = null;
                }
            }

            for (let index = 0; index < WORD_LENGTH; index++) {
                if (results[index] === 'correct') continue;
                const matchingIndex = remainingLetters.indexOf(guess[index]);
                if (matchingIndex !== -1) {
                    results[index] = 'present';
                    remainingLetters[matchingIndex] = null;
                }
            }

            attemptResults.push(results.slice());

            for (let index = 0; index < WORD_LENGTH; index++) {
                const tile = getTile(currentRow, index);
                tile.dataset.state = results[index];
                tile.removeAttribute('data-row-active');
                updateKeyColor(guess[index], results[index]);
            }

            if (guess === currentWord) {
                endGame('\u00a1Excelente! Has acertado.', true);
            } else if (currentRow === MAX_TRIES - 1) {
                endGame(`Fin del juego. La palabra era: ${currentWord}.`, false);
            } else {
                currentRow++;
                currentTile = 0;
                updateActiveTile();
            }
        }

        function updateKeyColor(letter, state) {
            const currentState = keyStates.get(letter);
            if (!currentState || KEY_PRIORITY[state] > KEY_PRIORITY[currentState]) keyStates.set(letter, state);
            const key = virtualKeyboard.querySelector(`[data-key="${letter}"]`);
            if (key) key.dataset.state = keyStates.get(letter);
        }

        function endGame(message, didWin) {
            if (gameCounted) return;
            gameCounted = true;
            isGameOver = true;
            statistics.played++;
            if (didWin) {
                statistics.won++;
                statistics.currentStreak++;
                statistics.maxStreak = Math.max(statistics.maxStreak, statistics.currentStreak);
            } else {
                statistics.currentStreak = 0;
            }
            saveStatistics();
            renderStatistics();
            showMessage(message, true);
            resetBtn.classList.remove('hidden');
            shareBtn.classList.remove('hidden');
        }

        function loadStatistics() {
            try {
                const saved = JSON.parse(localStorage.getItem(STATS_STORAGE_KEY));
                if (!saved || typeof saved !== 'object') return { ...DEFAULT_STATS };
                return Object.fromEntries(Object.keys(DEFAULT_STATS).map(key => [
                    key,
                    Number.isFinite(saved[key]) && saved[key] >= 0 ? Math.floor(saved[key]) : 0
                ]));
            } catch {
                return { ...DEFAULT_STATS };
            }
        }

        function saveStatistics() {
            try {
                localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(statistics));
            } catch {
                showMessage('No se pudieron guardar las estad\u00edsticas en este navegador.');
            }
        }

        function renderStatistics() {
            document.getElementById('stats-played').textContent = statistics.played;
            document.getElementById('stats-won').textContent = statistics.won;
            document.getElementById('stats-current-streak').textContent = statistics.currentStreak;
            document.getElementById('stats-max-streak').textContent = statistics.maxStreak;
        }

        function buildShareText() {
            const date = new Intl.DateTimeFormat('es-CO', {
                day: '2-digit', month: '2-digit', year: 'numeric'
            }).format(new Date());
            const rows = attemptResults.map(row => row.map(state => RESULT_EMOJI[state]).join(''));
            return `AcheronEX ${date}\n${attemptResults.length}/${MAX_TRIES}\n${rows.join('\n')}`;
        }

        async function shareResult() {
            try {
                await navigator.clipboard.writeText(buildShareText());
                showMessage('\u00a1Copiado al portapapeles!', true);
            } catch {
                showMessage('No se pudo copiar. Revisa los permisos del navegador.', true);
            }
        }

        function openStatistics() {
            renderStatistics();
            statsBackdrop.classList.remove('hidden');
            closeStatsBtn.focus();
        }

        function closeStatistics() {
            statsBackdrop.classList.add('hidden');
            statsBtn.focus();
        }

        function showMessage(message, persistent = false) {
            clearTimeout(messageTimer);
            msgContainer.textContent = message;
            if (!persistent) {
                messageTimer = setTimeout(() => {
                    if (!isGameOver) msgContainer.textContent = '';
                }, 2500);
            }
        }

        startBtn.addEventListener('click', () => {
            tutorial.classList.add('hidden');
            gameStarted = true;
            updateActiveTile();
        });

        resetBtn.addEventListener('click', initGame);
        statsBtn.addEventListener('click', openStatistics);
        closeStatsBtn.addEventListener('click', closeStatistics);
        doneStatsBtn.addEventListener('click', closeStatistics);
        statsBackdrop.addEventListener('click', event => {
            if (event.target === statsBackdrop) closeStatistics();
        });
        shareBtn.addEventListener('click', shareResult);
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !statsBackdrop.classList.contains('hidden')) closeStatistics();
        });

        board.addEventListener('click', event => {
            const tile = event.target.closest('.tile');
            if (tile) editFromTile(tile);
        });

        virtualKeyboard.addEventListener('click', event => {
            const keyButton = event.target.closest('[data-key]');
            if (keyButton) handleInput(keyButton.dataset.key);
        });

        document.addEventListener('keydown', event => {
            const key = event.key.toUpperCase();
            if (key === 'ENTER' || key === 'BACKSPACE' || /^[A-ZÑ]$/.test(key)) {
                if (gameStarted) event.preventDefault();
                handleInput(key);
            }
        });

        renderStatistics();
        initGame();
