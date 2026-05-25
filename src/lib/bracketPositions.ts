import { RoundType } from '../types';

export const BRACKET_POSITIONS: Record<number, number[]> = {
  2: [1, 2],
  4: [1, 4, 2, 3],
  8: [1, 8, 4, 5, 2, 7, 3, 6],
  16: [
    1, 16, 8, 9,
    4, 13, 5, 12,
    2, 15, 7, 10,
    3, 14, 6, 11
  ],
  32: [
    1, 32, 16, 17, 8, 25, 9, 24,
    4, 29, 13, 20, 5, 28, 12, 21,
    2, 31, 15, 18, 7, 26, 10, 23,
    3, 30, 14, 19, 6, 27, 11, 22
  ],
  64: [
    1, 64, 32, 33, 16, 49, 17, 48,
    8, 57, 25, 40, 9, 56, 24, 41,
    4, 61, 29, 36, 13, 52, 20, 45,
    5, 60, 28, 37, 12, 53, 21, 44,
    2, 63, 31, 34, 15, 50, 18, 47,
    7, 58, 26, 39, 10, 55, 23, 42,
    3, 62, 30, 35, 14, 51, 19, 46,
    6, 59, 27, 38, 11, 54, 22, 43
  ],
};

/**
 * Retourne le nom du tour pour une position donnée dans un TED de taille donnée.
 * Les positions vont de 0 à tedSize-1
 */
export function getRoundName(position: number, tedSize: number): RoundType {
  if (position === tedSize - 1) return '3rd_place';
  
  const roundSizes: { size: number; round: RoundType }[] = [];
  if (tedSize >= 64) roundSizes.push({ size: 32, round: 'thirtysecondfinal' });
  if (tedSize >= 32) roundSizes.push({ size: 16, round: 'sixteenthfinal' });
  if (tedSize >= 16) roundSizes.push({ size: 8, round: 'eighthfinal' });
  if (tedSize >= 8) roundSizes.push({ size: 4, round: 'quarterfinal' });
  if (tedSize >= 4) roundSizes.push({ size: 2, round: 'semifinal' });
  roundSizes.push({ size: 1, round: 'final' });

  let offset = 0;
  for (const r of roundSizes) {
    if (position >= offset && position < offset + r.size) {
      return r.round;
    }
    offset += r.size;
  }
  return 'final';
}

/**
 * Calcule la bracket_position du match suivant — mathématiquement exact.
 */
export function getNextBracketPosition(pos: number, tedSize: number): number | null {
  if (pos === tedSize - 1) return null; // 3e place, pas de suite

  const roundSizes: { size: number; round: RoundType }[] = [];
  if (tedSize >= 64) roundSizes.push({ size: 32, round: 'thirtysecondfinal' });
  if (tedSize >= 32) roundSizes.push({ size: 16, round: 'sixteenthfinal' });
  if (tedSize >= 16) roundSizes.push({ size: 8, round: 'eighthfinal' });
  if (tedSize >= 8) roundSizes.push({ size: 4, round: 'quarterfinal' });
  if (tedSize >= 4) roundSizes.push({ size: 2, round: 'semifinal' });
  roundSizes.push({ size: 1, round: 'final' });

  let offset = 0;
  for (let i = 0; i < roundSizes.length; i++) {
    const r = roundSizes[i];
    if (pos >= offset && pos < offset + r.size) {
      if (r.round === 'final') return null; // Finale n'a pas de match suivant
      const posInRound = pos - offset;
      const nextRoundOffset = offset + r.size;
      return nextRoundOffset + Math.floor(posInRound / 2);
    }
    offset += r.size;
  }
  return null;
}
