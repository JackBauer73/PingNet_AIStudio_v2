import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Match } from '../types';
import toast from 'react-hot-toast';

export function useMatches(tournamentId?: string) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = async (silent = false) => {
    if (!tournamentId) return;
    try {
      if (!silent) setLoading(true);
      const { data, error } = await supabase
        .from('matches')
        .select('*, player1:player1_id(*), player2:player2_id(*), sets(*)')
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const sortedMatches = (data || []).map((m: any) => ({
        ...m,
        sets: (m.sets || []).sort((a: any, b: any) => (a.set_number || 0) - (b.set_number || 0))
      }));

      setMatches(sortedMatches);
    } catch (error) {
      console.error(error);
      toast.error('Erreur chargement matchs');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const updateMatchStatus = async (id: string, status: Match['status'], tableNumber?: number) => {
    try {
      const updates: any = { status };
      if (tableNumber !== undefined) updates.table_number = tableNumber;
      if (status === 'in_progress') updates.started_at = new Date().toISOString();
      if (status === 'finished') updates.finished_at = new Date().toISOString();

      const { error } = await supabase
        .from('matches')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await fetchMatches();
    } catch (error) {
      console.error(error);
      toast.error('Erreur mise à jour match');
    }
  };

  useEffect(() => {
    fetchMatches();

    if (!tournamentId) return;

    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const subscription = supabase
      .channel(`tournament_matches_${tournamentId}_${randomSuffix}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'matches',
        filter: `tournament_id=eq.${tournamentId}`
      }, () => fetchMatches(true))
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'sets'
      }, () => fetchMatches(true))
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [tournamentId]);

  return { matches, loading, updateMatchStatus, refresh: fetchMatches };
}
