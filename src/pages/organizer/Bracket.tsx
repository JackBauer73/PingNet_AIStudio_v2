import { useState, useEffect } from 'react';
import { useTournament } from '../../hooks/useTournament';
import { supabase } from '../../supabase';
import { Match } from '../../types';
import { generateBracket } from '../../utils/generateBracket';
import toast from 'react-hot-toast';
import { Trophy, Play, CheckCircle2, Lock, Grid3X3, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

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

export default function Bracket() {
  const { tournament, refresh: refreshTournament } = useTournament();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Charger les catégories du tournoi
  useEffect(() => {
    const fetchCategories = async () => {
      if (!tournament?.id) return;
      const { data } = await supabase
        .from('table_categories')
        .select('*')
        .eq('tournament_id', tournament.id);
      
      const allCats = data || [];
      setCategories(allCats);

      // Sélectionner par défaut la première catégorie de la journée courante
      const currDay = tournament.current_day || 1;
      const catsToday = allCats.filter(c => c.day_number === currDay);

      if (catsToday.length > 0) {
        setSelectedCategory(catsToday[0].name);
      } else if (allCats.length > 0) {
        setSelectedCategory(allCats[0].name);
      }
    };
    fetchCategories();
  }, [tournament?.id, tournament?.current_day]);

  const fetchBracket = async () => {
    if (!tournament || !selectedCategory) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      
      // Trouver la poule de bracket pour cette catégorie
      const { data: pPool } = await supabase
        .from('pools')
        .select('id')
        .eq('tournament_id', tournament.id)
        .eq('name', `${selectedCategory} - Bracket`)
        .maybeSingle();

      if (!pPool) {
        setMatches([]);
        return;
      }

      const { data, error } = await supabase
        .from('matches')
        .select('*, player1:player1_id(*), player2:player2_id(*), sets(*)')
        .eq('tournament_id', tournament.id)
        .eq('pool_id', pPool.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMatches(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBracket();
  }, [tournament?.id, selectedCategory]);

  const handleLaunchAvailable = async () => {
    if (!tournament || !selectedCategory) return;

    try {
      // Trouver la poule de bracket
      const { data: pPool } = await supabase
        .from('pools')
        .select('id')
        .eq('tournament_id', tournament.id)
        .eq('name', `${selectedCategory} - Bracket`)
        .maybeSingle();

      if (!pPool) return;

      // 1. Get latest matches
      const { data: latestMatches } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournament.id)
        .eq('pool_id', pPool.id)
        .eq('status', 'pending');
      
      const pendingMatches = (latestMatches || []).filter(m => m.player1_id && m.player2_id);
      if (pendingMatches.length === 0) return;

      // 2. Get busy tables
      const { data: busyMatches } = await supabase
        .from('matches')
        .select('table_number')
        .eq('tournament_id', tournament.id)
        .eq('status', 'in_progress');

      const busyTableNumbers = busyMatches?.map(m => m.table_number).filter(Boolean) || [];
      const freeTables = Array.from({ length: tournament.nb_tables }, (_, i) => i + 1)
        .filter(n => !busyTableNumbers.includes(n));

      if (freeTables.length === 0) return;

      // 3. Launch matches
      const matchesToLaunch = pendingMatches.slice(0, freeTables.length);
      const updates = matchesToLaunch.map((m, i) => 
        supabase.from('matches').update({
          table_number: freeTables[i],
          status: 'in_progress',
          started_at: new Date().toISOString()
        }).eq('id', m.id)
      );

      await Promise.all(updates);
      fetchBracket();
    } catch (err) {
      console.error('Error auto-launching matches:', err);
    }
  };

  const handleGenerate = async () => {
    if (!tournament || !selectedCategory) return;

    const isRegistrationPhase = ['draft', 'open', 'registration'].includes(tournament.status);
    if (isRegistrationPhase) {
      toast.error("Génération impossible : le tournoi est actuellement en phase d'inscription / pointage.");
      return;
    }

    setGenerating(true);
    try {
      await generateBracket(tournament.id, selectedCategory);
      toast.success(`Tableau final généré pour ${selectedCategory} !`);
      // Wait a moment for DB consistency
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchBracket();
      // Auto-launch matches after generation
      await handleLaunchAvailable();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  const handleLaunchMatch = async (matchId: string) => {
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
      fetchBracket();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du lancement du match');
    }
  };

  useEffect(() => {
    if (!tournament?.id || !selectedCategory) return;
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const chan = supabase.channel(`bracket-updates_${selectedCategory}_${randomSuffix}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => fetchBracket())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sets' }, () => fetchBracket())
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [tournament?.id, selectedCategory]);

  // Safety check to ensure final/3rd place matches exist in the UI/DB
  useEffect(() => {
    const ensureFinalMatches = async () => {
      if (!tournament?.id || matches.length === 0 || !selectedCategory) return;
      
      const hasFinal = matches.some(m => m.round === 'final');
      if (!hasFinal) {
        // Trouver la poule de bracket
        const { data: pPool } = await supabase
          .from('pools')
          .select('id')
          .eq('tournament_id', tournament.id)
          .eq('name', `${selectedCategory} - Bracket`)
          .maybeSingle();

        if (!pPool) return;

        // Create final match if missing
        const { data: newMatch } = await supabase.from('matches').insert({
          tournament_id: tournament.id,
          pool_id: pPool.id,
          round: 'final',
          status: 'pending'
        }).select().single();

        if (newMatch) {
          // Try to sync winners if semis are already done
          const semis = matches.filter(m => m.round === 'semifinal' && m.winner_id);
          if (semis.length > 0) {
            const updates: any = {};
            const semi1 = semis[0];
            const semi2 = semis[1];
            if (semi1?.winner_id) updates.player1_id = semi1.winner_id;
            if (semi2?.winner_id) updates.player2_id = semi2.winner_id;
            
            if (Object.keys(updates).length > 0) {
              await supabase.from('matches').update(updates).eq('id', newMatch.id);
            }
          }
        }
        fetchBracket();
      }
    };
    
    if (matches.length > 0) {
      ensureFinalMatches();
    }
  }, [matches.length, tournament?.id, selectedCategory]);

  const handleCloseTournament = async () => {
    if (!tournament) return;

    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ status: 'finished' })
        .eq('id', tournament.id);

      if (error) throw error;
      toast.success('Tournoi clôturé avec succès !');
      navigate('/organizer/dashboard');
      setTimeout(() => refreshTournament(), 100);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la clôture');
    }
  };

  const currentDay = tournament?.current_day || 1;
  const catsToday = categories.filter(c => c.day_number === currentDay);

  if (loading && matches.length === 0) return <div className="p-8 text-center text-slate-400">Chargement...</div>;
  if (!tournament) return <div className="p-8 text-center text-slate-400">Chargement du tournoi...</div>;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto min-h-[calc(100vh-100px)]">
      {/* Sélecteur de Catégorie / Série de la journée active */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
            🏆 Brackets du Jour (Journée {currentDay}) :
          </span>
          {catsToday.map(cat => {
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
              </button>
            );
          })}
        </div>
      </div>

      {matches.length === 0 ? (
        ['draft', 'open', 'registration'].includes(tournament?.status || '') ? (
          <div className="p-8 max-w-2xl mx-auto text-center mt-12 bg-white rounded-3xl border border-slate-200 shadow-xl py-16">
            <div className="w-20 h-20 bg-slate-50 text-slate-400 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-100">
              <Lock className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 font-sans tracking-tight">Tableau Final Indisponible</h1>
            <p className="text-slate-500 mt-4 mb-8 text-sm leading-relaxed max-w-md mx-auto">
              Le tournoi est actuellement en phase <strong className="text-indigo-600">"Inscription / Pointage"</strong>. 
              Le tableau final pour la série <strong className="text-indigo-600">"{selectedCategory}"</strong> ne pourra être généré qu'une fois la phase d'inscription clôturée et la phase de poules complétée.
            </p>
            <button 
              disabled
              className="px-8 py-4 bg-slate-100 text-slate-400 rounded-2xl font-bold border border-slate-200 cursor-not-allowed text-sm flex items-center gap-2 mx-auto"
            >
              <Lock className="w-4 h-4" /> En attente de la clôture des inscriptions
            </button>
          </div>
        ) : (
          <div className="p-8 max-w-2xl mx-auto text-center mt-12 bg-white rounded-3xl border border-slate-200 shadow-xl py-16">
            <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Trophy className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900">Tableau Final de {selectedCategory}</h1>
            <p className="text-slate-500 mt-4 mb-8 text-sm leading-relaxed max-w-md mx-auto">
              Le tableau pour la série <strong className="text-indigo-600">"{selectedCategory}"</strong> de la journée courante n'est pas encore généré.
              Validez d'abord tous les matchs de poules de ce tableau pour générer le tableau final automatiquement.
            </p>
            <button 
              onClick={handleGenerate}
              disabled={generating}
              className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all text-sm active:scale-95"
            >
              {generating ? 'Génération du Tableau...' : 'Générer le Tableau Final'}
            </button>
          </div>
        )
      ) : (
        <>
          <div className="flex justify-between items-center mb-8 pr-4 flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 border-l-4 border-amber-500 pl-4">
                Tableau : {selectedCategory}
              </h1>
              <p className="text-slate-500 mt-2 pl-4">Gérez les matchs éliminatoires de ce tableau.</p>
            </div>
            <div className="flex gap-4">
              {tournament?.status === 'bracket' && (
                <button
                  onClick={handleCloseTournament}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-slate-100"
                >
                  <Lock className="w-5 h-5" />
                  Clôturer le tournoi
                </button>
              )}
              {matches.some(m => m.status === 'pending' && m.player1_id && m.player2_id) && (
                <button
                  onClick={handleLaunchAvailable}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Lancer les matchs
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-12 pb-12 items-start overflow-x-auto">
            {['eighthfinal', 'quarterfinal', 'semifinal', 'final', '3rd_place'].map((round) => {
              const roundMatches = matches.filter(m => m.round === round);
              if (roundMatches.length === 0 && round !== 'final') return null;

              const roundLabels: Record<string, string> = {
                'eighthfinal': 'Huitièmes',
                'quarterfinal': 'Quarts de Finale',
                'semifinal': 'Demi-Finales',
                'final': 'Grande Finale',
                '3rd_place': 'Petite Finale'
              };

              const getPlaceholder = (roundName: string, index: number, playerNum: 1 | 2) => {
                if (roundName === 'final') return `Vainqueur Demi ${playerNum}`;
                if (roundName === '3rd_place') return `Perdant Demi ${playerNum}`;
                if (roundName === 'semifinal') return `Vainqueur Quart ${index * 2 + playerNum}`;
                if (roundName === 'quarterfinal') return `Vainqueur Huitième ${index * 2 + playerNum}`;
                return '—';
              };

              return (
                <div key={round} className="w-72 shrink-0">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-10 text-center bg-slate-50 py-2 rounded-full border border-slate-100">
                    {roundLabels[round]}
                  </h3>
                  <div className={`space-y-12 ${round === 'final' || round === '3rd_place' ? 'pt-12' : ''}`}>
                    {roundMatches.map((match, idx) => (
                      <motion.div 
                        key={match.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`bg-white rounded-[2rem] border-2 shadow-sm overflow-hidden group transition-all ${
                          match.status === 'in_progress' ? 'border-indigo-400 ring-4 ring-indigo-50' : 
                          match.status === 'finished' ? 'border-slate-100 opacity-80' : 'border-slate-200 hover:border-amber-400'
                        } ${round === 'final' ? 'scale-105 mb-20 !border-amber-400 shadow-amber-100' : ''}`}
                      >
                        <div className="p-5 space-y-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className={`flex-1 font-black text-sm truncate ${
                              match.winner_id === match.player1_id ? 'text-amber-600' : 
                              !match.player1_id ? 'text-slate-300 italic font-medium' : 'text-slate-900'
                            }`}>
                              {match.player1?.last_name || getPlaceholder(round, idx, 1)}
                            </div>
                            <div className="w-8 h-8 flex items-center justify-center font-black text-slate-400 bg-slate-50 rounded-xl italic text-xs border border-slate-100 shadow-inner">
                              {match.sets?.filter(s => s.score_p1 > s.score_p2).length || 0}
                            </div>
                          </div>
                          <div className="h-px bg-slate-50" />
                          <div className="flex items-center justify-between gap-4">
                            <div className={`flex-1 font-black text-sm truncate ${
                              match.winner_id === match.player2_id ? 'text-amber-600' : 
                              !match.player2_id ? 'text-slate-300 italic font-medium' : 'text-slate-900'
                            }`}>
                              {match.player2?.last_name || getPlaceholder(round, idx, 2)}
                            </div>
                            <div className="w-8 h-8 flex items-center justify-center font-black text-slate-400 bg-slate-50 rounded-xl italic text-xs border border-slate-100 shadow-inner">
                              {match.sets?.filter(s => s.score_p2 > s.score_p1).length || 0}
                            </div>
                          </div>
                        </div>

                        {/* Scores des sets détaillés */}
                        {match.sets && match.sets.length > 0 && (
                          <div className="px-5 pb-4 flex flex-wrap gap-1.5">
                            {match.sets.sort((a, b) => (a.set_number || 0) - (b.set_number || 0)).map((set, sIdx) => (
                              <div key={set.id || sIdx} className="text-[9px] font-black bg-slate-50 text-slate-500 px-2 py-1 rounded-lg border border-slate-100 flex items-center gap-1 shadow-sm">
                                <span className={set.score_p1 > set.score_p2 ? 'text-amber-600' : ''}>{set.score_p1}</span>
                                <span className="text-slate-300">/</span>
                                <span className={set.score_p2 > set.score_p1 ? 'text-amber-600' : ''}>{set.score_p2}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div className={`px-5 py-3 flex justify-between items-center ${
                           match.status === 'in_progress' ? 'bg-indigo-600 text-white' : 
                           match.status === 'finished' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'
                        }`}>
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            {match.status === 'in_progress' ? `Table ${match.table_number}` : match.status === 'finished' ? 'Terminé' : 'Attente'}
                          </span>
                          <div className="flex items-center gap-2">
                            {match.status === 'pending' && match.player1_id && match.player2_id && (
                              <button
                                onClick={() => handleLaunchMatch(match.id)}
                                className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-slate-900 transition-all scale-110 active:scale-95 animate-pulse"
                                title="Lancer le match"
                              >
                                <Play className="w-3 h-3 fill-current" />
                              </button>
                            )}
                            {match.winner_id && <Trophy className={`w-3 h-3 ${round === 'final' ? 'text-amber-400' : 'text-green-400'}`} />}
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    {round === 'final' && roundMatches.length > 0 && roundMatches[0].winner_id && (
                      <motion.div 
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1.1, opacity: 1 }}
                        transition={{ type: 'spring', damping: 10 }}
                        className="flex flex-col items-center gap-4 mt-8 bg-amber-500/10 p-6 rounded-3xl border border-amber-500/20"
                      >
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center border-4 border-amber-400 shadow-xl">
                          <Trophy className="w-8 h-8 text-amber-600" />
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Champion de la Série</p>
                          <p className="text-xl font-black text-slate-900 leading-tight">
                            {roundMatches[0].winner_id === roundMatches[0].player1_id ? roundMatches[0].player1?.last_name : roundMatches[0].player2?.last_name}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
