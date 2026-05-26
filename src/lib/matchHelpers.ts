import { SetScore, Match } from '../types';

export function isMatchOver(sets: SetScore[], setsToWin: number = 2): boolean {
  const winsP1 = sets.filter(s => s.score_p1 > s.score_p2).length;
  const winsP2 = sets.filter(s => s.score_p2 > s.score_p1).length;
  return winsP1 >= setsToWin || winsP2 >= setsToWin;
}

export function detectScorerRole(match: Match, playerId: string): 'player' | 'arbiter' | 'third_player' {
  if (match.player1_id === playerId || match.player2_id === playerId) {
    return 'player';
  }
  // In our simplified workflow, other scorers are treated as 'third_player' by default
  return 'third_player';
}
