import { supabase } from '../supabase';
import { RoundType } from '../types';
import { handleBracketProgression } from './bracketAdvancement';

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
  const { data: rawCategoryPools, error: poolsError } = await supabase
    .from('pools')
    .select('*')
    .eq('tournament_id', tournamentId)
    .like('name', `${categoryName} - Poule %`);

  if (poolsError) throw poolsError;

  const getPoolNumber = (name: string): number => {
    const match = name.match(/Poule\s+(\d+)/i);
    return match ? parseInt(match[1], 10) : 0;
  };

  const categoryPools = (rawCategoryPools || []).sort((a, b) => {
    const numA = getPoolNumber(a.name);
    const numB = getPoolNumber(b.name);
    if (numA !== numB) {
      return numA - numB;
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  const poolIds = categoryPools.map(p => p.id);

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
  const [matchesRes, registrationsRes] = await Promise.all([
    supabase.from('matches').select('*, sets(*)').eq('tournament_id', tournamentId).in('pool_id', poolIds),
    supabase.from('registrations').select('*, players(*), table_categories(*)').eq('tournament_id', tournamentId)
  ]);

  if (matchesRes.error) throw matchesRes.error;
  if (registrationsRes.error) throw registrationsRes.error;

  const { data: poolPlayers, error: ppError } = await supabase
    .from('pool_players')
    .select('*')
    .in('pool_id', poolIds);

  if (ppError) throw ppError;

  const matches = matchesRes.data || [];
  const allPlayers = (registrationsRes.data || [])
    .filter((r: any) => r.table_categories?.name === categoryName)
    .map((r: any) => ({
      id: r.players?.id,
      first_name: r.players?.first_name || '',
      last_name: r.players?.last_name || '',
      club: r.players?.club || '',
      licence_number: r.players?.licence_number || '',
      points: r.players?.points || 500,
      serie: r.table_categories?.name || '',
      checked_in: r.checked_in || false,
      paid: r.paid || false,
      dossard: r.dossard || null,
      tournament_id: r.tournament_id
    }));
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

  // 3. Appariement FFTT Officiel (TED 2 à 64)
  const firsts = qualifiedPlayers.filter(p => p.standing_rank === 1);
  const seconds = qualifiedPlayers.filter(p => p.standing_rank === 2);

  // Trier les qualifiés par points officiels FFTT décroissants
  const firstsSorted = [...firsts].sort((a, b) => (b.points || 0) - (a.points || 0));
  const secondsSorted = [...seconds].sort((a, b) => (b.points || 0) - (a.points || 0));

  // Les 1ers forment les seeds de 1 à P, les 2es forment les seeds de P+1 à 2P
  const seedsList = [...firstsSorted, ...secondsSorted];
  const numQualifiers = seedsList.length;

  // Déterminer la taille du tableau de départ
  let targetTableSize = 4;
  if (numQualifiers <= 2) {
    targetTableSize = 2;
  } else if (numQualifiers <= 4) {
    targetTableSize = 4;
  } else if (numQualifiers <= 8) {
    targetTableSize = 8;
  } else if (numQualifiers <= 16) {
    targetTableSize = 16;
  } else if (numQualifiers <= 32) {
    targetTableSize = 32;
  } else {
    targetTableSize = 64;
  }

  // Définition des tables de graines FFTT officielles
  const SEEDS_2 = [1, 2];
  const SEEDS_4 = [1, 4, 3, 2];
  const SEEDS_8 = [1, 8, 5, 4, 3, 6, 7, 2];
  const SEEDS_16 = [1, 16, 9, 8, 5, 12, 13, 4, 3, 14, 11, 6, 7, 10, 15, 2];
  const SEEDS_32 = [
    1, 32, 17, 16, 9, 24, 25, 8,
    5, 28, 21, 12, 13, 20, 29, 4,
    3, 30, 19, 14, 11, 22, 27, 6,
    7, 26, 23, 10, 15, 18, 31, 2
  ];
  const SEEDS_64 = [
    1, 64, 33, 32, 17, 48, 49, 16, 
    9, 56, 41, 24, 25, 40, 57, 8, 
    5, 60, 37, 28, 21, 44, 53, 12, 
    13, 52, 45, 20, 29, 36, 61, 4, 
    3, 62, 35, 30, 19, 46, 51, 14, 
    11, 54, 43, 22, 27, 38, 59, 6, 
    7, 58, 39, 26, 23, 42, 55, 10, 
    15, 50, 47, 18, 31, 34, 63, 2
  ];

  let SEEDS_T = SEEDS_4;
  let firstRound: RoundType = 'semifinal';

  if (targetTableSize === 2) {
    SEEDS_T = SEEDS_2;
    firstRound = 'final';
  } else if (targetTableSize === 4) {
    SEEDS_T = SEEDS_4;
    firstRound = 'semifinal';
  } else if (targetTableSize === 8) {
    SEEDS_T = SEEDS_8;
    firstRound = 'quarterfinal';
  } else if (targetTableSize === 16) {
    SEEDS_T = SEEDS_16;
    firstRound = 'eighthfinal';
  } else if (targetTableSize === 32) {
    SEEDS_T = SEEDS_32;
    firstRound = 'sixteenthfinal';
  } else if (targetTableSize === 64) {
    SEEDS_T = SEEDS_64;
    firstRound = 'thirtysecondfinal';
  }

  const roundsToCreate: RoundType[] = [];
  const allRoundsOrder: RoundType[] = ['thirtysecondfinal', 'sixteenthfinal', 'eighthfinal', 'quarterfinal', 'semifinal', 'final'];
  
  const firstRoundIdx = allRoundsOrder.indexOf(firstRound);
  if (firstRoundIdx !== -1) {
    roundsToCreate.push(...allRoundsOrder.slice(firstRoundIdx));
  }
  if (targetTableSize >= 4) {
    roundsToCreate.push('3rd_place');
  }

  const numFirstRoundMatches = targetTableSize / 2;
  const allBracketMatches: any[] = [];

  // 1er round : Appariement avec byes éventuels
  for (let i = 0; i < numFirstRoundMatches; i++) {
    const seed1 = SEEDS_T[2 * i];
    const seed2 = SEEDS_T[2 * i + 1];

    const p1 = seed1 <= numQualifiers ? seedsList[seed1 - 1] : null;
    const p2 = seed2 <= numQualifiers ? seedsList[seed2 - 1] : null;

    const hasP1 = !!p1;
    const hasP2 = !!p2;
    let status: 'finished' | 'pending' = 'pending';
    let winner_id: string | null = null;

    if (hasP1 && !hasP2) {
      status = 'finished';
      winner_id = p1.player_id;
    } else if (!hasP1 && hasP2) {
      status = 'finished';
      winner_id = p2.player_id;
    } else if (!hasP1 && !hasP2) {
      status = 'finished';
      winner_id = null;
    }

    allBracketMatches.push({
      tournament_id: tournamentId,
      pool_id: bracketPoolId,
      player1_id: p1?.player_id || null,
      player2_id: p2?.player_id || null,
      round: firstRound,
      status,
      winner_id
    });
  }

  // Tours suivants (initialement vides)
  const subsequentRounds = allRoundsOrder
    .filter(r => roundsToCreate.includes(r as RoundType) && r !== firstRound);

  for (const round of subsequentRounds) {
    const roundIdx = allRoundsOrder.indexOf(round);
    const numMatchesInRound = Math.pow(2, (allRoundsOrder.length - 1) - roundIdx);
    
    for (let i = 0; i < numMatchesInRound; i++) {
      allBracketMatches.push({
        tournament_id: tournamentId,
        pool_id: bracketPoolId,
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
      pool_id: bracketPoolId,
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

  const insertedMatches: any[] = [];
  for (const match of allBracketMatches) {
    const { data: inserted, error: insertError } = await supabase
      .from('matches')
      .insert(match)
      .select()
      .single();
    if (insertError) throw insertError;
    insertedMatches.push(inserted);
    await new Promise(resolve => setTimeout(resolve, 30));
  }

  // Propager automatiquement les exemptions (byes) au prochain tour
  for (const inserted of insertedMatches) {
    if (inserted.round === firstRound && inserted.status === 'finished' && inserted.winner_id) {
      await handleBracketProgression(inserted.id, inserted.winner_id);
    }
  }

  await supabase.from('tournaments').update({ status: 'bracket' }).eq('id', tournamentId);
}
