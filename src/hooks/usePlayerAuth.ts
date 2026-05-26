import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

interface PlayerContext {
  playerId: string;
  tournamentId: string;
  token: string;
}

export function usePlayerAuth() {
  const [player, setPlayer] = useState<PlayerContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem('playerToken');
      const tournamentId = localStorage.getItem('playerTournament');
      const playerId = localStorage.getItem('playerId');

      if (!token || !tournamentId || !playerId) {
        setLoading(false);
        return;
      }

      try {
        // Verify token validity against the registrations table in DB
        const { data, error } = await supabase
          .from('registrations')
          .select('player_token_exp')
          .eq('player_token', token)
          .single();

        if (error || !data || new Date(data.player_token_exp) < new Date()) {
          // Token expired or invalid -> clean localStorage
          localStorage.removeItem('playerToken');
          localStorage.removeItem('playerTournament');
          localStorage.removeItem('playerId');
          setPlayer(null);
        } else {
          setPlayer({ playerId, tournamentId, token });
        }
      } catch (err) {
        console.error('Error verifying user token:', err);
        setPlayer(null);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  return { player, loading };
}
