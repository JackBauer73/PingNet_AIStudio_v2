import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../../hooks/useTournament';
import { usePlayers } from '../../hooks/usePlayers';
import { usePools } from '../../hooks/usePools';
import { generatePools } from '../../utils/generatePools';
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
  const { players } = usePlayers(tournament?.id);
  const { pools, matches, standings, loading, refresh: refreshPools } = usePools(tournament?.id);
  const [generating, setGenerating] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [confirmingClosePools, setConfirmingClosePools] = useState(false);

  React.useEffect(() => {
    if (!tournament?.id) return;
    const loadCats = async () => {
      const { data, error } = await supabase
        .from('table_categories')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('name');
      if (!error && data) {
        // En cas de cache obsolète ou de colonne manquante, on complète à l’aide du localStorage local
        const localClosedRaw = localStorage.getItem(`closed_categories_${tournament.id}`);
        const localClosed: string[] = localClosedRaw ? JSON.parse(localClosedRaw) : [];

        const merged = data.map(cat => ({
          ...cat,
          is_closed: cat.is_closed || localClosed.includes(cat.name)
        }));

        setCategories(merged);
        // Filtrer les catégories sur la journée courante
        const currentDay = tournament.current_day || 1;
        const catsToday = merged.filter(c => (c.day_number || 1) === currentDay);
        if (catsToday.length > 0) {
          setSelectedCategory(catsToday[0].name);
        } else if (merged.length > 0) {
          setSelectedCategory(merged[0].name);
        }
      }
    };
    loadCats();
  }, [tournament?.id, tournament?.current_day]);

  // Variables calculées pour la journée en cours
  const currentDay = tournament?.current_day || 1;
  const catsToday = categories.filter(c => (c.day_number || 1) === currentDay);

  const handleGeneratePools = async () => {
    if (!tournament) return;
    if (!selectedCategory) {
      toast.error('Veuillez sélectionner une catégorie à générer.');
      return;
    }

    const currentCategoryObj = categories.find(c => c.name === selectedCategory);
    if (!currentCategoryObj?.is_closed) {
      toast.error(`Le pointage de ce tableau n'est pas encore clôturé 🔒.\n\nVeuillez d'abord clôturer le pointage pour "${selectedCategory}" dans l'onglet "Joueurs" pour débloquer la génération des poules.`);
      return;
    }

    const categoryPlayers = players.filter(p => p.serie === selectedCategory && p.checked_in === true);

    if (categoryPlayers.length < 3) {
      toast.error(`Il faut au moins 3 joueurs présents dans le tableau "${selectedCategory}" pour générer des poules.`);
      return;
    }

    setGenerating(true);
    try {
      const poolsResult = generatePools(categoryPlayers, [], tournament.players_per_pool || 3);
      const poolsPlayers = poolsResult.map(p => p.players);
      
      // 1. Créer les poules en préfixant par le nom de la catégorie !
      const { data: createdPools, error: poolError } = await supabase
        .from('pools')
        .insert(poolsPlayers.map((_, i) => ({
          tournament_id: tournament.id,
          name: `${selectedCategory} - Poule ${i + 1}`
        })))
        .select();

      if (poolError) throw poolError;

      // 2. Créer les liaisons pool_players
      const poolPlayersRows = createdPools.flatMap((pool, i) =>
        poolsPlayers[i].map(player => ({ pool_id: pool.id, player_id: player.player_id || player.id }))
      );
      const { error: ppError } = await supabase.from('pool_players').insert(poolPlayersRows);
      if (ppError) throw ppError;

      // 3. Générer les matchs round-robin
      const allMatches = createdPools.flatMap((pool, i) =>
        generatePoolMatches(poolsPlayers[i].map(p => p.player_id || p.id), pool.id, tournament.id)
      );
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

      // 2. Trouver les tables occupées
      const { data: busyMatches } = await supabase
        .from('matches')
        .select('table_number')
        .eq('tournament_id', tournament.id)
        .eq('status', 'in_progress');

      const busyTableNumbers = busyMatches?.map(m => m.table_number).filter(Boolean) || [];
      
      // 3. Identifier les tables libres
      const freeTables = Array.from({ length: tournament.nb_tables }, (_, i) => i + 1)
        .filter(n => !busyTableNumbers.includes(n));

      if (freeTables.length === 0) {
        toast.error('Aucune table libre pour le moment.');
        return;
      }

      // 4. Assigner les tables aux matchs
      const matchesToLaunch = pendingPoolMatches.slice(0, freeTables.length);
      const updates = matchesToLaunch.map((match, i) => 
        supabase.from('matches').update({
          table_number: freeTables[i],
          status: 'in_progress',
          started_at: new Date().toISOString()
        }).eq('id', match.id)
      );

      await Promise.all(updates);
      
      // 5. Mettre à jour le statut de la poule
      await supabase.from('pools').update({ status: 'in_progress' }).eq('id', poolId);

      toast.success(`🏓 ${matchesToLaunch.length} match(s) lancé(s) sur les tables libres !`);
      // Use refresh from usePools/useTournament
      refreshPools();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du lancement de la poule');
    }
  };

  const handleLaunchSingleMatch = async (matchId: string) => {
    if (!tournament) return;

    try {
      const { data: busyMatches } = await supabase
        .from('matches')
        .select('table_number')
        .eq('tournament_id', tournament.id)
        .eq('status', 'in_progress');

      const busyTableNumbers = busyMatches?.map(m => m.table_number).filter(Boolean) || [];
      const freeTables = Array.from({ length: tournament.nb_tables }, (_, i) => i + 1)
        .filter(n => !busyTableNumbers.includes(n));

      if (freeTables.length === 0) {
        toast.error('Veuillez attendre qu’une table se libère.');
        return;
      }

      await supabase.from('matches').update({
        table_number: freeTables[0],
        status: 'in_progress',
        started_at: new Date().toISOString()
      }).eq('id', matchId);

      toast.success(`Match lancé sur la table ${freeTables[0]}`);
      refreshPools();
    } catch (error) {
      console.error(error);
    }
  };

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
            const hasPools = pools.some(p => p.name.startsWith(`${cat.name} - `));
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

      {pools.filter(p => selectedCategory ? p.name.startsWith(`${selectedCategory} - `) : true).length === 0 ? (() => {
        const currentCategoryObj = categories.find(c => c.name === selectedCategory);
        const isClosed = currentCategoryObj?.is_closed;
        const presents = players.filter(p => p.serie === selectedCategory && p.checked_in);
        const total = players.filter(p => p.serie === selectedCategory);
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
            {matches.filter(m => {
              const pool = pools.find(p => p.id === m.pool_id);
              return pool?.name.startsWith(`${selectedCategory} - `);
            }).length > 0 && (
              <div className="flex items-center gap-2">
                {confirmingClosePools ? (
                  <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 animate-fade-in shadow-sm">
                    <span className="text-xs font-bold text-slate-600 px-2.5">
                      {(() => {
                        const categoryMatches = matches.filter(m => {
                          const pool = pools.find(p => p.id === m.pool_id);
                          return pool?.name.startsWith(`${selectedCategory} - `);
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

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {pools.filter(p => p.name.startsWith(`${selectedCategory} - `)).map((pool) => {
              const poolMatches = matches.filter(m => m.pool_id === pool.id);
              return (
                <div key={pool.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden border-t-4 border-t-indigo-500">
                  <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">{pool.name.replace(`${selectedCategory} - `, '')}</h2>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        pool.status === 'finished' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {pool.status === 'finished' ? 'Terminée' : 'En cours'}
                      </span>
                    </div>
                    {pool.status !== 'finished' && (
                      <button
                        onClick={() => handleLaunchPool(pool.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-all shadow-md"
                      >
                        <Play className="w-4 h-4" />
                        Lancer les matchs
                      </button>
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
                            const playerIdsInPool = new Set(poolMatches.flatMap(m => [m.player1_id, m.player2_id]));
                            const poolStandings = standings
                              .filter(s => s.pool_id === pool.id || playerIdsInPool.has(s.player_id))
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
                                      <div className="font-semibold text-slate-900">{s.first_name} {s.last_name}</div>
                                      {isTargetRank && isComplete && (
                                        <Trophy className="w-3 h-3 text-amber-500 animate-bounce" />
                                      )}
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
              return pool?.name.startsWith(`${selectedCategory} - `);
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
                    {pools.filter(p => p.name.startsWith(`${selectedCategory} - `)).map(pool => {
                      const poolMatches = matches.filter(m => m.pool_id === pool.id);
                      const playerIdsInPool = new Set(poolMatches.flatMap(m => [m.player1_id, m.player2_id]));

                      const poolQualified = standings
                        .filter(s => (s.pool_id === pool.id || playerIdsInPool.has(s.player_id)) && (s.standing_rank <= 2))
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
