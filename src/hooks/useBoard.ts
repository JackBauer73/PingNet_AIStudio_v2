import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { useTournament } from './useTournament';
import { Match, Pool, TableCategory, Player } from '../types';

export interface BoardTable {
  tableNumber: number;
  status: 'available' | Match['status'];
  match: Match | null;
  round: Match['round'] | null;
  category: TableCategory | null;
  pool: Pool | null;
  // All pool players if a pool match, or the two players if bracket
  players: Array<{
    id: string;
    first_name: string;
    last_name: string;
    points: number | null;
    club: string | null;
    checked_in: boolean;
    is_playing_now: boolean; // whether this player is actually in the active match on this table
  }>;
}

export function useBoard() {
  const { tournament, loading: tournamentLoading } = useTournament({ forcePublic: true });
  const [tables, setTables] = useState<BoardTable[]>([]);
  const [categories, setCategories] = useState<TableCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRef = useRef<() => Promise<void>>();

  const fetchBoardData = useCallback(async (silent = false) => {
    if (!isSupabaseConfigured || !tournament?.id) {
      setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);

      // 1. Fetch physical tables, table categories, active matches, and pools in parallel
      const [
        physicalTablesRes,
        categoriesRes,
        matchesRes,
        poolsRes,
        regsRes
      ] = await Promise.all([
        supabase
          .from('tournament_tables')
          .select('*')
          .eq('tournament_id', tournament.id)
          .order('table_number', { ascending: true }),
        supabase
          .from('table_categories')
          .select('*')
          .eq('tournament_id', tournament.id),
        supabase
          .from('matches')
          .select('*, player1:player1_id(*), player2:player2_id(*), sets(*)')
          .eq('tournament_id', tournament.id)
          .in('status', ['pending', 'in_progress', 'awaiting_validation', 'disputed', 'walkover']),
        supabase
          .from('pools')
          .select('*')
          .eq('tournament_id', tournament.id),
        supabase
          .from('registrations')
          .select('*, players(*), table_categories(*)')
          .eq('tournament_id', tournament.id)
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (matchesRes.error) throw matchesRes.error;
      if (poolsRes.error) throw poolsRes.error;
      if (regsRes.error) throw regsRes.error;

      const fetchedCategories = categoriesRes.data || [];
      const fetchedMatches = matchesRes.data || [];
      const fetchedPools = poolsRes.data || [];
      const fetchedRegistrations = regsRes.data || [];

      setCategories(fetchedCategories);

      // 2. Resolve pool_players for pools
      let poolPlayerRows: any[] = [];
      if (fetchedPools.length > 0) {
        const poolIds = fetchedPools.map(p => p.id);
        const { data: ppRes, error: ppErr } = await supabase
          .from('pool_players')
          .select('*')
          .in('pool_id', poolIds);
        if (!ppErr && ppRes) {
          poolPlayerRows = ppRes;
        }
      }

      // Map registrations for quick player lookup by player_id + category_id
      // to resolve points, club, checked_in status on specific categories.
      const regsMap = new Map<string, any>();
      fetchedRegistrations.forEach((r: any) => {
        const pObj = Array.isArray(r.players) ? r.players[0] : r.players;
        const cObj = Array.isArray(r.table_categories) ? r.table_categories[0] : r.table_categories;
        if (pObj) {
          const key = `${pObj.id}_${r.table_category_id}`;
          regsMap.set(key, {
            id: pObj.id,
            first_name: pObj.first_name,
            last_name: pObj.last_name,
            points: pObj.points,
            club: pObj.club,
            checked_in: r.checked_in || false,
            serie: cObj?.name || ''
          });
        }
      });

      // Simple player lookup mapping (fallback when category ID is unknown)
      const playersMap = new Map<string, any>();
      fetchedRegistrations.forEach((r: any) => {
        const pObj = Array.isArray(r.players) ? r.players[0] : r.players;
        if (pObj && !playersMap.has(pObj.id)) {
          playersMap.set(pObj.id, {
            id: pObj.id,
            first_name: pObj.first_name,
            last_name: pObj.last_name,
            points: pObj.points,
            club: pObj.club,
            checked_in: r.checked_in || false,
          });
        }
      });

      // 3. Build physical tables trame, using nb_tables from the tournament model as fallback
      const totalNbTables = tournament.nb_tables || 1;
      const physicalTables = physicalTablesRes.data && physicalTablesRes.data.length > 0
        ? physicalTablesRes.data
        : Array.from({ length: totalNbTables }, (_, i) => ({ table_number: i + 1 }));

      const resolvedTables: BoardTable[] = physicalTables.map(t => {
        const tableNum = t.table_number;
        // Search active match on this table
        const activeMatch = fetchedMatches.find(m => m.table_number === tableNum) || null;

        if (!activeMatch) {
          return {
            tableNumber: tableNum,
            status: 'available',
            match: null,
            round: null,
            category: null,
            pool: null,
            players: []
          };
        }

        // Search category of the match
        let category: TableCategory | null = null;
        let pool: Pool | null = null;
        let tablePlayers: BoardTable['players'] = [];

        // If it's a pool match, resolve the pool and its players
        if (activeMatch.round === 'pool' && activeMatch.pool_id) {
          pool = fetchedPools.find(p => p.id === activeMatch.pool_id) || null;
          if (pool && pool.table_category_id) {
            category = fetchedCategories.find(c => c.id === pool!.table_category_id) || null;

            // Get all players for this pool
            const poolPlayersIds = poolPlayerRows
              .filter(pp => pp.pool_id === pool!.id)
              .map(pp => pp.player_id);

            tablePlayers = poolPlayersIds.map(pId => {
              const regKey = `${pId}_${pool!.table_category_id}`;
              const pDetails = regsMap.get(regKey) || playersMap.get(pId);
              return {
                id: pId,
                first_name: pDetails?.first_name || '',
                last_name: pDetails?.last_name || '',
                points: pDetails?.points || null,
                club: pDetails?.club || null,
                checked_in: pDetails?.checked_in || false,
                is_playing_now: pId === activeMatch.player1_id || pId === activeMatch.player2_id
              };
            });
            
            // Fallback if no pool players records survived yet
            if (tablePlayers.length === 0) {
              if (activeMatch.player1) {
                tablePlayers.push({
                  id: activeMatch.player1_id || '1',
                  first_name: activeMatch.player1.first_name || '',
                  last_name: activeMatch.player1.last_name || '',
                  points: activeMatch.player1.points || null,
                  club: activeMatch.player1.club || null,
                  checked_in: true,
                  is_playing_now: true
                });
              }
              if (activeMatch.player2) {
                tablePlayers.push({
                  id: activeMatch.player2_id || '2',
                  first_name: activeMatch.player2.first_name || '',
                  last_name: activeMatch.player2.last_name || '',
                  points: activeMatch.player2.points || null,
                  club: activeMatch.player2.club || null,
                  checked_in: true,
                  is_playing_now: true
                });
              }
            }
          }
        } else {
          // Bracket Match: resolve category from first player or search matches structure
          // Try to look up category_id off the match directly if it has one or table_categories
          // Let's deduce category from candidate player category
          const candidatePlayerId = activeMatch.player1_id || activeMatch.player2_id;
          if (candidatePlayerId) {
            // Find active registration for this tournament
            const reg = fetchedRegistrations.find((r: any) => r.player_id === candidatePlayerId);
            if (reg && reg.table_category_id) {
              category = fetchedCategories.find(c => c.id === reg.table_category_id) || null;
            }
          }

          if (activeMatch.player1) {
            const reg1 = fetchedRegistrations.find((r: any) => r.player_id === activeMatch.player1_id && r.table_category_id === category?.id);
            tablePlayers.push({
              id: activeMatch.player1_id || '1',
              first_name: activeMatch.player1.first_name || '',
              last_name: activeMatch.player1.last_name || '',
              points: activeMatch.player1.points || null,
              club: activeMatch.player1.club || null,
              checked_in: reg1?.checked_in ?? true,
              is_playing_now: true
            });
          }
          if (activeMatch.player2) {
            const reg2 = fetchedRegistrations.find((r: any) => r.player_id === activeMatch.player2_id && r.table_category_id === category?.id);
            tablePlayers.push({
              id: activeMatch.player2_id || '2',
              first_name: activeMatch.player2.first_name || '',
              last_name: activeMatch.player2.last_name || '',
              points: activeMatch.player2.points || null,
              club: activeMatch.player2.club || null,
              checked_in: reg2?.checked_in ?? true,
              is_playing_now: true
            });
          }
        }

        // Sort match sets
        if (activeMatch.sets) {
          activeMatch.sets = [...activeMatch.sets].sort((a, b) => (a.set_number || 0) - (b.set_number || 0));
        }

        return {
          tableNumber: tableNum,
          status: activeMatch.status,
          match: activeMatch,
          round: activeMatch.round,
          category,
          pool,
          players: tablePlayers
        };
      });

      setTables(resolvedTables);
      setError(null);
    } catch (err: any) {
      console.error('Error in useBoard:', err);
      setError(err?.message || 'Une erreur est survenue lors de la récupération des données.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tournament?.id]);

  useEffect(() => {
    fetchRef.current = fetchBoardData;
  }, [fetchBoardData]);

  // Handle data fetching on tournament change
  useEffect(() => {
    if (tournament?.id) {
      fetchBoardData();
    }
  }, [tournament?.id, fetchBoardData]);

  // Supabase updates + Polling safeguard + Visibility events
  useEffect(() => {
    if (!isSupabaseConfigured || !tournament?.id) return;

    // 1. WebSocket channels
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const channel = supabase
      .channel(`board_live_${tournament.id}_${randomSuffix}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournament.id}` }, () => fetchRef.current?.(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sets' }, () => fetchRef.current?.(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pools', filter: `tournament_id=eq.${tournament.id}` }, () => fetchRef.current?.(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_tables', filter: `tournament_id=eq.${tournament.id}` }, () => fetchRef.current?.(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations', filter: `tournament_id=eq.${tournament.id}` }, () => fetchRef.current?.(true))
      .subscribe();

    // 2. Polling backup (every 45s) for robust multi-hour TV runtime
    const interval = setInterval(() => {
      fetchRef.current?.(true);
    }, 45000);

    // 3. Page visibility recovery
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchRef.current?.(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tournament?.id]);

  return {
    tournament,
    tables,
    categories,
    loading: tournamentLoading || loading,
    error,
    refresh: () => fetchBoardData(false)
  };
}
