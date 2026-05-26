import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase';
import { Loader2, AlertCircle } from 'lucide-react';

export default function PlayerAuth() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    const authenticate = async () => {
      if (!token) {
        navigate('/player/login');
        return;
      }

      try {
        // Validate the token against DB
        const { data, error } = await supabase
          .from('registrations')
          .select('player_id, tournament_id, player_token_exp')
          .eq('player_token', token)
          .maybeSingle();

        if (error || !data) {
          setErrorText('Lien magique invalide. Veuillez demander un nouveau lien.');
          return;
        }

        if (new Date(data.player_token_exp) < new Date()) {
          setErrorText('Ce lien magique a expiré. Veuillez en générer un nouveau.');
          return;
        }

        // Store player context of the session
        localStorage.setItem('playerToken', token);
        localStorage.setItem('playerTournament', data.tournament_id);
        localStorage.setItem('playerId', data.player_id);

        // Update last_seen_at
        await supabase
          .from('registrations')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('player_token', token);

        navigate(`/player/${data.tournament_id}`);
      } catch (err) {
        console.error(err);
        setErrorText('Erreur de connexion. Veuillez réessayer.');
      }
    };

    authenticate();
  }, [token, navigate]);

  if (errorText) {
    return (
      <div className="min-h-screen bg-[#0f1f3d] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-950/40 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold mb-2">Erreur d'authentification</h2>
        <p className="text-slate-400 max-w-sm mb-6">{errorText}</p>
        <button
          onClick={() => navigate('/player/login')}
          className="px-6 py-2.5 bg-orange-500 rounded-xl font-bold hover:bg-orange-400 active:scale-95 transition-all"
        >
          Retour au Login
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1f3d] text-white flex flex-col items-center justify-center p-6 text-center">
      <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
      <p className="font-bold text-lg">Connexion à votre espace joueur...</p>
      <p className="text-xs text-slate-500 mt-1">Vérification de votre clé de sécurité...</p>
    </div>
  );
}
