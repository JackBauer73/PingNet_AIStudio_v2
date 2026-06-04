import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
