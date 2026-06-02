import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTableMatch } from '../../hooks/useTableMatch';
import { Trophy, ArrowLeft, Plus, Minus, RotateCcw, AlertTriangle, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import OfflineBanner from '../../components/player/OfflineBanner';
import { isValidSetScore } from '../../utils/scoring';
import { supabase } from '../../supabase';

export default function TableView() {
  const { tableNumber } = useParams<{ tableNumber: string }>();
  const tableNum = parseInt(tableNumber || '0');
  const { match, loading, error, addSetScore, deleteLastSet, refresh } = useTableMatch(tableNum);
  
  const [newSet, setNewSet] = useState({ p1: 11, p2: 0 });
  const [saving, setSaving] = useState(false);
  const [lastPoolInfo, setLastPoolInfo] = useState<{
    pool: any;
    matches: any[];
    players: any[];
    standings: any[];
  } | null>(null);
  const [fetchingPool, setFetchingPool] = useState(false);

  const setsP1 = match?.sets?.filter(s => s.score_p1 > s.score_p2).length || 0;
  const setsP2 = match?.sets?.filter(s => s.score_p2 > s.score_p1).length || 0;

  const setsToWin = (match as any)?.tournament?.sets_to_win || 3;
  const pointsPerSet = (match as any)?.tournament?.points_per_set || 11;

  const fetchLastPoolData = async () => {
    try {
      setFetchingPool(true);
      // Trouver le dernier match de poule sur cette table pour connaître la poule gérée ici
      const { data: lastMatch, error: lastMatchError } = await supabase
        .from('matches')
        .select('pool_id')
        .eq('table_number', tableNum)
        .not('pool_id', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastMatchError) throw lastMatchError;

      if (lastMatch && lastMatch.pool_id) {
        const poolId = lastMatch.pool_id;

        const { data: poolData } = await supabase
          .from('pools')
          .select('*')
          .eq('id', poolId)
          .maybeSingle();

        const { data: poolMatches } = await supabase
          .from('matches')
          .select('*, sets(*)')
          .eq('pool_id', poolId);

        const { data: poolPlayers } = await supabase
          .from('pool_players')
          .select('player_id, players(*)')
          .eq('pool_id', poolId);

        if (poolData && poolMatches && poolPlayers) {
          const playersMap = new Map<string, any>();
          poolPlayers.forEach(pp => {
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

          poolMatches.forEach(m => {
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

          const sortedStandings = Array.from(playersMap.values()).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            const diffA = a.sets_won - a.sets_lost;
            const diffB = b.sets_won - b.sets_lost;
            if (diffB !== diffA) return diffB - diffA;
            if (b.sets_won !== a.sets_won) return b.sets_won - a.sets_won;
            return (b.points_scored - b.points_conceded) - (a.points_scored - a.points_conceded);
          });

          setLastPoolInfo({
            pool: poolData,
            matches: poolMatches,
            players: poolPlayers,
            standings: sortedStandings
          });
        }
      } else {
        setLastPoolInfo(null);
      }
    } catch (err) {
      console.error('Error fetching last pool data:', err);
    } finally {
      setFetchingPool(false);
    }
  };

  React.useEffect(() => {
    if (!match) {
      fetchLastPoolData();
    } else {
      setLastPoolInfo(null);
    }
  }, [match, tableNum]);

  React.useEffect(() => {
    if (pointsPerSet) {
      setNewSet(prev => ({ p1: pointsPerSet, p2: 0 }));
    }
  }, [pointsPerSet]);

  const handleAddSet = async () => {
    if (!isValidSetScore(newSet.p1, newSet.p2, pointsPerSet)) {
      toast.error(`Score invalide pour un set à ${pointsPerSet} points (il faut 2 points d'écart, ex: 11-9 ou 13-11) !`);
      return;
    }
    setSaving(true);
    try {
      await addSetScore(newSet.p1, newSet.p2);
      setNewSet({ p1: pointsPerSet, p2: 0 });
      toast.success('Set enregistré avec succès !');
    } catch (err: any) {
      console.error(err);
      toast.error('Erreur d\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLastSet = async () => {
    if (window.confirm('Voulez-vous vraiment effacer le dernier set enregistré ?')) {
      try {
        await deleteLastSet();
        toast.success('Dernier set effacé');
      } catch (err) {
        toast.error('Erreur lors de la suppression');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-bold">Chargement de la Table {tableNum}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <AlertTriangle className="w-16 h-16 text-orange-500 mb-6 animate-pulse" />
        <h2 className="text-2xl font-black mb-4">Problème de connexion</h2>
        <p className="text-slate-400 max-w-sm mb-8">
          Impossible de se connecter à la base de données.
        </p>
        <button 
          onClick={refresh}
          className="px-6 py-3 bg-orange-600 rounded-xl font-bold hover:bg-orange-500 transition-colors"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!match) {
    const remainingMatches = lastPoolInfo?.matches.filter(m => m.status !== 'finished') || [];
    const hasRemainingMatches = lastPoolInfo ? remainingMatches.length > 0 : false;

    // Map players to match names
    const playersMap = new Map<string, any>();
    lastPoolInfo?.players.forEach(pp => {
      if (pp.players) {
        const pData = Array.isArray(pp.players) ? pp.players[0] : pp.players;
        if (pData) {
          playersMap.set(pp.player_id, pData);
        }
      }
    });

    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center p-4 pt-12 text-white">
        <OfflineBanner />
        <header className="w-full max-w-md flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white font-black italic">TT</div>
            <h1 className="text-xl font-black tracking-tight">TABLE {tableNum}</h1>
          </div>
          <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full border ${hasRemainingMatches ? 'bg-orange-950/40 text-orange-400 border-orange-500/30' : 'bg-green-950/40 text-green-400 border-green-500/30'}`}>
            {hasRemainingMatches ? 'En Poule' : 'Libre'}
          </span>
        </header>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-md bg-slate-800 rounded-[2.5rem] shadow-2xl border border-slate-700/80 p-8 text-center flex flex-col items-stretch relative overflow-hidden"
        >
          {lastPoolInfo && !hasRemainingMatches ? (
            // POULE TERMINÉE : AFFICHE LE CLASSEMENT DE LA POULE !
            <div className="space-y-6">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20">
                <Trophy className="w-8 h-8 text-green-500 animate-bounce" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-green-400 tracking-widest block mb-1">Poule Complétée</span>
                <h2 className="text-2xl font-black tracking-tight text-white">{lastPoolInfo.pool?.name || 'Poule'}</h2>
                <p className="text-xs text-slate-400 mt-1">Tous les matchs de cette poule sont terminés.</p>
              </div>

              {/* Tableau de classement */}
              <div className="overflow-hidden border border-slate-700/50 rounded-2xl divide-y divide-slate-700/50 bg-slate-900/40 text-left mt-4">
                <div className="grid grid-cols-12 text-[9px] font-black uppercase tracking-wider px-3.5 py-2.5 text-slate-500 bg-slate-900/70">
                  <span className="col-span-1">#</span>
                  <span className="col-span-6">Joueur</span>
                  <span className="col-span-2 text-center">Vic.</span>
                  <span className="col-span-1 text-center">Pts</span>
                  <span className="col-span-2 text-right">Sets</span>
                </div>

                {lastPoolInfo.standings.map((standing, idx) => {
                  const diffSets = standing.sets_won - standing.sets_lost;
                  return (
                    <div 
                      key={standing.player_id}
                      className="grid grid-cols-12 text-xs px-3.5 py-3 items-center text-slate-300 hover:bg-slate-700/40 transition-colors"
                    >
                      <span className="col-span-1 font-black text-orange-400">#{idx + 1}</span>
                      <span className="col-span-6 pr-1 truncate font-bold text-white">
                        {standing.last_name} {standing.first_name}
                        <span className="block text-[8px] text-slate-500 font-medium truncate">{standing.club || 'Club Libre'}</span>
                      </span>
                      <span className="col-span-2 text-center font-bold text-slate-400">{standing.wins}</span>
                      <span className="col-span-1 text-center font-black text-orange-400">{standing.points}</span>
                      <span className="col-span-2 text-right font-bold text-slate-300">
                        {diffSets > 0 ? `+${diffSets}` : diffSets}
                      </span>
                    </div>
                  );
                })}
              </div>

              <button 
                onClick={async () => {
                  setSaving(true);
                  await refresh();
                  await fetchLastPoolData();
                  setSaving(false);
                  toast.success('Données réactualisées');
                }}
                disabled={saving}
                className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all text-sm cursor-pointer"
              >
                <RotateCcw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
                Actualiser la table
              </button>
            </div>
          ) : (
            // RESTE DES MATCHS OU GENERAL : Affiche Prête à jouer avec Bouton Mise à jour en auto !
            <div className="space-y-6">
              <div className="w-16 h-16 bg-slate-705/10 rounded-full flex items-center justify-center mx-auto border border-slate-600/30">
                <Play className="w-7 h-7 text-slate-400 ml-1" />
              </div>
              
              <div>
                {lastPoolInfo && (
                  <span className="px-3 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[9px] font-black uppercase tracking-widest rounded-full inline-block mb-3">
                    Poule : {lastPoolInfo.pool?.name}
                  </span>
                )}
                <h2 className="text-2xl font-black mb-2 text-white">Prête à jouer</h2>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
                  En attente du prochain match assigné par la table de marque.
                </p>
              </div>

              {/* Bouton Mise à jour en auto */}
              <div className="pt-2">
                <button 
                  onClick={async () => {
                    setSaving(true);
                    await refresh();
                    await fetchLastPoolData();
                    setSaving(false);
                    toast.success('Données actualisées !');
                  }}
                  disabled={saving}
                  className="w-full py-4 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black rounded-2xl shadow-md flex items-center justify-center gap-3 active:scale-95 transition-all cursor-pointer text-sm font-bold tracking-tight border border-orange-400/20"
                >
                  <RotateCcw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
                  Mise à jour en auto
                </button>
              </div>

              {/* Liste des matches restants en bonus pour guider les joueurs */}
              {lastPoolInfo && remainingMatches.length > 0 && (
                <div className="pt-4 border-t border-slate-705/35 text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 text-center">
                    Matchs restants dans la poule ({remainingMatches.length})
                  </p>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {remainingMatches.map((m) => {
                      const p1 = playersMap.get(m.player1_id);
                      const p2 = playersMap.get(m.player2_id);
                      return (
                        <div key={m.id} className="bg-slate-900/40 border border-slate-800 p-2 rounded-xl flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-bold truncate">
                            {p1 ? p1.last_name : '...'} - {p2 ? p2.last_name : '...'}
                          </span>
                          <span className="text-[9px] px-2 py-0.5 rounded bg-slate-800 text-slate-500 uppercase font-black tracking-wider">
                            {m.status === 'in_progress' ? 'En cours' : 'En attente'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!lastPoolInfo && (
                <div className="p-4 bg-slate-900/50 rounded-2xl text-[9px] text-slate-500 font-black uppercase tracking-widest leading-loose">
                  Mise à jour automatique en arrière-plan
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col p-4">
      <OfflineBanner />
      <header className="w-full max-w-md mx-auto flex justify-between items-center py-4 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white font-black italic text-sm">TT</div>
          <h1 className="text-lg font-black tracking-tight">TABLE {tableNum}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-black uppercase text-orange-400">Match en Direct</span>
        </div>
      </header>

      <main className="w-full max-w-md mx-auto space-y-4 flex-1 flex flex-col">
        {/* Scoreboard global du match */}
        <div className="bg-slate-800 rounded-[2rem] p-6 shadow-2xl border border-slate-700 relative overflow-hidden">
          <div className="flex justify-between items-center relative z-10">
            {/* Joueur 1 */}
            <div className="text-center flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Joueur 1</p>
              <p className="text-base font-black truncate text-white">{match.player1?.last_name || 'Inconnu'}</p>
              <p className="text-xs text-slate-400 truncate mt-0.5">{match.player1?.first_name || ''}</p>
            </div>
            
            {/* Score des sets */}
            <div className="px-6 text-center">
              <div className="flex items-center justify-center gap-4">
                <span className={`text-4xl font-extrabold tracking-tighter ${setsP1 >= setsToWin ? 'text-orange-500' : 'text-slate-100'}`}>{setsP1}</span>
                <span className="text-xl font-bold text-slate-600">—</span>
                <span className={`text-4xl font-extrabold tracking-tighter ${setsP2 >= setsToWin ? 'text-orange-500' : 'text-slate-100'}`}>{setsP2}</span>
              </div>
              <div className="bg-slate-900/50 px-3 py-0.5 rounded-full mt-2 border border-slate-700/50">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sets (Objectif {setsToWin})</p>
              </div>
            </div>

            {/* Joueur 2 */}
            <div className="text-center flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Joueur 2</p>
              <p className="text-base font-black truncate text-white">{match.player2?.last_name || 'Inconnu'}</p>
              <p className="text-xs text-slate-400 truncate mt-0.5">{match.player2?.first_name || ''}</p>
            </div>
          </div>
        </div>

        {/* Historique des sets enregistrés */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
          <div className="flex gap-2 overflow-x-auto py-1 flex-1 pr-2 scrollbar-none">
            {match.sets && match.sets.length > 0 ? (
              match.sets.map((s, idx) => (
                <div 
                  key={s.id} 
                  className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-bold text-slate-300 whitespace-nowrap"
                >
                  Set {idx + 1} : <span className={s.score_p1 > s.score_p2 ? 'text-orange-400' : 'text-white'}>{s.score_p1}</span> - <span className={s.score_p2 > s.score_p1 ? 'text-orange-400' : 'text-white'}>{s.score_p2}</span>
                </div>
              ))
            ) : (
              <span className="text-xs text-slate-500 italic pl-1">Aucun set enregistré. Match en cours...</span>
            )}
          </div>
          {match.sets && match.sets.length > 0 && (
            <button
              onClick={handleDeleteLastSet}
              className="text-xs text-red-400 font-bold h-full hover:text-red-300 px-2 py-1 bg-red-950/30 rounded-lg hover:bg-red-950/50 border border-red-500/20 active:scale-95 transition-all outline-none shrink-0"
              title="Effacer le dernier set"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Saisie interactive du set en cours */}
        <div className="bg-white rounded-[2rem] p-6 shadow-xl flex-1 flex flex-col justify-between">
          <h3 className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
            Saisie du Set {match.sets && match.sets.length ? match.sets.length + 1 : 1}
          </h3>
          
          <div className="grid grid-cols-2 gap-6 flex-1 items-center">
            {/* Saisie Joueur 1 */}
            <div className="text-center space-y-4">
              <span className="text-xs font-bold text-slate-500 truncate block">{match.player1?.last_name || 'Joueur 1'}</span>
              <div className="flex flex-col items-center gap-3">
                <button 
                  onClick={() => setNewSet({...newSet, p1: newSet.p1 + 1})} 
                  className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white active:scale-90 transition-transform shadow-md cursor-pointer"
                >
                  <Plus className="w-6 h-6" />
                </button>
                <span className="text-6xl font-black text-slate-900 tabular-nums italic">{newSet.p1}</span>
                <button 
                  onClick={() => setNewSet({...newSet, p1: Math.max(0, newSet.p1 - 1)})} 
                  className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center border border-slate-200 active:scale-95 cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Saisie Joueur 2 */}
            <div className="text-center space-y-4">
              <span className="text-xs font-bold text-slate-500 truncate block">{match.player2?.last_name || 'Joueur 2'}</span>
              <div className="flex flex-col items-center gap-3">
                <button 
                  onClick={() => setNewSet({...newSet, p2: newSet.p2 + 1})} 
                  className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white active:scale-90 transition-transform shadow-md cursor-pointer"
                >
                  <Plus className="w-6 h-6" />
                </button>
                <span className="text-6xl font-black text-slate-900 tabular-nums italic">{newSet.p2}</span>
                <button 
                  onClick={() => setNewSet({...newSet, p2: Math.max(0, newSet.p2 - 1)})} 
                  className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center border border-slate-200 active:scale-95 cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button 
              onClick={handleAddSet}
              disabled={saving}
              className="w-full py-4.5 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Synchronisation...' : 'Valider le Set'}
            </button>
          </div>
        </div>
      </main>

      <footer className="mt-6 text-center text-slate-600 pb-2">
        <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Ping Manager • Saisie simplifiée instantanée</p>
      </footer>
    </div>
  );
}
