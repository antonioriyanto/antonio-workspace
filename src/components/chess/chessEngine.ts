import { Chess } from 'chess.js';

const PIECE_VALUES: Record<string, number> = {
  p: 10,
  n: 30,
  b: 35,
  r: 50,
  q: 90,
  k: 1000
};

const CENTER_SQUARES = new Set(['d4', 'e4', 'd5', 'e5', 'c4', 'f4', 'c5', 'f5']);

export type BotDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export function evaluateBoard(game: Chess): number {
  let totalEvaluation = 0;
  const board = game.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        let val = PIECE_VALUES[piece.type] || 0;
        const file = String.fromCharCode(97 + c);
        const rank = 8 - r;
        const square = `${file}${rank}`;
        if (CENTER_SQUARES.has(square)) {
          val += 2;
        }
        totalEvaluation += piece.color === 'w' ? val : -val;
      }
    }
  }
  return totalEvaluation;
}

export function getBestMove(game: Chess, difficulty: BotDifficulty): string | null {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return null;

  // Level EASY: 60% random move, 40% evaluate
  if (difficulty === 'EASY') {
    if (Math.random() < 0.6) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      return randomMove.san;
    }
  }

  // Level MEDIUM: 20% random move, 80% best 1-ply
  if (difficulty === 'MEDIUM') {
    if (Math.random() < 0.2) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      return randomMove.san;
    }
  }

  // Evaluasi Minimax 1-ply dengan verifikasi pertahanan
  const isMaximizing = game.turn() === 'w';
  const shuffledMoves = [...moves].sort(() => Math.random() - 0.5);
  let bestMove = shuffledMoves[0].san;
  let bestValue = isMaximizing ? -99999 : 99999;

  for (const move of shuffledMoves) {
    game.move(move);
    let boardVal = evaluateBoard(game);

    if (game.isCheckmate()) {
      boardVal = isMaximizing ? 99999 : -99999;
    } else if (game.inCheck()) {
      boardVal += isMaximizing ? 5 : -5;
    }

    // In HARD difficulty, check if opponent has immediate checkmate
    if (difficulty === 'HARD') {
      const replies = game.moves({ verbose: true });
      for (const reply of replies) {
        game.move(reply);
        if (game.isCheckmate()) {
          boardVal = isMaximizing ? -88888 : 88888;
          game.undo();
          break;
        }
        game.undo();
      }
    }

    game.undo();

    if (isMaximizing) {
      if (boardVal > bestValue) {
        bestValue = boardVal;
        bestMove = move.san;
      }
    } else {
      if (boardVal < bestValue) {
        bestValue = boardVal;
        bestMove = move.san;
      }
    }
  }

  return bestMove;
}
