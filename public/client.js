const socket = io();

// DOM Elements
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.getElementById('game-container');
const btnCreate = document.getElementById('btn-create-room');
const btnJoin = document.getElementById('btn-join-room');
const inputCode = document.getElementById('input-room-code');
const lobbyError = document.getElementById('lobby-error');

const displayRoomCode = document.getElementById('display-room-code');
const displayColor = document.getElementById('display-color');
const chessboard = document.getElementById('chessboard');
const turnText = document.getElementById('turn-text');
const btnSpin = document.getElementById('btn-spin');
const slots = [document.getElementById('slot-0'), document.getElementById('slot-1'), document.getElementById('slot-2')];
const statusMsg = document.getElementById('status-msg');
const promoPanel = document.getElementById('promotion-panel');
const promoButtons = document.querySelectorAll('.btn-promo');

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const btnSendChat = document.getElementById('btn-send-chat');

// Donation Modal Elements
const donateModal = document.getElementById('donate-modal');
const btnLobbyDonate = document.getElementById('btn-lobby-donate');
const btnGameDonate = document.getElementById('btn-game-donate');
const btnCloseModal = document.getElementById('close-modal');

// State
let roomCode = null;
let myColor = null;
let gameState = null;
let legalMoves = [];
let selectedSquare = null;

// Audio Context for synthetic sounds
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, type, duration) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
}
const sounds = {
    spin: () => playTone(600, 'sine', 0.1),
    click: () => playTone(800, 'sine', 0.05),
    move: () => playTone(400, 'triangle', 0.1),
    capture: () => playTone(200, 'sawtooth', 0.2),
    promote: () => playTone(1200, 'sine', 0.3),
    error: () => playTone(150, 'square', 0.3),
    win: () => { playTone(500, 'sine', 0.2); setTimeout(()=>playTone(600, 'sine', 0.4), 200); }
};

// SVG Assets
const pieceAssets = {
    'W_Pawn': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45"><path d="M22 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-2.78-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="%23fff" stroke="%23000" stroke-width="1.5"/></svg>',
    'W_Knight': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45"><path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" fill="%23fff" stroke="%23000" stroke-width="1.5"/><path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" fill="%23fff" stroke="%23000" stroke-width="1.5"/></svg>',
    'W_Bishop': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45"><g fill="%23fff" stroke="%23000" stroke-width="1.5"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/></g></svg>',
    'W_Rook': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45"><g fill="%23fff" stroke="%23000" stroke-width="1.5"><path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5"/><path d="M34 14l-3 3H14l-3-3"/><path d="M31 17v12.5H14V17"/><path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/><path d="M11 14h23"/></g></svg>',
    'W_Queen': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45"><g fill="%23fff" stroke="%23000" stroke-width="1.5"><path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM24.5 7.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0z"/><path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-13.5V25l-7-11 2 12zM9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z"/><path d="M11 38.5a35 35 0 0 0 23 0" fill="none"/></g></svg>',
    'W_King': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45"><g fill="%23fff" stroke="%23000" stroke-width="1.5"><path d="M22.5 11.63V6M20 8h5"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10.5 5 10.5v7z"/><path d="M11.5 30c5.5-3 15.5-3 21 0M11.5 33.5c5.5-3 15.5-3 21 0M11.5 37c5.5-3 15.5-3 21 0"/></g></svg>',
    'B_Pawn': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45"><path d="M22 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-2.78-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="%23000" stroke="%23fff" stroke-width="1.5"/></svg>',
    'B_Knight': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45"><path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" fill="%23000" stroke="%23fff" stroke-width="1.5"/><path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" fill="%23000" stroke="%23fff" stroke-width="1.5"/></svg>',
    'B_Bishop': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45"><g fill="%23000" stroke="%23fff" stroke-width="1.5"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/></g></svg>',
    'B_Rook': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45"><g fill="%23000" stroke="%23fff" stroke-width="1.5"><path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5"/><path d="M34 14l-3 3H14l-3-3"/><path d="M31 17v12.5H14V17"/><path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/><path d="M11 14h23"/></g></svg>',
    'B_Queen': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45"><g fill="%23000" stroke="%23fff" stroke-width="1.5"><path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM24.5 7.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0z"/><path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-13.5V25l-7-11 2 12zM9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z"/><path d="M11 38.5a35 35 0 0 0 23 0" fill="none"/></g></svg>',
    'B_King': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45"><g fill="%23000" stroke="%23fff" stroke-width="1.5"><path d="M22.5 11.63V6M20 8h5"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10.5 5 10.5v7z"/><path d="M11.5 30c5.5-3 15.5-3 21 0M11.5 33.5c5.5-3 15.5-3 21 0M11.5 37c5.5-3 15.5-3 21 0"/></g></svg>'
};

