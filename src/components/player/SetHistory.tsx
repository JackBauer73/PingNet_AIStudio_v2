import React from 'react';
import { Match, SetScore } from '../../types';

interface Props {
  sets: SetScore[];
  match: Match | null;
  playerId: string;
}

export function SetHistory({ sets, match, playerId }: Props) {
  if (!match) return null;

  const isP1 = match.player1_id === playerId;
  const myName = isP1 ? match.player1?.last_name || 'Moi' : match.player2?.last_name || 'Moi';
  const oppName = isP1 ? match.player2?.last_name || 'Adversaire' : match.player1?.last_name || 'Adversaire';

  return (
    <div className="w-full max-w-md mx-auto pt-6 px-4">
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 shadow-xl">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-4">
          Histoires des Sets Saisis
        </h3>
        {sets.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-4 italic">Aucun set n'a encore été saisi</p>
        ) : (
          <div className="space-y-2">
            {sets.map((set, index) => {
              const myScore = isP1 ? set.score_p1 : set.score_p2;
              const oppScore = isP1 ? set.score_p2 : set.score_p1;
              const iWon = myScore > oppScore;

              return (
                <div
                  key={set.id || index}
                  className="flex items-center justify-between px-4 py-2 bg-slate-900/60 border border-slate-700/40 rounded-xl"
                >
                  <span className="text-[11px] font-black text-slate-500 uppercase">Set {set.set_number || index + 1}</span>
                  <div className="flex items-center gap-4 text-sm font-extrabold font-mono">
                    <span className={iWon ? 'text-green-400' : 'text-slate-350'}>{myScore}</span>
                    <span className="text-slate-600 font-sans font-light">-</span>
                    <span className={!iWon ? 'text-orange-400' : 'text-slate-350'}>{oppScore}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-4 pt-3 border-t border-slate-700/50 px-1">
          <span>{myName}</span>
          <span>{oppName}</span>
        </div>
      </div>
    </div>
  );
}
export default SetHistory;
