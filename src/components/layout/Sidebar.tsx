import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Grid3X3, 
  Trophy, 
  Settings, 
  QrCode,
  LogOut,
  History,
  Calendar,
  UserCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTournament } from '../../hooks/useTournament';

const navigation = [
  { name: 'Dashboard', href: '/organizer', icon: LayoutDashboard },
  { name: 'Pointage J-J', href: '/organizer/checkin', icon: UserCheck },
  { name: 'Poules', href: '/organizer/pools', icon: Grid3X3 },
  { name: 'Tableau', href: '/organizer/bracket', icon: Trophy },
  { name: 'Direct', href: '/organizer/scores', icon: QrCode },
  { name: 'Historique', href: '/organizer/archives', icon: History },
  { name: 'Paramètres', href: '/organizer/settings', icon: Settings },
];

import { supabase } from '../../supabase';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tournament } = useTournament();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="hidden lg:flex flex-col w-64 bg-slate-900 text-white min-h-screen border-r border-slate-800 shrink-0">
      <div className="p-6">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <span className="font-bold text-lg text-white font-mono">TT</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight">TournoisTT</span>
            {tournament && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full mt-1 w-max">
                <Calendar className="w-3 h-3" />
                Jour {tournament.current_day || 1}
              </span>
            )}
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200
                ${isActive 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
              `}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="ml-auto w-1.5 h-1.5 bg-white rounded-full"
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-slate-800">
        <button 
          className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-all"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5" />
          Déconnexion
        </button>
      </div>
    </div>
  );
}
