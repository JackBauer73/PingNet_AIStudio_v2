import React from 'react';
import { BoardTable } from '../../hooks/useBoard';
import { getRoundLabel, getMatchStatusDetails } from '../../utils/roundLabel';

interface BoardTileProps {
  table: BoardTable;
  showScores?: boolean;
}

export const BoardTile: React.FC<BoardTileProps> = ({ table, showScores = false }) => {
  const { tableNumber, status, match, round, category, pool, players } = table;

  const isFree = status === 'available' || !match;

  // Render a free table vignette
  if (isFree) {
    return (
      <div 
        id={`table-tile-${tableNumber}`}
        className="relative flex flex-col justify-between p-5 min-h-[190px] rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-md text-slate-500 overflow-hidden group transition-all hover:border-slate-700/60"
      >
        {/* Top Header */}
        <div className="flex justify-between items-start">
          <span className="font-display font-extrabold text-[44px] leading-none text-slate-700 select-none">
            {tableNumber}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-slate-800/50 text-slate-600 select-none border border-slate-800/30">
            Libre
          </span>
        </div>

        {/* Median Info */}
        <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-600 font-semibold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
          Disponible
        </div>

        {/* Translucent Banner (Empty state styling) */}
        <div className="mt-auto h-[70px] flex items-center justify-center rounded-2xl bg-slate-950/20 border border-slate-800/10">
          <span className="text-xs text-slate-600 font-medium italic">Aucun match en cours</span>
        </div>
      </div>
    );
  }

  // Active table metadata
  const statusDetails = getMatchStatusDetails(status);
  const derivedShortName = category?.name
    ? category.name.replace(/^(tableau|série|serie|tous)\s+/i, '')
    : 'Match';

  const roundLabel = match ? getRoundLabel(match.round, pool?.name, category?.name) : '';

  // Get active match sets count per player
  let p1SetsWon = 0;
  let p2SetsWon = 0;
  if (match?.sets && match.sets.length > 0) {
    p1SetsWon = match.sets.filter(s => s.score_p1 > s.score_p2).length;
    p2SetsWon = match.sets.filter(s => s.score_p2 > s.score_p1).length;
  }

  // Background color style matching the exact category HEX code
  const tileHexBg = category?.color_code || '#4f46e5';

  // Choose text contrast color
  // Since we don't have the getContrastColor utility here, let's implement a quick inline relative luminance check or a default light text.
  // Table category colors are highly vibrant, so white text usually provides impeccable contrast,
  // but to be absolutely safe, let's default to high-opacity white which looks premium on almost all color keys when flanked by shadows.
  const mainWhite = 'text-white';

  // Check if status is pending (Appel) which triggers a subtle background scale pulsation
  const isPending = status === 'pending';

  return (
    <div
      id={`table-tile-${tableNumber}`}
      className={`relative flex flex-col justify-between p-5 min-h-[190px] rounded-[1.8rem] shadow-xl text-white overflow-hidden transition-all duration-300 transform border border-white/10 ${
        isPending ? 'animate-[pulse_2.2s_infinite]' : ''
      }`}
      style={{ backgroundColor: tileHexBg }}
    >
      {/* Top Header */}
      <div className="flex justify-between items-start">
        <span className="font-display font-black text-4xl sm:text-5xl leading-none tracking-tight select-none drop-shadow-md">
          {tableNumber}
        </span>
        <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase bg-black/25 text-white/90 select-none border border-white/5 shadow-xs">
          {derivedShortName}
        </span>
      </div>

      {/* Median info / Level & status indicator */}
      <div className="mt-3 flex justify-between items-center flex-wrap gap-2">
        <span className="text-sm font-extrabold tracking-tight select-none drop-shadow-sm truncate max-w-[130px]">
          {roundLabel}
        </span>
        
        {/* Match status badge inside rgba border */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/20 text-[10px] font-black uppercase tracking-wider border border-white/5 shadow-sm">
          <span className={`w-1.5 h-1.5 rounded-full ${
            status === 'in_progress' ? 'bg-emerald-400 animate-ping' : 
            status === 'pending' ? 'bg-orange-400 animate-pulse' : 
            status === 'awaiting_validation' ? 'bg-sky-400' :
            status === 'disputed' ? 'bg-red-400 animate-pulse' : 'bg-slate-400'
          }`} style={{ backgroundColor: statusDetails.color }} />
          <span className="text-[9px] text-white/90">{statusDetails.text}</span>
        </div>
      </div>

      {/* Inset Translucent Players Box */}
      <div className="mt-4 px-3 py-2 bg-black/28 backdrop-blur-[3px] rounded-2xl border border-white/8 space-y-1 w-full text-left">
        {players.map((p, idx) => {
          // If in pool, gray out the resting player (is_playing_now === false)
          const isResting = !p.is_playing_now && round === 'pool';
          
          // Match scores with current player ranking
          let playerSets = 0;
          let isCurrentPlayer1 = false;
          let isCurrentPlayer2 = false;

          if (match) {
            isCurrentPlayer1 = p.id === match.player1_id;
            isCurrentPlayer2 = p.id === match.player2_id;
            playerSets = isCurrentPlayer1 ? p1SetsWon : (isCurrentPlayer2 ? p2SetsWon : 0);
          }

          return (
            <div 
              key={p.id || idx} 
              className={`flex items-center justify-between text-xs transition-opacity ${
                isResting ? 'opacity-40 line-through decoration-white/20' : 'opacity-100 font-bold'
              }`}
            >
              {/* Player Name and club */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {round === 'pool' && (
                  <span className="text-[8px] opacity-70 select-none">
                    #{idx + 1}
                  </span>
                )}
                <span className="truncate uppercase font-extrabold tracking-tight text-[11px] sm:text-xs">
                  {p.last_name || '—'} <span className="capitalize font-semibold text-white/85 text-[10px] sm:text-[11px]">{p.first_name || ''}</span>
                </span>
                {p.points != null && (
                  <span className="text-[9px] font-mono opacity-70 select-none">
                    ({p.points} pts)
                  </span>
                )}
              </div>

              {/* Set score if requested and player is active */}
              {showScores && !isResting && (isCurrentPlayer1 || isCurrentPlayer2) && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-black/40 text-[10px] font-black text-amber-300 select-none shadow-inner border border-white/5 tabular-nums">
                  {playerSets}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
