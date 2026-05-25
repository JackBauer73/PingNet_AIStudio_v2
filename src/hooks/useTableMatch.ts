import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Match, SetScore } from '../types';
import { handleBracketProgression } from '../utils/bracketAdvancement';

export function useTableMatch(tableNumber: number) {
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchTableMatch = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      // Trouver le match in_progress sur cette table
      // On prend de préférence le match du tournoi le plus récent
      const { data, error: supabaseError } = await supabase
        .from('matches')
        .select(`
          *,
          player1:player1_id(*),
          player2:player2_id(*),
          sets(*),
          tournament:tournament_id(sets_to_win, points_per_set)
        `)
        .eq('table_number', tableNumber)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (supabaseError) throw supabaseError;
      
      // Sort sets by number to ensure correct history
      if (data?.sets) {
        data.sets.sort((a: any, b: any) => a.set_number - b.set_number);
      }
      
      setMatch(data);
    } catch (err) {
      console.error('Error fetching table match:', err);
      setError(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const addSetScore = async (scoreP1: number, scoreP2: number) => {
    if (!match) return;

    try {
      const setNumber = (match.sets?.length || 0) + 1;
      const { data, error } = await supabase
        .from('sets')
        .insert([{
          match_id: match.id,
          set_number: setNumber,
          score_p1: scoreP1,
          score_p2: scoreP2
        }])
        .select()
        .single();

      if (error) throw error;
      
      // Update local state immediately for better UX
      if (data) {
        setMatch(prev => {
          if (!prev) return null;
          const updatedSets = [...(prev.sets || []), data].sort((a: any, b: any) => a.set_number - b.set_number);
          return { ...prev, sets: updatedSets };
        });
      }

      await fetchTableMatch();
    } catch (error: any) {
      console.error('Error adding set score:', error);
      throw error; // Rethrow to let component handle it (e.g. toast)
    }
  };

  const updateSetScore = async (setId: string, scoreP1: number, scoreP2: number) => {
    try {
      const { error } = await supabase
        .from('sets')
        .update({ score_p1: scoreP1, score_p2: scoreP2 })
        .eq('id', setId);

      if (error) throw error;
      await fetchTableMatch();
    } catch (error) {
      console.error(error);
    }
  };

  const finishMatch = async (winnerId: string) => {
    if (!match) return;
    try {
      const { error } = await supabase
        .from('matches')
        .update({
          status: 'finished',
          winner_id: winnerId,
          finished_at: new Date().toISOString()
        })
        .eq('id', match.id);

      if (error) throw error;

      // Si c'est un match de poule, lancer automatiquement le match suivant en attente pour cette même poule sur cette table
      if (match.pool_id && match.table_number) {
        const { data: nextPendingMatches, error: pendingError } = await supabase
          .from('matches')
          .select('id')
          .eq('pool_id', match.pool_id)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .limit(1);

        if (!pendingError && nextPendingMatches && nextPendingMatches.length > 0) {
          const nextMatchId = nextPendingMatches[0].id;
          await supabase
            .from('matches')
            .update({
              table_number: match.table_number,
              status: 'in_progress',
              started_at: new Date().toISOString()
            })
            .eq('id', nextMatchId);
        } else {
          // Si plus aucun match n'est en attente/en cours dans cette poule, marquer la poule comme 'finished' !
          const { data: remainingMatches, error: remainingError } = await supabase
            .from('matches')
            .select('id, status')
            .eq('pool_id', match.pool_id);

          if (!remainingError && remainingMatches) {
            const activeOrPending = remainingMatches.filter(m => m.id !== match.id && (m.status === 'pending' || m.status === 'in_progress'));
            if (activeOrPending.length === 0) {
              await supabase
                .from('pools')
                .update({ status: 'finished', table_number: null })
                .eq('id', match.pool_id);
            }
          }
        }
      }
      
      // Handle bracket progression
      await handleBracketProgression(match.id, winnerId);
      
      setMatch(null); // Clear after finish
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchTableMatch();

    if (!tableNumber) return;

    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const channel = supabase
      .channel(`table-${tableNumber}-${randomSuffix}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'matches'
      }, () => fetchTableMatch(true))
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'sets' 
      }, () => fetchTableMatch(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableNumber]);

  return { match, loading, error, addSetScore, updateSetScore, finishMatch, refresh: fetchTableMatch };
}
