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

      // Check URL and path for tournament selection
      const searchParams = new URLSearchParams(window.location.search);
      const urlTournamentId = searchParams.get('t') || searchParams.get('tournamentId');

      let pathTournamentId: string | null = null;
      const pathParts = window.location.pathname.split('/');
      const playerIndex = pathParts.indexOf('player');
      if (playerIndex !== -1 && pathParts[playerIndex + 1]) {
        const potentialId = pathParts[playerIndex + 1];
        if (potentialId !== 'login' && potentialId !== 'auth' && potentialId.length === 36) {
          pathTournamentId = potentialId;
        }
      }

      // Check active auth session
      const { data: { user } } = await supabase.auth.getUser();

      let query = supabase.from('tournaments').select('*');
      let hasFilter = false;

      if (urlTournamentId) {
        query = query.eq('id', urlTournamentId);
        hasFilter = true;
      } else if (pathTournamentId) {
        query = query.eq('id', pathTournamentId);
        hasFilter = true;
      } else if (user) {
        query = query.eq('organizer_id', user.id);
        hasFilter = true;
      }

      if (!hasFilter) {
        setTournament(null);
        setStats({ players: 0, matchesDone: 0, matchesTotal: 0 });
        setLoading(false);
        return;
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setTournament(data);
        await loadStats(data.id);
      } else {
        setTournament(null);
        setStats({ players: 0, matchesDone: 0, matchesTotal: 0 });
      }
    } catch (err) {
      console.error('Error loading tournament:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTournament();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, _session) => {
      await loadTournament();
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

  return { tournament, stats, loading, refresh: loadTournament };
}
