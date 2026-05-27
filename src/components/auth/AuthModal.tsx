import React, { useState } from 'react';
import { supabase } from '../../supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { X, LogIn, UserPlus, Mail, Lock, Shield, Sparkles, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clubName, setClubName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();

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
        toast.success('Compte club créé ! Vous pouvez maintenant vous connecter ou vérifier vos emails.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
        if (error) {
          if (error.message === 'Invalid login credentials') {
            throw new Error('Email ou mot de passe incorrect. Avez-vous créé votre compte ?');
          }
          throw error;
        }
        toast.success('Connexion réussie !');
        onClose();
        navigate('/organizer');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur d’authentification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
            className="relative w-full max-w-md overflow-hidden bg-white rounded-3xl border border-slate-100 shadow-2xl p-8 sm:p-10 z-10"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/10">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {isSignUp ? 'Créer un compte club' : 'Espace Club'}
              </h3>
              <p className="text-sm text-slate-500 mt-1.5 font-medium">
                {isSignUp 
                  ? 'Inscrivez votre club et gérez vos tournois' 
                  : 'Connectez-vous pour piloter votre événement'
                }
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
                    Nom du club
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Sparkles className="w-4 h-4 text-slate-400" />
                    </span>
                    <input
                      type="text"
                      required={isSignUp}
                      placeholder="Ex: TT Club Paris Nord"
                      value={clubName}
                      onChange={(e) => setClubName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white text-slate-800 rounded-2xl font-semibold outline-none transition-all placeholder:text-slate-400 text-sm focus:ring-4 focus:ring-indigo-500/10"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
                  Adresse Email
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="w-4 h-4 text-slate-400" />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="contact@monclub.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white text-slate-800 rounded-2xl font-semibold outline-none transition-all placeholder:text-slate-400 text-sm focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
                  Mot de passe
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-slate-400" />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white text-slate-800 rounded-2xl font-semibold outline-none transition-all placeholder:text-slate-400 text-sm focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 mt-6 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-indigo-600/10 transition-all hover:shadow-indigo-600/15 active:scale-98 disabled:opacity-50"
              >
                {isSignUp ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                {loading ? 'Traitement en cours...' : (isSignUp ? 'Créer le compte club' : 'Se connecter')}
              </button>
            </form>

            {/* Toggle Sign Up / Sign In */}
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition-all uppercase tracking-wider"
              >
                {isSignUp ? 'Déjà inscrit ? Connectez-vous' : 'Pas de compte ? Créer un accès club'}
              </button>
            </div>

            {/* Helper info inside modal */}
            <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-500 space-y-1.5">
              <p className="font-bold text-slate-700 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                Note de configuration
              </p>
              <p className="leading-normal">
                Chaque club gère <strong>ses propres tournois, poules et tables</strong> de façon cloisonnée. Si le courriel de confirmation d'inscription ne vous parvient pas, demandez à l'administrateur de désactiver l'option <em>"Confirm email"</em> dans Supabase Providers.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
