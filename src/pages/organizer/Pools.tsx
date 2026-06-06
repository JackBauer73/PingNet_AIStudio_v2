import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../../hooks/useTournament';
import { usePlayers } from '../../hooks/usePlayers';
import { usePools } from '../../hooks/usePools';
import { generatePools, SERIES_RANK } from '../../utils/generatePools';
import { generatePoolMatches } from '../../utils/generateMatches';
import { generateBracket } from '../../utils/generateBracket';
import { supabase } from '../../supabase';
import toast from 'react-hot-toast';
import { Play, Grid3X3, Trophy, ChevronRight, Lock as LockIcon } from 'lucide-react';

function getContrastColor(hexColor: string): string {
  if (!hexColor) return '#ffffff';
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? '#0f172a' : '#ffffff';
}

export default function Pools() {
  const navigate = useNavigate();
  const { tournament, refresh: refreshTournament } = useTournament();
  const { players, refresh: refreshPlayers } = usePlayers(tournament?.id);
  const { pools, matches, standings, loading, refresh: refreshPools } = usePools(tournament?.id);
  const [generating, setGenerating] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [poolPlayers, setPoolPlayers] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [confirmingClosePools, setConfirmingClosePools] = useState(false);
  const [reassigningPool, setReassigningPool] = useState<string | null>(null);
  const [confirmingDeletePools, setConfirmingDeletePools] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeletePools = async () => {
    if (!tournament) return;
    const currentDay = tournament.current_day || 1;
    const currentCategoryObj = categories.find(c => c.name === selectedCategory && (c.day_number || 1) === currentDay);
    if (!currentCategoryObj) {
      toast.error('Aucune catégorie sélectionnée ou trouvée.');
      return;
    }

    const targetPools = pools.filter(p => 
      p.table_category_id === currentCategoryObj.id
    );

    const poolIds = targetPools.map(p => p.id);
    if (poolIds.length === 0) {
      toast.error('Aucune poule à supprimer.');
      return;
    }

    setDeleting(true);
    const toastId = toast.loading('Suppression des poules en cours...');
    try {
      // 1. Supprimer les matchs associés à ces pools
      const { error: matchDelError } = await supabase
        .from('matches')
        .delete()
        .in('pool_id', poolIds);

      if (matchDelError) throw matchDelError;

      // 2. Libérer les tables physiques occupées par ces pools
      const tableNumbersToFree = targetPools
        .map(p => (p as any).table_number)
        .filter((n): n is number => n != null);

      if (tableNumbersToFree.length > 0) {
        await supabase
          .from('tournament_tables')
          .update({ status: 'available' })
          .eq('tournament_id', tournament.id)
          .in('table_number', tableNumbersToFree);
      }

      // 3. Supprimer les liaisons pool_players
      await supabase
        .from('pool_players')
        .delete()
        .in('pool_id', poolIds);

      // 4. Supprimer les pools eux-mêmes
      const { error: poolDelError } = await supabase
        .from('pools')
        .delete()
        .in('id', poolIds);

      if (poolDelError) throw poolDelError;

      // 5. Réinitialiser les numéros de têtes de série (seed_number) des inscriptions liées
      if (currentCategoryObj) {
        await supabase
          .from('registrations')
          .update({ seed_number: null })
          .eq('tournament_id', tournament.id)
          .eq('table_category_id', currentCategoryObj.id);
        
        await refreshPlayers();
      }

      toast.success(`Les poules du tableau "${selectedCategory}" ont été supprimées.`, { id: toastId });
      setConfirmingDeletePools(false);
      refreshPools();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur lors de la suppression : ${err.message || 'Erreur inconnue'}`, { id: toastId });
    } finally {
      setDeleting(false);
    }
  };

  const isPoolFinished = (poolId: string) => {
    const pool = pools.find(p => p.id === poolId);
    if (!pool) return true;
    if (pool.status === 'finished') return true;
    const poolMatches = matches.filter(m => m.pool_id === poolId);
    return poolMatches.length > 0 && poolMatches.every(m => m.status === 'finished');
  };

  const handleReassignTable = async (poolId: string, newTableNumber: number) => {
    if (!tournament) return;

    // Vérifier que la table cible est libre (protection contre double-clic)
    const targetBusy = pools.some(
      p => Number((p as any).table_number) === Number(newTableNumber) && p.id !== poolId
    );
    if (targetBusy) {
      toast.error(`La table ${newTableNumber} est déjà occupée par une autre poule.`);
      return;
    }

    // Vérifier si un des joueurs de la poule est déjà mobilisé sur une autre table
    const playersInThisPool = poolPlayers.filter(pp => pp.pool_id === poolId).map(pp => pp.player_id);
    for (const pId of playersInThisPool) {
      const mobs = mobilizedPlayers.get(pId) || [];
      const conflict = mobs.find(mob => Number(mob.tableNumber) !== Number(newTableNumber));
      if (conflict) {
        toast.error(`Impossible d'attribuer la table : ${conflict.playerName} est déjà mobilisé dans "${conflict.sourceName}" sur la Table ${conflict.tableNumber} (en tant que joueur ou arbitre) !`);
        return;
      }
    }

    try {
      const pool = pools.find(p => p.id === poolId) as any;
      const oldTableNumber = pool?.table_number;

      await supabase
        .from('pools')
        .update({ table_number: newTableNumber })
        .eq('id', poolId);

      // Mettre à jour également tous les matchs en cours de cette poule pour qu'ils héritent de la nouvelle table
      await supabase
        .from('matches')
        .update({ table_number: newTableNumber })
        .eq('pool_id', poolId)
        .eq('status', 'in_progress');

      // Remettre l'ancienne table disponible
      if (oldTableNumber) {
        await supabase
          .from('tournament_tables')
          .update({ status: 'available' })
          .eq('tournament_id', tournament.id)
          .eq('table_number', oldTableNumber);
      }

      // Marquer la nouvelle table occupée
      await supabase
        .from('tournament_tables')
        .update({ status: 'busy' })
        .eq('tournament_id', tournament.id)
        .eq('table_number', newTableNumber);

      setReassigningPool(null);
      toast.success(`Poule déplacée sur la table ${newTableNumber}`);
      refreshPools();
    } catch (err: any) {
      // Code 23505 = index unique violé → table déjà prise (protection BDD)
      if (err?.code === '23505') {
        toast.error(`La table ${newTableNumber} est déjà prise.`);
      } else {
        toast.error('Erreur lors du déplacement de la poule');
      }
    }
  };

  React.useEffect(() => {
    if (!tournament?.id) return;
    const loadCats = async () => {
      const { data, error } = await supabase
        .from('table_categories')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('name');
      if (!error && data) {
        setCategories(data);
        // Filtrer les catégories sur la journée courante
        const currentDay = tournament.current_day || 1;
        const catsToday = data.filter(c => (c.day_number || 1) === currentDay);
        if (catsToday.length > 0) {
          setSelectedCategory(catsToday[0].name);
        } else {
          setSelectedCategory('');
        }
      }
    };
    loadCats();
  }, [tournament?.id, tournament?.current_day]);

  React.useEffect(() => {
    if (!tournament?.id || pools.length === 0) {
      setPoolPlayers([]);
      return;
    }
    const loadPoolPlayers = async () => {
      const poolIds = pools.map(p => p.id);
      if (poolIds.length > 0) {
        const { data: ppRes, error: ppErr } = await supabase
          .from('pool_players')
          .select('pool_id, player_id, players(*)')
          .in('pool_id', poolIds);
        if (!ppErr && ppRes) {
          setPoolPlayers(ppRes);
        }
      }
    };
    loadPoolPlayers();
  }, [pools, tournament?.id]);

  // Variables calculées pour la journée en cours
  const currentDay = tournament?.current_day || 1;
  const catsToday = categories.filter(c => (c.day_number || 1) === currentDay);
  const currentCategoryObj = categories.find(c => c.name === selectedCategory && (c.day_number || 1) === currentDay);

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

  const getPlayerSeed = (playerId: string) => {
    const reg = players.find(p => p.player_id === playerId && p.table_category_id === currentCategoryObj?.id);
    return reg?.seed_number || null;
  };

  const handleGeneratePools = async () => {
    if (!tournament) return;
    if (!selectedCategory) {
      toast.error('Veuillez sélectionner une catégorie à générer.');
      return;
    }

    const currentDay = tournament.current_day || 1;
    const currentCategoryObj = categories.find(c => c.name === selectedCategory && (c.day_number || 1) === currentDay);
    if (!currentCategoryObj?.is_closed) {
      toast.error(`Le pointage de ce tableau n'est pas encore clôturé 🔒.\n\nVeuillez d'abord clôturer le pointage pour "${selectedCategory}" dans l'onglet "Joueurs" pour débloquer la génération des poules.`);
      return;
    }

    const categoryPlayers = players.filter(p => p.table_category_id === currentCategoryObj.id && p.checked_in === true);

    if (categoryPlayers.length < 3) {
      toast.error(`Il faut au moins 3 joueurs présents dans le tableau "${selectedCategory}" pour générer des poules.`);
      return;
    }

    setGenerating(true);
    try {
      // Charger UNIQUEMENT les tables disponibles (status = 'available')
      const { data: availableTables } = await supabase
        .from('tournament_tables')
        .select('id, table_number')
        .eq('tournament_id', tournament.id)
        .eq('status', 'available')          // ← clé : évite les conflits entre catégories
        .order('table_number');

      const physicalTables = (availableTables || []).map(t => ({
        id: t.id,
        table_number: t.table_number
      }));

      // Règle 1 : Trier les joueurs par points (DESC), puis par ordre alphabétique s'ils ont le même classement pour définir la tête de série (seeding)
      const getPlayerPointsLocal = (p: any): number => {
        if (p.points !== undefined && p.points !== null) {
          return p.points;
        }
        return (SERIES_RANK[p.serie] || 0) * 100 + 500;
      };

      const sortedForSeeding = [...categoryPlayers].sort((a, b) => {
        const ptsA = getPlayerPointsLocal(a);
        const ptsB = getPlayerPointsLocal(b);
        if (ptsB !== ptsA) {
          return ptsB - ptsA;
        }
        const nameA = `${a.last_name || ''} ${a.first_name || ''}`.trim().toLowerCase();
        const nameB = `${b.last_name || ''} ${b.first_name || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
      });

      // Mettre à jour les numéros de têtes de série (seed_number) en base de données pour ces inscriptions
      await Promise.all(
        sortedForSeeding.map((p, idx) =>
          supabase
            .from('registrations')
            .update({ seed_number: idx + 1 })
            .eq('id', p.id)
        )
      );

      // Rafraîchir l'état des inscrits pour propager immédiatement les seed_number
      await refreshPlayers();

      const poolsResult = generatePools(categoryPlayers, physicalTables, tournament.players_per_pool || 3);
      const poolsPlayers = poolsResult.map(p => p.players);
      
      // Charger les poules actives d'autres tableaux pour exclure l'assignation automatique de table pour les joueurs déjà occupés
      const { data: activeOtherPools } = await supabase
        .from('pools')
        .select('id, table_number')
        .eq('tournament_id', tournament.id)
        .not('table_number', 'is', null)
        .neq('status', 'finished');

      const occupiedPlayerIds = new Set<string>();
      if (activeOtherPools && activeOtherPools.length > 0) {
        const { data: activePP } = await supabase
          .from('pool_players')
          .select('player_id')
          .in('pool_id', activeOtherPools.map(p => p.id));
        activePP?.forEach(pp => {
          occupiedPlayerIds.add(pp.player_id);
        });
      }

      // Également des matches de phase finale actifs
      const { data: activeBracketMatches } = await supabase
        .from('matches')
        .select('player1_id, player2_id')
        .eq('tournament_id', tournament.id)
        .eq('status', 'in_progress')
        .is('pool_id', null);
      activeBracketMatches?.forEach(m => {
        if (m.player1_id) occupiedPlayerIds.add(m.player1_id);
        if (m.player2_id) occupiedPlayerIds.add(m.player2_id);
      });

      // La contrainte UNIQUE(tournament_id, name) en BDD bloque la double génération
      const { data: createdPools, error: poolError } = await supabase
        .from('pools')
        .insert(poolsPlayers.map((pPlayers, i) => {
          const hasOccupiedPlayer = pPlayers.some(player => occupiedPlayerIds.has(player.player_id || player.id));
          const assignedTableNum = hasOccupiedPlayer ? null : (poolsResult[i].table?.table_number ?? null);
          return {
            tournament_id: tournament.id,
            name: `${selectedCategory} - Poule ${i + 1}`,
            table_number: assignedTableNum,
            table_category_id: currentCategoryObj?.id ?? null
          };
        }))
        .select();

      if (poolError) {
        // Code 23505 = violation de contrainte unique → double génération
        if ((poolError as any).code === '23505') {
          toast.error('Les poules de ce tableau existent déjà.');
        } else {
          throw poolError;
        }
        return;
      }

      // Marquer les tables assignées comme 'busy'
      const assignedTableNums = createdPools
        .map(p => p.table_number)
        .filter((n): n is number => n != null);
      if (assignedTableNums.length > 0) {
        await supabase
          .from('tournament_tables')
          .update({ status: 'busy' })
          .eq('tournament_id', tournament.id)
          .in('table_number', assignedTableNums);
      }

      // 2. Créer les liaisons pool_players
      const poolPlayersRows = createdPools.flatMap((pool, i) =>
        poolsPlayers[i].map(player => ({ pool_id: pool.id, player_id: player.player_id || player.id }))
      );
      const { error: ppError } = await supabase.from('pool_players').insert(poolPlayersRows);
      if (ppError) throw ppError;

      // 3. Générer les matchs round-robin avec timestamps décalés pour préserver l'ordre d'insertion en BDD
      const baseTime = Date.now();
      const allMatches = createdPools.flatMap((pool, i) =>
        generatePoolMatches(poolsPlayers[i].map(p => p.player_id || p.id), pool.id, tournament.id)
      ).map((match, idx) => ({
        ...match,
        created_at: new Date(baseTime + idx * 1000).toISOString()
      }));
      const { error: matchError } = await supabase.from('matches').insert(allMatches);
      if (matchError) throw matchError;

      // 4. Passer le tournoi en statut 'pools'
      await supabase.from('tournaments')
        .update({ status: 'pools' })
        .eq('id', tournament.id);

      toast.success(`✅ Poules pour "${selectedCategory}" générées avec succès !`);
      refreshPools();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la génération des poules');
    } finally {
      setGenerating(false);
    }
  };

  const handleLaunchPool = async (poolId: string) => {
    if (!tournament) return;

    try {
      // 1. Trouver les matchs en attente de cette poule
      const pendingPoolMatches = matches
        .filter(m => m.pool_id === poolId && m.status === 'pending');

      if (pendingPoolMatches.length === 0) {
        toast('Tous les matchs de cette poule sont déjà lancés ou terminés.');
        return;
      }

      // 2. Trouver la table assignée à cette poule
      const pool = pools.find(p => p.id === poolId);
      let tableToUse = pool ? (pool as any).table_number : null;

      if (!tableToUse) {
        // Fallback si pas de table assignée : chercher une table libre globale
        const { data: busyMatches } = await supabase
          .from('matches')
          .select('table_number')
          .eq('tournament_id', tournament.id)
          .eq('status', 'in_progress');

        const { data: activePools } = await supabase
          .from('pools')
          .select('table_number')
          .eq('tournament_id', tournament.id)
          .neq('status', 'finished');

        const busyTableNumbersByMatches = busyMatches?.map(m => Number(m.table_number)).filter(Boolean) || [];
        const busyTableNumbersByPools = activePools?.map(p => Number(p.table_number)).filter(Boolean) || [];
        const busyTableNumbers = Array.from(new Set([...busyTableNumbersByMatches, ...busyTableNumbersByPools]));

        const freeTables = Array.from({ length: tournament.nb_tables }, (_, i) => i + 1)
          .filter(n => !busyTableNumbers.includes(n));

        if (freeTables.length === 0) {
          toast.error('Aucune table libre pour le moment.');
          return;
        }
        tableToUse = freeTables[0];
      } else {
        // Si on a une table assignée, vérifier si elle est actuellement occupée par UN AUTRE match actif d'un autre pool
        const tableOccupied = matches.some(
          m => m.status === 'in_progress' && Number(m.table_number) === Number(tableToUse)
        );
        if (tableOccupied) {
          toast.error(`La table ${tableToUse} affectée à cette poule est déjà occupée par un autre match.`);
          return;
        }
      }

      // 3. Ne lancer QUE le premier match en attente de cette poule (règle 1 table = 1 match simultané par poule)
      const matchToLaunch = pendingPoolMatches[0];

      // Vérifier si un joueur de cette poule est déjà mobilisé ailleurs
      const playersInThisPool = poolPlayers.filter(pp => pp.pool_id === poolId);
      for (const pp of playersInThisPool) {
        const mobs = mobilizedPlayers.get(pp.player_id) || [];
        const conflict = mobs.find(mob => Number(mob.tableNumber) !== Number(tableToUse));
        if (conflict) {
          const pData = Array.isArray(pp.players) ? pp.players[0] : pp.players;
          const pName = pData ? `${pData.first_name || ''} ${pData.last_name || ''}`.trim() : 'Un joueur de la poule';
          toast.error(`Impossible de lancer la poule : ${pName} est déjà mobilisé dans "${conflict.sourceName}" sur la Table ${conflict.tableNumber} (en tant que joueur ou arbitre) !`);
          return;
        }
      }

      await supabase.from('matches').update({
        table_number: tableToUse,
        status: 'in_progress',
        started_at: new Date().toISOString()
      }).eq('id', matchToLaunch.id);
      
      // 4. Mettre à jour le statut et la table de la poule
      await supabase.from('pools').update({ 
        status: 'in_progress',
        table_number: tableToUse
      }).eq('id', poolId);

      toast.success(`🏓 Match de poule lancé sur la Table ${tableToUse} !`);
      refreshPools();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du lancement de la poule');
    }
  };

  const handleLaunchSingleMatch = async (matchId: string) => {
    if (!tournament) return;

    try {
      const matchObj = matches.find(m => m.id === matchId);
      const poolOfMatch = matchObj?.pool_id ? pools.find(p => p.id === matchObj.pool_id) : null;
      let tableToUse = poolOfMatch ? (poolOfMatch as any).table_number : null;

      if (!tableToUse) {
        const { data: busyMatches } = await supabase
          .from('matches')
          .select('table_number')
          .eq('tournament_id', tournament.id)
          .eq('status', 'in_progress');

        const { data: activePools } = await supabase
          .from('pools')
          .select('table_number')
          .eq('tournament_id', tournament.id)
          .neq('status', 'finished');

        const busyTableNumbersByMatches = busyMatches?.map(m => Number(m.table_number)).filter(Boolean) || [];
        const busyTableNumbersByPools = activePools?.map(p => Number(p.table_number)).filter(Boolean) || [];
        const busyTableNumbers = Array.from(new Set([...busyTableNumbersByMatches, ...busyTableNumbersByPools]));

        const freeTables = Array.from({ length: tournament.nb_tables }, (_, i) => i + 1)
          .filter(n => !busyTableNumbers.includes(n));

        if (freeTables.length === 0) {
          toast.error('Veuillez attendre qu’une table se libère.');
          return;
        }
        tableToUse = freeTables[0];
      } else {
        // Vérifier si la table assignée est déjà occupée
        const tableOccupied = matches.some(
          m => m.status === 'in_progress' && Number(m.table_number) === Number(tableToUse) && m.id !== matchId
        );
        if (tableOccupied) {
          toast.error(`La table ${tableToUse} de cette poule est actuellement occupée par un autre match en cours.`);
          return;
        }
      }

      // Vérifier si un de ces joueurs est mobilisé ailleurs
      if (poolOfMatch) {
        const playersInThisPool = poolPlayers.filter(pp => pp.pool_id === poolOfMatch.id);
        for (const pp of playersInThisPool) {
          const mobs = mobilizedPlayers.get(pp.player_id) || [];
          const conflict = mobs.find(mob => Number(mob.tableNumber) !== Number(tableToUse));
          if (conflict) {
            const pData = Array.isArray(pp.players) ? pp.players[0] : pp.players;
            const pName = pData ? `${pData.first_name || ''} ${pData.last_name || ''}`.trim() : 'Un joueur de la poule';
            toast.error(`Impossible de lancer le match : ${pName} est déjà mobilisé dans "${conflict.sourceName}" sur la Table ${conflict.tableNumber} !`);
            return;
          }
        }
      } else {
        if (matchObj.player1_id) {
          const mobs = mobilizedPlayers.get(matchObj.player1_id) || [];
          const conflict = mobs.find(mob => Number(mob.tableNumber) !== Number(tableToUse));
          if (conflict) {
            toast.error(`Impossible de lancer le match : ${conflict.playerName} est déjà mobilisé dans "${conflict.sourceName}" sur la Table ${conflict.tableNumber} (en tant que joueur ou arbitre) !`);
            return;
          }
        }
        if (matchObj.player2_id) {
          const mobs = mobilizedPlayers.get(matchObj.player2_id) || [];
          const conflict = mobs.find(mob => Number(mob.tableNumber) !== Number(tableToUse));
          if (conflict) {
            toast.error(`Impossible de lancer le match : ${conflict.playerName} est déjà mobilisé dans "${conflict.sourceName}" sur la Table ${conflict.tableNumber} (en tant que joueur ou arbitre) !`);
            return;
          }
        }
      }

      await supabase.from('matches').update({
        table_number: tableToUse,
        status: 'in_progress',
        started_at: new Date().toISOString()
      }).eq('id', matchId);

      // Si de type poule, on force le statut de la poule à in_progress si nécessaire et on s'assure qu'elle a sa table assignée
      if (poolOfMatch) {
        const poolUpdates: any = {};
        if (poolOfMatch.status === 'pending') {
          poolUpdates.status = 'in_progress';
        }
        if (!poolOfMatch.table_number) {
          poolUpdates.table_number = tableToUse;
        }
        if (Object.keys(poolUpdates).length > 0) {
          await supabase.from('pools').update(poolUpdates).eq('id', poolOfMatch.id);
        }
      }

      toast.success(`Match lancé sur la table ${tableToUse}`);
      refreshPools();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du lancement du match');
    }
  };

  if (!tournament) {
    return (
      <div className="p-4 sm:p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 mb-4 border border-indigo-100 shadow-sm">
          <Grid3X3 className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Aucun tournoi actif</h3>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          Vous n'avez pas encore créé ou sélectionné de tournoi. Créez ou sélectionnez-en un dans le Tableau de Bord pour accéder aux poules.
        </p>
        <button
          onClick={() => navigate('/organizer')}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 transition active:scale-95 duration-100"
        >
          Aller au Tableau de Bord
        </button>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center text-slate-400">Chargement...</div>;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Sélecteur de Catégorie / Série de la journée active */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
            🏓 Tableaux du Jour (Journée {currentDay}) :
          </span>
          {catsToday.map(cat => {
            const hasPools = pools.some(p => p.table_category_id === cat.id);
            const isActive = selectedCategory === cat.name;
            const bgCol = cat.color_code || '#4f46e5';
            const textCol = isActive ? getContrastColor(bgCol) : '';
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border border-slate-200/60 ${
                  isActive
                    ? 'shadow-md font-extrabold'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
                style={isActive ? { backgroundColor: bgCol, borderColor: bgCol, color: textCol } : {}}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isActive ? textCol : bgCol }} />
                <span>{cat.name}</span>
                {hasPools ? (
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-black/10 text-current">
                    Prêt
                  </span>
                ) : (
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold">
                    À générer
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedCategory === '' ? (
        <div className="p-8 max-w-2xl mx-auto text-center mt-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 text-slate-400 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Aucun tableau aujourd'hui</h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Aucun tableau ou série de compétition n'est programmé pour la Journée {currentDay} dans l'organisation de ce tournoi.
          </p>
        </div>
      ) : pools.filter(p => p.table_category_id === currentCategoryObj?.id).length === 0 ? (() => {
        const isClosed = currentCategoryObj?.is_closed;
        const presents = players.filter(p => p.table_category_id === currentCategoryObj?.id && p.checked_in);
        const total = players.filter(p => p.table_category_id === currentCategoryObj?.id);
        const hasEnoughPlayers = presents.length >= 3;

        return (
          <div className="p-8 max-w-2xl mx-auto text-center mt-12">
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 transition-all ${
              isClosed ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'
            }`}>
              {isClosed ? <Grid3X3 className="w-10 h-10 animate-pulse" /> : <LockIcon className="w-10 h-10" />}
            </div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center justify-center gap-2">
              Poules du Tableau {selectedCategory}
              {isClosed ? (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-600 text-white leading-none">
                  Prêt 🔒
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-600 text-white leading-none">
                  Pointage en cours 🔓
                </span>
              )}
            </h1>

            {!isClosed ? (
              <div className="bg-rose-50/50 border border-rose-100 text-rose-950 p-4 rounded-2xl text-xs sm:text-sm my-6 leading-relaxed font-bold max-w-lg mx-auto">
                ⚠️ Le pointage de ce tableau n'est pas encore clôturé par la table d'arbitrage.
                <p className="text-slate-500 font-semibold text-xs mt-1">
                  Veuillez d'abord valider les présences et clôturer le pointage dans la rubrique <strong className="text-slate-750">"Joueurs"</strong> pour pouvoir générer les poules.
                </p>
              </div>
            ) : (
              <p className="text-slate-500 mt-4 text-sm leading-relaxed max-w-md mx-auto">
                Les poules pour le tableau "{selectedCategory}" de la journée en cours ne sont pas encore générées.
                Le pointage est validé et clos. Vous pouvez dès maintenant lancer la génération robotisée des poules.
              </p>
            )}
            
            <div className="my-2 inline-flex gap-6 px-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-500">
              <span>Inscrits : <strong className="text-slate-800">{total.length}</strong></span>
              <span>Presents : <strong className="text-indigo-600">{presents.length}</strong></span>
            </div>

            <div className="mt-6 flex flex-col items-center gap-3">
              <button
                onClick={handleGeneratePools}
                disabled={generating || !isClosed || !hasEnoughPlayers}
                className={`inline-flex items-center gap-3 px-8 py-4 text-white rounded-2xl font-bold text-lg transition-all shadow-xl active:scale-95 disabled:scale-100 ${
                  !isClosed 
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-250 cursor-pointer'
                }`}
              >
                {generating ? 'Génération en cours...' : !isClosed ? 'En attente de clôture du pointage 🔒' : 'Générer les Poules de cette Série'}
                <ChevronRight className="w-6 h-6" />
              </button>
              {!hasEnoughPlayers && isClosed && (
                <span className="text-rose-600 font-bold text-xs">
                  ⚠️ Il faut au moins 3 joueurs présents dans ce tableau pour composer des poules.
                </span>
              )}
            </div>
          </div>
        );
      })() : (
        <>
          <div className="flex justify-between items-end mb-8 flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 border-l-4 border-indigo-500 pl-4">
                Poules : {selectedCategory}
              </h1>
              <p className="text-slate-500 mt-2 pl-4">
                Suivez les équipes, classements et fiches de match de ce tableau de niveau.
              </p>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              {/* Bouton de Suppression des Poules */}
              {confirmingDeletePools ? (
                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 animate-fade-in shadow-sm">
                  <span className="text-xs font-bold text-slate-600 px-2.5">
                    Supprimer définitivement ces poules et tous leurs matchs ?
                  </span>
                  <button
                    id="btn-confirm-delete-pools"
                    onClick={handleDeletePools}
                    disabled={deleting}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {deleting ? 'Suppression...' : 'Oui, supprimer ✓'}
                  </button>
                  <button
                    id="btn-cancel-delete-pools"
                    onClick={() => setConfirmingDeletePools(false)}
                    disabled={deleting}
                    className="px-3.5 py-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  id="btn-init-delete-pools"
                  onClick={() => setConfirmingDeletePools(true)}
                  disabled={deleting || generating}
                  className="flex items-center gap-2 px-5 py-3 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200/80 rounded-2xl font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer text-xs"
                >
                  <span>🗑️ Supprimer les Poules</span>
                </button>
              )}

              {matches.filter(m => {
                const pool = pools.find(p => p.id === m.pool_id);
                return pool?.table_category_id === currentCategoryObj?.id;
              }).length > 0 && (
                <div className="flex items-center gap-2">
                  {confirmingClosePools ? (
                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 animate-fade-in shadow-sm">
                      <span className="text-xs font-bold text-slate-600 px-2.5">
                        {(() => {
                          const categoryMatches = matches.filter(m => {
                            const pool = pools.find(p => p.id === m.pool_id);
                            return pool?.table_category_id === currentCategoryObj?.id;
                          });
                          const allFinished = categoryMatches.every(m => m.status === 'finished');
                          return allFinished 
                            ? "Générer le tableau final ?" 
                            : "⚠️ Des matchs sont en cours. Générer quand même ?";
                        })()}
                      </span>
                      <button
                        onClick={async () => {
                          setConfirmingClosePools(false);
                          setGenerating(true);
                          try {
                            await generateBracket(tournament!.id, selectedCategory);
                            toast.success('Phase de poules terminée ! Direction le tableau.');
                            await refreshTournament();
                            navigate('/organizer/bracket');
                          } catch (err: any) {
                            console.error(err);
                            toast.error(err.message || 'Erreur lors de la validation');
                          } finally {
                            setGenerating(false);
                          }
                        }}
                        className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
                      >
                        Oui, créer ✓
                      </button>
                      <button
                        onClick={() => setConfirmingClosePools(false)}
                        className="px-3.5 py-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingClosePools(true)}
                      disabled={generating}
                      className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition-all shadow-xl shadow-green-100 disabled:opacity-50"
                    >
                      <Trophy className="w-5 h-5" />
                      {generating ? 'Génération...' : 'Créer le Tableau Final'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {pools.filter(p => p.table_category_id === currentCategoryObj?.id).map((pool) => {
              const poolMatches = matches.filter(m => m.pool_id === pool.id);
              return (
                <div key={pool.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden border-t-4 border-t-indigo-500">
                  <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <h2 className="text-xl font-bold text-slate-900">{pool.name.replace(`${selectedCategory} - `, '')}</h2>
                          {!isPoolFinished(pool.id) && pool.table_number ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-900 text-white tracking-widest shadow-sm">
                              Table {pool.table_number}
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-400 tracking-wider">
                              Aucune table
                            </span>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isPoolFinished(pool.id) 
                            ? 'bg-green-100 text-green-700' 
                            : pool.status === 'in_progress'
                            ? 'bg-amber-100 text-amber-700 font-extrabold animate-pulse'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {isPoolFinished(pool.id) 
                            ? 'Terminée' 
                            : pool.status === 'in_progress' 
                            ? `Active • Table ${pool.table_number || '?'}` 
                            : 'En attente'
                          }
                        </span>
                      </div>
                      
                      {!isPoolFinished(pool.id) && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {reassigningPool === pool.id ? (
                            <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1 rounded-xl shadow-sm animate-fade-in">
                              <select
                                value=""
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (val) {
                                    handleReassignTable(pool.id, val);
                                  }
                                }}
                                className="text-xs font-bold bg-white border-0 focus:ring-0 p-1 focus:outline-none"
                              >
                                <option value="">-- Assigner Table --</option>
                                {Array.from({ length: tournament?.nb_tables || 0 }, (_, i) => i + 1)
                                  .filter(num => !pools.some(p => !isPoolFinished(p.id) && Number(p.table_number) === Number(num)))
                                  .map((num) => (
                                    <option key={num} value={num}>Table {num}</option>
                                  ))}
                              </select>
                              <button
                                onClick={() => setReassigningPool(null)}
                                className="text-[10px] text-slate-400 hover:text-slate-600 font-bold px-1"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setReassigningPool(pool.id)}
                              className="px-2.5 py-1.5 border border-slate-200 hover:border-slate-350 text-slate-600 hover:text-slate-900 rounded-xl text-[11px] font-bold transition-all"
                            >
                              {pool.table_number ? 'Déplacer de table' : 'Assigner une table'}
                            </button>
                          )}

                          {(() => {
                            const isMatchInProgress = poolMatches.some(m => m.status === 'in_progress');
                            const hasPendingMatches = poolMatches.some(m => m.status === 'pending');
                            
                            if (isMatchInProgress) {
                              return (
                                <div className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-xl text-xs font-black uppercase animate-pulse shadow-sm">
                                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                  Table {pool.table_number || '?'} en cours
                                </div>
                              );
                            }
                            
                            if (!hasPendingMatches) {
                              return null;
                            }

                            return (
                              <button
                                onClick={() => handleLaunchPool(pool.id)}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-850 transition-all shadow-md active:scale-95"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                {pool.status === 'pending' ? 'Lancer la poule' : 'Lancer le match suivant'}
                              </button>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    <div className="p-6">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Classement</h3>
                      <div className="overflow-x-auto mb-8">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-slate-400 italic">
                              <th className="pb-3 font-medium">Pos</th>
                              <th className="pb-3 font-medium">Joueur</th>
                              <th className="pb-3 font-medium text-center">Pts</th>
                              <th className="pb-3 font-medium text-center">Sets</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {(() => {
                              const poolStandings = standings
                                .filter(s => s.pool_id === pool.id)
                                .sort((a, b) => a.standing_rank - b.standing_rank);

                              if (poolStandings.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                                      En attente des premiers résultats...
                                    </td>
                                  </tr>
                                );
                              }
                              
                              return poolStandings.map((s) => {
                                const isTargetRank = s.standing_rank <= 2;
                                const isComplete = poolMatches.length > 0 && poolMatches.every(m => m.status === 'finished');
                                
                                return (
                                  <tr key={s.player_id} className={`group transition-colors ${isTargetRank && isComplete ? 'bg-green-50/40' : ''}`}>
                                    <td className="py-3 px-2">
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                        isTargetRank && isComplete 
                                          ? 'bg-green-600 text-white shadow-lg shadow-green-200 scale-110' 
                                          : 'bg-slate-100 text-slate-400'
                                      }`}>
                                        {s.standing_rank}
                                      </div>
                                    </td>
                                    <td className="py-3">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {s.dossard && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-widest">
                                            Dossard {s.dossard}
                                          </span>
                                        )}
                                        {(() => {
                                          const activeMobilizations = mobilizedPlayers.get(s.player_id) || [];
                                          if (activeMobilizations.length === 0) return null;
                                          
                                          const activeTables = Array.from(new Set(activeMobilizations.map(m => m.tableNumber))).sort((a, b) => a - b);
                                          if (activeTables.length === 0) return null;

                                          return activeTables.map(tNum => (
                                            <span 
                                              key={tNum} 
                                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-700 border border-red-200 animate-pulse cursor-default"
                                              title={`Détecté actif sur la table T${tNum}`}
                                            >
                                              <span className="w-1 h-1 rounded-full bg-red-500 animate-ping" />
                                              actif sur T{tNum}
                                            </span>
                                          ));
                                        })()}
                                        <div className="font-semibold text-slate-900">{s.first_name} {s.last_name}</div>
                                        {(() => {
                                          const seed = getPlayerSeed(s.player_id);
                                          if (!seed) return null;
                                          return (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-yellow-100 text-yellow-800 border border-yellow-200 uppercase cursor-default" title={`Tête de série ${seed}`}>
                                              TDS {seed}
                                            </span>
                                          );
                                        })()}
                                        {isTargetRank && isComplete && (
                                          <Trophy className="w-3 h-3 text-amber-500 animate-bounce" />
                                        )}
                                        {(() => {
                                          const otherRegs = players.filter(p => {
                                            if (p.player_id !== s.player_id) return false;
                                            if (p.serie === selectedCategory) return false;
                                            if (!p.checked_in) return false;
                                            const catObj = categories.find(c => c.name === p.serie);
                                            return catObj && (catObj.day_number || 1) === currentDay;
                                          });
                                          if (otherRegs.length === 0) return null;

                                          return otherRegs.map(reg => {
                                            const catObj = categories.find(c => c.name === reg.serie);
                                            const bgCol = catObj?.color_code || '#64748b';
                                            const textCol = getContrastColor(bgCol);
                                            return (
                                              <span 
                                                key={reg.id} 
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider text-white shadow-sm border border-white/10"
                                                style={{ backgroundColor: bgCol, color: textCol }}
                                                title={`Aussi présent dans le tableau : ${reg.serie}`}
                                              >
                                                <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                                                {reg.serie}
                                              </span>
                                            );
                                          });
                                        })()}
                                      </div>
                                      <div className="text-xs text-slate-400 italic">
                                        {s.club || 'Sans club'}
                                        {s.points_fftt !== undefined && s.points_fftt !== null && s.points_fftt > 0 ? ` • ${s.points_fftt} pts` : ''}
                                      </div>
                                    </td>
                                    <td className="py-3 text-center font-bold text-slate-700 px-2">
                                      <span className={s.points > 0 ? 'text-indigo-600' : ''}>{s.points}</span>
                                    </td>
                                    <td className="py-3 text-center font-medium text-slate-500 tabular-nums text-xs">
                                      <span className="text-green-600">{s.sets_won}</span>
                                      <span className="mx-1 text-slate-300">/</span>
                                      <span className="text-red-500">{s.sets_lost}</span>
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>

                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Matchs</h3>
                      <div className="space-y-3">
                        {poolMatches.map((match) => (
                          <div key={match.id} className="flex flex-col p-3 rounded-xl border border-slate-100 bg-slate-50/10 group hover:border-indigo-200 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                               <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                 match.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 
                                 match.status === 'finished' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
                               }`}>
                                 {match.status === 'in_progress' ? `Table ${match.table_number}` : 
                                  match.status === 'finished' ? 'Terminé' : 'En attente'}
                               </span>
                               {match.status === 'pending' && (
                                 <button 
                                   onClick={() => handleLaunchSingleMatch(match.id)}
                                   className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-colors"
                                 >
                                   <Play className="w-3 h-3" />
                                 </button>
                               )}
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <div className="flex-1 text-right font-semibold text-slate-700 truncate">
                                {match.player1?.last_name}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center font-black text-slate-900 tabular-nums">
                                  {match.sets?.filter(s => s.score_p1 > s.score_p2).length || 0}
                                </div>
                                <div className="text-slate-300 font-bold">:</div>
                                <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center font-black text-slate-900 tabular-nums">
                                  {match.sets?.filter(s => s.score_p2 > s.score_p1).length || 0}
                                </div>
                              </div>
                              <div className="flex-1 text-left font-semibold text-slate-700 truncate">
                                {match.player2?.last_name}
                              </div>
                            </div>

                            {match.sets && match.sets.length > 0 && (
                              <div className="mt-2 flex justify-center gap-3 text-[10px] tabular-nums font-medium">
                                {match.sets.map((s, idx) => (
                                  <div key={s.id || idx} className="bg-white px-1.5 py-0.5 rounded border border-slate-100 shadow-sm text-slate-500">
                                    {s.score_p1}-{s.score_p2}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          {(() => {
            const categoryMatches = matches.filter(m => {
              const pool = pools.find(p => p.id === m.pool_id);
              return pool?.table_category_id === currentCategoryObj?.id;
            });
            const allFinished = categoryMatches.length > 0 && categoryMatches.every(m => m.status === 'finished');
            
            return allFinished ? (
              <div className="mt-12 bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                <div className="relative z-10 text-center max-w-2xl mx-auto">
                  <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]" />
                  <h2 className="text-3xl font-black mb-4 tracking-tight">Poules Terminées (Série {selectedCategory})</h2>
                  <p className="text-slate-400 mb-8 text-sm">
                    Le classement final a été calculé pour la Série {selectedCategory}. Voici la liste des joueurs qualifiés pour le tableau final.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left mb-8">
                    {pools.filter(p => p.table_category_id === currentCategoryObj?.id).map(pool => {
                      const poolQualified = standings
                        .filter(s => s.pool_id === pool.id && s.standing_rank <= 2)
                        .sort((a, b) => a.standing_rank - b.standing_rank);
                        
                      return (
                        <div key={pool.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
                          <h3 className="text-indigo-400 font-bold mb-3 flex items-center gap-2">
                            <ChevronRight className="w-4 h-4" />
                            {pool.name.replace(`${selectedCategory} - `, '')}
                          </h3>
                          <div className="space-y-2">
                            {poolQualified.map((q) => (
                              <div key={q.player_id} className="flex justify-between items-center bg-white/5 px-3 py-2 rounded-xl">
                                <span className="font-semibold text-sm">
                                  <span className="text-slate-500 mr-2">#{q.standing_rank}</span>
                                  {q.last_name.toUpperCase()} {q.first_name[0]}.
                                </span>
                                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">QUALIFIÉ</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={async () => {
                      setGenerating(true);
                      try {
                        await generateBracket(tournament.id, selectedCategory);
                        toast.success('Phase de poules terminée ! Direction le tableau.');
                        await refreshTournament();
                        navigate('/organizer/bracket');
                      } catch (err: any) {
                        console.error(err);
                        toast.error(err.message || 'Erreur lors de la validation');
                      } finally {
                        setGenerating(false);
                      }
                    }}
                    disabled={generating}
                    className="px-10 py-4 bg-green-500 text-white rounded-[2rem] font-black text-lg hover:bg-green-600 transition-all shadow-2xl shadow-green-500/20 disabled:opacity-50 flex items-center gap-3 mx-auto active:scale-95"
                  >
                    <Trophy className="w-6 h-6" />
                    {generating ? 'Génération du Tableau...' : 'Créer le Tableau Final'}
                  </button>
                </div>
              </div>
            ) : null;
          })()}
        </>
      )}
    </div>
  );
}
