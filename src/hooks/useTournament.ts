import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Tournament } from '../types';

export function useTournament() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [stats, setStats] = useState({ players: 0, matchesDone: 0, matchesTotal: 0 });
  const [loading, setLoading] = useState(true);

  const loadStats = async (tId: string) => {
    const [playersCount, matchesStats] = await Promise.all([
      supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tId)
        .not('checked_in', 'is', false),
      supabase
        .from('matches')
        .select('status')
        .eq('tournament_id', tId)
    ]);

    const totalMatches = matchesStats.data?.length || 0;
    const doneMatches = matchesStats.data?.filter(m => m.status === 'finished' || m.status === 'walkover').length || 0;

    setStats({
      players: playersCount.count || 0,
      matchesDone: doneMatches,
      matchesTotal: totalMatches
    });
  };

  const loadTournament = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setTournament(data);
        await loadStats(data.id);
      }
    } catch (err) {
      console.error('Error loading tournament:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTournament();
  }, []);

  useEffect(() => {
    if (!tournament?.id) return;

    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const channel = supabase
      .channel(`dashboard_stats_${tournament.id}_${randomSuffix}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournament.id}` },
        () => loadStats(tournament.id)
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `tournament_id=eq.${tournament.id}` },
        () => loadStats(tournament.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournament?.id]);

  return { tournament, stats, loading, refresh: loadTournament };
}
