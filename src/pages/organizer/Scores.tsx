import React from 'react';
import { useTournament } from '../../hooks/useTournament';
import { useMatches } from '../../hooks/useMatches';
import { Clock, AlertTriangle, ExternalLink } from 'lucide-react';

export default function Scores() {
  const { tournament } = useTournament();
  const { matches, loading } = useMatches(tournament?.id);

  const activeMatches = matches.filter(m => m.status === 'in_progress');

  if (loading) return <div className="p-8 text-center">Chargement...</div>;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end items-stretch gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 border-l-4 border-indigo-500 pl-4">
            Direct & Scores
          </h1>
          <p className="text-slate-500 mt-1 pl-4 text-xs sm:text-sm">
            Supervisez les matchs en cours sur toutes les tables.
          </p>
        </div>
      </div>

      {activeMatches.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Aucun match en cours</h3>
          <p className="text-slate-500 mt-2">Allez dans la section "Poules" ou "Tableau" pour lancer des matchs.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {activeMatches.map(match => {
            const startedAt = match.started_at ? new Date(match.started_at) : null;
            const duration = startedAt ? Math.floor((new Date().getTime() - startedAt.getTime()) / 60000) : 0;
            const isLong = duration > 30;

            return (
              <div key={match.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <div className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-black uppercase tracking-widest italic">
                    Table {match.table_number}
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs font-bold ${isLong ? 'text-red-500' : 'text-slate-400'}`}>
                    <Clock className="w-3.5 h-3.5" />
                    {duration} min
                    {isLong && <AlertTriangle className="w-3.5 h-3.5" />}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">P1</p>
                    <p className="text-lg font-black text-slate-900">{match.player1?.last_name}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{match.player1?.club}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-2xl font-black italic shadow-inner border border-slate-100">
                      {match.sets?.filter(s => s.score_p1 > s.score_p2).length || 0}
                    </div>
                    <div className="text-slate-200 font-black text-xl">:</div>
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-2xl font-black italic shadow-inner border border-slate-100">
                      {match.sets?.filter(s => s.score_p2 > s.score_p1).length || 0}
                    </div>
                  </div>

                  <div className="flex-1 text-left">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">P2</p>
                    <p className="text-lg font-black text-slate-900">{match.player2?.last_name}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{match.player2?.club}</p>
                  </div>
                </div>

                {match.sets && match.sets.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-slate-50 flex justify-center gap-4">
                    {match.sets.map(s => (
                      <div key={s.id} className="text-[10px] font-black bg-slate-50 px-2 py-1 rounded text-slate-400">
                        {s.score_p1}-{s.score_p2}
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-6 flex justify-center">
                  <a 
                    href={`/table/${match.table_number}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-widest bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 transition-colors"
                  >
                    Ouvrir la vue table
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
