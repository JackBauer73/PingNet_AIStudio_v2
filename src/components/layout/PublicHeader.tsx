import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Trophy, HelpCircle, Home, Calendar } from 'lucide-react';
import Logo from './Logo';
import { supabase } from '../../supabase';
import { useState, useEffect } from 'react';
import AuthModal from '../auth/AuthModal';
import AdminAuthModal from '../auth/AdminAuthModal';

export default function PublicHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const loginType = params.get('login');
    if (loginType === 'true') {
      setIsAuthModalOpen(true);
      navigate(location.pathname, { replace: true });
    } else if (loginType === 'admin') {
      setIsAdminAuthModalOpen(true);
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  const handleOrganizerClick = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      if (session.user?.email === 'vandamme.vince73@gmail.com') {
        navigate('/superadmin');
      } else {
        navigate('/organizer');
      }
    } else {
      setIsAuthModalOpen(true);
    }
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { name: 'Accueil', path: '/', icon: Home },
    { name: 'Tournois', path: '/tournois', icon: Calendar },
    { name: 'Tutoriel', path: '/tutoriel', icon: HelpCircle },
  ];

  return (
    <>
      <header className="border-b border-[#2a3548] bg-[#0a1729]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 cursor-pointer text-left">
            <Logo className="w-11 h-11" />
            <div>
              <span className="font-display font-extrabold tracking-tight text-white text-base leading-none block">Ping Manager</span>
              <span className="text-[10px] block font-sans font-bold text-[#f97316] uppercase tracking-wider -mt-0.5">Espace Joueurs</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-[#111e32]/60 p-1 rounded-xl border border-[#2a3548]/50">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isActive(item.path)
                    ? 'bg-[#f97316] text-white shadow-md shadow-orange-500/10'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOrganizerClick}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-200 bg-white/[0.03] hover:bg-white/10 rounded-xl transition-all border border-[#2a3548]"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Espace Organisateur</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex border-t border-[#2a3548]/50 bg-[#0a1729]/95 divide-x divide-[#2a3548]/30">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 text-[10px] font-bold transition-all ${
                isActive(item.path)
                  ? 'text-[#f97316] bg-[#f97316]/5'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.name}</span>
            </Link>
          ))}
        </div>
      </header>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <AdminAuthModal isOpen={isAdminAuthModalOpen} onClose={() => setIsAdminAuthModalOpen(false)} />
    </>
  );
}
