import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Tournament } from '../types';

export function useTournament() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [stats, setStats] = useState({ players: 0, matchesDone: 0, matchesTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);

  const loadStats = async (tId: string) => {
    const [playersCount, matchesStats] = await Promise.all([
      supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tId)
        .eq('checked_in', true),
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
      const { data: { session } } = await supabase.auth.getSession();
      const savedId = localStorage.getItem('selected_tournament_id');

      let fetchedTournament: Tournament | null = null;
      let fetchedList: Tournament[] = [];

      if (session?.user) {
        // Organizer mode: only see tournaments belonging to this club
        const { data, error } = await supabase
          .from('tournaments')
          .select('*')
          .eq('organizer_id', session.user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        fetchedList = data || [];

        if (fetchedList.length > 0) {
          const matched = savedId ? fetchedList.find(t => t.id === savedId) : null;
          fetchedTournament = matched || fetchedList[0];
          localStorage.setItem('selected_tournament_id', fetchedTournament.id);
        }
      } else {
        // Public mode: list all tournaments in the system across clubs
        const { data, error } = await supabase
          .from('tournaments')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        fetchedList = data || [];

        if (fetchedList.length > 0) {
          const matched = savedId ? fetchedList.find(t => t.id === savedId) : null;
          fetchedTournament = matched || fetchedList[0];
          if (fetchedTournament) {
            localStorage.setItem('selected_tournament_id', fetchedTournament.id);
          }
        }
      }

      setAllTournaments(fetchedList);
      setTournament(fetchedTournament);
      if (fetchedTournament) {
        await loadStats(fetchedTournament.id);
      } else {
        setStats({ players: 0, matchesDone: 0, matchesTotal: 0 });
      }
    } catch (err) {
      console.error('Error loading tournament:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectTournament = async (id: string) => {
    localStorage.setItem('selected_tournament_id', id);
    await loadTournament();
  };

  useEffect(() => {
    loadTournament();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadTournament();
    });

    return () => {
      subscription.unsubscribe();
    };
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

  return { tournament, stats, loading, allTournaments, selectTournament, refresh: loadTournament };
}
