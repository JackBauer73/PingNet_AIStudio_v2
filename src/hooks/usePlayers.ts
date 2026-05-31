import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Player } from '../types';
import toast from 'react-hot-toast';

export function usePlayers(tournamentId?: string) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlayers = async () => {
    if (!tournamentId) {
      setPlayers([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      let query = supabase
        .from('registrations')
        .select(`
          id,
          tournament_id,
          dossard,
          checked_in,
          paid,
          status,
          phone_used,
          created_at,
          player_id,
          table_category_id,
          players (
            id,
            first_name,
            last_name,
            phone,
            email,
            club,
            licence_number,
            points,
            registered_at
          ),
          table_categories (
            id,
            name,
            day_number
          )
        `)
        .order('created_at', { ascending: false });

      if (tournamentId) {
        query = query.eq('tournament_id', tournamentId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Récupérer les tokens correspondants pour ce tournoi
      const { data: tokenData, error: tokenError } = await supabase
        .from('player_tokens')
        .select('player_id, token')
        .eq('tournament_id', tournamentId);
      
      const tokensByPlayerId = new Map<string, string>();
      if (!tokenError && tokenData) {
        tokenData.forEach(t => {
          tokensByPlayerId.set(t.player_id, t.token);
        });
      }

      // 1. Pour assurer la cohérence si l'unicité du dossard est portée sur une seule inscription
      // on résout globalement le dossard par joueur physique dans le tournoi.
      const dossardByPlayerId = new Map<string, number>();
      (data || []).forEach(r => {
        if (r.player_id && r.dossard !== null && r.dossard !== undefined) {
          dossardByPlayerId.set(r.player_id, r.dossard);
        }
      });

      const mapped: Player[] = (data || []).map((r: any) => {
        const pObj = Array.isArray(r.players) ? r.players[0] : r.players;
        const cObj = Array.isArray(r.table_categories) ? r.table_categories[0] : r.table_categories;
        const resolvedDossard = r.dossard || (r.player_id ? dossardByPlayerId.get(r.player_id) : null) || null;
        return {
          id: r.id, // ID local de l’inscription
          player_id: r.player_id,
          table_category_id: r.table_category_id,
          tournament_id: r.tournament_id,
          first_name: pObj?.first_name || '',
          last_name: pObj?.last_name || '',
          phone: r.phone_used || pObj?.phone || null,
          email: pObj?.email || null,
          token: r.player_id ? tokensByPlayerId.get(r.player_id) || null : null,
          club: pObj?.club || null,
          serie: cObj?.name || '',
          checked_in: r.checked_in || false,
          licence_number: pObj?.licence_number || null,
          points: pObj?.points || null,
          dossard: resolvedDossard,
          paid: r.paid || false,
          registered_at: r.created_at || new Date().toISOString()
        };
      });

      setPlayers(mapped);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des joueurs');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const addPlayer = async (playerForm: Omit<Player, 'id' | 'registered_at'>) => {
    try {
      // 1. Trouver l'ID de la catégorie à partir de son nom
      const { data: catData, error: catError } = await supabase
        .from('table_categories')
        .select('id')
        .eq('tournament_id', playerForm.tournament_id)
        .ilike('name', playerForm.serie.trim())
        .maybeSingle();

      if (catError || !catData) {
        toast.error(`Catégorie de tableau non trouvée : ${playerForm.serie}`);
        return null;
      }
      const categoryId = catData.id;

      // 2. Trouver ou créer le joueur physique dans 'players'
      let playerId = '';
      const generatedToken = crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
      let pQuery = supabase.from('players').select('id, email');
      if (playerForm.licence_number && playerForm.licence_number.trim() !== '') {
        pQuery = pQuery.eq('licence_number', playerForm.licence_number.trim());
      } else {
        pQuery = pQuery
          .ilike('first_name', playerForm.first_name.trim())
          .ilike('last_name', playerForm.last_name.trim());
      }

      const { data: existingPlayers } = await pQuery;
      let playerEmail = playerForm.email || null;

      if (existingPlayers && existingPlayers.length > 0) {
        playerId = existingPlayers[0].id;
        playerEmail = playerForm.email || existingPlayers[0].email || null;
        
        // Mettre à jour ses points/club/téléphone/email s'ils ont changé ou sont manquants
        await supabase
          .from('players')
          .update({
            club: playerForm.club?.trim() || null,
            phone: playerForm.phone || null,
            email: playerEmail,
            points: playerForm.points,
          })
          .eq('id', playerId);
      } else {
        // Insérer un nouveau joueur unique
        const { data: newP, error: insertPErr } = await supabase
          .from('players')
          .insert({
            first_name: playerForm.first_name.trim(),
            last_name: playerForm.last_name.trim(),
            club: playerForm.club?.trim() || null,
            phone: playerForm.phone || null,
            email: playerEmail,
            licence_number: playerForm.licence_number?.trim() || null,
            points: playerForm.points
          })
          .select()
          .single();

        if (insertPErr) throw insertPErr;
        playerId = newP.id;
      }

      // Vérifier ou insérer dans player_tokens
      const { data: existingTokenRow } = await supabase
        .from('player_tokens')
        .select('token')
        .eq('player_id', playerId)
        .eq('tournament_id', playerForm.tournament_id)
        .maybeSingle();

      let playerToken = '';
      if (existingTokenRow) {
        playerToken = existingTokenRow.token;
      } else {
        // Générer et insérer un nouveau token
        playerToken = playerForm.token || generatedToken;
        await supabase
          .from('player_tokens')
          .insert({
            player_id: playerId,
            tournament_id: playerForm.tournament_id,
            token: playerToken
          });
      }

      // 3. Vérifier si l'inscription existe déjà à cette catégorie
      const { data: existingReg } = await supabase
        .from('registrations')
        .select('id')
        .eq('player_id', playerId)
        .eq('table_category_id', categoryId)
        .maybeSingle();

      if (existingReg) {
        toast.error(`⚠️ ${playerForm.first_name} ${playerForm.last_name} est déjà inscrit(e) dans le tableau ${playerForm.serie} !`);
        return null;
      }

      // 4. Insérer l'inscription dans registrations
      const { data: reg, error: regErr } = await supabase
        .from('registrations')
        .insert({
          tournament_id: playerForm.tournament_id,
          player_id: playerId,
          table_category_id: categoryId,
          status: 'pending',
          phone_used: playerForm.phone || null,
          checked_in: false,
          paid: false,
          dossard: null
        })
        .select(`
          id,
          tournament_id,
          dossard,
          checked_in,
          paid,
          status,
          phone_used,
          created_at,
          player_id,
          table_category_id,
          players (*),
          table_categories (*)
        `)
        .single();

      if (regErr) throw regErr;

      const regPObj = Array.isArray(reg.players) ? reg.players[0] : reg.players;
      const regCObj = Array.isArray(reg.table_categories) ? reg.table_categories[0] : reg.table_categories;

      const mappedNewPlayer: Player = {
        id: reg.id,
        player_id: reg.player_id,
        table_category_id: reg.table_category_id,
        tournament_id: reg.tournament_id,
        first_name: regPObj?.first_name || '',
        last_name: regPObj?.last_name || '',
        phone: reg.phone_used || regPObj?.phone || null,
        email: regPObj?.email || playerEmail || null,
        token: playerToken || null,
        club: regPObj?.club || null,
        serie: regCObj?.name || '',
        checked_in: reg.checked_in || false,
        licence_number: regPObj?.licence_number || null,
        points: regPObj?.points || null,
        dossard: reg.dossard || null,
        paid: reg.paid || false,
        registered_at: reg.created_at || new Date().toISOString()
      };

      setPlayers(prev => [mappedNewPlayer, ...prev]);
      toast.success('Inscription ajoutée avec succès');
      return mappedNewPlayer;
    } catch (error: any) {
      toast.error('Erreur lors de l’inscription du joueur');
      console.error(error);
      return null;
    }
  };

  const deletePlayer = async (id: string) => {
    try {
      const reg = players.find(p => p.id === id);
      if (reg) {
        // Récupérer toutes les inscriptions pour ce joueur physique sur ce tournoi
        const { data: siblingRegs, error: siblingErr } = await supabase
          .from('registrations')
          .select('id')
          .eq('player_id', reg.player_id)
          .eq('tournament_id', reg.tournament_id);

        if (!siblingErr && siblingRegs) {
          const otherRegsCount = siblingRegs.filter(s => s.id !== id).length;
          if (otherRegsCount === 0) {
            // C'est le dernier tableau du tournoi (peu importe le jour) : on nettoie tout
            // 1. Supprimer l'inscription
            const { error: regDelError } = await supabase
              .from('registrations')
              .delete()
              .eq('id', id);

            if (regDelError) throw regDelError;

            // 2. Supprimer le token d'accueil du joueur
            await supabase
              .from('player_tokens')
              .delete()
              .eq('player_id', reg.player_id)
              .eq('tournament_id', reg.tournament_id);

            // 3. Supprimer le joueur physique
            await supabase
              .from('players')
              .delete()
              .eq('id', reg.player_id);

            setPlayers(prev => prev.filter(p => p.id !== id));
            toast.success('Dernière inscription supprimée : joueur retiré du tournoi ✓');
            return;
          }
        }
      }

      // Deletion standard si d'autres inscriptions existent toujours
      const { error } = await supabase
        .from('registrations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setPlayers(prev => prev.filter(p => p.id !== id));
      toast.success('Inscription supprimée');
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    }
  };

  const toggleCheckin = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('registrations')
        .update({
          checked_in: !currentStatus,
          status: !currentStatus ? 'validated' : 'pending'
        })
        .eq('id', id);

      if (error) throw error;
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, checked_in: !currentStatus } : p));
      toast.success(!currentStatus ? 'Joueur pointé présent (✓)' : 'Joueur pointé absent (✗)');
    } catch (error: any) {
      toast.error('Erreur lors du pointage');
      console.error(error);
    }
  };

  const updatePlayerSerie = async (id: string, newSerie: string, firstName: string, lastName: string) => {
    try {
      // Trouver l'ID de la nouvelle catégorie
      const { data: catData, error: catError } = await supabase
        .from('table_categories')
        .select('id')
        .eq('tournament_id', tournamentId)
        .ilike('name', newSerie.trim())
        .maybeSingle();

      if (catError || !catData) {
        toast.error(`Catégorie introuvable : ${newSerie}`);
        return false;
      }
      const newCategoryId = catData.id;

      // Récupérer le player ID pour cette inscription
      const { data: currentReg } = await supabase
        .from('registrations')
        .select('player_id')
        .eq('id', id)
        .single();

      if (!currentReg) throw new Error('Inscription introuvable');
      const pId = currentReg.player_id;

      // Vérifier si le joueur est déjà inscrit à cette nouvelle catégorie
      const { data: existing } = await supabase
        .from('registrations')
        .select('id')
        .eq('player_id', pId)
        .eq('table_category_id', newCategoryId)
        .neq('id', id);

      if (existing && existing.length > 0) {
        toast.error(`⚠️ ${firstName} ${lastName} est déjà inscrit(e) dans le tableau ${newSerie} !`);
        return false;
      }

      // Mettre à jour l'inscription
      const { error } = await supabase
        .from('registrations')
        .update({ table_category_id: newCategoryId })
        .eq('id', id);

      if (error) throw error;
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, serie: newSerie, table_category_id: newCategoryId } : p));
      toast.success('Tableau mis à jour avec succès !');
      return true;
    } catch (error: any) {
      toast.error('Erreur lors du changement de tableau');
      console.error(error);
      return false;
    }
  };

  const updatePlayerDetails = async (id: string, updates: Partial<Player>) => {
    try {
      // Trouver le player_id lié à cette inscription
      const regObj = players.find(p => p.id === id);
      if (!regObj || !regObj.player_id) throw new Error('Joueur introuvable');

      const mappedUpdates: any = {};
      if (updates.first_name) mappedUpdates.first_name = updates.first_name;
      if (updates.last_name) mappedUpdates.last_name = updates.last_name;
      if (updates.phone) mappedUpdates.phone = updates.phone;
      if (updates.club) mappedUpdates.club = updates.club;
      if (updates.licence_number !== undefined) mappedUpdates.licence_number = updates.licence_number;
      if (updates.points !== undefined) mappedUpdates.points = updates.points;

      // Mettre à jour dans la table players
      const { error } = await supabase
        .from('players')
        .update(mappedUpdates)
        .eq('id', regObj.player_id);

      if (error) throw error;

      // Mettre à jour le téléphone s'il a changé
      if (updates.phone) {
        await supabase
          .from('registrations')
          .update({ phone_used: updates.phone })
          .eq('id', id);
      }

      setPlayers(prev => prev.map(p => {
        if (p.player_id === regObj.player_id) {
          return { ...p, ...updates };
        }
        return p;
      }));
      toast.success('Joueur mis à jour avec succès');
      return true;
    } catch (error: any) {
      toast.error('Erreur lors de la mise à jour du joueur');
      console.error(error);
      return false;
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, [tournamentId]);

  return {
    players,
    loading,
    addPlayer,
    deletePlayer,
    toggleCheckin,
    updatePlayerSerie,
    updatePlayerDetails,
    refresh: fetchPlayers
  };
}
