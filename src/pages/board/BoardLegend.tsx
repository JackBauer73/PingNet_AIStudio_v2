import React from 'react';
import { TableCategory } from '../../types';

interface BoardLegendProps {
  categories: TableCategory[];
}

export const BoardLegend: React.FC<BoardLegendProps> = ({ categories }) => {
  if (!categories || categories.length === 0) return null;

  return (
    <div className="w-full bg-slate-900/40 border-t border-slate-800/80 px-6 py-4 select-none backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex flex-wrap justify-center items-center gap-x-6 gap-y-3">
        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest border-r border-slate-800 pr-5 select-none">
          Légende Tableaux
        </span>
        
        <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2">
          {categories.map((cat) => {
            const hex = cat.color_code || '#4f46e5';
            
            // Derive abbreviation
            const shortCode = cat.name.replace(/^(tableau|série|serie|tous)\s+/i, '');
            
            // Format points limit
            let ptsLabel = '';
            if (cat.min_points > 0 && cat.max_points < 9999) {
              ptsLabel = `${cat.min_points} - ${cat.max_points} pts`;
            } else if (cat.max_points < 9999) {
              ptsLabel = `< ${cat.max_points} pts`;
            } else if (cat.min_points > 0) {
              ptsLabel = `> ${cat.min_points} pts`;
            } else {
              ptsLabel = 'Toutes séries';
            }

            return (
              <div 
                key={cat.id} 
                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-950/20 border border-slate-800/60"
              >
                {/* Colored circle */}
                <span 
                  className="w-2.5 h-2.5 rounded-full border border-white/10" 
                  style={{ backgroundColor: hex }}
                />
                <span className="text-[11px] font-black uppercase tracking-tight text-slate-200">
                  {shortCode}
                </span>
                <span className="text-[10px] font-mono font-medium text-slate-400 opacity-80">
                  ({ptsLabel})
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
