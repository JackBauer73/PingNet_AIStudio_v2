import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { SetScore } from '../types';

export function useSets(matchId: string) {
  const [sets, setSets] = useState<SetScore[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSets = async () => {
    if (!matchId) return;
    try {
      const { data, error } = await supabase
        .from('sets')
        .select('*')
        .eq('match_id', matchId)
        .order('set_number', { ascending: true });

      if (error) throw error;
      setSets(data || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching sets:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!matchId) return;

    fetchSets();

    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const channel = supabase
      .channel(`sets-match-${matchId}-${randomSuffix}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sets',
        filter: `match_id=eq.${matchId}`,
      }, () => {
        fetchSets();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  return { sets, loading, refresh: fetchSets };
}
