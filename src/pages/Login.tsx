import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clubName, setClubName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/organizer');
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      if (isSignUp) {
        if (!clubName.trim()) {
          throw new Error('Veuillez renseigner le nom de votre club.');
        }
        const { error } = await supabase.auth.signUp({ 
          email: trimmedEmail, 
          password,
          options: {
            data: {
              club_name: clubName.trim(),
            }
          }
        });
        if (error) throw error;
        toast.success('Compte club créé ! Vérifiez vos emails si la confirmation est activée, puis connectez-vous.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
        if (error) {
          if (error.message === 'Invalid login credentials') {
            throw new Error('Email ou mot de passe incorrect. Avez-vous créé votre compte ?');
          }
          throw error;
        }
        toast.success('Connexion réussie');
        navigate('/organizer');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur d’authentification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="max-w-md w-full space-y-8 p-10 bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800">
        <div className="text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20">
            <span className="text-2xl font-black text-white italic">TT</span>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight">
            TournoisTT
          </h2>
          <p className="mt-2 text-sm text-slate-400 font-medium">
            {isSignUp ? 'Création de compte organisateur' : 'Espace Organisateur'}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Nom du club</label>
                <input
                  type="text"
                  required={isSignUp}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Ex: TT Club Paris"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Email</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Mot de passe</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-4 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Chargement...' : (isSignUp ? 'Créer mon compte' : 'Se connecter')}
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest"
            >
              {isSignUp ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? Créer un accès'}
            </button>
          </div>
        </form>

        {/* Aide à la configuration Supabase */}
        <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/60 text-xs text-slate-400 space-y-2">
          <p className="font-bold text-indigo-400 flex items-center gap-1.5">
            🔑 Problèmes de création ou d'accès ?
          </p>
          <p>
            Par défaut, <strong>Supabase</strong> active la confirmation par email lors du <code>signUp</code>. Si vous ne recevez pas l'email ou que le login échoue :
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-400">
            <li>Allez sur votre console <strong>Supabase</strong>.</li>
            <li>Rendez-vous dans <strong>Authentication &gt; Providers &gt; Email</strong>.</li>
            <li>Désactivez l'option <strong>"Confirm email"</strong> (et cliquez sur Save).</li>
            <li>Vous pourrez ainsi vous inscrire et vous connecter instantanément !</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
