export function generatePoolMatches(playerIds: string[], poolId: string, tournamentId: string) {
  const matches = [];
  const len = playerIds.length;

  if (len === 3) {
    const A = playerIds[0];
    const B = playerIds[1];
    const C = playerIds[2];
    
    // Ordre FFTT de Poule de 3 : 1 v 3 (A v C) / 1 v 2 (A v B) / 2 v 3 (B v C)
    return [
      { tournament_id: tournamentId, pool_id: poolId, player1_id: A, player2_id: C, round: 'pool', status: 'pending' },
      { tournament_id: tournamentId, pool_id: poolId, player1_id: A, player2_id: B, round: 'pool', status: 'pending' },
      { tournament_id: tournamentId, pool_id: poolId, player1_id: B, player2_id: C, round: 'pool', status: 'pending' }
    ];
  } else if (len === 4) {
    const A = playerIds[0];
    const B = playerIds[1];
    const C = playerIds[2];
    const D = playerIds[3];

    // Ordre FFTT de Poule de 4
    return [
      { tournament_id: tournamentId, pool_id: poolId, player1_id: A, player2_id: D, round: 'pool', status: 'pending' },
      { tournament_id: tournamentId, pool_id: poolId, player1_id: B, player2_id: C, round: 'pool', status: 'pending' },
      { tournament_id: tournamentId, pool_id: poolId, player1_id: A, player2_id: C, round: 'pool', status: 'pending' },
      { tournament_id: tournamentId, pool_id: poolId, player1_id: B, player2_id: D, round: 'pool', status: 'pending' },
      { tournament_id: tournamentId, pool_id: poolId, player1_id: A, player2_id: B, round: 'pool', status: 'pending' },
      { tournament_id: tournamentId, pool_id: poolId, player1_id: C, player2_id: D, round: 'pool', status: 'pending' }
    ];
  }

  // Comportement générique par défaut si ce n'est pas 3 ou 4 joueurs
  for (let i = 0; i < len; i++) {
    for (let j = i + 1; j < len; j++) {
      matches.push({
        tournament_id: tournamentId,
        pool_id: poolId,
        player1_id: playerIds[i],
        player2_id: playerIds[j],
        round: 'pool',
        status: 'pending'
      });
    }
  }
  return matches;
}
