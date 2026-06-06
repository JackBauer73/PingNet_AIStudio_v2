import { supabase } from '../supabase';
import { BRACKET_POSITIONS, getRoundName } from '../lib/bracketPositions';
import { handleBracketProgression } from './bracketAdvancement';

export async function generateBracket(tournamentId: string, categoryName?: string) {
  console.log('Generating bracket for tournament:', tournamentId, 'Category:', categoryName);
  
  // 1. Déterminer si on cible une série en particulier
  if (!categoryName) {
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

  // 1b. Récupérer la catégorie
  const { data: category } = await supabase
    .from('table_categories')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('name', categoryName)
    .single();

  if (!category) throw new Error(`Catégorie "${categoryName}" introuvable.`);

  // 1c. Trouver les poules de cette catégorie
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
    if (numA !== numB) return numA - numB;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  const poolIds = categoryPools.map(p => p.id);

  if (poolIds.length === 0) {
    throw new Error(`Aucune poule active trouvée pour la série ${categoryName}.`);
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
  const dossardByPlayerId = new Map<string, number>();
  const checkedInByPlayerId = new Map<string, boolean>();
  const paidByPlayerId = new Map<string, boolean>();

  (registrationsRes.data || []).forEach((r: any) => {
    const pid = r.players?.id;
    if (pid) {
      if (r.dossard !== null && r.dossard !== undefined) {
        dossardByPlayerId.set(pid, r.dossard);
      }
      if (r.checked_in) {
        checkedInByPlayerId.set(pid, true);
      }
      if (r.paid) {
        paidByPlayerId.set(pid, true);
      }
    }
  });

  const allPlayers = (registrationsRes.data || [])
    .filter((r: any) => r.table_categories?.name === categoryName)
    .map((r: any) => {
      const pid = r.players?.id;
      const resolvedDossard = r.dossard || (pid ? dossardByPlayerId.get(pid) : null) || null;
      const resolvedCheckedIn = r.checked_in || (pid ? checkedInByPlayerId.get(pid) : false) || false;
      const resolvedPaid = r.paid || (pid ? paidByPlayerId.get(pid) : false) || false;
      return {
        id: pid,
        first_name: r.players?.first_name || '',
        last_name: r.players?.last_name || '',
        club: r.players?.club || '',
        licence_number: r.players?.licence_number || '',
        points: r.players?.points || 500,
        serie: r.table_categories?.name || '',
        checked_in: resolvedCheckedIn,
        paid: resolvedPaid,
        dossard: resolvedDossard,
        seed_number: r.seed_number || null,
        tournament_id: r.tournament_id
      };
    });
  const playersById = new Map(allPlayers.map(p => [p.id, p]));

  // 2. Calculer le classement de chaque poule pour trouver les qualifiés
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
          matches_played: 0,
          ffttPoints: p.points || 500,
          seed_number: p.seed_number || null
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
          else p1.points += 1;
        }
        if (p2) {
          p2.matches_played += 1;
          p2.sets_won += p2Sets;
          p2.sets_lost += p1Sets;
          p2.points_scored += sets.reduce((acc, s) => acc + (s.score_p2 || 0), 0);
          p2.points_conceded += sets.reduce((acc, s) => acc + (s.score_p1 || 0), 0);
          if (p2Sets > p1Sets) p2.points += 2;
          else if (p1Sets > p2Sets) p2.points += 0;
          else p2.points += 1;
        }
      }
    });

    // Tri selon les règles FFTT officielles :
    // 1. Points de poule (victoires)
    // 2. Différence de sets gagnés/perdus (sets_won - sets_lost)
    // 3. Nombre absolu de sets gagnés (sets_won)
    // 4. Différence de points marqués/encaissés (points_scored - points_conceded)
    const poolSorted = Array.from(playersMap.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const diffA = a.sets_won - a.sets_lost;
      const diffB = b.sets_won - b.sets_lost;
      if (diffB !== diffA) return diffB - diffA;
      if (b.sets_won !== a.sets_won) return b.sets_won - a.sets_won;
      return (b.points_scored - b.points_conceded) - (a.points_scored - a.points_conceded);
    });

    // 2 qualifiés par poule (ou le nombre de joueurs présents si inférieur à 2)
    const nbQualif = Math.min(2, playersInPool.length);
    poolSorted.slice(0, nbQualif).forEach((s, idx) => {
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

  // Seeding officiel utilisant les seed_number de base de données (générés avec les poules),
  // sinon fallback sur points FFTT officiels (DESC) puis ordre alphabétique s'ils ont le même classement.
  qualifiedPlayers.sort((a, b) => {
    if (a.seed_number != null && b.seed_number != null) {
      return a.seed_number - b.seed_number;
    }
    // Fallback de secours
    if (b.ffttPoints !== a.ffttPoints) {
      return b.ffttPoints - a.ffttPoints;
    }
    const nameA = `${a.last_name || ''} ${a.first_name || ''}`.trim().toLowerCase();
    const nameB = `${b.last_name || ''} ${b.first_name || ''}`.trim().toLowerCase();
    return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
  });

  const numQualifiers = qualifiedPlayers.length;

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

  const SEEDS = BRACKET_POSITIONS[targetTableSize];
  if (!SEEDS) {
    throw new Error(`Table de graines indisponible pour la taille : ${targetTableSize}`);
  }

  // ── 3. Créer ou recréer le bracket ───────────────────────────────────────
  // Supprimer l'ancien bracket s'il existe (avec ses matchs)
  const { data: oldBracket } = await supabase
    .from('brackets')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('category_id', category.id)
    .maybeSingle();

  if (oldBracket) {
    // Supprimer les anciens matchs de bracket (qui ont bracket_id renseigné)
    const { data: matchesToDelete } = await supabase
      .from('matches')
      .select('id')
      .eq('bracket_id', oldBracket.id);

    if (matchesToDelete && matchesToDelete.length > 0) {
      const mIds = matchesToDelete.map(m => m.id);
      await supabase.from('sets').delete().in('match_id', mIds);
      await supabase.from('matches').delete().in('id', mIds);
    }
    await supabase.from('brackets').delete().eq('id', oldBracket.id);
  }

  // Supprimer également toutes les anciennes fausses pools de bracket résiduelles
  const { data: oldFakePools } = await supabase
    .from('pools')
    .select('id')
    .eq('tournament_id', tournamentId)
    .like('name', `${categoryName} - Bracket`);

  if (oldFakePools && oldFakePools.length > 0) {
    const fakePoolIds = oldFakePools.map(p => p.id);
    const { data: fakeMatches } = await supabase
      .from('matches')
      .select('id')
      .in('pool_id', fakePoolIds);
    if (fakeMatches && fakeMatches.length > 0) {
      const fmIds = fakeMatches.map(m => m.id);
      await supabase.from('sets').delete().in('match_id', fmIds);
      await supabase.from('matches').delete().in('id', fmIds);
    }
    await supabase.from('pools').delete().in('id', fakePoolIds);
  }

  // Insérer le nouveau bracket de métadonnées
  const { data: bracket, error: bracketErr } = await supabase
    .from('brackets')
    .insert({
      tournament_id: tournamentId,
      category_id:   category.id,
      ted_size:      targetTableSize,
      nb_qualifiers: numQualifiers,
      status:        'in_progress',
    })
    .select()
    .single();

  if (bracketErr) throw bracketErr;

  // ── 4. Pré-remplir la table standard matches avec les colonnes bracket ───
  // Toutes les cases du bracket sont créées d'un coup.
  const allBracketMatches: any[] = [];
  const firstRoundCount = targetTableSize / 2;

  // Tour 1 : Rempli avec les joueurs ou qualifiés. seedNum > numQualifiers → BYE automatique.
  for (let i = 0; i < firstRoundCount; i++) {
    const seed1 = SEEDS[2 * i];
    const seed2 = SEEDS[2 * i + 1];

    const p1 = seed1 <= numQualifiers ? qualifiedPlayers[seed1 - 1] : null;
    const p2 = seed2 <= numQualifiers ? qualifiedPlayers[seed2 - 1] : null;

    const isBye = !p1 || !p2;
    const winnerId = !p1 ? p2?.player_id
                   : !p2 ? p1?.player_id
                   : null;

    const rName = getRoundName(i, targetTableSize);

    allBracketMatches.push({
      tournament_id: tournamentId,
      pool_id: null, // Plus de pool_id fictif pour les brackets !
      bracket_id: bracket.id,
      bracket_position: i,
      bracket_round: rName,
      round: rName, // Gardé pour compatibilité directe avec l'interface existante
      player1_id: p1?.player_id || null,
      player2_id: p2?.player_id || null,
      status: isBye ? 'finished' : 'pending',
      winner_id: winnerId
    });
  }

  // On génère maintenant les cases vides des tours suivants
  let roundStartIndex = firstRoundCount;
  let matchesInRound = firstRoundCount / 2;

  while (matchesInRound >= 1) {
    for (let i = 0; i < matchesInRound; i++) {
      const pos = roundStartIndex + i;
      const rName = getRoundName(pos, targetTableSize);

      allBracketMatches.push({
        tournament_id: tournamentId,
        pool_id: null,
        bracket_id: bracket.id,
        bracket_position: pos,
        bracket_round: rName,
        round: rName,
        player1_id: null,
        player2_id: null,
        status: 'pending',
        winner_id: null
      });
    }
    roundStartIndex += matchesInRound;
    matchesInRound = Math.floor(matchesInRound / 2);
  }

  // Insertion en base pour tous les matchs de bracket
  const insertedMatches: any[] = [];
  for (const match of allBracketMatches) {
    const { data: inserted, error: insertError } = await supabase
      .from('matches')
      .insert(match)
      .select()
      .single();
    if (insertError) throw insertError;
    insertedMatches.push(inserted);
    // Court délai pour assurer la consistance
    await new Promise(resolve => setTimeout(resolve, 20));
  }

  // ── 5. Propagation immédiate des BYE (exemptions) ───
  const byeMatches = insertedMatches.filter(m => m.status === 'finished' && m.winner_id);
  for (const byeMatch of byeMatches) {
    await handleBracketProgression(byeMatch.id, byeMatch.winner_id);
  }

  // Changement de phase du tournoi
  await supabase
    .from('tournaments')
    .update({ status: 'bracket' })
    .eq('id', tournamentId);

  return bracket;
}
