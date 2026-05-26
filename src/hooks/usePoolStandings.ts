import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { PoolStanding } from '../types';

export function usePoolStandings(poolId: string) {
  const [standing, setStanding] = useState<PoolStanding[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStandings = async () => {
    if (!poolId) {
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch pool to get tournament_id
      const { data: poolData, error: poolErr } = await supabase
        .from('pools')
        .select('*')
        .eq('id', poolId)
        .maybeSingle();

      if (poolErr || !poolData) throw poolErr || new Error('Pool not found');

      const tournamentId = poolData.tournament_id;

      // 2. Fetch all matches, pool players and registrations
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

      // Sort sets within each match
      poolMatches.forEach((m: any) => {
        if (m.sets) {
          m.sets.sort((a: any, b: any) => (a.set_number || 0) - (b.set_number || 0));
        }
      });

      // Map player details
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

      // Initialize structures
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

      // Compute statistics
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
              p1.points += 1;
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
              p2.points += 1;
            }
          }
        }
      });

      // Sort according to standard FFTT tiebreaker
      const sorted = Array.from(playerMap.values()).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const diffA = a.sets_won - a.sets_lost;
        const diffB = b.sets_won - b.sets_lost;
        if (diffB !== diffA) return diffB - diffA;
        if (b.sets_won !== a.sets_won) return b.sets_won - a.sets_won;
        return (b.points_scored - b.points_conceded) - (a.points_scored - a.points_conceded);
      });

      const formatted: PoolStanding[] = sorted.map((s, idx) => ({
        ...s,
        standing_rank: idx + 1,
        set_diff: s.sets_won - s.sets_lost,
        point_diff: s.points_scored - s.points_conceded,
      }));

      setStanding(formatted);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching pool standings:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStandings();

    if (!poolId) return;

    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const channel = supabase
      .channel(`pool-standings-calc-${poolId}-${randomSuffix}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `pool_id=eq.${poolId}`,
      }, () => {
        fetchStandings();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sets',
      }, () => {
        fetchStandings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [poolId]);

  return { standing, loading, refresh: fetchStandings };
}
