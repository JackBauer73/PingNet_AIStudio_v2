import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { useTournament } from '../../hooks/useTournament';
import { 
  Trophy, 
  Play, 
  RefreshCw, 
  X, 
  Grid3X3, 
  Check, 
  AlertTriangle, 
  Coffee, 
  User, 
  ArrowRight,
  ShieldAlert,
  Inbox
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

export default function Tables() {
  const { tournament } = useTournament();
  const [pools, setPools] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningTable, setAssigningTable] = useState<number | null>(null);
  const [movingTable, setMovingTable] = useState<number | null>(null);

  const fetchTablesData = async (silent = false) => {
    if (!tournament?.id) return;
    try {
      if (!silent) setLoading(true);

      // Fetch pools
      const { data: poolsRes, error: poolsErr } = await supabase
        .from('pools')
        .select('*')
        .eq('tournament_id', tournament.id);

      if (poolsErr) throw poolsErr;

      // Fetch active & pending matches with players and sets across all rounds
      const { data: matchesRes, error: matchesErr } = await supabase
        .from('matches')
        .select('*, player1:player1_id(*), player2:player2_id(*), sets(*)')
        .eq('tournament_id', tournament.id)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (matchesErr) throw matchesErr;

      // Sort sets within each match
      const sortedMatches = (matchesRes || []).map((m: any) => ({
        ...m,
        sets: (m.sets || []).sort((a: any, b: any) => (a.set_number || 0) - (b.set_number || 0))
      }));

      setPools(poolsRes || []);
      setMatches(sortedMatches);
    } catch (err) {
      console.error('Error fetching tables data:', err);
      toast.error('Erreur lors du rafraîchissement des tables.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTablesData();

    if (!tournament?.id) return;

    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const channel = supabase
      .channel(`tables_manager_${tournament.id}_${randomSuffix}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournament.id}` }, () => fetchTablesData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sets' }, () => fetchTablesData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pools', filter: `tournament_id=eq.${tournament.id}` }, () => fetchTablesData(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournament?.id]);

  // Libérer une table
  const handleReleaseTable = async (poolId: string, tableNum: number) => {
    try {
      // 1. Enlever la table de la poule
      await supabase
        .from('pools')
        .update({ table_number: null })
        .eq('id', poolId);

      // 2. Enlever la table de tous les matchs en cours de cette poule
      await supabase
        .from('matches')
        .update({ table_number: null, status: 'pending' })
        .eq('pool_id', poolId)
        .eq('status', 'in_progress');

      toast.success(`La table ${tableNum} a été libérée.`);
      fetchTablesData(true);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la libération de la table.');
    }
  };

  // Assigner une poule à une table
  const handleAssignPoolToTable = async (poolId: string, tableNum: number) => {
    try {
      // Vérifier si cette table est déjà occupée par une autre poule non terminée
      const alreadyOccupied = pools.some(p => p.status !== 'finished' && Number(p.table_number) === Number(tableNum));
      if (alreadyOccupied) {
        toast.error(`La table ${tableNum} est déjà occupée par une autre poule.`);
        return;
      }

      // Mettre à jour la poule
      await supabase
        .from('pools')
        .update({ table_number: tableNum })
        .eq('id', poolId);

      // Mettre à jour également tous les matchs en cours ou en attente s'ils doivent s'appliquer
      await supabase
        .from('matches')
        .update({ table_number: tableNum })
        .eq('pool_id', poolId)
        .eq('status', 'in_progress');

      toast.success(`Poule assignée à la Table ${tableNum} !`);
      setAssigningTable(null);
      fetchTablesData(true);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'assignation.");
    }
  };

  // Assigner un match de tableau final à une table et le lancer
  const handleAssignBracketMatchToTable = async (matchId: string, tableNum: number) => {
    try {
      const alreadyOccupied = matches.some(m => m.status === 'in_progress' && Number(m.table_number) === Number(tableNum)) ||
                              pools.some(p => p.status !== 'finished' && !p.name.includes('Bracket') && Number(p.table_number) === Number(tableNum));
      if (alreadyOccupied) {
        toast.error(`La table ${tableNum} est déjà occupée.`);
        return;
      }

      await supabase
        .from('matches')
        .update({
          table_number: tableNum,
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .eq('id', matchId);

      toast.success(`Match de phase finale lancé sur la Table ${tableNum} !`);
      setAssigningTable(null);
      fetchTablesData(true);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors du lancement du match de phase finale.");
    }
  };

  // Déplacer une poule vers une autre table
  const handleMovePoolToTable = async (poolId: string, oldTableNum: number, newTableNum: number) => {
    try {
      // Vérifier si la nouvelle table est libre
      const targetOccupied = pools.some(p => p.status !== 'finished' && Number(p.table_number) === Number(newTableNum));
      if (targetOccupied) {
        toast.error(`La table ${newTableNum} est occupée.`);
        return;
      }

      // Mettre à jour la poule ancienne
      await supabase
        .from('pools')
        .update({ table_number: newTableNum })
        .eq('id', poolId);

      // Mettre à jour les matchs en cours pour utiliser la nouvelle table
      await supabase
        .from('matches')
        .update({ table_number: newTableNum })
        .eq('pool_id', poolId)
        .eq('status', 'in_progress');

      toast.success(`Poule déplacée de la table ${oldTableNum} vers la table ${newTableNum}.`);
      setMovingTable(null);
      fetchTablesData(true);
    } catch (err) {
      console.error(err);
      toast.error('Erreur de déplacement.');
    }
  };

  // Lancer le premier match en attente d'une poule sur une table
  const handleLaunchPoolMatch = async (poolId: string, tableNum: number) => {
    try {
      const pendingMatches = matches.filter(m => m.pool_id === poolId && m.status === 'pending');
      if (pendingMatches.length === 0) {
        toast.error("Il n'y a plus aucun match en attente pour cette poule.");
        return;
      }

      const matchToLaunch = pendingMatches[0];

      await supabase.from('matches').update({
        table_number: tableNum,
        status: 'in_progress',
        started_at: new Date().toISOString()
      }).eq('id', matchToLaunch.id);

      await supabase.from('pools').update({ status: 'in_progress' }).eq('id', poolId);

      toast.success(`🏓 Match de poule lancé sur la Table ${tableNum} !`);
      fetchTablesData(true);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du lancement du match.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-500 font-mono">Chargement des tables en temps réel...</p>
      </div>
    );
  }

  const nbTables = tournament?.nb_tables || 0;
  const tablesArray = Array.from({ length: nbTables }, (_, i) => i + 1);

  const getRoundLabel = (round: string) => {
    switch (round) {
      case 'thirtysecondfinal': return '32es de finale';
      case 'sixteenthfinal': return '16es de finale';
      case 'eighthfinal': return '8es de finale';
      case 'quarterfinal': return 'Quarts de finale';
      case 'semifinal': return 'Demi-finales';
      case 'final': return 'Finale';
      case '3rd_place': return 'Petite Finale (3e place)';
      default: return 'Tableau de Phase Finale';
    }
  };

  // Helper pour savoir si une table est occupée
  const isTableOccupied = (tableNum: number) => {
    const activeMatch = matches.find(
      m => m.status === 'in_progress' && Number(m.table_number) === Number(tableNum)
    );
    let activePool = pools.find(
      p => p.status !== 'finished' && !p.name.includes('Bracket') && Number(p.table_number) === Number(tableNum)
    );
    if (!activePool && activeMatch?.pool_id) {
      activePool = pools.find(p => p.id === activeMatch?.pool_id);
    }
    if (activePool && activePool.name.includes('Bracket')) {
      activePool = undefined;
    }
    if (activePool) {
      const poolMatches = matches.filter(m => m.pool_id === activePool.id);
      const hasMatchesRemaining = poolMatches.some(
        m => m.status === 'pending' || m.status === 'in_progress'
      );
      if (!hasMatchesRemaining && poolMatches.length > 0) {
        activePool = undefined;
      }
    }
    return !!activeMatch || !!activePool;
  };

  const occupiedTablesCount = tablesArray.filter(isTableOccupied).length;
  const freeTablesCount = nbTables - occupiedTablesCount;

  // Pools non terminées et sans table
  const unassignedPools = pools.filter(p => {
    if (p.status === 'finished' || p.table_number || p.name.includes('Bracket')) return false;
    const poolMatches = matches.filter(m => m.pool_id === p.id);
    const hasMatchesRemaining = poolMatches.some(m => m.status === 'pending' || m.status === 'in_progress');
    if (poolMatches.length > 0 && !hasMatchesRemaining) {
      return false;
    }
    return true;
  });

  // Matchs de tableau final prêts à être lancés (en attente, avec 2 joueurs qualifiés)
  const readyBracketMatches = matches.filter(m => 
    m.round !== 'pool' && 
    m.status === 'pending' && 
    m.player1_id && 
    m.player2_id && 
    !m.table_number
  );

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in pb-16">
      {/* En-tête de la page */}
      <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 border-l-4 border-indigo-500 pl-4">
            Gestion des Tables
          </h1>
          <p className="text-slate-500 mt-1 pl-4">
            Affectations en temps réel, mouvements de tables et suivi direct des matchs.
          </p>
        </div>
        <button 
          onClick={() => fetchTablesData()}
          className="self-start md:self-auto flex items-center gap-2 px-4 py-2 border border-slate-200 hover:border-slate-300 text-slate-650 hover:text-slate-950 font-bold text-xs bg-white rounded-xl transition-all shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Réactualiser
        </button>
      </div>

      {/* Widgets Stats en Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
            <Grid3X3 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Tables</span>
            <span className="text-2xl font-black text-slate-800">{nbTables}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
            <Play className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Tables Occupées</span>
            <span className="text-2xl font-black text-slate-800">
              {occupiedTablesCount}
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <Coffee className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Tables Libres</span>
            <span className="text-2xl font-black text-slate-800">
              {freeTablesCount}
            </span>
          </div>
        </div>
      </div>

      {/* Alerte Poules Sans Tables */}
      {unassignedPools.length > 0 && (
        <div className="bg-amber-50/50 border border-amber-200/60 text-slate-800 p-5 rounded-[2rem] flex items-start gap-4 shadow-sm">
          <div className="p-2.5 bg-amber-100/80 text-amber-700 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="font-extrabold text-sm text-slate-850">Poules en attente d'attribution ({unassignedPools.length})</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Des poules ne sont affectées à aucune table de jeu. Assignez-les à des tables libres pour commencer l'arbitrage.
            </p>
            <div className="flex flex-wrap gap-2 mt-3.5">
              {unassignedPools.map(pool => (
                <span 
                  key={pool.id} 
                  className="px-3 py-1.5 bg-white border border-amber-200 text-[11px] font-bold text-slate-700 rounded-xl shadow-xs"
                >
                  {pool.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grille des Tables */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tablesArray.map((tableNum) => {
          // Trouver s'il y a un match en cours sur cette table
          const activeMatch = matches.find(
            m => m.status === 'in_progress' && Number(m.table_number) === Number(tableNum)
          );

          // Trouver s'il y a une poule active affectée à cette table
          let activePool = pools.find(
            p => p.status !== 'finished' && !p.name.includes('Bracket') && Number(p.table_number) === Number(tableNum)
          );

          // Si on n'a pas de poule active explicitement assignée à cette table, mais qu'un match actif de poule s'y joue
          if (!activePool && activeMatch?.pool_id) {
            activePool = pools.find(p => p.id === activeMatch.pool_id);
          }

          // Ne jamais traiter le pool fictif de bracket comme une vraie activePool
          if (activePool && activePool.name.includes('Bracket')) {
            activePool = undefined;
          }

          // Si on a une poule active, vérifier s'il reste des matchs à jouer
          if (activePool) {
            const poolMatches = matches.filter(m => m.pool_id === activePool.id);
            const hasMatchesRemaining = poolMatches.some(
              m => m.status === 'pending' || m.status === 'in_progress'
            );
            if (!hasMatchesRemaining && poolMatches.length > 0) {
              activePool = undefined;
            }
          }

          // Déterminer de manière ultra fiable s'il s'agit d'une poule ou d'un match de poule
          const matchPool = activeMatch?.pool_id ? pools.find(p => p.id === activeMatch.pool_id) : undefined;
          const isPoolMatch = activeMatch ? (activeMatch.round === 'pool' || (!!activeMatch.pool_id && !matchPool?.name?.includes('Bracket'))) : false;
          const displayedPool = activePool || (isPoolMatch ? matchPool : undefined);
          const isPool = !!displayedPool || isPoolMatch;

          const isOccupied = !!activeMatch || !!activePool;

          return (
            <div
              key={tableNum}
              className={`p-6 rounded-[2.5rem] border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                isOccupied 
                  ? 'bg-white border-slate-200 shadow-xl shadow-slate-50' 
                  : 'bg-slate-50/50 border-dashed border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/80 group'
              }`}
            >
              {/* Entête de carte */}
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-0.5">ESPACE JEU</span>
                    <h2 className="text-xl font-black text-slate-900">Table {tableNum}</h2>
                  </div>
                  
                  {isOccupied ? (
                    <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded-full">
                      Occupée
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-full">
                      Libre
                    </span>
                  )}
                </div>

                {/* Contenu principal */}
                <div className="space-y-4 py-2">
                  {isOccupied ? (
                    <div className="space-y-4">
                      {/* Série & Catégorie */}
                      <div>
                        {isPool ? (
                          <>
                            <span className="text-[10px] font-extrabold uppercase text-indigo-400 tracking-wider block">Poule Actuelle</span>
                            <div className="text-sm font-bold text-slate-800 truncate">
                              {displayedPool?.name || 'Match de poule'}
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] font-extrabold uppercase text-amber-500 tracking-wider block">Phase Finale</span>
                            <div className="text-sm font-bold text-slate-800 truncate">
                              {activeMatch ? getRoundLabel(activeMatch.round) : 'Tableau de Phase Finale'}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Match en cours ou Matchs restants */}
                      {activeMatch ? (
                        <div className="bg-indigo-50/40 border border-indigo-100/60 rounded-2xl p-3.5 space-y-2 animate-pulse">
                          <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest block">Match en cours 🏓</span>
                          
                          <div className="space-y-1">
                            {/* Joueur 1 */}
                            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                              <span>{activeMatch.player1?.last_name?.toUpperCase() || 'Inconnu'} {activeMatch.player1?.first_name ? `${activeMatch.player1.first_name[0]}.` : ''}</span>
                              <span className="text-[10px] text-slate-400">{activeMatch.player1?.points || 0} pts</span>
                            </div>
                            
                            {/* VS */}
                            <div className="text-[10px] text-center font-extrabold text-indigo-400">vs</div>

                            {/* Joueur 2 */}
                            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                              <span>{activeMatch.player2?.last_name?.toUpperCase() || 'Inconnu'} {activeMatch.player2?.first_name ? `${activeMatch.player2.first_name[0]}.` : ''}</span>
                              <span className="text-[10px] text-slate-400">{activeMatch.player2?.points || 0} pts</span>
                            </div>
                          </div>

                          {/* Scores Live des sets */}
                          {activeMatch.sets && activeMatch.sets.length > 0 ? (
                            <div className="flex justify-center gap-1.5 pt-2 border-t border-indigo-100/40">
                              {activeMatch.sets.map((set: any, idx: number) => (
                                <span 
                                  key={set.id || idx} 
                                  className="px-2 py-0.5 bg-white border border-indigo-100 text-[10px] font-black text-indigo-600 rounded-md shadow-xs tabular-nums"
                                >
                                  {set.score_p1}-{set.score_p2}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[10px] text-center text-slate-400 italic pt-1">
                              Match démarré, score en attente
                            </div>
                          )}
                        </div>
                      ) : (
                        activePool && (
                          <div className="border border-slate-100 rounded-2xl p-4 text-center">
                            <p className="text-xs text-slate-400 italic">Aucun arbitrage actif</p>
                            <button
                              onClick={() => handleLaunchPoolMatch(activePool.id, tableNum)}
                              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-extrabold hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
                            >
                              <Play className="w-3 h-3 fill-current" /> Lancer match suivant
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400 space-y-2">
                      <div className="w-10 h-10 rounded-full bg-slate-100/50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50/10 group-hover:text-indigo-400 transition-colors">
                        <Coffee className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-medium italic">Table libre pour de nouvelles compositions</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Barre d'action basse de carte */}
              <div className="mt-6 pt-4 border-t border-slate-100/80">
                {activePool ? (
                  <div className="flex flex-col gap-2">
                    {movingTable === tableNum ? (
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Déplacer vers...</label>
                        <select
                          value=""
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (val) {
                              handleMovePoolToTable(activePool.id, tableNum, val);
                            }
                          }}
                          className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
                        >
                          <option value="">Sélectionner table libre</option>
                          {tablesArray
                            .filter(n => !pools.some(p => p.status !== 'finished' && Number(p.table_number) === Number(n)) && !matches.some(m => m.status === 'in_progress' && Number(m.table_number) === Number(n)))
                            .map((n) => (
                              <option key={n} value={n}>Table {n}</option>
                            ))}
                        </select>
                        <button
                          onClick={() => setMovingTable(null)}
                          className="w-full text-[10px] text-center text-slate-400 hover:text-slate-600 font-extrabold py-1"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setMovingTable(tableNum)}
                          className="flex-1 py-2 border border-slate-200 hover:border-slate-300 text-slate-650 hover:text-slate-950 rounded-xl text-[11px] font-bold transition-all text-center"
                        >
                          Déplacer poule
                        </button>
                        <button
                          onClick={() => handleReleaseTable(activePool.id, tableNum)}
                          className="px-2.5 py-2 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-xl text-[11px] font-bold transition-all border border-transparent hover:border-red-100"
                          title="Libérer la table"
                        >
                          Libérer
                        </button>
                      </div>
                    )}
                  </div>
                ) : activeMatch ? (
                  <div className="flex flex-col gap-1.5 pt-1">
                    <button
                      onClick={async () => {
                        try {
                          await supabase
                            .from('matches')
                            .update({ table_number: null, status: 'pending' })
                            .eq('id', activeMatch.id);
                          toast.success("Match dé-assigné de la table (de retour en attente de lancement).");
                          fetchTablesData(true);
                        } catch (err) {
                          console.error(err);
                          toast.error("Erreur lors de la libération du match.");
                        }
                      }}
                      className="w-full py-2 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-xl text-[11px] font-bold transition-all border border-transparent hover:border-red-100 text-center"
                    >
                      Libérer la table (Match en cours)
                    </button>
                  </div>
                ) : (
                  <div>
                    {assigningTable === tableNum ? (
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Assigner poule ou match...</label>
                        {unassignedPools.length > 0 || readyBracketMatches.length > 0 ? (
                          <select
                            value=""
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val.startsWith('pool:')) {
                                handleAssignPoolToTable(val.replace('pool:', ''), tableNum);
                              } else if (val.startsWith('match:')) {
                                handleAssignBracketMatchToTable(val.replace('match:', ''), tableNum);
                              }
                            }}
                            className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
                          >
                            <option value="">Choisir poule ou match</option>
                            {unassignedPools.length > 0 && (
                              <optgroup label="Poules de qualification">
                                {unassignedPools.map((p) => (
                                  <option key={p.id} value={`pool:${p.id}`}>{p.name}</option>
                                ))}
                              </optgroup>
                            )}
                            {readyBracketMatches.length > 0 && (
                              <optgroup label="Matchs de phase finale">
                                {readyBracketMatches.map((m) => {
                                  const p1 = m.player1 ? `${m.player1.first_name || ''} ${m.player1.last_name || ''}`.trim() : 'Joueur 1';
                                  const p2 = m.player2 ? `${m.player2.first_name || ''} ${m.player2.last_name || ''}`.trim() : 'Joueur 2';
                                  const roundLabel = getRoundLabel(m.round);
                                  const sName = m.player1?.serie || m.player2?.serie || '';
                                  const sPrefix = sName ? `[${sName}] ` : '';
                                  return (
                                    <option key={m.id} value={`match:${m.id}`}>
                                      {sPrefix}{roundLabel} : {p1} vs {p2}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            )}
                          </select>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic py-1 leading-normal">
                            Aucune poule ou match disponible en attente de table.
                          </div>
                        )}
                        <button
                          onClick={() => setAssigningTable(null)}
                          className="w-full text-[10px] text-center text-slate-400 hover:text-slate-600 font-extrabold py-1"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAssigningTable(tableNum)}
                        className="w-full py-2 hover:bg-slate-900 hover:text-white text-slate-600 border border-slate-200 hover:border-slate-900 rounded-xl text-[11px] font-extrabold transition-all text-center cursor-pointer"
                      >
                        Assigner poule ou match
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
