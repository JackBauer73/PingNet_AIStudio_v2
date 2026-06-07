import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTournament } from '../../hooks/useTournament';
import { UserCheck, Grid3X3, Trophy, Calendar, Bell } from 'lucide-react';
import { motion } from 'motion/react';

// Import child views
import Players from './Players';
import Pools from './Pools';
import Bracket from './Bracket';

export default function Operations() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tournament } = useTournament();

  // Deduce active tab from current URL pathname
  const getTabFromPath = (path: string) => {
    if (path.includes('/organizer/checkin') || path.includes('/organizer/players')) {
      return 'checkin';
    }
    if (path.includes('/organizer/pools')) {
      return 'pools';
    }
    if (path.includes('/organizer/bracket')) {
      return 'bracket';
    }
    return 'pools'; // Fallback
  };

  const activeTab = getTabFromPath(location.pathname);

  const tabs = [
    { id: 'checkin', name: 'Pointage J-J', href: '/organizer/checkin', icon: UserCheck },
    { id: 'pools', name: 'Poules', href: '/organizer/pools', icon: Grid3X3 },
    { id: 'bracket', name: 'Phase Finale', href: '/organizer/bracket', icon: Trophy },
  ];

  return (
    <div className="min-h-full bg-[#081425] text-[#d8e3fb] select-none">
      {/* Sticky Tab Sub-Header with Sport-Tech Design */}
      <div className="sticky top-16 z-30 bg-[#081425]/95 backdrop-blur-md border-b border-[#1a3056] px-3 md:px-5 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1 sm:gap-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.href)}
                className={`relative px-4 py-2 text-xs sm:text-sm font-extrabold rounded-xl transition-all duration-200 flex items-center gap-2 cursor-pointer
                  ${isActive ? 'text-white bg-[#f97316]/10 border border-[#f97316]/20' : 'text-slate-400 hover:text-white hover:bg-[#111c2d]'}`}
              >
                <tab.icon className={`w-4 h-4 ${isActive ? 'text-[#f97316]' : 'text-slate-400'}`} />
                <span>{tab.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeSubTabUnderline"
                    className="absolute -bottom-[9px] left-2 right-2 h-0.5 bg-[#f97316]"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div id="operations-header-actions" className="flex items-center gap-3" />
      </div>

      {/* Render Active Module */}
      <div className="p-2 sm:p-4">
        {activeTab === 'checkin' && <Players />}
        {activeTab === 'pools' && <Pools />}
        {activeTab === 'bracket' && <Bracket />}
      </div>
    </div>
  );
}
