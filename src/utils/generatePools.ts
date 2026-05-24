import { Player } from '../types';

export interface Table {
  id: string;
  table_number: number;
}

export interface GeneratedMatch {
  player1: Player;
  player2: Player;
  order: number;
}

export interface GeneratedPool {
  table: Table | null;
  players: Player[];
  matches: GeneratedMatch[];
}

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

export function computePoolComposition(n: number, preferredSize: number = 3) {
  let nbPoules2 = 0;
  let nbPoules3 = 0;
  let nbPoules4 = 0;
  
  if (preferredSize === 4) {
    if (n < 3) {
      nbPoules3 = 1;
      nbPoules4 = 0;
    } else if (n === 3) {
      nbPoules3 = 1;
    } else if (n === 4) {
      nbPoules4 = 1;
    } else if (n === 5) {
      nbPoules3 = 1;
      nbPoules4 = 1; 
    } else if (n === 6) {
      nbPoules3 = 2;
    } else if (n === 7) {
      nbPoules3 = 1;
      nbPoules4 = 1;
    } else if (n === 8) {
      nbPoules4 = 2;
    } else {
      const reste = n % 4;
      if (reste === 0) {
        nbPoules4 = n / 4;
      } else if (reste === 1) {
        if (n >= 9) {
          nbPoules3 = 3;
          nbPoules4 = (n - 9) / 4;
        } else {
          nbPoules3 = 1;
          nbPoules4 = 1;
        }
      } else if (reste === 2) {
        nbPoules3 = 2;
        nbPoules4 = (n - 6) / 4;
      } else if (reste === 3) {
        nbPoules3 = 1;
        nbPoules4 = (n - 3) / 4;
      }
    }
  } else {
    // Format Poule de 3 : Pas de poules de 4, utilisation de poules de 2 pour les restes
    if (n < 2) {
      nbPoules2 = 1;
    } else if (n === 2) {
      nbPoules2 = 1;
    } else if (n === 3) {
      nbPoules3 = 1;
    } else if (n === 4) {
      nbPoules2 = 2;
    } else if (n === 5) {
      nbPoules3 = 1;
      nbPoules2 = 1;
    } else if (n === 6) {
      nbPoules3 = 2;
    } else {
      const reste = n % 3;
      if (reste === 0) {
        nbPoules3 = n / 3;
      } else if (reste === 1) {
        // Reste 1 -> on forme deux poules de 2
        nbPoules2 = 2;
        nbPoules3 = (n - 4) / 3;
      } else if (reste === 2) {
        // Reste 2 -> on forme une poule de 2
        nbPoules2 = 1;
        nbPoules3 = (n - 2) / 3;
      }
    }
  }
  return { nbPoules2, nbPoules3, nbPoules4, total: nbPoules2 + nbPoules3 + nbPoules4 };
}

const getClubKey = (player: Player): string | null => {
  if (!player.club) return null;
  const c = player.club.trim().toLowerCase();
  if (c === '' || c === 'nc' || c === 'sans club' || c === 'indépendant' || c === 'libre' || c === 'independant') {
    return null;
  }
  return c;
};

const getPlayerPoints = (p: Player): number => {
  if (p.points !== undefined && p.points !== null) {
    return p.points;
  }
  // Utiliser le SERIES_RANK ou une valeur par défaut de 500 pour le tri
  return (SERIES_RANK[p.serie] || 0) * 100 + 500;
};

