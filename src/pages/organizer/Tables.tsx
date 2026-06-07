import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { tournament } = useTournament();
  const [pools, setPools] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [poolPlayers, setPoolPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningTable, setAssigningTable] = useState<number | null>(null);
  const [movingTable, setMovingTable] = useState<number | null>(null);

  const fetchTablesData = async (silent = false) => {
    if (!tournament?.id) {
      setLoading(false);
      return;
    }
    try {
      if (!silent) setLoading(true);

      // Fetch pools
      const { data: poolsRes, error: poolsErr } = await supabase
        .from('pools')
        .select('*')
        .eq('tournament_id', tournament.id);

      if (poolsErr) throw poolsErr;

      // Fetch all pool_players for pools of this tournament
      const poolIds = (poolsRes || []).map(p => p.id);
      let poolPlayersList: any[] = [];
      if (poolIds.length > 0) {
        const { data: ppRes, error: ppErr } = await supabase
          .from('pool_players')
          .select('pool_id, player_id, players(*)')
          .in('pool_id', poolIds);
        if (!ppErr) poolPlayersList = ppRes || [];
      }

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
      setPoolPlayers(poolPlayersList);
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

      // Vérifier si un des joueurs de la poule est déjà mobilisé sur une autre table
      const playersInThisPool = poolPlayers.filter(pp => pp.pool_id === poolId).map(pp => pp.player_id);
      for (const pId of playersInThisPool) {
        const mobs = mobilizedPlayers.get(pId) || [];
        const conflict = mobs.find(mob => Number(mob.tableNumber) !== Number(tableNum));
        if (conflict) {
          toast.error(`Impossible d'assigner la poule : ${conflict.playerName} est déjà mobilisé dans "${conflict.sourceName}" sur la Table ${conflict.tableNumber} (en tant que joueur ou arbitre) !`);
          return;
        }
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

      const matchToLaunch = matches.find(m => m.id === matchId);
      if (matchToLaunch) {
        if (matchToLaunch.player1_id) {
          const mobs = mobilizedPlayers.get(matchToLaunch.player1_id) || [];
          const conflict = mobs.find(mob => Number(mob.tableNumber) !== Number(tableNum));
          if (conflict) {
            toast.error(`Impossible de lancer le match : ${conflict.playerName} est déjà mobilisé dans "${conflict.sourceName}" sur la Table ${conflict.tableNumber} (en tant que joueur ou arbitre) !`);
            return;
          }
        }
        if (matchToLaunch.player2_id) {
          const mobs = mobilizedPlayers.get(matchToLaunch.player2_id) || [];
          const conflict = mobs.find(mob => Number(mob.tableNumber) !== Number(tableNum));
          if (conflict) {
            toast.error(`Impossible de lancer le match : ${conflict.playerName} est déjà mobilisé dans "${conflict.sourceName}" sur la Table ${conflict.tableNumber} (en tant que joueur ou arbitre) !`);
            return;
          }
        }
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

      // Vérifier si un joueur de cette poule est déjà mobilisé ailleurs
      const playersInThisPool = poolPlayers.filter(pp => pp.pool_id === poolId);
      for (const pp of playersInThisPool) {
        const mobs = mobilizedPlayers.get(pp.player_id) || [];
        const conflict = mobs.find(mob => Number(mob.tableNumber) !== Number(tableNum));
        if (conflict) {
          const pData = Array.isArray(pp.players) ? pp.players[0] : pp.players;
          const pName = pData ? `${pData.first_name || ''} ${pData.last_name || ''}`.trim() : 'Un joueur de la poule';
          toast.error(`Impossible de lancer le match de poule : ${pName} est déjà mobilisé dans "${conflict.sourceName}" sur la Table ${conflict.tableNumber} (en tant que joueur ou arbitre) !`);
          return;
        }
      }

      await supabase.from('matches').update({
        table_number: tableNum,
        status: 'in_progress',
        started_at: new Date().toISOString()
      }).eq('id', matchToLaunch.id);

      await supabase.from('pools').update({ status: 'in_progress', table_number: tableNum }).eq('id', poolId);

      toast.success(`🏓 Match de poule lancé sur la Table ${tableNum} !`);
      fetchTablesData(true);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du lancement du match.');
    }
  };

  if (!tournament) {
    return (
      <div className="p-4 sm:p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[50vh] text-center" id="no-tournament-active">
        <div className="w-16 h-16 bg-[#152031] rounded-2xl flex items-center justify-center text-[#f97316] mb-4 border border-[#20324e] shadow-lg">
          <Grid3X3 className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Aucun tournoi actif</h3>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          Vous n'avez pas encore créé ou sélectionné de tournoi. Créez ou sélectionnez-en un dans le Tableau de Bord pour gérer les tables.
        </p>
        <button
          onClick={() => navigate('/organizer')}
          className="px-5 py-2.5 bg-[#f97316] text-[#0c1624] rounded-xl text-sm font-black shadow-md hover:bg-[#ea580c] transition active:scale-95 duration-100 cursor-pointer"
        >
          Aller au Tableau de Bord
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3" id="tables-loading-state">
        <RefreshCw className="w-8 h-8 text-[#f97316] animate-spin" />
        <p className="text-sm font-semibold text-slate-400 font-mono">Chargement des tables en temps réel...</p>
      </div>
    );
  }

  const nbTables = tournament?.nb_tables || 0;
  const tablesArray = Array.from({ length: nbTables }, (_, i) => i + 1);

  // Compile map of players currently playing on any table (playerId => { playerName, tableNumber })
  const activePlayersOnTables = new Map<string, { playerName: string; tableNumber: number }>();
  matches.forEach(m => {
    if (m.status === 'in_progress' && m.table_number) {
      if (m.player1_id) {
        const p1Name = `${m.player1?.first_name || ''} ${m.player1?.last_name || ''}`.trim() || 'Joueur 1';
        activePlayersOnTables.set(m.player1_id, { playerName: p1Name, tableNumber: Number(m.table_number) });
      }
      if (m.player2_id) {
        const p2Name = `${m.player2?.first_name || ''} ${m.player2?.last_name || ''}`.trim() || 'Joueur 2';
        activePlayersOnTables.set(m.player2_id, { playerName: p2Name, tableNumber: Number(m.table_number) });
      }
    }
  });

  // Compile map of players currently mobilized on any table (due to active pool or current match)
  const mobilizedPlayers = new Map<string, Array<{ sourceName: string; tableNumber: number; playerName: string }>>();
  pools.forEach(p => {
    if (p.status !== 'finished' && p.table_number) {
      const playersInPool = poolPlayers.filter(pp => pp.pool_id === p.id);
      playersInPool.forEach(pp => {
        const pData = Array.isArray(pp.players) ? pp.players[0] : pp.players;
        const pName = pData ? `${pData.first_name || ''} ${pData.last_name || ''}`.trim() : 'Joueur';
        
        const list = mobilizedPlayers.get(pp.player_id) || [];
        list.push({
          sourceName: p.name,
          tableNumber: Number(p.table_number),
          playerName: pName
        });
        mobilizedPlayers.set(pp.player_id, list);
      });
    }
  });

  matches.forEach(m => {
    if (m.status === 'in_progress' && m.table_number) {
      const tNum = Number(m.table_number);
      if (m.player1_id) {
        const p1Name = `${m.player1?.first_name || ''} ${m.player1?.last_name || ''}`.trim() || 'Joueur 1';
        const list = mobilizedPlayers.get(m.player1_id) || [];
        if (!list.some(x => x.tableNumber === tNum)) {
          list.push({
            sourceName: m.round === 'pool' ? 'Poule' : 'Match Phase Finale',
            tableNumber: tNum,
            playerName: p1Name
          });
          mobilizedPlayers.set(m.player1_id, list);
        }
      }
      if (m.player2_id) {
        const p2Name = `${m.player2?.first_name || ''} ${m.player2?.last_name || ''}`.trim() || 'Joueur 2';
        const list = mobilizedPlayers.get(m.player2_id) || [];
        if (!list.some(x => x.tableNumber === tNum)) {
          list.push({
            sourceName: m.round === 'pool' ? 'Poule' : 'Match Phase Finale',
            tableNumber: tNum,
            playerName: p2Name
          });
          mobilizedPlayers.set(m.player2_id, list);
        }
      }
    }
  });

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
    <div className="p-2 sm:p-4 w-full max-w-[1600px] 2xl:max-w-[1850px] mx-auto space-y-5 animate-fade-in pb-10" id="tables-view-main">
      {/* En-tête de la page */}
      <div className="flex flex-col gap-2.5 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white border-l-4 border-[#f97316] pl-4">
            Gestion des Tables
          </h1>
          <p className="text-slate-400 mt-1 pl-4 text-xs sm:text-sm font-semibold">
            Affectations en temps réel, mouvements de tables et suivi direct des matchs du club en compétition.
          </p>
        </div>
        <button 
          onClick={() => fetchTablesData()}
          className="self-start md:self-auto flex items-center gap-2 px-4 py-2 bg-[#152031] border border-[#2a3548] hover:border-[#f97316]/50 text-slate-200 hover:text-white font-extrabold text-xs rounded-xl transition-all shadow-md cursor-pointer select-none"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Réactualiser
        </button>
      </div>

      {/* Widgets Stats en Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#152031] p-4 sm:p-4.5 rounded-2xl border border-[#2a3548] shadow-lg flex items-center justify-between relative overflow-hidden">
          <div className="space-y-0.5 z-10">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest block">Total Tables</span>
            <span className="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight">{String(nbTables).padStart(2, '0')}</span>
          </div>
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-[#0e1726]/80 rounded-xl flex items-center justify-center text-slate-400 border border-[#20324e] z-10">
            <Grid3X3 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#152031] p-4 sm:p-4.5 rounded-2xl border-b-4 border-b-[#f97316] border-[#2a3548] shadow-lg flex items-center justify-between relative overflow-hidden">
          <div className="space-y-0.5 z-10">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest block">Tables Occupées</span>
            <span className="text-3xl sm:text-4xl font-black font-mono text-[#f97316] tracking-tight">{String(occupiedTablesCount).padStart(2, '0')}</span>
          </div>
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-[#f97316]/10 rounded-xl flex items-center justify-center text-[#f97316] border border-[#f97316]/20 z-10">
            <Play className="w-5 h-5 animate-pulse fill-current" />
          </div>
        </div>

        <div className="bg-[#152031] p-4 sm:p-4.5 rounded-2xl border border-[#2a3548] shadow-lg flex items-center justify-between relative overflow-hidden">
          <div className="space-y-0.5 z-10">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest block">Tables Libres</span>
            <span className="text-3xl sm:text-4xl font-black font-mono text-emerald-400 tracking-tight">{String(freeTablesCount).padStart(2, '0')}</span>
          </div>
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 border border-emerald-500/20 z-10">
            <Coffee className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Alerte Poules Sans Tables */}
      {unassignedPools.length > 0 && (
        <div className="bg-[#eab308]/5 border border-[#eab308]/20 text-slate-300 p-4 rounded-2xl flex items-start gap-3 shadow-xl">
          <div className="p-2 bg-[#eab308]/10 text-[#f97316] rounded-xl flex-shrink-0">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
          <div className="flex-1">
            <h4 className="font-extrabold text-sm text-white">Poules en attente d'attribution ({unassignedPools.length})</h4>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Des poules ne sont affectées à aucune table de jeu. Assignez-les à des tables libres pour commencer l'arbitrage.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {unassignedPools.map(pool => (
                <span 
                  key={pool.id} 
                  className="px-2.5 py-1 bg-[#0e1726]/80 border border-[#20324e] text-[10px] font-bold text-slate-300 rounded-lg shadow-md"
                >
                  {pool.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grille des Tables */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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

          // Récupération des points du set en cours
          const currentSet = activeMatch?.sets && activeMatch.sets.length > 0 
            ? activeMatch.sets[activeMatch.sets.length - 1] 
            : null;
          const p1Score = currentSet ? currentSet.score_p1 : 0;
          const p2Score = currentSet ? currentSet.score_p2 : 0;

          return (
            <div
              key={tableNum}
              className={`p-4 sm:p-4.5 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                isOccupied 
                  ? 'bg-[#152031] border-[#2a3548] shadow-2xl' 
                  : 'bg-[#152031]/35 border-dashed border-[#20324e] hover:border-slate-500 hover:bg-[#152031]/50 group'
              }`}
            >
              {/* Entête de carte */}
              <div>
                <div className="flex justify-between items-start mb-3.5">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">ESPACE JEU</span>
                    <h2 className="text-xl font-black text-white">Table {tableNum}</h2>
                  </div>
                  
                  {isOccupied ? (
                    <span className="px-2.5 py-0.5 bg-[#f97316]/10 border border-[#f97316]/25 text-[#f97316] text-[10px] font-extrabold uppercase tracking-wider rounded-lg">
                      Occupée
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider rounded-lg">
                      Libre
                    </span>
                  )}
                </div>

                {/* Contenu principal */}
                <div className="space-y-3 py-1">
                  {isOccupied ? (
                    <div className="space-y-3">
                      {/* Série & Catégorie */}
                      <div>
                        {isPool ? (
                          <>
                            <span className="text-[10px] font-extrabold uppercase text-[#f97316]/90 tracking-wider block">Poule Actuelle</span>
                            <div className="text-sm font-bold text-white truncate mt-0.5">
                              {displayedPool?.name || 'Match de poule'}
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] font-extrabold uppercase text-[#f97316]/90 tracking-wider block">Phase Finale</span>
                            <div className="text-sm font-bold text-white truncate mt-0.5">
                              {activeMatch ? getRoundLabel(activeMatch.round) : 'Tableau de Phase Finale'}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Match en cours ou Matchs restants */}
                      {activeMatch ? (
                        <div className="bg-[#0e1726]/60 border border-[#20324e] rounded-xl p-3 sm:p-3.5 space-y-3">
                          <span className="text-[9px] font-bold text-[#f97316] uppercase tracking-widest block">Match en cours 🏓</span>
                          
                          <div className="space-y-1.5">
                            {/* Joueur 1 */}
                            <div className="flex justify-between items-center text-xs font-bold text-slate-200">
                              <span className="truncate max-w-[130px]" title={`${activeMatch.player1?.last_name?.toUpperCase() || ''} ${activeMatch.player1?.first_name || ''}`}>
                                {activeMatch.player1?.last_name?.toUpperCase() || 'Inconnu'} {activeMatch.player1?.first_name ? `${activeMatch.player1.first_name[0]}.` : ''}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] text-slate-500 font-medium">{activeMatch.player1?.points || 0} pts</span>
                                <span className="text-xs font-black text-[#f97316] tabular-nums bg-[#f97316]/10 px-1.5 py-0.5 rounded-md min-w-[20px] text-center">
                                  {p1Score}
                                </span>
                              </div>
                            </div>
                            
                            {/* VS */}
                            <div className="text-[9px] text-center font-bold text-[#20324e] uppercase border-y border-[#20324e]/50 py-0.5">vs</div>

                            {/* Joueur 2 */}
                            <div className="flex justify-between items-center text-xs font-bold text-slate-200">
                              <span className="truncate max-w-[130px]" title={`${activeMatch.player2?.last_name?.toUpperCase() || ''} ${activeMatch.player2?.first_name || ''}`}>
                                {activeMatch.player2?.last_name?.toUpperCase() || 'Inconnu'} {activeMatch.player2?.first_name ? `${activeMatch.player2.first_name[0]}.` : ''}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] text-slate-500 font-medium">{activeMatch.player2?.points || 0} pts</span>
                                <span className="text-xs font-black text-slate-400 tabular-nums bg-slate-400/10 px-1.5 py-0.5 rounded-md min-w-[20px] text-center">
                                  {p2Score}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Info sur le numéro de match / poule */}
                          <div className="text-[9px] text-[#38bdf8] font-bold uppercase tracking-wider text-center pt-1 border-t border-[#20324e]/50">
                            {displayedPool?.name ? `${displayedPool.name.toUpperCase()} • MATCH` : getRoundLabel(activeMatch.round).toUpperCase()}
                          </div>

                          {/* Scores Live des sets */}
                          {activeMatch.sets && activeMatch.sets.length > 0 && (
                            <div className="flex justify-center gap-1 pt-1.5 border-t border-[#20324e]/40">
                              {activeMatch.sets.map((set: any, idx: number) => (
                                <span 
                                  key={set.id || idx} 
                                  className="px-1.5 py-0.5 bg-[#090f19] border border-[#20324e] text-[9px] font-bold text-slate-400 rounded shadow-sm tabular-nums"
                                >
                                  {set.score_p1}-{set.score_p2}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        activePool && (
                          <div className="border border-[#20324e] rounded-xl p-3 text-center bg-[#0e1726]/30">
                            <p className="text-xs text-slate-400 italic">Aucun arbitrage actif</p>
                            
                            {(() => {
                              const poolMatches = matches.filter(m => m.pool_id === activePool.id);
                              const pendingMatches = poolMatches.filter(m => m.status === 'pending');
                              if (pendingMatches.length === 0) return null;
                              const nextMatch = pendingMatches[0];
                              const p1Mobs = nextMatch.player1_id ? (mobilizedPlayers.get(nextMatch.player1_id) || []) : [];
                              const p2Mobs = nextMatch.player2_id ? (mobilizedPlayers.get(nextMatch.player2_id) || []) : [];
                              
                              const p1ConflictMob = p1Mobs.find(mob => Number(mob.tableNumber) !== Number(tableNum));
                              const p2ConflictMob = p2Mobs.find(mob => Number(mob.tableNumber) !== Number(tableNum));
                              
                              if (p1ConflictMob || p2ConflictMob) {
                                  return (
                                  <div className="my-2 text-left bg-red-500/10 border border-red-500/20 text-red-200 px-2.5 py-1.5 rounded-xl text-[10px] space-y-1">
                                    <div className="flex items-center gap-1 font-extrabold text-red-400">
                                      <ShieldAlert className="w-3 h-3 text-red-500 animate-pulse" />
                                      <span>Double programmation !</span>
                                    </div>
                                    <ul className="list-disc list-inside space-y-0.5 text-[8.5px] text-red-300 font-medium">
                                      {p1ConflictMob && (
                                        <li>{p1ConflictMob.playerName} est sur Table {p1ConflictMob.tableNumber}</li>
                                      )}
                                      {p2ConflictMob && (
                                        <li>{p2ConflictMob.playerName} est sur Table {p2ConflictMob.tableNumber}</li>
                                      )}
                                    </ul>
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            <button
                              onClick={() => handleLaunchPoolMatch(activePool.id, tableNum)}
                              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] hover:bg-[#ea580c] text-[#0c1624] rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-md cursor-pointer"
                            >
                              <Play className="w-2.5 h-2.5 fill-current" /> Lancer match suivant
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-5 text-center text-slate-500 space-y-2.5">
                      <div className="w-10 h-10 rounded-xl bg-[#0e1726]/50 flex items-center justify-center text-slate-400 border border-[#20324e] group-hover:bg-[#f97316]/10 group-hover:text-[#f97316] group-hover:border-[#f97316]/20 transition-all duration-300">
                        <Coffee className="w-4.5 h-4.5" />
                      </div>
                      <p className="text-xs font-semibold text-slate-400 italic leading-normal px-1">Table libre pour de nouvelles compositions</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Barre d'action basse de carte */}
              <div className="mt-4 pt-3 border-t border-[#20324e]/60">
                {activePool ? (
                  <div className="flex flex-col gap-1.5">
                    {movingTable === tableNum ? (
                      <div className="space-y-1.5 pt-0.5">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block font-mono">Déplacer vers...</label>
                        <select
                          value=""
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (val) {
                              handleMovePoolToTable(activePool.id, tableNum, val);
                            }
                          }}
                          className="w-full text-xs font-bold bg-[#0e1726]/90 border border-[#20324e] text-white rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-[#f97316] shadow-md cursor-pointer"
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
                          className="w-full text-[9px] text-center text-slate-400 hover:text-slate-300 font-extrabold py-0.5"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setMovingTable(tableNum)}
                          className="flex-1 py-1.5 border border-[#20324e] bg-[#0e1726]/40 hover:border-slate-500 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-all text-center cursor-pointer"
                        >
                          Déplacer poule
                        </button>
                        <button
                          onClick={() => handleReleaseTable(activePool.id, tableNum)}
                          className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 hover:text-red-200 rounded-lg text-[10px] font-bold transition-all border border-red-500/20 cursor-pointer"
                          title="Libérer la table"
                        >
                          Libérer
                        </button>
                      </div>
                    )}
                  </div>
                ) : activeMatch ? (
                  <div className="flex flex-col gap-1 pt-0.5">
                    <button
                      onClick={() => navigate('/organizer/scores')}
                      className="w-full py-2 bg-[#20324e]/50 hover:bg-[#20324e]/80 text-slate-200 hover:text-white border border-[#2a3548] rounded-lg text-[10px] font-bold transition-all uppercase tracking-widest text-center cursor-pointer flex justify-center items-center gap-1.5 shadow-md"
                    >
                      <Trophy className="w-3 h-3 text-[#f97316]" /> Gérer le score
                    </button>
                    {/* Libération discrète sous le bouton */}
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
                      className="w-full text-[9px] text-slate-500 hover:text-red-400 font-bold transition-colors py-0.5 hover:underline text-center cursor-pointer"
                    >
                      Libérer la table
                    </button>
                  </div>
                ) : (
                  <div>
                    {assigningTable === tableNum ? (
                      <div className="space-y-1.5 pt-0.5">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block font-mono">Assigner poule ou match...</label>
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
                            className="w-full text-xs font-bold bg-[#0e1726]/90 border border-[#20324e] text-white rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-[#f97316] shadow-md cursor-pointer"
                          >
                            <option value="">Choisir poule ou match</option>
                            {unassignedPools.length > 0 && (
                              <optgroup label="Poules de qualification" className="bg-[#152031] text-white">
                                {unassignedPools.map((p) => {
                                  const pPlayers = poolPlayers.filter(pp => pp.pool_id === p.id);
                                  let conflictingPlayerName = '';
                                  let conflictingTable = 0;
                                  let isBusy = false;
                                  for (const pp of pPlayers) {
                                    const mobs = mobilizedPlayers.get(pp.player_id) || [];
                                    const conflict = mobs.find(mob => Number(mob.tableNumber) !== Number(tableNum));
                                    if (conflict) {
                                      isBusy = true;
                                      conflictingPlayerName = conflict.playerName;
                                      conflictingTable = conflict.tableNumber;
                                      break;
                                    }
                                  }
                                  return (
                                    <option key={p.id} value={`pool:${p.id}`} className="text-white">
                                      {p.name} {isBusy ? `⚠️ (${conflictingPlayerName} sur Table ${conflictingTable})` : ''}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            )}
                            {readyBracketMatches.length > 0 && (
                              <optgroup label="Matchs de phase finale" className="bg-[#152031] text-white">
                                {readyBracketMatches.map((m) => {
                                  const p1Mobs = m.player1_id ? (mobilizedPlayers.get(m.player1_id) || []) : [];
                                  const p2Mobs = m.player2_id ? (mobilizedPlayers.get(m.player2_id) || []) : [];
                                  
                                  const p1ConflictMob = p1Mobs.find(mob => Number(mob.tableNumber) !== Number(tableNum));
                                  const p2ConflictMob = p2Mobs.find(mob => Number(mob.tableNumber) !== Number(tableNum));
                                  
                                  const isBusy = p1ConflictMob || p2ConflictMob;
                                  let conflictingInfo = '';
                                  if (p1ConflictMob) {
                                    conflictingInfo = ` (${p1ConflictMob.playerName} sur Table ${p1ConflictMob.tableNumber})`;
                                  } else if (p2ConflictMob) {
                                    conflictingInfo = ` (${p2ConflictMob.playerName} sur Table ${p2ConflictMob.tableNumber})`;
                                  }

                                  const p1 = m.player1 ? `${m.player1.first_name || ''} ${m.player1.last_name || ''}`.trim() : 'Joueur 1';
                                  const p2 = m.player2 ? `${m.player2.first_name || ''} ${m.player2.last_name || ''}`.trim() : 'Joueur 2';
                                  const roundLabel = getRoundLabel(m.round);
                                  const sName = m.player1?.serie || m.player2?.serie || '';
                                  const sPrefix = sName ? `[${sName}] ` : '';
                                  return (
                                    <option key={m.id} value={`match:${m.id}`} className="text-white">
                                      {sPrefix}{roundLabel} : {p1} vs {p2} {isBusy ? `⚠️${conflictingInfo}` : ''}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            )}
                          </select>
                        ) : (
                          <div className="text-[10px] text-slate-450 bg-[#0e1726]/40 border border-[#20324e] rounded-lg p-2 text-center italic leading-normal">
                            Aucune poule ou match disponible en attente de table.
                          </div>
                        )}
                        <button
                          onClick={() => setAssigningTable(null)}
                          className="w-full text-[9px] text-center text-slate-400 hover:text-slate-300 font-bold py-0.5 select-none cursor-pointer"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAssigningTable(tableNum)}
                        className="w-full py-2.5 bg-[#f97316] text-[#0c1624] font-black rounded-lg text-[10px] uppercase tracking-wider hover:bg-[#ea580c] transition-all text-center cursor-pointer shadow-md select-none flex justify-center items-center gap-1.5"
                      >
                        <Play className="w-3 h-3 fill-current" /> Assigner poule ou match
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

