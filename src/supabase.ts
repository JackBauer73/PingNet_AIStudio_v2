import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Détection et nettoyage d'urgence de session contenant des métadonnées géantes (ex: logo lourd en base64)
try {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
      const val = localStorage.getItem(key);
      if (val && val.length > 20000) { // Si la session fait plus de 20 Ko (normal d'un token: ~3-4 Ko)
        keysToRemove.push(key);
      }
    }
  }
  if (keysToRemove.length > 0) {
    console.warn('Nettoyage d\'urgence : Jeton de session trop volumineux détecté (logo base64 lourd potentiel). Nettoyage de la session...');
    keysToRemove.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem('organizer_club_name');
    localStorage.removeItem('organizer_club_phone');
    localStorage.removeItem('organizer_club_email');
    localStorage.removeItem('organizer_selected_tournament_id');
    localStorage.removeItem('public_selected_tournament_id');
    localStorage.removeItem('selected_tournament_id');
    
    // Alerte explicative et amicale pour l'utilisateur
    setTimeout(() => {
      alert("⚠️ Ping Manager - Session réinitialisée :\n\nUn logo trop lourd (Base64 volumineuse) avait été enregistré dans votre profil de club, ce qui bloquait toutes les requêtes réseau Supabase (Erreurs de connexion).\n\nVotre session a été nettoyée pour restaurer l'application. Nous vous conseillons de créer un NOUVEAU compte club ou de vous connecter avec un compte propre. Un système d'optimisation automatique a été mis en place pour compresser automatiquement tous les logos à l'avenir !");
    }, 1000);
  }
} catch (err) {
  console.error('Erreur lors de la validation d\'urgence de la session:', err);
}

export const isSupabaseConfigured = 
  !!supabaseUrl && 
  supabaseUrl !== 'https://your-project.supabase.co' && 
  supabaseUrl !== 'https://placeholder.supabase.co' &&
  !supabaseUrl.includes('placeholder');

if (!isSupabaseConfigured) {
  console.warn('Supabase credentials missing or invalid. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your secrets.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

// Intercept getSession and getUser to cleanly clear stale localStorage states
// in case of "Invalid Refresh Token" or "Refresh Token Not Found" errors
const clearLocalStorageAuthKeys = () => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('auth-token'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (err) {
    console.error('Failed to clear localStorage:', err);
  }
};

const originalGetSession = supabase.auth.getSession.bind(supabase.auth);
supabase.auth.getSession = async () => {
  try {
    const res = await originalGetSession();
    if (res.error) {
      const msg = res.error.message || '';
      if (
        msg.includes('Refresh Token Not Found') || 
        msg.includes('Invalid Refresh Token') || 
        msg.includes('refresh_token_not_found')
      ) {
        console.warn('Stale Supabase refresh token detected. Cleaning local auth state...');
        clearLocalStorageAuthKeys();
        return { data: { session: null }, error: null };
      }
    }
    return res;
  } catch (err) {
    console.error('Error in getSession interceptor:', err);
    return { data: { session: null }, error: null };
  }
};

const originalGetUser = supabase.auth.getUser.bind(supabase.auth);
supabase.auth.getUser = async (jwt?: string) => {
  try {
    const res = await originalGetUser(jwt);
    if (res.error) {
      const msg = res.error.message || '';
      if (
        msg.includes('Refresh Token Not Found') || 
        msg.includes('Invalid Refresh Token') || 
        msg.includes('refresh_token_not_found')
      ) {
        console.warn('Stale Supabase user session detected. Cleaning local auth state...');
        clearLocalStorageAuthKeys();
        return { data: { user: null }, error: null };
      }
    }
    return res;
  } catch (err) {
    console.error('Error in getUser interceptor:', err);
    return { data: { user: null }, error: null };
  }
};