function initBoard() {
    chessboard.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let displayR = myColor === 'B' ? 7 - r : r;
            let displayC = myColor === 'B' ? 7 - c : c;

            const sq = document.createElement('div');
            sq.classList.add('square');
            sq.classList.add((displayR + displayC) % 2 === 0 ? 'light' : 'dark');
            sq.dataset.r = displayR;
            sq.dataset.c = displayC;
            
            sq.addEventListener('click', () => onSquareClick(displayR, displayC));
            chessboard.appendChild(sq);
        }
    }
}

function renderBoard() {
    if (!gameState) return;
    
    // Clear old state
    document.querySelectorAll('.square').forEach(sq => {
        sq.innerHTML = '';
        sq.classList.remove('selected', 'legal-hint', 'capture');
    });

    // Draw pieces
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let p = gameState.board[r][c];
            if (p) {
                let sq = document.querySelector(`.square[data-r="${r}"][data-c="${c}"]`);
                if (sq) {
                    let pieceDiv = document.createElement('div');
                    pieceDiv.classList.add('piece');
                    pieceDiv.style.backgroundImage = `url('${pieceAssets[p.color + '_' + p.type]}')`;
                    sq.appendChild(pieceDiv);
                }
            }
        }
    }

    // Draw selections & hints
    if (selectedSquare) {
        let sq = document.querySelector(`.square[data-r="${selectedSquare.r}"][data-c="${selectedSquare.c}"]`);
        if (sq) sq.classList.add('selected');

        legalMoves.forEach(m => {
            let targetSq = document.querySelector(`.square[data-r="${m.r}"][data-c="${m.c}"]`);
            if (targetSq) {
                targetSq.classList.add('legal-hint');
                if (gameState.board[m.r][m.c]) targetSq.classList.add('capture');
            }
        });
    }

    // Update UI
    turnText.innerText = gameState.currentTurn === 'W' ? 'WHITE' : 'BLACK';
    turnText.style.color = gameState.currentTurn === 'W' ? '#fff' : '#000';
    
    // Update Slots
    for (let i = 0; i < 3; i++) {
        slots[i].innerText = gameState.rouletteResults[i] === 'Knight' ? 'N' : gameState.rouletteResults[i][0] || '?';
        slots[i].className = 'slot';
        if (gameState.selectedRouletteIdx === i) slots[i].classList.add('selected');
        if (gameState.triplePawnBonus) slots[i].style.borderColor = '#ff4646';
    }

    btnSpin.disabled = gameState.hasSpun || gameState.currentTurn !== myColor || gameState.gameOver;
    
    statusMsg.innerText = gameState.statusMsg;
    statusMsg.style.color = gameState.triplePawnBonus ? '#ff4646' : 
                            (gameState.gameOver ? '#f2da0a' : 
                            (gameState.currentTurn === myColor ? '#87CEFA' : '#ccc'));

    promoPanel.style.display = (gameState.awaitingPromotion && gameState.currentTurn === myColor) ? 'block' : 'none';
}

