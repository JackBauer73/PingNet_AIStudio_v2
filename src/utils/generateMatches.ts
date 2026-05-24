export function generatePoolMatches(playerIds: string[], poolId: string, tournamentId: string) {
  const matches = [];
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
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
