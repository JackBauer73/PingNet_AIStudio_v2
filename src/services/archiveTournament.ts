import { supabase } from '../supabase';

export async function archiveTournament(tournamentId: string): Promise<void> {
  // 1. Charger les données du tournoi
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id, name, date, end_date, location, nb_tables, organizer_id')
    .eq('id', tournamentId)
    .single();

  if (tournamentError || !tournament) {
    throw new Error('Tournoi introuvable ou erreur de lecture du tournoi.');
  }

  // 2. Charger toutes les catégories (tableaux) du tournoi
  const { data: tableCategories, error: categoriesError } = await supabase
    .from('table_categories')
    .select('*')
    .eq('tournament_id', tournamentId);

  if (categoriesError) {
    throw new Error('Erreur de chargement des catégories du tournoi : ' + categoriesError.message);
  }

  const categories = tableCategories || [];

  // 3. Charger toutes les inscriptions (registrations) du tournoi avec les détails des joueurs physiques
  const { data: registrations, error: regError } = await supabase
    .from('registrations')
    .select(`
      id,
      player_id,
      table_category_id,
      checked_in,
      paid,
      dossard,
      players (
        id,
        first_name,
        last_name,
        club,
        points,
        licence_number
      )
    `)
    .eq('tournament_id', tournamentId);

  if (regError) {
    throw new Error('Erreur de chargement des inscriptions : ' + regError.message);
  }

  const allRegistrations = registrations || [];

  // 4. Charger tous les matchs du tournoi avec les informations des joueurs (sans sets détaillés, RGPD)
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select(`
      id,
      pool_id,
      bracket_id,
      bracket_position,
      bracket_round,
      round,
      status,
      winner_id,
      player1_id,
      player2_id,
      player1:players!player1_id (
        id,
        first_name,
        last_name,
        club,
        points
      ),
      player2:players!player2_id (
        id,
        first_name,
        last_name,
        club,
        points
      )
    `)
    .eq('tournament_id', tournamentId);

  if (matchesError) {
    throw new Error('Erreur de chargement des matches : ' + matchesError.message);
  }

  const allMatches = matches || [];

  // 5. Charger toutes les poules (pools) du tournoi
  const { data: pools, error: poolsError } = await supabase
    .from('pools')
    .select('id, table_category_id')
    .eq('tournament_id', tournamentId);

  if (poolsError) {
    throw new Error('Erreur de chargement des poules : ' + poolsError.message);
  }

  // 6. Charger tous les brackets du tournoi
  const { data: brackets, error: bracketsError } = await supabase
    .from('brackets')
    .select('id, category_id')
    .eq('tournament_id', tournamentId);

  if (bracketsError) {
    throw new Error('Erreur de chargement des brackets : ' + bracketsError.message);
  }

  // Création des tables de hachage associant pool/bracket à sa catégorie correspondante
  const poolToCategoryMap = new Map<string, string>();
  pools?.forEach(p => {
    if (p.id && p.table_category_id) {
      poolToCategoryMap.set(p.id, p.table_category_id);
    }
  });

  const bracketToCategoryMap = new Map<string, string>();
  brackets?.forEach(b => {
    if (b.id && b.category_id) {
      bracketToCategoryMap.set(b.id, b.category_id);
    }
  });

  // Helper pour trouver la catégorie associée à un match
  const getMatchCategoryId = (match: any): string | null => {
    if (match.pool_id && poolToCategoryMap.has(match.pool_id)) {
      return poolToCategoryMap.get(match.pool_id)!;
    }
    if (match.bracket_id && bracketToCategoryMap.has(match.bracket_id)) {
      return bracketToCategoryMap.get(match.bracket_id)!;
    }
    return null;
  };

  // Helper pour obtenir de manière cohérente l'objet joueur d'une inscription
  const getPlayerObj = (registration: any) => {
    if (!registration || !registration.players) return null;
    return Array.isArray(registration.players) ? registration.players[0] : registration.players;
  };

  // Helper pour obtenir de manière cohérente l'objet joueur d'un match (gérant les tableaux de jointures factices)
  const getSinglePlayer = (p: any) => {
    if (!p) return null;
    return Array.isArray(p) ? p[0] : p;
  };

  // 7. Compiler chaque tableau (catégorie) séparément
  const tableaux = categories.map((category: any) => {
    const categoryRegistrations = allRegistrations.filter(r => r.table_category_id === category.id);
    const categoryMatches = allMatches.filter(m => getMatchCategoryId(m) === category.id);

    const nb_joueurs_inscrits = categoryRegistrations.length;
    const nb_joueurs_presents = categoryRegistrations.filter(r => r.checked_in).length;
    const nb_matchs = categoryMatches.length;

    // Recette du tableau : prix x nombre de joueurs inscrits ayant paid = true
    const nb_payes = categoryRegistrations.filter(r => r.paid).length;
    const recette = (category.price || 0) * nb_payes;

    // Détermination du podium à partir des matchs de la phase finale
    const finalMatch = categoryMatches.find(m => m.round === 'final' && m.status === 'finished');
    const thirdPlaceMatch = categoryMatches.find(m => m.round === '3rd_place' && m.status === 'finished');

    let first: any = null;
    let second: any = null;
    let third: any = null;

    if (finalMatch && finalMatch.winner_id) {
      const p1 = getSinglePlayer(finalMatch.player1);
      const p2 = getSinglePlayer(finalMatch.player2);
      first = finalMatch.winner_id === finalMatch.player1_id ? p1 : p2;
      second = finalMatch.winner_id === finalMatch.player1_id ? p2 : p1;
    }

    if (thirdPlaceMatch && thirdPlaceMatch.winner_id) {
      const p1 = getSinglePlayer(thirdPlaceMatch.player1);
      const p2 = getSinglePlayer(thirdPlaceMatch.player2);
      third = thirdPlaceMatch.winner_id === thirdPlaceMatch.player1_id ? p1 : p2;
    }

    const cleanPlayerForPodium = (p: any) => {
      if (!p) return null;
      return {
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        club: p.club || null,
        points: p.points || null
      };
    };

    const podium = (first || second || third) ? {
      premier: cleanPlayerForPodium(first),
      deuxieme: cleanPlayerForPodium(second),
      troisieme: cleanPlayerForPodium(third)
    } : null;

    // Détermination sécurisée du top 4 du bracket
    const orderedTop4: any[] = [];
    if (first) orderedTop4.push(first);
    if (second) orderedTop4.push(second);
    if (third) {
      orderedTop4.push(third);
      // Le perdant du match de 3ème place finit 4ème
      if (thirdPlaceMatch) {
        const p1 = getSinglePlayer(thirdPlaceMatch.player1);
        const p2 = getSinglePlayer(thirdPlaceMatch.player2);
        const fourth = thirdPlaceMatch.winner_id === thirdPlaceMatch.player1_id ? p2 : p1;
        if (fourth) orderedTop4.push(fourth);
      }
    } else {
      // Pas de match de 3ème place, on essaie de récupérer les deux perdants des demi-finales
      const semiMatches = categoryMatches.filter(m => m.round === 'semifinal' && m.status === 'finished');
      const semiLosers = semiMatches.map(m => {
        const p1 = getSinglePlayer(m.player1);
        const p2 = getSinglePlayer(m.player2);
        return m.winner_id === m.player1_id ? p2 : p1;
      }).filter(Boolean);

      semiLosers.forEach(loser => {
        if (loser && loser.id !== first?.id && loser.id !== second?.id) {
          orderedTop4.push(loser);
        }
      });
    }

    // Fallback de précaution : si aucun match n'est encore joué, on list les participants de demis/finales
    if (orderedTop4.length === 0) {
      const fallbackSemi = categoryMatches.filter(m => m.round === 'semifinal');
      const fallbackSet = new Map<string, any>();
      fallbackSemi.forEach(m => {
        const p1 = getSinglePlayer(m.player1);
        const p2 = getSinglePlayer(m.player2);
        if (p1) fallbackSet.set(p1.id, p1);
        if (p2) fallbackSet.set(p2.id, p2);
      });
      const fallbackFinal = categoryMatches.find(m => m.round === 'final');
      if (fallbackFinal) {
        const p1 = getSinglePlayer(fallbackFinal.player1);
        const p2 = getSinglePlayer(fallbackFinal.player2);
        if (p1) fallbackSet.set(p1.id, p1);
        if (p2) fallbackSet.set(p2.id, p2);
      }
      fallbackSet.forEach(p => orderedTop4.push(p));
    }

    const top4 = orderedTop4.length > 0 ? orderedTop4.slice(0, 4).map(p => ({
      id: p.id,
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      club: p.club || null,
      points: p.points || null,
      serie: category.name || '',
      checked_in: true,
      registered_at: new Date().toISOString()
    })) : null;

    return {
      id: category.id,
      nom: category.name,
      jour: category.day_number || 1,
      color_code: category.color_code || '#4f46e5',
      min_points: category.min_points || 500,
      max_points: category.max_points || 3000,
      prix: category.price || 0,
      nb_joueurs_inscrits,
      nb_joueurs_presents,
      nb_matchs,
      recette,
      podium,
      top4
    };
  });

  // 8. Calculer les statistiques globales au niveau de la racine
  const nb_joueurs_total = allRegistrations.length;
  const nb_joueurs_presents = allRegistrations.filter(r => r.checked_in).length;
  const nb_matchs_total = allMatches.length;
  const recette_totale = tableaux.reduce((sum, tab) => sum + tab.recette, 0);
  const nb_tableaux = categories.length;

  // Extraction propre des clubs de façon unique
  const uniqueClubsSet = new Set<string>();
  allRegistrations.forEach(r => {
    const p = getPlayerObj(r);
    if (p && p.club && p.club.trim() !== '') {
      uniqueClubsSet.add(p.club.trim());
    }
  });
  const clubs = Array.from(uniqueClubsSet);

  const archivePayload = {
    tournament_id: tournament.id,
    organizer_id: tournament.organizer_id,
    name: tournament.name,
    date: tournament.date,
    date_debut: tournament.date,
    date_fin: tournament.end_date || null,
    location: tournament.location,
    nb_tables: tournament.nb_tables,
    nb_joueurs_total: nb_joueurs_total,
    nb_joueurs_presents: nb_joueurs_presents,
    nb_matchs_total: nb_matchs_total,
    recette_totale: recette_totale,
    nb_tableaux: nb_tableaux,
    clubs: clubs,
    tableaux: tableaux
  };

  // 9. Insérer dans tournament_archives avec fallback anonymisé
  let { error: archiveError } = await supabase
    .from('tournament_archives')
    .insert(archivePayload);

  if (archiveError) {
    console.warn("Erreur d'archivage avec l'organisateur d'origine (compte possiblement supprimé), nouvel essai anonymisé...", archiveError);
    const retryRes = await supabase
      .from('tournament_archives')
      .insert({
        ...archivePayload,
        organizer_id: null
      });
    archiveError = retryRes.error;
  }

  if (archiveError) {
    throw archiveError;
  }

  // 10. Nettoyer les autres tables de toutes les données liées à ce tournoi
  try {
    // A. Supprimer les player_tokens d'abord
    await supabase.from('player_tokens').delete().eq('tournament_id', tournamentId);

    // B. Inscriptions (registrations)
    await supabase.from('registrations').delete().eq('tournament_id', tournamentId);

    // C. Matchs (matches) - Supprime automatiquement les sets par CASCADE
    await supabase.from('matches').delete().eq('tournament_id', tournamentId);

    // D. Supprimer les brackets liés
    await supabase.from('brackets').delete().eq('tournament_id', tournamentId);

    // E. Poules (pools) - Supprime automatiquement les pool_players par CASCADE
    await supabase.from('pools').delete().eq('tournament_id', tournamentId);

    // F. Joueurs (players)
    await supabase.from('players').delete().eq('tournament_id', tournamentId);

    // G. Catégories de tableaux (table_categories)
    await supabase.from('table_categories').delete().eq('tournament_id', tournamentId);

    // H. Tables physiques (tournament_tables)
    await supabase.from('tournament_tables').delete().eq('tournament_id', tournamentId);
  } catch (cleanError) {
    console.warn("Avertissement lors de la purge d'un ou plusieurs éléments liés au tournoi :", cleanError);
  }

  // 11. Marquer le tournoi d'origine comme archivé
  const { error: updateError } = await supabase
    .from('tournaments')
    .update({ status: 'archived' })
    .eq('id', tournamentId);

  if (updateError) {
    throw updateError;
  }
}
