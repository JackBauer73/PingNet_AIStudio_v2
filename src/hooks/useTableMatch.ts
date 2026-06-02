import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Match, SetScore } from '../types';
import { handleBracketProgression } from '../utils/bracketAdvancement';

export function useTableMatch(tableNumber: number) {
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchTableMatch = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      // Trouver le match actif (in_progress, awaiting_validation ou disputed) sur cette table
      const { data, error: supabaseError } = await supabase
        .from('matches')
        .select(`
          *,
          player1:player1_id(*),
          player2:player2_id(*),
          sets(*),
          tournament:tournament_id(sets_to_win, points_per_set)
        `)
        .eq('table_number', tableNumber)
        .in('status', ['in_progress', 'awaiting_validation', 'disputed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (supabaseError) throw supabaseError;
      
      // Sort sets by number to ensure correct history
      if (data?.sets) {
        data.sets.sort((a: any, b: any) => a.set_number - b.set_number);
      }
      
      setMatch(data);
    } catch (err) {
      console.error('Error fetching table match:', err);
      setError(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const finishMatch = async (winnerId: string) => {
    if (!match) return;
    try {
      // Finaliser et auto-valider des deux côtés
      const { error } = await supabase
        .from('matches')
        .update({
          status: 'finished',
          winner_id: winnerId,
          finished_at: new Date().toISOString(),
          validated_by_p1: true,
          validated_by_p2: true
        })
        .eq('id', match.id);

      if (error) throw error;

      // Si c'est un match de poule, lancer automatiquement le match suivant en attente pour cette même poule sur cette table
      if (match.pool_id && match.table_number) {
        // Récupérer tous les joueurs mobilisés sur d'autres tables
        // 1. Matches actifs en cours
        const { data: otherMatches } = await supabase
          .from('matches')
          .select('player1_id, player2_id')
          .eq('status', 'in_progress')
          .neq('table_number', match.table_number); // sur d'autres tables

        const otherActivePlayerIds = new Set<string>();
        otherMatches?.forEach(m => {
          if (m.player1_id) otherActivePlayerIds.add(m.player1_id);
          if (m.player2_id) otherActivePlayerIds.add(m.player2_id);
        });

        // 2. Poules actives sur d'autres tables
        const { data: otherPools } = await supabase
          .from('pools')
          .select('id')
          .neq('status', 'finished')
          .not('table_number', 'is', null)
          .neq('table_number', match.table_number);

        if (otherPools && otherPools.length > 0) {
          const otherPoolIds = otherPools.map(p => p.id);
          const { data: otherPoolPlayers } = await supabase
            .from('pool_players')
            .select('player_id')
            .in('pool_id', otherPoolIds);
          otherPoolPlayers?.forEach(pp => {
            otherActivePlayerIds.add(pp.player_id);
          });
        }

        const { data: nextPendingMatches, error: pendingError } = await supabase
          .from('matches')
          .select('id, player1_id, player2_id')
          .eq('pool_id', match.pool_id)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .order('id', { ascending: true });

        if (!pendingError && nextPendingMatches && nextPendingMatches.length > 0) {
          // Filtrer les matches qui contiennent un joueur mobilisé ailleurs
          const eligibleMatches = nextPendingMatches.filter(m => 
            (!m.player1_id || !otherActivePlayerIds.has(m.player1_id)) &&
            (!m.player2_id || !otherActivePlayerIds.has(m.player2_id))
          );

          // Tâche 6 : Éviter d'enchaîner deux matchs consécutifs pour un même joueur (pas de repos)
          const justPlayedPlayers = [match.player1_id, match.player2_id].filter(Boolean);
          
          // Chercher en priorité un match où aucun des deux joueurs ne vient d'y être
          let preferredMatch = eligibleMatches.find(m => 
            !justPlayedPlayers.includes(m.player1_id) && 
            !justPlayedPlayers.includes(m.player2_id)
          );

          // Si aucun match idéal n'est disponible, on prend le premier match en attente dont les joueurs sont libres
          if (!preferredMatch && eligibleMatches.length > 0) {
            preferredMatch = eligibleMatches[0];
          }

          if (preferredMatch) {
            await supabase
              .from('matches')
              .update({
                table_number: match.table_number,
                status: 'in_progress',
                started_at: new Date().toISOString()
              })
              .eq('id', preferredMatch.id);
          } else {
            console.log("Aucun match disponible pour rotation sans conflit.");
          }
        }

        // Si aucun match n'a pu être assigné parce qu'on libère la table pour repos ou qu'il n'y a plus de match pending,
        // on vérifie si la poule est terminée (tous les matchs finished) :
        const { data: remainingMatches, error: remainingError } = await supabase
          .from('matches')
          .select('id, status')
          .eq('pool_id', match.pool_id);

        if (!remainingError && remainingMatches) {
          const activeOrPending = remainingMatches.filter(m => 
            m.id !== match.id && 
            (m.status === 'pending' || m.status === 'in_progress' || m.status === 'awaiting_validation' || m.status === 'disputed')
          );
          
          if (activeOrPending.length === 0) {
            // Pas de validation intermédiaire : la poule passe directement à finished
            await supabase
              .from('pools')
              .update({ 
                status: 'finished', 
                table_number: null,
                awaiting_validation_since: null
              })
              .eq('id', match.pool_id);
          }
        }
      }
      
      // Handle bracket progression
      await handleBracketProgression(match.id, winnerId);
      
      setMatch(null); // Clear after finish
    } catch (error) {
      console.error(error);
    }
  };

  const addSetScore = async (scoreP1: number, scoreP2: number) => {
    if (!match) return;

    try {
      const setNumber = (match.sets?.length || 0) + 1;
      const { data, error } = await supabase
        .from('sets')
        .insert([{
          match_id: match.id,
          set_number: setNumber,
          score_p1: scoreP1,
          score_p2: scoreP2
        }])
        .select()
        .single();

      if (error) throw error;
      
      // Local addition
      let updatedSets = [...(match.sets || [])];
      if (data) {
        updatedSets = [...updatedSets, data].sort((a: any, b: any) => a.set_number - b.set_number);
        setMatch(prev => {
          if (!prev) return null;
          return { ...prev, sets: updatedSets };
        });
      }

      // Check if either player has won enough sets to win the match (default to 3 if not loaded)
      const p1Sets = updatedSets.filter(s => s.score_p1 > s.score_p2).length;
      const p2Sets = updatedSets.filter(s => s.score_p2 > s.score_p1).length;
      const targetSets = (match as any).tournament?.sets_to_win || 3;

      if (p1Sets >= targetSets || p2Sets >= targetSets) {
        const winnerId = p1Sets >= targetSets ? match.player1_id : match.player2_id;
        if (winnerId) {
          await finishMatch(winnerId);
        }
      } else {
        await fetchTableMatch(true);
      }
    } catch (error: any) {
      console.error('Error adding set score:', error);
      throw error;
    }
  };

  const updateSetScore = async (setId: string, scoreP1: number, scoreP2: number) => {
    try {
      const { error } = await supabase
        .from('sets')
        .update({ score_p1: scoreP1, score_p2: scoreP2 })
        .eq('id', setId);

      if (error) throw error;
      await fetchTableMatch();
    } catch (error) {
      console.error(error);
    }
  };

  const deleteLastSet = async () => {
    if (!match || !match.sets || match.sets.length === 0) return;
    try {
      const sorted = [...match.sets].sort((a: any, b: any) => b.set_number - a.set_number);
      const lastSet = sorted[0];
      const { error } = await supabase
        .from('sets')
        .delete()
        .eq('id', lastSet.id);

      if (error) throw error;
      await fetchTableMatch();
    } catch (err) {
      console.error('Error deleting last set:', err);
    }
  };

  useEffect(() => {
    fetchTableMatch();

    if (!tableNumber) return;

    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const channel = supabase
      .channel(`table-${tableNumber}-${randomSuffix}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'matches'
      }, () => fetchTableMatch(true))
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'sets' 
      }, () => fetchTableMatch(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableNumber]);

  return { match, loading, error, addSetScore, updateSetScore, deleteLastSet, finishMatch, refresh: fetchTableMatch };
}
