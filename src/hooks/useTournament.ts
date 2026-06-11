import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Tournament } from '../types';

interface UseTournamentOptions {
  forcePublic?: boolean;
}

export function useTournament(options: UseTournamentOptions = {}) {
  const { forcePublic = false } = options;
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [stats, setStats] = useState({ players: 0, matchesDone: 0, matchesTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);

  const loadStats = async (tId: string) => {
    if (!isSupabaseConfigured) {
      return;
    }
    const [registrationsStats, matchesStats] = await Promise.all([
      supabase
        .from('registrations')
        .select('player_id')
        .eq('tournament_id', tId),
      supabase
        .from('matches')
        .select('status')
        .eq('tournament_id', tId)
    ]);

    const uniquePlayers = new Set(
      (registrationsStats.data || [])
        .map(r => r.player_id)
        .filter(Boolean)
    ).size;

    const totalMatches = matchesStats.data?.length || 0;
    const doneMatches = matchesStats.data?.filter(m => m.status === 'finished' || m.status === 'walkover').length || 0;

    setStats({
      players: uniquePlayers,
      matchesDone: doneMatches,
      matchesTotal: totalMatches
    });
  };

  // sessionOverride : session directement passée depuis onAuthStateChange pour éviter
  // la race condition avec getSession() qui peut retourner null juste après un SIGNED_IN
  const loadTournament = async (sessionOverride?: Session | null) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const session = sessionOverride !== undefined
        ? sessionOverride
        : (await supabase.auth.getSession()).data.session;

      // Utiliser deux clés de stockage local différentes pour cloisonner mode public et mode admin/organisateur
      const storageKey = forcePublic ? 'public_selected_tournament_id' : 'organizer_selected_tournament_id';
      const savedId = localStorage.getItem(storageKey);

      let fetchedTournament: Tournament | null = null;
      let fetchedList: Tournament[] = [];

      if (session?.user && !forcePublic) {
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
          localStorage.setItem(storageKey, fetchedTournament.id);
        }
      } else {
        // Public mode: list all tournaments in the system across clubs (excluding drafts)
        const { data, error } = await supabase
          .from('tournaments')
          .select('*')
          .neq('status', 'draft')
          .order('created_at', { ascending: false });

        if (error) throw error;
        fetchedList = data || [];

        if (fetchedList.length > 0) {
          const matched = savedId ? fetchedList.find(t => t.id === savedId) : null;
          fetchedTournament = matched || fetchedList[0];
          if (fetchedTournament) {
            localStorage.setItem(storageKey, fetchedTournament.id);
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
    const storageKey = forcePublic ? 'public_selected_tournament_id' : 'organizer_selected_tournament_id';
    localStorage.setItem(storageKey, id);
    await loadTournament();
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    loadTournament();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Nettoyer le localStorage dès la déconnexion pour éviter la pollution entre comptes
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('organizer_selected_tournament_id');
        localStorage.removeItem('public_selected_tournament_id');
        localStorage.removeItem('selected_tournament_id');
      }
      // Passer la session directement pour éviter la race condition avec getSession()
      loadTournament(session ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !tournament?.id) return;

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
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'registrations', filter: `tournament_id=eq.${tournament.id}` },
        () => loadStats(tournament.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournament?.id]);

  return { tournament, stats, loading, allTournaments, selectTournament, refresh: loadTournament };
}
