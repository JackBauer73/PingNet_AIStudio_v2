import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Pool, Match, PoolStanding } from '../types';
import toast from 'react-hot-toast';

export function usePools(tournamentId?: string) {
  const [pools, setPools] = useState<Pool[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<PoolStanding[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPoolsData = async (silent = false) => {
    if (!tournamentId) {
      if (!silent) setLoading(false);
      return;
    }
    
    try {
      if (!silent) setLoading(true);
      
      const { data: rawPools, error: poolsError } = await supabase
        .from('pools')
        .select('*')
        .eq('tournament_id', tournamentId);
      
      if (poolsError) throw poolsError;
      
      const getPoolNumber = (name: string): number => {
        const match = name.match(/Poule\s+(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      };

      const poolsRes = (rawPools || []).sort((a, b) => {
        const numA = getPoolNumber(a.name);
        const numB = getPoolNumber(b.name);
        if (numA !== numB) {
          return numA - numB;
        }
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });
      
      const poolIds = poolsRes.map(p => p.id);
      
      const [matchesRes, poolPlayersRes, registrationsRes] = await Promise.all([
        supabase.from('matches')
          .select('*, player1:player1_id(*), player2:player2_id(*), sets(*)')
          .eq('tournament_id', tournamentId)
          .eq('round', 'pool')
          .order('created_at', { ascending: true })
          .order('id', { ascending: true }),
        supabase.from('pool_players').select('*').in('pool_id', poolIds),
        supabase.from('registrations').select('*, players(*), table_categories(*)').eq('tournament_id', tournamentId)
      ]);

      if (matchesRes.error) throw matchesRes.error;
      if (poolPlayersRes.error) throw poolPlayersRes.error;
      if (registrationsRes.error) throw registrationsRes.error;

      const allPlayers = (registrationsRes.data || []).map((r: any) => ({
        id: r.players?.id,
        first_name: r.players?.first_name || '',
        last_name: r.players?.last_name || '',
        club: r.players?.club || '',
        licence_number: r.players?.licence_number || '',
        points: r.players?.points || 500,
        serie: r.table_categories?.name || '',
        checked_in: r.checked_in || false,
        paid: r.paid || false,
        dossard: r.dossard || null,
        tournament_id: r.tournament_id
      }));
      const poolPlayers = poolPlayersRes.data || [];
      const playersById = new Map(allPlayers.map(p => [p.id, p]));

      // Sort sets within each match
      const sortedMatches = (matchesRes.data || []).map((m: any) => ({
        ...m,
        sets: (m.sets || []).sort((a: any, b: any) => (a.set_number || 0) - (b.set_number || 0))
      }));

      // Client-side standings calculation as fallback
      const calculatedStandings: PoolStanding[] = [];
      const poolMatchesMap = new Map<string, Match[]>();
      sortedMatches.forEach(m => {
        if (m.pool_id) {
          const existing = poolMatchesMap.get(m.pool_id) || [];
          poolMatchesMap.set(m.pool_id, [...existing, m]);
        }
      });

      poolsRes?.forEach(pool => {
        const poolMatches = poolMatchesMap.get(pool.id) || [];
        const playersInPool = poolPlayers.filter(pp => pp.pool_id === pool.id);
        const playersMap = new Map<string, any>();

        // Initialize all players belonging to this pool
        playersInPool.forEach(pp => {
          const p = playersById.get(pp.player_id);
          if (p) {
            playersMap.set(p.id, {
              player_id: p.id,
              pool_id: pool.id,
              first_name: p.first_name,
              last_name: p.last_name,
              club: p.club,
              wins: 0,
              losses: 0,
              sets_won: 0,
              sets_lost: 0,
              points_scored: 0,
              points_conceded: 0,
              points: 0,
              matches_played: 0,
              serie: p.serie || '',
              dossard: p.dossard,
              points_fftt: p.points
            });
          }
        });

        // Loop over matches to calculate results
        poolMatches.forEach(m => {
          if (m.status === 'finished') {
            const p1Sets = m.sets?.filter(s => s.score_p1 > s.score_p2).length || 0;
            const p2Sets = m.sets?.filter(s => s.score_p2 > s.score_p1).length || 0;
            
            const p1 = playersMap.get(m.player1_id || '');
            const p2 = playersMap.get(m.player2_id || '');

            if (p1) {
              p1.matches_played += 1;
              p1.sets_won += p1Sets;
              p1.sets_lost += p2Sets;
              p1.points_scored += m.sets?.reduce((acc, s) => acc + s.score_p1, 0) || 0;
              p1.points_conceded += m.sets?.reduce((acc, s) => acc + s.score_p2, 0) || 0;
              if (p1Sets > p2Sets) {
                p1.points += 2;
                p1.wins += 1;
              } else if (p2Sets > p1Sets) {
                p1.losses += 1;
              } else {
                p1.points += 1; // Draw
              }
            }
            if (p2) {
              p2.matches_played += 1;
              p2.sets_won += p2Sets;
              p2.sets_lost += p1Sets;
              p2.points_scored += m.sets?.reduce((acc, s) => acc + s.score_p2, 0) || 0;
              p2.points_conceded += m.sets?.reduce((acc, s) => acc + s.score_p1, 0) || 0;
              if (p2Sets > p1Sets) {
                p2.points += 2;
                p2.wins += 1;
              } else if (p1Sets > p2Sets) {
                p2.losses += 1;
              } else {
                p2.points += 1; // Draw
              }
            }
          }
        });

        const poolSorted = Array.from(playersMap.values()).sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          const diffA = a.sets_won - a.sets_lost;
          const diffB = b.sets_won - b.sets_lost;
          if (diffB !== diffA) return diffB - diffA;
          if (b.sets_won !== a.sets_won) return b.sets_won - a.sets_won;
          return (b.points_scored - b.points_conceded) - (a.points_scored - a.points_conceded);
        });

        poolSorted.forEach((s, idx) => {
          calculatedStandings.push({ 
            ...s, 
            standing_rank: idx + 1,
            set_diff: s.sets_won - s.sets_lost,
            point_diff: s.points_scored - s.points_conceded
          });
        });
      });

      setPools(poolsRes || []);
      setMatches(sortedMatches);
      
      setStandings(calculatedStandings);
    } catch (error) {
      console.error('Error fetching pools:', error);
      toast.error('Erreur lors du chargement des poules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoolsData();

    if (!tournamentId) return;

    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const channel = supabase
      .channel(`pools_changes_${tournamentId}_${randomSuffix}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` }, () => fetchPoolsData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sets' }, () => fetchPoolsData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pools', filter: `tournament_id=eq.${tournamentId}` }, () => fetchPoolsData(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  return { pools, matches, standings, loading, refresh: fetchPoolsData };
}
