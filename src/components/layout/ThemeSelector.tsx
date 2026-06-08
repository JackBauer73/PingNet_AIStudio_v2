import React, { useState, useEffect } from 'react';
import { Palette } from 'lucide-react';

export default function ThemeSelector() {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pm-theme') || 'classic';
    }
    return 'classic';
  });

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('theme-apex', 'theme-retro', 'theme-emerald', 'theme-light');
    
    if (theme === 'apex') {
      html.classList.add('theme-apex');
    } else if (theme === 'retro') {
      html.classList.add('theme-retro');
    } else if (theme === 'emerald') {
      html.classList.add('theme-emerald');
    } else if (theme === 'light') {
      html.classList.add('theme-light');
    }
    
    localStorage.setItem('pm-theme', theme);
  }, [theme]);

  return (
    <div className="flex items-center gap-1.5 bg-slate-950/40 border border-slate-800/80 px-2 py-1.5 md:px-3 rounded-xl shadow-inner select-none transition-all hover:border-slate-700/80">
      <Palette className="w-3.5 h-3.5 text-[#f97316] shrink-0 animate-pulse" />
      <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 hidden sm:inline">Design:</span>
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className="bg-transparent text-white font-extrabold focus:outline-none cursor-pointer border-none text-[11px] font-sans pr-1"
        style={{ colorScheme: 'dark' }}
      >
        <option value="classic" className="bg-slate-950 text-white font-sans font-extrabold">🌌 Classique Space</option>
        <option value="apex" className="bg-slate-950 text-white font-sans font-extrabold">⚡ Apex System</option>
        <option value="emerald" className="bg-slate-950 text-[#10b981] font-sans font-extrabold">🌿 Midnight & Emerald</option>
        <option value="light" className="bg-slate-950 text-[#38bdf8] font-sans font-extrabold">☀️ Clair Sophistiqué</option>
        <option value="retro" className="bg-slate-950 text-[#22c55e] font-sans font-extrabold">📟 Arcade Retro</option>
      </select>
    </div>
  );
}
