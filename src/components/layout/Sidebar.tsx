import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Grid3X3, 
  Table,
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
import Logo from './Logo';

const navigation = [
  { name: 'Dashboard', href: '/organizer', icon: LayoutDashboard },
  { name: 'Pointage J-J', href: '/organizer/checkin', icon: UserCheck },
  { name: 'Poules', href: '/organizer/pools', icon: Grid3X3 },
  { name: 'Phase Finale', href: '/organizer/bracket', icon: Trophy },
  { name: 'Gestion des Tables', href: '/organizer/tables', icon: Table },
  { name: 'Live Score', href: '/organizer/scores', icon: QrCode },
  { name: 'Historique', href: '/organizer/archives', icon: History },
  { name: 'Paramètres', href: '/organizer/settings', icon: Settings },
];

import { supabase } from '../../supabase';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tournament } = useTournament();

  const handleLogout = async () => {
    // Naviguer d'abord pour sortir des routes protégées AVANT signOut(),
    // sinon ProtectedRoute.onAuthStateChange redirige vers /?login=true et
    // ouvre le modal de connexion, donnant l'impression de ne pas pouvoir se déconnecter.
    localStorage.removeItem('organizer_selected_tournament_id');
    localStorage.removeItem('public_selected_tournament_id');
    localStorage.removeItem('selected_tournament_id');
    navigate('/');
    await supabase.auth.signOut();
  };

  return (
    <div className="hidden lg:flex flex-col w-64 bg-slate-900 text-white h-full border-r border-slate-800 shrink-0">
      <div className="p-6">
        <Link to="/" className="flex items-center gap-3 px-2 hover:opacity-90 transition-opacity">
          <Logo className="w-9 h-9" />
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight">Ping Manager</span>
            {tournament && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full mt-1 w-max">
                <Calendar className="w-3 h-3" />
                Jour {tournament.current_day || 1}
              </span>
            )}
          </div>
        </Link>
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
        <div className="mt-3 text-center text-[10px] font-mono text-slate-500 select-none">
          v0.17.2
        </div>
      </div>
    </div>
  );
}
