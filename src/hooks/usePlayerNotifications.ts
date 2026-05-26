import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export interface Notification {
  id: string;
  player_id: string;
  tournament_id: string;
  type: 'match_ready' | 'validate_match' | 'validate_standings' | 'standings_disputed' | 'match_disputed' | 'pool_finished' | 'qualified' | 'eliminated';
  payload: any;
  read: boolean;
  created_at: string;
}

export function usePlayerNotifications(playerId: string, tournamentId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    if (!playerId || !tournamentId) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('player_id', playerId)
        .eq('tournament_id', tournamentId)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setNotifications(data || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!playerId || !tournamentId) return;

    fetchNotifications();

    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const channel = supabase
      .channel(`notifications-player-${playerId}-${randomSuffix}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `player_id=eq.${playerId}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
        // Dynamic tactile mobile vibration if supported
        if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, tournamentId]);

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);

      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  return { notifications, loading, markAsRead, refresh: fetchNotifications };
}
