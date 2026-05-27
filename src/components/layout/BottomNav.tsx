import { useState } from 'react';
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
  MoreHorizontal,
  X,
  User,
  Calendar,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../supabase';
import { useTournament } from '../../hooks/useTournament';
import Logo from './Logo';

const primaryNavigation = [
  { name: 'Dashboard', href: '/organizer', icon: LayoutDashboard },
  { name: 'Pointage J-J', href: '/organizer/checkin', icon: UserCheck },
  { name: 'Poules', href: '/organizer/pools', icon: Grid3X3 },
  { name: 'Phase Finale', href: '/organizer/bracket', icon: Trophy },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tournament } = useTournament();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    setIsMenuOpen(false);
    // Naviguer d'abord pour sortir des routes protégées AVANT signOut(),
    // sinon ProtectedRoute.onAuthStateChange redirige vers /?login=true et
    // ouvre le modal de connexion, donnant l'impression de ne pas pouvoir se déconnecter.
    localStorage.removeItem('selected_tournament_id');
    navigate('/');
    await supabase.auth.signOut();
  };

  const menuItems = [
    { name: 'Gestion des Tables', href: '/organizer/tables', icon: Table, description: 'Suivi et affectation des tables' },
    { name: 'Live Score', href: '/organizer/scores', icon: QrCode, description: 'Saisie des scores et tables' },
    { name: 'Historique des tournois', href: '/organizer/archives', icon: History, description: 'Rapports et anciens tournois' },
    { name: 'Paramètres', href: '/organizer/settings', icon: Settings, description: 'Gestion des séries de jeu' },
  ];

  return (
    <>
      {/* Bottom bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 h-16 flex items-center justify-around z-40 pb-safe shadow-2xl">
        {primaryNavigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all duration-200
                ${isActive ? 'text-indigo-400' : 'text-slate-400 hover:text-white'}`}
            >
              <item.icon className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-medium tracking-tight">{item.name}</span>
              {isActive && (
                <motion.div
                  layoutId="activeBottomNav"
                  className="absolute bottom-1 w-1 h-1 bg-indigo-400 rounded-full"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setIsMenuOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 h-full text-slate-400 hover:text-white transition-all duration-200`}
        >
          <MoreHorizontal className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium tracking-tight">Plus</span>
        </button>
      </div>

      {/* Slide-up sheet */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="lg:hidden fixed inset-0 bg-black z-50 pointer-events-auto"
            />

            {/* Content Drawer */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900 text-white rounded-t-3xl border-t border-slate-850 z-50 p-6 shadow-2xl pb-8"
            >
              {/* Swipe/Drag Handle Bar */}
              <div className="flex justify-center mb-6">
                <div className="w-12 h-1 bg-slate-700 rounded-full" />
              </div>

              {/* Header inside Menu */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <Logo className="w-10 h-10" />
                  <div>
                    <h3 className="font-bold text-base leading-tight">Ping Manager Menu</h3>
                    {tournament && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full mt-1">
                        <Calendar className="w-3 h-3" />
                        Journée {tournament.current_day || 1}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1 px-3 py-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
                >
                  <X className="w-4 h-4" /> Fermer
                </button>
              </div>

              {/* Selection list */}
              <div className="space-y-3">
                {menuItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center gap-4 p-4 rounded-xl transition-all border
                        ${isActive 
                          ? 'bg-indigo-600/20 border-indigo-500 text-white' 
                          : 'bg-slate-850/50 border-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                    >
                      <div className={`p-2 rounded-lg 
                        ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-indigo-400'}`}>
                        <item.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-bold leading-none">{item.name}</p>
                        <p className="text-[11px] text-slate-400 mt-1">{item.description}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Logout & Footer */}
              <div className="mt-6 pt-6 border-t border-slate-800 flex flex-col gap-4">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-slate-300 font-bold text-xs">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Admin Club</p>
                    <p className="text-[10px] text-slate-500">Organisateur</p>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500 hover:text-white transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Se déconnecter
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
