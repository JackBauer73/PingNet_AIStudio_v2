export const SERIES_RANK: Record<string, number> = {
  'N1': 10,
  'N2': 9,
  'N3': 8,
  'R4': 7,
  'R5': 6,
  'R6': 5,
  'D7': 4,
  'D8': 3,
  'D9': 2,
  'P10': 2,
  'P11': 1,
  'P12': 1,
  'NC': 0
};

import { Player } from '../types';

export function computeNbPools(nbPlayers: number): number {
  if (nbPlayers <= 4) return 1;
  if (nbPlayers <= 8) return 2;
  if (nbPlayers <= 12) return 3;
  return Math.ceil(nbPlayers / 4);
}

export function generatePools(players: Player[]): Player[][] {
  // 1. Trier du plus fort au plus faible
  const sorted = [...players].sort((a, b) =>
    (SERIES_RANK[b.serie] || 0) - (SERIES_RANK[a.serie] || 0)
  );

  const n = computeNbPools(sorted.length);
  const pools: Player[][] = Array.from({ length: n }, () => []);

  // 2. Répartition en serpentin pour équilibrer les niveaux
  // 8 joueurs, 2 poules → Poule A: [1er, 4e, 5e, 8e] / Poule B: [2e, 3e, 6e, 7e]
  sorted.forEach((player, i) => {
    const row = Math.floor(i / n);
    const col = row % 2 === 0 ? i % n : n - 1 - (i % n);
    pools[col].push(player);
  });

  return pools;
}
