import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Player } from '../types';
import toast from 'react-hot-toast';

export function usePlayers(tournamentId?: string) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('players')
        .select('*')
        .order('registered_at', { ascending: false });

      if (tournamentId) {
        query = query.eq('tournament_id', tournamentId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPlayers(data || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des joueurs');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const addPlayer = async (player: Omit<Player, 'id' | 'registered_at'>) => {
    try {
      // Vérifier doublon nom + prénom dans la même série (tableau)
      const { data: existing } = await supabase
        .from('players')
        .select('id')
        .eq('tournament_id', player.tournament_id)
        .ilike('last_name', player.last_name)
        .ilike('first_name', player.first_name)
        .eq('serie', player.serie);

      if (existing && existing.length > 0) {
        toast.error(`⚠️ ${player.first_name} ${player.last_name} est déjà inscrit(e) dans le tableau ${player.serie} !`);
        return null;
      }

      const { data, error } = await supabase
        .from('players')
        .insert([player])
        .select();

      if (error) throw error;
      setPlayers(prev => [data[0], ...prev]);
      toast.success('Joueur ajouté avec succès');
      return data[0];
    } catch (error: any) {
      toast.error('Erreur lors de l’ajout du joueur');
      console.error(error);
      return null;
    }
  };

  const deletePlayer = async (id: string) => {
    try {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setPlayers(prev => prev.filter(p => p.id !== id));
      toast.success('Joueur supprimé');
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    }
  };

  const toggleCheckin = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('players')
        .update({ checked_in: !currentStatus })
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
      const { data: existing } = await supabase
        .from('players')
        .select('id')
        .eq('tournament_id', tournamentId)
        .ilike('last_name', lastName)
        .ilike('first_name', firstName)
        .eq('serie', newSerie)
        .neq('id', id);

      if (existing && existing.length > 0) {
        toast.error(`⚠️ ${firstName} ${lastName} est déjà inscrit(e) dans le tableau ${newSerie} !`);
        return false;
      }

      const { error } = await supabase
        .from('players')
        .update({ serie: newSerie })
        .eq('id', id);

      if (error) throw error;
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, serie: newSerie } : p));
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
      const { error } = await supabase
        .from('players')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
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
