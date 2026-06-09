import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Trophy } from 'lucide-react';
import { useTournament } from '../../hooks/useTournament';
import { supabase } from '../../supabase';
import Logo from './Logo';

export default function Header() {
  const { tournament, allTournaments, selectTournament } = useTournament();
  const [clubName, setClubName] = useState('Organisateur');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.club_name) {
        setClubName(user.user_metadata.club_name);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.user_metadata?.club_name) {
        setClubName(session.user.user_metadata.club_name);
      } else if (!session) {
        setClubName('Organisateur');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const firstLetter = clubName.charAt(0).toUpperCase();

  return (
    <header className="h-16 bg-[#081425]/95 border-b border-[#1a3056] flex items-center justify-between px-4 md:px-8 sticky top-0 z-40 w-full shrink-0 backdrop-blur-md">
      {/* Dynamic Tournament & Day / Date Information inside the Header */}
      <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
        {/* Mobile brand display - keep Logo in top-left as backup on mobile */}
        <Link to="/" className="flex items-center gap-2 lg:hidden hover:opacity-90 transition-opacity shrink-0">
          <Logo className="w-8 h-8" />
        </Link>

        {tournament ? (
          <div className="flex items-center gap-2.5 min-w-0 md:gap-4 border-l-0 lg:border-l-0 pl-0">
            <div className="hidden sm:flex items-center gap-2 text-[#f97316] shrink-0">
              <Trophy className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 min-w-0">
              <h1 className="text-sm sm:text-base md:text-lg font-extrabold text-white truncate tracking-tight select-none leading-none">
                {tournament.name}
              </h1>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-extrabold bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20 uppercase tracking-widest">
                  Jour {tournament.current_day || 1}
                </span>
                <span className="text-[10px] md:text-xs text-slate-400 font-medium">
                  {tournament.date ? new Date(tournament.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <span className="text-xs md:text-sm font-semibold tracking-tight text-slate-400 select-none">
            Aucun tournoi actif
          </span>
        )}
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-3 sm:gap-6 shrink-0">
        <button className="relative p-2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-[#081425]"></span>
        </button>
        
        <div className="flex items-center gap-2 sm:gap-3 border-l border-[#1a3056] pl-3 sm:pl-6">
          <div className="text-right hidden sm:block select-none">
            <p className="text-sm font-bold text-[#d8e3fb] leading-none">{clubName}</p>
            <p className="text-[10px] font-bold text-[#f97316]/90 uppercase tracking-widest mt-1">Espace Club</p>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#f97316]/10 text-[#f97316] font-black border-2 border-[#f97316]/20 rounded-full flex items-center justify-center text-xs sm:text-sm shadow-sm select-none">
            {firstLetter}
          </div>
        </div>
      </div>
    </header>
  );
}
