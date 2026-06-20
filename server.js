const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, 'public')));

// Simple Game Logic Class
class RouletteChessGame {
    constructor() {
        this.resetGame();
    }

    resetGame() {
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
        const backRank = ['Rook', 'Knight', 'Bishop', 'Queen', 'King', 'Bishop', 'Knight', 'Rook'];
        for (let i = 0; i < 8; i++) {
            this.board[0][i] = { color: 'B', type: backRank[i] };
            this.board[1][i] = { color: 'B', type: 'Pawn' };
            this.board[6][i] = { color: 'W', type: 'Pawn' };
            this.board[7][i] = { color: 'W', type: backRank[i] };
        }
        
        this.currentTurn = 'W';
        this.turnCount = 0;
        this.moveHistory = [];
        
        this.rouletteResults = ['?', '?', '?'];
        this.hasSpun = false;
        this.selectedRouletteIdx = null;
        
        this.triplePawnBonus = false;
        this.awaitingPromotion = false;
        this.promoTargetPos = null;
        
        this.statusMsg = "Spin Roulette First!";
        this.gameOver = false;
    }

    getAllAlivePiecesPool(color) {
        let pool = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let p = this.board[r][c];
                if (p && p.color === color) {
                    pool.push(p.type);
                }
            }
        }
        return pool;
    }

    isSquareAttacked(r, c, attackerColor) {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                let p = this.board[row][col];
                if (p && p.color === attackerColor) {
                    if (p.type === 'Pawn') {
                        let dir = attackerColor === 'W' ? -1 : 1;
                        if (row + dir === r && (col - 1 === c || col + 1 === c)) {
                            return true;
                        }
                    } else {
                        let moves = this.getLegalMoves(row, col, true);
                        if (moves.some(m => m.r === r && m.c === c)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    getLegalMoves(r, c, ignoreCastling = false) {
        let moves = [];
        let piece = this.board[r][c];
        if (!piece) return moves;

        let color = piece.color;
        let p_type = piece.type;
        let enemy = color === 'W' ? 'B' : 'W';

        if (p_type === 'Pawn') {
            let dir = color === 'W' ? -1 : 1;
            if (r + dir >= 0 && r + dir < 8 && !this.board[r + dir][c]) {
                moves.push({r: r + dir, c: c});
                let startRow = color === 'W' ? 6 : 1;
                if (r === startRow && !this.board[r + 2 * dir][c]) {
                    moves.push({r: r + 2 * dir, c: c});
                }
            }
            for (let dc of [-1, 1]) {
                let nr = r + dir, nc = c + dc;
                if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                    let target = this.board[nr][nc];
                    if (target && target.color === enemy) {
                        moves.push({r: nr, c: nc});
                    }
                }
            }
            // En Passant
            if ((color === 'W' && r === 3) || (color === 'B' && r === 4)) {
                for (let dc of [-1, 1]) {
                    let nc = c + dc;
                    if (nc >= 0 && nc < 8) {
                        let neighbor = this.board[r][nc];
                        if (neighbor && neighbor.type === 'Pawn' && neighbor.color === enemy && this.moveHistory.length > 0) {
                            let lastMove = this.moveHistory[this.moveHistory.length - 1];
                            let enemyStartRow = enemy === 'W' ? 6 : 1;
                            if (lastMove.piece.type === 'Pawn' && lastMove.piece.color === enemy &&
                                lastMove.from.r === enemyStartRow && lastMove.from.c === nc &&
                                lastMove.to.r === r && lastMove.to.c === nc) {
                                moves.push({r: r + dir, c: nc, isEnPassant: true});
                            }
                        }
                    }
                }
            }
        } else if (p_type === 'Knight') {
            let offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
            for (let [dr, dc] of offsets) {
                let nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                    let target = this.board[nr][nc];
                    if (!target || target.color === enemy) moves.push({r: nr, c: nc});
                }
            }
        } else if (['Bishop', 'Rook', 'Queen'].includes(p_type)) {
            let dirs = [];
            if (p_type !== 'Rook') dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
            if (p_type !== 'Bishop') dirs.push([-1,0],[1,0],[0,-1],[0,1]);
            for (let [dr, dc] of dirs) {
                let nr = r + dr, nc = c + dc;
                while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                    let target = this.board[nr][nc];
                    if (!target) {
                        moves.push({r: nr, c: nc});
                    } else {
                        if (target.color === enemy) moves.push({r: nr, c: nc});
                        break;
                    }
                    nr += dr; nc += dc;
                }
            }
        } else if (p_type === 'King') {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    let nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                        let target = this.board[nr][nc];
                        if (!target || target.color === enemy) moves.push({r: nr, c: nc});
                    }
                }
            }
            // Castling
            if (!ignoreCastling) {
                let kingRow = color === 'W' ? 7 : 0;
                if (r === kingRow && c === 4) {
                    let kingMoved = this.moveHistory.some(h => h.from.r === kingRow && h.from.c === 4 && h.piece.type === 'King');
                    if (!kingMoved) {
                        let enemyColor = color === 'W' ? 'B' : 'W';
                        if (this.board[kingRow][7] && this.board[kingRow][7].type === 'Rook' && this.board[kingRow][7].color === color) {
                            let rMoved = this.moveHistory.some(h => h.from.r === kingRow && h.from.c === 7 && h.piece.type === 'Rook');
                            if (!rMoved && !this.board[kingRow][5] && !this.board[kingRow][6]) {
                                if (!this.isSquareAttacked(kingRow, 4, enemyColor) &&
                                    !this.isSquareAttacked(kingRow, 5, enemyColor) &&
                                    !this.isSquareAttacked(kingRow, 6, enemyColor)) {
                                    moves.push({r: kingRow, c: 7, isCastling: 'short'});
                                }
                            }
                        }
                        if (this.board[kingRow][0] && this.board[kingRow][0].type === 'Rook' && this.board[kingRow][0].color === color) {
                            let lMoved = this.moveHistory.some(h => h.from.r === kingRow && h.from.c === 0 && h.piece.type === 'Rook');
                            if (!lMoved && !this.board[kingRow][1] && !this.board[kingRow][2] && !this.board[kingRow][3]) {
                                if (!this.isSquareAttacked(kingRow, 4, enemyColor) &&
                                    !this.isSquareAttacked(kingRow, 3, enemyColor) &&
                                    !this.isSquareAttacked(kingRow, 2, enemyColor)) {
                                    moves.push({r: kingRow, c: 0, isCastling: 'long'});
                                }
                            }
                        }
                    }
                }
            }
        }
        return moves;
    }

    spin() {
        if (this.hasSpun || this.gameOver || this.awaitingPromotion || this.triplePawnBonus) return false;
        
        let pool = this.getAllAlivePiecesPool(this.currentTurn);
        if (pool.length === 0) return false;

        let results = [];
        let sampleSize = Math.min(3, pool.length);
        
        let shuffled = [...pool].sort(() => 0.5 - Math.random());
        results = shuffled.slice(0, sampleSize);

        while (results.length < 3) results.push("?");
        
        this.rouletteResults = results;
        this.hasSpun = true;
        
        if (results[0] === 'Pawn' && results[1] === 'Pawn' && results[2] === 'Pawn') {
            this.triplePawnBonus = true;
            this.statusMsg = "TRIPLE PAWN! Select your Pawn to promote!";
        } else {
            let hasMoves = false;
            for (let type of new Set(results)) {
                if (type === "?") continue;
                for (let r = 0; r < 8; r++) {
                    for (let c = 0; c < 8; c++) {
                        let p = this.board[r][c];
                        if (p && p.color === this.currentTurn && p.type === type) {
                            if (this.getLegalMoves(r, c).length > 0) {
                                hasMoves = true;
                            }
                        }
                    }
                }
            }
            if (!hasMoves) {
                this.statusMsg = "No Legal Moves! Auto Passed!";
                return { autoPass: true };
            } else {
                this.statusMsg = "Select 1 Slot from Roulette!";
            }
        }
        return true;
    }

    selectRoulette(idx) {
        if (!this.hasSpun || this.gameOver || this.triplePawnBonus || this.awaitingPromotion) return false;
        if (this.rouletteResults[idx] === '?') return false;
        this.selectedRouletteIdx = idx;
        this.statusMsg = `Move [${this.rouletteResults[idx]}]`;
        return true;
    }

    makeMove(from, to) {
        if (this.gameOver) return false;

        if (this.triplePawnBonus) {
            let p = this.board[to.r][to.c];
            if (p && p.color === this.currentTurn && p.type === 'Pawn') {
                this.awaitingPromotion = true;
                this.promoTargetPos = {r: to.r, c: to.c};
                this.triplePawnBonus = false;
                this.statusMsg = "Select piece to promote on panel!";
                return true;
            }
            return false;
        }

        if (this.selectedRouletteIdx === null) return false;
        let allowedType = this.rouletteResults[this.selectedRouletteIdx];
        let p = this.board[from.r][from.c];
        
        if (!p || p.color !== this.currentTurn || p.type !== allowedType) return false;

        let moves = this.getLegalMoves(from.r, from.c);
        let move = moves.find(m => m.r === to.r && m.c === to.c);
        if (!move) return false;

        let movingPiece = this.board[from.r][from.c];
        let capturedPiece = this.board[to.r][to.c];

        // Castling
        if (move.isCastling) {
            let kingRow = from.r;
            if (to.c === 7) { // short
                this.board[kingRow][6] = movingPiece;
                this.board[kingRow][5] = capturedPiece;
                this.board[kingRow][4] = null;
                this.board[kingRow][7] = null;
            } else { // long
                this.board[kingRow][2] = movingPiece;
                this.board[kingRow][3] = capturedPiece;
                this.board[kingRow][4] = null;
                this.board[kingRow][0] = null;
            }
            this.moveHistory.push({piece: movingPiece, from, to, turn: this.turnCount});
            this.nextTurn();
            return { success: true, capture: null };
        }

        // En passant
        if (move.isEnPassant) {
            this.board[from.r][to.c] = null; // remove enemy pawn
        }

        this.board[to.r][to.c] = movingPiece;
        this.board[from.r][from.c] = null;
        this.moveHistory.push({piece: movingPiece, from, to, turn: this.turnCount});

        // King capture
        if (capturedPiece && capturedPiece.type === 'King') {
            this.gameOver = true;
            this.statusMsg = `GAME OVER! ${this.currentTurn === 'W' ? 'WHITE' : 'BLACK'} WINS!`;
            return { success: true, capture: 'King' };
        }

        // Promotion
        if (movingPiece.type === 'Pawn' && (to.r === 0 || to.r === 7)) {
            this.awaitingPromotion = true;
            this.promoTargetPos = {r: to.r, c: to.c};
            this.statusMsg = "Promotion! Select piece!";
            return { success: true, capture: capturedPiece, sound: 'move' };
        }

        this.nextTurn();
        return { success: true, capture: capturedPiece, sound: capturedPiece ? 'capture' : 'move' };
    }

    promote(type) {
        if (!this.awaitingPromotion) return false;
        if (!['Queen', 'Rook', 'Bishop', 'Knight'].includes(type)) return false;
        
        let pos = this.promoTargetPos;
        this.board[pos.r][pos.c] = { color: this.currentTurn, type: type };
        
        this.nextTurn();
        return true;
    }

    nextTurn() {
        this.currentTurn = this.currentTurn === 'W' ? 'B' : 'W';
        this.turnCount++;
        this.hasSpun = false;
        this.rouletteResults = ['?', '?', '?'];
        this.selectedRouletteIdx = null;
        this.triplePawnBonus = false;
        this.awaitingPromotion = false;
        this.promoTargetPos = null;
        this.statusMsg = "Spin Roulette First!";
    }

    getState() {
        return {
            board: this.board,
            currentTurn: this.currentTurn,
            rouletteResults: this.rouletteResults,
            hasSpun: this.hasSpun,
            selectedRouletteIdx: this.selectedRouletteIdx,
            triplePawnBonus: this.triplePawnBonus,
            awaitingPromotion: this.awaitingPromotion,
            statusMsg: this.statusMsg,
            gameOver: this.gameOver
        };
    }
}

