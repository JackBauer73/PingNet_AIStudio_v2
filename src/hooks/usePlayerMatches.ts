import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Match } from '../types';

export function usePlayerMatches(playerId: string, tournamentId: string) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlayerMatches = async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          player1:player1_id(*),
          player2:player2_id(*),
          sets(*)
        `)
        .eq('tournament_id', tournamentId)
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Derived scores for match sets won helper
      const processed = (data || []).map((m: any) => {
        const setsWonP1 = m.sets?.filter((s: any) => s.score_p1 > s.score_p2).length || 0;
        const setsWonP2 = m.sets?.filter((s: any) => s.score_p2 > s.score_p1).length || 0;
        return {
          ...m,
          sets_won_p1: setsWonP1,
          sets_won_p2: setsWonP2,
        };
      });

      setMatches(processed);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching player matches:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!playerId || !tournamentId) {
      setLoading(false);
      return;
    }

    fetchPlayerMatches();

    const randomSuffix = Math.random().toString(36).substring(2, 10);
    // Listen to changes in the matches or sets tables to keep everything live on user's phones.
    const channel = supabase
      .channel(`player-matches-${playerId}-${randomSuffix}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `tournament_id=eq.${tournamentId}`,
      }, () => {
        fetchPlayerMatches();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sets',
      }, () => {
        fetchPlayerMatches();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, tournamentId]);

  return { matches, loading, refresh: fetchPlayerMatches };
}
