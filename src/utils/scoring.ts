/**
 * Règle officielle TT pour valider un score de set
 */
export function isValidSetScore(s1: number, s2: number, pointsPerSet = 11): boolean {
  if (s1 === s2) return false;                        // égalité impossible
  const max = Math.max(s1, s2);
  const min = Math.min(s1, s2);
  if (max < pointsPerSet) return false;               // personne n'a atteint le score
  if (max === pointsPerSet) return min <= max - 2;    // 11-9 ✓, 11-10 ✗
  return (max - min) === 2;                           // 13-11 ✓, 14-11 ✗ (prolongation)
}

/**
 * Calcul du résultat du match en fonction des sets
 */
export function computeMatchResult(sets: { score_p1: number, score_p2: number }[], setsToWin = 2) {
  let w1 = 0, w2 = 0;
  for (const s of sets) {
    if (s.score_p1 > s.score_p2) w1++;
    else if (s.score_p2 > s.score_p1) w2++;
  }
  if (w1 >= setsToWin) return { winner: 'p1' as const, w1, w2 };
  if (w2 >= setsToWin) return { winner: 'p2' as const, w1, w2 };
  return { winner: null, w1, w2 };
}