const rooms = {};

function generateRoomCode() {
    let code = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i=0; i<4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

// Memory leak protection: periodically clean up inactive rooms
setInterval(() => {
    const now = Date.now();
    for (const code in rooms) {
        // Deletes room if empty or inactive for > 2 hours
        if (rooms[code].players.W === null && rooms[code].players.B === null) {
            delete rooms[code];
            console.log(`Cleaned up empty room: ${code}`);
        } else if (now - rooms[code].lastActive > 2 * 60 * 60 * 1000) {
            delete rooms[code];
            console.log(`Cleaned up inactive room: ${code}`);
        }
    }
}, 30 * 60 * 1000); // run every 30 mins

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', () => {
        const code = generateRoomCode();
        rooms[code] = {
            game: new RouletteChessGame(),
            players: { W: socket.id, B: null },
            spectators: [],
            lastActive: Date.now()
        };
        socket.join(code);
        socket.emit('roomCreated', { code, color: 'W' });
        io.to(code).emit('gameState', rooms[code].game.getState());
        console.log(`Room created: ${code}`);
    });

    socket.on('joinRoom', (code) => {
        code = code.toUpperCase().trim();
        if (rooms[code]) {
            let room = rooms[code];
            room.lastActive = Date.now();
            
            if (!room.players.B && room.players.W !== socket.id) {
                room.players.B = socket.id;
                socket.join(code);
                socket.emit('roomJoined', { code, color: 'B' });
                io.to(code).emit('gameState', room.game.getState());
                io.to(code).emit('chatMsg', { sender: 'System', text: 'Black player joined.'});
            } else if (room.players.W === socket.id) {
                socket.emit('roomJoined', { code, color: 'W' });
                socket.emit('gameState', room.game.getState());
            } else if (room.players.B === socket.id) {
                socket.emit('roomJoined', { code, color: 'B' });
                socket.emit('gameState', room.game.getState());
            } else {
                room.spectators.push(socket.id);
                socket.join(code);
                socket.emit('roomJoined', { code, color: 'Spectator' });
                socket.emit('gameState', room.game.getState());
            }
        } else {
            socket.emit('errorMsg', 'Room not found.');
        }
    });

    socket.on('action', ({ code, action, payload }) => {
        if (!rooms[code]) return;
        let room = rooms[code];
        room.lastActive = Date.now();
        let game = room.game;
        
        let color = room.players.W === socket.id ? 'W' : (room.players.B === socket.id ? 'B' : null);
        if (!color || color !== game.currentTurn) return; // Not their turn or spectator
        
        let changed = false;
        let sound = null;

        if (action === 'spin') {
            let res = game.spin();
            if (res) changed = true;
            if (res && res.autoPass) {
                sound = 'error';
                io.to(code).emit('gameState', game.getState());
                io.to(code).emit('playSound', sound);
                
                // Set delay on turn passing so the player sees the "No legal moves!" message
                setTimeout(() => {
                    if (rooms[code]) {
                        rooms[code].game.nextTurn();
                        io.to(code).emit('gameState', rooms[code].game.getState());
                    }
                }, 2000);
                return;
            } else if (res) {
                sound = 'spin';
            }
        } else if (action === 'selectRoulette') {
            if (game.selectRoulette(payload.idx)) {
                changed = true;
                sound = 'click';
            }
        } else if (action === 'makeMove') {
            let res = game.makeMove(payload.from, payload.to);
            if (res) {
                changed = true;
                sound = res.sound;
                if (res.capture === 'King') sound = 'win';
            }
        } else if (action === 'promote') {
            if (game.promote(payload.type)) {
                changed = true;
                sound = 'promote';
            }
        }

        if (changed) {
            io.to(code).emit('gameState', game.getState());
            if (sound) io.to(code).emit('playSound', sound);
        }
    });

    socket.on('getLegalMoves', ({ code, r, c }) => {
        if (!rooms[code]) return;
        let room = rooms[code];
        let moves = room.game.getLegalMoves(r, c);
        socket.emit('legalMoves', moves);
    });

    socket.on('chatMsg', ({code, text}) => {
        if (!rooms[code]) return;
        let color = rooms[code].players.W === socket.id ? 'White' : (rooms[code].players.B === socket.id ? 'Black' : 'Spectator');
        io.to(code).emit('chatMsg', { sender: color, text: text.substring(0, 150) }); // Limit message size
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (const code in rooms) {
            let room = rooms[code];
            if (room.players.W === socket.id) {
                room.players.W = null;
                io.to(code).emit('chatMsg', { sender: 'System', text: 'White player disconnected.' });
            } else if (room.players.B === socket.id) {
                room.players.B = null;
                io.to(code).emit('chatMsg', { sender: 'System', text: 'Black player disconnected.' });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
