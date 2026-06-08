import React, { useState } from 'react';
import { supabase } from '../../supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { X, LogIn, UserPlus, Mail, Lock, Shield, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Logo from '../layout/Logo';

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
            className="fixed inset-0 bg-[#070e17]/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
            className="relative w-full max-w-md overflow-hidden bg-white dark:bg-[#0a1729] rounded-[2.25rem] border border-slate-200 dark:border-[#2a3548] shadow-2xl p-8 sm:p-10 z-10"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-all cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="text-center mb-8">
              <Logo className="w-16 h-16 mx-auto mb-4 animate-in zoom-in-50 duration-300" />
              <h3 className="text-2xl font-black font-display text-slate-900 dark:text-white tracking-tight">
                {isSignUp ? 'Créer un accès club' : 'Espace Club'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-semibold max-w-[280px] mx-auto leading-relaxed">
                {isSignUp 
                  ? 'Inscrivez votre club et commencez à organiser vos tournois dès maintenant' 
                  : 'Connectez-vous pour piloter votre événement'
                }
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest pl-1.5">
                    Nom du club
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Sparkles className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    </span>
                    <input
                      type="text"
                      required={isSignUp}
                      placeholder="Ex: TT Club Paris Nord"
                      value={clubName}
                      onChange={(e) => setClubName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-[#0c1524] border border-slate-200 dark:border-[#2a3548] focus:border-indigo-500 dark:focus:border-[#f97316] focus:bg-white dark:focus:bg-[#0d1729] text-slate-900 dark:text-white rounded-2xl font-semibold outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-sm focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-[#f97316]/10"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest pl-1.5">
                  Adresse Email
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="contact@monclub.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-[#0c1524] border border-slate-200 dark:border-[#2a3548] focus:border-indigo-500 dark:focus:border-[#f97316] focus:bg-white dark:focus:bg-[#0d1729] text-slate-900 dark:text-white rounded-2xl font-semibold outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-sm focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-[#f97316]/10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest pl-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-[#0c1524] border border-slate-200 dark:border-[#2a3548] focus:border-indigo-500 dark:focus:border-[#f97316] focus:bg-white dark:focus:bg-[#0d1729] text-slate-900 dark:text-white rounded-2xl font-semibold outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-sm focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-[#f97316]/10"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 flex items-center justify-center gap-2.5 mt-6 py-3 px-4 bg-[#f97316] hover:bg-[#ea6a0a] text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-[#f97316]/10 hover:shadow-[#f97316]/20 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
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
                className="text-xs font-bold text-indigo-600 dark:text-[#f97316] hover:text-indigo-700 dark:hover:text-orange-400 hover:underline transition-all uppercase tracking-widest"
              >
                {isSignUp ? 'Déjà inscrit ? Connectez-vous' : 'Pas de compte ? Créer un accès club'}
              </button>
            </div>

            {/* Helper info inside modal */}
            {!isSignUp && (
              <div className="mt-6 p-4.5 bg-slate-50/50 dark:bg-[#0c1524]/60 rounded-2.5xl border border-slate-200/50 dark:border-[#2a3548]/30 text-[11px] text-slate-500 dark:text-slate-400 space-y-2">
                <p className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-500 dark:text-[#f97316] shrink-0" />
                  Note de configuration
                </p>
                <p className="leading-relaxed">
                  Chaque club gère <strong className="text-slate-700 dark:text-slate-200 font-bold">ses propres tournois, poules et tables</strong> de façon cloisonnée. Si le courriel de confirmation d'inscription ne vous parvient pas, demandez à l'administrateur de désactiver l'option <span className="text-indigo-500 dark:text-slate-300 font-mono font-semibold">"Confirm email"</span> dans Supabase Providers.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
