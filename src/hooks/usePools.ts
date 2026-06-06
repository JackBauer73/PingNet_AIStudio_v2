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
      setPools([]);
      setMatches([]);
      setStandings([]);
      setLoading(false);
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
        supabase.from('pool_players').select('*'),
        supabase.from('registrations').select('*, players(*), table_categories(*)').eq('tournament_id', tournamentId)
      ]);

      if (matchesRes.error) throw matchesRes.error;
      if (poolPlayersRes.error) throw poolPlayersRes.error;
      if (registrationsRes.error) throw registrationsRes.error;

      const dossardByPlayerId = new Map<string, number>();
      const checkedInByPlayerId = new Map<string, boolean>();
      const paidByPlayerId = new Map<string, boolean>();

      (registrationsRes.data || []).forEach((r: any) => {
        const pid = r.players?.id;
        if (pid) {
          if (r.dossard !== null && r.dossard !== undefined) {
            dossardByPlayerId.set(pid, r.dossard);
          }
          if (r.checked_in) {
            checkedInByPlayerId.set(pid, true);
          }
          if (r.paid) {
            paidByPlayerId.set(pid, true);
          }
        }
      });

      const allPlayers = (registrationsRes.data || []).map((r: any) => {
        const pid = r.players?.id;
        const resolvedDossard = r.dossard || (pid ? dossardByPlayerId.get(pid) : null) || null;
        const resolvedCheckedIn = r.checked_in || (pid ? checkedInByPlayerId.get(pid) : false) || false;
        const resolvedPaid = r.paid || (pid ? paidByPlayerId.get(pid) : false) || false;
        return {
          id: pid,
          first_name: r.players?.first_name || '',
          last_name: r.players?.last_name || '',
          club: r.players?.club || '',
          licence_number: r.players?.licence_number || '',
          points: r.players?.points || 500,
          serie: r.table_categories?.name || '',
          checked_in: resolvedCheckedIn,
          paid: resolvedPaid,
          dossard: resolvedDossard,
          seed_number: r.seed_number || null,
          tournament_id: r.tournament_id
        };
      });
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
        
        // Custom official FFTT Order Index calculation for each pool
        const seededPlayers = playersInPool
          .map(pp => playersById.get(pp.player_id))
          .filter(Boolean)
          .sort((a: any, b: any) => {
            if (b.points !== a.points) {
              return (b.points || 0) - (a.points || 0);
            }
            return a.id.localeCompare(b.id);
          }) as any[];

        const getPoolSequenceIndex = (m: Match) => {
          if (!m.player1_id || !m.player2_id) return 999;
          const idx1 = seededPlayers.findIndex(p => p.id === m.player1_id);
          const idx2 = seededPlayers.findIndex(p => p.id === m.player2_id);
          if (idx1 === -1 || idx2 === -1) return 999;
          
          const first = Math.min(idx1, idx2);
          const second = Math.max(idx1, idx2);
          const len = seededPlayers.length;

          if (len === 3) {
            if (first === 0 && second === 2) return 1; // 1 v 3
            if (first === 0 && second === 1) return 2; // 1 v 2
            if (first === 1 && second === 2) return 3; // 2 v 3
          } else if (len === 4) {
            if (first === 0 && second === 3) return 1; // 1 v 4
            if (first === 1 && second === 2) return 2; // 2 v 3
            if (first === 0 && second === 2) return 3; // 1 v 3
            if (first === 1 && second === 3) return 4; // 2 v 4
            if (first === 0 && second === 1) return 5; // 1 v 2
            if (first === 2 && second === 3) return 6; // 3 v 4
          }
          return first * 10 + second;
        };

        poolMatches.sort((m1, m2) => getPoolSequenceIndex(m1) - getPoolSequenceIndex(m2));
        poolMatchesMap.set(pool.id, poolMatches);

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

      const reorderedMatches: Match[] = [];
      poolsRes?.forEach(pool => {
        const sortedPoolMatches = poolMatchesMap.get(pool.id) || [];
        reorderedMatches.push(...sortedPoolMatches);
      });
      const orphanMatches = sortedMatches.filter(m => !m.pool_id);
      reorderedMatches.push(...orphanMatches);

      setPools(poolsRes || []);
      setMatches(reorderedMatches);
      
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
