import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../supabase';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Utiliser UNIQUEMENT onAuthStateChange comme source de vérité.
    // INITIAL_SESSION est émis immédiatement par Supabase avec la session courante,
    // ce qui évite la race condition de getSession() appelé séparément :
    // entre navigate('/organizer') et le mount de ProtectedRoute,
    // getSession() pouvait retourner null → redirection vers /?login=true
    // alors que l'utilisateur venait juste de se connecter.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthenticated(!!session);
      if (event === 'INITIAL_SESSION') {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/?login=true" replace />;
  }

  return <>{children}</>;
}
