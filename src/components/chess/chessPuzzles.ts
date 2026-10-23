export interface ChessPuzzle {
  id: string;
  title: string;
  description: string;
  fen: string; // Posisi papan
  solution: string[]; // Langkah solusi dalam notasi SAN/UCI, misal: ['Qxf7#'] atau ['Qh7#']
  turn: 'w' | 'b';
}

export const CHESS_PUZZLES: ChessPuzzle[] = [
  {
    id: 'p1',
    title: "Scholar's Sting",
    description: 'Putih melangkah, Skakmat 1 Langkah (Mate in 1)!',
    fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4',
    solution: ['Qxf7#'],
    turn: 'w'
  },
  {
    id: 'p2',
    title: 'Back Rank Collapse',
    description: 'Benteng menyusup ke baris belakang. Mate in 1!',
    fen: '6k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1',
    solution: ['Rc8#'],
    turn: 'w'
  },
  {
    id: 'p3',
    title: 'Queen & Bishop Battery',
    description: 'Baterai Ratu dan Gajah mengancam h7. Selesaikan permainan!',
    fen: '5rk1/5ppp/8/8/4Q3/3B4/PPP2PPP/R4RK1 w - - 0 1',
    solution: ['Qxh7#'],
    turn: 'w'
  },
  {
    id: 'p4',
    title: 'Opera Box Pin & Mate',
    description: 'Benteng menyusup saat lawan terpin oleh Gajah. Skakmat!',
    fen: '3rkb1r/5ppp/4p3/6B1/8/8/8/3R3K w k - 0 1',
    solution: ['Rxd8#'],
    turn: 'w'
  },
  {
    id: 'p5',
    title: 'Smothered Shadow',
    description: 'Raja hitam terkurung bidaknya sendiri. Mate in 1!',
    fen: '6rk/6pp/7N/8/2B5/8/8/4K3 w - - 0 1',
    solution: ['Nf7#'],
    turn: 'w'
  }
];
