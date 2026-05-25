import { supabase } from '../supabase';
import { RoundType } from '../types';

const ROUND_ORDER: RoundType[] = ['thirtysecondfinal', 'sixteenthfinal', 'eighthfinal', 'quarterfinal', 'semifinal', 'final'];

export async function handleBracketProgression(matchId: string, winnerId: string) {
  // 1. Get current match details
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (matchError || !match || match.round === 'pool') return;

  const currentRound = match.round as RoundType;
  const tournamentId = match.tournament_id;

  // 2. Identify the position of the match in the current round
  const { data: roundMatches, error: roundError } = await supabase
    .from('matches')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('round', currentRound)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (roundError || !roundMatches) return;

  const matchIndex = roundMatches.findIndex(m => m.id === matchId);
  if (matchIndex === -1) return;

  // 3. Find target round and index
  const currentRoundIdx = ROUND_ORDER.indexOf(currentRound);
  if (currentRoundIdx === -1 || currentRoundIdx === ROUND_ORDER.length - 1) return; // Final round has no next

  const nextRound = ROUND_ORDER[currentRoundIdx + 1];
  const nextMatchIndex = Math.floor(matchIndex / 2);
  const isPlayer1 = matchIndex % 2 === 0;

  // 4. Find the target match in the next round
  let { data: nextRoundMatches, error: nextRoundError } = await supabase
    .from('matches')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('round', nextRound)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  // Safety: If match is missing (especially for Final), create it on the fly
  if ((!nextRoundMatches || nextRoundMatches.length <= nextMatchIndex) && !nextRoundError) {
    const numExpected = nextRound === 'final' ? 1 : Math.max(1, Math.floor(roundMatches.length / 2));
    const toCreate = [];
    const existingCount = nextRoundMatches?.length || 0;
    
    for (let i = existingCount; i < numExpected; i++) {
      toCreate.push({
        tournament_id: tournamentId,
        player1_id: null,
        player2_id: null,
        round: nextRound,
        status: 'pending'
      });
    }

    if (toCreate.length > 0) {
      const { data: created } = await supabase.from('matches').insert(toCreate).select('id');
      if (created) {
        nextRoundMatches = [...(nextRoundMatches || []), ...created];
      }
    }
  }

  if (!nextRoundMatches || nextRoundMatches.length <= nextMatchIndex) return;

  const targetMatchId = nextRoundMatches[nextMatchIndex].id;

  // 5. Update target match
  const updateData = isPlayer1 ? { player1_id: winnerId } : { player2_id: winnerId };
  await supabase
    .from('matches')
    .update(updateData)
    .eq('id', targetMatchId);

  // 5.b Handle 3rd place match (losers of semi-finals)
  if (currentRound === 'semifinal') {
    const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;
    if (loserId) {
      const { data: thirdPlaceMatch } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('round', '3rd_place')
        .single();
      
      if (thirdPlaceMatch) {
        const thirdPlaceUpdate = isPlayer1 ? { player1_id: loserId } : { player2_id: loserId };
        await supabase
          .from('matches')
          .update(thirdPlaceUpdate)
          .eq('id', thirdPlaceMatch.id);
      }
    }
  }

  // 6. Auto-launch match if it's now full
  const { data: updatedMatch } = await supabase
    .from('matches')
    .select('player1_id, player2_id')
    .eq('id', targetMatchId)
    .single();

  if (updatedMatch?.player1_id && updatedMatch?.player2_id) {
    // Fetch tournament for tables info
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('nb_tables')
      .eq('id', tournamentId)
      .single();

    // Check for free tables
    const { data: busyMatches } = await supabase
      .from('matches')
      .select('table_number')
      .eq('tournament_id', tournamentId)
      .eq('status', 'in_progress');

    const nbTables = tournament?.nb_tables || 0;
    const busyTableNumbers = busyMatches?.map(m => m.table_number).filter(Boolean) || [];
    const freeTables = Array.from({ length: nbTables }, (_, i) => i + 1)
      .filter(n => !busyTableNumbers.includes(n));

    if (freeTables.length > 0) {
      await supabase.from('matches').update({
        table_number: freeTables[0],
        status: 'in_progress',
        started_at: new Date().toISOString()
      }).eq('id', targetMatchId);
    }
  }
}
