import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePlayerAuth } from '../hooks/usePlayerAuth';
import { Loader2 } from 'lucide-react';

export function PlayerRoute({ children }: { children: React.ReactNode }) {
  const { player, loading } = usePlayerAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1f3d] flex flex-col items-center justify-center p-6 text-white text-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
        <p className="text-slate-450 font-medium">Chargement de votre session...</p>
      </div>
    );
  }

  if (!player) {
    return <Navigate to="/player/login" replace />;
  }

  return <>{children}</>;
}
