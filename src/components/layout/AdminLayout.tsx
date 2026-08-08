import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Users, 
  LogOut, 
  Shield, 
  Menu, 
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';
import { supabase } from '../../supabase';
import toast from 'react-hot-toast';

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: "Vue d'ensemble", href: '/admin', icon: LayoutDashboard },
    { name: 'Feedback & Bugs', href: '/admin/feedback', icon: MessageSquare },
    { name: 'Organisateurs', href: '/admin/organizers', icon: Users },
  ];

  const handleLogout = async () => {
    try {
      localStorage.removeItem('organizer_selected_tournament_id');
      localStorage.removeItem('public_selected_tournament_id');
      localStorage.removeItem('selected_tournament_id');
      navigate('/');
      await supabase.auth.signOut();
      toast.success('Déconnexion réussie !');
    } catch (e) {
      toast.error('Erreur lors de la déconnexion');
    }
  };

  return (
    <div className="flex h-screen bg-[#08111e] text-white font-sans overflow-hidden">
      {/* Sidebar Desktop */}
      <div className="hidden lg:flex flex-col w-64 bg-[#040e1f] text-white h-full border-r border-[#1a3056] shrink-0">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-3 px-2 hover:opacity-90 transition-opacity">
            <Logo className="w-9 h-9" />
            <div className="flex flex-col select-none">
              <span className="text-lg font-extrabold tracking-tight text-white leading-tight">Ping Manager</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none mt-1">Console</span>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-20 px-2 py-0.5 rounded-full mt-2 w-max border border-emerald-500/25">
                Mode Production
              </span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                id={`admin-nav-${item.name.toLowerCase().replace(/\s/g, '-')}`}
                to={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200
                  ${isActive 
                    ? 'bg-[#f97316] text-white shadow-lg shadow-orange-500/20' 
                    : 'text-slate-400 hover:bg-[#111c2d] hover:text-white'}
                `}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
                {isActive && (
                  <motion.div
                    layoutId="activeAdminNav"
                    className="ml-auto w-1.5 h-1.5 bg-white rounded-full"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-[#1a3056]">
          <button 
            id="admin-logout-sidebar"
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-slate-400 hover:bg-[#111c2d] hover:text-white rounded-xl transition-all cursor-pointer"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
            Déconnexion
          </button>
          <div className="mt-3 text-center text-[10px] font-mono text-slate-500 select-none">
            v0.21.0
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header mobile-only or console branding */}
        <header className="flex lg:hidden items-center justify-between px-6 py-4 bg-[#040e1f] border-b border-[#1a3056] shrink-0">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="w-7 h-7" />
            <div className="flex flex-col select-none">
              <span className="text-sm font-black text-white leading-tight">Ping Manager</span>
              <span className="text-[9px] font-bold text-slate-500 uppercase leading-none mt-0.5">Admin</span>
            </div>
          </Link>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1 px-2.5 bg-slate-800 text-slate-300 rounded-lg hover:text-white hover:bg-slate-700 transition"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        {/* Mobile Navigation Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="lg:hidden absolute top-[61px] left-0 right-0 bg-[#040e1f] border-b border-[#1a3056] z-45 px-6 py-4 space-y-2 flex flex-col shadow-2xl"
            >
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all
                      ${isActive 
                        ? 'bg-[#f97316] text-white shadow-lg shadow-orange-500/10' 
                        : 'text-slate-400 hover:bg-[#111c2d] hover:text-white'}
                    `}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                );
              })}
              <div className="pt-3 border-t border-[#1a3056] mt-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm font-medium text-slate-400 hover:text-red-400"
                >
                  <LogOut className="w-5 h-5" />
                  Déconnexion
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Render actual subpages */}
        <main className="flex-1 overflow-y-auto bg-[#08111e]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
