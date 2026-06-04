import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useBoard } from '../../hooks/useBoard';
import { BoardTile } from './BoardTile';
import { BoardLegend } from './BoardLegend';
import { Clock, Maximize, Minimize, Tv, Volume2, ServerCrash, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Board() {
  const [searchParams] = useSearchParams();
  const { tournament, tables, categories, loading, error, refresh } = useBoard();

  // Settings from query params
  const fromNum = parseInt(searchParams.get('from') || '', 10);
  const toNum = parseInt(searchParams.get('to') || '', 10);
  const categoryFilter = searchParams.get('category') || '';
  const zoneFilter = searchParams.get('zone') || '';
  const scoreParam = searchParams.get('scores') === '1' || searchParams.get('scores') === 'true';

  // Toggle state for live scores
  const [showScores, setShowScores] = useState(scoreParam);
  // Fullscreen tracking state
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Pagination tracking state
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 24;

  // Realtime clock
  const [timeStr, setTimeStr] = useState('');

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {}
  };

  // Clock tick
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Screen Wake Lock API to prevent TV going to sleep
  useEffect(() => {
    let wakeLock: any = null;
    const acquireWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        // Silent catch
      }
    };
    acquireWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  // Filter and sort tables
  const processedTables = useMemo(() => {
    let list = [...tables];

    // Filter by physical table range
    if (!isNaN(fromNum)) {
      list = list.filter(t => t.tableNumber >= fromNum);
    }
    if (!isNaN(toNum)) {
      list = list.filter(t => t.tableNumber <= toNum);
    }

    // Filter by category id or name
    if (categoryFilter) {
      const normCatFilter = categoryFilter.toLowerCase().trim();
      list = list.filter(t => {
        if (!t.category) return false;
        return (
          t.category.id === categoryFilter ||
          t.category.name.toLowerCase().includes(normCatFilter)
        );
      });
    }

    // Filter by zone (custom physical range mapping, zone A can be 1-12, zone B 13-24, count on it nicely)
    if (zoneFilter) {
      const zone = zoneFilter.toLowerCase().trim();
      if (zone === 'a') {
        list = list.filter(t => t.tableNumber <= 12);
      } else if (zone === 'b') {
        list = list.filter(t => t.tableNumber > 12 && t.tableNumber <= 24);
      } else if (zone === 'c') {
        list = list.filter(t => t.tableNumber > 24);
      }
    }

    // Sort strategy: Pending (Appel) tables FIRST, then by table number
    list.sort((a, b) => {
      const aPending = a.status === 'pending';
      const bPending = b.status === 'pending';
      if (aPending && !bPending) return -1;
      if (!aPending && bPending) return 1;
      return a.tableNumber - b.tableNumber;
    });

    return list;
  }, [tables, fromNum, toNum, categoryFilter, zoneFilter]);

  // Page split logic
  const totalPages = Math.ceil(processedTables.length / itemsPerPage);
  
  const currentTablesSlice = useMemo(() => {
    const startIndex = currentPage * itemsPerPage;
    return processedTables.slice(startIndex, startIndex + itemsPerPage);
  }, [processedTables, currentPage, itemsPerPage]);

  // Page rotation effect
  useEffect(() => {
    if (totalPages <= 1) {
      setCurrentPage(0);
      return;
    }
    const interval = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % totalPages);
    }, 15000); // 15s page rotation as specified in 4.3

    return () => clearInterval(interval);
  }, [totalPages]);

  // Handle errors
  if (error) {
    return (
      <div className="min-h-screen bg-[#0b1120] text-white flex flex-col items-center justify-center p-8 select-none font-sans">
        <ServerCrash className="w-16 h-16 text-rose-500 mb-4 animate-bounce" />
        <h1 className="text-2xl font-black mb-2 tracking-tight">Erreur de connexion au tableau</h1>
        <p className="text-slate-400 text-sm max-w-md text-center mb-6">
          {error}
        </p>
        <button 
          onClick={refresh}
          className="px-6 py-2 bg-indigo-600 rounded-xl hover:bg-indigo-700 font-bold transition-all"
        >
          Réessayer
        </button>
      </div>
    );
  }

  // Not started or draft
  const hasNoTournament = !tournament;
  const isDraftState = tournament?.status === 'draft' || tournament?.status === 'registration';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1120] text-slate-400 flex flex-col items-center justify-center p-8 font-sans select-none">
        <Tv className="w-14 h-14 text-indigo-500/80 mb-4 animate-pulse" />
        <p className="text-sm font-semibold uppercase tracking-widest animate-pulse text-indigo-300">
          Chargement de l'écran de salle...
        </p>
      </div>
    );
  }

  if (hasNoTournament || isDraftState) {
    return (
      <div className="min-h-screen bg-[#0b1120] text-white flex flex-col items-center justify-center p-8 select-none font-sans">
        <Tv className="w-16 h-16 text-indigo-500 mb-4" />
        <h1 className="text-2xl font-black mb-2 tracking-tight">Aucun tournoi actif</h1>
        <p className="text-slate-400 text-sm text-center max-w-sm mb-6">
          Le tournoi n'a pas encore commencé ou n'est plus actif aujourd'hui.
        </p>
        <Link 
          to="/" 
          className="px-6 py-2 bg-indigo-600 rounded-xl hover:bg-indigo-700 font-bold transition-all text-xs uppercase tracking-widest"
        >
          Retour au site
        </Link>
      </div>
    );
  }

  return (
    <div id="board-layout" className="min-h-screen bg-[#0b1120] text-white flex flex-col select-none font-sans overflow-x-hidden">
      {/* Upper protective margins */}
      <div className="pt-[2.5vh] px-[2.5vw] flex-1 flex flex-col">
        {/* TV Header Banner */}
        <header className="flex flex-wrap justify-between items-center gap-4 pb-4 border-b border-slate-800/80 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
              <Tv className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight select-none uppercase font-display">
                Tables & Appels
              </h1>
              <p className="text-xs font-mono font-bold text-indigo-400/80">
                {tournament.name} {tournament.current_day ? `· Jour ${tournament.current_day}` : ''}
              </p>
            </div>
          </div>

          {/* Central Controls (Scores display toggle & Page navigation) */}
          <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800/60 flex-wrap">
            <button
              onClick={() => setShowScores(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
                showScores 
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg' 
                  : 'bg-slate-950/20 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              Scores {showScores ? 'Actifs' : 'Masqués'}
            </button>

            {totalPages > 1 && (
              <div className="inline-flex items-center gap-1 border-l border-slate-800/85 pl-2 ml-1 text-xs">
                <button 
                  onClick={() => setCurrentPage(prev => (prev - 1 + totalPages) % totalPages)}
                  className="p-1 rounded-lg bg-slate-950/40 border border-slate-800 hover:border-slate-700 transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono font-bold text-slate-300">
                  Page {currentPage + 1} / {totalPages}
                </span>
                <button 
                  onClick={() => setCurrentPage(prev => (prev + 1) % totalPages)}
                  className="p-1 rounded-lg bg-slate-950/40 border border-slate-800 hover:border-slate-700 transition"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Clock & Fullscreen Switch */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-2 rounded-2xl border border-slate-800/60 text-slate-300">
              <Clock className="w-4 h-4 text-indigo-400 animate-pulse" />
              <span className="font-mono text-sm font-black tracking-widest tabular-nums select-none">
                {timeStr}
              </span>
            </div>

            <button
              onClick={toggleFullscreen}
              className="p-2.5 bg-slate-900/50 rounded-2xl border border-slate-800/60 text-slate-400 hover:text-white transition-all hover:bg-slate-800/30"
              title={isFullscreen ? "Quitter le plein écran" : "Passez en plein écran"}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Empty Tables Filter Trigger Alert */}
        {processedTables.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center py-20 bg-slate-900/10 border border-dashed border-slate-800/55 rounded-[2.5rem]">
            <Tv className="w-14 h-14 text-slate-700 mb-3" />
            <p className="text-sm text-slate-500 font-semibold uppercase tracking-wider">
              Aucune table active sur cette plage de filtrage.
            </p>
            <p className="text-xs text-slate-600 mt-1 max-w-sm text-center">
              Vérifiez vos paramètres d'URL (ex: {`?from=1&to=12`}) ou assurez-vous que des matchs sont actuellement lancés.
            </p>
          </div>
        ) : (
          /* Tables Grid Auto-adaptive */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 pb-[2.5vh]">
            {currentTablesSlice.map((table) => (
              <BoardTile 
                key={table.tableNumber} 
                table={table} 
                showScores={showScores} 
              />
            ))}
          </div>
        )}
      </div>

      {/* Auto Legend Display at the bottom */}
      <footer className="mt-auto">
        <BoardLegend categories={categories} />
      </footer>
    </div>
  );
}
