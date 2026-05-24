import { Bell, Search } from 'lucide-react';
import { useTournament } from '../../hooks/useTournament';

export default function Header() {
  const { tournament } = useTournament();

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-10 w-full shrink-0">
      {/* Mobile brand display */}
      <div className="flex items-center gap-2 lg:hidden">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <span className="font-bold text-sm text-white font-mono">TT</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-slate-900 leading-none">TournoisTT</span>
          {tournament && (
            <span className="text-[9px] font-bold text-indigo-550 mt-0.5">
              Journée {tournament.current_day || 1}
            </span>
          )}
        </div>
      </div>

      {/* Desktop/Tablet search input */}
      <div className="hidden md:flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-full border border-slate-200 w-80 lg:w-96">
        <Search className="w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Rechercher un joueur, un match..." 
          className="bg-transparent border-none text-sm focus:outline-none w-full text-slate-600"
        />
      </div>

      <div className="flex items-center gap-3 sm:gap-6">
        <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="flex items-center gap-2 sm:gap-3 border-l border-slate-200 pl-3 sm:pl-6">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-900 leading-none">Admin Club</p>
            <p className="text-xs text-slate-500 mt-1">Organisateur</p>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold border-2 border-indigo-200 text-xs sm:text-sm">
            A
          </div>
        </div>
      </div>
    </header>
  );
}
