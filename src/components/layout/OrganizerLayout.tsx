import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import { isSupabaseConfigured } from '../../supabase';
import { AlertCircle } from 'lucide-react';

export default function OrganizerLayout() {
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden flex-col">
      {!isSupabaseConfigured && (
        <div className="bg-[#f97316] text-white text-xs md:text-sm py-3 px-4 shadow-md text-center font-bold flex items-center justify-center gap-2.5 z-50 shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0 animate-pulse" />
          <span>Base de données non configurée. Impossible de charger l'espace Organisateur. Veuillez renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY face à vos Secrets AI Studio.</span>
        </div>
      )}
      <div className="flex flex-1 min-w-0">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 overflow-y-auto pb-24 lg:pb-6">
            <Outlet />
          </main>
          <BottomNav />
        </div>
      </div>
    </div>
  );
}
