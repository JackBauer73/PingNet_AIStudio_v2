import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayerAuth } from '../../hooks/usePlayerAuth';
import { usePlayerMatches } from '../../hooks/usePlayerMatches';
import { usePlayerPool } from '../../hooks/usePlayerPool';
import { usePlayerNotifications } from '../../hooks/usePlayerNotifications';
import { supabase } from '../../supabase';
import { MatchCard } from '../../components/player/MatchCard';
import { PoolStandingCard } from '../../components/player/PoolStandingCard';
import { UrgentBanner } from '../../components/player/UrgentBanner';
import { Loader2, Power, Trophy, Calendar, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';

export default function PlayerDashboard() {
  const { player, loading: loadingAuth } = usePlayerAuth();
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();

  const [playerData, setPlayerData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);

  // Fetch match planning, pool standings and live notifications
  const { matches, loading: loadingMatches, refresh: refreshMatches } = usePlayerMatches(player?.playerId || '', tournamentId || '');
  const { pool, standing, loading: loadingPool, refresh: refreshPool } = usePlayerPool(player?.playerId || '', tournamentId || '');
  const { notifications, refresh: refreshNotifs } = usePlayerNotifications(player?.playerId || '', tournamentId || '');

  useEffect(() => {
    const fetchPlayerData = async () => {
      if (!player?.playerId) return;
      try {
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('id', player.playerId)
          .maybeSingle();

        if (error) throw error;
        setPlayerData(data);
      } catch (err) {
        console.error('Error fetching player data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    fetchPlayerData();
  }, [player?.playerId]);

  const handleLogout = () => {
    localStorage.removeItem('playerToken');
    localStorage.removeItem('playerTournament');
    localStorage.removeItem('playerId');
    navigate('/player/login');
  };

  const handleRefreshAll = () => {
    refreshMatches();
    refreshPool();
    refreshNotifs();
  };

  if (loadingAuth || loadingData) {
    return (
      <div className="min-h-screen bg-[#0f1f3d] text-white flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
        <p className="font-extrabold text-sm uppercase tracking-wider text-slate-450">Chargement de votre espace...</p>
      </div>
    );
  }

  // Find urgent matches to validate or sign
  const urgent = notifications.find(
    (n) => !n.read && (n.type === 'validate_match' || n.type === 'validate_standings')
  );

  return (
    <div className="min-h-screen bg-[#0f1f3d] text-slate-100 flex flex-col justify-between selection:bg-orange-500 selection:text-white pb-8">
      <div>
        {/* Core Header Section */}
        <header className="px-6 pt-6 pb-5 bg-slate-900/40 border-b border-slate-800 flex justify-between items-center sticky top-0 z-35 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-orange-950/20 text-white">
              🏓
            </div>
            <div>
              <p className="text-orange-400 text-[10px] font-black uppercase tracking-widest leading-none">
                Joueur Connecté
              </p>
              <h2 className="text-base font-black text-white mt-1 leading-none">
                {playerData ? `${playerData.first_name} ${playerData.last_name}` : 'Mon Profil'}
              </h2>
              <p className="text-[10px] text-slate-500 font-bold mt-0.5 leading-none">
                {playerData?.club || 'Licencié de l\'événement'}
                {playerData?.points ? ` · ${playerData.points} pts` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshAll}
              className="p-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl active:scale-95 transition-all border border-slate-700/60"
              title="Actualiser les scores"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2.5 bg-red-950/20 hover:bg-red-950/40 text-red-400 hover:text-red-300 rounded-xl active:scale-95 transition-all border border-red-900/30"
              title="Se déconnecter"
            >
              <Power className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Dashboard urgent notification banner */}
        {urgent && <UrgentBanner notification={urgent} tournamentId={tournamentId || ''} />}

        {/* Matches lists */}
        <section className="px-4 mt-6">
          <div className="flex justify-between items-center mb-3 px-1">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-orange-400" />
              Mes Matchs / Planning
            </h3>
            {matches.length > 0 && (
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-extrabold font-mono">
                {matches.length}
              </span>
            )}
          </div>

          {loadingMatches ? (
            <div className="space-y-3">
              <div className="h-28 bg-slate-800/40 rounded-2xl animate-pulse" />
              <div className="h-28 bg-slate-800/40 rounded-2xl animate-pulse" />
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((m) => (
                <MatchCard key={m.id} match={m} playerId={player?.playerId || ''} tournamentId={tournamentId || ''} />
              ))}
              {matches.length === 0 && (
                <div className="bg-slate-800/25 border border-dashed border-slate-800 rounded-2xl p-8 text-center">
                  <p className="text-slate-500 text-xs font-semibold italic">Aucun match assigné dans cette phase pour le moment.</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Standings list */}
        {pool && (
          <section className="px-4 mt-8">
            <div className="flex justify-between items-center mb-3 px-1">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-orange-400" />
                Ma Poule — {pool.name}
              </h3>
              {pool.standings_status === 'awaiting_validation' && (
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded-full font-black animate-pulse uppercase tracking-wide border border-amber-500/30">
                  À signer
                </span>
              )}
            </div>

            {loadingPool ? (
              <div className="h-44 bg-slate-800/40 rounded-2xl animate-pulse" />
            ) : (
              <div className="space-y-3">
                <PoolStandingCard standing={standing} playerId={player?.playerId || ''} />

                {/* Specific Standing signature action link */}
                {pool.standings_status === 'awaiting_validation' && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4.5 text-center mt-3">
                    <p className="text-amber-400 text-xs font-extrabold uppercase tracking-wide flex justify-center items-center gap-1 mb-1">
                      <Sparkles className="w-3.5 h-3.5 animate-bounce" />
                      Validation de Poule Activée
                    </p>
                    <p className="text-slate-300 text-xs mb-3.5 leading-relaxed">
                      Tous les matchs sont validés ! Veuillez valider le classement définitif de votre poule ({pool.name}) pour entériner les qualifiés.
                    </p>
                    <button
                      onClick={() => navigate(`/player/${tournamentId}/pool/${pool.id}`)}
                      className="inline-flex justify-center items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-white font-extrabold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md active:scale-95"
                    >
                      Signer le Classement ✍️
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      <footer className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-600 opacity-60 mt-12">
        PingNet Player Portal v3 · Tous droits réservés
      </footer>
    </div>
  );
}