function onSquareClick(r, c) {
    if (!gameState || gameState.currentTurn !== myColor || gameState.gameOver) return;

    if (gameState.awaitingPromotion) return;

    if (gameState.triplePawnBonus) {
        let p = gameState.board[r][c];
        if (p && p.color === myColor && p.type === 'Pawn') {
            socket.emit('action', { code: roomCode, action: 'makeMove', payload: { from: {r,c}, to: {r,c} } });
        }
        return;
    }

    if (gameState.selectedRouletteIdx === null) return;
    let allowedType = gameState.rouletteResults[gameState.selectedRouletteIdx];

    if (!selectedSquare) {
        let p = gameState.board[r][c];
        if (p && p.color === myColor && p.type === allowedType) {
            selectedSquare = {r, c};
            socket.emit('getLegalMoves', { code: roomCode, r, c });
        }
    } else {
        if (selectedSquare.r === r && selectedSquare.c === c) {
            selectedSquare = null;
            legalMoves = [];
            renderBoard();
            return;
        }

        let p = gameState.board[r][c];
        if (p && p.color === myColor && p.type === allowedType) {
            selectedSquare = {r, c};
            socket.emit('getLegalMoves', { code: roomCode, r, c });
            return;
        }

        // Check if move is legal
        if (legalMoves.some(m => m.r === r && m.c === c)) {
            socket.emit('action', { code: roomCode, action: 'makeMove', payload: { from: selectedSquare, to: {r,c} } });
            selectedSquare = null;
            legalMoves = [];
        } else {
            selectedSquare = null;
            legalMoves = [];
            renderBoard();
        }
    }
}

// Event Listeners
btnCreate.addEventListener('click', () => {
    socket.emit('createRoom');
});

btnJoin.addEventListener('click', () => {
    const code = inputCode.value.trim();
    if (code.length === 4) socket.emit('joinRoom', code);
    else lobbyError.innerText = 'Code must be 4 letters';
});

btnSpin.addEventListener('click', () => {
    socket.emit('action', { code: roomCode, action: 'spin' });
});

slots.forEach((slot, i) => {
    slot.addEventListener('click', () => {
        if (gameState && gameState.currentTurn === myColor && gameState.hasSpun) {
            socket.emit('action', { code: roomCode, action: 'selectRoulette', payload: { idx: i } });
            selectedSquare = null;
            legalMoves = [];
        }
    });
});

promoButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        let type = btn.getAttribute('data-type');
        socket.emit('action', { code: roomCode, action: 'promote', payload: { type } });
    });
});

btnSendChat.addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (text && roomCode) {
        socket.emit('chatMsg', { code: roomCode, text });
        chatInput.value = '';
    }
});
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnSendChat.click();
});

// Donation Modal Controllers
function openDonateModal() {
    donateModal.style.display = 'flex';
}
function closeDonateModal() {
    donateModal.style.display = 'none';
}
btnLobbyDonate.addEventListener('click', openDonateModal);
btnGameDonate.addEventListener('click', openDonateModal);
btnCloseModal.addEventListener('click', closeDonateModal);
window.addEventListener('click', (e) => {
    if (e.target === donateModal) closeDonateModal();
});

// Socket Events
socket.on('roomCreated', (data) => {
    roomCode = data.code;
    myColor = data.color;
    showGame();
});

socket.on('roomJoined', (data) => {
    roomCode = data.code;
    myColor = data.color;
    showGame();
});

socket.on('gameState', (state) => {
    gameState = state;
    if (gameState.currentTurn !== myColor || gameState.selectedRouletteIdx === null) {
        selectedSquare = null;
        legalMoves = [];
    }
    renderBoard();
});

socket.on('legalMoves', (moves) => {
    legalMoves = moves;
    renderBoard();
});

socket.on('playSound', (soundName) => {
    if (sounds[soundName]) sounds[soundName]();
});

socket.on('errorMsg', (msg) => {
    lobbyError.innerText = msg;
});

socket.on('chatMsg', (msg) => {
    const p = document.createElement('div');
    p.classList.add('chat-msg');
    p.innerHTML = `<span class="sender">${msg.sender}:</span> ${msg.text}`;
    chatMessages.appendChild(p);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

function showGame() {
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'flex';
    displayRoomCode.innerText = roomCode;
    displayColor.innerText = myColor === 'W' ? 'White' : (myColor === 'B' ? 'Black' : 'Spectator');
    initBoard();
}