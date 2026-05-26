import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Match } from '../types';

export function useMatch(matchId: string) {
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMatch = async () => {
    if (!matchId) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          player1:player1_id(*),
          player2:player2_id(*),
          sets(*),
          tournament:tournament_id(sets_to_win, points_per_set)
        `)
        .eq('id', matchId)
        .maybeSingle();

      if (error) throw error;

      if (data && data.sets) {
        data.sets.sort((a: any, b: any) => (a.set_number || 0) - (b.set_number || 0));
      }

      setMatch(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching match:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!matchId) {
      setLoading(false);
      return;
    }

    fetchMatch();

    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const channel = supabase
      .channel(`match-detail-${matchId}-${randomSuffix}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `id=eq.${matchId}`,
      }, () => {
        fetchMatch();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sets',
        filter: `match_id=eq.${matchId}`,
      }, () => {
        fetchMatch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  return { match, loading, refresh: fetchMatch };
}
