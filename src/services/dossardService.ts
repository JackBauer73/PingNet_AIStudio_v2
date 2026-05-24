import { supabase } from '../supabase';

interface AssignDossardParams {
  registrationId: string; // ID de l'inscription (registrations.id)
  tournamentId: string;   // ID du tournoi
  userId?: string;        // ID utilisateur/licence (obsolète mais gardé pour compatibilité de signature)
  onlyThisRegistration?: boolean; // Pointage individuel ou groupe
}

export async function assignDossard({ registrationId, tournamentId, onlyThisRegistration = true }: AssignDossardParams) {
  try {
    // 1. Récupérer l'inscription concernée pour identifier le joueur physique
    const { data: currentReg, error: fetchRegError } = await supabase
      .from('registrations')
      .select('id, player_id, table_category_id, dossard')
      .eq('id', registrationId)
      .single();

    if (fetchRegError || !currentReg) {
      console.error('Erreur lors de la récupération de l\'inscription:', fetchRegError);
      throw new Error('Inscription non trouvée');
    }

    const playerId = currentReg.player_id;

    // 2. Trouver toutes les inscriptions de ce même joueur physique dans le tournoi
    const { data: matchedRegs, error: matchError } = await supabase
      .from('registrations')
      .select('id, dossard, checked_in')
      .eq('tournament_id', tournamentId)
      .eq('player_id', playerId);

    if (matchError || !matchedRegs) {
      throw new Error('Erreur lors de la recherche des inscriptions du joueur');
    }

    // 3. Rechercher si un dossard a déjà été affecté pour une de ses inscriptions
    const existingDossardReg = matchedRegs.find(r => r.dossard !== null && r.dossard !== undefined);

    let dossard: number;
    let dejaPointe = false;

    if (existingDossardReg) {
      dossard = existingDossardReg.dossard!;
      dejaPointe = matchedRegs.some(r => r.checked_in);
    } else {
      // Pas encore de dossard : trouver le max(dossard) du tournoi dans registrations et faire + 1
      const { data: maxDossardData, error: maxError } = await supabase
        .from('registrations')
        .select('dossard')
        .eq('tournament_id', tournamentId)
        .not('dossard', 'is', null)
        .order('dossard', { ascending: false })
        .limit(1);

      if (maxError) {
        console.error('Erreur lors du calcul du dossard max sur registrations:', maxError);
      }

      const maxDossard = (maxDossardData && maxDossardData.length > 0) ? (maxDossardData[0].dossard || 0) : 0;
      dossard = maxDossard + 1;
      dejaPointe = false;
    }

    // 4. Assigner le dossard sur UNE SEULE ligne de registrations pour respecter la clé unique (idx_registrations_dossard_tournament)
    const targetRegIdToDossard = existingDossardReg ? existingDossardReg.id : registrationId;

    const { error: updateDossardError } = await supabase
      .from('registrations')
      .update({ dossard: dossard })
      .eq('id', targetRegIdToDossard);

    if (updateDossardError) {
      throw updateDossardError;
    }

    // Nettoyer les autres lignes si jamais elles disposaient de dossards restants
    const secondaryRegIdsToNull = matchedRegs.map(r => r.id).filter(id => id !== targetRegIdToDossard);
    if (secondaryRegIdsToNull.length > 0) {
      await supabase
        .from('registrations')
        .update({ dossard: null })
        .in('id', secondaryRegIdsToNull);
    }

    // 5. Mettre à jour `checked_in`, `paid` et `status`
    if (onlyThisRegistration) {
      // On ne pointe que le tableau concerné
      const { error: updateRegError } = await supabase
        .from('registrations')
        .update({
          checked_in: true,
          paid: true,
          status: 'validated'
        })
        .eq('id', registrationId);

      if (updateRegError) {
        throw updateRegError;
      }
    } else {
      // On pointe toutes ses inscriptions sur le tournoi
      const { error: updateAllError } = await supabase
        .from('registrations')
        .update({
          checked_in: true,
          paid: true,
          status: 'validated'
        })
        .in('id', matchedRegs.map(r => r.id));

      if (updateAllError) {
        throw updateAllError;
      }
    }

    return { dossard, dejaPointe };
  } catch (error: any) {
    console.error('Erreur dans assignDossard:', error);
    throw error;
  }
}
