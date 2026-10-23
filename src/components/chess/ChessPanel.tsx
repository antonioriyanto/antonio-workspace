import React, { useState, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import {
  X,
  RotateCcw,
  Undo2,
  Swords,
  Puzzle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Trophy,
  Zap
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { BotDifficulty, getBestMove } from './chessEngine';
import { CHESS_PUZZLES } from './chessPuzzles';

type ActiveTab = 'BOT' | 'PUZZLE';

export const ChessPanel: React.FC = () => {
  const { isChessPanelOpen, closeChessPanel, activeWorkspace } = useWorkspaceStore();

  // Mode Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('BOT');

  // Bot Mode State
  const [botGame, setBotGame] = useState<Chess>(() => new Chess());
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('MEDIUM');
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [gameHistory, setGameHistory] = useState<string[]>(() => [new Chess().fen()]);

  // Puzzle Mode State
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [puzzleGame, setPuzzleGame] = useState<Chess>(() => new Chess(CHESS_PUZZLES[0].fen));
  const [puzzleStatus, setPuzzleStatus] = useState<'PLAYING' | 'SUCCESS' | 'FAILED'>('PLAYING');
  const [showSolutionHint, setShowSolutionHint] = useState(false);

  // Auto-close if workspace changes away from 'Personal Project'
  useEffect(() => {
    if (activeWorkspace !== 'Personal Project' && isChessPanelOpen) {
      closeChessPanel();
    }
  }, [activeWorkspace, isChessPanelOpen, closeChessPanel]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isChessPanelOpen) {
        closeChessPanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChessPanelOpen, closeChessPanel]);

  // Update puzzle when index changes
  useEffect(() => {
    const targetPuzzle = CHESS_PUZZLES[puzzleIndex];
    if (targetPuzzle) {
      setPuzzleGame(new Chess(targetPuzzle.fen));
      setPuzzleStatus('PLAYING');
      setShowSolutionHint(false);
    }
  }, [puzzleIndex]);

  if (activeWorkspace !== 'Personal Project') {
    return null;
  }

  // BOT PLAY HANDLERS
  const handleBotPieceDrop = (sourceSquare: Square, targetSquare: Square): boolean => {
    if (isBotThinking || botGame.isGameOver()) return false;

    // Only allow human (White) to move
    if (botGame.turn() !== 'w') return false;

    try {
      const gameCopy = new Chess(botGame.fen());
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q'
      });

      if (!move) return false;

      // Update state for human move
      setBotGame(gameCopy);
      setGameHistory(prev => [...prev, gameCopy.fen()]);

      // Check if game ended after human move
      if (gameCopy.isGameOver()) {
        return true;
      }

      // Schedule Bot Response
      setIsBotThinking(true);
      setTimeout(() => {
        try {
          const updatedBotGame = new Chess(gameCopy.fen());
          const bestSan = getBestMove(updatedBotGame, botDifficulty);
          if (bestSan) {
            updatedBotGame.move(bestSan);
            setBotGame(updatedBotGame);
            setGameHistory(prev => [...prev, updatedBotGame.fen()]);
          }
        } catch (err) {
          console.error('Bot execution error:', err);
        } finally {
          setIsBotThinking(false);
        }
      }, 200);

      return true;
    } catch {
      return false;
    }
  };

  const handleNewBotGame = () => {
    const freshGame = new Chess();
    setBotGame(freshGame);
    setGameHistory([freshGame.fen()]);
    setIsBotThinking(false);
  };

  const handleUndoMove = () => {
    if (isBotThinking || gameHistory.length <= 1) return;
    // Step back 2 half-moves (bot reply + user move) if it's White's turn
    const steps = botGame.turn() === 'w' && gameHistory.length >= 3 ? 2 : 1;
    const newHist = gameHistory.slice(0, gameHistory.length - steps);
    const prevFen = newHist[newHist.length - 1];
    setBotGame(new Chess(prevFen));
    setGameHistory(newHist);
  };

  // PUZZLE HANDLERS
  const handlePuzzlePieceDrop = (sourceSquare: Square, targetSquare: Square): boolean => {
    if (puzzleStatus === 'SUCCESS') return false;

    const currentPuzzle = CHESS_PUZZLES[puzzleIndex];
    try {
      const puzzleCopy = new Chess(puzzleGame.fen());
      const move = puzzleCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q'
      });

      if (!move) return false;

      const cleanSan = move.san.replace(/[+#]/g, '');
      const isCorrect =
        currentPuzzle.solution.some(sol => sol === move.san || sol.replace(/[+#]/g, '') === cleanSan) ||
        puzzleCopy.isCheckmate();

      setPuzzleGame(puzzleCopy);

      if (isCorrect) {
        setPuzzleStatus('SUCCESS');
      } else {
        setPuzzleStatus('FAILED');
      }

      return true;
    } catch {
      return false;
    }
  };

  const handleResetPuzzle = () => {
    const currentPuzzle = CHESS_PUZZLES[puzzleIndex];
    setPuzzleGame(new Chess(currentPuzzle.fen));
    setPuzzleStatus('PLAYING');
    setShowSolutionHint(false);
  };

  const handleNextPuzzle = () => {
    setPuzzleIndex(prev => (prev + 1) % CHESS_PUZZLES.length);
  };

  const handlePrevPuzzle = () => {
    setPuzzleIndex(prev => (prev - 1 + CHESS_PUZZLES.length) % CHESS_PUZZLES.length);
  };

  // Bot Status Text
  const getBotGameStatus = () => {
    if (botGame.isCheckmate()) {
      return {
        text: botGame.turn() === 'w' ? 'Skakmat! Bot Menang' : '🎉 Skakmat! Anda Menang!',
        type: botGame.turn() === 'w' ? 'danger' : 'success'
      };
    }
    if (botGame.isDraw()) {
      return { text: '🤝 Permainan Berakhir Remis (Draw)', type: 'neutral' };
    }
    if (botGame.inCheck()) {
      return {
        text: botGame.turn() === 'w' ? '⚠️ Raja Anda Dalam Skak!' : '⚡ Bot Dalam Skak!',
        type: 'warning'
      };
    }
    if (isBotThinking) {
      return { text: 'Bot sedang berpikir...', type: 'thinking' };
    }
    return {
      text: botGame.turn() === 'w' ? 'Giliran Anda (Putih)' : 'Giliran Bot (Hitam)',
      type: 'normal'
    };
  };

  const botStatus = getBotGameStatus();
  const currentPuzzle = CHESS_PUZZLES[puzzleIndex];

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${
          isChessPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeChessPanel}
      />

      {/* Slide-over Drawer Panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-[430px] max-w-full z-50 glass-panel shadow-2xl flex flex-col bg-zinc-950/95 border-l border-zinc-800 text-zinc-100 transition-transform duration-300 ease-in-out ${
          isChessPanelOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
        aria-label="Panel Catur Zen Break"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center relative overflow-hidden bg-zinc-800 border border-zinc-700/80 shadow-inner">
              <div className="absolute inset-0 opacity-30 grid grid-cols-2 grid-rows-2">
                <div className="bg-zinc-100" />
                <div className="bg-zinc-800" />
                <div className="bg-zinc-800" />
                <div className="bg-zinc-100" />
              </div>
              <span className="text-base select-none relative z-10 leading-none">♟</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-wide text-zinc-100">Chess Break</h2>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                  Zen Break
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">Personal Project Easter Egg</p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeChessPanel}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
            title="Tutup Panel Catur (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-3 pb-2 border-b border-zinc-800/60 bg-zinc-900/20">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-zinc-900 border border-zinc-800/80">
            <button
              type="button"
              onClick={() => setActiveTab('BOT')}
              className={`flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-medium transition ${
                activeTab === 'BOT'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Swords className="w-3.5 h-3.5 text-amber-400" />
              <span>Lawan Bot</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PUZZLE')}
              className={`flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-medium transition ${
                activeTab === 'PUZZLE'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Puzzle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Taktik Puzzle</span>
            </button>
          </div>
        </div>

        {/* Scrollable Main Area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Board Container */}
          <div className="flex justify-center">
            <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800/90 shadow-2xl overflow-hidden flex justify-center items-center">
              {activeTab === 'BOT' ? (
                <Chessboard
                  position={botGame.fen()}
                  onPieceDrop={handleBotPieceDrop}
                  boardWidth={360}
                  boardOrientation="white"
                  animationDuration={200}
                  customDarkSquareStyle={{ backgroundColor: '#27272a' }}
                  customLightSquareStyle={{ backgroundColor: '#71717a' }}
                  customBoardStyle={{
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)'
                  }}
                />
              ) : (
                <Chessboard
                  position={puzzleGame.fen()}
                  onPieceDrop={handlePuzzlePieceDrop}
                  boardWidth={360}
                  boardOrientation={currentPuzzle.turn === 'w' ? 'white' : 'black'}
                  animationDuration={200}
                  customDarkSquareStyle={{ backgroundColor: '#27272a' }}
                  customLightSquareStyle={{ backgroundColor: '#71717a' }}
                  customBoardStyle={{
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)'
                  }}
                />
              )}
            </div>
          </div>

          {/* TAB 1: LAWAN BOT */}
          {activeTab === 'BOT' && (
            <div className="space-y-3.5">
              {/* Bot Difficulty Selector */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="font-medium flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Tingkat Kesulitan Bot
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {botDifficulty === 'EASY'
                      ? 'ELO ~800'
                      : botDifficulty === 'MEDIUM'
                      ? 'ELO ~1200'
                      : 'ELO ~1500'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { key: 'EASY', label: 'Pemula (800)' },
                      { key: 'MEDIUM', label: 'Menengah (1200)' },
                      { key: 'HARD', label: 'Mahir (1500)' }
                    ] as const
                  ).map(lvl => (
                    <button
                      key={lvl.key}
                      type="button"
                      onClick={() => setBotDifficulty(lvl.key)}
                      className={`py-1 px-2 rounded-lg text-[11px] font-medium transition ${
                        botDifficulty === lvl.key
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                          : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 border border-zinc-700/40'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Game Status Banner */}
              <div
                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                  botStatus.type === 'danger'
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    : botStatus.type === 'success'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 font-semibold'
                    : botStatus.type === 'warning'
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 animate-pulse'
                    : botStatus.type === 'thinking'
                    ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-300'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isBotThinking ? 'bg-sky-400 animate-ping' : 'bg-emerald-400'
                    }`}
                  />
                  {botStatus.text}
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  {gameHistory.length > 1 ? `Langkah ${Math.ceil(gameHistory.length / 2)}` : 'Mulai'}
                </span>
              </div>

              {/* Bot Control Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleNewBotGame}
                  className="py-2 px-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs text-zinc-200 font-medium transition flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Game Baru</span>
                </button>
                <button
                  type="button"
                  onClick={handleUndoMove}
                  disabled={isBotThinking || gameHistory.length <= 1}
                  className="py-2 px-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none text-xs text-zinc-200 font-medium transition flex items-center justify-center gap-1.5"
                >
                  <Undo2 className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Undo Langkah</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: TAKTIK PUZZLE */}
          {activeTab === 'PUZZLE' && (
            <div className="space-y-3.5">
              {/* Puzzle Header Card */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <h3 className="text-xs font-semibold text-zinc-100">{currentPuzzle.title}</h3>
                  </div>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                    {puzzleIndex + 1} / {CHESS_PUZZLES.length}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">{currentPuzzle.description}</p>
              </div>

              {/* Feedback Alert */}
              {puzzleStatus === 'SUCCESS' && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-semibold">Luar Biasa! Skakmat Sempurna!</p>
                      <p className="text-[11px] text-emerald-400/80">Solusi taktik berhasil diselesaikan.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleNextPuzzle}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 font-semibold text-xs hover:bg-emerald-400 transition shadow-sm"
                  >
                    Lanjut ➡️
                  </button>
                </div>
              )}

              {puzzleStatus === 'FAILED' && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <div>
                      <p className="font-semibold">Kurang Tepat!</p>
                      <p className="text-[11px] text-rose-300/80">Langkah ini bukan skakmat terbaik.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetPuzzle}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-500 text-white font-semibold text-xs hover:bg-rose-400 transition shadow-sm"
                  >
                    Coba Lagi ↺
                  </button>
                </div>
              )}

              {/* Solution Spoiler / Hint */}
              {showSolutionHint && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-center justify-between">
                  <span>
                    Kunci Solusi: <code className="font-mono font-bold text-amber-200">{currentPuzzle.solution.join(' ')}</code>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSolutionHint(false)}
                    className="text-[10px] text-zinc-400 hover:text-zinc-200 underline"
                  >
                    Tutup
                  </button>
                </div>
              )}

              {/* Puzzle Navigation & Action Controls */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handlePrevPuzzle}
                  className="py-2 px-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs text-zinc-200 font-medium transition flex items-center justify-center gap-1"
                  title="Puzzle Sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Sebelumnya</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetPuzzle}
                  className="py-2 px-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs text-zinc-200 font-medium transition flex items-center justify-center gap-1"
                  title="Reset Posisi Bidak"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextPuzzle}
                  className="py-2 px-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs text-zinc-200 font-medium transition flex items-center justify-center gap-1"
                  title="Puzzle Berikutnya"
                >
                  <span>Berikutnya</span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                </button>
              </div>

              {/* Hint Toggle */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowSolutionHint(prev => !prev)}
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>{showSolutionHint ? 'Sembunyikan Solusi' : 'Butuh Petunjuk Solusi?'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
