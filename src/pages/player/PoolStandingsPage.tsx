import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';
import { Trophy, CheckCircle2, ShieldEllipsis, AlertCircle, ArrowLeft, Users, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

export default function PoolStandingsPage() {
  const { token, poolId } = useParams<{ token: string; poolId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [pool, setPool] = useState<any | null>(null);
  const [poolStandings, setPoolStandings] = useState<any[]>([]);
  const [poolPlayers, setPoolPlayers] = useState<any[]>([]);
  const [identity, setIdentity] = useState<{ id: string; name: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [terminating, setTerminating] = useState(false);

  const fetchPoolData = async (silent = false) => {
    if (!token || !poolId) {
      setError("Paramètres de poule manquants");
      setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);

      // Étape 1 — Identifier le joueur via le token
      const { data: tokenRow, error: tokenError } = await supabase
        .from('player_tokens')
        .select('player_id, players(first_name, last_name)')
        .eq('token', token.trim())
        .maybeSingle();

      if (tokenError) throw tokenError;
      if (!tokenRow) {
        setError("Token d'accès invalide ou expiré");
        setLoading(false);
        return;
      }

      const playerId = tokenRow.player_id;
      const playersObj = Array.isArray(tokenRow.players) ? tokenRow.players[0] : tokenRow.players;
      const playerName = playersObj 
        ? `${(playersObj as any).first_name} ${(playersObj as any).last_name}`
        : "Joueur";

      setIdentity({ id: playerId, name: playerName });

      // Étape 2 — Charger la poule
      const { data: poolData, error: poolError } = await supabase
        .from('pools')
        .select('*')
        .eq('id', poolId)
        .maybeSingle();

      if (poolError) throw poolError;
      if (!poolData) {
        setError("Poule introuvable");
        setLoading(false);
        return;
      }

      setPool(poolData);

      // Étape 3 — Charger tous les joueurs de cette poule
      const { data: myPoolPlayers, error: myPoolPlayersError } = await supabase
        .from('pool_players')
        .select('player_id, players(*)')
        .eq('pool_id', poolId);

      if (myPoolPlayersError) throw myPoolPlayersError;
      setPoolPlayers(myPoolPlayers || []);

      // Vérifier si le joueur fait bien partie de cette poule
      const isInPool = myPoolPlayers?.some(pp => pp.player_id === playerId);
      if (!isInPool) {
        setError("Accès refusé : vous ne faites pas partie de cette poule. Anti-triche actif.");
        setLoading(false);
        return;
      }

      // Étape 4 — Charger tous les matchs de cette poule
      const { data: poolMatches, error: matchesError } = await supabase
        .from('matches')
        .select('*, sets(*)')
        .eq('pool_id', poolId);

      if (matchesError) throw matchesError;

      // Calculer le classement de la poule en temps réel
      const playersMap = new Map<string, any>();
      myPoolPlayers?.forEach(pp => {
        if (pp.players) {
          const pData = Array.isArray(pp.players) ? pp.players[0] : pp.players;
          if (pData) {
            playersMap.set(pp.player_id, {
              player_id: pp.player_id,
              first_name: (pData as any).first_name,
              last_name: (pData as any).last_name,
              club: (pData as any).club,
              wins: 0,
              losses: 0,
              sets_won: 0,
              sets_lost: 0,
              points_scored: 0,
              points_conceded: 0,
              points_fftt: (pData as any).points || 500,
              points: 0,
              matches_played: 0
            });
          }
        }
      });

      poolMatches?.forEach(m => {
        if (m.status === 'finished') {
          const setsP1 = m.sets?.filter((s: any) => s.score_p1 > s.score_p2).length || 0;
          const setsP2 = m.sets?.filter((s: any) => s.score_p2 > s.score_p1).length || 0;

          const p1 = playersMap.get(m.player1_id || '');
          const p2 = playersMap.get(m.player2_id || '');

          if (p1) {
            p1.matches_played += 1;
            p1.sets_won += setsP1;
            p1.sets_lost += setsP2;
            p1.points_scored += m.sets?.reduce((acc: number, s: any) => acc + s.score_p1, 0) || 0;
            p1.points_conceded += m.sets?.reduce((acc: number, s: any) => acc + s.score_p2, 0) || 0;
            if (setsP1 > setsP2) {
              p1.points += 2;
              p1.wins += 1;
            } else {
              p1.losses += 1;
            }
          }
          if (p2) {
            p2.matches_played += 1;
            p2.sets_won += setsP2;
            p2.sets_lost += setsP1;
            p2.points_scored += m.sets?.reduce((acc: number, s: any) => acc + s.score_p2, 0) || 0;
            p2.points_conceded += m.sets?.reduce((acc: number, s: any) => acc + s.score_p1, 0) || 0;
            if (setsP2 > setsP1) {
              p2.points += 2;
              p2.wins += 1;
            } else {
              p2.losses += 1;
            }
          }
        }
      });

      // Appliquer les règles officielles de tri de la FFTT
      const sorted = Array.from(playersMap.values()).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const diffA = a.sets_won - a.sets_lost;
        const diffB = b.sets_won - b.sets_lost;
        if (diffB !== diffA) return diffB - diffA;
        if (b.sets_won !== a.sets_won) return b.sets_won - a.sets_won;
        return (b.points_scored - b.points_conceded) - (a.points_scored - a.points_conceded);
      });

      setPoolStandings(sorted);

    } catch (err: any) {
      console.error(err);
      setError("Erreur de chargement des résultats de la poule");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoolData();

    if (!poolId) return;
    const channel = supabase
      .channel(`pool_standings_${poolId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pools', filter: `id=eq.${poolId}` }, () => fetchPoolData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `pool_id=eq.${poolId}` }, () => fetchPoolData(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [token, poolId]);

  // Compte à rebours
  useEffect(() => {
    if (!pool || pool.status !== 'awaiting_validation' || !pool.awaiting_validation_since) {
      setTimeLeft(null);
      return;
    }

    const checkTime = () => {
      const since = new Date(pool.awaiting_validation_since).getTime();
      const now = new Date().getTime();
      const elapsed = (now - since) / 1000;
      const left = Math.max(0, 120 - Math.floor(elapsed));
      setTimeLeft(left);

      if (left <= 0) {
        // Validation automatique forcée
        handleForcePoolValidation();
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [pool?.id, pool?.status, pool?.awaiting_validation_since]);

  const handleValidatePool = async () => {
    if (!pool || !identity) return;
    setTerminating(true);

    try {
      const currentValidated = pool.validated_by || [];
      if (!currentValidated.includes(identity.id)) {
        const nextValidated = [...currentValidated, identity.id];
        const isCompleted = nextValidated.length >= poolPlayers.length;

        const { error: updError } = await supabase
          .from('pools')
          .update({
            validated_by: nextValidated,
            status: isCompleted ? 'finished' : 'awaiting_validation',
            ...(isCompleted ? { table_number: null } : {})
          })
          .eq('id', pool.id);

        if (updError) throw updError;

        if (isCompleted) {
          // Mettre également le table_number de tous les matchs de cette poule à null car elle est terminée
          await supabase
            .from('matches')
            .update({ table_number: null })
            .eq('pool_id', pool.id);
        }

        toast.success(isCompleted ? "Poule entièrement validée !" : "Validation enregistrée.");
      } else {
        toast.success("Vous avez déjà validé cette poule.");
      }

      navigate(`/player/${token}`);
    } catch (err) {
      toast.error("Erreur de validation");
    } finally {
      setTerminating(false);
    }
  };

  const handleContestPool = async () => {
    if (!pool) return;
    setTerminating(true);

    try {
      // Pour une contestation, on peut marquer la poule sous un statut 'disputed' ou similaire
      const { error: updError } = await supabase
        .from('pools')
        .update({ status: 'disputed' })
        .eq('id', pool.id);

      if (updError) throw updError;

      toast.success("Contestation prise en compte par le Juge-Arbitre.");
      navigate(`/player/${token}`);
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement de la contestation");
    } finally {
      setTerminating(false);
    }
  };

  const handleForcePoolValidation = async () => {
    if (!pool || pool.status !== 'awaiting_validation') return;

    try {
      await supabase
        .from('pools')
        .update({
          status: 'finished',
          validated_by: poolPlayers.map(p => p.player_id),
          table_number: null
        })
        .eq('id', pool.id);

      // Mettre également le table_number de tous les matchs de cette poule à null car elle est terminée
      await supabase
        .from('matches')
        .update({ table_number: null })
        .eq('pool_id', pool.id);

      navigate(`/player/${token}`);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center p-6 pt-12 text-white text-center">
        <div className="w-20 h-20 bg-red-900/30 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-bold mb-4">Erreur d'accès</h2>
        <p className="text-slate-400 mb-8 max-w-sm text-sm">{error}</p>
        <button 
          onClick={() => navigate(`/player/${token}`)}
          className="px-6 py-2.5 bg-slate-800 rounded-xl font-bold text-sm hover:bg-slate-700 text-white"
        >
          Retourner à mon Espace
        </button>
      </div>
    );
  }

  const iHaveValidated = pool?.validated_by?.includes(identity?.id || '');

  return (
    <div className="min-h-screen bg-slate-50 pb-12 font-sans text-slate-800 flex flex-col">
      <header className="bg-[#0f1f3d] text-white py-4 px-4 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/player/${token}`)}
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center transition-all cursor-pointer text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-black uppercase tracking-wider">Validation du Classement</h1>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-300 block">Connecté en tant que</span>
          <span className="text-xs font-extrabold text-indigo-400">{identity?.name}</span>
        </div>
      </header>

      <main className="max-w-md w-full mx-auto p-4 space-y-4 flex-1">
        {/* Standings computed */}
        <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Users className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">{pool?.name}</h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Classement calculé officiel</p>
            </div>
          </div>

          <div className="overflow-hidden border border-slate-100 rounded-xl divide-y divide-slate-100">
            <div className="grid grid-cols-12 bg-slate-50 text-[9px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5 text-left">
              <span className="col-span-1">Rang</span>
              <span className="col-span-6">Joueur</span>
              <span className="col-span-2 text-center">G/P</span>
              <span className="col-span-1 text-center">Pts</span>
              <span className="col-span-2 text-right">Diff Sets</span>
            </div>

            {poolStandings.map((standing, idx) => {
              const isMe = standing.player_id === identity?.id;
              return (
                <div 
                  key={standing.player_id}
                  className={`grid grid-cols-12 text-xs px-3 py-2.5 items-center ${isMe ? 'bg-[#f97316]/10 text-slate-900 font-bold border-l-2 border-l-[#f97316]' : 'text-slate-750'}`}
                >
                  <span className="col-span-1 font-extrabold text-[#f97316]">#{idx + 1}</span>
                  <span className="col-span-6 pr-2 truncate">
                    {standing.last_name} {standing.first_name} {isMe && '⭐'}
                    <span className="block text-[8px] text-slate-400 font-medium truncate">{standing.club || 'Club Libre'}</span>
                  </span>
                  <span className="col-span-2 text-center font-bold text-slate-500">{standing.wins}W - {standing.losses}L</span>
                  <span className="col-span-1 text-center font-extrabold text-indigo-600">{standing.points}</span>
                  <span className="col-span-2 text-right font-black font-mono text-slate-700">
                    {standing.sets_won - standing.sets_lost > 0 ? `+${standing.sets_won - standing.sets_lost}` : standing.sets_won - standing.sets_lost}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeout */}
        {timeLeft !== null && timeLeft > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-amber-500 tracking-widest block animate-pulse">⏰ Temps restant de validation</span>
            <p className="text-xl font-black text-amber-800 tabular-nums font-mono">{timeLeft} s</p>
            <p className="text-[9px] text-amber-600 font-medium leading-relaxed">Sans objection à la fin du chrono, le classement est considéré validé automatiquement.</p>
          </div>
        )}

        {/* Signatures status */}
        <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-black text-slate-400 tracking-widest uppercase pb-2 border-b border-slate-100">Signatures de la Poule</h2>
          <div className="space-y-2">
            {poolPlayers.map(pp => {
              const hasSigned = pool?.validated_by?.includes(pp.player_id);
              return (
                <div key={pp.player_id} className="flex justify-between items-center text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-700">{pp.players?.first_name} {pp.players?.last_name}</span>
                  {hasSigned ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 text-green-700 text-[10px] font-black uppercase rounded-md border border-green-500/20">
                      Signé
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-200 text-slate-500 text-[10px] font-black uppercase rounded-md border border-slate-300">
                      En attente
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action zone */}
        {pool?.status === 'awaiting_validation' && (
          <div className="space-y-3">
            {iHaveValidated ? (
              <div className="bg-green-50 border border-green-200 text-green-800 rounded-2xl p-5 text-center font-bold text-sm">
                 ✓ Votre signature a été enregistrée.<br/>
                 <span className="text-xs font-medium text-green-600">En attente de la signature des autres participants.</span>
              </div>
            ) : (
              <button
                onClick={handleValidatePool}
                disabled={terminating}
                className="w-full py-4.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-2xl text-base shadow-lg shadow-indigo-100 flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {terminating ? "Envoi..." : "✓ Valider et Signer le Classement"}
              </button>
            )}

            <button
              onClick={handleContestPool}
              disabled={terminating}
              className="w-full py-4 bg-white border-2 border-red-200 hover:bg-red-50 text-red-600 font-extrabold rounded-2xl text-sm transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              ⚠️ Signaler une Contestation
            </button>
          </div>
        )}

        {pool?.status === 'disputed' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center space-y-2">
            <ShieldEllipsis className="w-10 h-10 text-red-500 mx-auto" />
            <h3 className="text-sm font-black text-red-800 uppercase">Classement Contesté</h3>
            <p className="text-xs text-red-600 leading-relaxed">Contestation prise en compte. Des arbitres de la table principale vont se déplacer pour auditer le classement.</p>
          </div>
        )}
      </main>
    </div>
  );
}
