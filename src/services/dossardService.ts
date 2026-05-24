import { supabase } from '../supabase';

interface AssignDossardParams {
  registrationId: string; // ID de l'inscription (id dans la table players)
  tournamentId: string;   // ID du tournoi
  userId?: string;        // ID de l'utilisateur (optionnel, peut correspondre au numéro de licence ou être dérivé)
  onlyThisRegistration?: boolean; // Pour pointer uniquement ce tableau/ligne spécifique
}

export async function assignDossard({ registrationId, tournamentId, userId, onlyThisRegistration = true }: AssignDossardParams) {
  try {
    // 1. Récupérer l'inscription originale (le joueur) pour identifier les infos du joueur physique
    const { data: currentPlayer, error: fetchError } = await supabase
      .from('players')
      .select('first_name, last_name, licence_number, phone, dossard')
      .eq('id', registrationId)
      .single();

    if (fetchError || !currentPlayer) {
      console.error('Erreur lors de la récupération du joueur:', fetchError);
      throw new Error('Joueur non trouvé');
    }

    const firstName = currentPlayer.first_name || '';
    const lastName = currentPlayer.last_name || '';
    const licence = currentPlayer.licence_number;

    // Déterminer la condition de correspondance pour toutes les inscriptions du joueur physique
    let matchingQuery = supabase
      .from('players')
      .select('id, dossard, checked_in')
      .eq('tournament_id', tournamentId);

    if (licence && licence.trim() !== '') {
      matchingQuery = matchingQuery.eq('licence_number', licence);
    } else {
      matchingQuery = matchingQuery
        .ilike('first_name', firstName.trim())
        .ilike('last_name', lastName.trim());
    }

    const { data: matchedPlayers, error: matchError } = await matchingQuery;
    if (matchError || !matchedPlayers) {
      throw new Error('Erreur lors de la recherche des inscriptions du joueur');
    }

    // 2. Vérifier si le joueur a déjà un dossard attribué dans ce tournoi
    const existingDossardPlayer = matchedPlayers.find(p => p.dossard !== null && p.dossard !== undefined);
    let dossard: number;
    let dejaPointe = false;

    if (existingDossardPlayer) {
      dossard = existingDossardPlayer.dossard!;
      // On considère qu'il était déjà pointé pour un autre tableau si une autre inscription l'était
      dejaPointe = matchedPlayers.some(p => p.checked_in);
    } else {
      // Pas encore de dossard : trouver le MAX(dossard) du tournoi et faire + 1
      const { data: maxDossardData, error: maxError } = await supabase
        .from('players')
        .select('dossard')
        .eq('tournament_id', tournamentId)
        .not('dossard', 'is', null)
        .order('dossard', { ascending: false })
        .limit(1);

      if (maxError) {
        console.error('Erreur lors du calcul du dossard max:', maxError);
      }

      const maxDossard = (maxDossardData && maxDossardData.length > 0) ? (maxDossardData[0].dossard || 0) : 0;
      dossard = maxDossard + 1;
      dejaPointe = false;
    }

    // 3. Mettre à jour les inscriptions : une seule portera le dossard physique pour respecter l'index unique s'il est présent en BD
    const idsToUpdate = matchedPlayers.map(p => p.id);
    const primaryId = idsToUpdate[0];
    const secondaryIds = idsToUpdate.slice(1);
    
    const { error: updateDossardError } = await supabase
      .from('players')
      .update({ dossard: dossard })
      .eq('id', primaryId);

    if (updateDossardError) {
      throw updateDossardError;
    }

    if (secondaryIds.length > 0) {
      // Pour les autres lignes du même joueur, on s'assure de mettre le dossard à null pour respecter l'index unique
      const { error: updateSecondaryError } = await supabase
        .from('players')
        .update({ dossard: null })
        .in('id', secondaryIds);
      
      if (updateSecondaryError) {
        console.warn('Erreur lors du nettoyage du dossard sur les inscriptions secondaires:', updateSecondaryError);
      }
    }

    // 4. Mettre à jour checked_in et paid au cas par cas
    if (onlyThisRegistration) {
      // On ne pointe/paye QUE ce tableau (cette inscription) spécifique sur lequel l'organisateur a cliqué
      const { error: updateRegError } = await supabase
        .from('players')
        .update({
          checked_in: true,
          paid: true
        })
        .eq('id', registrationId);

      if (updateRegError) {
        throw updateRegError;
      }
    } else {
      // Comportement de masse : On pointe TOUTES ses inscriptions de ce tournoi
      const { error: updateAllError } = await supabase
        .from('players')
        .update({
          checked_in: true,
          paid: true
        })
        .in('id', idsToUpdate);

      if (updateAllError) {
        throw updateAllError;
      }
    }

    // Mise à jour de sécurité optionnelle sur la table registrations si jamais exécutée
    try {
      const uId = userId || licence || `${firstName}_${lastName}`;
      
      // Vérifier si la table registrations existe pour compatibilité
      const { data: existingRegs } = await supabase
        .from('registrations')
        .select('id, dossard')
        .eq('tournament_id', tournamentId)
        .eq('user_id', uId);

      if (existingRegs) {
        let regDossard = dossard;
        const foundReg = existingRegs.find(r => r.dossard !== null);
        if (foundReg) {
          regDossard = foundReg.dossard!;
        }

        await supabase
          .from('registrations')
          .upsert({
            tournament_id: tournamentId,
            user_id: uId,
            dossard: regDossard,
            checked_in: true,
            paid: true
          }, { onConflict: 'tournament_id, user_id' });
      }
    } catch (e) {
      // Ignorer si la table registrations facultative n'existe pas en DB
    }

    return { dossard, dejaPointe };
  } catch (error: any) {
    console.error('Erreur dans assignDossard:', error);
    throw error;
  }
}
