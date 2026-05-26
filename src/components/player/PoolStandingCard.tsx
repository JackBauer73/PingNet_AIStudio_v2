import React from 'react';
import { PoolStanding } from '../../types';

interface Props {
  standing: PoolStanding[];
  playerId: string;
}

export function PoolStandingCard({ standing, playerId }: Props) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-705 bg-slate-900/40 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
              <th className="px-4 py-3 text-left">Joueur</th>
              <th className="px-3 py-3 text-center">V</th>
              <th className="px-3 py-3 text-center">Sets</th>
              <th className="px-3 py-3 text-center">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standing.map((row, idx) => {
              const isMe = row.player_id === playerId;
              return (
                <tr
                  key={row.player_id}
                  className={`border-b border-slate-700/40 last:border-0 hover:bg-slate-700/25 transition-colors ${
                    isMe ? 'bg-orange-500/10' : ''
                  }`}
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-bold font-mono text-[10px] w-3">{idx + 1}.</span>
                      <span className={`font-extrabold ${isMe ? 'text-orange-400' : 'text-slate-200'}`}>
                        {row.last_name?.toUpperCase()} {row.first_name}
                      </span>
                      {isMe && <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.2 rounded-full font-extrabold">moi</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-center font-bold text-slate-300 font-mono">
                    {row.wins}
                  </td>
                  <td className="px-3 py-3.5 text-center text-[11px] text-slate-400 font-mono">
                    {row.sets_won}:{row.sets_lost}
                  </td>
                  <td className="px-3 py-3.5 text-center font-bold text-slate-200 font-mono">
                    {row.points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Realtime Pulsating Banner */}
      <footer className="px-4 py-2 bg-slate-900/50 border-t border-slate-700/40 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
          Mise à jour en direct
        </span>
      </footer>
    </div>
  );
}
export default PoolStandingCard;
