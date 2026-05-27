import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../../hooks/useTournament';
import { useMatches } from '../../hooks/useMatches';
import { Clock, AlertTriangle, ArrowLeft, Search, Activity, Trophy, RefreshCw } from 'lucide-react';
import Logo from '../../components/layout/Logo';
import { motion, AnimatePresence } from 'motion/react';

export default function LiveScores() {
  const navigate = useNavigate();
  const { tournament } = useTournament();
  const { matches, loading, refresh } = useMatches(tournament?.id);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTableFilter, setSelectedTableFilter] = useState<string>('all');

  const activeMatches = matches.filter(m => m.status === 'in_progress');

  // Filtrer les matchs en fonction de la barre de recherche et du filtre de table
  const filteredMatches = activeMatches.filter(m => {
    const player1Name = m.player1?.last_name?.toLowerCase() || '';
    const player1First = m.player1?.first_name?.toLowerCase() || '';
    const player2Name = m.player2?.last_name?.toLowerCase() || '';
    const player2First = m.player2?.first_name?.toLowerCase() || '';
    const tableNumStr = m.table_number?.toString() || '';
    const query = searchQuery.toLowerCase();

    const matchesQuery = 
      player1Name.includes(query) || 
      player1First.includes(query) || 
      player2Name.includes(query) || 
      player2First.includes(query) ||
      tableNumStr.includes(query);

    if (selectedTableFilter === 'all') {
      return matchesQuery;
    } else if (selectedTableFilter === 'long') {
      const startedAt = m.started_at ? new Date(m.started_at) : null;
      const duration = startedAt ? Math.floor((new Date().getTime() - startedAt.getTime()) / 60000) : 0;
      return matchesQuery && duration > 25;
    }
    return matchesQuery;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a1729] text-[#0f1f3d] dark:text-slate-100 flex flex-col font-sans select-none">
      {/* Header public des scores en direct */}
      <header className="h-16 bg-white dark:bg-[#0f1f3d] border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-4 md:px-8 sticky top-0 z-12 w-full shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Accueil</span>
          </button>
          
          <div className="w-px h-6 bg-slate-200 dark:bg-white/10 hidden sm:block" />
          
          <div className="flex items-center gap-2">
            <Logo className="w-7 h-7" />
            <div className="flex flex-col">
              <span className="text-sm font-black tracking-tight text-slate-900 dark:text-white leading-none">Ping Manager</span>
              <span className="text-[9px] font-bold text-orange-500 uppercase mt-0.5 tracking-wider">Direct & Scores</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refresh(false)}
            className="p-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all text-slate-550 dark:text-slate-350"
            title="Rafraîchir les scores"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 rounded-full border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-450 text-[10px] sm:text-xs font-black uppercase tracking-wider animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Live
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-6">
        
        {/* Banner Informative */}
        <div className="bg-gradient-to-tr from-[#0a1729] to-[#0f1f3d] rounded-3xl p-6 md:p-8 border border-white/11 text-white relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-0 pointer-events-none" />
          <div className="relative z-10 space-y-2">
            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">
              {tournament ? tournament.name : 'Scores en Direct'}
            </h1>
            <p className="text-slate-350 text-xs sm:text-sm max-w-xl leading-relaxed">
              Consultez l'avancement des matches sur toutes les tables d'arbitrage de la compétition. Les scores se mettent automatiquement à jour sans rechargement.
            </p>
          </div>
        </div>

        {tournament ? (
          <>
            {/* Outils de filtre et recherche */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par nom ou table..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 dark:focus:border-indigo-500/40 text-slate-800 dark:text-slate-100 transition-all font-medium shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedTableFilter('all')}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                    selectedTableFilter === 'all'
                      ? 'bg-[#0f1f3d] dark:bg-white border-[#0f1f3d] dark:border-white text-white dark:text-[#0f1f3d] shadow-sm'
                      : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  Tous les matches
                </button>
                <button
                  onClick={() => setSelectedTableFilter('long')}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                    selectedTableFilter === 'long'
                      ? 'bg-red-600 border-red-600 text-white shadow-sm'
                      : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Matches prolongés
                </button>
              </div>
            </div>

            {/* Grille des Tables */}
            {loading ? (
              <div className="py-16 text-center text-slate-400 dark:text-slate-500">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                Chargement en direct...
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="bg-white dark:bg-white/[0.02] p-12 rounded-3xl border border-slate-200 dark:border-white/10 text-center font-sans">
                <div className="w-16 h-16 bg-slate-50 dark:bg-white/[0.03] rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-white/5">
                  <Clock className="w-8 h-8 text-slate-330 dark:text-slate-550" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Aucun match en cours</h3>
                <p className="text-slate-400 dark:text-slate-500 text-sm mt-1 max-w-sm mx-auto">
                  {searchQuery ? "Aucune table ne correspond à vos critères de recherche en cours de jeu." : "Aucun match n'est en cours sur les tables pour le moment. Revenez bientôt !"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AnimatePresence mode="popLayout">
                  {filteredMatches.map(match => {
                    const startedAt = match.started_at ? new Date(match.started_at) : null;
                    const duration = startedAt ? Math.floor((new Date().getTime() - startedAt.getTime()) / 60000) : 0;
                    const isLong = duration > 25;

                    const setsP1 = match.sets?.filter((s: any) => s.score_p1 > s.score_p2).length || 0;
                    const setsP2 = match.sets?.filter((s: any) => s.score_p2 > s.score_p1).length || 0;

                    return (
                      <motion.div
                        key={match.id}
                        layout
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white dark:bg-white/[0.02] p-6 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm relative overflow-hidden"
                      >
                        {/* En-tête de la carte */}
                        <div className="flex justify-between items-center mb-6">
                          <span className="px-3 py-1 bg-[#0f1f3d] dark:bg-white/10 text-white rounded-lg text-xs font-black uppercase tracking-widest italic">
                            Table {match.table_number}
                          </span>
                          
                          <div className={`flex items-center gap-1 text-xs font-bold ${isLong ? 'text-red-500 animate-pulse' : 'text-slate-400 dark:text-slate-500'}`}>
                            <Clock className="w-3.5 h-3.5" />
                            <span>{duration} min</span>
                            {isLong && <AlertTriangle className="w-3.5 h-3.5 ml-1" title="Match particulièrement long" />}
                          </div>
                        </div>

                        {/* Corps : Affichage des adversaires et du score */}
                        <div className="flex items-center justify-between gap-4 relative z-10">
                          {/* Joueur 1 */}
                          <div className="flex-1 text-right min-w-[30%]">
                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">P1</p>
                            <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate" title={match.player1?.last_name}>
                              {match.player1?.last_name?.toUpperCase()}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold truncate">
                              {match.player1?.club || 'Sans Club'}
                            </p>
                          </div>

                          {/* Zone de score */}
                          <div className="flex flex-col items-center shrink-0">
                            <div className="flex items-center gap-2">
                              {/* Sets remportés P1 */}
                              <div className="w-12 h-12 bg-slate-55 dark:bg-white/[0.04] rounded-xl flex items-center justify-center text-2xl font-black italic shadow-inner border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white">
                                {setsP1}
                              </div>
                              <span className="text-slate-300 dark:text-slate-700 font-black text-xl">:</span>
                              {/* Sets remportés P2 */}
                              <div className="w-12 h-12 bg-slate-55 dark:bg-white/[0.04] rounded-xl flex items-center justify-center text-2xl font-black italic shadow-inner border border-slate-100 dark:border-white/5 text-slate-800 dark:text-white">
                                {setsP2}
                              </div>
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-2">Sets</span>
                          </div>

                          {/* Joueur 2 */}
                          <div className="flex-1 text-left min-w-[30%]">
                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">P2</p>
                            <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate" title={match.player2?.last_name}>
                              {match.player2?.last_name?.toUpperCase()}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold truncate">
                              {match.player2?.club || 'Sans Club'}
                            </p>
                          </div>
                        </div>

                        {/* Historique des sets en cours de jeu */}
                        {match.sets && match.sets.length > 0 && (
                          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-white/5 flex flex-wrap justify-center gap-2.5">
                            {match.sets.map((s: any, idx: number) => {
                              const isP1Winner = s.score_p1 > s.score_p2;
                              return (
                                <div
                                  key={s.id}
                                  className="text-[10px] font-black bg-slate-50 dark:bg-white/[0.03] px-2.5 py-1.5 rounded-xl border border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400 flex items-center gap-1"
                                >
                                  <span className="text-slate-400 dark:text-slate-600 font-bold mr-0.5">S{idx + 1}</span>
                                  <span className={isP1Winner ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-800 dark:text-slate-200'}>{s.score_p1}</span>
                                  <span className="text-slate-300 dark:text-slate-700">-</span>
                                  <span className={!isP1Winner ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-800 dark:text-slate-200'}>{s.score_p2}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        {/* Notice consultative discrète et esthétique */}
                        <div className="mt-5 pt-4 border-t border-dashed border-slate-100 dark:border-white/5 text-center">
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                            <Activity className="w-3 h-3" />
                            Consultation uniquement • En direct
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </>
        ) : (
          <div className="p-12 text-center rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02]">
            <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="font-bold text-lg text-slate-700 dark:text-slate-300">Aucun tournoi sélectionné</p>
            <p className="text-sm text-slate-450 mt-1">Veuillez sélectionner un tournoi depuis l'accueil.</p>
          </div>
        )}
      </main>

      {/* Footer public */}
      <footer className="mt-auto border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f1f3d] py-6 text-center text-slate-400 dark:text-slate-550 shrink-0 select-none">
        <p className="text-[10px] font-bold uppercase tracking-widest">Ping Manager • Tous droits réservés</p>
      </footer>
    </div>
  );
}
