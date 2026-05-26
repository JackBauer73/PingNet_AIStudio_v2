import { supabase } from '../supabase';

export async function notifyMatchValidation(matchId: string) {
  const { data: match, error } = await supabase
    .from('matches')
    .select('*, player1:player1_id(*), player2:player2_id(*)')
    .eq('id', matchId)
    .maybeSingle();

  if (error || !match) return;

  const notifications = [];
  if (match.player1_id) {
    notifications.push({
      player_id: match.player1_id,
      tournament_id: match.tournament_id,
      type: 'validate_match',
      payload: {
        match_id: matchId,
        opponent_name: `${match.player2?.first_name || ''} ${match.player2?.last_name || ''}`.trim(),
        round: match.round,
      },
    });
  }
  if (match.player2_id) {
    notifications.push({
      player_id: match.player2_id,
      tournament_id: match.tournament_id,
      type: 'validate_match',
      payload: {
        match_id: matchId,
        opponent_name: `${match.player1?.first_name || ''} ${match.player1?.last_name || ''}`.trim(),
        round: match.round,
      },
    });
  }

  if (notifications.length > 0) {
    await supabase.from('notifications').insert(notifications);
  }
}

export async function notifyMatchReady(matchId: string) {
  const { data: match, error } = await supabase
    .from('matches')
    .select('*, player1:player1_id(*), player2:player2_id(*)')
    .eq('id', matchId)
    .maybeSingle();

  if (error || !match) return;

  const notifications = [];
  if (match.player1_id) {
    notifications.push({
      player_id: match.player1_id,
      tournament_id: match.tournament_id,
      type: 'match_ready',
      payload: {
        match_id: matchId,
        table_number: match.table_number,
        opponent_name: `${match.player2?.first_name || ''} ${match.player2?.last_name || ''}`.trim(),
      },
    });
  }
  if (match.player2_id) {
    notifications.push({
      player_id: match.player2_id,
      tournament_id: match.tournament_id,
      type: 'match_ready',
      payload: {
        match_id: matchId,
        table_number: match.table_number,
        opponent_name: `${match.player1?.first_name || ''} ${match.player1?.last_name || ''}`.trim(),
      },
    });
  }

  if (notifications.length > 0) {
    await supabase.from('notifications').insert(notifications);
  }
}

export async function notifyStandingsValidation(poolId: string, tournamentId: string, playerIds: string[]) {
  const notifications = playerIds.map(pid => ({
    player_id: pid,
    tournament_id: tournamentId,
    type: 'validate_standings',
    payload: {
      pool_id: poolId,
    },
  }));

  if (notifications.length > 0) {
    await supabase.from('notifications').insert(notifications);
  }
}
