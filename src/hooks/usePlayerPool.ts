import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Pool, PoolStanding } from '../types';

export function usePlayerPool(playerId: string, tournamentId: string) {
  const [pool, setPool] = useState<Pool | null>(null);
  const [standing, setStanding] = useState<PoolStanding[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPoolData = async () => {
    if (!playerId || !tournamentId) {
      setLoading(false);
      return;
    }

    try {
      // 1. Get pool player assignment to find the pool id
      const { data: assignments, error: assignmentError } = await supabase
        .from('pool_players')
        .select(`
          pool_id,
          pools!inner(id, name, tournament_id, status, standings_status, table_number)
        `)
        .eq('player_id', playerId)
        .eq('pools.tournament_id', tournamentId);

      if (assignmentError) throw assignmentError;
      if (!assignments || assignments.length === 0) {
        setLoading(false);
        return;
      }

      // Take the active pool for this tournament
      const matchPool = assignments[0].pools as any;
      if (!matchPool) {
        setLoading(false);
        return;
      }

      setPool({
        id: matchPool.id,
        name: matchPool.name,
        tournament_id: matchPool.tournament_id,
        status: matchPool.status,
        standings_status: matchPool.standings_status,
        table_number: matchPool.table_number,
        created_at: '',
      } as any);

      const poolId = matchPool.id;

      // 2. Fetch all matches in this pool, all players, and pool player list
      const [matchesRes, poolPlayersRes, registrationsRes] = await Promise.all([
        supabase
          .from('matches')
          .select('*, player1:player1_id(*), player2:player2_id(*), sets(*)')
          .eq('pool_id', poolId)
          .eq('round', 'pool'),
        supabase
          .from('pool_players')
          .select('*')
          .eq('pool_id', poolId),
        supabase
          .from('registrations')
          .select('*, players(*), table_categories(*)')
          .eq('tournament_id', tournamentId)
      ]);

      if (matchesRes.error) throw matchesRes.error;
      if (poolPlayersRes.error) throw poolPlayersRes.error;
      if (registrationsRes.error) throw registrationsRes.error;

      const playerMap = new Map<string, any>();
      const regs = registrationsRes.data || [];
      const poolPlayersList = poolPlayersRes.data || [];
      const poolMatches = matchesRes.data || [];

      // Sort sets recursively
      poolMatches.forEach((m: any) => {
        if (m.sets) {
          m.sets.sort((a: any, b: any) => (a.set_number || 0) - (b.set_number || 0));
        }
      });

      // Find players detail
      const playersById = new Map();
      regs.forEach((r: any) => {
        if (r.players) {
          playersById.set(r.players.id, {
            id: r.players.id,
            first_name: r.players.first_name || '',
            last_name: r.players.last_name || '',
            club: r.players.club || '',
            licence_number: r.players.licence_number || '',
            points: r.players.points || 500,
            serie: r.table_categories?.name || '',
            dossard: r.dossard || null,
          });
        }
      });

      // Initialize standings template
      poolPlayersList.forEach((pp) => {
        const p = playersById.get(pp.player_id);
        if (p) {
          playerMap.set(p.id, {
            player_id: p.id,
            pool_id: poolId,
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
            points_fftt: p.points,
          });
        }
      });

      // Calculate score values
      poolMatches.forEach((m: any) => {
        if (m.status === 'finished') {
          const setsWonP1 = m.sets?.filter((s: any) => s.score_p1 > s.score_p2).length || 0;
          const setsWonP2 = m.sets?.filter((s: any) => s.score_p2 > s.score_p1).length || 0;

          const p1 = playerMap.get(m.player1_id || '');
          const p2 = playerMap.get(m.player2_id || '');

          if (p1) {
            p1.matches_played += 1;
            p1.sets_won += setsWonP1;
            p1.sets_lost += setsWonP2;
            p1.points_scored += m.sets?.reduce((acc: number, s: any) => acc + (s.score_p1 || 0), 0) || 0;
            p1.points_conceded += m.sets?.reduce((acc: number, s: any) => acc + (s.score_p2 || 0), 0) || 0;
            if (setsWonP1 > setsWonP2) {
              p1.points += 2;
              p1.wins += 1;
            } else if (setsWonP2 > setsWonP1) {
              p1.losses += 1;
            } else {
              p1.points += 1; // Tie
            }
          }

          if (p2) {
            p2.matches_played += 1;
            p2.sets_won += setsWonP2;
            p2.sets_lost += setsWonP1;
            p2.points_scored += m.sets?.reduce((acc: number, s: any) => acc + (s.score_p2 || 0), 0) || 0;
            p2.points_conceded += m.sets?.reduce((acc: number, s: any) => acc + (s.score_p1 || 0), 0) || 0;
            if (setsWonP2 > setsWonP1) {
              p2.points += 2;
              p2.wins += 1;
            } else if (setsWonP1 > setsWonP2) {
              p2.losses += 1;
            } else {
              p2.points += 1; // Tie
            }
          }
        }
      });

      // Sort according to FFTT rankings rule
      const computed = Array.from(playerMap.values()).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const diffA = a.sets_won - a.sets_lost;
        const diffB = b.sets_won - b.sets_lost;
        if (diffB !== diffA) return diffB - diffA;
        if (b.sets_won !== a.sets_won) return b.sets_won - a.sets_won;
        return (b.points_scored - b.points_conceded) - (a.points_scored - a.points_conceded);
      });

      const formatted: PoolStanding[] = computed.map((s, idx) => ({
        ...s,
        standing_rank: idx + 1,
        set_diff: s.sets_won - s.sets_lost,
        point_diff: s.points_scored - s.points_conceded,
      }));

      setStanding(formatted);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching player pool:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!playerId || !tournamentId) {
      setLoading(false);
      return;
    }

    fetchPoolData();

    // Listen to changes in the pool matches or sets table to refresh standing rankings instantly
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const channel = supabase
      .channel(`player-pool-${playerId}-${randomSuffix}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `tournament_id=eq.${tournamentId}`,
      }, () => {
        fetchPoolData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sets',
      }, () => {
        fetchPoolData();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'pools',
        filter: `tournament_id=eq.${tournamentId}`,
      }, () => {
        fetchPoolData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, tournamentId]);

  return { pool, standing, loading, refresh: fetchPoolData };
}