export function generatePools(players: Player[], tables: Table[] = [], preferredSize: number = 3): GeneratedPool[] {
  // Règle 1 : Trier les joueurs par points (DESC)
  const sorted = [...players].sort((a, b) => getPlayerPoints(b) - getPlayerPoints(a));

  // Étape 1 : Calculer la composition des poules
  const { total: nbTotalPoules } = computePoolComposition(sorted.length, preferredSize);
  const pools: Player[][] = Array.from({ length: nbTotalPoules }, () => []);

  // Règle 2 : Méthode serpent
  let direction = 1;
  let currentPoolIdx = 0;

  sorted.forEach((player) => {
    pools[currentPoolIdx].push(player);
    currentPoolIdx += direction;

    if (currentPoolIdx >= nbTotalPoules) {
      direction = -1;
      currentPoolIdx = nbTotalPoules - 1;
    } else if (currentPoolIdx < 0) {
      direction = 1;
      currentPoolIdx = 0;
    }
  });

  // Règle 3 : Séparer les joueurs du même club
  for (let i = 0; i < pools.length; i++) {
    const currentPool = pools[i];
    
    // Compter les occurrences des clubs dans la poule courante
    const clubCounts: Record<string, number> = {};
    currentPool.forEach(p => {
      const club = getClubKey(p);
      if (club) {
        clubCounts[club] = (clubCounts[club] || 0) + 1;
      }
    });

    // Pour chaque club en conflit (apparaissant au moins 2 fois)
    for (const clubKey of Object.keys(clubCounts)) {
      if (clubCounts[clubKey] < 2) continue;

      const clubPlayersInPool = currentPool.filter(p => getClubKey(p) === clubKey);
      const doublons = clubPlayersInPool.slice(1);

      for (const doublon of doublons) {
        let bestCandidatePoolIdx = -1;
        let bestCandidateIdxInPool = -1;
        let minPointsDiff = Infinity;

        for (let j = 0; j < pools.length; j++) {
          if (i === j) continue;
          const otherPool = pools[j];

          otherPool.forEach((candidat, candIdx) => {
            const candClub = getClubKey(candidat);
            
            // On vérifie que le candidat entrant ne crée pas de conflit en i,
            // et que le doublon entrant ne crée pas de conflit en j
            const candCausesConflictInI = candClub ? currentPool.some(p => p.id !== doublon.id && getClubKey(p) === candClub) : false;
            const doublonCausesConflictInJ = otherPool.some(p => p.id !== candidat.id && getClubKey(p) === clubKey);

            if (!candCausesConflictInI && !doublonCausesConflictInJ) {
              const diff = Math.abs(getPlayerPoints(candidat) - getPlayerPoints(doublon));
              if (diff < minPointsDiff) {
                minPointsDiff = diff;
                bestCandidatePoolIdx = j;
                bestCandidateIdxInPool = candIdx;
              }
            }
          });
        }

        if (bestCandidatePoolIdx !== -1 && bestCandidateIdxInPool !== -1) {
          const candidate = pools[bestCandidatePoolIdx][bestCandidateIdxInPool];
          const doublonIdx = currentPool.findIndex(p => p.id === doublon.id);
          currentPool[doublonIdx] = candidate;
          pools[bestCandidatePoolIdx][bestCandidateIdxInPool] = doublon;
        } else {
          console.warn(`Impossible de séparer ${doublon.club || 'le club'} dans la poule ${i + 1}`);
        }
      }
    }
  }

  // Trier les poules par taille croissante pour que les plus petites poules (comme les poules de 2) soient en premier (Poules 1, 2...)
  pools.sort((a, b) => a.length - b.length);

  // Étape 5 & 6 : Générer les matchs FFTT round-robin et affecter les tables physiques
  return pools.map((playersInPool, idx) => {
    // Trier à nouveau chaque poule par points DESC pour garantir que l'ordre A, B, C, D respecte les forces
    const sortedPlayersInPool = [...playersInPool].sort((a, b) => getPlayerPoints(b) - getPlayerPoints(a));

    const matches: GeneratedMatch[] = [];
    const len = sortedPlayersInPool.length;
    
    if (len >= 2) {
      const A = sortedPlayersInPool[0];
      const B = sortedPlayersInPool[1];

      if (len === 2) {
        matches.push({ player1: A, player2: B, order: 1 });
      } else if (len === 3) {
        const C = sortedPlayersInPool[2];
        matches.push({ player1: A, player2: B, order: 1 });
        matches.push({ player1: A, player2: C, order: 2 });
        matches.push({ player1: B, player2: C, order: 3 });
      } else if (len === 4) {
        const C = sortedPlayersInPool[2];
        const D = sortedPlayersInPool[3];
        matches.push({ player1: A, player2: D, order: 1 });
        matches.push({ player1: B, player2: C, order: 2 });
        matches.push({ player1: A, player2: C, order: 3 });
        matches.push({ player1: B, player2: D, order: 4 });
        matches.push({ player1: A, player2: B, order: 5 });
        matches.push({ player1: C, player2: D, order: 6 });
      } else {
        let order = 1;
        for (let x = 0; x < len; x++) {
          for (let y = x + 1; y < len; y++) {
            matches.push({
              player1: sortedPlayersInPool[x],
              player2: sortedPlayersInPool[y],
              order: order++
            });
          }
        }
      }
    }

    return {
      table: tables && tables[idx] ? tables[idx] : null,
      players: sortedPlayersInPool,
      matches
    };
  });
}
