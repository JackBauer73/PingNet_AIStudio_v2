import { supabase } from '../supabase';

interface AssignDossardParams {
  registrationId: string; // ID de l'inscription (registrations.id)
  tournamentId: string;   // ID du tournoi
  userId?: string;        // ID utilisateur/licence (obsolète mais gardé pour compatibilité de signature)
  onlyThisRegistration?: boolean; // Pointage individuel ou groupe
  dayNumber?: number; // Journée spécifique pour filtrer le groupe de pointage !
}

export async function assignDossard({ registrationId, tournamentId, onlyThisRegistration = true, dayNumber }: AssignDossardParams) {
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
      .select('id, dossard, checked_in, table_categories(day_number)')
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

    // 4. Déterminer les inscriptions de la journée/globale qui doivent être pointées par cet appel
    let regsToUpdateIds: string[] = [];

    if (onlyThisRegistration) {
      regsToUpdateIds = [registrationId];
    } else if (dayNumber) {
      const regsToUpdate = (matchedRegs as any[]).filter(r => {
        const catObj = r.table_categories ? (Array.isArray(r.table_categories) ? r.table_categories[0] : r.table_categories) : null;
        const dNum = catObj?.day_number || 1;
        return dNum === dayNumber;
      });
      regsToUpdateIds = regsToUpdate.map(r => r.id);
    } else {
      regsToUpdateIds = matchedRegs.map(r => r.id);
    }

    // Le joueur physique possède le même numéro de dossard sur toutes ses inscriptions pointées
    const alreadyCheckedInIds = matchedRegs.filter(r => r.checked_in).map(r => r.id);
    const finalCheckedInIds = Array.from(new Set([...alreadyCheckedInIds, ...regsToUpdateIds]));

    // 5. Mettre à jour l'ensemble des inscriptions validées avec le numéro de dossard
    if (finalCheckedInIds.length > 0) {
      const { error: updateCheckedError } = await supabase
        .from('registrations')
        .update({
          checked_in: true,
          paid: true,
          status: 'validated',
          dossard: dossard
        })
        .in('id', finalCheckedInIds);

      if (updateCheckedError) {
        throw updateCheckedError;
      }
    }

    // 6. Pour les inscriptions non pointées restantes, on s'assure que le dossard est NULL
    const finalUncheckedIds = matchedRegs.map(r => r.id).filter(id => !finalCheckedInIds.includes(id));
    if (finalUncheckedIds.length > 0) {
      const { error: updateUncheckedError } = await supabase
        .from('registrations')
        .update({
          dossard: null
        })
        .in('id', finalUncheckedIds);

      if (updateUncheckedError) {
        throw updateUncheckedError;
      }
    }

    return { dossard, dejaPointe };
  } catch (error: any) {
    console.error('Erreur dans assignDossard:', error);
    throw error;
  }
}
