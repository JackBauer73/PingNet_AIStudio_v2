import { supabase } from '../supabase';

export async function archiveTournament(tournamentId: string): Promise<void> {
  // 1. Charger les données du tournoi
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id, name, date, location, nb_tables, organizer_id')
    .eq('id', tournamentId)
    .single();

  if (tournamentError || !tournament) {
    throw new Error('Tournoi introuvable ou erreur de lecture.');
  }

  // 2. Compter le nombre de joueurs inscrits
  const { count: nb_joueurs } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId);

  // 3. Compter le nombre total de matchs joués
  const { count: nb_matchs } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId);

  // 4. Charger la finale et déterminer le podium
  const { data: finalMatch } = await supabase
    .from('matches')
    .select(`
      winner_id,
      player1_id,
      player2_id,
      player1:players!player1_id(first_name, last_name, club, serie),
      player2:players!player2_id(first_name, last_name, club, serie)
    `)
    .eq('tournament_id', tournamentId)
    .eq('round', 'final')
    .eq('status', 'finished')
    .maybeSingle() as any;

  // 5. Charger les demi-finales
  const { data: semiMatches } = await supabase
    .from('matches')
    .select(`
      winner_id,
      player1_id,
      player2_id,
      player1:players!player1_id(first_name, last_name, club, serie),
      player2:players!player2_id(first_name, last_name, club, serie)
    `)
    .eq('tournament_id', tournamentId)
    .eq('round', 'semifinal')
    .eq('status', 'finished') as any;

  const podium = buildPodium(finalMatch, semiMatches || []);

  const tableaux = [
    {
      nom: "Tableau Unique",
      date: tournament.date,
      nb_joueurs: nb_joueurs || 0,
      nb_matchs: nb_matchs || 0,
      podium: podium
    }
  ];

  // 6. Insérer dans tournament_archives
  let { error: archiveError } = await supabase
    .from('tournament_archives')
    .insert({
      tournament_id: tournament.id,
      organizer_id: tournament.organizer_id,
      name: tournament.name,
      date: tournament.date,
      location: tournament.location,
      nb_tables: tournament.nb_tables,
      nb_joueurs_total: nb_joueurs || 0,
      nb_matchs_total: nb_matchs || 0,
      tableaux: tableaux
    });

  if (archiveError) {
    console.warn("Erreur d'archivage avec l'organisateur d'origine (compte possiblement supprimé), nouvel essai anonymisé...", archiveError);
    const retryRes = await supabase
      .from('tournament_archives')
      .insert({
        tournament_id: tournament.id,
        organizer_id: null,
        name: tournament.name,
        date: tournament.date,
        location: tournament.location,
        nb_tables: tournament.nb_tables,
        nb_joueurs_total: nb_joueurs || 0,
        nb_matchs_total: nb_matchs || 0,
        tableaux: tableaux
      });
    archiveError = retryRes.error;
  }

  if (archiveError) {
    throw archiveError;
  }

  // 7. Marquer le tournoi d'origine comme archivé
  const { error: updateError } = await supabase
    .from('tournaments')
    .update({ status: 'archived' })
    .eq('id', tournamentId);

  if (updateError) {
    throw updateError;
  }
}

function buildPodium(finalMatch: any, semiMatches: any[]) {
  if (!finalMatch) return null;

  const p1 = finalMatch.player1;
  const p2 = finalMatch.player2;
  const winnerId = finalMatch.winner_id;

  if (!p1 || !p2) return null;

  const premier = winnerId === finalMatch.player1_id ? p1 : p2;
  const deuxieme = winnerId === finalMatch.player1_id ? p2 : p1;

  const troisieme = semiMatches.map(m => {
    const loser = m.winner_id === m.player1_id ? m.player2 : m.player1;
    return loser;
  }).filter(Boolean);

  return {
    premier,
    deuxieme,
    troisieme
  };
}
