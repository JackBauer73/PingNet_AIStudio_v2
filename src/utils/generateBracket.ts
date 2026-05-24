import { supabase } from '../supabase';
import { RoundType } from '../types';

export async function generateBracket(tournamentId: string, categoryName?: string) {
  console.log('Generating bracket for tournament:', tournamentId, 'Category:', categoryName);
  
  // 1. Déterminer si on cible une série en particulier
  if (!categoryName) {
    // Si pas de catégorie transmise, récupérer la première catégorie disponible ou lever une erreur
    const { data: tableCats } = await supabase
      .from('table_categories')
      .select('name')
      .eq('tournament_id', tournamentId)
      .limit(1);
    if (tableCats && tableCats.length > 0) {
      categoryName = tableCats[0].name;
    } else {
      throw new Error('Aucune catégorie trouvée pour ce tournoi.');
    }
  }

  // 1b. Trouver les poules réelles de match de cette catégorie
  const { data: categoryPools, error: poolsError } = await supabase
    .from('pools')
    .select('*')
    .eq('tournament_id', tournamentId)
    .like('name', `${categoryName} - Poule %`)
    .order('name');

  if (poolsError) throw poolsError;
  const poolIds = (categoryPools || []).map(p => p.id);

  if (poolIds.length === 0) {
    throw new Error(`Aucune poule active trouvée pour la série ${categoryName}.`);
  }

  // 1c. Trouver ou créer la poule fictive de bracket pour cette catégorie
  const bracketPoolName = `${categoryName} - Bracket`;
  let { data: existingPool } = await supabase
    .from('pools')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('name', bracketPoolName)
    .maybeSingle();

  let bracketPoolId = existingPool?.id;
  if (!bracketPoolId) {
    const { data: newPool, error: poolErr } = await supabase
      .from('pools')
      .insert({
        tournament_id: tournamentId,
        name: bracketPoolName,
        status: 'pending'
      })
      .select()
      .single();
    if (poolErr) throw poolErr;
    bracketPoolId = newPool.id;
  }

  // 1d. Charger les joueurs et matchs correspondants
  const [matchesRes, playersRes] = await Promise.all([
    supabase.from('matches').select('*, sets(*)').eq('tournament_id', tournamentId).in('pool_id', poolIds),
    supabase.from('players').select('*').eq('tournament_id', tournamentId).eq('serie', categoryName)
  ]);

  if (matchesRes.error) throw matchesRes.error;
  if (playersRes.error) throw playersRes.error;

  const { data: poolPlayers, error: ppError } = await supabase
    .from('pool_players')
    .select('*')
    .in('pool_id', poolIds);

  if (ppError) throw ppError;

  const matches = matchesRes.data || [];
  const allPlayers = playersRes.data || [];
  const playersById = new Map(allPlayers.map(p => [p.id, p]));

  // 2. Calculer le classement client-side
  const qualifiedPlayers: any[] = [];

  for (const pool of categoryPools || []) {
    const poolMatches = matches.filter(m => m.pool_id === pool.id);
    const playersInPool = (poolPlayers || []).filter(pp => pp.pool_id === pool.id);
    const playersMap = new Map<string, any>();

    playersInPool.forEach(pp => {
      const p = playersById.get(pp.player_id);
      if (p) {
        playersMap.set(p.id, {
          player_id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          points: 0,
          sets_won: 0,
          sets_lost: 0,
          points_scored: 0,
          points_conceded: 0,
          matches_played: 0
        });
      }
    });

    poolMatches.forEach(m => {
      if (m.status === 'finished') {
        const sets = (m.sets as any[]) || [];
        const p1Sets = sets.filter(s => s.score_p1 > s.score_p2).length;
        const p2Sets = sets.filter(s => s.score_p2 > s.score_p1).length;
        
        const p1 = playersMap.get(m.player1_id || '');
        const p2 = playersMap.get(m.player2_id || '');

        if (p1) {
          p1.matches_played += 1;
          p1.sets_won += p1Sets;
          p1.sets_lost += p2Sets;
          p1.points_scored += sets.reduce((acc, s) => acc + (s.score_p1 || 0), 0);
          p1.points_conceded += sets.reduce((acc, s) => acc + (s.score_p2 || 0), 0);
          if (p1Sets > p2Sets) p1.points += 2;
          else if (p2Sets > p1Sets) p1.points += 0;
          else p1.points += 1; // Égalité
        }
        if (p2) {
          p2.matches_played += 1;
          p2.sets_won += p2Sets;
          p2.sets_lost += p1Sets;
          p2.points_scored += sets.reduce((acc, s) => acc + (s.score_p2 || 0), 0);
          p2.points_conceded += sets.reduce((acc, s) => acc + (s.score_p1 || 0), 0);
          if (p2Sets > p1Sets) p2.points += 2;
          else if (p1Sets > p2Sets) p2.points += 0;
          else p2.points += 1; // Égalité
        }
      }
    });

    const poolSorted = Array.from(playersMap.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const diffA = a.sets_won - a.sets_lost;
      const diffB = b.sets_won - b.sets_lost;
      if (diffB !== diffA) return diffB - diffA;
      if (b.sets_won !== a.sets_won) return b.sets_won - a.sets_won;
      return (b.points_scored - b.points_conceded) - (a.points_scored - a.points_conceded);
    });

    poolSorted.slice(0, 2).forEach((s, idx) => {
      qualifiedPlayers.push({
        ...s,
        standing_rank: idx + 1,
        pool_id: pool.id
      });
    });
  }

  console.log('Qualified players found for category:', categoryName, qualifiedPlayers.length);

  if (qualifiedPlayers.length < 2) {
    throw new Error('Pas assez de joueurs qualifiés dans cette série (au moins 2 requis).');
  }

  // 3. Appariement
  const firsts = qualifiedPlayers.filter(p => p.standing_rank === 1);
  const seconds = qualifiedPlayers.filter(p => p.standing_rank === 2);
  const allBracketMatches: any[] = [];

  const numQualifiers = qualifiedPlayers.length;
  let roundsToCreate: RoundType[] = [];

  if (numQualifiers <= 2) {
    roundsToCreate = ['final'];
  } else if (numQualifiers <= 4) {
    roundsToCreate = ['semifinal', 'final'];
  } else if (numQualifiers <= 8) {
    roundsToCreate = ['quarterfinal', 'semifinal', 'final'];
  } else {
    roundsToCreate = ['eighthfinal', 'quarterfinal', 'semifinal', 'final'];
  }

  if (numQualifiers > 2) {
    roundsToCreate.push('3rd_place');
  }

  const firstRound = roundsToCreate[0];
  const numFirstRoundMatches = Math.pow(2, (
    firstRound === 'eighthfinal' ? 4 : 
    firstRound === 'quarterfinal' ? 3 : 
    firstRound === 'semifinal' ? 2 : 1
  ) - 1);

  // 1er round de bracket
  for (let i = 0; i < numFirstRoundMatches; i++) {
    const p1 = firsts[i];
    const p2 = seconds.length > i ? seconds[i] : null;
    
    allBracketMatches.push({
      tournament_id: tournamentId,
      pool_id: bracketPoolId, // On l'associe à la poule fictive de bracket de sa série !
      player1_id: p1?.player_id || null,
      player2_id: p2?.player_id || null,
      round: firstRound,
      status: 'pending'
    });
  }

  // Rounds suivants
  const subsequentRounds = ['eighthfinal', 'quarterfinal', 'semifinal', 'final']
    .filter(r => roundsToCreate.includes(r as RoundType) && r !== firstRound);

  for (const round of subsequentRounds) {
    const roundIdx = ['eighthfinal', 'quarterfinal', 'semifinal', 'final'].indexOf(round);
    const numMatchesInRound = Math.pow(2, (['eighthfinal', 'quarterfinal', 'semifinal', 'final'].length - 1) - roundIdx);
    
    for (let i = 0; i < numMatchesInRound; i++) {
      allBracketMatches.push({
        tournament_id: tournamentId,
        pool_id: bracketPoolId, // Poule fictive de bracket
        player1_id: null,
        player2_id: null,
        round: round as RoundType,
        status: 'pending'
      });
    }
  }

  if (roundsToCreate.includes('3rd_place')) {
    allBracketMatches.push({
      tournament_id: tournamentId,
      pool_id: bracketPoolId, // Poule fictive de bracket
      player1_id: null,
      player2_id: null,
      round: '3rd_place',
      status: 'pending'
    });
  }

  // 4. Nettoyage et insertion
  const { data: oldBracketMatches } = await supabase
    .from('matches')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('pool_id', bracketPoolId);

  if (oldBracketMatches && oldBracketMatches.length > 0) {
    const oldMatchIds = oldBracketMatches.map(m => m.id);
    await supabase.from('sets').delete().in('match_id', oldMatchIds);
    await supabase.from('matches').delete().in('id', oldMatchIds);
  }

  for (const match of allBracketMatches) {
    const { error: insertError } = await supabase.from('matches').insert(match);
    if (insertError) throw insertError;
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  await supabase.from('tournaments').update({ status: 'bracket' }).eq('id', tournamentId);
}
