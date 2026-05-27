import { useState, useEffect } from 'react';
import { useTournament } from '../../hooks/useTournament';
import { supabase } from '../../supabase';
import { Match } from '../../types';
import { generateBracket } from '../../utils/generateBracket';
import toast from 'react-hot-toast';
import { Trophy, Play, CheckCircle2, Lock as LockIcon, Grid3X3, ArrowRight, Eye, LayoutTemplate, List, Printer } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

const FIRST_TOUR_SEEDS: Record<number, number[]> = {
  2: [1, 2],
  4: [1, 4, 3, 2],
  8: [1, 8, 5, 4, 3, 6, 7, 2],
  16: [1, 16, 9, 8, 5, 12, 13, 4, 3, 14, 11, 6, 7, 10, 15, 2],
  32: [
    1, 32, 17, 16, 9, 24, 25, 8,
    5, 28, 21, 12, 13, 20, 29, 4,
    3, 30, 19, 14, 11, 22, 27, 6,
    7, 26, 23, 10, 15, 18, 31, 2
  ],
  64: [
    1, 64, 33, 32, 17, 48, 49, 16, 9, 56, 41, 24, 25, 40, 57, 8,
    5, 60, 37, 28, 21, 44, 53, 12, 13, 52, 45, 20, 29, 36, 61, 4,
    3, 62, 35, 30, 19, 46, 51, 14, 11, 54, 43, 22, 27, 38, 59, 6,
    7, 58, 39, 26, 23, 42, 55, 10, 15, 50, 47, 18, 31, 34, 63, 2
  ]
};

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
  const [tedSize, setTedSize] = useState<number>(16);
  const [viewMode, setViewMode] = useState<'tree' | 'columns'>('tree');

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
      
      // Trouver la catégorie correspondante
      const { data: cat } = await supabase
        .from('table_categories')
        .select('id')
        .eq('tournament_id', tournament.id)
        .eq('name', selectedCategory)
        .maybeSingle();

      if (!cat) {
        setMatches([]);
        return;
      }

      // Trouver le bracket de cette catégorie
      const { data: bracket } = await supabase
        .from('brackets')
        .select('id, ted_size')
        .eq('tournament_id', tournament.id)
        .eq('category_id', cat.id)
        .maybeSingle();

      if (!bracket) {
        setMatches([]);
        return;
      }

      setTedSize(bracket.ted_size || 16);

      const { data, error } = await supabase
        .from('matches')
        .select('*, player1:player1_id(*), player2:player2_id(*), sets(*)')
        .eq('tournament_id', tournament.id)
        .eq('bracket_id', bracket.id)
        .order('bracket_position', { ascending: true });

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
      // Trouver la catégorie correspondante
      const { data: cat } = await supabase
        .from('table_categories')
        .select('id')
        .eq('tournament_id', tournament.id)
        .eq('name', selectedCategory)
        .maybeSingle();

      if (!cat) return;

      // Trouver le bracket de cette catégorie
      const { data: bracket } = await supabase
        .from('brackets')
        .select('id')
        .eq('tournament_id', tournament.id)
        .eq('category_id', cat.id)
        .maybeSingle();

      if (!bracket) return;

      // 1. Get latest matches
      const { data: latestMatches } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournament.id)
        .eq('bracket_id', bracket.id)
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

  if (!tournament) {
    return (
      <div className="p-4 sm:p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 mb-4 border border-indigo-100 shadow-sm">
          <Trophy className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Aucun tournoi actif</h3>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          Vous n'avez pas encore créé ou sélectionné de tournoi. Créez ou sélectionnez-en un dans le Tableau de Bord pour gérer le tableau de phase finale.
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

  if (loading && matches.length === 0) return <div className="p-8 text-center text-slate-400">Chargement...</div>;

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
              <LockIcon className="w-10 h-10" />
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
              <LockIcon className="w-4 h-4" /> En attente de la clôture des inscriptions
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
          {/* Style d'impression injecté */}
          <style>{`
            @media print {
              .no-print {
                display: none !important;
              }
              body {
                background: white !important;
                color: black !important;
              }
              .print-container {
                padding: 0 !important;
                margin: 0 !important;
                box-shadow: none !important;
                border: none !important;
                background: white !important;
              }
              .print-scroll-tree {
                overflow: visible !important;
                width: 100% !important;
                transform: scale(0.9) !important;
                transform-origin: top left !important;
              }
            }
          `}</style>

          <div className="flex justify-between items-center mb-6 pr-4 flex-wrap gap-4 no-print">
            <div>
              <h1 className="text-3xl font-black text-slate-900 border-l-4 border-amber-500 pl-4 tracking-tight flex items-center gap-3">
                <Trophy className="w-8 h-8 text-amber-500 animate-bounce" />
                Tableau de Classement Final
              </h1>
              <p className="text-slate-500 mt-1 pl-4 text-xs font-medium">Gérez le déroulement du tableau final interactif et officiel.</p>
            </div>
            
            {/* Barre de contrôles double-vue, impression et actions */}
            <div className="flex gap-3 items-center flex-wrap">
              {/* Toggle de Vue */}
              <div className="bg-slate-100 p-1 rounded-xl border border-slate-200/60 flex gap-1 shadow-inner">
                <button
                  onClick={() => setViewMode('tree')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                    viewMode === 'tree'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Fiche Officielle FFTT connectée"
                >
                  <LayoutTemplate className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Fiche FFTT</span>
                </button>
                <button
                  onClick={() => setViewMode('columns')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                    viewMode === 'columns'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Vue Grille Simplifiée"
                >
                  <List className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Liste</span>
                </button>
              </div>

              {/* Action d’impression */}
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 text-slate-700 rounded-xl font-bold transition-all text-xs"
                title="Imprimer le tableau final"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>Format Papier</span>
              </button>

              {tournament?.status === 'bracket' && (
                <button
                  onClick={handleCloseTournament}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-md text-xs"
                >
                  <LockIcon className="w-4 h-4 text-amber-400" />
                  Clôturer le Tournoi
                </button>
              )}

              {matches.some(m => m.status === 'pending' && m.player1_id && m.player2_id) && (
                <button
                  onClick={handleLaunchAvailable}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md text-xs animate-pulse"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Lancer les matchs
                </button>
              )}
            </div>
          </div>

          {/* Rendu MULTI-MODE */}
          {viewMode === 'columns' ? (
            /* VUE LISTE SIMPLIFIÉE */
            <div className="flex gap-12 pb-12 items-start overflow-x-auto print-container print-scroll-tree">
              {['thirtysecondfinal', 'sixteenthfinal', 'eighthfinal', 'quarterfinal', 'semifinal', 'final'].map((round) => {
                const roundMatches = matches.filter(m => m.round === round);
                if (roundMatches.length === 0 && round !== 'final') return null;

                const roundLabels: Record<string, string> = {
                  'thirtysecondfinal': '32èmes',
                  'sixteenthfinal': '16èmes',
                  'eighthfinal': 'Huitièmes',
                  'quarterfinal': 'Quarts de Finale',
                  'semifinal': 'Demi-Finales',
                  'final': 'Grande Finale'
                };

                const getPlaceholder = (roundName: string, index: number, playerNum: 1 | 2) => {
                  if (roundName === 'final') return `Vainqueur Demi ${playerNum}`;
                  if (roundName === 'semifinal') return `Vainqueur Quart ${index * 2 + playerNum}`;
                  if (roundName === 'quarterfinal') return `Vainqueur Huitième ${index * 2 + playerNum}`;
                  if (roundName === 'eighthfinal') return `Vainqueur Seizième ${index * 2 + playerNum}`;
                  if (roundName === 'sixteenthfinal') return `Vainqueur Trente-deuxième ${index * 2 + playerNum}`;
                  return '—';
                };

                return (
                  <div key={round} className="w-72 shrink-0">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-10 text-center bg-slate-50 py-2 rounded-full border border-slate-100">
                      {roundLabels[round]}
                    </h3>
                    <div className={`space-y-12 ${round === 'final' ? 'pt-12' : ''}`}>
                      {roundMatches.map((match, idx) => (
                        <motion.div 
                          key={match.id}
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
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* SPLENDIDE MODE FICHE FFTT OFFICIELLE (Arbre avec connecteurs, graines bleues, bordures) */
            <div className="w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-lg print-container print-scroll-tree overflow-x-auto">
              
              {/* En-tête Bordeaux de délimitation FFTT */}
              <div className="flex min-w-[max-content] border-b-2 border-slate-900/10 mb-6 bg-slate-50/60 rounded-t-xl pr-20 relative">
                <div className="absolute top-0 bottom-0 left-0 w-full border-t-4 border-red-800/90 pointer-events-none rounded-t" />
                {(() => {
                  const rds = ['thirtysecondfinal', 'sixteenthfinal', 'eighthfinal', 'quarterfinal', 'semifinal', 'final'];
                  const orderedRounds = rds.filter(r => matches.some(m => m.round === r || (r === 'final' && tedSize >= 2)));
                  const roundLabels: Record<string, string> = {
                    'thirtysecondfinal': '1/32ème de Finale',
                    'sixteenthfinal': '1/16ème de Finale',
                    'eighthfinal': '1/8 de Finale',
                    'quarterfinal': '1/4 de Finale',
                    'semifinal': '1/2 Finale',
                    'final': 'Finale'
                  };
                  return orderedRounds.map((r) => (
                    <div key={r} className="w-[320px] shrink-0 text-center py-4 border-r border-red-800/10 last:border-r-0">
                      <span className="text-[12px] font-black text-red-800 tracking-wider uppercase font-sans">
                        {roundLabels[r] || 'Round'}
                      </span>
                    </div>
                  ));
                })()}
                {/* Section vainqueur en haut */}
                <div className="w-[200px] shrink-0 text-center py-4 flex items-center justify-center">
                  <span className="text-[12px] font-black text-indigo-800 tracking-wider uppercase font-sans">
                    Classement
                  </span>
                </div>
              </div>

              {/* Conteneur de l'Arbre avec hauteurs calculées doublant à chaque tour */}
              <div className="relative flex min-w-[max-content] pb-8 items-start pr-20">
                {(() => {
                  const rds = ['thirtysecondfinal', 'sixteenthfinal', 'eighthfinal', 'quarterfinal', 'semifinal', 'final'];
                  const orderedRounds = rds.filter(r => matches.some(m => m.round === r || (r === 'final' && tedSize >= 2)));
                  
                  const isFirstRound = (index: number) => index === 0;

                  // Hauteur constante d'un match de base au premier tour (112px permet un alignement parfait à 0px de débordement)
                  const blockHeight = 112;
                  const firstRoundMatchCount = Math.max(1, tedSize / 2);
                  const totalHeight = firstRoundMatchCount * blockHeight;

                  return (
                    <>
                      {orderedRounds.map((roundName, roundIdx) => {
                        const roundMatches = matches
                           .filter(m => m.round === roundName)
                           .sort((a, b) => (a.bracket_position || 0) - (b.bracket_position || 0));

                        // Le nombre de matches théoriques du tour en cours
                        const count = Math.max(1, firstRoundMatchCount / Math.pow(2, roundIdx));
                        // Hauteur d'une cellule de match à ce tour
                        const cellHeight = totalHeight / count;

                        return (
                          <div
                            key={roundName}
                            style={{ height: `${totalHeight}px` }}
                            className="w-[320px] shrink-0 flex flex-col justify-around relative"
                          >
                            {Array.from({ length: count }).map((_, matchIdx) => {
                              // Essayer de trouver le match de la BD à cette position de bracket
                              const targetPos = Math.round(firstRoundMatchCount - (firstRoundMatchCount / Math.pow(2, roundIdx)) + matchIdx);
                              const matchNumIndex = matchIdx;
                              
                              const matchObj = roundMatches.find(m => m.bracket_position === targetPos) || roundMatches[matchNumIndex];

                              // Placeholder de joueurs s'ils ne sont pas encore qualifiés
                              const getPlayerPlaceholder = (pNum: 1 | 2) => {
                                if (roundName === 'final') return `Vainqueur Demi ${pNum}`;
                                if (roundName === 'semifinal') return `Vainqueur Quart ${matchIdx * 2 + pNum}`;
                                if (roundName === 'quarterfinal') return `Vainqueur Huitième ${matchIdx * 2 + pNum}`;
                                if (roundName === 'eighthfinal') return `Vainqueur Seizième ${matchIdx * 2 + pNum}`;
                                if (roundName === 'sixteenthfinal') return `Vainqueur Trente-deuxième ${matchIdx * 2 + pNum}`;
                                return 'N.C.';
                              };

                              const p1Name = matchObj?.player1 ? `${matchObj.player1.first_name || ''} ${matchObj.player1.last_name}` : getPlayerPlaceholder(1);
                              const p2Name = matchObj?.player2 ? `${matchObj.player2.first_name || ''} ${matchObj.player2.last_name}` : getPlayerPlaceholder(2);

                              const p1Wins = matchObj?.sets && matchObj.sets.filter(s => s.score_p1 > s.score_p2).length;
                              const p2Wins = matchObj?.sets && matchObj.sets.filter(s => s.score_p2 > s.score_p1).length;

                              // Trouver le résultat des sets au tour précédent pour l'afficher en dessous de la ligne
                              const getPreviousMatchScore = (playerId: string | null | undefined, currentRoundName: string) => {
                                if (!playerId) return null;
                                const rdsList = ['thirtysecondfinal', 'sixteenthfinal', 'eighthfinal', 'quarterfinal', 'semifinal', 'final'];
                                const currentIdx = rdsList.indexOf(currentRoundName);
                                if (currentIdx <= 0) return null; // Pas de tour précédent possible
                                const prevRoundName = rdsList[currentIdx - 1];
                                
                                const prevMatch = matches.find(m => 
                                  m.round === prevRoundName && 
                                  (m.player1_id === playerId || m.player2_id === playerId) &&
                                  m.status === 'finished'
                                );
                                if (!prevMatch) return null;
                                
                                // Si c'est un forfait ou un bye (pas de vraie confrontation), pas de score de set à afficher
                                if (!prevMatch.player1_id || !prevMatch.player2_id) return null;
                                if (!prevMatch.sets || prevMatch.sets.length === 0) return null;
                                
                                const sortedSets = [...prevMatch.sets].sort((a, b) => a.set_number - b.set_number);
                                return sortedSets.map(s => {
                                  if (prevMatch.player1_id === playerId) {
                                    return `${s.score_p1}-${s.score_p2}`;
                                  } else {
                                    return `${s.score_p2}-${s.score_p1}`;
                                  }
                                }).join('  ');
                              };

                              const p1PrevScore = getPreviousMatchScore(matchObj?.player1_id, roundName);
                              const p2PrevScore = getPreviousMatchScore(matchObj?.player2_id, roundName);

                              // Chercher si les graines bleues de départ s'appliquent (uniquement au Tour 1)
                              const seedsList = FIRST_TOUR_SEEDS[tedSize] || [];
                              const p1SeedNum = isFirstRound(roundIdx) ? seedsList[matchIdx * 2] : null;
                              const p2SeedNum = isFirstRound(roundIdx) ? seedsList[matchIdx * 2 + 1] : null;

                              // Dessiner le connecteur d'arbre vers le tour suivant
                              const isLastRound = roundIdx === orderedRounds.length - 1;

                              // Un match est lançable s'il est en attente ("pending") et qu'il a 2 joueurs réels
                              const isMatchLaunchable = matchObj && matchObj.status === 'pending' && matchObj.player1_id && matchObj.player2_id;

                              // Calcul des lignes d'arrivée au pixel près
                              const y1 = Math.round(cellHeight / 4);
                              const y2 = Math.round((3 * cellHeight) / 4);

                              return (
                                <div
                                  key={matchObj?.id || `fake-${roundName}-${matchIdx}`}
                                  style={{ height: `${cellHeight}px` }}
                                  className="w-full relative select-none"
                                >
                                  {/* Joueur 1 */}
                                  <div 
                                    onClick={() => {
                                      if (isMatchLaunchable) {
                                        handleLaunchMatch(matchObj.id);
                                      } else if (matchObj?.status === 'in_progress' && matchObj.table_number) {
                                        navigate(`/table/${matchObj.table_number}`);
                                      }
                                    }}
                                    style={{
                                      position: 'absolute',
                                      top: `${y1 - 28}px`,
                                      left: '8px',
                                      width: '210px',
                                      height: '28px'
                                    }}
                                    className={`px-2.5 flex items-center justify-between border-b-2 border-slate-900 font-sans relative transition-all ${
                                      isMatchLaunchable ? 'cursor-pointer hover:bg-slate-50' : 
                                      (matchObj?.status === 'in_progress' && matchObj.table_number) ? 'cursor-pointer hover:bg-amber-50/40' : 'cursor-default'
                                    } ${
                                      matchObj?.winner_id === matchObj?.player1_id ? 'text-indigo-950 font-black' : 'text-slate-800 font-medium'
                                    } ${!matchObj?.player1_id ? 'text-slate-400 italic' : ''}`}
                                  >
                                    {/* Sticker/Languette Jaune discret FFTT pour le Seed et le nom */}
                                    <div className="absolute left-[3px] top-[3px] bottom-[3px] w-1 bg-yellow-400/80 rounded" />
                                    <div className="flex items-center min-w-0 flex-1 pl-1 text-[11px] truncate">
                                      {p1SeedNum && (
                                        <span className="text-indigo-700 bg-yellow-100/90 font-black rounded text-[10px] px-1 mr-1.5 border border-yellow-200">
                                          {p1SeedNum}
                                        </span>
                                      )}
                                      <span className="truncate">{p1Name}</span>
                                    </div>
                                    
                                    {/* Case de sets - uniquement si match réel joué et fini */}
                                    {matchObj?.status === 'finished' && matchObj?.player1_id && matchObj?.player2_id && matchObj?.sets && matchObj.sets.length > 0 && (
                                      <div className="bg-amber-100 text-amber-900 border border-amber-200/50 text-[10px] px-1.5 py-0.5 rounded font-bold ml-1 shrink-0">
                                        {p1Wins}
                                      </div>
                                    )}
                                  </div>

                                  {/* Score du set précédent affiché en dessous du Joueur 1 (méthode FFTT officielle) */}
                                  {p1PrevScore && (
                                    <div 
                                      style={{
                                        position: 'absolute',
                                        top: `${y1 + 1}px`,
                                        left: '16px',
                                      }}
                                      className="text-[9.5px] font-black text-indigo-700 font-mono bg-indigo-50 border border-indigo-150/80 px-1 py-0.2 rounded leading-none z-15"
                                    >
                                      {p1PrevScore}
                                    </div>
                                  )}

                                  {/* Joueur 2 */}
                                  <div 
                                    onClick={() => {
                                      if (isMatchLaunchable) {
                                        handleLaunchMatch(matchObj.id);
                                      } else if (matchObj?.status === 'in_progress' && matchObj.table_number) {
                                        navigate(`/table/${matchObj.table_number}`);
                                      }
                                    }}
                                    style={{
                                      position: 'absolute',
                                      top: `${y2 - 28}px`,
                                      left: '8px',
                                      width: '210px',
                                      height: '28px'
                                    }}
                                    className={`px-2.5 flex items-center justify-between border-b-2 border-slate-900 font-sans relative transition-all ${
                                      isMatchLaunchable ? 'cursor-pointer hover:bg-slate-50' : 
                                      (matchObj?.status === 'in_progress' && matchObj.table_number) ? 'cursor-pointer hover:bg-amber-50/40' : 'cursor-default'
                                    } ${
                                      matchObj?.winner_id === matchObj?.player2_id ? 'text-indigo-950 font-black' : 'text-slate-800 font-medium'
                                    } ${!matchObj?.player2_id ? 'text-slate-400 italic' : ''}`}
                                  >
                                    <div className="absolute left-[3px] top-[3px] bottom-[3px] w-1 bg-yellow-400/80 rounded" />
                                    <div className="flex items-center min-w-0 flex-1 pl-1 text-[11px] truncate">
                                      {p2SeedNum && (
                                        <span className="text-indigo-700 bg-yellow-100/90 font-black rounded text-[10px] px-1 mr-1.5 border border-yellow-200">
                                          {p2SeedNum}
                                        </span>
                                      )}
                                      <span className="truncate">{p2Name}</span>
                                    </div>

                                    {/* Case de sets - uniquement si match réel joué et fini */}
                                    {matchObj?.status === 'finished' && matchObj?.player1_id && matchObj?.player2_id && matchObj?.sets && matchObj.sets.length > 0 && (
                                      <div className="bg-amber-100 text-amber-950 border border-amber-200/50 text-[10px] px-1.5 py-0.5 rounded font-bold ml-1 shrink-0">
                                        {p2Wins}
                                      </div>
                                    )}
                                  </div>

                                  {/* Score du set précédent affiché en dessous du Joueur 2 (méthode FFTT officielle) */}
                                  {p2PrevScore && (
                                    <div 
                                      style={{
                                        position: 'absolute',
                                        top: `${y2 + 1}px`,
                                        left: '16px',
                                      }}
                                      className="text-[9.5px] font-black text-indigo-700 font-mono bg-indigo-50 border border-indigo-150/80 px-1 py-0.2 rounded leading-none z-15"
                                    >
                                      {p2PrevScore}
                                    </div>
                                  )}

                                  {/* TRACÉ DE L'ARBRE (Tracé d'embranchement FFTT raccordé aux lignes de vie des joueurs) */}
                                  {/* 1. Trait horizontal sortant du Joueur 1 */}
                                  <div 
                                    style={{ left: '218px', top: `${y1 - 2}px`, width: '42px' }}
                                    className="absolute h-[2px] bg-slate-900 z-10" 
                                  />

                                  {/* 2. Trait horizontal sortant du Joueur 2 */}
                                  <div 
                                    style={{ left: '218px', top: `${y2 - 2}px`, width: '42px' }}
                                    className="absolute h-[2px] bg-slate-900 z-10" 
                                  />

                                  {/* 3. Trait vertical reliant le haut et le bas */}
                                  <div 
                                    style={{ 
                                      left: '260px', 
                                      height: `${y2 - y1 + 2}px`,
                                      top: `${y1 - 2}px`
                                    }}
                                    className="absolute w-[2px] bg-slate-900 z-10"
                                  />

                                  {/* 4. Trait horizontal commun joignant le tour suivant (ou macaron final) */}
                                  {!isLastRound ? (
                                    <div 
                                      style={{ 
                                        left: '260px', 
                                        top: `${Math.round((y1 + y2) / 2) - 1}px`,
                                        width: '68px'
                                      }}
                                      className="absolute h-[2px] bg-slate-900 z-10"
                                    />
                                  ) : (
                                    <div 
                                      style={{ 
                                        left: '260px', 
                                        top: `${Math.round((y1 + y2) / 2) - 1}px`,
                                        width: '55px'
                                      }}
                                      className="absolute h-[2px] bg-slate-900 z-10"
                                    />
                                  )}

                                  {/* 5. LE BOUTON INTERACTIF / ARBITRAGE centré sur la verticalité du raccordement */}
                                  {matchObj && !(matchObj.status === 'finished' && (!matchObj.player1_id || !matchObj.player2_id)) && (
                                    <div 
                                      style={{
                                        left: '260px',
                                        top: `${Math.round((y1 + y2) / 2) - 1}px`
                                      }}
                                      className="absolute z-30 -translate-x-1/2 -translate-y-1/2 print:hidden"
                                    >
                                      {matchObj.status === 'pending' && matchObj.player1_id && matchObj.player2_id ? (
                                        <button 
                                          onClick={() => handleLaunchMatch(matchObj.id)}
                                          className="w-14 h-5.5 bg-indigo-600 hover:bg-slate-950 text-white border-2 border-white rounded-[6px] text-[8px] font-black uppercase tracking-wider shadow-md flex items-center justify-center gap-0.5 transition-all hover:scale-105 active:scale-95"
                                          title="Lancer le match sur une table libre"
                                        >
                                          <Play className="w-1.5 h-1.5 fill-current" />
                                          Lancer
                                        </button>
                                      ) : matchObj.status === 'in_progress' ? (
                                        <button 
                                          onClick={() => navigate(`/table/${matchObj.table_number}`)}
                                          className="w-14 h-5.5 bg-amber-500 hover:bg-amber-600 border-2 border-white text-slate-950 rounded-[6px] text-[8.5px] font-black uppercase text-center flex items-center justify-center shadow-md shadow-amber-200 transition-all hover:scale-105"
                                          title="Match en cours d'arbitrage. Aller à la table"
                                        >
                                          T.{matchObj.table_number}
                                        </button>
                                      ) : matchObj.status === 'finished' ? (
                                        <div
                                          className="w-[38px] h-5.5 bg-slate-950 border-2 border-white text-white rounded-[6px] text-[8.5px] font-extrabold text-center flex items-center justify-center shadow cursor-default select-none"
                                        >
                                          {p1Wins}-{p2Wins}
                                        </div>
                                      ) : (
                                        <div className="w-10 h-5.5 bg-slate-50 border border-slate-200 text-slate-400 rounded-[6px] text-[8px] font-black uppercase flex items-center justify-center">
                                          Att.
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* TRACÉ FINALE VERS LE CHAMPION (1er) */}
                                  {isLastRound && (
                                    <div 
                                      style={{ left: '315px', top: `${Math.round((y1 + y2) / 2) - 1}px` }}
                                      className="absolute -translate-y-1/2 z-20"
                                    >
                                      <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded shadow-sm">
                                        <Trophy className="w-3.5 h-3.5 text-amber-500 animate-pulse fill-amber-500" />
                                        <span className="text-[10px] font-black text-amber-600 tracking-widest uppercase">1er</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}

                      {/* TAMPON D'INFOS OFFICIELS FFTT EN BAS À DROITE */}
                      <div className="absolute bottom-4 right-10 z-30 flex flex-col items-end">
                        <div className="border-2 border-slate-950 bg-white p-4 font-mono text-[11px] w-[260px] tracking-wide shadow-lg rounded-xl flex flex-col justify-between">
                          <div className="space-y-1.5 text-slate-900">
                            <div className="flex justify-between border-b pb-1 font-extrabold">
                              <span>DATE :</span>
                              <span className="font-medium text-slate-700">
                                {new Date(tournament.created_at || Date.now()).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                            <div className="flex justify-between border-b pb-1 font-extrabold">
                              <span>EPREUVE :</span>
                              <span className="font-black text-red-900 truncate max-w-[170px]" title={selectedCategory}>
                                {selectedCategory}
                              </span>
                            </div>
                            <div className="flex justify-between font-extrabold">
                              <span>TABLEAU :</span>
                              <span className="font-bold text-slate-600">{tedSize} Joueurs (16D)</span>
                            </div>
                          </div>
                          <div className="text-[8px] text-right text-slate-400 mt-2 italic font-sans">
                            Système National d'Arbitrage FFTT
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* PETITE FINALE SUPPRIMÉE CONFORMÉMENT AUX DIRECTIVES */}
        </>
      )}
    </div>
  );
}
