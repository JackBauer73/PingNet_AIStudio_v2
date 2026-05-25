import { supabase } from '../supabase';
import { getNextBracketPosition } from '../lib/bracketPositions';

/**
 * Appelé après chaque match de bracket terminé.
 * Place le vainqueur/perdant dans la case suivante grâce à sa bracket_position fixe.
 */
export async function handleBracketProgression(matchId: string, winnerId: string) {
  // 1. Récupérer le match actuel
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (matchError || !match || !match.bracket_id) return;

  const currentPos = match.bracket_position;
  if (currentPos === undefined || currentPos === null) return;

  const tournamentId = match.tournament_id;

  // 2. Déterminer et enregistrer le perdant (pour la 3e place)
  const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;

  await supabase
    .from('matches')
    .update({
      winner_id: winnerId,
      status: 'finished',
      finished_at: new Date().toISOString()
    })
    .eq('id', matchId);

  // Si c'est la finale, il n'y a plus de match de vainqueur suivant
  if (match.bracket_round === 'final') return;

  // 3. Charger les caractéristiques du bracket pour trouver le ted_size
  const { data: bracket } = await supabase
    .from('brackets')
    .select('ted_size')
    .eq('id', match.bracket_id)
    .single();

  if (!bracket) return;

  // 4. Calculer la position suivante
  const nextPos = getNextBracketPosition(currentPos, bracket.ted_size);
  if (nextPos === null) return;

  // 5. Mettre à jour le match suivant
  // Si la position actuelle est paire, le joueur va dans player1_id. Si impaire, dans player2_id.
  const isSlot1 = currentPos % 2 === 0;
  const field = isSlot1 ? 'player1_id' : 'player2_id';

  await supabase
    .from('matches')
    .update({ [field]: winnerId })
    .eq('bracket_id', match.bracket_id)
    .eq('bracket_position', nextPos);

  // 6. Gérer la petite finale (3e place) si on vient d'une demi-finale
  if (match.bracket_round === 'semifinal' && loserId) {
    await supabase
      .from('matches')
      .update({ [field]: loserId })
      .eq('bracket_id', match.bracket_id)
      .eq('bracket_round', '3rd');
  }
}
