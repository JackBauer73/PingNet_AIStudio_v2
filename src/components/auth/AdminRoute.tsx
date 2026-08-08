import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../supabase';

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!active) return;
      setSession(currentSession);

      if (!currentSession) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // Option de secours robuste : l'ID email d'administration par défaut (Vince Vandamme)
        const isDefaultAdmin = currentSession.user?.email === 'vandamme.vince73@gmail.com';

        // Tenter d'interroger la table profiles
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentSession.user.id)
          .single();

        if (active) {
          if (error) {
            console.warn("Impossible de lire la table 'profiles', recours à l'email par défaut:", error.message);
            setIsAdmin(isDefaultAdmin);
          } else {
            setIsAdmin(data?.role === 'admin' || isDefaultAdmin);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error("Erreur d'autorisation d'administration:", err);
        if (active) {
          setIsAdmin(currentSession.user?.email === 'vandamme.vince73@gmail.com');
          setLoading(false);
        }
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08111e] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/?login=admin" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/organizer" replace />;
  }

  return <>{children}</>;
}
